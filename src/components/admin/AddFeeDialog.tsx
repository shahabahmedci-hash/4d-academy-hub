import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

interface AddFeeDialogProps {
  onFeeAdded: () => void;
}

interface Student {
  id: string;
  user_id: string | null;
  profiles?: { full_name: string };
}

const feeSchema = z.object({
  student_id: z.string().uuid({ message: "Please select a student" }),
  amount: z.number().positive({ message: "Amount must be greater than 0" }).max(999999),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Invalid date format" }),
  notes: z.string().max(500).optional(),
});

export const AddFeeDialog = ({ onFeeAdded }: AddFeeDialogProps) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({ student_id: "", amount: "", due_date: "", notes: "" });

  useEffect(() => {
    if (open) loadStudents();
  }, [open]);

  const loadStudents = async () => {
    try {
      const [studentsRes, teachersRes, rolesRes] = await Promise.all([
        supabase.from("students").select("id, user_id").order("enrollment_date", { ascending: false }),
        supabase.from("teachers").select("user_id"),
        supabase.from("user_roles").select("user_id").in("role", ["admin", "co_admin"]),
      ]);
      if (studentsRes.error) throw studentsRes.error;

      const teacherUserIds = new Set((teachersRes.data || []).map((t) => t.user_id));
      const adminUserIds = new Set((rolesRes.data || []).map((r) => r.user_id));
      const filtered = (studentsRes.data || []).filter(
        (s) => s.user_id && !teacherUserIds.has(s.user_id) && !adminUserIds.has(s.user_id)
      );

      const userIds = filtered.map((s) => s.user_id).filter(Boolean) as string[];
      let profilesById: Record<string, { full_name: string }> = {};
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase.from("profiles").select("id, full_name").in("id", userIds).eq("archived", false);
        profilesById = Object.fromEntries((profilesData || []).map((p) => [p.id, { full_name: p.full_name }]));
      }

      setStudents(
        filtered.filter((s) => s.user_id && profilesById[s.user_id]).map((s) => ({ ...s, profiles: profilesById[s.user_id!] }))
      );
    } catch (error) {
      console.error("Error loading students:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    try {
      const validation = feeSchema.safeParse({
        student_id: formData.student_id,
        amount: parseFloat(formData.amount),
        due_date: formData.due_date,
        notes: formData.notes,
      });

      if (!validation.success) {
        const fieldErrors: Record<string, string> = {};
        validation.error.errors.forEach((err) => {
          if (err.path[0]) fieldErrors[err.path[0].toString()] = err.message;
        });
        setErrors(fieldErrors);
        return;
      }

      const { error } = await supabase.from("fees").insert({
        student_id: formData.student_id,
        amount: parseFloat(formData.amount),
        due_date: formData.due_date,
        status: "pending",
        notes: formData.notes || null,
      });

      if (error) throw error;

      toast({ title: "Success", description: "Fee record added successfully" });
      setOpen(false);
      setFormData({ student_id: "", amount: "", due_date: "", notes: "" });
      onFeeAdded();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message || "Failed to add fee record" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Fee</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Fee Record</DialogTitle>
          <DialogDescription>Create a new fee record for a student</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Student *</Label>
            <Select value={formData.student_id} onValueChange={(value) => setFormData({ ...formData, student_id: value })}>
              <SelectTrigger className={errors.student_id ? "border-destructive" : ""}>
                <SelectValue placeholder="Select a student" />
              </SelectTrigger>
              <SelectContent>
                {students.map((student) => (
                  <SelectItem key={student.id} value={student.id}>
                    {student.profiles?.full_name || "Unknown Student"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.student_id && <p className="text-sm text-destructive">{errors.student_id}</p>}
          </div>
          <div className="space-y-2">
            <Label>Amount (₹) *</Label>
            <Input type="number" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} className={errors.amount ? "border-destructive" : ""} />
            {errors.amount && <p className="text-sm text-destructive">{errors.amount}</p>}
          </div>
          <div className="space-y-2">
            <Label>Due Date *</Label>
            <Input type="date" value={formData.due_date} onChange={(e) => setFormData({ ...formData, due_date: e.target.value })} className={errors.due_date ? "border-destructive" : ""} />
            {errors.due_date && <p className="text-sm text-destructive">{errors.due_date}</p>}
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Adding..." : "Add Fee Record"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
