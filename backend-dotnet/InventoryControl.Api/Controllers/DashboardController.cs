using InventoryControl.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace InventoryControl.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DashboardController : ControllerBase
{
    private readonly AppDbContext _context;

    public DashboardController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<object>> GetDashboard()
    {
        var totalProducts = await _context.Products.CountAsync();
        var totalUnits = await _context.Products.SumAsync(p => p.Quantity);
        var totalValue = await _context.Products.SumAsync(p => p.Quantity * p.UnitPrice);
        var lowStockCount = await _context.Products.CountAsync(p => p.Quantity <= p.MinQuantity);

        var next30Days = DateTime.UtcNow.Date.AddDays(30);
        var expiringSoonCount = await _context.Products.CountAsync(p =>
            p.ExpirationDate != null && p.ExpirationDate <= next30Days);

        var summary = new
        {
            total_products = totalProducts,
            total_units = totalUnits,
            total_value = totalValue,
            low_stock_count = lowStockCount,
            expiring_soon_count = expiringSoonCount
        };

        var lowStockProducts = await _context.Products
            .Include(p => p.Category)
            .Where(p => p.Quantity <= p.MinQuantity)
            .OrderBy(p => p.Quantity - p.MinQuantity)
            .ThenBy(p => p.Name)
            .Take(8)
            .Select(p => new
            {
                id = p.Id,
                sku = p.Sku,
                name = p.Name,
                location = p.Location,
                unit = p.Unit,
                quantity = p.Quantity,
                min_quantity = p.MinQuantity,
                unit_price = p.UnitPrice,
                category_name = p.Category != null ? p.Category.Name : "Geral",
                category_color = p.Category != null ? p.Category.Color : "#3b82f6"
            })
            .ToListAsync();

        var expiringProducts = await _context.Products
            .Include(p => p.Category)
            .Where(p => p.ExpirationDate != null && p.ExpirationDate <= next30Days)
            .OrderBy(p => p.ExpirationDate)
            .Take(8)
            .Select(p => new
            {
                id = p.Id,
                name = p.Name,
                location = p.Location,
                quantity = p.Quantity,
                unit = p.Unit,
                expiration_date = p.ExpirationDate,
                category_name = p.Category != null ? p.Category.Name : "Geral"
            })
            .ToListAsync();

        var recentMovements = await _context.StockMovements
            .Include(m => m.Product)
            .OrderByDescending(m => m.CreatedAt)
            .Take(8)
            .Select(m => new
            {
                id = m.Id,
                product_id = m.ProductId,
                product_name = m.Product != null ? m.Product.Name : "Produto",
                product_unit = m.Product != null ? m.Product.Unit : "un",
                type = m.Type,
                quantity = m.Quantity,
                previous_quantity = m.PreviousQuantity,
                new_quantity = m.NewQuantity,
                reason = m.Reason,
                created_at = m.CreatedAt
            })
            .ToListAsync();

        return Ok(new
        {
            summary,
            lowStockProducts,
            expiringProducts,
            recentMovements
        });
    }
}
