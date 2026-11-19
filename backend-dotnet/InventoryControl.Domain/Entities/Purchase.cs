namespace InventoryControl.Domain.Entities;

public class Purchase
{
    public int Id { get; set; }
    public string StoreName { get; set; } = "Supermercado";
    public decimal TotalAmount { get; set; }
    public decimal TotalItems { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public List<PurchaseItem> Items { get; set; } = new();
}
