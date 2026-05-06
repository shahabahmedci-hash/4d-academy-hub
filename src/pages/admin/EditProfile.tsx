import { useState, useEffect } from "react";
import BottomNav from "@/components/shared/BottomNav";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import AvatarUpload from "@/components/shared/AvatarUpload";
import PageSkeleton from "@/components/shared/PageSkeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ProfileData {
  full_name: string;
  email: string;
  phone: string;
  address: string;
  role: string;
  profile_completed: boolean;
  avatar_url: string | null;
}

interface StudentData {
  id: string | null;
  father_name: string;
  address: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  class: string;
  section: string;
  stream: string;
  date_of_birth: string;
}

interface TeacherData {
  id: string | null;
  employee_id: string;
  designation: string;
  joining_date: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
}

export default function EditProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isMainAdmin, setIsMainAdmin] = useState(false);
  const [isCoAdmin, setIsCoAdmin] = useState(false);
  const [isSelfEdit, setIsSelfEdit] = useState(false);
  const [targetUserRole, setTargetUserRole] = useState<string>("");
  const [profileData, setProfileData] = useState<ProfileData>({
    full_name: "",
    email: "",
    phone: "",
    address: "",
    role: "student",
    profile_completed: false,
    avatar_url: null,
  });
  const [studentData, setStudentData] = useState<StudentData>({
    id: null,
    father_name: "",
    address: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
    class: "",
    section: "",
    stream: "",
    date_of_birth: "",
  });
  const [teacherData, setTeacherData] = useState<TeacherData>({
    id: null,
    employee_id: "",
    designation: "",
    joining_date: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
  });

  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);

  useEffect(() => {
    const init = async () => {
      await checkAdminStatus();
      await loadProfileData();
    };
    init();
  }, [id]);

  const checkAdminStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/");
      return;
    }

    // Check if editing own profile
    setIsSelfEdit(user.id === id);

    const [adminResult, coAdminResult] = await Promise.all([
      supabase.rpc("is_admin"),
      supabase.rpc("is_co_admin")
    ]);

    if (!adminResult.data && !coAdminResult.data) {
      navigate("/student/dashboard");
      return;
    }

    setIsMainAdmin(adminResult.data || false);
    setIsCoAdmin(coAdminResult.data || false);
  };

  const loadProfileData = async () => {
    try {
      // Load target user's role from user_roles table first
      const { data: userRoles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", id);

      // Check if user is a teacher and get teacher data
      const { data: teacher } = await supabase
        .from("teachers")
        .select("*")
        .eq("user_id", id)
        .maybeSingle();

      const hasAdminRole = userRoles?.some((r) => r.role === "admin");
      const hasCoAdminRole = userRoles?.some((r) => r.role === "co_admin");
      const isTeacher = !!teacher;
      
      let actualRole = "student";
      if (hasAdminRole) {
        setTargetUserRole("admin");
        actualRole = "admin";
      } else if (hasCoAdminRole) {
        setTargetUserRole("co_admin");
        actualRole = "co_admin";
      } else if (isTeacher) {
        setTargetUserRole("teacher");
        actualRole = "teacher";
      } else {
        setTargetUserRole("student");
        actualRole = "student";
      }

      // Load profile data
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", id)
        .single();

      if (profile) {
        setProfileData({
          full_name: profile.full_name || "",
          email: profile.email || "",
          phone: profile.phone || "",
          address: (profile as any).address || "",
          role: actualRole,
          profile_completed: profile.profile_completed || false,
          avatar_url: profile.avatar_url || null,
        });
      }

      // Load teacher data if exists
      if (teacher) {
        setTeacherData({
          id: teacher.id,
          employee_id: teacher.employee_id || "",
          designation: teacher.designation || "",
          joining_date: teacher.joining_date || "",
          emergency_contact_name: (teacher as any).emergency_contact_name || "",
          emergency_contact_phone: (teacher as any).emergency_contact_phone || "",
        });
      }

      // Load student data if exists
      const { data: student } = await supabase
        .from("students")
        .select("*")
        .eq("user_id", id)
        .single();

      if (student) {
        setStudentData({
          id: student.id,
          father_name: student.father_name || "",
          address: student.address || "",
          emergency_contact_name: student.emergency_contact_name || "",
          emergency_contact_phone: student.emergency_contact_phone || "",
          class: student.class || "",
          section: student.section || "",
          stream: student.stream || "",
          date_of_birth: student.date_of_birth || "",
        });
      }
    } catch (error) {
      console.error("Error loading profile:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load profile data",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Co-admins cannot edit admin profiles
      if (isCoAdmin && !isMainAdmin && targetUserRole === "admin") {
        toast({
          variant: "destructive",
          title: "Permission Denied",
          description: "Co-admins cannot edit admin profiles",
        });
        setSaving(false);
        return;
      }

      // Validate role changes based on permissions
      if (profileData.role !== targetUserRole) {
        // Co-admins can only upgrade students to co-admin, not downgrade anyone
        if (isCoAdmin && !isMainAdmin) {
          // Cannot change admin roles
          if (targetUserRole === "admin") {
            toast({
              variant: "destructive",
              title: "Permission Denied",
              description: "Co-admins cannot modify admin roles",
            });
            setSaving(false);
            return;
          }
          
          // Can only upgrade student to co-admin, cannot downgrade
          if (!(targetUserRole === "student" && profileData.role === "co_admin")) {
            toast({
              variant: "destructive",
              title: "Permission Denied",
              description: "Co-admins can only upgrade students to co-admin role",
            });
            setSaving(false);
            return;
          }
        }

        // Students cannot change roles
        if (!isMainAdmin && !isCoAdmin) {
          toast({
            variant: "destructive",
            title: "Permission Denied",
            description: "You don't have permission to change user roles",
          });
          setSaving(false);
          return;
        }
      }

      // Validate phone numbers (10 digits only)
      if (profileData.phone && !/^[0-9]{10}$/.test(profileData.phone)) {
        toast({
          variant: "destructive",
          title: "Invalid Phone Number",
          description: "Phone number must be exactly 10 digits",
        });
        setSaving(false);
        return;
      }

      const emergencyPhone = profileData.role === "teacher" 
        ? teacherData.emergency_contact_phone 
        : studentData.emergency_contact_phone;
      if (emergencyPhone && !/^[0-9]{10}$/.test(emergencyPhone)) {
        toast({
          variant: "destructive",
          title: "Invalid Emergency Phone",
          description: "Emergency contact phone must be exactly 10 digits",
        });
        setSaving(false);
        return;
      }

      // Update profile - set role appropriately in profiles table
      const profileUpdate: any = {
        full_name: profileData.full_name,
        phone: profileData.phone,
        address: profileData.address,
        role: profileData.role === "co_admin" ? "admin" : 
              profileData.role === "teacher" ? "student" : profileData.role,
        profile_completed: profileData.profile_completed,
      };
      
      const { error: profileError } = await supabase
        .from("profiles")
        .update(profileUpdate)
        .eq("id", id);

      if (profileError) throw profileError;

      // Handle role changes
      if ((isMainAdmin || isCoAdmin) && profileData.role !== targetUserRole) {
        // Delete existing roles from user_roles table
        const { error: deleteError } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", id);

        if (deleteError) {
          console.error("Error deleting roles:", deleteError);
          throw new Error("Failed to update user roles");
        }

        // Insert new role if admin or co_admin
        if (profileData.role === "admin" || profileData.role === "co_admin") {
          const { error: insertError } = await supabase
            .from("user_roles")
            .insert({
              user_id: id,
              role: profileData.role,
            });

          if (insertError) {
            console.error("Error inserting role:", insertError);
            throw new Error("Failed to update user roles");
          }
        }

        // Handle teacher role - create or remove teacher record
        if (profileData.role === "teacher" && targetUserRole !== "teacher") {
          // Create teacher record
          const { error: teacherError } = await supabase
            .from("teachers")
            .insert({
              user_id: id,
              joining_date: new Date().toISOString().split('T')[0],
            });

          if (teacherError) {
            console.error("Error creating teacher:", teacherError);
            throw new Error("Failed to create teacher record");
          }
        } else if (profileData.role !== "teacher" && targetUserRole === "teacher") {
          // Remove teacher record if changing from teacher to another role
          const { error: deleteTeacherError } = await supabase
            .from("teachers")
            .delete()
            .eq("user_id", id);

          if (deleteTeacherError) {
            console.error("Error deleting teacher:", deleteTeacherError);
            throw new Error("Failed to remove teacher record");
          }
        }
      }

      // Update or insert student data (only if role is student)
      if (profileData.role === "student") {
        if (studentData.id) {
          const { error: studentError } = await supabase
            .from("students")
            .update({
              father_name: studentData.father_name,
              address: studentData.address,
              emergency_contact_name: studentData.emergency_contact_name,
              emergency_contact_phone: studentData.emergency_contact_phone,
              class: studentData.class,
              section: studentData.section,
              stream: studentData.stream,
              date_of_birth: studentData.date_of_birth || null,
            })
            .eq("id", studentData.id);

          if (studentError) throw studentError;
        } else {
          const { error: insertError } = await supabase.from("students").insert({
            user_id: id,
            father_name: studentData.father_name,
            address: studentData.address,
            emergency_contact_name: studentData.emergency_contact_name,
            emergency_contact_phone: studentData.emergency_contact_phone,
            class: studentData.class,
            section: studentData.section,
            stream: studentData.stream,
            date_of_birth: studentData.date_of_birth || null,
          });

          if (insertError) throw insertError;
        }
      }

      // Update teacher data (only if role is teacher)
      if (profileData.role === "teacher" && teacherData.id) {
        const { error: teacherError } = await supabase
          .from("teachers")
          .update({
            designation: teacherData.designation,
            joining_date: teacherData.joining_date,
            emergency_contact_name: teacherData.emergency_contact_name,
            emergency_contact_phone: teacherData.emergency_contact_phone,
          } as any)
          .eq("id", teacherData.id);

        if (teacherError) throw teacherError;
      }

      toast({
        title: "Success",
        description: "Profile updated successfully",
      });
      // Navigate back to appropriate section based on role
      if (isSelfEdit) {
        navigate("/admin/dashboard");
      } else if (targetUserRole === "teacher") {
        navigate("/admin/teachers");
      } else if (targetUserRole === "co_admin") {
        navigate("/admin/co-admins");
      } else {
        navigate("/admin/students");
      }
    } catch (error) {
      console.error("Error saving profile:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update profile",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    // Check permissions - only students can be archived by co-admins
    if (targetUserRole === "admin") {
      toast({
        variant: "destructive",
        title: "Permission Denied",
        description: "Admin profiles cannot be archived",
      });
      return;
    }

    if (targetUserRole === "co_admin" && !isMainAdmin) {
      toast({
        variant: "destructive",
        title: "Permission Denied",
        description: "Only main admins can archive co-admin profiles",
      });
      return;
    }

    if (isCoAdmin && !isMainAdmin && targetUserRole !== "student") {
      toast({
        variant: "destructive",
        title: "Permission Denied",
        description: "Co-admins can only archive student profiles",
      });
      return;
    }

    setArchiveDialogOpen(true);
  };

  const confirmArchive = async () => {
    setArchiveDialogOpen(false);

    setDeleting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Archive the profile using the database function
      const { error: archiveError } = await supabase.rpc("archive_profile", {
        _profile_id: id,
        _archived_by: user.id,
      });

      if (archiveError) throw archiveError;

      toast({
        title: "Success",
        description: "Profile archived successfully. The user can no longer login.",
      });
      // Navigate back to appropriate section based on role
      if (targetUserRole === "teacher") {
        navigate("/admin/teachers");
      } else if (targetUserRole === "co_admin") {
        navigate("/admin/co-admins");
      } else {
        navigate("/admin/students");
      }
    } catch (error) {
      console.error("Error archiving profile:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to archive profile",
      });
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (isSelfEdit) {
                navigate("/admin/dashboard");
              } else if (targetUserRole === "teacher") {
                navigate("/admin/teachers");
              } else if (targetUserRole === "co_admin") {
                navigate("/admin/co-admins");
              } else {
                navigate("/admin/students");
              }
            }}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-3xl font-bold">{isSelfEdit ? "My Profile" : "Edit Profile"}</h1>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-col items-center">
              <AvatarUpload
                userId={id || ""}
                currentAvatarUrl={profileData.avatar_url}
                fullName={profileData.full_name}
                disabled={false}
                onAvatarChange={(url) => setProfileData({ ...profileData, avatar_url: url })}
                canDelete={true}
              />
              <CardTitle className="mt-4">Personal Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="full_name">Full Name</Label>
                  <Input
                    id="full_name"
                    value={profileData.full_name}
                    onChange={(e) =>
                      setProfileData({ ...profileData, full_name: e.target.value })
                    }
                  />
                </div>
                {profileData.role === "student" && (
                  <div>
                    <Label htmlFor="father_name">Father's Name</Label>
                    <Input
                      id="father_name"
                      value={studentData.father_name}
                      onChange={(e) =>
                        setStudentData({ ...studentData, father_name: e.target.value })
                      }
                    />
                  </div>
                )}
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" value={profileData.email} disabled />
                </div>
                <div>
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    value={profileData.phone}
                    maxLength={10}
                    placeholder="e.g., 9876543210"
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      setProfileData({ ...profileData, phone: val });
                    }}
                  />
                  {profileData.phone && profileData.phone.length !== 10 && (
                    <p className="text-xs text-destructive mt-1">Phone number must be exactly 10 digits</p>
                  )}
                </div>
                {profileData.role === "student" && (
                  <div>
                    <Label htmlFor="date_of_birth">Date of Birth</Label>
                    <Input
                      id="date_of_birth"
                      type="date"
                      value={studentData.date_of_birth}
                      onChange={(e) =>
                        setStudentData({ ...studentData, date_of_birth: e.target.value })
                      }
                    />
                  </div>
                )}
                <div>
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={profileData.role === "student" ? studentData.address : profileData.address}
                    onChange={(e) =>
                      profileData.role === "student"
                        ? setStudentData({ ...studentData, address: e.target.value })
                        : setProfileData({ ...profileData, address: e.target.value })
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {(isMainAdmin || isCoAdmin) && !isSelfEdit && (
            <Card>
              <CardHeader>
                <CardTitle>Role Management</CardTitle>
              </CardHeader>
              <CardContent>
                <div>
                  <Label htmlFor="role">User Role</Label>
                  <Select
                    value={profileData.role}
                    onValueChange={(value) =>
                      setProfileData({ ...profileData, role: value })
                    }
                    disabled={isCoAdmin && !isMainAdmin && targetUserRole !== "student"}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="student">Student</SelectItem>
                      <SelectItem value="teacher">Teacher</SelectItem>
                      <SelectItem value="co_admin">Co-Admin</SelectItem>
                      {isMainAdmin && <SelectItem value="admin">Admin</SelectItem>}
                    </SelectContent>
                  </Select>
                  {isCoAdmin && !isMainAdmin && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Note: You can only upgrade students to co-admin. You cannot downgrade any roles or modify admin profiles.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {(isMainAdmin || isCoAdmin) && !isSelfEdit && (profileData.role === "student" || profileData.role === "teacher") && (
            <Card>
              <CardHeader>
                <CardTitle>Profile Lock Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">
                      Profile is {profileData.profile_completed ? "Locked" : "Unlocked"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {profileData.profile_completed 
                        ? "User cannot edit their own profile. Click to unlock."
                        : "User can edit their profile one time. After saving, it will be locked."}
                    </p>
                  </div>
                  <Button
                    variant={profileData.profile_completed ? "outline" : "secondary"}
                    onClick={() => setProfileData({ ...profileData, profile_completed: !profileData.profile_completed })}
                  >
                    {profileData.profile_completed ? "Unlock Profile" : "Lock Profile"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {profileData.role === "student" && (
            <Card>
              <CardHeader>
                <CardTitle>Academic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="class">Class</Label>
                    <Input
                      id="class"
                      value={studentData.class}
                      onChange={(e) =>
                        setStudentData({ ...studentData, class: e.target.value })
                      }
                      placeholder="e.g., 10th"
                    />
                  </div>
                  <div>
                    <Label htmlFor="section">Batch</Label>
                    <Input
                      id="section"
                      value={studentData.section}
                      onChange={(e) =>
                        setStudentData({ ...studentData, section: e.target.value })
                      }
                      placeholder="e.g., Morning"
                    />
                  </div>
                  <div>
                    <Label htmlFor="stream">Stream</Label>
                    <Input
                      id="stream"
                      value={studentData.stream}
                      onChange={(e) =>
                        setStudentData({ ...studentData, stream: e.target.value })
                      }
                      placeholder="e.g., Science"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {profileData.role === "teacher" && (
            <Card>
              <CardHeader>
                <CardTitle>Professional Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="employee_id">Employee ID</Label>
                    <Input
                      id="employee_id"
                      value={teacherData.employee_id}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                  <div>
                    <Label htmlFor="designation">Designation</Label>
                    <Input
                      id="designation"
                      value={teacherData.designation}
                      onChange={(e) =>
                        setTeacherData({ ...teacherData, designation: e.target.value })
                      }
                      placeholder="e.g., Senior Teacher"
                    />
                  </div>
                  <div>
                    <Label htmlFor="joining_date">Joining Date</Label>
                    <Input
                      id="joining_date"
                      type="date"
                      value={teacherData.joining_date}
                      onChange={(e) =>
                        setTeacherData({ ...teacherData, joining_date: e.target.value })
                      }
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Emergency Contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="emergency_contact_name">Contact Name</Label>
                  <Input
                    id="emergency_contact_name"
                    value={profileData.role === "teacher" ? teacherData.emergency_contact_name : studentData.emergency_contact_name}
                    onChange={(e) =>
                      profileData.role === "teacher"
                        ? setTeacherData({ ...teacherData, emergency_contact_name: e.target.value })
                        : setStudentData({ ...studentData, emergency_contact_name: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="emergency_contact_phone">Contact Phone</Label>
                  <Input
                    id="emergency_contact_phone"
                    maxLength={10}
                    placeholder="e.g., 9876543210"
                    value={profileData.role === "teacher" ? teacherData.emergency_contact_phone : studentData.emergency_contact_phone}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      profileData.role === "teacher"
                        ? setTeacherData({ ...teacherData, emergency_contact_phone: val })
                        : setStudentData({ ...studentData, emergency_contact_phone: val });
                    }}
                  />
                  {((profileData.role === "teacher" ? teacherData.emergency_contact_phone : studentData.emergency_contact_phone) || "").length > 0 &&
                   ((profileData.role === "teacher" ? teacherData.emergency_contact_phone : studentData.emergency_contact_phone) || "").length !== 10 && (
                    <p className="text-xs text-destructive mt-1">Phone number must be exactly 10 digits</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between">
            {!isSelfEdit && (
              <Button 
                variant="destructive" 
                onClick={handleArchive} 
                disabled={deleting || targetUserRole === "admin" || (targetUserRole === "co_admin" && !isMainAdmin)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {deleting ? "Archiving..." : "Archive Profile"}
              </Button>
            )}

            <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Archive this profile?</AlertDialogTitle>
                  <AlertDialogDescription>
                    The user will no longer be able to login. You can restore the profile later from Archived Profiles.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={confirmArchive} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Archive
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button onClick={handleSave} disabled={saving} className={isSelfEdit ? "ml-auto" : ""}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </div>
      <BottomNav role="admin" />
      <div className="h-16 md:hidden" />
    </div>
  );
}
