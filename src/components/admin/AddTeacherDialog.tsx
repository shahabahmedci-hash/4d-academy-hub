import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

interface AddTeacherDialogProps {
  onTeacherAdded: () => void;
}

const teacherSchema = z.object({
  full_name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().email("Invalid email").max(255),
  password: z.string().min(6, "Min 6 characters").max(72),
  phone: z.string().regex(/^[0-9]{10}$/, "Must be 10 digits").optional().or(z.literal("")),
  employee_id: z.string().max(50).optional().or(z.literal("")),
  designation: z.string().max(100).optional().or(z.literal("")),
  joining_date: z.string().optional(),
  address: z.string().trim().max(500).optional().or(z.literal("")),
  emergency_contact_name: z.string().trim().max(100).optional().or(z.literal("")),
  emergency_contact_phone: z.string().regex(/^[0-9]{10}$/, "Must be 10 digits").optional().or(z.literal("")),
});

export const AddTeacherDialog = ({ onTeacherAdded }: AddTeacherDialogProps) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [subjects, setSubjects] = useState<string[]>([]);
  const [subjectInput, setSubjectInput] = useState("");
  const [formData, setFormData] = useState({
    email: "", password: "", full_name: "", phone: "", employee_id: "",
    designation: "", joining_date: "", address: "", emergency_contact_name: "", emergency_contact_phone: "",
  });

  const addSubject = () => {
    const trimmed = subjectInput.trim();
    if (trimmed && !subjects.includes(trimmed)) {
      setSubjects([...subjects, trimmed]);
      setSubjectInput("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); addSubject(); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    const validation = teacherSchema.safeParse(formData);
    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      validation.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      setLoading(false);
      return;
    }

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: { full_name: formData.full_name, role: "teacher" },
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Failed to create user");

      const { error: teacherError } = await supabase.from("teachers").insert({
        user_id: authData.user.id,
        employee_id: formData.employee_id || null,
        designation: formData.designation || "Teacher",
        joining_date: formData.joining_date || new Date().toISOString().split("T")[0],
        subjects: subjects.length > 0 ? subjects : null,
        emergency_contact_name: formData.emergency_contact_name || null,
        emergency_contact_phone: formData.emergency_contact_phone || null,
      });

      if (teacherError) throw teacherError;

      const profileUpdates: Record<string, string> = {};
      if (formData.phone) profileUpdates.phone = formData.phone;
      if (formData.address) profileUpdates.address = formData.address;

      if (Object.keys(profileUpdates).length > 0) {
        await supabase.from("profiles").update(profileUpdates).eq("id", authData.user.id);
      }

      toast({ title: "Success", description: "Teacher added successfully" });
      setOpen(false);
      setFormData({ email: "", password: "", full_name: "", phone: "", employee_id: "", designation: "", joining_date: "", address: "", emergency_contact_name: "", emergency_contact_phone: "" });
      setSubjects([]);
      onTeacherAdded();
    } catch (error: any) {
      console.error("Error adding teacher:", error);
      toast({ variant: "destructive", title: "Error", description: error.message || "Failed to add teacher" });
    } finally {
      setLoading(false);
    }
  };

  const field = (label: string, key: string, type = "text", required = false) => (
    <div className="space-y-1">
      <Label>{label}{required && " *"}</Label>
      <Input
        type={type}
        value={(formData as any)[key]}
        onChange={(e) => setFormData({ ...formData, [key]: key === "phone" || key === "emergency_contact_phone" ? e.target.value.replace(/\D/g, '') : e.target.value })}
        className={errors[key] ? "border-destructive" : ""}
      />
      {errors[key] && <p className="text-xs text-destructive">{errors[key]}</p>}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Teacher</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Teacher</DialogTitle>
          <DialogDescription>Create a new teacher account and profile</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          {field("Full Name", "full_name", "text", true)}
          {field("Email", "email", "email", true)}
          {field("Password", "password", "password", true)}
          {field("Phone", "phone", "tel")}
          {field("Employee ID", "employee_id")}
          {field("Designation", "designation")}
          {field("Joining Date", "joining_date", "date")}
          {field("Address", "address")}
          {field("Emergency Contact Name", "emergency_contact_name")}
          {field("Emergency Contact Phone", "emergency_contact_phone", "tel")}

          <div className="space-y-1">
            <Label>Subjects</Label>
            <div className="flex gap-2">
              <Input value={subjectInput} onChange={(e) => setSubjectInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="Add subject" />
              <Button type="button" variant="outline" size="sm" onClick={addSubject}>Add</Button>
            </div>
            {subjects.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {subjects.map((subject) => (
                  <Badge key={subject} variant="secondary">
                    {subject}
                    <button type="button" onClick={() => setSubjects(subjects.filter(s => s !== subject))} className="ml-1 hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Adding..." : "Add Teacher"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
