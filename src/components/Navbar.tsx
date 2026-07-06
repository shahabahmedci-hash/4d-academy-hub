import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import logo from "@/assets/4d-academy-logo.jpg";
import ThemeToggle from "@/components/shared/ThemeToggle";

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
      setIsOpen(false);
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <img src={logo} alt="4D Academy Logo" className="h-12 w-12 object-contain" />
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              4D Academy
            </span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            {["home","about","courses","features","contact"].map((s) => (
              <button key={s} onClick={() => scrollToSection(s)} className="text-foreground hover:text-primary transition-colors capitalize">
                {s === "features" ? "Why Us" : s}
              </button>
            ))}
            <ThemeToggle />
            <Button variant="outline" size="sm" onClick={() => (window.location.href = "/auth")}>Login</Button>
            <Button variant="hero" onClick={() => scrollToSection("contact")}>Enroll Now</Button>
          </div>

          <button className="md:hidden" onClick={() => setIsOpen(!isOpen)} aria-label="Toggle menu">
            {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {isOpen && (
          <div className="md:hidden py-4 space-y-4">
            {["home","about","courses","features","contact"].map((s) => (
              <button key={s} onClick={() => scrollToSection(s)} className="block w-full text-left py-2 text-foreground hover:text-primary transition-colors capitalize">
                {s === "features" ? "Why Us" : s}
              </button>
            ))}
            <Button variant="outline" className="w-full mb-2" onClick={() => (window.location.href = "/auth")}>Login</Button>
            <Button variant="hero" className="w-full" onClick={() => scrollToSection("contact")}>Enroll Now</Button>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
