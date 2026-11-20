using InventoryControl.Domain.Entities;
using InventoryControl.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace InventoryControl.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class MovementsController : ControllerBase
{
    private readonly AppDbContext _context;

    public MovementsController(AppDbContext context)
    {
        _context = context;
    }

    // GET: api/movements?productId=&limit=50
    [HttpGet]
    public async Task<ActionResult<IEnumerable<object>>> GetMovements(
        [FromQuery] int? productId,
        [FromQuery] int limit = 50)
    {
        var query = _context.StockMovements
            .Include(m => m.Product)
            .AsQueryable();

        if (productId.HasValue)
        {
            query = query.Where(m => m.ProductId == productId.Value);
        }

        var movements = await query
            .OrderByDescending(m => m.CreatedAt)
            .Take(Math.Min(limit, 200))
            .Select(m => new
            {
                id = m.Id,
                product_id = m.ProductId,
                product_name = m.Product != null ? m.Product.Name : "Produto",
                product_sku = m.Product != null ? m.Product.Sku : null,
                product_unit = m.Product != null ? m.Product.Unit : "un",
                type = m.Type,
                quantity = m.Quantity,
                previous_quantity = m.PreviousQuantity,
                new_quantity = m.NewQuantity,
                reason = m.Reason,
                created_at = m.CreatedAt
            })
            .ToListAsync();

        return Ok(movements);
    }

    public class CreateMovementInput
    {
        public int Product_Id { get; set; }
        public string Type { get; set; } = "IN"; // 'IN' ou 'OUT'
        public decimal Quantity { get; set; }
        public string? Reason { get; set; }
    }

    // POST: api/movements
    [HttpPost]
    public async Task<IActionResult> CreateMovement([FromBody] CreateMovementInput input)
    {
        if (input.Quantity <= 0)
            return BadRequest(new { error = "A quantidade deve ser maior que zero." });
        if (input.Type is not ("IN" or "OUT"))
            return BadRequest(new { error = "O tipo deve ser IN ou OUT." });

        var product = await _context.Products.FindAsync(input.Product_Id);
        if (product == null)
            return NotFound(new { error = "Produto não encontrado." });

        if (input.Type == "OUT" && input.Quantity > product.Quantity)
            return BadRequest(new { error = "Saldo insuficiente para essa saída." });

        var previousStock = product.Quantity;
        decimal delta = input.Type.ToUpper() == "OUT" ? -input.Quantity : input.Quantity;
        product.AdjustStock(delta);

        var movement = new StockMovement
        {
            ProductId = product.Id,
            Type = input.Type.ToUpper(),
            Quantity = input.Quantity,
            PreviousQuantity = previousStock,
            NewQuantity = product.Quantity,
            Reason = input.Reason ?? (input.Type == "OUT" ? "Saída de estoque" : "Entrada de estoque"),
            CreatedAt = DateTime.UtcNow
        };

        _context.StockMovements.Add(movement);
        await _context.SaveChangesAsync();

        return Ok(new
        {
            id = movement.Id,
            product_id = movement.ProductId,
            product_name = product.Name,
            product_unit = product.Unit,
            type = movement.Type,
            quantity = movement.Quantity,
            previous_quantity = movement.PreviousQuantity,
            new_quantity = movement.NewQuantity,
            reason = movement.Reason,
            created_at = movement.CreatedAt
        });
    }
}
