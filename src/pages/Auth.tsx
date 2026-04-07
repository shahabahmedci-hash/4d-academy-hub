import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff } from "lucide-react";
import logo from "@/assets/logo.png";
import ThemeToggle from "@/components/shared/ThemeToggle";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().trim().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

const signupSchema = z.object({
  email: z.string().trim().email("Invalid email address").max(255),
  password: z.string()
    .min(6, "Password must be at least 6 characters")
    .max(72)
    .regex(/[a-zA-Z]/, "Password must contain at least one letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[@#₹_&\-+()\/*!?]/, "Password must contain at least one special character"),
  full_name: z.string().trim().min(1, "Full name is required").max(100),
});

const resetPasswordSchema = z.object({
  email: z.string().trim().email("Invalid email address").max(255),
});

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [resetEmail, setResetEmail] = useState("");

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setTimeout(() => { checkUserRoleAndRedirect(); }, 0);
      }
    });

    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (error?.message?.includes("User from sub claim in JWT does not exist")) {
        await supabase.auth.signOut();
        return;
      }
      if (session) {
        checkUserRoleAndRedirect();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkUserRoleAndRedirect = async () => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError?.message?.includes("User from sub claim in JWT does not exist")) {
        await supabase.auth.signOut();
        return;
      }
      if (!user) return;

      const [adminResult, coAdminResult, teacherResult] = await Promise.all([
        supabase.rpc("is_admin"),
        supabase.rpc("is_co_admin"),
        supabase.rpc("is_teacher"),
      ]);

      if (adminResult.data || coAdminResult.data) {
        navigate("/admin/dashboard");
      } else if (teacherResult.data) {
        navigate("/teacher/dashboard");
      } else {
        navigate("/student/dashboard");
      }
    } catch (error) {
      console.error("Error in checkUserRoleAndRedirect:", error);
      await supabase.auth.signOut();
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    const validation = loginSchema.safeParse({ email: loginEmail, password: loginPassword });
    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      validation.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });

    if (error) {
      toast({ variant: "destructive", title: "Login Failed", description: error.message });
      setLoading(false);
    } else if (data.user) {
      const { data: isArchived } = await supabase.rpc("is_user_archived", { _user_id: data.user.id });
      if (isArchived) {
        await supabase.auth.signOut();
        toast({ variant: "destructive", title: "Account Inactive", description: "Your account has been deactivated. Please contact an administrator." });
        setLoading(false);
        return;
      }

      const { data: isApproved } = await supabase.rpc("is_user_approved", { _user_id: data.user.id });
      if (!isApproved) {
        await supabase.auth.signOut();
        toast({ variant: "destructive", title: "Account Pending", description: "Your account is awaiting admin approval." });
        setLoading(false);
        return;
      }

      toast({ title: "Welcome back!", description: "Login successful" });
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    const validation = signupSchema.safeParse({ email: signupEmail, password: signupPassword, full_name: signupName });
    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      validation.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: signupEmail,
      password: signupPassword,
      options: {
        data: { full_name: signupName, role: "student" },
        emailRedirectTo: `${window.location.origin}/`,
      },
    });

    if (error) {
      toast({ variant: "destructive", title: "Signup Failed", description: error.message });
    } else if (data.user) {
      toast({ title: "Registration Submitted!", description: "Your account is pending admin approval." });
    }
    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    const validation = resetPasswordSchema.safeParse({ email: resetEmail });
    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      validation.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      toast({ variant: "destructive", title: "Reset Failed", description: error.message });
    } else {
      toast({ title: "Check your email", description: "We've sent you a password reset link." });
      setShowForgotPassword(false);
      setResetEmail("");
    }
    setLoading(false);
  };

  if (showForgotPassword) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="absolute top-4 right-4"><ThemeToggle /></div>
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <img src={logo} alt="4D Academy Logo" className="w-16 h-16 mx-auto mb-2" />
            <CardTitle>Reset Password</CardTitle>
            <CardDescription>Enter your email to receive a reset link</CardDescription>
          </CardHeader>
          <form onSubmit={handleForgotPassword}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} required className={errors.email ? "border-destructive" : ""} />
                {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-2">
              <Button type="submit" className="w-full" disabled={loading}>{loading ? "Sending..." : "Send Reset Link"}</Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => { setShowForgotPassword(false); setResetEmail(""); setErrors({}); }}>
                Back to Login
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="absolute top-4 right-4"><ThemeToggle /></div>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <img src={logo} alt="4D Academy Logo" className="w-16 h-16 mx-auto mb-2" />
          <CardTitle className="text-2xl">4D Academy</CardTitle>
          <CardDescription>Tuition Management System</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required className={errors.email ? "border-destructive" : ""} />
                  {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <div className="relative">
                    <Input type={showLoginPassword ? "text" : "password"} value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required className={cn("pr-10", errors.password && "border-destructive")} />
                    <button type="button" onClick={() => setShowLoginPassword(!showLoginPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showLoginPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                </div>
                <Button type="submit" className="w-full" disabled={loading}>{loading ? "Logging in..." : "Login"}</Button>
                <Button type="button" variant="link" className="w-full text-primary" onClick={() => setShowForgotPassword(true)}>Forgot password?</Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input value={signupName} onChange={(e) => setSignupName(e.target.value)} required className={errors.full_name ? "border-destructive" : ""} />
                  {errors.full_name && <p className="text-sm text-destructive">{errors.full_name}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} required className={errors.email ? "border-destructive" : ""} />
                  {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <div className="relative">
                    <Input type={showSignupPassword ? "text" : "password"} value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} required minLength={6} className={cn("pr-10", errors.password && "border-destructive")} />
                    <button type="button" onClick={() => setShowSignupPassword(!showSignupPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showSignupPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                  <p className="text-xs text-muted-foreground">Must contain letters, numbers, and special characters (@#₹_&-+()/\*!?)</p>
                </div>
                <p className="text-xs text-muted-foreground">Your account will be created as a <strong>Student</strong> and requires admin approval before you can login.</p>
                <Button type="submit" className="w-full" disabled={loading}>{loading ? "Creating account..." : "Sign Up"}</Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

function cn(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export default Auth;
