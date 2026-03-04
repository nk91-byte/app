import { useState } from 'react';
import { Clock, Calendar as CalendarIcon, Repeat, X } from 'lucide-react';
import { getRecurrenceDescription } from '@/lib/recurrence';

export default function DueDatePicker({ dueDate, recurrence, onChange }) {
  const [showPicker, setShowPicker] = useState(false);
  const [showRecurrence, setShowRecurrence] = useState(false);

  const quickDates = [
    { label: 'Today', getValue: () => new Date().toISOString().split('T')[0] },
    { label: 'Tomorrow', getValue: () => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      return d.toISOString().split('T')[0];
    }},
  ];

  const recurrenceOptions = [
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

    recurrenceOptions.splice(2, 0, {
      label: `Every week on ${dayName}`,
      value: { type: 'weekly', interval: 1, dayOfWeek: date.getDay() }
    });

    recurrenceOptions.splice(4, 0, {
      label: `Every month on the ${dayOfMonth}${getDaySuffix(dayOfMonth)}`,
      value: { type: 'monthly', interval: 1, dayOfMonth }
    });

    recurrenceOptions.splice(6, 0, {
      label: `Every year on ${monthDay}`,
      value: { type: 'yearly', interval: 1 }
    });
  }

  const handleDateChange = (newDate) => {
    onChange({ dueDate: newDate, recurrence });
    setShowPicker(false);
    setShowRecurrence(false);
  };

  const handleRecurrenceChange = (newRecurrence) => {
    onChange({ dueDate, recurrence: newRecurrence });
    setShowPicker(false);
    setShowRecurrence(false);
  };

  const handleClearDueDate = () => {
    onChange({ dueDate: null, recurrence: null });
    setShowPicker(false);
    setShowRecurrence(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowPicker(!showPicker)}
        className="relative flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors rounded px-1.5 py-1 hover:bg-muted/50"
      >
        {dueDate ? (
          <div className="flex items-center gap-1.5">
            <Clock size={11} />
            {recurrence && <Repeat size={9} className="text-primary" />}
            <span className="text-[11px] font-medium">
              {new Date(dueDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-center" title="Set Due Date">
            <CalendarIcon size={12} />
          </div>
        )}
      </button>

      {showPicker && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => { setShowPicker(false); setShowRecurrence(false); }} />
          <div className="absolute left-0 top-full mt-1 bg-popover border rounded-lg shadow-lg py-1 min-w-[240px] z-50">
            {!showRecurrence ? (
              <>
                {/* Quick date options */}
                <div className="py-1">
                  {quickDates.map((option, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleDateChange(option.getValue())}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                <div className="border-t my-1" />

                {/* Calendar picker */}
                <div className="px-3 py-2">
                  <input
                    type="date"
                    value={dueDate || ''}
                    onChange={(e) => handleDateChange(e.target.value || null)}
                    className="w-full text-sm px-2 py-1.5 rounded border bg-background cursor-pointer"
                  />
                </div>

                {/* Repeat button */}
                {dueDate && (
                  <>
                    <div className="border-t my-1" />
                    <button
                      onClick={() => setShowRecurrence(true)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center justify-between"
                    >
                      <span className="flex items-center gap-2">
                        <Repeat size={14} />
                        {recurrence ? getRecurrenceDescription(recurrence) : 'Repeat'}
                      </span>
                    </button>
                  </>
                )}

                {/* Clear button */}
                {dueDate && (
                  <>
                    <div className="border-t my-1" />
                    <button
                      onClick={handleClearDueDate}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted text-muted-foreground"
                    >
                      Clear due date
                    </button>
                  </>
                )}
              </>
            ) : (
              <>
                {/* Recurrence options */}
                <div className="px-3 py-2 border-b">
                  <button
                    onClick={() => setShowRecurrence(false)}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    ← Back
                  </button>
                </div>
                <div className="py-1">
                  {recurrenceOptions.map((option, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleRecurrenceChange(option.value)}
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
                {recurrence && (
                  <>
                    <div className="border-t my-1" />
                    <button
                      onClick={() => handleRecurrenceChange(null)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted text-muted-foreground"
                    >
                      Clear repeat
                    </button>
                  </>
                )}
              </>
            )}
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
