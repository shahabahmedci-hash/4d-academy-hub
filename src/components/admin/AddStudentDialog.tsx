import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

interface AddStudentDialogProps {
  onStudentAdded: () => void;
}

const studentSchema = z.object({
  full_name: z.string().trim().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
  email: z.string().trim().email("Invalid email address").max(255, "Email must be less than 255 characters"),
  password: z.string().min(6, "Password must be at least 6 characters").max(72, "Password must be less than 72 characters"),
  phone: z.string().regex(/^[0-9]{10}$/, "Phone number must be exactly 10 digits").optional().or(z.literal("")),
  date_of_birth: z.string().optional(),
  address: z.string().trim().max(500, "Address must be less than 500 characters").optional().or(z.literal("")),
  emergency_contact_name: z.string().trim().max(100, "Emergency contact name must be less than 100 characters").optional().or(z.literal("")),
  emergency_contact_phone: z.string().regex(/^[0-9]{10}$/, "Emergency contact phone must be exactly 10 digits").optional().or(z.literal("")),
  student_class: z.string().optional(),
  student_section: z.string().optional(),
});

export const AddStudentDialog = ({ onStudentAdded }: AddStudentDialogProps) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    full_name: "",
    phone: "",
    date_of_birth: "",
    address: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
    student_class: "",
    student_section: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    // Validate input
    const validation = studentSchema.safeParse(formData);
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
      // Create auth user for student
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.full_name,
            role: "student",
          },
          emailRedirectTo: `${window.location.origin}/student/dashboard`,
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Failed to create user");

      // Create student record with class and section
      // The database trigger will auto-enroll the student in matching classes
      const { error: studentError } = await supabase
        .from("students")
        .insert({
          user_id: authData.user.id,
          date_of_birth: formData.date_of_birth || null,
          address: formData.address || null,
          emergency_contact_name: formData.emergency_contact_name || null,
          emergency_contact_phone: formData.emergency_contact_phone || null,
          class: formData.student_class || null,
          section: formData.student_section || null,
        });

      if (studentError) throw studentError;

      // Update profile with phone
      if (formData.phone) {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ phone: formData.phone })
          .eq("id", authData.user.id);

        if (profileError) throw profileError;
      }

      toast({
        title: "Success",
        description: "Student added successfully",
      });

      setOpen(false);
      setFormData({
        email: "",
        password: "",
        full_name: "",
        phone: "",
        date_of_birth: "",
        address: "",
        emergency_contact_name: "",
        emergency_contact_phone: "",
        student_class: "",
        student_section: "",
      });
      onStudentAdded();
    } catch (error: any) {
      console.error("Error adding student:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to add student",
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
          Add Student
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Student</DialogTitle>
          <DialogDescription>
            Create a new student account and profile
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
                onChange={(e) =>
                  setFormData({ ...formData, full_name: e.target.value })
                }
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
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
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
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
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
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '') })
                }
                className={errors.phone ? "border-destructive" : ""}
              />
              {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
            </div>
          </div>

          {/* Academic Information */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="student_class">Class</Label>
              <Input
                id="student_class"
                placeholder="e.g., 10, 11, 12"
                value={formData.student_class}
                onChange={(e) =>
                  setFormData({ ...formData, student_class: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">Student will be auto-enrolled in matching classes</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="student_section">Batch/Section</Label>
              <Input
                id="student_section"
                placeholder="e.g., A, B, Morning"
                value={formData.student_section}
                onChange={(e) =>
                  setFormData({ ...formData, student_section: e.target.value })
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="date_of_birth">Date of Birth</Label>
            <Input
              id="date_of_birth"
              type="date"
              value={formData.date_of_birth}
              onChange={(e) =>
                setFormData({ ...formData, date_of_birth: e.target.value })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Textarea
              id="address"
              value={formData.address}
              onChange={(e) =>
                setFormData({ ...formData, address: e.target.value })
              }
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
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    emergency_contact_name: e.target.value,
                  })
                }
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
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    emergency_contact_phone: e.target.value.replace(/\D/g, ''),
                  })
                }
                className={errors.emergency_contact_phone ? "border-destructive" : ""}
              />
              {errors.emergency_contact_phone && <p className="text-sm text-destructive">{errors.emergency_contact_phone}</p>}
            </div>
          </div>

          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Adding..." : "Add Student"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
