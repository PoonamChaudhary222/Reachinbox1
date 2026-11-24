import {
  AlertCircle,
  ArrowLeft,
  Download,
  ExternalLink,
  FileText,
  Star,
  Trash2,
} from 'lucide-react';
import { EmailRecord } from '../../types';
import { formatDetailTimestamp, formatFileSize } from '../../utils/formatters';
import { StatusBadge } from '../StatusBadge/StatusBadge';

interface EmailDetailViewProps {
  email: EmailRecord;
  userAvatar?: string | null;
  userName?: string;
  onBack: () => void;
  onToggleStar: () => void;
  onCancelOrDelete: () => void;
}

export function EmailDetailView({
  email,
  userAvatar,
  userName,
  onBack,
  onToggleStar,
  onCancelOrDelete,
}: EmailDetailViewProps) {
  const senderInitial = (email.sender.displayName || email.sender.email || 'S')
    .charAt(0)
    .toUpperCase();

  const attachments = Array.isArray(email.attachments) ? email.attachments : [];

  return (
    <div className="flex min-h-screen flex-col bg-white">

      <div className="flex h-14 items-center justify-between border-b border-gray-100 px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
            aria-label="Back to emails"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="truncate text-[15px] font-semibold text-gray-900">
            {email.subject}
          </h1>
          <StatusBadge status={email.status} scheduledAt={email.scheduledAt} />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onToggleStar}
            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100"
            title="Toggle star"
          >
            <Star
              className={`h-4 w-4 ${
                email.starred ? 'fill-amber-400 text-amber-400' : 'text-gray-400'
              }`}
            />
          </button>
          <button
            type="button"
            onClick={onCancelOrDelete}
            className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
            title={email.status === 'SCHEDULED' ? 'Cancel scheduled email' : 'Delete email'}
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <div className="ml-2 flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-[#00A838] text-[11px] font-semibold text-white">
            {userAvatar ? (
              <img src={userAvatar} alt={userName || 'User'} className="h-full w-full object-cover" />
            ) : (
              (userName || 'U').charAt(0).toUpperCase()
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-4xl flex-1 px-8 py-6">

        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#00A838] text-sm font-semibold text-white">
              {senderInitial}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-1.5 text-[13px]">
                <span className="font-semibold text-gray-900">
                  {email.sender.displayName}
                </span>
                <span className="text-xs text-gray-400">
                  &lt;{email.sender.email}&gt;
                </span>
              </div>
              <div className="text-xs text-gray-500">
                to <span className="text-gray-700">{email.recipient}</span>
              </div>
            </div>
          </div>

          <div className="text-right text-xs text-gray-400">
            <div>
              {email.sentAt
                ? `Sent: ${formatDetailTimestamp(email.sentAt)}`
                : `Scheduled: ${formatDetailTimestamp(email.scheduledAt)}`}
            </div>
            {email.hourlyLimit && (
              <div className="mt-0.5 text-[11px] text-gray-400">
                Delay: {Math.round(email.delayBetweenEmailsMs / 1000)}s · Limit: {email.hourlyLimit}/hr
              </div>
            )}
          </div>
        </div>

        {email.status === 'FAILED' && email.errorMessage && (
          <div className="mb-5 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <span className="font-semibold">Delivery Failed:</span> {email.errorMessage}
            </div>
          </div>
        )}

        {email.etherealPreviewUrl && (
          <div className="mb-5 flex items-center justify-between rounded-lg border border-[#BFE8CD] bg-[#E8F7EE] px-3.5 py-2 text-xs text-gray-800">
            <span>Ethereal SMTP message captured for inspection.</span>
            <a
              href={email.etherealPreviewUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-medium text-[#00A838] hover:underline"
            >
              Open Ethereal Preview <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        )}

        <div
          className="prose prose-sm max-w-none text-[13.5px] leading-relaxed text-gray-800"
          dangerouslySetInnerHTML={{ __html: email.body }}
        />

        {attachments.length > 0 && (
          <div className="mt-8 border-t border-gray-100 pt-5">
            <div className="mb-3 text-xs font-medium text-gray-500">
              Attachments ({attachments.length})
            </div>
            <div className="flex flex-wrap gap-3">
              {attachments.map((att, idx) => {
                const isImage = att.mimeType.startsWith('image/') && att.dataUrl;
                return (
                  <div
                    key={`${att.name}-${idx}`}
                    className="w-44 overflow-hidden rounded-lg border border-gray-200 bg-white"
                  >
                    {isImage ? (
                      <img
                        src={att.dataUrl}
                        alt={att.name}
                        className="h-24 w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-24 w-full items-center justify-center bg-gray-50 text-gray-400">
                        <FileText className="h-8 w-8" />
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-2 border-t border-gray-100 px-2.5 py-2">
                      <div className="min-w-0">
                        <div className="truncate text-[11px] font-medium text-gray-800">
                          {att.name}
                        </div>
                        <div className="text-[10px] text-gray-400">
                          {formatFileSize(att.size)}
                        </div>
                      </div>
                      {att.dataUrl && (
                        <a
                          href={att.dataUrl}
                          download={att.name}
                          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                          title="Download attachment"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
