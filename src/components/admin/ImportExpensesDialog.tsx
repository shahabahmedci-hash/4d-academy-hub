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
import { parseCSV, parseDateValue, parseNumericValue } from "@/lib/csvImport";

interface ParsedExpense {
  id?: string;
  description: string;
  category: string;
  amount: string;
  date: string;
}

const VALID_CATEGORIES = ["rent", "utilities", "supplies", "admin_personal", "marketing", "other"];

interface ImportExpensesDialogProps {
  onExpensesImported: () => void;
}

export const ImportExpensesDialog = ({ onExpensesImported }: ImportExpensesDialogProps) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedExpense[]>([]);
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
        if (!headers.includes("description") || !headers.includes("amount") || !headers.includes("category")) {
          setParseError("CSV must contain 'description', 'category', and 'amount' columns.");
          setParsedData([]);
          return;
        }
        const expenses: ParsedExpense[] = rows
          .filter((r) => r.description && r.amount && r.category)
          .map((r) => ({
            id: r.id || undefined,
            description: r.description,
            category: r.category.toLowerCase(),
            amount: r.amount,
            date: r.date || new Date().toISOString().split("T")[0],
          }));
        if (!expenses.length) {
          setParseError("No valid rows found.");
          setParsedData([]);
          return;
        }
        const invalid = expenses.filter((e) => !VALID_CATEGORIES.includes(e.category));
        if (invalid.length) {
          setParseError(`${invalid.length} row(s) have invalid categories. Valid: ${VALID_CATEGORIES.join(", ")}`);
          setParsedData([]);
          return;
        }
        setParsedData(expenses);
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      for (const exp of parsedData) {
        try {
          const amount = parseNumericValue(exp.amount);
          if (amount <= 0) { errors.push(`"${exp.description}": invalid amount`); failed++; continue; }

          const parsedDate = parseDateValue(exp.date);
          if (!parsedDate) { errors.push(`"${exp.description}": invalid date "${exp.date}"`); failed++; continue; }

          let existing: { id: string } | null = null;
          if (exp.id) {
            const { data } = await supabase.from("expenses").select("id").eq("id", exp.id).maybeSingle();
            existing = data;
          }
          if (!existing) {
            const { data } = await supabase.from("expenses").select("id").eq("description", exp.description).eq("date", parsedDate).eq("category", exp.category as any).maybeSingle();
            existing = data;
          }

          if (existing) {
            if (!upsertMode) {
              errors.push(`"${exp.description}"/${exp.date}: duplicate (enable upsert to update)`);
              failed++;
              continue;
            }
            const { error } = await supabase.from("expenses").update({
              amount,
              description: exp.description,
              category: exp.category as any,
              date: parsedDate,
            }).eq("id", existing.id);
            if (error) { errors.push(`"${exp.description}": ${error.message}`); failed++; }
            else updated++;
          } else {
            const { error } = await supabase.from("expenses").insert({
              description: exp.description,
              category: exp.category as any,
              amount,
              date: parsedDate,
              created_by: user.id,
            });
            if (error) { errors.push(`"${exp.description}": ${error.message}`); failed++; }
            else created++;
          }
        } catch (err: any) {
          errors.push(`"${exp.description}": ${err.message}`); failed++;
        }
      }

      setResult({ created, updated, failed, errors });
      if (created + updated > 0) {
        const parts = [];
        if (created > 0) parts.push(`${created} created`);
        if (updated > 0) parts.push(`${updated} updated`);
        if (failed > 0) parts.push(`${failed} failed`);
        toast({ title: "Import Complete", description: parts.join(", ") + "." });
        onExpensesImported();
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
        <Button variant="outline">
          <Upload className="h-4 w-4 mr-2" />
          Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Expenses from CSV</DialogTitle>
          <DialogDescription>
            CSV columns: <code>description, category, amount, date</code>.
            Valid categories: {VALID_CATEGORIES.join(", ")}. Dates: <code>DD/MM/YYYY</code>, <code>MM/DD/YYYY</code>, or <code>YYYY-MM-DD</code>.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              <FileUp className="h-4 w-4 mr-2" /> Choose CSV File
            </Button>
            {parsedData.length > 0 && <Badge variant="secondary">{parsedData.length} expense(s) found</Badge>}
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="upsert-expenses" checked={upsertMode} onCheckedChange={(v) => setUpsertMode(!!v)} />
            <Label htmlFor="upsert-expenses" className="text-sm cursor-pointer">
              <RefreshCw className="h-3 w-3 inline mr-1" />
              Update existing records (if same description + date + category found, update instead of failing)
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
                      <TableHead>Description</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.map((e, i) => (
                      <TableRow key={i}>
                        <TableCell>{e.description}</TableCell>
                        <TableCell>{e.category}</TableCell>
                        <TableCell>{e.amount}</TableCell>
                        <TableCell>{e.date}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={resetState}>Cancel</Button>
                <Button onClick={handleImport} disabled={importing}>
                  {importing ? "Importing..." : `Import ${parsedData.length} Expense(s)`}
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
