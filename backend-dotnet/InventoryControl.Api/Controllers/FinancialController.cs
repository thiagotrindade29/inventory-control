using InventoryControl.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace InventoryControl.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class FinancialController : ControllerBase
{
    private readonly AppDbContext _context;

    public FinancialController(AppDbContext context)
    {
        _context = context;
    }

    // GET: api/financial
    [HttpGet]
    public async Task<ActionResult<object>> GetFinancial()
    {
        // 1. Overview geral
        var totalSpent = await _context.Purchases.SumAsync(p => p.TotalAmount);
        var totalPurchases = await _context.Purchases.CountAsync();
        var avgPurchase = totalPurchases > 0 ? await _context.Purchases.AverageAsync(p => p.TotalAmount) : 0;
        var totalItemsBought = await _context.Purchases.SumAsync(p => p.TotalItems);

        // 2. Estatísticas de inflação
        var itemsWithPreviousPrice = await _context.PurchaseItems
            .Where(pi => pi.PreviousUnitPrice > 0)
            .ToListAsync();

        var itemsUp = itemsWithPreviousPrice.Count(pi => pi.PriceVariationPct > 0.001m);
        var itemsDown = itemsWithPreviousPrice.Count(pi => pi.PriceVariationPct < -0.001m);
        var itemsSame = itemsWithPreviousPrice.Count(pi => Math.Abs(pi.PriceVariationPct) <= 0.001m);
        var avgVariation = itemsWithPreviousPrice.Any()
            ? Math.Round(itemsWithPreviousPrice.Average(pi => pi.PriceVariationPct), 4)
            : 0;

        var overview = new
        {
            total_spent = totalSpent,
            total_purchases = totalPurchases,
            avg_purchase_amount = Math.Round(avgPurchase, 2),
            total_items_bought = totalItemsBought,
            items_up = itemsUp,
            items_down = itemsDown,
            items_same = itemsSame,
            avg_variation_pct = avgVariation
        };

        // 3. Gastos por categoria
        var spendingByCategory = await _context.PurchaseItems
            .Include(pi => pi.Product)
                .ThenInclude(p => p!.Category)
            .GroupBy(pi => (pi.Product != null && pi.Product.Category != null) ? pi.Product.Category.Name : "Outros")
            .Select(g => new
            {
                category_name = g.Key,
                category_color = "#3b82f6",
                total_spent = g.Sum(x => x.TotalPrice),
                items_count = g.Count()
            })
            .OrderByDescending(x => x.total_spent)
            .ToListAsync();

        // 4. Maiores altas (Top Inflação)
        var topInflation = await _context.PurchaseItems
            .Include(pi => pi.Product)
            .Where(pi => pi.PreviousUnitPrice > 0 && pi.PriceVariationPct > 0)
            .OrderByDescending(pi => pi.PriceVariationPct)
            .Take(8)
            .Select(pi => new
            {
                product_name = pi.ProductName,
                barcode = pi.Barcode,
                unit_price = pi.UnitPrice,
                previous_unit_price = pi.PreviousUnitPrice,
                diff_reais = Math.Round(pi.UnitPrice - pi.PreviousUnitPrice, 2),
                price_variation_pct = pi.PriceVariationPct,
                created_at = pi.CreatedAt,
                product_id = pi.ProductId
            })
            .ToListAsync();

        // 5. Melhores economias (Top Deflação)
        var topDeflation = await _context.PurchaseItems
            .Include(pi => pi.Product)
            .Where(pi => pi.PreviousUnitPrice > 0 && pi.PriceVariationPct <= 0)
            .OrderBy(pi => pi.PriceVariationPct)
            .Take(8)
            .Select(pi => new
            {
                product_name = pi.ProductName,
                barcode = pi.Barcode,
                unit_price = pi.UnitPrice,
                previous_unit_price = pi.PreviousUnitPrice,
                saved_reais = Math.Round(pi.PreviousUnitPrice - pi.UnitPrice, 2),
                price_variation_pct = pi.PriceVariationPct,
                created_at = pi.CreatedAt,
                product_id = pi.ProductId
            })
            .ToListAsync();

        // 6. Compras recentes
        var purchases = await _context.Purchases
            .OrderByDescending(p => p.CreatedAt)
            .Take(10)
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

        // 7. Todos os itens de compras detalhados
        var items = await _context.PurchaseItems
            .Include(pi => pi.Product)
                .ThenInclude(p => p!.Category)
            .OrderByDescending(pi => pi.CreatedAt)
            .ThenByDescending(pi => pi.Id)
            .Take(150)
            .Select(pi => new
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
                category_name = (pi.Product != null && pi.Product.Category != null) ? pi.Product.Category.Name : "Geral",
                category_color = (pi.Product != null && pi.Product.Category != null) ? pi.Product.Category.Color : "#3b82f6",
                location = pi.Product != null ? pi.Product.Location : "Despensa"
            })
            .ToListAsync();

        return Ok(new
        {
            overview,
            spendingByCategory,
            topInflation,
            topDeflation,
            purchases,
            items
        });
    }
}
