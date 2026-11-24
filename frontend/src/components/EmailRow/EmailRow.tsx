import { Star, Trash2 } from 'lucide-react';
import React from 'react';
import { EmailRecord } from '../../types';
import { extractTextSnippet } from '../../utils/formatters';
import { StatusBadge } from '../StatusBadge/StatusBadge';

interface EmailRowProps {
  email: EmailRecord;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onOpen: (id: string) => void;
  onToggleStar: (id: string) => void;
  onCancelOrDelete?: (id: string) => void;
}

export function EmailRow({
  email,
  selected,
  onToggleSelect,
  onOpen,
  onToggleStar,
  onCancelOrDelete,
}: EmailRowProps) {
  const snippet = extractTextSnippet(email.body, email.textBody);

  const stop = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      onClick={() => onOpen(email.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onOpen(email.id);
      }}
      className={`group flex items-center gap-3.5 border-b border-gray-100 px-5 py-2.5 text-[13px] cursor-pointer transition-colors ${
        selected ? 'bg-[#F3FBF6]' : 'bg-white hover:bg-[#FAFAFA]'
      }`}
    >

      <div onClick={stop} className="flex items-center">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(email.id)}
          aria-label={`Select email to ${email.recipient}`}
          className="h-3.5 w-3.5 rounded border-gray-300 text-[#00A838] focus:ring-[#00A838]"
        />
      </div>

      <div className="w-48 shrink-0 truncate font-medium text-gray-800">
        To: {email.recipient}
      </div>

      <div className="w-44 shrink-0">
        <StatusBadge status={email.status} scheduledAt={email.scheduledAt} />
      </div>

      <div className="min-w-0 flex-1 truncate">
        <span className="font-semibold text-gray-900">{email.subject}</span>
        {snippet && <span className="text-gray-400"> – {snippet}</span>}
      </div>

      <div onClick={stop} className="flex shrink-0 items-center gap-2">
        {onCancelOrDelete && (
          <button
            type="button"
            onClick={() => onCancelOrDelete(email.id)}
            title={email.status === 'SCHEDULED' ? 'Cancel scheduled email' : 'Delete email'}
            className="hidden rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 group-hover:inline-flex"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={() => onToggleStar(email.id)}
          aria-label={email.starred ? 'Unstar email' : 'Star email'}
          className="rounded p-1 text-gray-300 hover:text-amber-400 transition-colors"
        >
          <Star
            className={`h-4 w-4 ${
              email.starred ? 'fill-amber-400 text-amber-400' : 'text-gray-300'
            }`}
          />
        </button>
      </div>
    </div>
  );
}
