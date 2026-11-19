namespace InventoryControl.Domain.Entities;

public class Purchase
{
    public int Id { get; set; }
    public DateTime PurchaseDate { get; set; } = DateTime.UtcNow;
    public string StoreName { get; set; } = string.Empty;
    public decimal TotalAmount { get; set; }
    public string? NfeKey { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Relacionamento 1 para N com itens da compra
    public List<PurchaseItem> Items { get; set; } = new();
}

