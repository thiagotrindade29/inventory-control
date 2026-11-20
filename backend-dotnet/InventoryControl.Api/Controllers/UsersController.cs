using System.ComponentModel.DataAnnotations;
using InventoryControl.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace InventoryControl.Api.Controllers;

[ApiController]
[Route("api/users")]
[Authorize(Roles = "Admin")]
public sealed class UsersController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _users;

    public UsersController(UserManager<ApplicationUser> users) => _users = users;

    [HttpGet]
    public async Task<IActionResult> GetUsers() => Ok(await _users.Users
        .OrderBy(user => user.DisplayName)
        .Select(user => new { id = user.Id, email = user.Email, displayName = user.DisplayName, active = !user.LockoutEnd.HasValue || user.LockoutEnd <= DateTimeOffset.UtcNow })
        .ToListAsync());

    [HttpPost]
    public async Task<IActionResult> CreateUser([FromBody] CreateUserRequest request)
    {
        var user = new ApplicationUser
        {
            UserName = request.Email.Trim(),
            Email = request.Email.Trim(),
            DisplayName = request.DisplayName.Trim(),
            EmailConfirmed = true
        };
        var result = await _users.CreateAsync(user, request.Password);
        if (!result.Succeeded)
            return BadRequest(new { errors = result.Errors.Select(error => error.Description) });

        var roleResult = await _users.AddToRoleAsync(user, "User");
        if (!roleResult.Succeeded)
        {
            await _users.DeleteAsync(user);
            return StatusCode(500, new { error = "Não foi possível atribuir o perfil ao usuário." });
        }

        return Created($"/api/users/{user.Id}", new { id = user.Id, email = user.Email, displayName = user.DisplayName });
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteUser(string id)
    {
        if (User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value == id ||
            User.FindFirst(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub)?.Value == id)
            return BadRequest(new { error = "Não é possível remover a própria conta autenticada." });

        var user = await _users.FindByIdAsync(id);
        if (user is null) return NotFound(new { error = "Usuário não encontrado." });
        var result = await _users.DeleteAsync(user);
        return result.Succeeded ? NoContent() : BadRequest(new { errors = result.Errors.Select(error => error.Description) });
    }
}

public sealed class CreateUserRequest
{
    [Required, EmailAddress, MaxLength(256)] public string Email { get; init; } = string.Empty;
    [Required, MinLength(2), MaxLength(120)] public string DisplayName { get; init; } = string.Empty;
    [Required, MinLength(12), MaxLength(128)] public string Password { get; init; } = string.Empty;
}
