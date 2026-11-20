namespace InventoryControl.Domain.Entities;

/// <summary>A barcode or store-specific code mapped to the canonical product.</summary>
public class ProductIdentifier
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public string MarketName { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
