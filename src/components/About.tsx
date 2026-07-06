import { Card, CardContent } from "@/components/ui/card";
import { Award, Users, BookOpen, TrendingUp } from "lucide-react";

const About = () => {
  const stats = [
    { icon: Users, value: "500+", label: "Students Enrolled" },
    { icon: Award, value: "95%", label: "Success Rate" },
    { icon: BookOpen, value: "15+", label: "Courses Offered" },
    { icon: TrendingUp, value: "10+", label: "Years Experience" },
  ];

  return (
    <section id="about" className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            About <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">4D Academy</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Excellence in education through personalized attention and proven teaching methodologies
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16">
          {stats.map((s, i) => (
            <Card key={i} className="border-primary/20 hover:shadow-[var(--shadow-brand)] transition-all duration-300">
              <CardContent className="p-6 text-center">
                <s.icon className="h-10 w-10 mx-auto mb-3 text-primary" />
                <div className="text-3xl font-bold text-primary mb-1">{s.value}</div>
                <div className="text-sm text-muted-foreground">{s.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="max-w-4xl mx-auto">
          <Card className="border-primary/20">
            <CardContent className="p-8">
              <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                At 4D Academy, we believe that every student has the potential to excel. Our mission is to provide
                high-quality tuition that not only improves academic performance but also builds confidence and
                critical thinking skills.
              </p>
              <p className="text-lg text-muted-foreground leading-relaxed">
                With experienced educators, personalized learning plans, and a student-centric approach, we ensure
                that each learner receives the attention and support they need to succeed in their academic journey
                and beyond.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};

export default About;
