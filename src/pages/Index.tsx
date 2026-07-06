import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import About from "@/components/About";
import Courses from "@/components/Courses";
import Features from "@/components/Features";
import Contact from "@/components/Contact";
import Footer from "@/components/Footer";
import AdBanner from "@/components/shared/AdBanner";

const Index = () => {
  return (
    <div className="min-h-screen">
      <Navbar />
      <Hero />
      <AdBanner className="py-4" inline />
      <About />
      <Courses />
      <AdBanner className="py-4" inline />
      <Features />
      <Contact />
      <Footer />
    </div>
  );
};

export default Index;
