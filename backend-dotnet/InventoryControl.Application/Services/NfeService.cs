using System.Globalization;
using System.Net;
using System.Text.RegularExpressions;
using System.Xml.Linq;
using InventoryControl.Application.DTOs;

namespace InventoryControl.Application.Services;

public class NfeService
{
    public ParsedNfeDto ParseXml(string xmlContent)
    {
        if (string.IsNullOrWhiteSpace(xmlContent))
        {
            throw new ArgumentException("O conteúdo XML não pode estar vazio.", nameof(xmlContent));
        }

        var doc = XDocument.Parse(xmlContent);
        XNamespace ns = doc.Root?.GetDefaultNamespace() ?? XNamespace.None;

        var result = new ParsedNfeDto();

        // 1. Extrair dados da tag <infNFe> (Chave de 44 dígitos)
        var infNfe = doc.Descendants(ns + "infNFe").FirstOrDefault()
                     ?? doc.Descendants("infNFe").FirstOrDefault();

        if (infNfe != null)
        {
            var idAttr = (string?)infNfe.Attribute("Id");
            if (!string.IsNullOrEmpty(idAttr))
            {
                // Formato padrão: NFe3524... (remove o prefixo 'NFe')
                result.NfeKey = Regex.Replace(idAttr, @"^NFe", "");
            }
        }

        // 2. Extrair dados do Emitente (Nome do Mercado e CNPJ)
        var emit = doc.Descendants(ns + "emit").FirstOrDefault()
                   ?? doc.Descendants("emit").FirstOrDefault();

        if (emit != null)
        {
            result.StoreName = (string?)emit.Element(ns + "xFant") ?? (string?)emit.Element("xFant")
                ?? (string?)emit.Element(ns + "xNome") ?? (string?)emit.Element("xNome") ?? "Supermercado";
            result.Cnpj = (string?)emit.Element(ns + "CNPJ") ?? (string?)emit.Element("CNPJ");
        }
        else
        {
            result.StoreName = "Supermercado";
        }

        // 3. Extrair Data de Emissão (<dhEmi> ou <dEmi>)
        var ide = doc.Descendants(ns + "ide").FirstOrDefault()
                  ?? doc.Descendants("ide").FirstOrDefault();

        if (ide != null)
        {
            result.InvoiceNumber = (string?)ide.Element(ns + "nNF") ?? (string?)ide.Element("nNF");
            var dhEmi = (string?)ide.Element(ns + "dhEmi") ?? (string?)ide.Element("dhEmi")
                        ?? (string?)ide.Element(ns + "dEmi") ?? (string?)ide.Element("dEmi");

            if (!string.IsNullOrEmpty(dhEmi) && DateTime.TryParse(dhEmi, out var parsedDate))
            {
                result.IssueDate = parsedDate.ToUniversalTime();
            }
        }
        result.IssueDate ??= DateTime.UtcNow;

        // 4. Extrair Total da Nota (<vNF>)
        var totalElem = doc.Descendants(ns + "vNF").FirstOrDefault()
                        ?? doc.Descendants("vNF").FirstOrDefault();

        if (totalElem != null && decimal.TryParse((string)totalElem, NumberStyles.Any, CultureInfo.InvariantCulture, out var total))
        {
            result.TotalAmount = total;
        }

        // 5. Extrair Itens da Nota (<det><prod>)
        var detElements = doc.Descendants(ns + "det")
                             .Concat(doc.Descendants("det"))
                             .Distinct();

        foreach (var det in detElements)
        {
            var prod = det.Element(ns + "prod") ?? det.Element("prod");
            if (prod == null) continue;

            var desc = (string?)prod.Element(ns + "xProd") ?? (string?)prod.Element("xProd") ?? "Item";
            var barcode = (string?)prod.Element(ns + "cEAN") ?? (string?)prod.Element("cEAN");
            if (barcode == "SEM GTIN" || barcode == "sem gtin") barcode = null;

            var unit = (string?)prod.Element(ns + "uCom") ?? (string?)prod.Element("uCom") ?? "UN";

            var qComStr = (string?)prod.Element(ns + "qCom") ?? (string?)prod.Element("qCom") ?? "1";
            var vUnComStr = (string?)prod.Element(ns + "vUnCom") ?? (string?)prod.Element("vUnCom") ?? "0";
            var vProdStr = (string?)prod.Element(ns + "vProd") ?? (string?)prod.Element("vProd") ?? "0";

            decimal.TryParse(qComStr, NumberStyles.Any, CultureInfo.InvariantCulture, out var quantity);
            decimal.TryParse(vUnComStr, NumberStyles.Any, CultureInfo.InvariantCulture, out var unitPrice);
            decimal.TryParse(vProdStr, NumberStyles.Any, CultureInfo.InvariantCulture, out var totalPrice);

            if (totalPrice == 0 && quantity > 0 && unitPrice > 0)
            {
                totalPrice = Math.Round(quantity * unitPrice, 2);
            }

            var item = new ParsedNfeItemDto
            {
                Index = result.Items.Count + 1,
                Description = desc.Trim(),
                Code = (string?)prod.Element(ns + "cProd") ?? (string?)prod.Element("cProd"),
                Barcode = barcode?.Trim(),
                Quantity = quantity,
                UnitPrice = unitPrice,
                TotalPrice = totalPrice,
                Unit = unit.Trim(),
                SuggestedCategory = GuessCategory(desc)
            };

            result.Items.Add(item);
        }

        if (result.TotalAmount == 0 && result.Items.Count > 0)
        {
            result.TotalAmount = result.Items.Sum(i => i.TotalPrice);
        }

        result.TotalItems = result.Items.Count;

        return result;
    }

    public ParsedNfeDto ParseSefazHtml(string html)
    {
        var result = new ParsedNfeDto
        {
            Source = "SEFAZ_URL",
            StoreName = "Supermercado"
        };

        var storeMatch = Regex.Match(html,
            "<(?:div|span|h[1-6])[^>]*(?:class=[\\\"'][^\\\"']*(?:txtTopo|nomeFantasia|txtTit|nome)[^\\\"']*[\\\"']|id=[\\\"']u20[\\\"'])[^>]*>(.*?)</(?:div|span|h[1-6])>",
            RegexOptions.IgnoreCase | RegexOptions.Singleline);
        if (storeMatch.Success)
            result.StoreName = CleanHtml(storeMatch.Groups[1].Value);

        var cnpjMatch = Regex.Match(html, @"CNPJ:\s*([\d.\-/]+)", RegexOptions.IgnoreCase);
        if (cnpjMatch.Success)
            result.Cnpj = cnpjMatch.Groups[1].Value.Trim();

        var totalMatch = Regex.Match(html,
            @"(?:Valor a pagar|Valor total|Total R\$|totalNFe)[^>]*R?\$?\s*([0-9\.,]+)",
            RegexOptions.IgnoreCase);
        if (totalMatch.Success)
            result.TotalAmount = ParseBrazilianDecimal(totalMatch.Groups[1].Value);

        var rows = Regex.Matches(html, "<tr[^>]*id=[\\\"']Item[^\\\"']*[\\\"'][^>]*>(.*?)</tr>",
            RegexOptions.IgnoreCase | RegexOptions.Singleline);

        foreach (Match row in rows)
        {
            var rowHtml = row.Groups[1].Value;
            var name = ExtractClassText(rowHtml, "txtTit");
            var code = ExtractClassText(rowHtml, "RCod");
            var quantityText = ExtractClassText(rowHtml, "Rqtd");
            var unit = ExtractClassText(rowHtml, "RUN");
            var unitPriceText = ExtractClassText(rowHtml, "RvlUnit");
            var totalPriceText = ExtractClassText(rowHtml, "valor") ?? ExtractClassText(rowHtml, "Rtotal");

            var quantity = quantityText == null ? 1m : ParseBrazilianDecimal(quantityText);
            if (quantity <= 0) quantity = 1m;
            var unitPrice = unitPriceText == null ? 0m : ParseBrazilianDecimal(unitPriceText);
            var totalPrice = totalPriceText == null ? quantity * unitPrice : ParseBrazilianDecimal(totalPriceText);
            var description = name ?? $"Item {result.Items.Count + 1}";

            result.Items.Add(new ParsedNfeItemDto
            {
                Index = result.Items.Count + 1,
                Description = description,
                Code = code,
                Barcode = code != null && code.Length >= 8 ? code : null,
                Quantity = quantity,
                UnitPrice = unitPrice,
                TotalPrice = totalPrice,
                Unit = string.Equals(unit, "kg", StringComparison.OrdinalIgnoreCase) ? "kg" : "un",
                SuggestedCategory = GuessCategory(description)
            });
        }

        if (result.TotalAmount <= 0 && result.Items.Count > 0)
            result.TotalAmount = result.Items.Sum(i => i.TotalPrice);

        result.TotalAmount = Math.Round(result.TotalAmount, 2);
        result.TotalItems = result.Items.Count;
        return result;
    }

    public ParsedNfeDto ParseReceiptText(string text)
    {
        var lines = text.Split(new[] { "\r\n", "\n" }, StringSplitOptions.RemoveEmptyEntries)
            .Select(line => line.Trim())
            .Where(line => line.Length > 0)
            .ToList();

        var result = new ParsedNfeDto
        {
            Source = "TEXT_OCR",
            StoreName = lines.Take(5).FirstOrDefault(line =>
                line.Length >= 3 && !Regex.IsMatch(line, @"CNPJ|CUPOM|EXTRATO|NOTA FISCAL|DANFE", RegexOptions.IgnoreCase))
                ?? "Mercado / Estabelecimento"
        };

        string? pendingName = null;
        string? pendingBarcode = null;

        foreach (var line in lines)
        {
            var upper = line.ToUpperInvariant();
            if (upper.Contains("TOTAL") && Regex.IsMatch(upper, @"[0-9]"))
            {
                var receiptTotal = Regex.Match(upper, @"TOTAL[^0-9]*([0-9\.,]+)", RegexOptions.IgnoreCase);
                if (receiptTotal.Success)
                    result.TotalAmount = ParseBrazilianDecimal(receiptTotal.Groups[1].Value);
                continue;
            }

            if (Regex.IsMatch(upper,
                @"EXTRATO|CNPJ|TRIBUTOS|VALOR APROX|FORMA DE PAGAMENTO|DINHEIRO|CART[AÃ]O|TROCO|CHAVE DE ACESSO|CONSULTA PELA CHAVE|PROTOCOLO",
                RegexOptions.IgnoreCase))
                continue;

            var match = Regex.Match(line,
                @"^(?:(\d+)\s+)?(?:(\d{8,14})\s+)?(.+?)\s+([0-9\.,]+)\s*(KG|UN|PC|CX|LT|G|ML)?\s*[xX*]\s*([0-9\.,]+)\s*(?:[=\s]+)?([0-9\.,]+)?$",
                RegexOptions.IgnoreCase);
            if (match.Success)
            {
                var name = Regex.Replace(match.Groups[3].Value.Trim(), @"^\d+\s+", "");
                var quantity = ParseBrazilianDecimal(match.Groups[4].Value);
                if (quantity <= 0) quantity = 1m;
                var unitPrice = ParseBrazilianDecimal(match.Groups[6].Value);
                var total = match.Groups[7].Success
                    ? ParseBrazilianDecimal(match.Groups[7].Value)
                    : quantity * unitPrice;
                var barcode = match.Groups[2].Success ? match.Groups[2].Value : null;

                result.Items.Add(new ParsedNfeItemDto
                {
                    Index = result.Items.Count + 1,
                    Description = name,
                    Code = barcode,
                    Barcode = barcode,
                    Quantity = quantity,
                    UnitPrice = unitPrice,
                    TotalPrice = total,
                    Unit = string.Equals(match.Groups[5].Value, "kg", StringComparison.OrdinalIgnoreCase) ? "kg" : "un",
                    SuggestedCategory = GuessCategory(name)
                });
                pendingName = null;
                pendingBarcode = null;
                continue;
            }

            var calculation = Regex.Match(line,
                @"^([0-9\.,]+)\s*(KG|UN|PC|CX|LT|G|ML)?\s*[xX*]\s*([0-9\.,]+)\s*(?:[=\s]+)?([0-9\.,]+)?$",
                RegexOptions.IgnoreCase);
            if (calculation.Success && pendingName != null)
            {
                var quantity = ParseBrazilianDecimal(calculation.Groups[1].Value);
                if (quantity <= 0) quantity = 1m;
                var unitPrice = ParseBrazilianDecimal(calculation.Groups[3].Value);
                var total = calculation.Groups[4].Success
                    ? ParseBrazilianDecimal(calculation.Groups[4].Value)
                    : quantity * unitPrice;
                result.Items.Add(new ParsedNfeItemDto
                {
                    Index = result.Items.Count + 1,
                    Description = pendingName,
                    Code = pendingBarcode,
                    Barcode = pendingBarcode,
                    Quantity = quantity,
                    UnitPrice = unitPrice,
                    TotalPrice = total,
                    Unit = string.Equals(calculation.Groups[2].Value, "kg", StringComparison.OrdinalIgnoreCase) ? "kg" : "un",
                    SuggestedCategory = GuessCategory(pendingName)
                });
                pendingName = null;
                pendingBarcode = null;
                continue;
            }

            var nameLine = Regex.Match(line,
                @"^(?:(?:\d{1,4})\s+)?(?:(\d{8,14})\s+)?([A-Za-zÀ-ÿ0-9\s.\-/%]+)$");
            if (nameLine.Success && nameLine.Groups[2].Value.Trim().Length >= 3)
            {
                pendingBarcode = nameLine.Groups[1].Success ? nameLine.Groups[1].Value : null;
                pendingName = nameLine.Groups[2].Value.Trim();
            }
        }

        if (result.TotalAmount <= 0 && result.Items.Count > 0)
            result.TotalAmount = result.Items.Sum(i => i.TotalPrice);

        result.TotalAmount = Math.Round(result.TotalAmount, 2);
        result.TotalItems = result.Items.Count;
        return result;
    }

    private static string? ExtractClassText(string html, string className)
    {
        var pattern = $"<(?:span|td)[^>]*class=[\\\"'][^\\\"']*{Regex.Escape(className)}[^\\\"']*[\\\"'][^>]*>(.*?)</(?:span|td)>";
        var match = Regex.Match(html, pattern, RegexOptions.IgnoreCase | RegexOptions.Singleline);
        return match.Success ? CleanHtml(match.Groups[1].Value) : null;
    }

    private static string CleanHtml(string value) =>
        WebUtility.HtmlDecode(Regex.Replace(value, "<[^>]+>", " ")).Trim();

    private static decimal ParseBrazilianDecimal(string value)
    {
        var normalized = Regex.Replace(value, @"[^0-9,.-]", "").Trim();
        if (normalized.Contains(','))
            normalized = normalized.Replace(".", "").Replace(',', '.');

        return decimal.TryParse(normalized, NumberStyles.Number, CultureInfo.InvariantCulture, out var parsed)
            ? parsed
            : 0m;
    }

    // Heurística de classificação inteligente por palavra-chave
    public string GuessCategory(string description)
    {
        var text = description.ToLowerInvariant();

        if (Regex.IsMatch(text, @"(sab[aã]o|amaciante|detergente|desinfetante|cloro|alvejante|esponja|multiuso|limpador|lustra|vassoura|rodo|papel toalha|saco lixo)"))
            return "Limpeza";

        if (Regex.IsMatch(text, @"(shampoo|condicionador|sabonete|creme dental|escova|desodorante|fio dental|absorvente|papel higi[eê]nico|hidratante|barbear)"))
            return "Higiene";

        if (Regex.IsMatch(text, @"(carne|bife|acem|alcatra|frango|peito|coxa|costela|lingui[cç]a|bacon|salsicha|peixe|tilapia|salmao)"))
            return "Açougue & Carnes";

        if (Regex.IsMatch(text, @"(p[aã]o|torrada|biscoito|bolacha|bolo|mussarela|presunto|queijo|requeij[aã]o|manteiga|margarina|iogurte|leite)"))
            return "Padaria & Laticínios";

        if (Regex.IsMatch(text, @"(arroz|feij[aã]o|macarr[aã]o|azeite|[oó]leo|farinha|a[cç][uú]car|caf[eé]|sal|molho|milho|ervilha|atum|sardinha)"))
            return "Despensa";

        if (Regex.IsMatch(text, @"(ma[cç][aã]|banana|tomate|cebola|alho|batata|cenoura|alface|laranja|lim[aã]o|melancia|uva)"))
            return "Hortifruti";

        if (Regex.IsMatch(text, @"(refrigerante|suco|cerveja|vinho|ch[aá]|água|bebida)"))
            return "Bebidas";

        return "Geral";
    }
}

