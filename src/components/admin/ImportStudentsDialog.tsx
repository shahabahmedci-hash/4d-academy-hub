import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Upload, FileUp, AlertCircle, CheckCircle2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { parseCSV, isValidEmail } from "@/lib/csvImport";

interface ParsedStudent {
  full_name: string;
  email: string;
  phone?: string;
  class?: string;
  section?: string;
  stream?: string;
  _emailValid?: boolean;
}

interface ImportStudentsDialogProps {
  onStudentsImported: () => void;
}

export const ImportStudentsDialog = ({ onStudentsImported }: ImportStudentsDialogProps) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedStudent[]>([]);
  const [importing, setImporting] = useState(false);
  const [upsertMode, setUpsertMode] = useState(false);
  const [result, setResult] = useState<{ created: number; updated: number; failed: number; errors: string[] } | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const resetState = () => {
    setParsedData([]);
    setResult(null);
    setParseError(null);
    setUpsertMode(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);
    setParseError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const { headers, rows } = parseCSV(text);

        if (!headers.includes("full_name") || !headers.includes("email")) {
          setParseError("CSV must contain at least 'full_name' and 'email' columns.");
          setParsedData([]);
          return;
        }

        const students: ParsedStudent[] = rows
          .filter((r) => r.full_name && r.email)
          .map((r) => ({
            full_name: r.full_name,
            email: r.email,
            phone: r.phone || undefined,
            class: r.class || undefined,
            section: r.section || undefined,
            stream: r.stream || undefined,
            _emailValid: isValidEmail(r.email),
          }));

        if (students.length === 0) {
          setParseError("No valid student rows found. Ensure 'full_name' and 'email' are filled.");
          setParsedData([]);
          return;
        }

        setParsedData(students);
      } catch {
        setParseError("Failed to parse CSV file.");
        setParsedData([]);
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (parsedData.length === 0) return;
    setImporting(true);

    try {
      // Filter out invalid emails
      const invalidEmails = parsedData.filter((s) => !isValidEmail(s.email));
      const validStudents = parsedData.filter((s) => isValidEmail(s.email));

      if (invalidEmails.length > 0 && validStudents.length === 0) {
        setResult({
          created: 0,
          updated: 0,
          failed: invalidEmails.length,
          errors: invalidEmails.map((s) => `${s.email}: invalid email format`),
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke("import-students", {
        body: { students: validStudents.map(({ _emailValid, ...rest }) => rest), mode: upsertMode ? "upsert" : "create" },
      });

      if (error) throw error;

      const errors = [
        ...invalidEmails.map((s) => `${s.email}: invalid email format`),
        ...(data?.errors || []),
      ];

      setResult({
        created: data?.created || 0,
        updated: data?.updated || 0,
        failed: (data?.failed || 0) + invalidEmails.length,
        errors,
      });

      if ((data?.created || 0) + (data?.updated || 0) > 0) {
        const parts = [];
        if (data.created > 0) parts.push(`${data.created} created`);
        if (data.updated > 0) parts.push(`${data.updated} updated`);
        const totalFailed = (data.failed || 0) + invalidEmails.length;
        if (totalFailed > 0) parts.push(`${totalFailed} failed`);
        toast({ title: "Import Complete", description: parts.join(", ") });
        onStudentsImported();
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Import Failed", description: error.message || "Failed to import students" });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetState(); }}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="h-4 w-4 mr-2" />
          Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Students from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file with columns: <code>full_name, email, phone, class, section, stream</code>.
            Required: full_name, email.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              <FileUp className="h-4 w-4 mr-2" />
              Choose CSV File
            </Button>
            {parsedData.length > 0 && (
              <Badge variant="secondary">{parsedData.length} student(s) found</Badge>
            )}
          </div>

          {parseError && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {parseError}
            </div>
          )}

          {parsedData.length > 0 && !result && (
            <>
              <div className="flex items-center space-x-2">
                <Checkbox id="upsert-mode" checked={upsertMode} onCheckedChange={(checked) => setUpsertMode(checked === true)} />
                <Label htmlFor="upsert-mode" className="text-sm">
                  Update existing records (if email already exists, update class/section/stream instead of failing)
                </Label>
              </div>
              <ScrollArea className="max-h-64 border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Section</TableHead>
                      <TableHead>Stream</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.map((s, i) => (
                      <TableRow key={i}>
                        <TableCell>{s.full_name}</TableCell>
                        <TableCell>
                          {s.email}
                          {s._emailValid === false && <Badge variant="destructive" className="ml-1 text-[10px] px-1">invalid</Badge>}
                        </TableCell>
                        <TableCell>{s.phone || "-"}</TableCell>
                        <TableCell>{s.class || "-"}</TableCell>
                        <TableCell>{s.section || "-"}</TableCell>
                        <TableCell>{s.stream || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={resetState}>Cancel</Button>
                <Button onClick={handleImport} disabled={importing}>
                  {importing ? "Importing..." : `Import ${parsedData.length} Student(s)`}
                </Button>
              </div>
            </>
          )}

          {result && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>{result.created} created{result.updated > 0 ? `, ${result.updated} updated` : ""} successfully</span>
              </div>
              {result.failed > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    <span>{result.failed} failed</span>
                  </div>
                  {result.errors.map((err, i) => (
                    <p key={i} className="text-xs text-muted-foreground ml-6">{err}</p>
                  ))}
                </div>
              )}
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => { setOpen(false); resetState(); }}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
