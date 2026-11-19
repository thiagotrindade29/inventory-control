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
    public async Task<ActionResult<IEnumerable<Category>>> GetCategories()
    {
        var categories = await _context.Categories
            .OrderBy(c => c.Name)
            .ToListAsync();

        return Ok(categories);
    }

    // POST: api/categories
    [HttpPost]
    public async Task<ActionResult<Category>> CreateCategory([FromBody] Category category)
    {
        category.CreatedAt = DateTime.UtcNow;
        _context.Categories.Add(category);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetCategories), new { id = category.Id }, category);
    }
}

