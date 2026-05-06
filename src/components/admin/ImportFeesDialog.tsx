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
import { parseCSV, parseDateValue, parseNumericValue, isValidEmail } from "@/lib/csvImport";

interface ParsedFee {
  id?: string;
  student_email: string;
  amount: string;
  due_date: string;
  status?: string;
  payment_method?: string;
  notes?: string;
  _emailValid?: boolean;
}

interface ImportFeesDialogProps {
  onFeesImported: () => void;
}

export const ImportFeesDialog = ({ onFeesImported }: ImportFeesDialogProps) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedFee[]>([]);
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
        if (!headers.includes("student_email") || !headers.includes("amount") || !headers.includes("due_date")) {
          setParseError("CSV must contain 'student_email', 'amount', and 'due_date' columns.");
          setParsedData([]);
          return;
        }
        const fees: ParsedFee[] = rows
          .filter((r) => r.student_email && r.amount && r.due_date)
          .map((r) => ({
            id: r.id || undefined,
            student_email: r.student_email,
            amount: r.amount,
            due_date: r.due_date,
            status: r.status || undefined,
            payment_method: r.payment_method || undefined,
            notes: r.notes || undefined,
            _emailValid: isValidEmail(r.student_email),
          }));
        if (!fees.length) {
          setParseError("No valid rows found. Ensure 'student_email', 'amount', and 'due_date' are filled.");
          setParsedData([]);
          return;
        }
        setParsedData(fees);
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
    let created = 0, updated = 0, failed = 0;
    const errors: string[] = [];

    try {
      // Validate emails first
      for (const fee of parsedData) {
        if (!isValidEmail(fee.student_email)) {
          errors.push(`${fee.student_email}: invalid email format`);
          failed++;
        }
      }
      const validFees = parsedData.filter((f) => isValidEmail(f.student_email));

      const emails = [...new Set(validFees.map((f) => f.student_email))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email")
        .in("email", emails);

      const emailToUserId = Object.fromEntries((profiles || []).map((p) => [p.email, p.id]));

      const { data: students } = await supabase
        .from("students")
        .select("id, user_id")
        .in("user_id", Object.values(emailToUserId));

      const userIdToStudentId = Object.fromEntries((students || []).map((s) => [s.user_id!, s.id]));

      const VALID_STATUSES = ["paid", "pending", "overdue"];

      for (const fee of validFees) {
        try {
          const userId = emailToUserId[fee.student_email];
          if (!userId) { errors.push(`${fee.student_email}: student not found`); failed++; continue; }
          const studentId = userIdToStudentId[userId];
          if (!studentId) { errors.push(`${fee.student_email}: student record not found`); failed++; continue; }

          const amount = parseNumericValue(fee.amount);
          if (amount <= 0) { errors.push(`${fee.student_email}: invalid amount`); failed++; continue; }

          const parsedDueDate = parseDateValue(fee.due_date);
          if (!parsedDueDate) { errors.push(`${fee.student_email}: invalid date "${fee.due_date}"`); failed++; continue; }

          const normalizedStatus = fee.status?.toLowerCase();
          const status = normalizedStatus && VALID_STATUSES.includes(normalizedStatus) ? normalizedStatus : "pending";

          // Prefer id-based lookup if available (from exported CSV), fallback to composite key
          let existing: { id: string } | null = null;
          if (fee.id) {
            const { data } = await supabase.from("fees").select("id").eq("id", fee.id).maybeSingle();
            existing = data;
          }
          if (!existing) {
            const { data } = await supabase.from("fees").select("id").eq("student_id", studentId).eq("due_date", parsedDueDate).maybeSingle();
            existing = data;
          }

          if (existing) {
            if (!upsertMode) {
              errors.push(`${fee.student_email}/${parsedDueDate}: duplicate (enable upsert to update)`);
              failed++;
              continue;
            }
            const { error } = await supabase.from("fees").update({
              amount,
              due_date: parsedDueDate,
              status: status as any,
              payment_method: fee.payment_method || null,
              notes: fee.notes || null,
              paid_date: status === "paid" ? new Date().toISOString().split("T")[0] : null,
            }).eq("id", existing.id);

            if (error) { errors.push(`${fee.student_email}/${parsedDueDate}: ${error.message}`); failed++; }
            else updated++;
          } else {
            const { error } = await supabase.from("fees").insert({
              student_id: studentId,
              amount,
              due_date: parsedDueDate,
              status: status as any,
              payment_method: fee.payment_method || null,
              notes: fee.notes || null,
              paid_date: status === "paid" ? new Date().toISOString().split("T")[0] : null,
            });

            if (error) { errors.push(`${fee.student_email}/${parsedDueDate}: ${error.message}`); failed++; }
            else created++;
          }
        } catch (err: any) {
          errors.push(`${fee.student_email}: ${err.message}`); failed++;
        }
      }

      setResult({ created, updated, failed, errors });
      if (created + updated > 0) {
        const parts = [];
        if (created > 0) parts.push(`${created} created`);
        if (updated > 0) parts.push(`${updated} updated`);
        if (failed > 0) parts.push(`${failed} failed`);
        toast({ title: "Import Complete", description: parts.join(", ") + "." });
        onFeesImported();
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Import Failed", description: error.message });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetState(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="h-4 w-4 mr-2" />
          Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Fees from CSV</DialogTitle>
          <DialogDescription>
            CSV columns: <code>student_email, amount, due_date, status, payment_method, notes</code>.
            Required: student_email, amount, due_date. Dates: <code>DD/MM/YYYY</code>, <code>MM/DD/YYYY</code>, or <code>YYYY-MM-DD</code>.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              <FileUp className="h-4 w-4 mr-2" /> Choose CSV File
            </Button>
            {parsedData.length > 0 && <Badge variant="secondary">{parsedData.length} fee(s) found</Badge>}
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="upsert-fees" checked={upsertMode} onCheckedChange={(v) => setUpsertMode(!!v)} />
            <Label htmlFor="upsert-fees" className="text-sm cursor-pointer">
              <RefreshCw className="h-3 w-3 inline mr-1" />
              Update existing records (if same student + due date found, update instead of failing)
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
                      <TableHead>Email</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.map((f, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          {f.student_email}
                          {f._emailValid === false && <Badge variant="destructive" className="ml-1 text-[10px] px-1">invalid</Badge>}
                        </TableCell>
                        <TableCell>{f.amount}</TableCell>
                        <TableCell>{f.due_date}</TableCell>
                        <TableCell>{f.status || "pending"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={resetState}>Cancel</Button>
                <Button onClick={handleImport} disabled={importing}>
                  {importing ? "Importing..." : `Import ${parsedData.length} Fee(s)`}
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
