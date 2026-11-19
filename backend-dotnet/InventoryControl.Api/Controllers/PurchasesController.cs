using InventoryControl.Application.DTOs;
using InventoryControl.Domain.Entities;
using InventoryControl.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace InventoryControl.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PurchasesController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly ILogger<PurchasesController> _logger;

    public PurchasesController(AppDbContext context, ILogger<PurchasesController> logger)
    {
        _context = context;
        _logger = logger;
    }

    // GET: api/purchases
    [HttpGet]
    public async Task<ActionResult<IEnumerable<Purchase>>> GetPurchases()
    {
        var purchases = await _context.Purchases
            .Include(p => p.Items)
            .OrderByDescending(p => p.PurchaseDate)
            .ToListAsync();

        return Ok(purchases);
    }

    // GET: api/purchases/{id}
    [HttpGet("{id:int}")]
    public async Task<ActionResult<Purchase>> GetPurchase(int id)
    {
        var purchase = await _context.Purchases
            .Include(p => p.Items)
            .FirstOrDefaultAsync(p => p.Id == id);

        if (purchase == null)
            return NotFound(new { message = "Compra não encontrada." });

        return Ok(purchase);
    }

    // POST: api/purchases (Transação Atômica: Compra + Itens + Atualização de Estoque + Movimentações)
    [HttpPost]
    public async Task<ActionResult<Purchase>> CreatePurchase([FromBody] CreatePurchaseDto dto)
    {
        if (dto.Items == null || dto.Items.Count == 0)
        {
            return BadRequest(new { message = "A compra deve conter ao menos um item." });
        }

        // Início da Transação Atômica
        await using var transaction = await _context.Database.BeginTransactionAsync();

        try
        {
            decimal totalAmount = 0;

            var purchase = new Purchase
            {
                StoreName = string.IsNullOrWhiteSpace(dto.StoreName) ? "Supermercado" : dto.StoreName,
                PurchaseDate = dto.PurchaseDate ?? DateTime.UtcNow,
                NfeKey = dto.NfeKey,
                Notes = dto.Notes,
                CreatedAt = DateTime.UtcNow
            };

            foreach (var itemDto in dto.Items)
            {
                var itemTotal = Math.Round(itemDto.Quantity * itemDto.UnitPrice, 2);
                totalAmount += itemTotal;

                // 1. Localizar ou cadastrar o produto no estoque
                Product? product = null;

                if (itemDto.ProductId.HasValue)
                {
                    product = await _context.Products.FindAsync(itemDto.ProductId.Value);
                }
                else if (!string.IsNullOrWhiteSpace(itemDto.Barcode))
                {
                    product = await _context.Products.FirstOrDefaultAsync(p => p.Barcode == itemDto.Barcode);
                }
                else if (!string.IsNullOrWhiteSpace(itemDto.Description))
                {
                    product = await _context.Products.FirstOrDefaultAsync(p => p.Name.ToLower() == itemDto.Description.ToLower());
                }

                // Se o produto não existe no estoque, cadastramos automaticamente
                if (product == null)
                {
                    product = new Product
                    {
                        Name = itemDto.Description,
                        Barcode = itemDto.Barcode,
                        Category = string.IsNullOrWhiteSpace(itemDto.Category) ? "Geral" : itemDto.Category,
                        CurrentStock = 0,
                        MinimumStock = 1,
                        UnitPrice = itemDto.UnitPrice,
                        PreviousUnitPrice = null,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    };
                    _context.Products.Add(product);
                    await _context.SaveChangesAsync(); // Gera o Id do produto
                }

                // 2. Criar o item da compra e calcular variação %
                var purchaseItem = new PurchaseItem
                {
                    ProductId = product.Id,
                    Description = itemDto.Description,
                    Barcode = itemDto.Barcode ?? product.Barcode,
                    Quantity = itemDto.Quantity,
                    UnitPrice = itemDto.UnitPrice,
                    TotalPrice = itemTotal,
                    PreviousUnitPrice = product.UnitPrice > 0 ? product.UnitPrice : null
                };
                purchaseItem.CalculatePriceVariation();
                purchase.Items.Add(purchaseItem);

                // 3. Atualizar estoque e histórico de preço do produto
                product.AdjustStock(itemDto.Quantity);
                product.UpdatePrice(itemDto.UnitPrice);

                // 4. Registrar auditoria na tabela de movimentações (Entrada no Estoque)
                var movement = new StockMovement
                {
                    ProductId = product.Id,
                    Type = MovementType.IN,
                    Quantity = itemDto.Quantity,
                    Reason = $"Compra em {purchase.StoreName} (NF: {purchase.NfeKey ?? "Manual"})",
                    CreatedAt = DateTime.UtcNow
                };
                _context.StockMovements.Add(movement);
            }

            purchase.TotalAmount = totalAmount;
            _context.Purchases.Add(purchase);

            await _context.SaveChangesAsync();

            // Confirma a transação (Commit)
            await transaction.CommitAsync();

            _logger.LogInformation("Compra {PurchaseId} finalizada com sucesso. Total: {TotalAmount:C}", purchase.Id, purchase.TotalAmount);

            return CreatedAtAction(nameof(GetPurchase), new { id = purchase.Id }, purchase);
        }
        catch (Exception ex)
        {
            // Qualquer erro desfaz todas as alterações
            await transaction.RollbackAsync();
            _logger.LogError(ex, "Erro ao processar a compra. Transação revertida.");
            return StatusCode(500, new { message = "Erro interno ao processar a compra.", details = ex.Message });
        }
    }

    // GET: api/purchases/financial-summary (Dashboard Financeiro)
    [HttpGet("financial-summary")]
    public async Task<ActionResult<FinancialSummaryDto>> GetFinancialSummary()
    {
        var now = DateTime.UtcNow;
        var startOfMonth = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);

        var monthPurchases = await _context.Purchases
            .Include(p => p.Items)
            .Where(p => p.PurchaseDate >= startOfMonth)
            .ToListAsync();

        var totalSpent = monthPurchases.Sum(p => p.TotalAmount);
        var totalPurchasesCount = monthPurchases.Count;

        var allItems = monthPurchases.SelectMany(p => p.Items).ToList();

        // Média de variação de preços
        var itemsWithVariation = allItems.Where(i => i.PriceVariationPercent.HasValue && i.PriceVariationPercent.Value != 0).ToList();
        var avgVariation = itemsWithVariation.Any()
            ? Math.Round(itemsWithVariation.Average(i => i.PriceVariationPercent!.Value), 2)
            : 0;

        // Maiores aumentos de preço
        var topHikes = itemsWithVariation
            .Where(i => i.PriceVariationPercent > 0)
            .OrderByDescending(i => i.PriceVariationPercent)
            .Take(5)
            .Select(i => new PriceInflationAlertDto
            {
                ProductName = i.Description,
                OldPrice = i.PreviousUnitPrice ?? 0,
                NewPrice = i.UnitPrice,
                VariationPercent = i.PriceVariationPercent ?? 0
            })
            .ToList();

        var summary = new FinancialSummaryDto
        {
            TotalSpentCurrentMonth = totalSpent,
            TotalPurchasesCurrentMonth = totalPurchasesCount,
            AveragePriceVariationPercent = avgVariation,
            TopPriceHikes = topHikes
        };

        return Ok(summary);
    }
}

