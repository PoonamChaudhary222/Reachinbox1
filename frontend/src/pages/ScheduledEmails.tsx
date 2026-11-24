import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { EmailList } from '../components/EmailList/EmailList';
import { Header } from '../components/Header/Header';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { extractErrorMessage } from '../services/api';
import { emailService } from '../services/emailService';
import { senderService } from '../services/senderService';
import { EmailRecord, Sender } from '../types';

export default function ScheduledEmails() {
  const [searchQuery, setSearchQuery] = useState('');
  const [senderId, setSenderId] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showFilters, setShowFilters] = useState(false);
  const [senders, setSenders] = useState<Sender[]>([]);

  const [emails, setEmails] = useState<EmailRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [statsVersion, setStatsVersion] = useState(0);

  useEffect(() => {
    senderService.listSenders().then(setSenders).catch(() => {});
  }, []);

  const fetchScheduled = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await emailService.getScheduledEmails({
        search: searchQuery.trim() || undefined,
        senderId: senderId || undefined,
        sortBy: 'scheduledAt',
        sortOrder,
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
  }, [searchQuery, senderId, sortOrder, page]);

  useEffect(() => {
    const timer = setTimeout(fetchScheduled, searchQuery ? 250 : 0);
    return () => clearTimeout(timer);
  }, [fetchScheduled, searchQuery]);

  const handleToggleStar = async (id: string) => {
    try {
      const updated = await emailService.toggleStar(id);
      setEmails((prev) => prev.map((e) => (e.id === id ? updated : e)));
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await emailService.cancelOrDelete(id);
      toast.success('Scheduled email cancelled');
      setStatsVersion((v) => v + 1);
      fetchScheduled();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  const handleBulkCancel = async (ids: string[]) => {
    try {
      await Promise.all(ids.map((id) => emailService.cancelOrDelete(id)));
      toast.success(`Cancelled ${ids.length} scheduled email(s)`);
      setStatsVersion((v) => v + 1);
      fetchScheduled();
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
        onRefresh={fetchScheduled}
        refreshing={loading}
        showFilterToggle
        filterActive={showFilters || Boolean(senderId)}
        onToggleFilter={() => setShowFilters((p) => !p)}
      />

      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-2.5">
        <h1 className="text-xs font-semibold text-gray-800">Scheduled Emails</h1>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-400">Sort by time:</span>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
            className="rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 focus:outline-none"
          >
            <option value="asc">Soonest first</option>
            <option value="desc">Latest first</option>
          </select>
        </div>
      </div>

      {showFilters && (
        <div className="flex items-center gap-3 border-b border-gray-100 bg-[#FAFAFA] px-5 py-2 text-xs">
          <span className="text-gray-500">Sender:</span>
          <select
            value={senderId}
            onChange={(e) => {
              setSenderId(e.target.value);
              setPage(1);
            }}
            className="rounded border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-700"
          >
            <option value="">All Senders</option>
            {senders.map((s) => (
              <option key={s.id} value={s.id}>
                {s.email}
              </option>
            ))}
          </select>
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
        onCancelOrDelete={handleCancel}
        onBulkCancelOrDelete={handleBulkCancel}
        emptyTitle="No scheduled emails"
        emptyDescription="Click Compose to schedule emails with custom delays and hourly rate limits."
      />
    </DashboardLayout>
  );
}
