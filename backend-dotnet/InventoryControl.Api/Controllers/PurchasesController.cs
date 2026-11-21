using InventoryControl.Application.DTOs;
using InventoryControl.Domain.Entities;
using InventoryControl.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

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
        public string? Store_Name { get; set; }
        public string? StoreName { get; set; }
        public string? Notes { get; set; }
        public List<CreatePurchaseItemRequest> Items { get; set; } = new();
    }

    public class CreatePurchaseItemRequest
    {
        public int? Product_Id { get; set; }
        public string? ProductName { get; set; }
        public string? Name { get; set; }
        public string? Description { get; set; }
        public string? Barcode { get; set; }
        public decimal Quantity { get; set; }
        public decimal Unit_Price { get; set; }
        public decimal UnitPrice { get; set; }
        public decimal? Previous_Unit_Price { get; set; }
        public int? Category_Id { get; set; }
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
                StoreName = string.IsNullOrWhiteSpace(dto.Store_Name ?? dto.StoreName)
                    ? "Supermercado"
                    : NormalizeSpaces((dto.Store_Name ?? dto.StoreName)!),
                Notes = dto.Notes,
                CreatedAt = DateTime.UtcNow
            };
            var marketKey = NormalizeProductKey(purchase.StoreName);
            var knownProducts = await _context.Products.ToListAsync();

            foreach (var itemDto in dto.Items)
            {
                var name = !string.IsNullOrWhiteSpace(itemDto.ProductName)
                    ? itemDto.ProductName
                    : !string.IsNullOrWhiteSpace(itemDto.Name)
                        ? itemDto.Name
                        : itemDto.Description ?? "Produto";
                name = NormalizeSpaces(name);
                var barcode = itemDto.Barcode?.Trim();
                var unitPrice = itemDto.Unit_Price != 0 ? itemDto.Unit_Price : itemDto.UnitPrice;
                var itemTotal = Math.Round(itemDto.Quantity * unitPrice, 2);
                totalAmount += itemTotal;
                totalItems += itemDto.Quantity;

                Product? product = null;

                if (itemDto.Product_Id.HasValue && itemDto.Product_Id.Value > 0)
                {
                    product = await _context.Products.FirstOrDefaultAsync(candidate => candidate.Id == itemDto.Product_Id.Value);
                }
                else if (!string.IsNullOrWhiteSpace(barcode))
                {
                    var marketIdentifier = await _context.ProductIdentifiers
                        .FirstOrDefaultAsync(identifier => identifier.MarketName == marketKey && identifier.Code == barcode);
                    if (marketIdentifier is not null)
                        product = knownProducts.FirstOrDefault(candidate => candidate.Id == marketIdentifier.ProductId);

                    // A store-specific code seen in a different store must not be treated as a global barcode.
                    var codeHasStoreScope = await _context.ProductIdentifiers.AnyAsync(identifier => identifier.Code == barcode);
                    if (product is null && !codeHasStoreScope)
                    {
                        product = await _context.Products.FirstOrDefaultAsync(p => p.Barcode == barcode || p.Sku == barcode);
                    }
                }

                if (product is null && !string.IsNullOrWhiteSpace(name))
                {
                    var nameKey = NormalizeProductKey(name);
                    var nameMatches = knownProducts
                        .Where(candidate => NormalizeProductKey(candidate.Name) == nameKey)
                        .ToList();
                    if (nameMatches.Count > 1)
                    {
                        return Conflict(new
                        {
                            error = $"Já existem vários produtos com o nome '{name}'. Selecione o produto correto no catálogo antes de registrar a compra."
                        });
                    }
                    product = nameMatches.SingleOrDefault();
                }

                if (product == null)
                {
                    Category? cat = itemDto.Category_Id.HasValue
                        ? await _context.Categories.FirstOrDefaultAsync(candidate => candidate.Id == itemDto.Category_Id.Value)
                        : null;
                    var categoryName = itemDto.Category;
                    if (cat == null && !string.IsNullOrWhiteSpace(categoryName))
                    {
                        cat = await _context.Categories.FirstOrDefaultAsync(c => c.Name.ToLower() == categoryName.ToLower());
                        if (cat == null)
                        {
                            cat = new Category { Name = categoryName.Trim() };
                            _context.Categories.Add(cat);
                            await _context.SaveChangesAsync();
                        }
                    }

                    product = new Product
                    {
                        Name = name,
                        Barcode = null,
                        CategoryId = cat?.Id,
                        Quantity = 0,
                        MinQuantity = 1,
                        UnitPrice = unitPrice,
                        PreviousUnitPrice = 0,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    };
                    _context.Products.Add(product);
                    await _context.SaveChangesAsync();
                    product.Sku = $"PRD-{product.Id:D6}";
                    await _context.SaveChangesAsync();
                    knownProducts.Add(product);
                }

                if (string.IsNullOrWhiteSpace(product.Sku))
                    product.Sku = $"PRD-{product.Id:D6}";

                if (!string.IsNullOrWhiteSpace(barcode))
                {
                    var existingIdentifier = await _context.ProductIdentifiers
                        .FirstOrDefaultAsync(identifier => identifier.MarketName == marketKey && identifier.Code == barcode);
                    if (existingIdentifier is not null && existingIdentifier.ProductId != product.Id)
                    {
                        return Conflict(new { error = "Esse código já está associado a outro produto neste mercado." });
                    }
                    if (existingIdentifier is null)
                    {
                        _context.ProductIdentifiers.Add(new ProductIdentifier
                        {
                            ProductId = product.Id,
                            MarketName = marketKey,
                            Code = barcode,
                            CreatedAt = DateTime.UtcNow
                        });
                    }
                }

                var previousStock = product.Quantity;
                var previousPrice = product.UnitPrice;

                var purchaseItem = new PurchaseItem
                {
                    ProductId = product.Id,
                    ProductName = name,
                    Barcode = barcode ?? product.Barcode,
                    Quantity = itemDto.Quantity,
                    UnitPrice = unitPrice,
                    PreviousUnitPrice = itemDto.Previous_Unit_Price ?? previousPrice,
                    TotalPrice = itemTotal,
                    CreatedAt = DateTime.UtcNow
                };
                purchaseItem.CalculatePriceVariation();
                purchase.Items.Add(purchaseItem);

                product.AdjustStock(itemDto.Quantity);
                product.UpdatePrice(unitPrice);

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

    private static string NormalizeSpaces(string value) =>
        Regex.Replace(value.Trim(), @"\s+", " ");

    private static string NormalizeProductKey(string value)
    {
        var decomposed = NormalizeSpaces(value).Normalize(NormalizationForm.FormD);
        var withoutDiacritics = new string(decomposed
            .Where(character => CharUnicodeInfo.GetUnicodeCategory(character) != UnicodeCategory.NonSpacingMark)
            .ToArray());
        return NormalizeSpaces(withoutDiacritics).ToUpperInvariant();
    }
}
