using InventoryControl.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;

namespace InventoryControl.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class HealthController : ControllerBase
{
    private readonly AppDbContext _context;

    public HealthController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetHealth()
    {
        try
        {
            // Testa se a conexão com o PostgreSQL está ativa e respondendo
            bool canConnect = await _context.Database.CanConnectAsync();

            if (canConnect)
            {
                return Ok(new
                {
                    status = "ok",
                    database = "online",
                    engine = "ASP.NET Core .NET 9 + PostgreSQL",
                    timestamp = DateTime.UtcNow
                });
            }

            return StatusCode(503, new
            {
                status = "error",
                database = "offline",
                message = "Não foi possível conectar ao PostgreSQL."
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                status = "error",
                database = "offline",
                details = ex.Message
            });
        }
    }
}

