import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { DateRange, RANGE_PRESETS, formatRange } from "@/lib/dateRange";

interface Props {
  value?: DateRange;
  onChange: (range?: DateRange) => void;
  className?: string;
  allowClear?: boolean;
}

const DateRangePicker = ({ value, onChange, className, allowClear = true }: Props) => (
  <Popover>
    <PopoverTrigger asChild>
      <Button variant="outline" className={cn("justify-start font-normal", className)}>
        <CalendarIcon className="mr-2 h-4 w-4" />
        {formatRange(value)}
      </Button>
    </PopoverTrigger>
    <PopoverContent className="w-auto p-0" align="start">
      <div className="grid grid-cols-2 gap-2 border-b p-3 max-w-[20rem]">
        {RANGE_PRESETS.map((p) => (
          <Button key={p.label} size="sm" variant="secondary" className="text-xs" onClick={() => onChange(p.build())}>
            {p.label}
          </Button>
        ))}
        {allowClear && (
          <Button size="sm" variant="ghost" className="text-xs" onClick={() => onChange(undefined)}>
            Any date
          </Button>
        )}
      </div>

      <Calendar
        mode="range"
        selected={value}
        onSelect={onChange}
        numberOfMonths={1}
        defaultMonth={value?.from}
        initialFocus
        className={cn("p-3 pointer-events-auto")}
      />
    </PopoverContent>
  </Popover>
);

export default DateRangePicker;
