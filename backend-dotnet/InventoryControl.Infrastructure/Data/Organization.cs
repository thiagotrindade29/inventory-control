namespace InventoryControl.Infrastructure.Data;

public sealed class Organization
{
    public int Id { get; set; }
    public string Name { get; set; } = "Minha organização";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
