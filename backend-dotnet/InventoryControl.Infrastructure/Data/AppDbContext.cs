using InventoryControl.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace InventoryControl.Infrastructure.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<Product> Products => Set<Product>();
    public DbSet<Purchase> Purchases => Set<Purchase>();
    public DbSet<PurchaseItem> PurchaseItems => Set<PurchaseItem>();
    public DbSet<StockMovement> StockMovements => Set<StockMovement>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Mapeamento explícito das tabelas (Snake Case para seguir padrão do PostgreSQL)
        modelBuilder.Entity<Product>(entity =>
        {
            entity.ToTable("products");
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.Name).HasColumnName("name").IsRequired().HasMaxLength(255);
            entity.Property(e => e.Barcode).HasColumnName("barcode").HasMaxLength(100);
            entity.Property(e => e.Category).HasColumnName("category").HasMaxLength(100);
            entity.Property(e => e.CurrentStock).HasColumnName("current_stock").HasPrecision(12, 3);
            entity.Property(e => e.MinimumStock).HasColumnName("minimum_stock").HasPrecision(12, 3);
            entity.Property(e => e.Unit).HasColumnName("unit").HasMaxLength(20);
            entity.Property(e => e.UnitPrice).HasColumnName("unit_price").HasPrecision(10, 2);
            entity.Property(e => e.PreviousUnitPrice).HasColumnName("previous_unit_price").HasPrecision(10, 2);
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
        });

        modelBuilder.Entity<Purchase>(entity =>
        {
            entity.ToTable("purchases");
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.PurchaseDate).HasColumnName("purchase_date");
            entity.Property(e => e.StoreName).HasColumnName("store_name").IsRequired().HasMaxLength(255);
            entity.Property(e => e.TotalAmount).HasColumnName("total_amount").HasPrecision(10, 2);
            entity.Property(e => e.NfeKey).HasColumnName("nfe_key").HasMaxLength(100);
            entity.Property(e => e.Notes).HasColumnName("notes");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");

            entity.HasMany(e => e.Items)
                  .WithOne(i => i.Purchase)
                  .HasForeignKey(i => i.PurchaseId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<PurchaseItem>(entity =>
        {
            entity.ToTable("purchase_items");
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.PurchaseId).HasColumnName("purchase_id");
            entity.Property(e => e.ProductId).HasColumnName("product_id");
            entity.Property(e => e.Description).HasColumnName("description").IsRequired().HasMaxLength(255);
            entity.Property(e => e.Barcode).HasColumnName("barcode").HasMaxLength(100);
            entity.Property(e => e.Quantity).HasColumnName("quantity").HasPrecision(12, 3);
            entity.Property(e => e.UnitPrice).HasColumnName("unit_price").HasPrecision(10, 2);
            entity.Property(e => e.TotalPrice).HasColumnName("total_price").HasPrecision(10, 2);
            entity.Property(e => e.PreviousUnitPrice).HasColumnName("previous_unit_price").HasPrecision(10, 2);
            entity.Property(e => e.PriceVariationPercent).HasColumnName("price_variation_percent").HasPrecision(6, 2);
        });

        modelBuilder.Entity<StockMovement>(entity =>
        {
            entity.ToTable("stock_movements");
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.ProductId).HasColumnName("product_id");
            entity.Property(e => e.Type).HasColumnName("type").HasConversion<string>();
            entity.Property(e => e.Quantity).HasColumnName("quantity").HasPrecision(12, 3);
            entity.Property(e => e.Reason).HasColumnName("reason");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
        });
    }
}

