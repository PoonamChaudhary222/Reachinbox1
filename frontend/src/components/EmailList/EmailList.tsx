import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EmailRecord } from '../../types';
import { EmptyState } from '../Common/EmptyState';
import { EmailRow } from '../EmailRow/EmailRow';
import { Spinner } from '../Loading/Spinner';

interface EmailListProps {
  emails: EmailRecord[];
  loading: boolean;
  error: string | null;
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (nextPage: number) => void;
  onToggleStar: (id: string) => void;
  onCancelOrDelete: (id: string) => void;
  onBulkCancelOrDelete?: (ids: string[]) => void;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function EmailList({
  emails,
  loading,
  error,
  page,
  totalPages,
  total,
  onPageChange,
  onToggleStar,
  onCancelOrDelete,
  onBulkCancelOrDelete,
  emptyTitle = 'No emails found',
  emptyDescription = 'Schedule a new email campaign or adjust your search filters.',
}: EmailListProps) {
  const navigate = useNavigate();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const allSelected = emails.length > 0 && emails.every((e) => selectedIds.includes(e.id));

  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(emails.map((e) => e.id));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <Spinner size="md" label="Loading emails..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="m-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
        {error}
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        action={
          <button
            type="button"
            onClick={() => navigate('/compose')}
            className="rounded-full bg-[#00A838] px-4 py-1.5 text-xs font-medium text-white hover:bg-[#008F30]"
          >
            Compose New Email
          </button>
        }
      />
    );
  }

  return (
    <div className="flex flex-1 flex-col bg-white">
      {/* Toolbar with Select-All + Pagination info */}
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-2 text-xs text-gray-500">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={handleSelectAll}
              className="h-3.5 w-3.5 rounded border-gray-300 text-[#00A838] focus:ring-[#00A838]"
            />
            <span>Select all</span>
          </label>
          {selectedIds.length > 0 && onBulkCancelOrDelete && (
            <button
              type="button"
              onClick={() => {
                onBulkCancelOrDelete(selectedIds);
                setSelectedIds([]);
              }}
              className="inline-flex items-center gap-1 rounded border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-600 hover:bg-red-100"
            >
              <Trash2 className="h-3 w-3" />
              Cancel / Delete ({selectedIds.length})
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span>
            {total} {total === 1 ? 'email' : 'emails'}
          </span>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
                className="rounded p-1 hover:bg-gray-100 disabled:opacity-40"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span className="px-1 text-[11px]">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => onPageChange(page + 1)}
                className="rounded p-1 hover:bg-gray-100 disabled:opacity-40"
                aria-label="Next page"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Compact email rows */}
      <div className="flex-1 divide-y divide-gray-50">
        {emails.map((email) => (
          <EmailRow
            key={email.id}
            email={email}
            selected={selectedIds.includes(email.id)}
            onToggleSelect={handleToggleSelect}
            onOpen={(id) => navigate(`/emails/${id}`)}
            onToggleStar={onToggleStar}
            onCancelOrDelete={onCancelOrDelete}
          />
        ))}
      </div>
    </div>
  );
}
