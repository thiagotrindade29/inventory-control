using InventoryControl.Application.DTOs;
using InventoryControl.Application.Services;
using InventoryControl.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace InventoryControl.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class NfeController : ControllerBase
{
    private readonly NfeService _nfeService;
    private readonly AppDbContext _context;
    private readonly ILogger<NfeController> _logger;
    private readonly IHttpClientFactory _httpClientFactory;

    public NfeController(
        NfeService nfeService,
        AppDbContext context,
        ILogger<NfeController> logger,
        IHttpClientFactory httpClientFactory)
    {
        _nfeService = nfeService;
        _context = context;
        _logger = logger;
        _httpClientFactory = httpClientFactory;
    }

    // POST: api/nfe/parse-xml
    [HttpPost("parse-xml")]
    public async Task<ActionResult<ParsedNfeDto>> ParseXml([FromBody] ParseXmlRequestDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.XmlContent))
        {
            return BadRequest(new { error = "O conteúdo XML é obrigatório." });
        }

        try
        {
            var parsed = _nfeService.ParseXml(dto.XmlContent);
            await MatchProductsWithDatabase(parsed);
            return Ok(parsed);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao processar o XML da NF-e.");
            return BadRequest(new { error = "Erro ao processar o arquivo XML da NF-e.", details = ex.Message });
        }
    }

    // POST: api/nfe/upload-xml
    [HttpPost("upload-xml")]
    public async Task<ActionResult<ParsedNfeDto>> UploadXml(IFormFile file)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest(new { error = "Selecione um arquivo XML válido." });
        }

        try
        {
            using var reader = new StreamReader(file.OpenReadStream());
            var xmlContent = await reader.ReadToEndAsync();

            var parsed = _nfeService.ParseXml(xmlContent);
            await MatchProductsWithDatabase(parsed);
            return Ok(parsed);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao processar o upload do XML.");
            return BadRequest(new { error = "Falha ao ler o arquivo XML enviado.", details = ex.Message });
        }
    }

    [HttpPost("parse-url")]
    public async Task<ActionResult<ParsedNfeDto>> ParseUrl(
        [FromBody] ParseUrlRequestDto dto,
        CancellationToken cancellationToken)
    {
        if (!Uri.TryCreate(dto.Url, UriKind.Absolute, out var uri) ||
            (uri.Scheme != Uri.UriSchemeHttps && uri.Scheme != Uri.UriSchemeHttp))
            return BadRequest(new { error = "URL do QR Code da SEFAZ inválida." });

        try
        {
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            timeout.CancelAfter(TimeSpan.FromSeconds(12));

            var client = _httpClientFactory.CreateClient();
            using var request = new HttpRequestMessage(HttpMethod.Get, uri);
            request.Headers.UserAgent.ParseAdd(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36");
            request.Headers.Accept.ParseAdd("text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8");
            request.Headers.AcceptLanguage.ParseAdd("pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7");

            using var response = await client.SendAsync(request, timeout.Token);
            if (!response.IsSuccessStatusCode)
                return StatusCode(StatusCodes.Status502BadGateway,
                    new { error = $"A SEFAZ retornou código HTTP {(int)response.StatusCode}." });

            var html = await response.Content.ReadAsStringAsync(timeout.Token);
            var parsed = _nfeService.ParseSefazHtml(html);
            if (parsed.Items.Count == 0)
                return UnprocessableEntity(new
                {
                    error = "Não foi possível extrair os itens desta página da SEFAZ. Tente importar o XML ou colar o texto do cupom."
                });

            parsed.Url = uri.ToString();
            await MatchProductsWithDatabase(parsed);
            return Ok(parsed);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            return StatusCode(StatusCodes.Status504GatewayTimeout,
                new { error = "Tempo limite esgotado ao consultar a SEFAZ. O portal estadual pode estar instável." });
        }
        catch (HttpRequestException ex)
        {
            _logger.LogWarning(ex, "Falha ao consultar a URL da SEFAZ.");
            return StatusCode(StatusCodes.Status502BadGateway,
                new { error = "Não foi possível consultar o portal da SEFAZ." });
        }
    }

    [HttpPost("parse-text")]
    public async Task<ActionResult<ParsedNfeDto>> ParseText([FromBody] ParseTextRequestDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Text))
            return BadRequest(new { error = "Texto do cupom não informado." });

        var parsed = _nfeService.ParseReceiptText(dto.Text);
        if (parsed.Items.Count == 0)
            return UnprocessableEntity(new
            {
                error = "Nenhum item com quantidade e preço foi identificado no texto. Confira o texto ou digite os itens."
            });

        await MatchProductsWithDatabase(parsed);
        return Ok(parsed);
    }

    private async Task MatchProductsWithDatabase(ParsedNfeDto nfe)
    {
        var existingProducts = await _context.Products.Include(p => p.Category).ToListAsync();
        var categories = await _context.Categories.OrderBy(c => c.Name).ToListAsync();

        foreach (var item in nfe.Items)
        {
            var matched = existingProducts.FirstOrDefault(p =>
                (!string.IsNullOrEmpty(item.Barcode) && item.Barcode.Length >= 8 &&
                    (p.Barcode == item.Barcode || p.Sku == item.Barcode)) ||
                string.Equals(p.Name, item.Description, StringComparison.OrdinalIgnoreCase) ||
                p.Name.Contains(item.Description, StringComparison.OrdinalIgnoreCase));

            var category = matched?.Category ?? categories.FirstOrDefault(c =>
                string.Equals(c.Name, item.SuggestedCategory, StringComparison.OrdinalIgnoreCase))
                ?? categories.FirstOrDefault(c =>
                    string.Equals(c.Name, "Alimentos & Despensa", StringComparison.OrdinalIgnoreCase))
                ?? categories.FirstOrDefault();

            item.Index = nfe.Items.IndexOf(item) + 1;
            item.ProductId = matched?.Id;
            item.IsExisting = matched != null;
            item.CurrentStock = matched?.Quantity ?? 0;
            item.PreviousUnitPrice = matched?.UnitPrice ?? item.UnitPrice;
            item.CategoryId = category?.Id;
            item.CategoryName = category?.Name ?? item.SuggestedCategory;
            item.CategoryColor = category?.Color ?? "#3b82f6";
            item.Location = matched?.Location ?? "Despensa";

        }
    }
}
