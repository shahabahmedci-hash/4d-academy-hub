import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Upload, FileUp, AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { parseCSV, isValidEmail } from "@/lib/csvImport";

interface ParsedTeacher {
  full_name: string;
  email: string;
  phone?: string;
  designation?: string;
  subjects?: string;
  _emailValid?: boolean;
}

interface ImportTeachersDialogProps {
  onTeachersImported: () => void;
}

export const ImportTeachersDialog = ({ onTeachersImported }: ImportTeachersDialogProps) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedTeacher[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ created: number; updated: number; failed: number; errors: string[] } | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [upsertMode, setUpsertMode] = useState(true);

  const resetState = () => {
    setParsedData([]);
    setResult(null);
    setParseError(null);
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
        const { headers, rows } = parseCSV(event.target?.result as string);
        if (!headers.includes("full_name") || !headers.includes("email")) {
          setParseError("CSV must contain at least 'full_name' and 'email' columns.");
          setParsedData([]);
          return;
        }
        const teachers: ParsedTeacher[] = rows
          .filter((r) => r.full_name && r.email)
          .map((r) => ({
            full_name: r.full_name,
            email: r.email,
            phone: r.phone || undefined,
            designation: r.designation || undefined,
            subjects: r.subjects || undefined,
            _emailValid: isValidEmail(r.email),
          }));
        if (!teachers.length) {
          setParseError("No valid rows found.");
          setParsedData([]);
          return;
        }
        setParsedData(teachers);
      } catch {
        setParseError("Failed to parse CSV file.");
        setParsedData([]);
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!parsedData.length) return;
    setImporting(true);

    try {
      // Filter out invalid emails
      const invalidEmails = parsedData.filter((t) => !isValidEmail(t.email));
      const validTeachers = parsedData.filter((t) => isValidEmail(t.email));

      if (invalidEmails.length > 0 && validTeachers.length === 0) {
        setResult({
          created: 0,
          updated: 0,
          failed: invalidEmails.length,
          errors: invalidEmails.map((t) => `${t.email}: invalid email format`),
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke("import-teachers", {
        body: { teachers: validTeachers.map(({ _emailValid, ...rest }) => rest), mode: upsertMode ? "upsert" : "add" },
      });
      if (error) throw error;

      const errors = [
        ...invalidEmails.map((t) => `${t.email}: invalid email format`),
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
        toast({ title: "Import Complete", description: parts.join(", ") + "." });
        onTeachersImported();
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Import Failed", description: error.message || "Failed to import teachers" });
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
          <DialogTitle>Import Teachers from CSV</DialogTitle>
          <DialogDescription>
            CSV columns: <code>full_name, email, phone, designation, subjects</code>.
            Required: full_name, email. Subjects separated by semicolons.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              <FileUp className="h-4 w-4 mr-2" /> Choose CSV File
            </Button>
            {parsedData.length > 0 && <Badge variant="secondary">{parsedData.length} teacher(s) found</Badge>}
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="upsert-teachers" checked={upsertMode} onCheckedChange={(v) => setUpsertMode(!!v)} />
            <Label htmlFor="upsert-teachers" className="text-sm cursor-pointer">
              <RefreshCw className="h-3 w-3 inline mr-1" />
              Update existing records (if duplicate email found, update instead of failing)
            </Label>
          </div>
          {parseError && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />{parseError}
            </div>
          )}
          {parsedData.length > 0 && !result && (
            <>
              <ScrollArea className="max-h-64 border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Designation</TableHead>
                      <TableHead>Subjects</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.map((t, i) => (
                      <TableRow key={i}>
                        <TableCell>{t.full_name}</TableCell>
                        <TableCell>
                          {t.email}
                          {t._emailValid === false && <Badge variant="destructive" className="ml-1 text-[10px] px-1">invalid</Badge>}
                        </TableCell>
                        <TableCell>{t.phone || "-"}</TableCell>
                        <TableCell>{t.designation || "-"}</TableCell>
                        <TableCell>{t.subjects || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={resetState}>Cancel</Button>
                <Button onClick={handleImport} disabled={importing}>
                  {importing ? "Importing..." : `Import ${parsedData.length} Teacher(s)`}
                </Button>
              </div>
            </>
          )}
          {result && (
            <div className="space-y-3">
              {result.created > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span>{result.created} created successfully</span>
                </div>
              )}
              {result.updated > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <RefreshCw className="h-4 w-4 text-blue-500" />
                  <span>{result.updated} updated successfully</span>
                </div>
              )}
              {result.failed > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4" /><span>{result.failed} failed</span>
                  </div>
                  {result.errors.map((err, i) => (
                    <p key={i} className="text-xs text-muted-foreground ml-6">{err}</p>
                  ))}
                </div>
              )}
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => { setOpen(false); resetState(); }}>Close</Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
