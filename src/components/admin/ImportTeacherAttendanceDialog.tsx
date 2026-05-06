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
import { parseCSV, parseDateValue, isValidEmail } from "@/lib/csvImport";

interface ParsedRecord {
  id?: string;
  teacher_email: string;
  class_subject: string;
  date: string;
  status: string;
  _emailValid?: boolean;
}

interface Props {
  onImported: () => void;
}

export const ImportTeacherAttendanceDialog = ({ onImported }: Props) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedRecord[]>([]);
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
        const required = ["teacher_email", "class_subject", "date", "status"];
        const missing = required.filter((h) => !headers.includes(h));
        if (missing.length) {
          setParseError(`CSV must contain columns: ${required.join(", ")}. Missing: ${missing.join(", ")}`);
          setParsedData([]);
          return;
        }
        const VALID_STATUSES = ["present", "absent"];
        const records: ParsedRecord[] = rows
          .filter((r) => r.teacher_email && r.class_subject && r.date && r.status)
          .map((r) => ({
            id: r.id || undefined,
            teacher_email: r.teacher_email,
            class_subject: r.class_subject,
            date: r.date,
            status: r.status.toLowerCase(),
            _emailValid: isValidEmail(r.teacher_email),
          }));

        const invalid = records.filter((r) => !VALID_STATUSES.includes(r.status));
        if (invalid.length) {
          setParseError(`Invalid status values. Must be: present or absent. Found: ${[...new Set(invalid.map((r) => r.status))].join(", ")}`);
          setParsedData([]);
          return;
        }

        if (!records.length) {
          setParseError("No valid rows found.");
          setParsedData([]);
          return;
        }
        setParsedData(records);
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

      // Validate emails first
      for (const record of parsedData) {
        if (!isValidEmail(record.teacher_email)) {
          errors.push(`${record.teacher_email}: invalid email format`);
          failed++;
        }
      }
      const validRecords = parsedData.filter((r) => isValidEmail(r.teacher_email));

      const emails = [...new Set(validRecords.map((r) => r.teacher_email))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email")
        .in("email", emails);

      const emailToUserId = Object.fromEntries((profiles || []).map((p) => [p.email, p.id]));

      const { data: teachers } = await supabase
        .from("teachers")
        .select("id, user_id")
        .in("user_id", Object.values(emailToUserId));

      const userIdToTeacherId = Object.fromEntries((teachers || []).map((t) => [t.user_id, t.id]));

      const subjects = [...new Set(validRecords.map((r) => r.class_subject))];
      const { data: classes } = await supabase
        .from("classes")
        .select("id, subject")
        .in("subject", subjects);

      const subjectToClassId = Object.fromEntries((classes || []).map((c) => [c.subject, c.id]));

      for (const record of validRecords) {
        try {
          const userId = emailToUserId[record.teacher_email];
          if (!userId) { errors.push(`${record.teacher_email}/${record.date}: teacher not found`); failed++; continue; }
          const teacherId = userIdToTeacherId[userId];
          if (!teacherId) { errors.push(`${record.teacher_email}/${record.date}: teacher record not found`); failed++; continue; }
          const classId = subjectToClassId[record.class_subject];
          if (!classId) { errors.push(`${record.teacher_email}/${record.date}: class '${record.class_subject}' not found`); failed++; continue; }

          const parsedDate = parseDateValue(record.date);
          if (!parsedDate) { errors.push(`${record.teacher_email}: invalid date "${record.date}"`); failed++; continue; }

          let existing: { id: string } | null = null;
          if (record.id) {
            const { data } = await supabase.from("teacher_attendance").select("id").eq("id", record.id).maybeSingle();
            existing = data;
          }
          if (!existing) {
            const { data } = await supabase.from("teacher_attendance").select("id").eq("teacher_id", teacherId).eq("class_id", classId).eq("date", parsedDate).maybeSingle();
            existing = data;
          }

          if (existing) {
            if (!upsertMode) {
              errors.push(`${record.teacher_email}/${record.date}: duplicate`);
              failed++;
              continue;
            }
            const { error } = await supabase.from("teacher_attendance").update({
              date: parsedDate,
              status: record.status,
              marked_by: user?.id,
            }).eq("id", existing.id);

            if (error) { errors.push(`${record.teacher_email}/${record.date}: ${error.message}`); failed++; }
            else updated++;
          } else {
            const { error } = await supabase.from("teacher_attendance").insert({
              teacher_id: teacherId,
              class_id: classId,
              date: parsedDate,
              status: record.status,
              marked_by: user?.id,
            });

            if (error) { errors.push(`${record.teacher_email}/${record.date}: ${error.message}`); failed++; }
            else created++;
          }
        } catch (err: any) {
          errors.push(`${record.teacher_email}/${record.date}: ${err.message}`); failed++;
        }
      }

      setResult({ created, updated, failed, errors });
      if (created + updated > 0) {
        const parts = [];
        if (created > 0) parts.push(`${created} created`);
        if (updated > 0) parts.push(`${updated} updated`);
        if (failed > 0) parts.push(`${failed} failed`);
        toast({ title: "Import Complete", description: parts.join(", ") + "." });
        onImported();
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
          <DialogTitle>Import Teacher Attendance from CSV</DialogTitle>
          <DialogDescription>
            CSV columns: <code>teacher_email, class_subject, date, status</code>.
            Status must be: present or absent. Dates: <code>DD/MM/YYYY</code>, <code>MM/DD/YYYY</code>, or <code>YYYY-MM-DD</code>.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              <FileUp className="h-4 w-4 mr-2" /> Choose CSV File
            </Button>
            {parsedData.length > 0 && <Badge variant="secondary">{parsedData.length} record(s) found</Badge>}
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="upsert-teacher-att" checked={upsertMode} onCheckedChange={(v) => setUpsertMode(!!v)} />
            <Label htmlFor="upsert-teacher-att" className="text-sm cursor-pointer">
              <RefreshCw className="h-3 w-3 inline mr-1" />
              Update existing records (if same teacher + class + date found)
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
                      <TableHead>Class</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          {r.teacher_email}
                          {r._emailValid === false && <Badge variant="destructive" className="ml-1 text-[10px] px-1">invalid</Badge>}
                        </TableCell>
                        <TableCell>{r.class_subject}</TableCell>
                        <TableCell>{r.date}</TableCell>
                        <TableCell>{r.status}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={resetState}>Cancel</Button>
                <Button onClick={handleImport} disabled={importing}>
                  {importing ? "Importing..." : `Import ${parsedData.length} Record(s)`}
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
