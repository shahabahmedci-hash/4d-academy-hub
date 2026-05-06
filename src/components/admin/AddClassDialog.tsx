import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

interface Teacher {
  id: string;
  user_id: string;
  employee_id: string | null;
  profile: {
    full_name: string;
  } | null;
}

interface AddClassDialogProps {
  onClassAdded: () => void;
}

const DAYS_OF_WEEK = [
  { value: "0", label: "Sunday" },
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
];

const classSchema = z.object({
  subject: z.string()
    .trim()
    .min(1, { message: "Subject is required" })
    .max(100, { message: "Subject must be less than 100 characters" }),
  day_of_week: z.string()
    .regex(/^[0-6]$/, { message: "Please select a valid day" }),
  start_time: z.string()
    .regex(/^\d{2}:\d{2}$/, { message: "Invalid time format" }),
  end_time: z.string()
    .regex(/^\d{2}:\d{2}$/, { message: "Invalid time format" }),
  room_location: z.string()
    .max(100, { message: "Location must be less than 100 characters" })
    .optional(),
  teacher_id: z.string().optional(),
  class: z.string()
    .max(50, { message: "Class must be less than 50 characters" })
    .optional(),
  section: z.string()
    .max(50, { message: "Section must be less than 50 characters" })
    .optional(),
}).refine((data) => data.start_time < data.end_time, {
  message: "End time must be after start time",
  path: ["end_time"],
});

export const AddClassDialog = ({ onClassAdded }: AddClassDialogProps) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [formData, setFormData] = useState({
    subject: "",
    day_of_week: "",
    start_time: "",
    end_time: "",
    room_location: "",
    teacher_id: "",
    class: "",
    section: "",
  });

  useEffect(() => {
    if (open) {
      loadTeachers();
    }
  }, [open]);

  const loadTeachers = async () => {
    const { data: teacherData } = await supabase
      .from("teachers")
      .select("id, user_id, employee_id");

    if (teacherData) {
      const userIds = teacherData.map(t => t.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);

      const teachersWithProfiles = teacherData.map(t => ({
        ...t,
        profile: profiles?.find(p => p.id === t.user_id) || null
      }));

      setTeachers(teachersWithProfiles);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    try {
      const validation = classSchema.safeParse(formData);

      if (!validation.success) {
        const fieldErrors: Record<string, string> = {};
        validation.error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0].toString()] = err.message;
          }
        });
        setErrors(fieldErrors);
        toast({
          variant: "destructive",
          title: "Validation Error",
          description: "Please check the form for errors",
        });
        return;
      }

      // Find selected teacher name
      const selectedTeacher = teachers.find(t => t.id === formData.teacher_id);
      const teacherName = selectedTeacher?.profile?.full_name || null;

      const { data: newClass, error } = await supabase.from("classes").insert({
        subject: formData.subject,
        day_of_week: parseInt(formData.day_of_week),
        start_time: formData.start_time,
        end_time: formData.end_time,
        room_location: formData.room_location || null,
        teacher_id: formData.teacher_id || null,
        teacher_name: teacherName,
        class: formData.class || null,
        section: formData.section || null,
      }).select().single();

      if (error) throw error;

      // Create teacher_classes entry if teacher is assigned
      if (formData.teacher_id && newClass) {
        await supabase.from("teacher_classes").insert({
          teacher_id: formData.teacher_id,
          class_id: newClass.id,
        });
      }

      toast({
        title: "Success",
        description: "Class added successfully",
      });

      setOpen(false);
      setFormData({
        subject: "",
        day_of_week: "",
        start_time: "",
        end_time: "",
        room_location: "",
        teacher_id: "",
        class: "",
        section: "",
      });
      onClassAdded();
    } catch (error: any) {
      console.error("Error adding class:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to add class",
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
          Add Class
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Class</DialogTitle>
          <DialogDescription>
            Create a new class schedule
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="subject">Subject *</Label>
            <Input
              id="subject"
              required
              value={formData.subject}
              onChange={(e) =>
                setFormData({ ...formData, subject: e.target.value })
              }
              placeholder="e.g., Mathematics, Science, English"
              className={errors.subject ? "border-destructive" : ""}
            />
            {errors.subject && (
              <p className="text-sm text-destructive">{errors.subject}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="day_of_week">Day of Week *</Label>
            <Select
              value={formData.day_of_week}
              onValueChange={(value) =>
                setFormData({ ...formData, day_of_week: value })
              }
              required
            >
              <SelectTrigger className={errors.day_of_week ? "border-destructive" : ""}>
                <SelectValue placeholder="Select a day" />
              </SelectTrigger>
              <SelectContent>
                {DAYS_OF_WEEK.map((day) => (
                  <SelectItem key={day.value} value={day.value}>
                    {day.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.day_of_week && (
              <p className="text-sm text-destructive">{errors.day_of_week}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_time">Start Time *</Label>
              <Input
                id="start_time"
                type="time"
                required
                value={formData.start_time}
                onChange={(e) =>
                  setFormData({ ...formData, start_time: e.target.value })
                }
                className={errors.start_time ? "border-destructive" : ""}
              />
              {errors.start_time && (
                <p className="text-sm text-destructive">{errors.start_time}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_time">End Time *</Label>
              <Input
                id="end_time"
                type="time"
                required
                value={formData.end_time}
                onChange={(e) =>
                  setFormData({ ...formData, end_time: e.target.value })
                }
                className={errors.end_time ? "border-destructive" : ""}
              />
              {errors.end_time && (
                <p className="text-sm text-destructive">{errors.end_time}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="room_location">Room/Location</Label>
            <Input
              id="room_location"
              value={formData.room_location}
              onChange={(e) =>
                setFormData({ ...formData, room_location: e.target.value })
              }
              placeholder="e.g., Room 101, Building A"
              className={errors.room_location ? "border-destructive" : ""}
            />
            {errors.room_location && (
              <p className="text-sm text-destructive">{errors.room_location}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="teacher_id">Assign Teacher</Label>
            <Select
              value={formData.teacher_id}
              onValueChange={(value) =>
                setFormData({ ...formData, teacher_id: value })
              }
            >
              <SelectTrigger className={errors.teacher_id ? "border-destructive" : ""}>
                <SelectValue placeholder="Select a teacher" />
              </SelectTrigger>
              <SelectContent>
                {teachers.map((teacher) => (
                  <SelectItem key={teacher.id} value={teacher.id}>
                    {teacher.profile?.full_name || "Unknown"} {teacher.employee_id ? `(${teacher.employee_id})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.teacher_id && (
              <p className="text-sm text-destructive">{errors.teacher_id}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="class">Class</Label>
              <Input
                id="class"
                value={formData.class}
                onChange={(e) =>
                  setFormData({ ...formData, class: e.target.value })
                }
                placeholder="e.g., 5, 10, 12"
                className={errors.class ? "border-destructive" : ""}
              />
              {errors.class && (
                <p className="text-sm text-destructive">{errors.class}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="section">Batch</Label>
              <Input
                id="section"
                value={formData.section}
                onChange={(e) =>
                  setFormData({ ...formData, section: e.target.value })
                }
                placeholder="e.g., A, XYZ"
                className={errors.section ? "border-destructive" : ""}
              />
              {errors.section && (
                <p className="text-sm text-destructive">{errors.section}</p>
              )}
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
              {loading ? "Adding..." : "Add Class"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
