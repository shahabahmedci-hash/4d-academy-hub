import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import ErrorBoundary from "@/components/shared/ErrorBoundary";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import AdminDashboard from "./pages/admin/AdminDashboard";
import Students from "./pages/admin/Students";
import StudentDetails from "./pages/admin/StudentDetails";
import Approvals from "./pages/admin/Approvals";
import Fees from "./pages/admin/Fees";
import Teachers from "./pages/admin/Teachers";
import TeacherDetails from "./pages/admin/TeacherDetails";
import Expenses from "./pages/admin/Expenses";
import Salaries from "./pages/admin/Salaries";
import Attendance from "./pages/admin/Attendance";
import TeacherAttendance from "./pages/admin/TeacherAttendance";
import Classes from "./pages/admin/Classes";
import Analytics from "./pages/admin/Analytics";
import ArchivedProfiles from "./pages/admin/ArchivedProfiles";
import CoAdmins from "./pages/admin/CoAdmins";
import Documents from "./pages/admin/Documents";
import FinancialYears from "./pages/admin/FinancialYears";
import Automations from "./pages/admin/Automations";
import EditProfile from "./pages/admin/EditProfile";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
              <Route path="/admin/students" element={<Students />} />
              <Route path="/admin/students/:id" element={<StudentDetails />} />
              <Route path="/admin/approvals" element={<Approvals />} />
              <Route path="/admin/fees" element={<Fees />} />
              <Route path="/admin/teachers" element={<Teachers />} />
              <Route path="/admin/teachers/:id" element={<TeacherDetails />} />
              <Route path="/admin/expenses" element={<Expenses />} />
              <Route path="/admin/salaries" element={<Salaries />} />
              <Route path="/admin/attendance" element={<Attendance />} />
              <Route path="/admin/teacher-attendance" element={<TeacherAttendance />} />
              <Route path="/admin/classes" element={<Classes />} />
              <Route path="/admin/analytics" element={<Analytics />} />
              <Route path="/admin/archived" element={<ArchivedProfiles />} />
              <Route path="/admin/co-admins" element={<CoAdmins />} />
              <Route path="/admin/documents" element={<Documents />} />
              <Route path="/admin/financial-years" element={<FinancialYears />} />
              <Route path="/admin/automations" element={<Automations />} />
              <Route path="/admin/edit-profile" element={<EditProfile />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </ErrorBoundary>
);

export default App;
