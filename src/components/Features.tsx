import { Card, CardContent } from "@/components/ui/card";
import { GraduationCap, Clock, Users2, Target, Trophy, HeartHandshake } from "lucide-react";

const Features = () => {
  const features = [
    { icon: GraduationCap, title: "Expert Educators", description: "Learn from qualified teachers with years of teaching experience" },
    { icon: Clock, title: "Flexible Timings", description: "Choose class schedules that fit your lifestyle and commitments" },
    { icon: Users2, title: "Small Class Sizes", description: "Personalized attention in small groups for better learning outcomes" },
    { icon: Target, title: "Focused Curriculum", description: "Targeted teaching aligned with exam requirements and syllabi" },
    { icon: Trophy, title: "Proven Results", description: "Track record of outstanding student achievements and success" },
    { icon: HeartHandshake, title: "Student Support", description: "Ongoing support and guidance beyond regular class hours" },
  ];

  return (
    <section id="features" className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Why Choose <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Us</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            We're committed to providing the best learning experience for every student
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((f, i) => (
            <Card key={i} className="border-primary/20 hover:shadow-[var(--shadow-brand)] transition-all duration-300 group">
              <CardContent className="p-6">
                <div className="mb-4 inline-flex p-3 rounded-lg bg-gradient-to-r from-primary/10 to-secondary/10">
                  <f.icon className="h-8 w-8 text-primary group-hover:scale-110 transition-transform" />
                </div>
                <h3 className="text-xl font-semibold mb-2">{f.title}</h3>
                <p className="text-muted-foreground">{f.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
