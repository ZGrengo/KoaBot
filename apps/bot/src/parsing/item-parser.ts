import { Unit, normalizeUnit, parseDecimal } from '@koabot/shared';

export interface ParsedItemLine {
    ref: string;
    product: string;
    quantity: number;
    unit: Unit;
    reason?: string; // Optional reason (for wastage)
}

/**
 * Flexible parser for item lines. Supports multiple formats:
 * 
 * 1. Semicolon-separated (original): "REF; nombre; cantidad; unidad" or "REF; nombre; cantidad; unidad; motivo"
 * 2. Natural format: "Pechuga de pollo 0.25 kg"
 * 3. Quantity-first: "0,25 kg Pechuga de pollo"
 * 4. With ref: "PAN010 Pan burger 12 ud"
 * 5. With reason: "POLLO001; Pechuga; 0.25; kg; caducado" or "Pan burger 12 ud quemado"
 * 
 * Also accepts '|' and ',' as separators (in addition to ';')
 */
export function parseItemLine(line: string): ParsedItemLine {
    const trimmed = line.trim();
    if (!trimmed) {
        throw new Error('Línea vacía. Formato esperado: "REF; nombre; cantidad; unidad" o "nombre cantidad unidad"');
    }

    // Check if line contains semicolon, pipe, or comma as separator
    // Count separators: if we have at least 2 separators, it's likely separated format
    const separatorCount = (trimmed.match(/[;|,]/g) || []).length;

    // If we have 2+ separators, try separated format first
    // But be careful: comma might be decimal separator (e.g., "2,5 kg")
    // So we check if comma is followed by space or is part of a number pattern
    const hasMultipleSeparators = separatorCount >= 2;
    const hasSemicolonOrPipe = /[;|]/.test(trimmed);

    // Special case: if line starts with semicolon (empty REF), it's definitely separated format
    if (trimmed.startsWith(';')) {
        return parseSeparatedFormat(trimmed);
    }

    // If has semicolon/pipe OR multiple commas (likely separators), use separated format
    if (hasSemicolonOrPipe || (hasMultipleSeparators && separatorCount >= 2)) {
        return parseSeparatedFormat(trimmed);
    }

    // If single comma, check if it's decimal separator or field separator
    // Decimal separator: "2,5" (comma between digits)
    // Field separator: "Tomate, 10, kg" (comma followed by space or between non-digits)
    if (separatorCount === 1 && /,/.test(trimmed)) {
        // Check if comma is decimal separator (between digits) or field separator
        const commaMatch = trimmed.match(/,/);
        if (commaMatch && commaMatch.index !== undefined) {
            const beforeComma = trimmed.substring(0, commaMatch.index).trim();
            const afterComma = trimmed.substring(commaMatch.index + 1).trim();
            // If comma is between digits (decimal), use natural format
            // If comma has space before/after or is between non-digits, use separated format
            if (/^\d+$/.test(beforeComma) && /^\d/.test(afterComma)) {
                // Likely decimal separator, use natural format
            } else {
                // Likely field separator, use separated format
                return parseSeparatedFormat(trimmed);
            }
        }
    }

    // Try natural language format
    return parseNaturalFormat(trimmed);
}

/**
 * Parse semicolon/pipe/comma separated format:
 * "REF; nombre; cantidad; unidad" or "REF; nombre; cantidad; unidad; motivo"
 */
function parseSeparatedFormat(line: string): ParsedItemLine {
    // Split by semicolon, pipe, or comma (but prefer semicolon)
    const separators = /[;|,]/;
    const parts = line.split(separators).map((p) => p.trim()).filter((p) => p);

    if (parts.length < 3) {
        throw new Error(
            'Formato inválido. Usa "REF; nombre; cantidad; unidad" o "nombre cantidad unidad". ' +
            'Ejemplo: "ABC123; Tomate; 10; kg" o "Tomate 10 kg"'
        );
    }

    // Check if last part looks like a reason (not a unit)
    const lastPart = parts[parts.length - 1].toLowerCase();
    const secondLastPart = parts.length > 4 ? parts[parts.length - 2].toLowerCase() : '';

    let ref = 'UNKNOWN';
    let product = '';
    let quantity: number | null = null;
    let unit: Unit | null = null;
    let reason: string | undefined = undefined;

    // If we have 5+ parts, likely: ref; product; quantity; unit; reason
    if (parts.length >= 5) {
        ref = parts[0] || 'UNKNOWN';
        product = parts[1];
        quantity = parseDecimal(parts[2]);
        unit = normalizeUnit(parts[3]);
        reason = parts.slice(4).join(' ').trim() || undefined;
    }
    // If we have 4 parts, could be: ref; product; quantity; unit OR product; quantity; unit; reason
    else if (parts.length === 4) {
        // Check if last part is a unit or reason
        const lastUnit = normalizeUnit(parts[3]);
        if (lastUnit) {
            // Format: ref; product; quantity; unit
            ref = parts[0] || 'UNKNOWN';
            product = parts[1];
            quantity = parseDecimal(parts[2]);
            unit = lastUnit;
        } else {
            // Format: product; quantity; unit; reason
            ref = 'UNKNOWN';
            product = parts[0];
            quantity = parseDecimal(parts[1]);
            unit = normalizeUnit(parts[2]);
            reason = parts[3];
        }
    }
    // If we have 3 parts: product; quantity; unit
    else {
        ref = 'UNKNOWN';
        product = parts[0];
        quantity = parseDecimal(parts[1]);
        unit = normalizeUnit(parts[2]);
    }

    // Validate
    if (!product) {
        throw new Error('El nombre del producto es obligatorio.');
    }

    if (quantity === null) {
        throw new Error(
            'Cantidad inválida. Usa un número decimal, por ejemplo "10" o "2,5".'
        );
    }

    if (!unit) {
        throw new Error(
            'Unidad inválida. Usa "ud", "kg" o "L". Ejemplo: "ABC123; Tomate; 10; kg" o "Tomate 10 kg".'
        );
    }

    const result: ParsedItemLine = { ref, product, quantity, unit };
    if (reason) {
        result.reason = reason;
    }
    return result;
}

/**
 * Parse natural language format:
 * "Pechuga de pollo 0.25 kg"
 * "0,25 kg Pechuga de pollo"
 * "PAN010 Pan burger 12 ud"
 * "Pan burger 12 ud quemado"
 */
function parseNaturalFormat(line: string): ParsedItemLine {
    // Pattern 1: Look for unit at the end: "product quantity unit" or "product quantity unit reason"
    // Match: product (may contain spaces), then quantity (number with optional decimal), then unit, then optional reason
    const unitAtEndPattern = /^(.+?)\s+(\d+[,.]?\d*)\s+(ud|kg|kilo|kilos|l|lt|litro|litros|unidad|unidades)(?:\s+(.+))?$/i;
    const match1 = line.match(unitAtEndPattern);
    if (match1) {
        const productPart = match1[1].trim();
        const quantityStr = match1[2];
        const unitStr = match1[3];
        const reasonPart = match1[4]?.trim();

        // Check if productPart starts with something that looks like a ref
        // REF should be: alphanumeric, 2-10 chars, followed by space, then product name
        // But be careful: don't treat common words like "Pechuga", "Pan" as REFs
        // REFs are usually codes: uppercase letters + numbers, or all uppercase short codes
        const refMatch = productPart.match(/^([A-Z0-9]{2,10})\s+(.+)$/);
        let ref = 'UNKNOWN';
        let product = productPart;

        if (refMatch) {
            const potentialRef = refMatch[1];
            // Only treat as REF if it looks like a code (has numbers or is all uppercase short)
            if (/[0-9]/.test(potentialRef) || (potentialRef.length <= 6 && potentialRef === potentialRef.toUpperCase())) {
                ref = potentialRef;
                product = refMatch[2].trim();
            }
        }

        const quantity = parseDecimal(quantityStr);
        const unit = normalizeUnit(unitStr);

        if (!product) {
            throw new Error('No se pudo identificar el nombre del producto.');
        }
        if (quantity === null) {
            throw new Error(`Cantidad inválida: "${quantityStr}". Usa un número decimal.`);
        }
        if (!unit) {
            throw new Error(`Unidad inválida: "${unitStr}". Usa "ud", "kg" o "L".`);
        }

        const result: ParsedItemLine = { ref, product, quantity, unit };
        if (reasonPart) {
            result.reason = reasonPart;
        }
        return result;
    }

    // Pattern 2: Quantity and unit at the beginning: "quantity unit product" or "quantity unit product reason"
    // Match: quantity (number with optional decimal comma/dot), then unit, then product (may contain spaces), then optional reason
    const quantityFirstPattern = /^(\d+[,.]?\d*)\s+(ud|kg|kilo|kilos|l|lt|litro|litros|unidad|unidades)\s+(.+)$/i;
    const match2 = line.match(quantityFirstPattern);
    if (match2) {
        const quantityStr = match2[1];
        const unitStr = match2[2];
        const rest = match2[3].trim();

        // Check if rest starts with a ref (similar logic as Pattern 1)
        const refMatch = rest.match(/^([A-Z0-9]{2,10})\s+(.+)$/);
        let ref = 'UNKNOWN';
        let productAndReason = rest;

        if (refMatch) {
            const potentialRef = refMatch[1];
            // Only treat as REF if it looks like a code
            if (/[0-9]/.test(potentialRef) || (potentialRef.length <= 6 && potentialRef === potentialRef.toUpperCase())) {
                ref = potentialRef;
                productAndReason = refMatch[2];
            }
        }

        // Try to split product and reason (last word might be reason if it doesn't look like part of product name)
        // Simple heuristic: if last word is short and lowercase, might be reason
        const words = productAndReason.split(/\s+/);
        let product = productAndReason;
        let reason: string | undefined = undefined;

        // If last word is short (<=8 chars) and all lowercase, might be reason
        if (words.length > 1) {
            const lastWord = words[words.length - 1];
            if (lastWord.length <= 8 && lastWord === lastWord.toLowerCase() && !lastWord.match(/^\d/)) {
                product = words.slice(0, -1).join(' ');
                reason = lastWord;
            }
        }

        const quantity = parseDecimal(quantityStr);
        const unit = normalizeUnit(unitStr);

        if (!product) {
            throw new Error('No se pudo identificar el nombre del producto.');
        }
        if (quantity === null) {
            throw new Error(`Cantidad inválida: "${quantityStr}". Usa un número decimal.`);
        }
        if (!unit) {
            throw new Error(`Unidad inválida: "${unitStr}". Usa "ud", "kg" o "L".`);
        }

        const result: ParsedItemLine = { ref, product, quantity, unit };
        if (reason) {
            result.reason = reason;
        }
        return result;
    }

    // If no pattern matches, provide helpful error
    throw new Error(
        'Formato no reconocido. Usa uno de estos formatos:\n' +
        '• "REF; nombre; cantidad; unidad" (ej: "ABC123; Tomate; 10; kg")\n' +
        '• "nombre cantidad unidad" (ej: "Tomate 10 kg")\n' +
        '• "cantidad unidad nombre" (ej: "10 kg Tomate")\n' +
        '• "REF nombre cantidad unidad" (ej: "PAN010 Pan burger 12 ud")'
    );
}

