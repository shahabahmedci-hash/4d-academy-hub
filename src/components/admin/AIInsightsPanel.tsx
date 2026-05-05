import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  Sparkles, 
  RefreshCw, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  AlertTriangle,
  CheckCircle,
  Info,
  Lightbulb
} from "lucide-react";

interface Insight {
  title: string;
  description: string;
  type: "positive" | "warning" | "info";
}

interface Recommendation {
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
}

interface AIInsightsData {
  summary: string;
  insights: Insight[];
  recommendations: Recommendation[];
  keyMetrics: {
    healthScore: number;
    trend: "up" | "down" | "stable";
  };
  rawMetrics: {
    totalStudents: number;
    totalClasses: number;
    totalRevenue: number;
    pendingAmount: number;
    overdueAmount: number;
    totalExpenses: number;
    netProfit: number;
    attendanceRate: string | number;
    expensesByCategory: Record<string, number>;
  };
}

const AIInsightsPanel = () => {
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<AIInsightsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchInsights = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke("ai-analytics");
      
      if (fnError) throw fnError;
      
      if (data?.success) {
        setInsights(data.data);
      } else {
        throw new Error(data?.error || "Failed to fetch insights");
      }
    } catch (err) {
      console.error("Error fetching AI insights:", err);
      const message = err instanceof Error ? err.message : "Failed to load AI insights";
      setError(message);
      toast({
        variant: "destructive",
        title: "Error",
        description: message,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, []);

  const getInsightIcon = (type: string) => {
    switch (type) {
      case "positive":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      default:
        return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "up":
        return <TrendingUp className="h-5 w-5 text-green-500" />;
      case "down":
        return <TrendingDown className="h-5 w-5 text-red-500" />;
      default:
        return <Minus className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "destructive";
      case "medium":
        return "default";
      default:
        return "secondary";
    }
  };

  const getHealthScoreColor = (score: number) => {
    if (score >= 80) return "text-green-500";
    if (score >= 60) return "text-yellow-500";
    return "text-red-500";
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary animate-pulse" />
            <CardTitle>AI Insights</CardTitle>
          </div>
          <CardDescription>Analyzing your data...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <CardTitle>AI Insights</CardTitle>
            </div>
            <Button variant="outline" size="sm" onClick={fetchInsights}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!insights) return null;

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <CardTitle>AI Insights</CardTitle>
            </div>
            <Button variant="outline" size="sm" onClick={fetchInsights} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
          <CardDescription>AI-powered analysis and recommendations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Business Health:</span>
              <span className={`text-2xl font-bold ${getHealthScoreColor(insights.keyMetrics.healthScore)}`}>
                {insights.keyMetrics.healthScore}%
              </span>
              {getTrendIcon(insights.keyMetrics.trend)}
            </div>
          </div>
          <p className="text-muted-foreground">{insights.summary}</p>
        </CardContent>
      </Card>

      {/* Insights Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Info className="h-5 w-5 text-blue-500" />
              Key Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {insights.insights.map((insight, index) => (
              <div key={index} className="flex gap-3 p-3 rounded-lg bg-muted/50">
                {getInsightIcon(insight.type)}
                <div>
                  <h4 className="font-medium">{insight.title}</h4>
                  <p className="text-sm text-muted-foreground">{insight.description}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-yellow-500" />
              Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {insights.recommendations.map((rec, index) => (
              <div key={index} className="flex gap-3 p-3 rounded-lg bg-muted/50">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium">{rec.title}</h4>
                    <Badge variant={getPriorityColor(rec.priority) as "destructive" | "default" | "secondary"}>
                      {rec.priority}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{rec.description}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Detailed Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Financial Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
              <p className="text-sm text-muted-foreground">Total Revenue</p>
              <p className="text-2xl font-bold text-green-600">₹{insights.rawMetrics.totalRevenue.toLocaleString()}</p>
            </div>
            <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/20">
              <p className="text-sm text-muted-foreground">Total Expenses</p>
              <p className="text-2xl font-bold text-orange-600">₹{insights.rawMetrics.totalExpenses.toLocaleString()}</p>
            </div>
            <div className={`p-4 rounded-lg ${insights.rawMetrics.netProfit >= 0 ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
              <p className="text-sm text-muted-foreground">Net Profit</p>
              <p className={`text-2xl font-bold ${insights.rawMetrics.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>₹{insights.rawMetrics.netProfit.toLocaleString()}</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <p className="text-sm text-muted-foreground">Pending Fees</p>
              <p className="text-2xl font-bold text-yellow-600">₹{insights.rawMetrics.pendingAmount.toLocaleString()}</p>
            </div>
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-sm text-muted-foreground">Overdue Fees</p>
              <p className="text-2xl font-bold text-red-600">₹{insights.rawMetrics.overdueAmount.toLocaleString()}</p>
            </div>
          </div>

          {insights.rawMetrics.expensesByCategory && Object.keys(insights.rawMetrics.expensesByCategory).length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-3">Expense Breakdown by Category</h4>
              <div className="grid gap-2">
                {Object.entries(insights.rawMetrics.expensesByCategory).map(([category, amount]) => (
                  <div key={category} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <span className="text-sm font-medium capitalize">{category.replace(/_/g, ' ')}</span>
                    <span className="text-sm font-bold">₹{Number(amount).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AIInsightsPanel;
