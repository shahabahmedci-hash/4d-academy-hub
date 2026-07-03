import { useNavigate, useLocation } from "react-router-dom";
import { Home, Users, IndianRupee, TrendingUp, Menu, Calendar, BookOpen, User, Award, FileText, ClipboardCheck, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

interface NavItem {
  label: string;
  icon: React.ElementType;
  path: string;
}

interface BottomNavProps {
  role: "admin" | "student" | "teacher";
}

const adminPrimaryNav: NavItem[] = [
  { label: "Dashboard", icon: Home, path: "/admin/dashboard" },
  { label: "Students", icon: Users, path: "/admin/students" },
  { label: "Fees", icon: IndianRupee, path: "/admin/fees" },
  { label: "Analytics", icon: TrendingUp, path: "/admin/analytics" },
];

const adminMoreNav: NavItem[] = [
  { label: "Classes", icon: Calendar, path: "/admin/classes" },
  { label: "Attendance", icon: ClipboardCheck, path: "/admin/attendance" },
  { label: "Teacher Attendance", icon: ClipboardCheck, path: "/admin/teacher-attendance" },
  { label: "Teachers", icon: Users, path: "/admin/teachers" },
  { label: "Expenses", icon: IndianRupee, path: "/admin/expenses" },
  { label: "Salaries", icon: IndianRupee, path: "/admin/salaries" },
  { label: "Documents", icon: FileText, path: "/admin/documents" },
  { label: "Approvals", icon: Users, path: "/admin/approvals" },
  { label: "Financial Years", icon: Calendar, path: "/admin/financial-years" },
  { label: "Automations", icon: Zap, path: "/admin/automations" },
];

const studentPrimaryNav: NavItem[] = [
  { label: "Dashboard", icon: Home, path: "/student/dashboard" },
  { label: "Schedule", icon: Calendar, path: "/student/schedule" },
  { label: "Attendance", icon: Award, path: "/student/attendance" },
  { label: "Profile", icon: User, path: "/student/profile" },
];

const studentMoreNav: NavItem[] = [
  { label: "Fees", icon: IndianRupee, path: "/student/fees" },
  { label: "Study Materials", icon: FileText, path: "/student/documents" },
];

const teacherPrimaryNav: NavItem[] = [
  { label: "Dashboard", icon: Home, path: "/teacher/dashboard" },
  { label: "Classes", icon: BookOpen, path: "/teacher/classes" },
  { label: "Attendance", icon: ClipboardCheck, path: "/teacher/attendance" },
];

const teacherMoreNav: NavItem[] = [
  { label: "Salary", icon: IndianRupee, path: "/teacher/salary" },
  { label: "My Students", icon: Users, path: "/teacher/students" },
  { label: "Documents", icon: FileText, path: "/teacher/documents" },
  { label: "My Attendance", icon: Award, path: "/teacher/my-attendance" },
  { label: "Profile", icon: User, path: "/teacher/profile" },
];

const BottomNav = ({ role }: BottomNavProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  const primaryNav = role === "admin" ? adminPrimaryNav : role === "student" ? studentPrimaryNav : teacherPrimaryNav;
  const moreNav = role === "admin" ? adminMoreNav : role === "student" ? studentMoreNav : teacherMoreNav;

  const renderNavItem = (item: NavItem) => (
    <button
      key={item.path}
      onClick={() => {
        navigate(item.path);
        setMoreOpen(false);
      }}
      className={cn(
        "flex flex-col items-center justify-center gap-0.5 flex-1 py-2 px-1 text-xs transition-colors min-w-0",
        isActive(item.path)
          ? "text-primary font-semibold"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      <item.icon className="h-5 w-5" />
      <span className="truncate">{item.label}</span>
    </button>
  );

  return (
    <>
      <div className="h-16" /> {/* Spacer */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex items-center justify-around">
          {primaryNav.map(renderNavItem)}
          <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
            <SheetTrigger asChild>
              <button className="flex flex-col items-center justify-center gap-0.5 flex-1 py-2 px-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                <Menu className="h-5 w-5" />
                <span>More</span>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-auto max-h-[60vh]">
              <SheetHeader>
                <SheetTitle>More Options</SheetTitle>
              </SheetHeader>
              <div className="grid grid-cols-3 gap-2 py-4">
                {moreNav.map((item) => (
                  <Button
                    key={item.path}
                    variant="ghost"
                    className={cn(
                      "flex flex-col items-center gap-1 h-auto py-3",
                      isActive(item.path) && "text-primary"
                    )}
                    onClick={() => {
                      navigate(item.path);
                      setMoreOpen(false);
                    }}
                  >
                    <item.icon className="h-5 w-5" />
                    <span className="text-xs">{item.label}</span>
                  </Button>
                ))}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </>
  );
};

export default BottomNav;
