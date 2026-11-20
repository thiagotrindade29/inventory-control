using InventoryControl.Domain.Entities;
using InventoryControl.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace InventoryControl.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ProductsController : ControllerBase
{
    private readonly AppDbContext _context;

    public ProductsController(AppDbContext context)
    {
        _context = context;
    }

    // GET: api/products
    [HttpGet]
    public async Task<ActionResult<IEnumerable<object>>> GetProducts(
        [FromQuery] string? search,
        [FromQuery] int? categoryId,
        [FromQuery] string? lowStock)
    {
        var query = _context.Products.Include(p => p.Category).AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.ToLower().Trim();
            query = query.Where(p =>
                p.Name.ToLower().Contains(s) ||
                (p.Sku != null && p.Sku.ToLower().Contains(s)) ||
                (p.Barcode != null && p.Barcode.ToLower().Contains(s)) ||
                (p.Location != null && p.Location.ToLower().Contains(s)));
        }

        if (categoryId.HasValue)
        {
            query = query.Where(p => p.CategoryId == categoryId.Value);
        }

        if (lowStock == "true")
        {
            query = query.Where(p => p.Quantity <= p.MinQuantity);
        }

        var products = await query
            .OrderByDescending(p => p.Quantity <= p.MinQuantity)
            .ThenBy(p => p.Name)
            .Select(p => new
            {
                id = p.Id,
                sku = p.Sku,
                barcode = p.Barcode,
                name = p.Name,
                category_id = p.CategoryId,
                category_name = p.Category != null ? p.Category.Name : "Geral",
                category_color = p.Category != null ? p.Category.Color : "#3b82f6",
                location = p.Location,
                unit = p.Unit,
                quantity = p.Quantity,
                min_quantity = p.MinQuantity,
                unit_price = p.UnitPrice,
                previous_unit_price = p.PreviousUnitPrice,
                expiration_date = p.ExpirationDate,
                notes = p.Notes,
                created_at = p.CreatedAt,
                updated_at = p.UpdatedAt
            })
            .ToListAsync();

        return Ok(products);
    }

    // GET: api/products/{id}
    [HttpGet("{id:int}")]
    public async Task<ActionResult<object>> GetProduct(int id)
    {
        var p = await _context.Products.Include(prod => prod.Category).FirstOrDefaultAsync(prod => prod.Id == id);
        if (p == null)
            return NotFound(new { error = "Produto não encontrado." });

        return Ok(new
        {
            id = p.Id,
            sku = p.Sku,
            barcode = p.Barcode,
            name = p.Name,
            category_id = p.CategoryId,
            category_name = p.Category != null ? p.Category.Name : "Geral",
            category_color = p.Category != null ? p.Category.Color : "#3b82f6",
            location = p.Location,
            unit = p.Unit,
            quantity = p.Quantity,
            min_quantity = p.MinQuantity,
            unit_price = p.UnitPrice,
            previous_unit_price = p.PreviousUnitPrice,
            expiration_date = p.ExpirationDate,
            notes = p.Notes,
            created_at = p.CreatedAt,
            updated_at = p.UpdatedAt
        });
    }

    public class ProductInputDto
    {
        public string? Sku { get; set; }
        public string? Barcode { get; set; }
        public string Name { get; set; } = string.Empty;
        public int? Category_Id { get; set; }
        public int? CategoryId { get; set; }
        public string? Location { get; set; }
        public string? Unit { get; set; }
        public decimal Quantity { get; set; }
        public decimal Min_Quantity { get; set; }
        public decimal MinQuantity { get; set; }
        public decimal Unit_Price { get; set; }
        public decimal UnitPrice { get; set; }
        public decimal? Previous_Unit_Price { get; set; }
        public DateTime? Expiration_Date { get; set; }
        public DateTime? ExpirationDate { get; set; }
        public string? Notes { get; set; }
    }

    // POST: api/products
    [HttpPost]
    public async Task<ActionResult<object>> CreateProduct([FromBody] ProductInputDto input)
    {
        var product = new Product
        {
            Sku = input.Sku,
            Barcode = input.Barcode,
            Name = input.Name,
            CategoryId = input.Category_Id ?? input.CategoryId,
            Location = input.Location ?? "Despensa",
            Unit = input.Unit ?? "un",
            Quantity = input.Quantity,
            MinQuantity = input.Min_Quantity > 0 ? input.Min_Quantity : (input.MinQuantity > 0 ? input.MinQuantity : 1),
            UnitPrice = input.Unit_Price > 0 ? input.Unit_Price : input.UnitPrice,
            PreviousUnitPrice = input.Previous_Unit_Price ?? 0,
            ExpirationDate = input.Expiration_Date ?? input.ExpirationDate,
            Notes = input.Notes,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.Products.Add(product);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetProduct), new { id = product.Id }, product);
    }

    // PUT: api/products/{id}
    [HttpPut("{id:int}")]
    public async Task<IActionResult> UpdateProduct(int id, [FromBody] ProductInputDto input)
    {
        var product = await _context.Products.FindAsync(id);
        if (product == null)
            return NotFound(new { error = "Produto não encontrado." });

        product.Name = input.Name;
        product.Sku = input.Sku;
        product.Barcode = input.Barcode;
        product.CategoryId = input.Category_Id ?? input.CategoryId;
        product.Location = input.Location ?? product.Location;
        product.Quantity = input.Quantity;
        product.MinQuantity = input.Min_Quantity > 0 ? input.Min_Quantity : (input.MinQuantity > 0 ? input.MinQuantity : product.MinQuantity);
        product.Unit = input.Unit ?? product.Unit;
        product.ExpirationDate = input.Expiration_Date ?? input.ExpirationDate;
        product.Notes = input.Notes;
        
        var newPrice = input.Unit_Price > 0 ? input.Unit_Price : input.UnitPrice;
        if (newPrice != product.UnitPrice)
        {
            product.UpdatePrice(newPrice);
        }

        product.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return Ok(product);
    }

    // DELETE: api/products/{id}
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeleteProduct(int id)
    {
        var product = await _context.Products.FindAsync(id);
        if (product == null)
            return NotFound(new { error = "Produto não encontrado." });

        _context.Products.Remove(product);
        await _context.SaveChangesAsync();

        return NoContent();
    }
}
