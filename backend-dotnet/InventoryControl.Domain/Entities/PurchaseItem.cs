namespace InventoryControl.Domain.Entities;

public class PurchaseItem
{
    public int Id { get; set; }
    public int PurchaseId { get; set; }
    public Purchase? Purchase { get; set; }

    public int? ProductId { get; set; }
    public Product? Product { get; set; }

    public string Description { get; set; } = string.Empty;
    public string? Barcode { get; set; }
    public decimal Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal TotalPrice { get; set; }
    public decimal? PreviousUnitPrice { get; set; }
    public decimal? PriceVariationPercent { get; set; }

    // Método que calcula automaticamente a variação de preço %
    public void CalculatePriceVariation()
    {
        if (PreviousUnitPrice.HasValue && PreviousUnitPrice.Value > 0)
        {
            PriceVariationPercent = Math.Round(((UnitPrice - PreviousUnitPrice.Value) / PreviousUnitPrice.Value) * 100, 2);
        }
        else
        {
            PriceVariationPercent = 0;
        }
    }
}

