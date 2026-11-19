namespace InventoryControl.Domain.Entities;

public enum MovementType
{
    IN,  // Entrada (compra / reposição)
    OUT  // Saída (consumo / perda)
}

public class StockMovement
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public Product? Product { get; set; }

    public MovementType Type { get; set; }
    public decimal Quantity { get; set; }
    public string? Reason { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

