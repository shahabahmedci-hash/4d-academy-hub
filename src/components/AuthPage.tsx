import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import logo from "@/assets/logo.png";

const AuthPage = () => {
  const [activeTab, setActiveTab] = useState<"login" | "signup">("login");
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: integrate with backend
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-border bg-card p-8">
          {/* Logo & Title */}
          <div className="mb-8 flex flex-col items-center gap-3">
            <img src={logo} alt="4D Academy Logo" width={80} height={80} />
            <h1 className="text-2xl font-bold text-foreground">4D Academy</h1>
            <p className="text-sm text-muted-foreground">Tuition Management System</p>
          </div>

          {/* Tabs */}
          <div className="mb-6 flex rounded-lg border border-border overflow-hidden">
            <button
              onClick={() => setActiveTab("login")}
              className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${
                activeTab === "login"
                  ? "bg-secondary text-foreground"
                  : "bg-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Login
            </button>
            <button
              onClick={() => setActiveTab("signup")}
              className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${
                activeTab === "signup"
                  ? "bg-secondary text-foreground"
                  : "bg-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {activeTab === "signup" && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-primary">Full Name</Label>
                <Input
                  type="text"
                  placeholder="Enter your full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-background border-border"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-primary">Email</Label>
              <Input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-background border-border"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-primary">Password</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-background border-border pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {activeTab === "signup" && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-primary">Confirm Password</Label>
                <Input
                  type="password"
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="bg-background border-border"
                />
              </div>
            )}

            <Button type="submit" className="w-full py-5 text-base font-semibold">
              {activeTab === "login" ? "Login" : "Sign Up"}
            </Button>
          </form>

          {activeTab === "login" && (
            <p className="mt-4 text-center text-sm text-primary cursor-pointer hover:underline">
              Forgot password?
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
