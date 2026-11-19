using System.Globalization;
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
            result.StoreName = (string?)emit.Element(ns + "xNome") ?? (string?)emit.Element("xNome") ?? "Supermercado";
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
                Description = desc.Trim(),
                Barcode = barcode?.Trim(),
                Quantity = quantity,
                UnitPrice = unitPrice,
                TotalPrice = totalPrice,
                Unit = unit.Trim(),
                Category = GuessCategory(desc)
            };

            result.Items.Add(item);
        }

        if (result.TotalAmount == 0 && result.Items.Count > 0)
        {
            result.TotalAmount = result.Items.Sum(i => i.TotalPrice);
        }

        return result;
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

