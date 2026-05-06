import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

interface AddTeacherDialogProps {
  onTeacherAdded: () => void;
}

const teacherSchema = z.object({
  full_name: z.string().trim().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
  email: z.string().trim().email("Invalid email address").max(255, "Email must be less than 255 characters"),
  password: z.string().min(6, "Password must be at least 6 characters").max(72, "Password must be less than 72 characters"),
  phone: z.string().regex(/^[0-9]{10}$/, "Phone number must be exactly 10 digits").optional().or(z.literal("")),
  employee_id: z.string().max(50, "Employee ID must be less than 50 characters").optional().or(z.literal("")),
  designation: z.string().max(100, "Designation must be less than 100 characters").optional().or(z.literal("")),
  joining_date: z.string().optional(),
  address: z.string().trim().max(500, "Address must be less than 500 characters").optional().or(z.literal("")),
  emergency_contact_name: z.string().trim().max(100).optional().or(z.literal("")),
  emergency_contact_phone: z.string().regex(/^[0-9]{10}$/, "Emergency contact phone must be exactly 10 digits").optional().or(z.literal("")),
});

export const AddTeacherDialog = ({ onTeacherAdded }: AddTeacherDialogProps) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [subjects, setSubjects] = useState<string[]>([]);
  const [subjectInput, setSubjectInput] = useState("");
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    full_name: "",
    phone: "",
    employee_id: "",
    designation: "",
    joining_date: "",
    address: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
  });

  const addSubject = () => {
    const trimmed = subjectInput.trim();
    if (trimmed && !subjects.includes(trimmed)) {
      setSubjects([...subjects, trimmed]);
      setSubjectInput("");
    }
  };

  const removeSubject = (subject: string) => {
    setSubjects(subjects.filter(s => s !== subject));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addSubject();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    const validation = teacherSchema.safeParse(formData);
    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      validation.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      setLoading(false);
      toast({
        title: "Validation Error",
        description: "Please check the form for errors.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Create auth user for teacher
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.full_name,
            role: "teacher",
          },
          emailRedirectTo: `${window.location.origin}/teacher/dashboard`,
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Failed to create user");

      // Create teacher record
      const { error: teacherError } = await supabase
        .from("teachers")
        .insert({
          user_id: authData.user.id,
          employee_id: formData.employee_id || null,
          designation: formData.designation || "Teacher",
          joining_date: formData.joining_date || new Date().toISOString().split("T")[0],
          subjects: subjects.length > 0 ? subjects : null,
          emergency_contact_name: formData.emergency_contact_name || null,
          emergency_contact_phone: formData.emergency_contact_phone || null,
        });

      if (teacherError) throw teacherError;

      // Update profile with phone and address
      const profileUpdates: Record<string, string> = {};
      if (formData.phone) profileUpdates.phone = formData.phone;
      if (formData.address) profileUpdates.address = formData.address;

      if (Object.keys(profileUpdates).length > 0) {
        const { error: profileError } = await supabase
          .from("profiles")
          .update(profileUpdates)
          .eq("id", authData.user.id);

        if (profileError) throw profileError;
      }

      toast({
        title: "Success",
        description: "Teacher added successfully",
      });

      setOpen(false);
      setFormData({
        email: "",
        password: "",
        full_name: "",
        phone: "",
        employee_id: "",
        designation: "",
        joining_date: "",
        address: "",
        emergency_contact_name: "",
        emergency_contact_phone: "",
      });
      setSubjects([]);
      onTeacherAdded();
    } catch (error: any) {
      console.error("Error adding teacher:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to add teacher",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Teacher
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Teacher</DialogTitle>
          <DialogDescription>
            Create a new teacher account and profile
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name *</Label>
              <Input
                id="full_name"
                required
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className={errors.full_name ? "border-destructive" : ""}
              />
              {errors.full_name && <p className="text-sm text-destructive">{errors.full_name}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className={errors.email ? "border-destructive" : ""}
              />
              {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="password">Password *</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className={errors.password ? "border-destructive" : ""}
              />
              {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="e.g., 9876543210"
                maxLength={10}
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '') })}
                className={errors.phone ? "border-destructive" : ""}
              />
              {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="employee_id">Employee ID</Label>
              <Input
                id="employee_id"
                placeholder="e.g., EMP001"
                value={formData.employee_id}
                onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                className={errors.employee_id ? "border-destructive" : ""}
              />
              {errors.employee_id && <p className="text-sm text-destructive">{errors.employee_id}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="designation">Designation</Label>
              <Input
                id="designation"
                placeholder="e.g., Senior Teacher, HOD"
                value={formData.designation}
                onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                className={errors.designation ? "border-destructive" : ""}
              />
              {errors.designation && <p className="text-sm text-destructive">{errors.designation}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="joining_date">Joining Date</Label>
            <Input
              id="joining_date"
              type="date"
              value={formData.joining_date}
              onChange={(e) => setFormData({ ...formData, joining_date: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="subjects">Subjects</Label>
            <div className="flex gap-2">
              <Input
                id="subjects"
                placeholder="Type subject and press Enter"
                value={subjectInput}
                onChange={(e) => setSubjectInput(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <Button type="button" variant="outline" onClick={addSubject}>Add</Button>
            </div>
            {subjects.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {subjects.map((subject) => (
                  <Badge key={subject} variant="secondary" className="gap-1">
                    {subject}
                    <button type="button" onClick={() => removeSubject(subject)} className="ml-1 hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Textarea
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className={errors.address ? "border-destructive" : ""}
            />
            {errors.address && <p className="text-sm text-destructive">{errors.address}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="emergency_contact_name">Emergency Contact Name</Label>
              <Input
                id="emergency_contact_name"
                value={formData.emergency_contact_name}
                onChange={(e) => setFormData({ ...formData, emergency_contact_name: e.target.value })}
                className={errors.emergency_contact_name ? "border-destructive" : ""}
              />
              {errors.emergency_contact_name && <p className="text-sm text-destructive">{errors.emergency_contact_name}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="emergency_contact_phone">Emergency Contact Phone</Label>
              <Input
                id="emergency_contact_phone"
                type="tel"
                placeholder="e.g., 9876543210"
                maxLength={10}
                value={formData.emergency_contact_phone}
                onChange={(e) => setFormData({ ...formData, emergency_contact_phone: e.target.value.replace(/\D/g, '') })}
                className={errors.emergency_contact_phone ? "border-destructive" : ""}
              />
              {errors.emergency_contact_phone && <p className="text-sm text-destructive">{errors.emergency_contact_phone}</p>}
            </div>
          </div>

          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Adding..." : "Add Teacher"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
