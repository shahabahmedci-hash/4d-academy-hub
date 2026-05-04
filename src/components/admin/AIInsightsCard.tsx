import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Insight {
  title: string;
  detail: string;
  priority: "low" | "medium" | "high";
  category: "fees" | "attendance" | "expenses" | "general";
}

const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-red-500/10 text-red-500 border-red-500/20",
  medium: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  low: "bg-green-500/10 text-green-500 border-green-500/20",
};

const AIInsightsCard = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<Insight[] | null>(null);

  const generate = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-insights");
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setInsights((data as any)?.insights || []);
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "AI insights failed",
        description: e?.message || "Unable to generate insights.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> AI Insights
          </CardTitle>
          <CardDescription>Actionable suggestions based on your data</CardDescription>
        </div>
        <Button size="sm" onClick={generate} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generate"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {insights === null && (
          <p className="text-sm text-muted-foreground">
            Click Generate to analyze fees, attendance, and expenses.
          </p>
        )}
        {insights?.length === 0 && (
          <p className="text-sm text-muted-foreground">No insights available.</p>
        )}
        {insights?.map((i, idx) => (
          <div key={idx} className="rounded-md border p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium text-sm">{i.title}</p>
              <Badge variant="outline" className={PRIORITY_COLORS[i.priority]}>
                {i.priority}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{i.detail}</p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-2">
              {i.category}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default AIInsightsCard;
