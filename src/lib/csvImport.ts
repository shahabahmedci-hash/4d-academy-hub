/**
 * Shared CSV import utilities for all import dialogs.
 * Provides quote-aware parsing, date normalization, numeric cleaning, and email validation.
 */

/** Quote-aware CSV line splitter — handles fields containing commas wrapped in quotes */
export function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

/** Parse full CSV text into headers + rows using quote-aware splitting */
export function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return { headers: [], rows: [] };
  const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase().replace(/['"]/g, ""));
  const rows = lines.slice(1).map((line) => {
    const values = parseCSVLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] || ""; });
    return row;
  });
  return { headers, rows };
}

/**
 * Normalize date strings to ISO YYYY-MM-DD.
 * Handles: DD/MM/YYYY, D/M/YYYY, DD-MM-YYYY, MM/DD/YYYY (auto-detects),
 * and passes through YYYY-MM-DD and YYYY-MM (appends -01).
 */
export function parseDateValue(dateStr: string): string | null {
  if (!dateStr) return null;
  const trimmed = dateStr.trim();

  // Already ISO: YYYY-MM-DD
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(trimmed)) return trimmed;

  // YYYY-MM format (for salary months) → append -01
  if (/^\d{4}-\d{1,2}$/.test(trimmed)) return `${trimmed}-01`;

  // DD/MM/YYYY or D/M/YYYY or DD-MM-YYYY or MM/DD/YYYY
  const slashMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (slashMatch) {
    const [, a, b, year] = slashMatch;
    const numA = parseInt(a, 10);
    const numB = parseInt(b, 10);
    let day: number, month: number;
    if (numA > 12) {
      day = numA; month = numB; // must be day-first
    } else if (numB > 12) {
      month = numA; day = numB; // must be month-first
    } else {
      day = numA; month = numB; // ambiguous, assume DD/MM
    }
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  return null;
}

/** Strip currency symbols and locale separators, return clean number */
export function parseNumericValue(value: string): number {
  if (!value) return 0;
  let str = value.trim().replace(/[₹$€£¥\s]/g, "");
  const lastComma = str.lastIndexOf(",");
  const lastDot = str.lastIndexOf(".");
  if (lastComma > lastDot) {
    str = str.replace(/\./g, "").replace(",", ".");
  } else {
    str = str.replace(/,/g, "");
  }
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
}

/** Basic email format validation */
export function isValidEmail(str: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str.trim());
}
