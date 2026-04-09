import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

interface AddStudentDialogProps {
  onStudentAdded: () => void;
}

const studentSchema = z.object({
  full_name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().email("Invalid email address").max(255),
  password: z.string().min(6, "Password must be at least 6 characters").max(72),
  phone: z.string().regex(/^[0-9]{10}$/, "Phone must be exactly 10 digits").optional().or(z.literal("")),
  date_of_birth: z.string().optional(),
  address: z.string().trim().max(500).optional().or(z.literal("")),
  emergency_contact_name: z.string().trim().max(100).optional().or(z.literal("")),
  emergency_contact_phone: z.string().regex(/^[0-9]{10}$/, "Must be exactly 10 digits").optional().or(z.literal("")),
  student_class: z.string().optional(),
  student_section: z.string().optional(),
});

export const AddStudentDialog = ({ onStudentAdded }: AddStudentDialogProps) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    email: "", password: "", full_name: "", phone: "",
    date_of_birth: "", address: "", emergency_contact_name: "",
    emergency_contact_phone: "", student_class: "", student_section: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    const validation = studentSchema.safeParse(formData);
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
          data: { full_name: formData.full_name, role: "student" },
          emailRedirectTo: `${window.location.origin}/student/dashboard`,
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Failed to create user");

      const { error: studentError } = await supabase.from("students").insert({
        user_id: authData.user.id,
        date_of_birth: formData.date_of_birth || null,
        address: formData.address || null,
        emergency_contact_name: formData.emergency_contact_name || null,
        emergency_contact_phone: formData.emergency_contact_phone || null,
        class: formData.student_class || null,
        section: formData.student_section || null,
      });

      if (studentError) throw studentError;

      if (formData.phone) {
        await supabase.from("profiles").update({ phone: formData.phone }).eq("id", authData.user.id);
      }

      toast({ title: "Success", description: "Student added successfully" });
      setOpen(false);
      setFormData({
        email: "", password: "", full_name: "", phone: "",
        date_of_birth: "", address: "", emergency_contact_name: "",
        emergency_contact_phone: "", student_class: "", student_section: "",
      });
      onStudentAdded();
    } catch (error: any) {
      console.error("Error adding student:", error);
      toast({ variant: "destructive", title: "Error", description: error.message || "Failed to add student" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Student</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Student</DialogTitle>
          <DialogDescription>Create a new student account and profile</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Full Name *</Label>
            <Input value={formData.full_name} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} className={errors.full_name ? "border-destructive" : ""} />
            {errors.full_name && <p className="text-sm text-destructive">{errors.full_name}</p>}
          </div>
          <div className="space-y-2">
            <Label>Email *</Label>
            <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className={errors.email ? "border-destructive" : ""} />
            {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
          </div>
          <div className="space-y-2">
            <Label>Password *</Label>
            <Input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} className={errors.password ? "border-destructive" : ""} />
            {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '') })} className={errors.phone ? "border-destructive" : ""} />
            {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Class</Label>
              <Input value={formData.student_class} onChange={(e) => setFormData({ ...formData, student_class: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Batch/Section</Label>
              <Input value={formData.student_section} onChange={(e) => setFormData({ ...formData, student_section: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Date of Birth</Label>
            <Input type="date" value={formData.date_of_birth} onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Address</Label>
            <Input value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Emergency Contact</Label>
              <Input value={formData.emergency_contact_name} onChange={(e) => setFormData({ ...formData, emergency_contact_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Emergency Phone</Label>
              <Input value={formData.emergency_contact_phone} onChange={(e) => setFormData({ ...formData, emergency_contact_phone: e.target.value.replace(/\D/g, '') })} />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Adding..." : "Add Student"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
