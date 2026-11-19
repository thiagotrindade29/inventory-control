namespace InventoryControl.Domain.Entities;

public class StockMovement
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public Product? Product { get; set; }

    public string Type { get; set; } = "IN"; // 'IN', 'OUT', 'ADJUST'
    public decimal Quantity { get; set; }
    public decimal PreviousQuantity { get; set; }
    public decimal NewQuantity { get; set; }
    public string? Reason { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
