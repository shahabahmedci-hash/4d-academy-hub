import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import mathImage from "@/assets/course-math.jpg";
import scienceImage from "@/assets/course-science.jpg";
import englishImage from "@/assets/course-english.jpg";

const Courses = () => {
  const courses = [
    { title: "Mathematics", description: "Master mathematical concepts from basics to advanced calculus", image: mathImage, levels: ["Primary", "Secondary", "A-Levels"] },
    { title: "Science", description: "Explore physics, chemistry, and biology with hands-on learning", image: scienceImage, levels: ["Primary", "Secondary", "A-Levels"] },
    { title: "English", description: "Enhance language skills, writing, and literary comprehension", image: englishImage, levels: ["Primary", "Secondary", "A-Levels"] },
  ];

  return (
    <section id="courses" className="py-20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Our <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Courses</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Comprehensive tuition programs designed to help students excel
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {courses.map((c, i) => (
            <Card key={i} className="overflow-hidden border-primary/20 hover:shadow-[var(--shadow-brand)] transition-all duration-300 group">
              <div className="relative h-48 overflow-hidden">
                <img src={c.image} alt={c.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              </div>
              <CardHeader>
                <CardTitle className="text-2xl">{c.title}</CardTitle>
                <CardDescription className="text-base">{c.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2 mb-4">
                  {c.levels.map((l, j) => (
                    <span key={j} className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">{l}</span>
                  ))}
                </div>
                <Button variant="outline" className="w-full">Learn More</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Courses;
