namespace InventoryControl.Domain.Entities;

public class Product
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Barcode { get; set; }
    public string Category { get; set; } = "Geral";
    public decimal CurrentStock { get; set; }
    public decimal MinimumStock { get; set; }
    public string Unit { get; set; } = "UN";
    public decimal UnitPrice { get; set; }
    public decimal? PreviousUnitPrice { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Métodos de domínio (Regras de negócio encapsuladas)
    public bool IsLowStock() => CurrentStock <= MinimumStock;

    public void UpdatePrice(decimal newPrice)
    {
        PreviousUnitPrice = UnitPrice;
        UnitPrice = newPrice;
        UpdatedAt = DateTime.UtcNow;
    }

    public void AdjustStock(decimal quantityDelta)
    {
        CurrentStock += quantityDelta;
        UpdatedAt = DateTime.UtcNow;
    }
}

