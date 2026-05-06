import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Trash2 } from "lucide-react";
import { z } from "zod";

interface Teacher {
  id: string;
  user_id: string;
  employee_id: string | null;
  profile: {
    full_name: string;
  } | null;
}

interface Class {
  id: string;
  subject: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room_location: string | null;
  teacher_id: string | null;
  teacher_name: string | null;
  class: string | null;
  section: string | null;
}

interface EditClassDialogProps {
  classData: Class;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClassUpdated: () => void;
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
  subject: z.string().min(1, "Subject is required").max(100, "Subject must be less than 100 characters"),
  day_of_week: z.string().min(1, "Day is required"),
  start_time: z.string().min(1, "Start time is required"),
  end_time: z.string().min(1, "End time is required"),
  room_location: z.string().max(100, "Room location must be less than 100 characters").optional(),
  teacher_id: z.string().optional(),
  class: z.string().max(50, "Class must be less than 50 characters").optional(),
  section: z.string().max(50, "Section must be less than 50 characters").optional(),
}).refine((data) => {
  if (data.start_time && data.end_time) {
    return data.start_time < data.end_time;
  }
  return true;
}, {
  message: "End time must be after start time",
  path: ["end_time"],
});

export const EditClassDialog = ({ classData, open, onOpenChange, onClassUpdated }: EditClassDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
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

  useEffect(() => {
    if (classData && open) {
      setFormData({
        subject: classData.subject,
        day_of_week: String(classData.day_of_week),
        start_time: classData.start_time,
        end_time: classData.end_time,
        room_location: classData.room_location || "",
        teacher_id: classData.teacher_id || "",
        class: classData.class || "",
        section: classData.section || "",
      });
      setErrors({});
    }
  }, [classData, open]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = classSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);
    try {
      const oldTeacherId = classData.teacher_id;
      const newTeacherId = formData.teacher_id || null;

      // Find selected teacher name
      const selectedTeacher = teachers.find(t => t.id === formData.teacher_id);
      const teacherName = selectedTeacher?.profile?.full_name || null;

      const { error } = await supabase
        .from("classes")
        .update({
          subject: formData.subject.trim(),
          day_of_week: parseInt(formData.day_of_week),
          start_time: formData.start_time,
          end_time: formData.end_time,
          room_location: formData.room_location.trim() || null,
          teacher_id: newTeacherId,
          teacher_name: teacherName,
          class: formData.class.trim() || null,
          section: formData.section.trim() || null,
        })
        .eq("id", classData.id);

      if (error) throw error;

      // Update teacher_classes if teacher changed
      if (oldTeacherId !== newTeacherId) {
        // Remove old assignment
        if (oldTeacherId) {
          await supabase
            .from("teacher_classes")
            .delete()
            .eq("teacher_id", oldTeacherId)
            .eq("class_id", classData.id);
        }
        // Add new assignment
        if (newTeacherId) {
          await supabase.from("teacher_classes").insert({
            teacher_id: newTeacherId,
            class_id: classData.id,
          });
        }
      }

      toast({
        title: "Success",
        description: "Class updated successfully",
      });
      onOpenChange(false);
      onClassUpdated();
    } catch (error) {
      console.error("Error updating class:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update class",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase
        .from("classes")
        .delete()
        .eq("id", classData.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Class deleted successfully",
      });
      onOpenChange(false);
      onClassUpdated();
    } catch (error) {
      console.error("Error deleting class:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete class. It may have associated attendance or enrollment records.",
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Class</DialogTitle>
          <DialogDescription>
            Update class details or delete this class.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleUpdate} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-subject">Subject *</Label>
            <Input
              id="edit-subject"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              placeholder="e.g., Mathematics"
            />
            {errors.subject && <p className="text-sm text-destructive">{errors.subject}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-day">Day of Week *</Label>
            <Select
              value={formData.day_of_week}
              onValueChange={(value) => setFormData({ ...formData, day_of_week: value })}
            >
              <SelectTrigger id="edit-day">
                <SelectValue placeholder="Select day" />
              </SelectTrigger>
              <SelectContent>
                {DAYS_OF_WEEK.map((day) => (
                  <SelectItem key={day.value} value={day.value}>
                    {day.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.day_of_week && <p className="text-sm text-destructive">{errors.day_of_week}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-start-time">Start Time *</Label>
              <Input
                id="edit-start-time"
                type="time"
                value={formData.start_time}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
              />
              {errors.start_time && <p className="text-sm text-destructive">{errors.start_time}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-end-time">End Time *</Label>
              <Input
                id="edit-end-time"
                type="time"
                value={formData.end_time}
                onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
              />
              {errors.end_time && <p className="text-sm text-destructive">{errors.end_time}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-room">Room/Location</Label>
            <Input
              id="edit-room"
              value={formData.room_location}
              onChange={(e) => setFormData({ ...formData, room_location: e.target.value })}
              placeholder="e.g., Room 101"
            />
            {errors.room_location && <p className="text-sm text-destructive">{errors.room_location}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-teacher">Assign Teacher</Label>
            <Select
              value={formData.teacher_id}
              onValueChange={(value) => setFormData({ ...formData, teacher_id: value })}
            >
              <SelectTrigger id="edit-teacher">
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
            {errors.teacher_id && <p className="text-sm text-destructive">{errors.teacher_id}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-class">Class</Label>
              <Input
                id="edit-class"
                value={formData.class}
                onChange={(e) => setFormData({ ...formData, class: e.target.value })}
                placeholder="e.g., 5, 10, 12"
              />
              {errors.class && <p className="text-sm text-destructive">{errors.class}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-section">Batch</Label>
              <Input
                id="edit-section"
                value={formData.section}
                onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                placeholder="e.g., A, XYZ"
              />
              {errors.section && <p className="text-sm text-destructive">{errors.section}</p>}
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="destructive" className="w-full sm:w-auto" disabled={deleting}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Class</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete this class? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} disabled={deleting}>
                    {deleting ? "Deleting..." : "Delete"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? "Updating..." : "Update"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
