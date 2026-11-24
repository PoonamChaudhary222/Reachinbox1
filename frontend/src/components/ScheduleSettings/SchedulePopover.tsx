import { Calendar, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Sender } from '../../types';

interface SchedulePopoverProps {
  open: boolean;
  startDate: string;
  startTime: string;
  delaySeconds: number;
  hourlyLimit: number;
  senderId: string;
  senders: Sender[];
  onChangeStartDate: (val: string) => void;
  onChangeStartTime: (val: string) => void;
  onChangeDelaySeconds: (val: number) => void;
  onChangeHourlyLimit: (val: number) => void;
  onChangeSenderId: (val: string) => void;
  onCancel: () => void;
  onDone: () => void;
}

function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toTimeString(date: Date): string {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function getTomorrowDateString(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return toDateString(tomorrow);
}

function parse12HourTime(time24: string): { hour12: number; minute: number; period: 'AM' | 'PM' } {
  const [hStr, mStr] = (time24 || '09:00').split(':');
  const h24 = Number(hStr) || 0;
  const minute = Number(mStr) || 0;
  const period: 'AM' | 'PM' = h24 >= 12 ? 'PM' : 'AM';
  const hour12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return { hour12, minute, period };
}

function to24HourTime(hour12: number, minute: number, period: 'AM' | 'PM'): string {
  let h24 = hour12 % 12;
  if (period === 'PM') h24 += 12;
  return `${String(h24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function formatReadableDateTime(dateStr: string, timeStr: string): string {
  const parsed = new Date(`${dateStr}T${timeStr || '09:00'}:00`);
  if (Number.isNaN(parsed.getTime())) return `${dateStr} ${timeStr}`;
  return parsed.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function SchedulePopover({
  open,
  startDate,
  startTime,
  delaySeconds,
  hourlyLimit,
  senderId,
  senders,
  onChangeStartDate,
  onChangeStartTime,
  onChangeDelaySeconds,
  onChangeHourlyLimit,
  onChangeSenderId,
  onCancel,
  onDone,
}: SchedulePopoverProps) {
  const [pickerExpanded, setPickerExpanded] = useState(true);

  const initialMonth = useMemo(() => {
    const d = startDate ? new Date(`${startDate}T00:00:00`) : new Date();
    return Number.isNaN(d.getTime()) ? new Date() : new Date(d.getFullYear(), d.getMonth(), 1);
  }, [startDate]);

  const [viewMonth, setViewMonth] = useState<Date>(initialMonth);

  if (!open) return null;

  const { hour12, minute, period } = parse12HourTime(startTime);

  const applyPreset = (hour: number, min = 0) => {
    const tmr = getTomorrowDateString();
    onChangeStartDate(tmr);
    onChangeStartTime(`${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`);
    const parsed = new Date(`${tmr}T00:00:00`);
    setViewMonth(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
  };

  const applyOffsetMinutes = (minutesFromNow: number) => {
    const target = new Date(Date.now() + minutesFromNow * 60 * 1000);
    onChangeStartDate(toDateString(target));
    onChangeStartTime(toTimeString(target));
    setViewMonth(new Date(target.getFullYear(), target.getMonth(), 1));
  };

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = toDateString(new Date());

  const calendarCells: Array<number | null> = [
    ...Array.from({ length: firstDayOfWeek }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const monthLabel = viewMonth.toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const handleSelectDay = (day: number) => {
    const picked = new Date(year, month, day);
    onChangeStartDate(toDateString(picked));
  };

  const updateTime = (nextHour12: number, nextMinute: number, nextPeriod: 'AM' | 'PM') => {
    onChangeStartTime(to24HourTime(nextHour12, nextMinute, nextPeriod));
  };

  return (
    <div className="absolute right-6 top-14 z-30 w-80 rounded-xl border border-gray-200 bg-white p-4 shadow-lg">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Send Later</h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => applyOffsetMinutes(1)}
            className="rounded-full bg-[#E8F7EE] px-2 py-0.5 text-[10px] font-medium text-[#00A838] hover:bg-[#D5F0E0]"
          >
            In 1 min
          </button>
          <button
            type="button"
            onClick={() => applyOffsetMinutes(5)}
            className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600 hover:bg-gray-200"
          >
            In 5 min
          </button>
        </div>
      </div>

      <div className="mb-2">
        <label className="mb-1 block text-[11px] font-medium text-gray-500">
          Pick date &amp; time
        </label>
        <button
          type="button"
          onClick={() => setPickerExpanded((prev) => !prev)}
          className="flex w-full items-center justify-between rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-left text-xs text-gray-800 hover:border-[#00A838] transition-colors"
        >
          <span className="flex items-center gap-2 font-medium">
            <Calendar className="h-3.5 w-3.5 shrink-0 text-[#00A838]" />
            {formatReadableDateTime(startDate, startTime)}
          </span>
          <span className="text-[10px] text-gray-400">
            {pickerExpanded ? 'Hide' : 'Edit'}
          </span>
        </button>
      </div>

      {pickerExpanded && (
        <div className="mb-3 rounded-lg border border-gray-100 bg-[#FAFAFA] p-2.5">

          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setViewMonth(new Date(year, month - 1, 1))}
              className="rounded p-1 text-gray-500 hover:bg-gray-200"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="text-xs font-semibold text-gray-800">{monthLabel}</span>
            <button
              type="button"
              onClick={() => setViewMonth(new Date(year, month + 1, 1))}
              className="rounded p-1 text-gray-500 hover:bg-gray-200"
              aria-label="Next month"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 text-center text-[10px] font-medium text-gray-400">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5 text-center text-[11px]">
            {calendarCells.map((day, idx) => {
              if (!day) return <div key={`empty-${idx}`} />;
              const cellDateStr = toDateString(new Date(year, month, day));
              const isSelected = cellDateStr === startDate;
              const isToday = cellDateStr === todayStr;

              return (
                <button
                  key={cellDateStr}
                  type="button"
                  onClick={() => handleSelectDay(day)}
                  className={`flex h-7 w-full items-center justify-center rounded-md transition-colors ${
                    isSelected
                      ? 'bg-[#00A838] font-semibold text-white'
                      : isToday
                      ? 'border border-[#00A838] text-[#00A838] font-medium hover:bg-[#E8F7EE]'
                      : 'text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          <div className="mt-2.5 flex items-center justify-between gap-1.5 border-t border-gray-200 pt-2">
            <span className="flex items-center gap-1 text-[11px] text-gray-500">
              <Clock className="h-3 w-3 text-gray-400" />
              Time
            </span>
            <div className="flex items-center gap-1">
              <select
                aria-label="Hour"
                value={hour12}
                onChange={(e) => updateTime(Number(e.target.value), minute, period)}
                className="rounded border border-gray-200 bg-white px-1.5 py-1 text-xs text-gray-800 focus:border-[#00A838] focus:outline-none"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, '0')}
                  </option>
                ))}
              </select>
              <span className="text-xs text-gray-400">:</span>
              <select
                aria-label="Minute"
                value={minute}
                onChange={(e) => updateTime(hour12, Number(e.target.value), period)}
                className="rounded border border-gray-200 bg-white px-1.5 py-1 text-xs text-gray-800 focus:border-[#00A838] focus:outline-none"
              >
                {Array.from({ length: 60 }, (_, i) => i).map((m) => (
                  <option key={m} value={m}>
                    {String(m).padStart(2, '0')}
                  </option>
                ))}
              </select>
              <select
                aria-label="AM or PM"
                value={period}
                onChange={(e) => updateTime(hour12, minute, e.target.value as 'AM' | 'PM')}
                className="rounded border border-gray-200 bg-white px-1.5 py-1 text-xs text-gray-800 focus:border-[#00A838] focus:outline-none"
              >
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
            </div>
          </div>
        </div>
      )}

      <div className="mb-3 divide-y divide-gray-100 border-y border-gray-100 text-xs">
        <button
          type="button"
          onClick={() => applyPreset(9, 0)}
          className="flex w-full items-center justify-between py-1.5 text-left text-gray-700 hover:text-[#00A838]"
        >
          <span>Tomorrow</span>
          <span className="text-[11px] text-gray-400">9:00 AM</span>
        </button>
        <button
          type="button"
          onClick={() => applyPreset(10, 0)}
          className="flex w-full items-center justify-between py-1.5 text-left text-gray-700 hover:text-[#00A838]"
        >
          <span>Tomorrow, 10:00 AM</span>
        </button>
        <button
          type="button"
          onClick={() => applyPreset(11, 0)}
          className="flex w-full items-center justify-between py-1.5 text-left text-gray-700 hover:text-[#00A838]"
        >
          <span>Tomorrow, 11:00 AM</span>
        </button>
        <button
          type="button"
          onClick={() => applyPreset(15, 0)}
          className="flex w-full items-center justify-between py-1.5 text-left text-gray-700 hover:text-[#00A838]"
        >
          <span>Tomorrow, 3:00 PM</span>
        </button>
      </div>

      <div className="mb-4 space-y-2 text-xs">
        <div>
          <label className="mb-1 block text-[11px] text-gray-500">Sender Account</label>
          <select
            value={senderId}
            onChange={(e) => onChangeSenderId(e.target.value)}
            className="w-full rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-800 focus:border-[#00A838] focus:outline-none"
          >
            {senders.map((s) => (
              <option key={s.id} value={s.id}>
                {s.email}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-[11px] text-gray-500">Delay (sec)</label>
            <input
              type="number"
              min={0}
              max={3600}
              value={delaySeconds}
              onChange={(e) => onChangeDelaySeconds(Number(e.target.value) || 0)}
              className="w-full rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-800 focus:border-[#00A838] focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-gray-500">Max / hour</label>
            <input
              type="number"
              min={1}
              max={10000}
              value={hourlyLimit}
              onChange={(e) => onChangeHourlyLimit(Math.max(1, Number(e.target.value) || 1))}
              className="w-full rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-800 focus:border-[#00A838] focus:outline-none"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-full border border-[#00A838] bg-white px-4 py-1 text-xs font-medium text-[#00A838] hover:bg-[#E8F7EE]"
        >
          Done
        </button>
      </div>
    </div>
  );
}
