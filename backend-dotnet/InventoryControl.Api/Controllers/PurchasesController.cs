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
    public async Task<ActionResult<IEnumerable<object>>> GetPurchases()
    {
        var purchases = await _context.Purchases
            .OrderByDescending(p => p.CreatedAt)
            .Select(p => new
            {
                id = p.Id,
                store_name = p.StoreName,
                total_amount = p.TotalAmount,
                total_items = p.TotalItems,
                notes = p.Notes,
                created_at = p.CreatedAt,
                items_count = p.Items.Count
            })
            .ToListAsync();

        return Ok(purchases);
    }

    // GET: api/purchases/{id}
    [HttpGet("{id:int}")]
    public async Task<ActionResult<object>> GetPurchase(int id)
    {
        var purchase = await _context.Purchases
            .Include(p => p.Items)
                .ThenInclude(i => i.Product)
                    .ThenInclude(prod => prod!.Category)
            .FirstOrDefaultAsync(p => p.Id == id);

        if (purchase == null)
            return NotFound(new { error = "Compra não encontrada." });

        var items = purchase.Items.Select(pi => new
        {
            id = pi.Id,
            purchase_id = pi.PurchaseId,
            product_id = pi.ProductId,
            product_name = pi.ProductName,
            barcode = pi.Barcode,
            quantity = pi.Quantity,
            unit_price = pi.UnitPrice,
            previous_unit_price = pi.PreviousUnitPrice,
            total_price = pi.TotalPrice,
            price_variation_pct = pi.PriceVariationPct,
            created_at = pi.CreatedAt,
            location = pi.Product != null ? pi.Product.Location : "Despensa",
            category_name = (pi.Product != null && pi.Product.Category != null) ? pi.Product.Category.Name : "Geral",
            category_color = (pi.Product != null && pi.Product.Category != null) ? pi.Product.Category.Color : "#3b82f6"
        });

        return Ok(new
        {
            id = purchase.Id,
            store_name = purchase.StoreName,
            total_amount = purchase.TotalAmount,
            total_items = purchase.TotalItems,
            notes = purchase.Notes,
            created_at = purchase.CreatedAt,
            items
        });
    }

    public class CreatePurchaseRequest
    {
        public string? StoreName { get; set; }
        public string? Notes { get; set; }
        public List<CreatePurchaseItemRequest> Items { get; set; } = new();
    }

    public class CreatePurchaseItemRequest
    {
        public int? ProductId { get; set; }
        public string? ProductName { get; set; }
        public string? Description { get; set; }
        public string? Barcode { get; set; }
        public decimal Quantity { get; set; }
        public decimal UnitPrice { get; set; }
        public string? Category { get; set; }
    }

    // POST: api/purchases
    [HttpPost]
    public async Task<ActionResult<object>> CreatePurchase([FromBody] CreatePurchaseRequest dto)
    {
        if (dto.Items == null || dto.Items.Count == 0)
        {
            return BadRequest(new { error = "A compra deve conter ao menos um item." });
        }

        await using var transaction = await _context.Database.BeginTransactionAsync();

        try
        {
            decimal totalAmount = 0;
            decimal totalItems = 0;

            var purchase = new Purchase
            {
                StoreName = string.IsNullOrWhiteSpace(dto.StoreName) ? "Supermercado" : dto.StoreName,
                Notes = dto.Notes,
                CreatedAt = DateTime.UtcNow
            };

            foreach (var itemDto in dto.Items)
            {
                var name = !string.IsNullOrWhiteSpace(itemDto.ProductName) ? itemDto.ProductName : itemDto.Description ?? "Produto";
                var itemTotal = Math.Round(itemDto.Quantity * itemDto.UnitPrice, 2);
                totalAmount += itemTotal;
                totalItems += itemDto.Quantity;

                Product? product = null;

                if (itemDto.ProductId.HasValue && itemDto.ProductId.Value > 0)
                {
                    product = await _context.Products.FindAsync(itemDto.ProductId.Value);
                }
                else if (!string.IsNullOrWhiteSpace(itemDto.Barcode))
                {
                    product = await _context.Products.FirstOrDefaultAsync(p => p.Barcode == itemDto.Barcode);
                }
                else if (!string.IsNullOrWhiteSpace(name))
                {
                    product = await _context.Products.FirstOrDefaultAsync(p => p.Name.ToLower() == name.ToLower());
                }

                if (product == null)
                {
                    Category? cat = null;
                    if (!string.IsNullOrWhiteSpace(itemDto.Category))
                    {
                        cat = await _context.Categories.FirstOrDefaultAsync(c => c.Name.ToLower() == itemDto.Category.ToLower());
                        if (cat == null)
                        {
                            cat = new Category { Name = itemDto.Category };
                            _context.Categories.Add(cat);
                            await _context.SaveChangesAsync();
                        }
                    }

                    product = new Product
                    {
                        Name = name,
                        Barcode = itemDto.Barcode,
                        CategoryId = cat?.Id,
                        Quantity = 0,
                        MinQuantity = 1,
                        UnitPrice = itemDto.UnitPrice,
                        PreviousUnitPrice = 0,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    };
                    _context.Products.Add(product);
                    await _context.SaveChangesAsync();
                }

                var previousStock = product.Quantity;
                var previousPrice = product.UnitPrice;

                var purchaseItem = new PurchaseItem
                {
                    ProductId = product.Id,
                    ProductName = name,
                    Barcode = itemDto.Barcode ?? product.Barcode,
                    Quantity = itemDto.Quantity,
                    UnitPrice = itemDto.UnitPrice,
                    PreviousUnitPrice = previousPrice,
                    TotalPrice = itemTotal,
                    CreatedAt = DateTime.UtcNow
                };
                purchaseItem.CalculatePriceVariation();
                purchase.Items.Add(purchaseItem);

                product.AdjustStock(itemDto.Quantity);
                product.UpdatePrice(itemDto.UnitPrice);

                var movement = new StockMovement
                {
                    ProductId = product.Id,
                    Type = "IN",
                    Quantity = itemDto.Quantity,
                    PreviousQuantity = previousStock,
                    NewQuantity = product.Quantity,
                    Reason = $"Compra em {purchase.StoreName}",
                    CreatedAt = DateTime.UtcNow
                };
                _context.StockMovements.Add(movement);
            }

            purchase.TotalAmount = totalAmount;
            purchase.TotalItems = totalItems;
            _context.Purchases.Add(purchase);

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            return Ok(new
            {
                id = purchase.Id,
                store_name = purchase.StoreName,
                total_amount = purchase.TotalAmount,
                total_items = purchase.TotalItems,
                created_at = purchase.CreatedAt
            });
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            _logger.LogError(ex, "Erro ao registrar a compra.");
            return StatusCode(500, new { error = "Erro ao registrar compra.", details = ex.Message });
        }
    }
}
