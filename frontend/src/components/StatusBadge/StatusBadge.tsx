import { Clock } from 'lucide-react';
import { EmailStatus } from '../../types';
import { formatShortScheduleTime } from '../../utils/formatters';

interface StatusBadgeProps {
  status: EmailStatus;
  scheduledAt: string;
}

export function StatusBadge({ status, scheduledAt }: StatusBadgeProps) {
  if (status === 'SCHEDULED' || status === 'PROCESSING') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF4E5] px-2.5 py-0.5 text-[11px] font-medium text-[#C26A0A] whitespace-nowrap">
        <Clock className="h-3 w-3 shrink-0" />
        {status === 'PROCESSING' ? 'Sending...' : formatShortScheduleTime(scheduledAt)}
      </span>
    );
  }

  if (status === 'SENT') {
    return (
      <span className="inline-flex items-center rounded-full bg-[#F3F4F6] px-2.5 py-0.5 text-[11px] font-medium text-gray-600 whitespace-nowrap">
        Sent
      </span>
    );
  }

  if (status === 'FAILED') {
    return (
      <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-[11px] font-medium text-red-600 whitespace-nowrap">
        Failed
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-500 whitespace-nowrap">
      Cancelled
    </span>
  );
}
