using System.Security.Claims;
using InventoryControl.Infrastructure.Data;

namespace InventoryControl.Api;

public sealed class CurrentOrganization(IHttpContextAccessor httpContextAccessor) : ICurrentOrganization
{
    public int? OrganizationId
    {
        get
        {
            var value = httpContextAccessor.HttpContext?.User.FindFirstValue("organization_id");
            return int.TryParse(value, out var organizationId) && organizationId > 0
                ? organizationId
                : null;
        }
    }
}
