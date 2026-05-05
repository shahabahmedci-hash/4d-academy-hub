import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download } from "lucide-react";
import { getPreviewData, clearPreviewData, type PreviewData } from "@/lib/downloadPreview";
import logoSrc from "@/assets/4d-academy-logo.jpg";

const PreviewDownload = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<PreviewData | null>(null);

  useEffect(() => {
    const preview = getPreviewData();
    if (!preview) {
      navigate(-1);
      return;
    }
    setData(preview);
  }, []);

  const handleDownload = () => {
    if (!data) return;
    if (data.type === "pdf") {
      const byteString = atob(data.content.split(",")[1]);
      const mimeString = data.content.split(",")[0].split(":")[1].split(";")[0];
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
      const blob = new Blob([ab], { type: mimeString });
      triggerDownload(blob, data.filename);
    } else {
      const blob = new Blob([data.content], { type: "text/csv;charset=utf-8;" });
      triggerDownload(blob, data.filename);
    }
  };

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const handleBack = () => {
    clearPreviewData();
    navigate(-1);
  };

  if (!data) return null;

  const meta = data.metadata;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={handleBack}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-xl font-bold">Download Preview</h1>
                <p className="text-sm text-muted-foreground">{data.filename}</p>
              </div>
            </div>
            <Button onClick={handleDownload} className="gap-2">
              <Download className="h-4 w-4" />
              Download
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {data.type === "pdf" && meta ? (
          <Card className="max-w-md mx-auto overflow-hidden">
            {/* Blue header */}
            <div className="bg-primary text-primary-foreground p-6 text-center">
              <img src={logoSrc} alt="4D Academy" className="w-12 h-12 rounded-full mx-auto mb-2 object-cover" />
              <h2 className="text-lg font-bold">4D Academy</h2>
              <p className="text-sm opacity-90">{meta.title}</p>
              <Badge className="mt-2 bg-emerald-500 hover:bg-emerald-500 text-white border-0">PAID</Badge>
            </div>

            <CardContent className="p-6 space-y-4">
              <p className="text-center text-sm text-muted-foreground">{meta.receiptNumber}</p>

              {/* Amount */}
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-muted-foreground">Amount</span>
                <span className="text-xl font-bold text-primary">₹{meta.amount.toLocaleString()}</span>
              </div>

              <div className="border-t" />

              {/* Name */}
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-muted-foreground">{meta.nameLabel}</span>
                <span className="text-sm font-medium">{meta.name}</span>
              </div>

              {/* Detail rows */}
              {meta.rows.map((row, i) => (
                <div key={i} className="flex justify-between items-center py-2 border-t">
                  <span className="text-sm text-muted-foreground">{row.label}</span>
                  <span className="text-sm">{row.value}</span>
                </div>
              ))}

              <div className="border-t pt-4">
                <p className="text-xs text-muted-foreground text-center">
                  This is a computer-generated receipt and does not require a signature.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : data.type === "csv" ? (
          <Card>
            <CardHeader>
              <CardTitle>CSV Preview</CardTitle>
            </CardHeader>
            <CardContent>
              {data.columns && data.rows ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        {data.columns.map((col) => (
                          <th key={col.key} className="text-left p-2 font-medium text-muted-foreground">{col.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.rows.slice(0, 100).map((row, i) => (
                        <tr key={i} className="border-b last:border-0">
                          {data.columns!.map((col) => (
                            <td key={col.key} className="p-2">{row[col.key] ?? ""}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {data.rows.length > 100 && (
                    <p className="text-sm text-muted-foreground mt-4 text-center">
                      Showing first 100 of {data.rows.length} rows
                    </p>
                  )}
                </div>
              ) : (
                <pre className="whitespace-pre-wrap text-xs max-h-[60vh] overflow-y-auto">{data.content}</pre>
              )}
            </CardContent>
          </Card>
        ) : null}
      </main>
    </div>
  );
};

export default PreviewDownload;
