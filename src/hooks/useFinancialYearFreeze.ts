import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface FrozenRange {
  start_date: string;
  end_date: string;
}

export function useFinancialYearFreeze() {
  const [frozenRanges, setFrozenRanges] = useState<FrozenRange[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("financial_years")
        .select("start_date, end_date")
        .eq("is_frozen", true);
      setFrozenRanges(data || []);
      setLoading(false);
    };
    load();
  }, []);

  const isDateFrozen = (dateStr: string): boolean => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return frozenRanges.some((r) => {
      const start = new Date(r.start_date);
      const end = new Date(r.end_date);
      return d >= start && d <= end;
    });
  };

  return { isDateFrozen, frozenRangesLoading: loading };
}
