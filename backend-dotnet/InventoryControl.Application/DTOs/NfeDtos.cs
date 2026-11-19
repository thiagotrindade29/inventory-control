namespace InventoryControl.Application.DTOs;

public class ParsedNfeItemDto
{
    public string Description { get; set; } = string.Empty;
    public string? Barcode { get; set; }
    public decimal Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal TotalPrice { get; set; }
    public string? Unit { get; set; }
    public string Category { get; set; } = "Geral";
    public int? MatchedProductId { get; set; }
    public decimal? PreviousUnitPrice { get; set; }
    public decimal? PriceVariationPercent { get; set; }
}

public class ParsedNfeDto
{
    public string StoreName { get; set; } = string.Empty;
    public string? Cnpj { get; set; }
    public DateTime? IssueDate { get; set; }
    public string? NfeKey { get; set; }
    public decimal TotalAmount { get; set; }
    public List<ParsedNfeItemDto> Items { get; set; } = new();
}

public class ParseXmlRequestDto
{
    public string XmlContent { get; set; } = string.Empty;
}

