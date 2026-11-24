import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { EmailList } from '../components/EmailList/EmailList';
import { Header } from '../components/Header/Header';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { extractErrorMessage } from '../services/api';
import { emailService } from '../services/emailService';
import { EmailRecord, EmailStatus } from '../types';

export default function SentEmails() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SENT' | 'FAILED'>('ALL');
  const [showFilters, setShowFilters] = useState(false);

  const [emails, setEmails] = useState<EmailRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [statsVersion, setStatsVersion] = useState(0);

  const fetchSent = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const status: EmailStatus | undefined =
        statusFilter === 'ALL' ? undefined : statusFilter;

      const data = await emailService.getSentEmails({
        search: searchQuery.trim() || undefined,
        status,
        sortBy: 'sentAt',
        sortOrder: 'desc',
        page,
        limit: 25,
      });
      setEmails(data.items);
      setTotalPages(data.totalPages);
      setTotal(data.total);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [searchQuery, statusFilter, page]);

  useEffect(() => {
    const timer = setTimeout(fetchSent, searchQuery ? 250 : 0);
    return () => clearTimeout(timer);
  }, [fetchSent, searchQuery]);

  const handleToggleStar = async (id: string) => {
    try {
      const updated = await emailService.toggleStar(id);
      setEmails((prev) => prev.map((e) => (e.id === id ? updated : e)));
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await emailService.cancelOrDelete(id);
      toast.success('Email removed');
      setStatsVersion((v) => v + 1);
      fetchSent();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  return (
    <DashboardLayout statsRefreshTrigger={statsVersion}>
      <Header
        searchQuery={searchQuery}
        onSearchChange={(val) => {
          setSearchQuery(val);
          setPage(1);
        }}
        onRefresh={fetchSent}
        refreshing={loading}
        showFilterToggle
        filterActive={showFilters || statusFilter !== 'ALL'}
        onToggleFilter={() => setShowFilters((p) => !p)}
      />

      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-2.5">
        <h1 className="text-xs font-semibold text-gray-800">Sent Emails</h1>
        <div className="flex items-center gap-2 text-xs">
          {(['ALL', 'SENT', 'FAILED'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => {
                setStatusFilter(st);
                setPage(1);
              }}
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                statusFilter === st
                  ? 'bg-[#E8F7EE] text-[#00A838]'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {st === 'ALL' ? 'All' : st === 'SENT' ? 'Sent' : 'Failed'}
            </button>
          ))}
        </div>
      </div>

      {showFilters && (
        <div className="border-b border-gray-100 bg-[#FAFAFA] px-5 py-2 text-xs text-gray-500">
          Showing {statusFilter === 'ALL' ? 'Sent & Failed' : statusFilter} emails delivered via Ethereal SMTP.
        </div>
      )}

      <EmailList
        emails={emails}
        loading={loading}
        error={error}
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={setPage}
        onToggleStar={handleToggleStar}
        onCancelOrDelete={handleDelete}
        emptyTitle="No sent emails yet"
        emptyDescription="Delivered and failed emails will appear here once the BullMQ worker processes them."
      />
    </DashboardLayout>
  );
}
