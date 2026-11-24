import { CheckCircle2, ExternalLink, LogOut, Pencil, Plus, Trash2 } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Spinner } from '../components/Loading/Spinner';
import { useAuth } from '../context/AuthContext';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { API_BASE_URL, extractErrorMessage } from '../services/api';
import { senderService } from '../services/senderService';
import { slackService } from '../services/slackService';
import { Sender, SlackStatus } from '../types';

export default function Settings() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [senders, setSenders] = useState<Sender[]>([]);
  const [loadingSenders, setLoadingSenders] = useState(true);

  const [newSenderEmail, setNewSenderEmail] = useState('');
  const [newSenderName, setNewSenderName] = useState('');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [showSmtpFields, setShowSmtpFields] = useState(false);
  const [creatingSender, setCreatingSender] = useState(false);

  const [editingSenderId, setEditingSenderId] = useState<string | null>(null);
  const [editSmtpHost, setEditSmtpHost] = useState('smtp.gmail.com');
  const [editSmtpPort, setEditSmtpPort] = useState('465');
  const [editSmtpUser, setEditSmtpUser] = useState('');
  const [editSmtpPass, setEditSmtpPass] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const [slackStatus, setSlackStatus] = useState<SlackStatus | null>(null);
  const [loadingSlack, setLoadingSlack] = useState(true);

  const loadSenders = useCallback(async () => {
    setLoadingSenders(true);
    try {
      const list = await senderService.listSenders();
      setSenders(list);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setLoadingSenders(false);
    }
  }, []);

  const loadSlack = useCallback(async () => {
    setLoadingSlack(true);
    try {
      const status = await slackService.getStatus();
      setSlackStatus(status);
    } catch {
      setSlackStatus({ connected: false, integration: null });
    } finally {
      setLoadingSlack(false);
    }
  }, []);

  useEffect(() => {
    loadSenders();
    loadSlack();
  }, [loadSenders, loadSlack]);

  useEffect(() => {
    const slackParam = searchParams.get('slack');
    if (slackParam === 'connected') {
      toast.success('Slack workspace connected successfully!');
      loadSlack();
    } else if (slackParam === 'error') {
      const reason = searchParams.get('reason') || 'Slack OAuth failed';
      toast.error(decodeURIComponent(reason));
    }
  }, [searchParams, loadSlack]);

  const handleAddSender = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSenderEmail.trim() || !newSenderName.trim()) {
      toast.error('Sender email and display name are required.');
      return;
    }
    setCreatingSender(true);
    try {
      await senderService.createSender({
        email: newSenderEmail.trim(),
        displayName: newSenderName.trim(),
        smtpHost: smtpHost.trim() || undefined,
        smtpPort: smtpPort ? Number(smtpPort) : undefined,
        smtpUser: smtpUser.trim() || undefined,
        smtpPass: smtpPass || undefined,
      });
      toast.success('Sender added');
      setNewSenderEmail('');
      setNewSenderName('');
      setSmtpHost('');
      setSmtpPort('');
      setSmtpUser('');
      setSmtpPass('');
      setShowSmtpFields(false);
      loadSenders();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setCreatingSender(false);
    }
  };

  const handleDeleteSender = async (id: string) => {
    try {
      await senderService.deleteSender(id);
      toast.success('Sender removed');
      loadSenders();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  const openEditSmtp = (sender: Sender) => {
    setEditingSenderId(sender.id);
    setEditSmtpHost(sender.smtpHost || 'smtp.gmail.com');
    setEditSmtpPort(String(sender.smtpPort || 465));
    setEditSmtpUser(sender.smtpUser || sender.email);
    setEditSmtpPass('');
  };

  const handleSaveEditSmtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSenderId) return;
    setSavingEdit(true);
    try {
      await senderService.updateSender(editingSenderId, {
        smtpHost: editSmtpHost.trim(),
        smtpPort: Number(editSmtpPort) || 465,
        smtpUser: editSmtpUser.trim(),
        ...(editSmtpPass ? { smtpPass: editSmtpPass } : {}),
      });
      toast.success('SMTP settings updated! Future emails from this sender will use this SMTP.');
      setEditingSenderId(null);
      setEditSmtpPass('');
      loadSenders();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setSavingEdit(false);
    }
  };

  const handleSlackConnect = () => {
    window.location.href = slackService.getConnectUrl();
  };

  const handleSlackDisconnect = async () => {
    try {
      await slackService.disconnect();
      toast.success('Slack disconnected');
      loadSlack();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <DashboardLayout>
      <div className="border-b border-gray-100 px-6 py-4">
        <h1 className="text-[15px] font-semibold text-gray-900">Settings</h1>
      </div>

      <div className="mx-auto w-full max-w-3xl space-y-6 px-6 py-6">

        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-4 text-xs font-semibold tracking-wider text-gray-400 uppercase">
            Account
          </h2>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="h-10 w-10 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#00A838] text-sm font-semibold text-white">
                  {(user?.name || 'U').charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <div className="text-sm font-semibold text-gray-900">{user?.name}</div>
                <div className="text-xs text-gray-500">{user?.email}</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {user?.role === 'ADMIN' && (
                <a
                  href={`${API_BASE_URL}/admin/queues`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  Bull Board <ExternalLink className="h-3 w-3" />
                </a>
              )}
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-white px-3.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
              >
                <LogOut className="h-3.5 w-3.5" />
                Logout
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xs font-semibold tracking-wider text-gray-400 uppercase">
              Sender Accounts
            </h2>
            <span className="text-[11px] text-gray-400">
              Supports multiple senders &amp; per-sender Ethereal/SMTP credentials
            </span>
          </div>

          {loadingSenders ? (
            <div className="py-6">
              <Spinner size="sm" label="Loading senders..." />
            </div>
          ) : (
            <div className="mb-5 divide-y divide-gray-100 rounded-lg border border-gray-100">
              {senders.length === 0 ? (
                <div className="px-4 py-4 text-xs text-gray-500">
                  No sender accounts configured yet. Add one below.
                </div>
              ) : (
                senders.map((sender) => (
                  <div key={sender.id} className="px-4 py-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 font-medium text-gray-900">
                          {sender.displayName}
                          {sender.isDefault && (
                            <span className="rounded-full bg-[#E8F7EE] px-2 py-0.5 text-[10px] font-medium text-[#00A838]">
                              Default
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          {sender.email}
                          {sender.smtpHost
                            ? ` · ${sender.smtpHost}:${sender.smtpPort || 587}`
                            : ' · Default Ethereal SMTP'}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            editingSenderId === sender.id
                              ? setEditingSenderId(null)
                              : openEditSmtp(sender)
                          }
                          className="inline-flex items-center gap-1 rounded border border-gray-200 px-2 py-1 text-[11px] font-medium text-gray-600 hover:bg-gray-50"
                          title="Configure SMTP for real email delivery"
                        >
                          <Pencil className="h-3 w-3" />
                          {sender.smtpHost ? 'Edit SMTP' : 'Configure SMTP'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSender(sender.id)}
                          className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                          title="Remove sender"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {editingSenderId === sender.id && (
                      <form
                        onSubmit={handleSaveEditSmtp}
                        className="mt-3 grid grid-cols-1 gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 sm:grid-cols-2"
                      >
                        <input
                          type="text"
                          placeholder="SMTP Host (e.g. smtp.gmail.com)"
                          value={editSmtpHost}
                          onChange={(e) => setEditSmtpHost(e.target.value)}
                          className="rounded border border-gray-200 bg-white px-2.5 py-1.5 text-xs"
                        />
                        <input
                          type="number"
                          placeholder="SMTP Port (465 or 587)"
                          value={editSmtpPort}
                          onChange={(e) => setEditSmtpPort(e.target.value)}
                          className="rounded border border-gray-200 bg-white px-2.5 py-1.5 text-xs"
                        />
                        <input
                          type="text"
                          placeholder="SMTP Username (your Gmail)"
                          value={editSmtpUser}
                          onChange={(e) => setEditSmtpUser(e.target.value)}
                          className="rounded border border-gray-200 bg-white px-2.5 py-1.5 text-xs"
                        />
                        <input
                          type="password"
                          placeholder="16-char Gmail App Password"
                          value={editSmtpPass}
                          onChange={(e) => setEditSmtpPass(e.target.value)}
                          className="rounded border border-gray-200 bg-white px-2.5 py-1.5 text-xs"
                        />
                        <div className="flex items-center justify-end gap-2 sm:col-span-2">
                          <button
                            type="button"
                            onClick={() => setEditingSenderId(null)}
                            className="rounded-full px-3 py-1 text-[11px] text-gray-600 hover:bg-gray-200"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={savingEdit}
                            className="rounded-full bg-[#00A838] px-3.5 py-1 text-[11px] font-medium text-white hover:bg-[#008F30] disabled:opacity-60"
                          >
                            {savingEdit ? 'Saving...' : 'Save SMTP'}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          <form onSubmit={handleAddSender} className="space-y-3 border-t border-gray-100 pt-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input
                type="text"
                placeholder="Display Name (e.g. Oliver Brown)"
                value={newSenderName}
                onChange={(e) => setNewSenderName(e.target.value)}
                className="rounded-md border border-gray-200 px-3 py-1.5 text-xs focus:border-[#00A838] focus:outline-none"
              />
              <input
                type="email"
                placeholder="Sender Email (e.g. outreach@domain.io)"
                value={newSenderEmail}
                onChange={(e) => setNewSenderEmail(e.target.value)}
                className="rounded-md border border-gray-200 px-3 py-1.5 text-xs focus:border-[#00A838] focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowSmtpFields((p) => !p)}
                className="text-[11px] font-medium text-gray-500 hover:text-[#00A838]"
              >
                {showSmtpFields
                  ? 'Hide custom SMTP fields'
                  : '+ Configure custom SMTP credentials (optional)'}
              </button>

              <button
                type="submit"
                disabled={creatingSender}
                className="inline-flex items-center gap-1 rounded-full bg-[#00A838] px-4 py-1.5 text-xs font-medium text-white hover:bg-[#008F30] disabled:opacity-60"
              >
                <Plus className="h-3.5 w-3.5" />
                {creatingSender ? 'Adding...' : 'Add Sender'}
              </button>
            </div>

            {showSmtpFields && (
              <div className="grid grid-cols-1 gap-2.5 rounded-lg bg-gray-50 p-3 sm:grid-cols-2">
                <input
                  type="text"
                  placeholder="SMTP Host (e.g. smtp.ethereal.email)"
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  className="rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs"
                />
                <input
                  type="number"
                  placeholder="SMTP Port (e.g. 587)"
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(e.target.value)}
                  className="rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs"
                />
                <input
                  type="text"
                  placeholder="SMTP Username"
                  value={smtpUser}
                  onChange={(e) => setSmtpUser(e.target.value)}
                  className="rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs"
                />
                <input
                  type="password"
                  placeholder="SMTP Password (encrypted at rest)"
                  value={smtpPass}
                  onChange={(e) => setSmtpPass(e.target.value)}
                  className="rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs"
                />
              </div>
            )}
          </form>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-2 text-xs font-semibold tracking-wider text-gray-400 uppercase">
            Slack Rate-Limit Notifications
          </h2>
          <p className="mb-4 text-xs text-gray-500">
            Receive real-time Slack alerts whenever a sender reaches its configured hourly sending limit.
          </p>

          {loadingSlack ? (
            <Spinner size="sm" label="Checking Slack status..." />
          ) : slackStatus?.connected && slackStatus.integration ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#BFE8CD] bg-[#E8F7EE] px-4 py-3">
              <div className="flex items-center gap-2.5 text-xs">
                <CheckCircle2 className="h-4 w-4 text-[#00A838]" />
                <div>
                  <div className="font-semibold text-gray-900">
                    Connected to {slackStatus.integration.teamName || slackStatus.integration.teamId}
                  </div>
                  <div className="text-[11px] text-gray-600">
                    {slackStatus.integration.channelName
                      ? `Channel: #${slackStatus.integration.channelName}`
                      : 'Workspace connected'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSlackConnect}
                  className="rounded-full border border-[#00A838] bg-white px-3 py-1 text-xs font-medium text-[#00A838] hover:bg-gray-50"
                >
                  Reconnect Slack
                </button>
                <button
                  type="button"
                  onClick={handleSlackDisconnect}
                  className="rounded-full border border-red-200 bg-white px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  Disconnect
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
              <div className="text-xs text-gray-600">
                Slack is currently <span className="font-medium text-gray-800">not connected</span>.
              </div>
              <button
                type="button"
                onClick={handleSlackConnect}
                className="rounded-full bg-[#00A838] px-4 py-1.5 text-xs font-medium text-white hover:bg-[#008F30]"
              >
                Connect Slack
              </button>
            </div>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}
