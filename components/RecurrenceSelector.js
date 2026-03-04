import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Repeat, X, ChevronRight } from 'lucide-react';
import { getRecurrenceDescription } from '@/lib/recurrence';

export default function RecurrenceSelector({ recurrence, onChange, dueDate }) {
  const [showOptions, setShowOptions] = useState(false);

  const quickOptions = [
    { label: 'Every day', value: { type: 'daily', interval: 1 } },
    { label: 'Every week', value: { type: 'weekly', interval: 1 } },
    { label: 'Every weekday (Mon - Fri)', value: { type: 'weekday' } },
    { label: 'Every month', value: { type: 'monthly', interval: 1 } },
    { label: 'Every year', value: { type: 'yearly', interval: 1 } },
  ];

  // Add specific day/month options if due date is set
  if (dueDate) {
    const date = new Date(dueDate);
    const dayOfMonth = date.getDate();
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
    const monthDay = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

    quickOptions.splice(2, 0, {
      label: `Every week on ${dayName}`,
      value: { type: 'weekly', interval: 1, dayOfWeek: date.getDay() }
    });

    quickOptions.splice(4, 0, {
      label: `Every month on the ${dayOfMonth}${getDaySuffix(dayOfMonth)}`,
      value: { type: 'monthly', interval: 1, dayOfMonth }
    });

    quickOptions.splice(6, 0, {
      label: `Every year on ${monthDay}`,
      value: { type: 'yearly', interval: 1 }
    });
  }

  const handleSelect = (pattern) => {
    onChange(pattern);
    setShowOptions(false);
  };

  const handleClear = () => {
    onChange(null);
    setShowOptions(false);
  };

  return (
    <div className="relative">
      <Button
        type="button"
        variant={recurrence ? "default" : "outline"}
        size="sm"
        onClick={() => setShowOptions(!showOptions)}
        className="gap-2"
      >
        <Repeat size={14} />
        {recurrence ? getRecurrenceDescription(recurrence) : 'Repeat'}
      </Button>

      {showOptions && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowOptions(false)} />
          <div className="absolute left-0 top-full mt-1 bg-popover border rounded-lg shadow-lg py-1 min-w-[240px] max-w-[280px] z-50">
            <div className="px-3 py-2 border-b">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Repeat</span>
                {recurrence && (
                  <button
                    onClick={handleClear}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="py-1">
              {quickOptions.map((option, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelect(option.value)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center justify-between ${
                    JSON.stringify(recurrence) === JSON.stringify(option.value)
                      ? 'bg-muted font-medium'
                      : ''
                  }`}
                >
                  <span>{option.label}</span>
                  {JSON.stringify(recurrence) === JSON.stringify(option.value) && (
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function getDaySuffix(day) {
  if (day >= 11 && day <= 13) return 'th';
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}
