import { jsPDF } from "jspdf";
import { storePreviewData } from "./downloadPreview";
import logoUrl from "@/assets/4d-academy-logo.jpg";

interface ReceiptData {
  feeId: string;
  studentName: string;
  amount: number;
  dueDate: string;
  paidDate: string;
  paymentMethod?: string | null;
  notes?: string | null;
}

async function loadLogoBase64(): Promise<string> {
  const response = await fetch(logoUrl);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function generateReceipt(data: ReceiptData) {
  const receiptNumber = `RCP-${data.feeId.substring(0, 8).toUpperCase()}`;
  const doc = new jsPDF({ unit: "mm", format: "a5" });
  const w = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, w, 36, "F");

  // Logo
  try {
    const logoBase64 = await loadLogoBase64();
    doc.addImage(logoBase64, "JPEG", w / 2 - 6, 3, 12, 12);
  } catch {
    // Skip logo if loading fails
  }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("4D Academy", w / 2, 20, { align: "center" });

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Fee Receipt", w / 2, 26, { align: "center" });

  // PAID badge
  doc.setFillColor(16, 185, 129);
  doc.roundedRect(w / 2 - 12, 28, 24, 6, 3, 3, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("PAID", w / 2, 32.2, { align: "center" });

  // Receipt number
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(receiptNumber, w / 2, 44, { align: "center" });

  // Rows
  const rows: { label: string; value: string }[] = [
    { label: "Amount", value: `Rs. ${data.amount.toLocaleString()}` },
    { label: "Student", value: data.studentName },
    { label: "Due Date", value: new Date(data.dueDate).toLocaleDateString() },
    { label: "Payment Date", value: new Date(data.paidDate).toLocaleDateString() },
  ];
  if (data.paymentMethod) rows.push({ label: "Payment Method", value: data.paymentMethod });
  if (data.notes) rows.push({ label: "Notes", value: data.notes });

  const startY = 52;
  const rowH = 10;
  const leftX = 14;
  const rightX = w - 14;

  rows.forEach((row, i) => {
    const y = startY + i * rowH;

    if (i > 0) {
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(leftX, y - 1, rightX, y - 1);
    }

    doc.setTextColor(100, 116, 139);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(row.label, leftX, y + 4);

    if (i === 0) {
      doc.setTextColor(37, 99, 235);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
    } else {
      doc.setTextColor(26, 26, 26);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
    }
    doc.text(row.value, rightX, y + 4, { align: "right" });
  });

  // Footer
  const footerY = startY + rows.length * rowH + 8;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(leftX, footerY, rightX, footerY);

  doc.setTextColor(148, 163, 184);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text(
    "This is a computer-generated receipt and does not require a signature.",
    w / 2,
    footerY + 6,
    { align: "center" }
  );

  const filename = `Receipt-${receiptNumber}.pdf`;
  const dataUri = doc.output("datauristring");

  const metaRows: { label: string; value: string }[] = [
    { label: "Due Date", value: new Date(data.dueDate).toLocaleDateString() },
    { label: "Payment Date", value: new Date(data.paidDate).toLocaleDateString() },
  ];
  if (data.paymentMethod) metaRows.push({ label: "Payment Method", value: data.paymentMethod });
  if (data.notes) metaRows.push({ label: "Notes", value: data.notes });

  storePreviewData({
    type: "pdf",
    content: dataUri,
    filename,
    metadata: {
      receiptNumber,
      title: "Fee Receipt",
      name: data.studentName,
      nameLabel: "Student",
      amount: data.amount,
      rows: metaRows,
    },
  });
}
