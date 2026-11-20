namespace InventoryControl.Domain.Entities;

public class Product
{
    public int Id { get; set; }
    public string? Sku { get; set; }
    public string? Barcode { get; set; }
    public string Name { get; set; } = string.Empty;
    public int? CategoryId { get; set; }
    public Category? Category { get; set; }
    public ICollection<ProductIdentifier> Identifiers { get; set; } = new List<ProductIdentifier>();
    public string Location { get; set; } = "Despensa";
    public string Unit { get; set; } = "un";
    public decimal Quantity { get; set; }
    public decimal MinQuantity { get; set; } = 1;
    public decimal UnitPrice { get; set; }
    public decimal PreviousUnitPrice { get; set; }
    public DateTime? ExpirationDate { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public bool IsLowStock() => Quantity <= MinQuantity;

    public void UpdatePrice(decimal newPrice)
    {
        PreviousUnitPrice = UnitPrice;
        UnitPrice = newPrice;
        UpdatedAt = DateTime.UtcNow;
    }

    public void AdjustStock(decimal quantityDelta)
    {
        Quantity += quantityDelta;
        UpdatedAt = DateTime.UtcNow;
    }
}
