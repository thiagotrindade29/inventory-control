using System.Text.Json.Serialization;

namespace InventoryControl.Domain.Entities;

public class PurchaseItem
{
    public int Id { get; set; }
    [JsonIgnore] public int OrganizationId { get; set; }
    public int PurchaseId { get; set; }
    public Purchase? Purchase { get; set; }

    public int? ProductId { get; set; }
    public Product? Product { get; set; }

    public string ProductName { get; set; } = string.Empty;
    public string? Barcode { get; set; }
    public decimal Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal PreviousUnitPrice { get; set; }
    public decimal TotalPrice { get; set; }
    public decimal PriceVariationPct { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public void CalculatePriceVariation()
    {
        if (PreviousUnitPrice > 0)
        {
            PriceVariationPct = Math.Round(((UnitPrice - PreviousUnitPrice) / PreviousUnitPrice), 4);
        }
        else
        {
            PriceVariationPct = 0;
        }
    }
}
