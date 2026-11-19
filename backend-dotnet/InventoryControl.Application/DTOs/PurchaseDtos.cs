namespace InventoryControl.Application.DTOs;

public class CreatePurchaseItemDto
{
    public int? ProductId { get; set; }
    public string Description { get; set; } = string.Empty;
    public string? Barcode { get; set; }
    public decimal Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public string? Category { get; set; }
}

public class CreatePurchaseDto
{
    public string StoreName { get; set; } = string.Empty;
    public DateTime? PurchaseDate { get; set; }
    public string? NfeKey { get; set; }
    public string? Notes { get; set; }
    public List<CreatePurchaseItemDto> Items { get; set; } = new();
}

public class FinancialSummaryDto
{
    public decimal TotalSpentCurrentMonth { get; set; }
    public int TotalPurchasesCurrentMonth { get; set; }
    public decimal AveragePriceVariationPercent { get; set; }
    public List<CategoryExpenseDto> ExpensesByCategory { get; set; } = new();
    public List<PriceInflationAlertDto> TopPriceHikes { get; set; } = new();
}

public class CategoryExpenseDto
{
    public string Category { get; set; } = string.Empty;
    public decimal TotalSpent { get; set; }
}

public class PriceInflationAlertDto
{
    public string ProductName { get; set; } = string.Empty;
    public decimal OldPrice { get; set; }
    public decimal NewPrice { get; set; }
    public decimal VariationPercent { get; set; }
}

