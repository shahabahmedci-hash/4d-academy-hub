export interface ReceiptMetadata {
  receiptNumber: string;
  title: string; // "Fee Receipt" or "Salary Receipt"
  name: string;
  nameLabel: string; // "Student" or "Teacher"
  amount: number;
  rows: { label: string; value: string }[];
}

export interface PreviewData {
  type: 'pdf' | 'csv';
  content: string;
  filename: string;
  columns?: { key: string; label: string }[];
  rows?: Record<string, any>[];
  metadata?: ReceiptMetadata;
}

export function storePreviewData(data: PreviewData) {
  sessionStorage.setItem('preview_download', JSON.stringify(data));
}

export function getPreviewData(): PreviewData | null {
  const raw = sessionStorage.getItem('preview_download');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearPreviewData() {
  sessionStorage.removeItem('preview_download');
}
