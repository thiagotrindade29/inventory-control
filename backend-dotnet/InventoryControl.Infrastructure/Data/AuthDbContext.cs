using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace InventoryControl.Infrastructure.Data;

public sealed class AuthDbContext : IdentityDbContext<ApplicationUser>
{
    public AuthDbContext(DbContextOptions<AuthDbContext> options) : base(options)
    {
    }

    public DbSet<Organization> Organizations => Set<Organization>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        builder.HasDefaultSchema("auth");
        builder.Entity<Organization>(organization =>
        {
            organization.ToTable("organizations");
            organization.HasKey(x => x.Id);
            organization.Property(x => x.Name).HasMaxLength(120).IsRequired();
            organization.Property(x => x.CreatedAt).HasColumnName("created_at");
        });
        builder.Entity<ApplicationUser>(user =>
        {
            user.Property(x => x.DisplayName).HasMaxLength(120).IsRequired();
            user.Property(x => x.OrganizationId).HasColumnName("organization_id");
            user.HasOne(x => x.Organization)
                .WithMany()
                .HasForeignKey(x => x.OrganizationId)
                .OnDelete(DeleteBehavior.Restrict);
        });
    }
}
