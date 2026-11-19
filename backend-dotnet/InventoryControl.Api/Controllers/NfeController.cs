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

    public NfeController(NfeService nfeService, AppDbContext context, ILogger<NfeController> logger)
    {
        _nfeService = nfeService;
        _context = context;
        _logger = logger;
    }

    // POST: api/nfe/parse-xml
    [HttpPost("parse-xml")]
    public async Task<ActionResult<ParsedNfeDto>> ParseXml([FromBody] ParseXmlRequestDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.XmlContent))
        {
            return BadRequest(new { message = "O conteúdo XML é obrigatório." });
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
            return BadRequest(new { message = "Erro ao processar o arquivo XML da NF-e.", details = ex.Message });
        }
    }

    // POST: api/nfe/upload-xml
    [HttpPost("upload-xml")]
    public async Task<ActionResult<ParsedNfeDto>> UploadXml(IFormFile file)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest(new { message = "Selecione um arquivo XML válido." });
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
            return BadRequest(new { message = "Falha ao ler o arquivo XML enviado.", details = ex.Message });
        }
    }

    private async Task MatchProductsWithDatabase(ParsedNfeDto nfe)
    {
        var existingProducts = await _context.Products.Include(p => p.Category).ToListAsync();

        foreach (var item in nfe.Items)
        {
            var matched = existingProducts.FirstOrDefault(p =>
                (!string.IsNullOrEmpty(item.Barcode) && p.Barcode == item.Barcode) ||
                string.Equals(p.Name, item.Description, StringComparison.OrdinalIgnoreCase));

            if (matched != null)
            {
                item.MatchedProductId = matched.Id;
                if (matched.Category != null)
                {
                    item.Category = matched.Category.Name;
                }
                item.PreviousUnitPrice = matched.UnitPrice;

                if (matched.UnitPrice > 0)
                {
                    item.PriceVariationPercent = Math.Round(((item.UnitPrice - matched.UnitPrice) / matched.UnitPrice) * 100, 2);
                }
            }
        }
    }
}
