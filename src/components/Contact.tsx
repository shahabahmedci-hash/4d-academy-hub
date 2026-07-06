import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MapPin, Phone, Mail, Clock } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const Contact = () => {
  const [formData, setFormData] = useState({ name: "", email: "", phone: "", message: "" });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Thank you! We'll get back to you soon.");
    setFormData({ name: "", email: "", phone: "", message: "" });
  };

  const contactInfo = [
    { icon: MapPin, title: "Location", details: "Visit us at our center" },
    { icon: Phone, title: "Phone", details: "Call us anytime" },
    { icon: Mail, title: "Email", details: "info@4dacademy.com" },
    { icon: Clock, title: "Hours", details: "Mon-Sat: 9AM-7PM" },
  ];

  return (
    <section id="contact" className="py-20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Get In <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Touch</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Ready to start your journey? Contact us today for enrollment or inquiries
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
          <Card className="border-primary/20">
            <CardHeader><CardTitle>Send us a message</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input placeholder="Your Name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
                <Input type="email" placeholder="Your Email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required />
                <Input type="tel" placeholder="Your Phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} required />
                <Textarea placeholder="Your Message" rows={5} value={formData.message} onChange={(e) => setFormData({ ...formData, message: e.target.value })} required />
                <Button type="submit" variant="hero" className="w-full">Send Message</Button>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-4">
            {contactInfo.map((info, i) => (
              <Card key={i} className="border-primary/20 hover:shadow-[var(--shadow-brand)] transition-all duration-300">
                <CardContent className="p-6 flex items-start gap-4">
                  <div className="p-3 rounded-lg bg-gradient-to-r from-primary/10 to-secondary/10">
                    <info.icon className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">{info.title}</h3>
                    <p className="text-muted-foreground">{info.details}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Contact;
