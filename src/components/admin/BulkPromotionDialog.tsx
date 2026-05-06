import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowUpCircle, Search, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Student {
  id: string;
  user_id: string | null;
  student_id: string | null;
  class: string | null;
  section: string | null;
  profiles?: {
    full_name: string;
    email: string;
  };
}

interface BulkPromotionDialogProps {
  onStudentsUpdated: () => void;
}

export const BulkPromotionDialog = ({ onStudentsUpdated }: BulkPromotionDialogProps) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  
  // Filter options
  const [filterClass, setFilterClass] = useState("");
  const [filterSection, setFilterSection] = useState("");
  
  // New values for bulk update
  const [newClass, setNewClass] = useState("");
  const [newSection, setNewSection] = useState("");

  // Get unique classes and sections for filters
  const [availableClasses, setAvailableClasses] = useState<string[]>([]);
  const [availableSections, setAvailableSections] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      loadStudents();
    } else {
      // Reset state when dialog closes
      setSelectedStudents(new Set());
      setSearchQuery("");
      setFilterClass("");
      setFilterSection("");
      setNewClass("");
      setNewSection("");
    }
  }, [open]);

  const loadStudents = async () => {
    setLoading(true);
    try {
      const { data: studentsData, error: studentsError } = await supabase
        .from("students")
        .select("id, user_id, student_id, class, section")
        .order("class", { ascending: true });

      if (studentsError) throw studentsError;

      const userIds = (studentsData || [])
        .map((s) => s.user_id)
        .filter(Boolean) as string[];

      // Get teacher user IDs to exclude them
      let teacherUserIds: Set<string> = new Set();
      if (userIds.length > 0) {
        const { data: teachersData } = await supabase
          .from("teachers")
          .select("user_id")
          .in("user_id", userIds);
        teacherUserIds = new Set((teachersData || []).map(t => t.user_id));
      }

      // Get co-admin and admin user IDs to exclude them
      let adminCoAdminUserIds: Set<string> = new Set();
      if (userIds.length > 0) {
        const { data: rolesData } = await supabase
          .from("user_roles")
          .select("user_id, role")
          .in("user_id", userIds)
          .in("role", ["admin", "co_admin"]);
        adminCoAdminUserIds = new Set((rolesData || []).map(r => r.user_id));
      }

      let profilesById: Record<string, { full_name: string; email: string }> = {};
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, full_name, email, archived")
          .in("id", userIds)
          .eq("archived", false);
        
        profilesById = Object.fromEntries(
          (profilesData || []).map((p) => [p.id, { full_name: p.full_name, email: p.email }])
        );
      }

      // Filter out teachers, co-admins, and admins - only show pure students
      const merged = (studentsData || [])
        .filter((s) => {
          // Exclude if user is a teacher
          if (s.user_id && teacherUserIds.has(s.user_id)) return false;
          // Exclude if user is an admin or co-admin
          if (s.user_id && adminCoAdminUserIds.has(s.user_id)) return false;
          // Keep if no user_id or if profile exists (not archived)
          return !s.user_id || profilesById[s.user_id];
        })
        .map((s) => ({
          ...s,
          profiles: s.user_id ? profilesById[s.user_id] : undefined,
        }));

      setStudents(merged);

      // Extract unique classes and sections
      const classes = [...new Set(merged.map(s => s.class).filter(Boolean))] as string[];
      const sections = [...new Set(merged.map(s => s.section).filter(Boolean))] as string[];
      setAvailableClasses(classes.sort());
      setAvailableSections(sections.sort());
    } catch (error) {
      console.error("Error loading students:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load students",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = students.filter((student) => {
    const name = student.profiles?.full_name || "";
    const email = student.profiles?.email || "";
    const sid = student.student_id || "";
    
    const matchesSearch = 
      name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sid.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesClass = !filterClass || student.class === filterClass;
    const matchesSection = !filterSection || student.section === filterSection;
    
    return matchesSearch && matchesClass && matchesSection;
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedStudents(new Set(filteredStudents.map(s => s.id)));
    } else {
      setSelectedStudents(new Set());
    }
  };

  const handleSelectStudent = (studentId: string, checked: boolean) => {
    const newSelected = new Set(selectedStudents);
    if (checked) {
      newSelected.add(studentId);
    } else {
      newSelected.delete(studentId);
    }
    setSelectedStudents(newSelected);
  };

  const handleBulkUpdate = async () => {
    if (selectedStudents.size === 0) {
      toast({
        variant: "destructive",
        title: "No students selected",
        description: "Please select at least one student to update",
      });
      return;
    }

    if (!newClass && !newSection) {
      toast({
        variant: "destructive",
        title: "No changes specified",
        description: "Please enter a new class or batch to update",
      });
      return;
    }

    setSaving(true);
    try {
      const updateData: { class?: string; section?: string } = {};
      if (newClass) updateData.class = newClass;
      if (newSection) updateData.section = newSection;

      const { error } = await supabase
        .from("students")
        .update(updateData)
        .in("id", Array.from(selectedStudents));

      if (error) throw error;

      toast({
        title: "Success",
        description: `Updated ${selectedStudents.size} student(s) successfully`,
      });

      setOpen(false);
      onStudentsUpdated();
    } catch (error: any) {
      console.error("Error updating students:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update students",
      });
    } finally {
      setSaving(false);
    }
  };

  const isAllSelected = filteredStudents.length > 0 && 
    filteredStudents.every(s => selectedStudents.has(s.id));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <ArrowUpCircle className="h-4 w-4 mr-2" />
          Bulk Promote
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Bulk Student Promotion
          </DialogTitle>
          <DialogDescription>
            Select students and update their class and batch for yearly promotion
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search students..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterClass} onValueChange={(val) => setFilterClass(val === "__all__" ? "" : val)}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by class" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Classes</SelectItem>
                {availableClasses.map((cls) => (
                  <SelectItem key={cls} value={cls}>Class {cls}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterSection} onValueChange={(val) => setFilterSection(val === "__all__" ? "" : val)}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by batch" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Batches</SelectItem>
                {availableSections.map((sec) => (
                  <SelectItem key={sec} value={sec}>Batch {sec}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Select All */}
          <div className="flex items-center justify-between border-b pb-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="select-all"
                checked={isAllSelected}
                onCheckedChange={handleSelectAll}
                disabled={filteredStudents.length === 0}
              />
              <Label htmlFor="select-all" className="cursor-pointer">
                Select All ({filteredStudents.length})
              </Label>
            </div>
            <Badge variant="secondary">
              {selectedStudents.size} selected
            </Badge>
          </div>

          {/* Student List */}
          <ScrollArea className="flex-1 border rounded-md">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">Loading students...</div>
            ) : filteredStudents.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">No students found</div>
            ) : (
              <div className="divide-y">
                {filteredStudents.map((student) => (
                  <div
                    key={student.id}
                    className="flex items-center gap-3 p-3 hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={selectedStudents.has(student.id)}
                      onCheckedChange={(checked) => handleSelectStudent(student.id, !!checked)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {student.profiles?.full_name || "Unknown"}
                        {student.student_id && (
                          <span className="text-muted-foreground font-normal ml-2">
                            ({student.student_id})
                          </span>
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        {student.profiles?.email}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      {student.class && (
                        <Badge variant="outline">Class {student.class}</Badge>
                      )}
                      {student.section && (
                        <Badge variant="secondary">Batch {student.section}</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Update Fields */}
          <div className="border-t pt-4 space-y-4">
            <p className="text-sm font-medium">Update selected students to:</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="new-class">New Class</Label>
                <Input
                  id="new-class"
                  placeholder="e.g., 11, 12"
                  value={newClass}
                  onChange={(e) => setNewClass(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-section">New Batch</Label>
                <Input
                  id="new-section"
                  placeholder="e.g., A, Morning"
                  value={newSection}
                  onChange={(e) => setNewSection(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 border-t pt-4">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button 
              onClick={handleBulkUpdate} 
              disabled={saving || selectedStudents.size === 0 || (!newClass && !newSection)}
            >
              {saving ? "Updating..." : `Update ${selectedStudents.size} Student(s)`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
