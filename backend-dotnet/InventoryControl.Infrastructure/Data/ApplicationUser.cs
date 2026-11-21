using Microsoft.AspNetCore.Identity;

namespace InventoryControl.Infrastructure.Data;

public sealed class ApplicationUser : IdentityUser
{
    public string DisplayName { get; set; } = string.Empty;
    public int OrganizationId { get; set; }
    public Organization? Organization { get; set; }
}
