using System.ComponentModel.DataAnnotations;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using InventoryControl.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace InventoryControl.Api.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController : ControllerBase
{
    private const string AdminRole = "Admin";
    private readonly AuthDbContext _db;
    private readonly UserManager<ApplicationUser> _users;
    private readonly RoleManager<IdentityRole> _roles;
    private readonly SignInManager<ApplicationUser> _signIn;
    private readonly IConfiguration _configuration;

    public AuthController(
        AuthDbContext db,
        UserManager<ApplicationUser> users,
        RoleManager<IdentityRole> roles,
        SignInManager<ApplicationUser> signIn,
        IConfiguration configuration)
    {
        _db = db;
        _users = users;
        _roles = roles;
        _signIn = signIn;
        _configuration = configuration;
    }

    [AllowAnonymous]
    [HttpGet("status")]
    public async Task<IActionResult> GetStatus() => Ok(new
    {
        setupRequired = !await _users.Users.AnyAsync(),
        authenticationEnabled = true
    });

    [AllowAnonymous]
    [HttpPost("setup")]
    public async Task<IActionResult> Setup([FromBody] SetupRequest request)
    {
        var bootstrapKey = _configuration["Auth:BootstrapKey"];
        if (string.IsNullOrWhiteSpace(bootstrapKey) || !FixedTimeEquals(request.BootstrapKey, bootstrapKey))
            return Unauthorized(new { error = "Chave de configuração inválida." });

        await using var transaction = await _db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
        if (await _users.Users.AnyAsync())
            return Conflict(new { error = "A configuração inicial já foi concluída." });

        var organization = await _db.Organizations.OrderBy(x => x.Id).FirstOrDefaultAsync();
        if (organization is null)
        {
            organization = new Organization { Name = "Minha organização" };
            _db.Organizations.Add(organization);
            await _db.SaveChangesAsync();
        }

        if (!await _roles.RoleExistsAsync(AdminRole))
        {
            var roleResult = await _roles.CreateAsync(new IdentityRole(AdminRole));
            if (!roleResult.Succeeded) return StatusCode(500, new { error = "Não foi possível preparar o perfil administrador." });
        }
        if (!await _roles.RoleExistsAsync("User"))
        {
            var roleResult = await _roles.CreateAsync(new IdentityRole("User"));
            if (!roleResult.Succeeded) return StatusCode(500, new { error = "Não foi possível preparar os perfis de usuário." });
        }

        var user = new ApplicationUser
        {
            UserName = request.Email.Trim(),
            Email = request.Email.Trim(),
            DisplayName = request.DisplayName.Trim(),
            OrganizationId = organization.Id,
            EmailConfirmed = true
        };
        var result = await _users.CreateAsync(user, request.Password);
        if (!result.Succeeded)
            return BadRequest(new { errors = result.Errors.Select(x => x.Description) });

        var assignment = await _users.AddToRoleAsync(user, AdminRole);
        if (!assignment.Succeeded)
            return StatusCode(500, new { error = "Não foi possível ativar o perfil administrador." });
        await transaction.CommitAsync();
        return Ok(await CreateTokenResponse(user));
    }

    [AllowAnonymous]
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        var user = await _users.FindByEmailAsync(request.Email.Trim());
        if (user is null)
            return Unauthorized(new { error = "E-mail ou senha inválidos." });

        var result = await _signIn.CheckPasswordSignInAsync(user, request.Password, lockoutOnFailure: true);
        if (!result.Succeeded)
            return Unauthorized(new { error = "E-mail ou senha inválidos. Confira os dados ou tente novamente mais tarde." });

        return Ok(await CreateTokenResponse(user));
    }

    private async Task<object> CreateTokenResponse(ApplicationUser user)
    {
        var key = _configuration["Jwt:Key"]!;
        var issuer = _configuration["Jwt:Issuer"]!;
        var audience = _configuration["Jwt:Audience"]!;
        var expiresAt = DateTime.UtcNow.AddMinutes(20);
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id),
            new(JwtRegisteredClaimNames.Email, user.Email ?? string.Empty),
            new(JwtRegisteredClaimNames.UniqueName, user.DisplayName),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new("organization_id", user.OrganizationId.ToString(System.Globalization.CultureInfo.InvariantCulture)),
            new("sst", user.SecurityStamp ?? string.Empty)
        };
        claims.AddRange((await _users.GetRolesAsync(user)).Select(role => new Claim("role", role)));

        var credentials = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)), SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(issuer, audience, claims, DateTime.UtcNow, expiresAt, credentials);

        return new
        {
            accessToken = new JwtSecurityTokenHandler().WriteToken(token),
            expiresAt,
            user = new { id = user.Id, email = user.Email, displayName = user.DisplayName, roles = await _users.GetRolesAsync(user) }
        };
    }

    private static bool FixedTimeEquals(string supplied, string expected)
    {
        var suppliedBytes = Encoding.UTF8.GetBytes(supplied ?? string.Empty);
        var expectedBytes = Encoding.UTF8.GetBytes(expected);
        return suppliedBytes.Length == expectedBytes.Length &&
               CryptographicOperations.FixedTimeEquals(suppliedBytes, expectedBytes);
    }
}

public sealed class SetupRequest
{
    [Required, MinLength(32), MaxLength(128)] public string BootstrapKey { get; init; } = string.Empty;
    [Required, EmailAddress, MaxLength(256)] public string Email { get; init; } = string.Empty;
    [Required, MinLength(2), MaxLength(120)] public string DisplayName { get; init; } = string.Empty;
    [Required, MinLength(12), MaxLength(128)] public string Password { get; init; } = string.Empty;
}

public sealed class LoginRequest
{
    [Required, EmailAddress, MaxLength(256)] public string Email { get; init; } = string.Empty;
    [Required, MaxLength(128)] public string Password { get; init; } = string.Empty;
}
