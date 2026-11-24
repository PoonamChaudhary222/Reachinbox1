import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { EmailList } from '../components/EmailList/EmailList';
import { Header } from '../components/Header/Header';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { extractErrorMessage } from '../services/api';
import { emailService } from '../services/emailService';
import { EmailRecord, EmailStatus } from '../types';

type TabKey = 'ALL' | 'SCHEDULED' | 'SENT';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<TabKey>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<EmailStatus | ''>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const [emails, setEmails] = useState<EmailRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [statsVersion, setStatsVersion] = useState(0);

  const fetchEmails = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const hasSearchOrDate = Boolean(searchQuery.trim() || dateFrom || dateTo);
      const effectiveStatus =
        statusFilter ||
        (activeTab === 'SCHEDULED'
          ? 'SCHEDULED'
          : activeTab === 'SENT'
          ? 'SENT'
          : undefined);

      const data = hasSearchOrDate
        ? await emailService.searchEmails({
            q: searchQuery.trim() || undefined,
            status: effectiveStatus,
            dateFrom: dateFrom ? new Date(dateFrom).toISOString() : undefined,
            dateTo: dateTo ? new Date(dateTo).toISOString() : undefined,
            page,
            limit: 25,
          })
        : activeTab === 'SCHEDULED'
        ? await emailService.getScheduledEmails({ page, limit: 25 })
        : activeTab === 'SENT'
        ? await emailService.getSentEmails({ page, limit: 25 })
        : await emailService.getAllEmails({
            status: statusFilter || undefined,
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
  }, [activeTab, searchQuery, statusFilter, dateFrom, dateTo, page]);

  useEffect(() => {
    const timer = setTimeout(fetchEmails, searchQuery ? 250 : 0);
    return () => clearTimeout(timer);
  }, [fetchEmails, searchQuery]);

  const handleToggleStar = async (id: string) => {
    try {
      const updated = await emailService.toggleStar(id);
      setEmails((prev) => prev.map((e) => (e.id === id ? updated : e)));
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  const handleCancelOrDelete = async (id: string) => {
    try {
      const res = await emailService.cancelOrDelete(id);
      toast.success(res.action === 'cancelled' ? 'Scheduled email cancelled' : 'Email deleted');
      setStatsVersion((v) => v + 1);
      fetchEmails();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  const handleBulkCancelOrDelete = async (ids: string[]) => {
    try {
      await Promise.all(ids.map((id) => emailService.cancelOrDelete(id)));
      toast.success(`Processed ${ids.length} email(s)`);
      setStatsVersion((v) => v + 1);
      fetchEmails();
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
        onRefresh={fetchEmails}
        refreshing={loading}
        showFilterToggle
        filterActive={showFilters || Boolean(statusFilter || dateFrom || dateTo)}
        onToggleFilter={() => setShowFilters((p) => !p)}
      />

      {/* Category Tabs */}
      <div className="flex items-center gap-6 border-b border-gray-100 px-5 text-xs">
        {(
          [
            { key: 'ALL', label: 'All Emails' },
            { key: 'SCHEDULED', label: 'Scheduled Emails' },
            { key: 'SENT', label: 'Sent Emails' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => {
              setActiveTab(tab.key);
              setStatusFilter('');
              setPage(1);
            }}
            className={`border-b-2 py-2.5 font-medium transition-colors ${
              activeTab === tab.key
                ? 'border-[#00A838] text-[#00A838]'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Collapsible Filter Controls */}
      {showFilters && (
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 bg-[#FAFAFA] px-5 py-2.5 text-xs">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as EmailStatus | '');
              setPage(1);
            }}
            className="rounded border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-700 focus:border-[#00A838] focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="SENT">Sent</option>
            <option value="FAILED">Failed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          <div className="flex items-center gap-1.5">
            <span className="text-gray-500">From:</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              className="rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-gray-500">To:</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              className="rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700"
            />
          </div>

          {(statusFilter || dateFrom || dateTo) && (
            <button
              type="button"
              onClick={() => {
                setStatusFilter('');
                setDateFrom('');
                setDateTo('');
              }}
              className="text-xs font-medium text-[#00A838] hover:underline"
            >
              Reset filters
            </button>
          )}
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
        onCancelOrDelete={handleCancelOrDelete}
        onBulkCancelOrDelete={handleBulkCancelOrDelete}
      />
    </DashboardLayout>
  );
}
