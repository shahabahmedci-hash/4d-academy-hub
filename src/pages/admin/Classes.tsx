import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import BottomNav from "@/components/shared/BottomNav";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface ClassRow {
  id: string;
  subject: string;
  class: string | null;
  section: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room_location: string | null;
  teacher_name: string | null;
  teacher_id: string | null;
}

const Classes = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeDay, setActiveDay] = useState(String(new Date().getDay()));

  // Form state
  const [subject, setSubject] = useState("");
  const [className, setClassName] = useState("");
  const [section, setSection] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState("1");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [room, setRoom] = useState("");
  const [teacherName, setTeacherName] = useState("");

  useEffect(() => {
    loadClasses();
  }, []);

  const loadClasses = async () => {
    const { data } = await supabase
      .from("classes")
      .select("*")
      .order("start_time");
    setClasses(data || []);
    setLoading(false);
  };

  const addClass = async () => {
    if (!subject) {
      toast({ title: "Error", description: "Subject is required", variant: "destructive" });
      return;
    }

    const { error } = await supabase.from("classes").insert({
      subject,
      class: className || null,
      section: section || null,
      day_of_week: parseInt(dayOfWeek),
      start_time: startTime,
      end_time: endTime,
      room_location: room || null,
      teacher_name: teacherName || null,
    });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Class added" });
    setDialogOpen(false);
    resetForm();
    loadClasses();
  };

  const deleteClass = async (id: string) => {
    const { error } = await supabase.from("classes").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Class deleted" });
    loadClasses();
  };

  const resetForm = () => {
    setSubject(""); setClassName(""); setSection("");
    setDayOfWeek("1"); setStartTime("09:00"); setEndTime("10:00");
    setRoom(""); setTeacherName("");
  };

  const classesByDay = classes.filter(c => c.day_of_week === parseInt(activeDay));

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-bold">Class Schedule</h1>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Class</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Subject *</Label><Input value={subject} onChange={e => setSubject(e.target.value)} /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>Class</Label><Input value={className} onChange={e => setClassName(e.target.value)} placeholder="e.g. 10" /></div>
                  <div><Label>Section</Label><Input value={section} onChange={e => setSection(e.target.value)} placeholder="e.g. A" /></div>
                </div>
                <div>
                  <Label>Day</Label>
                  <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DAYS.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>Start Time</Label><Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} /></div>
                  <div><Label>End Time</Label><Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} /></div>
                </div>
                <div><Label>Room</Label><Input value={room} onChange={e => setRoom(e.target.value)} /></div>
                <div><Label>Teacher Name</Label><Input value={teacherName} onChange={e => setTeacherName(e.target.value)} /></div>
                <Button className="w-full" onClick={addClass}>Add Class</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <Tabs value={activeDay} onValueChange={setActiveDay}>
          <TabsList className="w-full overflow-x-auto flex">
            {DAYS.map((d, i) => (
              <TabsTrigger key={i} value={String(i)} className="flex-1 text-xs px-1">
                {d.slice(0, 3)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <p className="text-sm text-muted-foreground">{DAYS[parseInt(activeDay)]} — {classesByDay.length} classes</p>

        {classesByDay.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground">No classes scheduled</CardContent></Card>
        ) : (
          <div className="space-y-3">
            {classesByDay.map(c => (
              <Card key={c.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold">{c.subject}</p>
                      <p className="text-sm text-muted-foreground">
                        {c.start_time?.slice(0, 5)} – {c.end_time?.slice(0, 5)}
                      </p>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {c.class && <Badge variant="secondary">{c.class}{c.section ? `-${c.section}` : ""}</Badge>}
                        {c.room_location && <Badge variant="outline">{c.room_location}</Badge>}
                      </div>
                      {c.teacher_name && <p className="text-xs text-muted-foreground mt-1">Teacher: {c.teacher_name}</p>}
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => deleteClass(c.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <BottomNav role="admin" />
    </div>
  );
};

export default Classes;
