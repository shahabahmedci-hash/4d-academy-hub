import { storePreviewData } from "./downloadPreview";

export const formatDateForExport = (dateStr: string | null | undefined): string => {
  if (!dateStr) return "";
  // Parse YYYY-MM-DD directly without timezone conversion to avoid date shifts
  const isoMatch = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    return `${isoMatch[3].padStart(2, "0")}/${isoMatch[2].padStart(2, "0")}/${isoMatch[1]}`;
  }
  // Fallback for other formats
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = d.getDate().toString().padStart(2, "0");
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

export interface CSVColumn {
  key: string;
  label: string;
}

export const exportToCSV = (
  data: Record<string, any>[],
  columns: CSVColumn[],
  filename: string
) => {
  const escapeCSV = (value: any): string => {
    const str = value === null || value === undefined ? "" : String(value);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerRow = columns.map((col) => escapeCSV(col.label)).join(",");
  const dataRows = data.map((row) =>
    columns.map((col) => escapeCSV(row[col.key])).join(",")
  );

  const csvContent = [headerRow, ...dataRows].join("\n");

  storePreviewData({
    type: "csv",
    content: csvContent,
    filename: `${filename}.csv`,
    columns,
    rows: data,
  });
};
