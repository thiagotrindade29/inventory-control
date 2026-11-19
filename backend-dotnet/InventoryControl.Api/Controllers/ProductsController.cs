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
    public async Task<ActionResult<IEnumerable<Product>>> GetProducts([FromQuery] string? search, [FromQuery] string? category)
    {
        var query = _context.Products.AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.ToLower();
            query = query.Where(p => p.Name.ToLower().Contains(s) || (p.Barcode != null && p.Barcode.Contains(s)));
        }

        if (!string.IsNullOrWhiteSpace(category))
        {
            query = query.Where(p => p.Category == category);
        }

        var products = await query.OrderBy(p => p.Name).ToListAsync();
        return Ok(products);
    }

    // GET: api/products/low-stock (Produtos com estoque baixo)
    [HttpGet("low-stock")]
    public async Task<ActionResult<IEnumerable<Product>>> GetLowStockProducts()
    {
        var lowStock = await _context.Products
            .Where(p => p.CurrentStock <= p.MinimumStock)
            .OrderBy(p => p.CurrentStock)
            .ToListAsync();

        return Ok(lowStock);
    }

    // GET: api/products/{id}
    [HttpGet("{id:int}")]
    public async Task<ActionResult<Product>> GetProduct(int id)
    {
        var product = await _context.Products.FindAsync(id);
        if (product == null)
            return NotFound(new { message = "Produto não encontrado." });

        return Ok(product);
    }

    // POST: api/products
    [HttpPost]
    public async Task<ActionResult<Product>> CreateProduct([FromBody] Product product)
    {
        product.CreatedAt = DateTime.UtcNow;
        product.UpdatedAt = DateTime.UtcNow;

        _context.Products.Add(product);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetProduct), new { id = product.Id }, product);
    }

    // PUT: api/products/{id}
    [HttpPut("{id:int}")]
    public async Task<IActionResult> UpdateProduct(int id, [FromBody] Product input)
    {
        var product = await _context.Products.FindAsync(id);
        if (product == null)
            return NotFound(new { message = "Produto não encontrado." });

        product.Name = input.Name;
        product.Barcode = input.Barcode;
        product.Category = input.Category;
        product.MinimumStock = input.MinimumStock;
        product.Unit = input.Unit;
        
        if (input.UnitPrice != product.UnitPrice)
        {
            product.UpdatePrice(input.UnitPrice);
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
            return NotFound(new { message = "Produto não encontrado." });

        _context.Products.Remove(product);
        await _context.SaveChangesAsync();

        return NoContent();
    }
}

