using InventoryControl.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace InventoryControl.Infrastructure.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<Purchase> Purchases => Set<Purchase>();
    public DbSet<PurchaseItem> PurchaseItems => Set<PurchaseItem>();
    public DbSet<StockMovement> StockMovements => Set<StockMovement>();
    public DbSet<ProductIdentifier> ProductIdentifiers => Set<ProductIdentifier>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Category>(entity =>
        {
            entity.ToTable("categories");
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.Name).HasColumnName("name").IsRequired().HasMaxLength(80);
            entity.Property(e => e.Description).HasColumnName("description").HasMaxLength(255);
            entity.Property(e => e.Color).HasColumnName("color").HasMaxLength(20);
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
        });

        modelBuilder.Entity<Product>(entity =>
        {
            entity.ToTable("products");
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.Sku).HasColumnName("sku").HasMaxLength(60);
            entity.Property(e => e.Barcode).HasColumnName("barcode").HasMaxLength(60);
            entity.Property(e => e.Name).HasColumnName("name").IsRequired().HasMaxLength(150);
            entity.Property(e => e.CategoryId).HasColumnName("category_id");
            entity.Property(e => e.Location).HasColumnName("location").HasMaxLength(80);
            entity.Property(e => e.Unit).HasColumnName("unit").HasMaxLength(20);
            entity.Property(e => e.Quantity).HasColumnName("quantity").HasPrecision(10, 2);
            entity.Property(e => e.MinQuantity).HasColumnName("min_quantity").HasPrecision(10, 2);
            entity.Property(e => e.UnitPrice).HasColumnName("unit_price").HasPrecision(10, 2);
            entity.Property(e => e.PreviousUnitPrice).HasColumnName("previous_unit_price").HasPrecision(10, 2);
            entity.Property(e => e.ExpirationDate).HasColumnName("expiration_date");
            entity.Property(e => e.Notes).HasColumnName("notes");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");

            entity.HasOne(e => e.Category)
                  .WithMany(c => c.Products)
                  .HasForeignKey(e => e.CategoryId)
                  .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Purchase>(entity =>
        {
            entity.ToTable("purchases");
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.StoreName).HasColumnName("store_name").IsRequired().HasMaxLength(120);
            entity.Property(e => e.TotalAmount).HasColumnName("total_amount").HasPrecision(10, 2);
            entity.Property(e => e.TotalItems).HasColumnName("total_items").HasPrecision(10, 2);
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
            entity.Property(e => e.ProductName).HasColumnName("product_name").IsRequired().HasMaxLength(150);
            entity.Property(e => e.Barcode).HasColumnName("barcode").HasMaxLength(60);
            entity.Property(e => e.Quantity).HasColumnName("quantity").HasPrecision(10, 2);
            entity.Property(e => e.UnitPrice).HasColumnName("unit_price").HasPrecision(10, 2);
            entity.Property(e => e.PreviousUnitPrice).HasColumnName("previous_unit_price").HasPrecision(10, 2);
            entity.Property(e => e.TotalPrice).HasColumnName("total_price").HasPrecision(10, 2);
            entity.Property(e => e.PriceVariationPct).HasColumnName("price_variation_pct").HasPrecision(6, 4);
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
        });

        modelBuilder.Entity<StockMovement>(entity =>
        {
            entity.ToTable("stock_movements");
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.ProductId).HasColumnName("product_id");
            entity.Property(e => e.Type).HasColumnName("type").HasMaxLength(10);
            entity.Property(e => e.Quantity).HasColumnName("quantity").HasPrecision(10, 2);
            entity.Property(e => e.PreviousQuantity).HasColumnName("previous_quantity").HasPrecision(10, 2);
            entity.Property(e => e.NewQuantity).HasColumnName("new_quantity").HasPrecision(10, 2);
            entity.Property(e => e.Reason).HasColumnName("reason").HasMaxLength(160);
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
        });

        modelBuilder.Entity<ProductIdentifier>(entity =>
        {
            entity.ToTable("product_identifiers");
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.ProductId).HasColumnName("product_id");
            entity.Property(e => e.MarketName).HasColumnName("market_name").IsRequired().HasMaxLength(120);
            entity.Property(e => e.Code).HasColumnName("code").IsRequired().HasMaxLength(80);
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.HasIndex(e => new { e.MarketName, e.Code }).IsUnique();
            entity.HasOne<Product>().WithMany(p => p.Identifiers)
                .HasForeignKey(e => e.ProductId).OnDelete(DeleteBehavior.Cascade);
        });
    }
}
