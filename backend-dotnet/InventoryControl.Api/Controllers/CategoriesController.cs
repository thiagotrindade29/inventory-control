using InventoryControl.Domain.Entities;
using InventoryControl.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace InventoryControl.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CategoriesController : ControllerBase
{
    private readonly AppDbContext _context;

    public CategoriesController(AppDbContext context)
    {
        _context = context;
    }

    // GET: api/categories
    [HttpGet]
    public async Task<ActionResult<IEnumerable<object>>> GetCategories()
    {
        var categories = await _context.Categories
            .OrderBy(c => c.Name)
            .Select(c => new
            {
                id = c.Id,
                name = c.Name,
                description = c.Description,
                color = c.Color,
                created_at = c.CreatedAt,
                product_count = c.Products.Count
            })
            .ToListAsync();

        return Ok(categories);
    }

    // POST: api/categories
    [HttpPost]
    public async Task<ActionResult<Category>> CreateCategory([FromBody] Category category)
    {
        if (string.IsNullOrWhiteSpace(category.Name))
            return BadRequest(new { error = "O nome da categoria é obrigatório." });

        category.Name = category.Name.Trim();
        category.CreatedAt = DateTime.UtcNow;
        _context.Categories.Add(category);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetCategories), new { id = category.Id }, category);
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> UpdateCategory(int id, [FromBody] Category input)
    {
        if (string.IsNullOrWhiteSpace(input.Name))
            return BadRequest(new { error = "O nome da categoria é obrigatório." });

        var category = await _context.Categories.FindAsync(id);
        if (category == null)
            return NotFound(new { error = "Categoria não encontrada." });

        category.Name = input.Name.Trim();
        category.Description = input.Description?.Trim();
        category.Color = string.IsNullOrWhiteSpace(input.Color) ? "#3b82f6" : input.Color;
        await _context.SaveChangesAsync();

        return Ok(new
        {
            id = category.Id,
            name = category.Name,
            description = category.Description,
            color = category.Color,
            created_at = category.CreatedAt
        });
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeleteCategory(int id)
    {
        var category = await _context.Categories.FindAsync(id);
        if (category == null)
            return NotFound(new { error = "Categoria não encontrada." });

        _context.Categories.Remove(category);
        await _context.SaveChangesAsync();
        return NoContent();
    }
}

