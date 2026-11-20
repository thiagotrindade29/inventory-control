using System.Text.Json.Serialization;

namespace InventoryControl.Application.DTOs;

public class ParsedNfeItemDto
{
    [JsonPropertyName("index")]
    public int Index { get; set; }

    [JsonPropertyName("name")]
    public string Description { get; set; } = string.Empty;

    [JsonPropertyName("code")]
    public string? Code { get; set; }

    [JsonPropertyName("barcode")]
    public string? Barcode { get; set; }

    [JsonPropertyName("quantity")]
    public decimal Quantity { get; set; }

    [JsonPropertyName("unitPrice")]
    public decimal UnitPrice { get; set; }

    [JsonPropertyName("totalPrice")]
    public decimal TotalPrice { get; set; }

    [JsonPropertyName("unit")]
    public string? Unit { get; set; }

    [JsonPropertyName("suggestedCategory")]
    public string SuggestedCategory { get; set; } = "Geral";

    [JsonPropertyName("productId")]
    public int? ProductId { get; set; }

    [JsonPropertyName("isExisting")]
    public bool IsExisting { get; set; }

    [JsonPropertyName("currentStock")]
    public decimal CurrentStock { get; set; }

    [JsonPropertyName("previousUnitPrice")]
    public decimal? PreviousUnitPrice { get; set; }

    [JsonPropertyName("categoryId")]
    public int? CategoryId { get; set; }

    [JsonPropertyName("categoryName")]
    public string CategoryName { get; set; } = "Geral";

    [JsonPropertyName("categoryColor")]
    public string CategoryColor { get; set; } = "#3b82f6";

    [JsonPropertyName("location")]
    public string Location { get; set; } = "Despensa";
}

public class ParsedNfeDto
{
    [JsonPropertyName("source")]
    public string Source { get; set; } = "XML";

    [JsonPropertyName("storeName")]
    public string StoreName { get; set; } = string.Empty;

    [JsonPropertyName("storeCnpj")]
    public string? Cnpj { get; set; }

    [JsonPropertyName("invoiceNumber")]
    public string? InvoiceNumber { get; set; }

    [JsonPropertyName("issueDate")]
    public DateTime? IssueDate { get; set; }

    [JsonPropertyName("nfeKey")]
    public string? NfeKey { get; set; }

    [JsonPropertyName("url")]
    public string? Url { get; set; }

    [JsonPropertyName("totalAmount")]
    public decimal TotalAmount { get; set; }

    [JsonPropertyName("totalItems")]
    public int TotalItems { get; set; }

    [JsonPropertyName("items")]
    public List<ParsedNfeItemDto> Items { get; set; } = new();
}

public class ParseXmlRequestDto
{
    [JsonPropertyName("xml")]
    public string XmlContent { get; set; } = string.Empty;
}

public class ParseTextRequestDto
{
    [JsonPropertyName("text")]
    public string Text { get; set; } = string.Empty;
}

public class ParseUrlRequestDto
{
    [JsonPropertyName("url")]
    public string Url { get; set; } = string.Empty;
}
