import { ArrowLeft, Clock, FileText, Paperclip, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { extractErrorMessage } from '../../services/api';
import { emailService } from '../../services/emailService';
import { senderService } from '../../services/senderService';
import { EmailAttachment, Sender } from '../../types';
import { CsvParseResult, isValidEmail } from '../../utils/csvParser';
import { formatFileSize } from '../../utils/formatters';
import { CSVUploaderButton } from '../CSVUploader/CSVUploaderButton';
import { RichTextEditor } from '../RichTextEditor/RichTextEditor';
import { SchedulePopover } from '../ScheduleSettings/SchedulePopover';

function defaultStartDateAndTime() {
  const date = new Date(Date.now() + 5 * 60 * 1000);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return { date: `${y}-${m}-${d}`, time: `${hh}:${mm}` };
}

export function ComposeForm() {
  const navigate = useNavigate();
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const initialSchedule = defaultStartDateAndTime();

  const [senders, setSenders] = useState<Sender[]>([]);
  const [senderId, setSenderId] = useState('');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [recipientInput, setRecipientInput] = useState('');
  const [csvSummary, setCsvSummary] = useState<{
    fileName: string;
    result: CsvParseResult;
  } | null>(null);

  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [delaySeconds, setDelaySeconds] = useState<number>(2);
  const [hourlyLimit, setHourlyLimit] = useState<number>(100);
  const [startDate, setStartDate] = useState(initialSchedule.date);
  const [startTime, setStartTime] = useState(initialSchedule.time);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [attachments, setAttachments] = useState<EmailAttachment[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    senderService
      .listSenders()
      .then((list) => {
        setSenders(list);
        const def = list.find((s) => s.isDefault) || list[0];
        if (def) setSenderId(def.id);
      })
      .catch((err) => {
        toast.error(extractErrorMessage(err));
      });
  }, []);

  const addRecipientToken = (raw: string) => {
    const parts = raw
      .split(/[\s,;]+/)
      .map((p) => p.trim().toLowerCase())
      .filter(Boolean);

    if (parts.length === 0) return;

    const nextValid: string[] = [];
    const invalid: string[] = [];

    for (const part of parts) {
      if (isValidEmail(part)) {
        if (!recipients.includes(part) && !nextValid.includes(part)) {
          nextValid.push(part);
        }
      } else {
        invalid.push(part);
      }
    }

    if (nextValid.length > 0) {
      setRecipients((prev) => [...prev, ...nextValid]);
      setValidationError(null);
    }
    if (invalid.length > 0) {
      toast.error(`Invalid email skipped: ${invalid.join(', ')}`);
    }
    setRecipientInput('');
  };

  const handleRecipientKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === 'Tab') {
      if (recipientInput.trim()) {
        e.preventDefault();
        addRecipientToken(recipientInput);
      }
    } else if (e.key === 'Backspace' && !recipientInput && recipients.length > 0) {
      setRecipients((prev) => prev.slice(0, -1));
    }
  };

  const handleCsvParsed = (result: CsvParseResult, fileName: string) => {
    setCsvSummary({ fileName, result });
    setRecipients((prev) => {
      const merged = new Set([...prev, ...result.validEmails]);
      return Array.from(merged);
    });
    if (result.validEmails.length > 0) {
      setValidationError(null);
      toast.success(`Added ${result.validEmails.length} valid email(s) from ${fileName}`);
    } else {
      toast.error(`No valid email addresses detected in ${fileName}`);
    }
  };

  const handleAttachmentSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} exceeds 5 MB limit.`);
        continue;
      }
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.readAsDataURL(file);
      });
      setAttachments((prev) => [
        ...prev,
        {
          name: file.name,
          size: file.size,
          mimeType: file.type || 'application/octet-stream',
          dataUrl,
        },
      ]);
    }
    e.target.value = '';
  };

  const handleScheduleSubmit = async () => {
    setValidationError(null);

    // Include typed input if user forgot to press Enter
    let finalRecipients = [...recipients];
    if (recipientInput.trim()) {
      const candidate = recipientInput.trim().toLowerCase();
      if (isValidEmail(candidate)) {
        if (!finalRecipients.includes(candidate)) {
          finalRecipients.push(candidate);
        }
      } else {
        setValidationError(`Invalid recipient email address: ${recipientInput}`);
        return;
      }
    }

    if (!senderId) {
      setValidationError('Please select a sender account (configure one in Settings if empty).');
      return;
    }
    if (finalRecipients.length === 0) {
      setValidationError('Add at least one recipient email or upload a CSV/TXT list.');
      return;
    }
    if (!subject.trim()) {
      setValidationError('Subject is required.');
      return;
    }
    const strippedBody = body.replace(/<[^>]+>/g, '').trim();
    if (!strippedBody) {
      setValidationError('Email body cannot be empty.');
      return;
    }
    if (!startDate || !startTime) {
      setValidationError('Please pick a scheduled start date and time.');
      return;
    }

    const scheduledIso = new Date(`${startDate}T${startTime}:00`).toISOString();

    setSubmitting(true);
    try {
      const result = await emailService.scheduleEmails({
        senderId,
        recipients: finalRecipients,
        subject: subject.trim(),
        body,
        scheduledAt: scheduledIso,
        delayBetweenEmailsSeconds: delaySeconds,
        hourlyLimit,
        attachments,
      });

      toast.success(
        `Scheduled ${result.scheduledCount} email${result.scheduledCount === 1 ? '' : 's'} successfully!`
      );
      navigate('/scheduled');
    } catch (err) {
      const msg = extractErrorMessage(err);
      setValidationError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-white">
      {/* Top Header matching Compose Figma frames */}
      <header className="flex h-14 items-center justify-between border-b border-gray-100 px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="text-[15px] font-semibold text-gray-900">Compose New Email</h1>
        </div>

        <div className="flex items-center gap-2.5">
          <input
            ref={attachmentInputRef}
            type="file"
            multiple
            onChange={handleAttachmentSelected}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => attachmentInputRef.current?.click()}
            title="Attach file or image"
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setScheduleOpen((prev) => !prev)}
            title="Schedule sending settings"
            className={`rounded-md p-1.5 transition-colors ${
              scheduleOpen
                ? 'bg-[#E8F7EE] text-[#00A838]'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
            }`}
          >
            <Clock className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={handleScheduleSubmit}
            className="rounded-full border border-[#00A838] bg-[#00A838] px-4 py-1.5 text-xs font-medium text-white hover:bg-[#008F30] disabled:opacity-60 transition-colors"
          >
            {submitting ? 'Scheduling...' : 'Send Later'}
          </button>
        </div>
      </header>

      {/* Send Later Popover */}
      <SchedulePopover
        open={scheduleOpen}
        startDate={startDate}
        startTime={startTime}
        delaySeconds={delaySeconds}
        hourlyLimit={hourlyLimit}
        senderId={senderId}
        senders={senders}
        onChangeStartDate={setStartDate}
        onChangeStartTime={setStartTime}
        onChangeDelaySeconds={setDelaySeconds}
        onChangeHourlyLimit={setHourlyLimit}
        onChangeSenderId={setSenderId}
        onCancel={() => setScheduleOpen(false)}
        onDone={() => setScheduleOpen(false)}
      />

      {/* Compose Form Body */}
      <div className="mx-auto w-full max-w-4xl flex-1 px-8 py-5">
        {validationError && (
          <div
            role="alert"
            className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-xs text-red-700"
          >
            {validationError}
          </div>
        )}

        {/* FROM row */}
        <div className="flex items-center border-b border-gray-100 py-2.5">
          <label htmlFor="compose-from" className="w-20 shrink-0 text-xs text-gray-500">
            From
          </label>
          <select
            id="compose-from"
            value={senderId}
            onChange={(e) => setSenderId(e.target.value)}
            className="rounded-md bg-[#F3F4F6] px-2.5 py-1 text-xs font-medium text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#00A838]"
          >
            {senders.length === 0 && <option value="">No sender configured</option>}
            {senders.map((sender) => (
              <option key={sender.id} value={sender.id}>
                {sender.email}
              </option>
            ))}
          </select>
        </div>

        {/* TO row with chips + Upload List */}
        <div className="border-b border-gray-100 py-2.5">
          <div className="flex items-start gap-2">
            <label htmlFor="compose-to" className="w-20 shrink-0 pt-1 text-xs text-gray-500">
              To
            </label>
            <div className="flex flex-1 flex-wrap items-center gap-1.5">
              {recipients.map((email) => (
                <span
                  key={email}
                  className="inline-flex items-center gap-1 rounded-full border border-[#BFE8CD] bg-[#E8F7EE] px-2.5 py-0.5 text-[11px] font-medium text-[#008F30]"
                >
                  {email}
                  <button
                    type="button"
                    onClick={() => setRecipients((prev) => prev.filter((item) => item !== email))}
                    className="hover:text-red-600"
                    aria-label={`Remove ${email}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <input
                id="compose-to"
                type="text"
                value={recipientInput}
                onChange={(e) => setRecipientInput(e.target.value)}
                onKeyDown={handleRecipientKeyDown}
                onBlur={() => {
                  if (recipientInput.trim()) addRecipientToken(recipientInput);
                }}
                placeholder={
                  recipients.length === 0 ? 'recipient@example.com' : 'Add another email...'
                }
                className="min-w-[180px] flex-1 py-0.5 text-[13px] text-gray-800 placeholder-gray-400 focus:outline-none"
              />
            </div>

            <div className="pt-0.5">
              <CSVUploaderButton onParsed={handleCsvParsed} />
            </div>
          </div>

          {/* Detected CSV / Recipient Count Summary */}
          {(recipients.length > 0 || csvSummary) && (
            <div className="mt-1.5 pl-20 flex flex-wrap items-center gap-3 text-[11px] text-gray-500">
              <span className="font-medium text-[#00A838]">
                {recipients.length} valid recipient{recipients.length === 1 ? '' : 's'}
              </span>
              {csvSummary && (
                <>
                  <span>
                    CSV ({csvSummary.fileName}): {csvSummary.result.validEmails.length} valid
                  </span>
                  {csvSummary.result.invalidEmails.length > 0 && (
                    <span className="text-red-500">
                      {csvSummary.result.invalidEmails.length} invalid skipped
                    </span>
                  )}
                  {csvSummary.result.duplicateCount > 0 && (
                    <span>{csvSummary.result.duplicateCount} duplicates removed</span>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* SUBJECT row */}
        <div className="flex items-center border-b border-gray-100 py-2.5">
          <label htmlFor="compose-subject" className="w-20 shrink-0 text-xs text-gray-500">
            Subject
          </label>
          <input
            id="compose-subject"
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="w-full text-[13px] text-gray-900 placeholder-gray-400 focus:outline-none"
          />
        </div>

        {/* Inline Delay & Hourly Limit row matching Figma */}
        <div className="flex flex-wrap items-center gap-6 border-b border-gray-100 py-2.5 text-xs text-gray-600">
          <div className="flex items-center gap-2">
            <label htmlFor="compose-delay">Delay between 2 emails</label>
            <input
              id="compose-delay"
              type="number"
              min={0}
              max={3600}
              value={delaySeconds}
              onChange={(e) => setDelaySeconds(Number(e.target.value) || 0)}
              className="w-14 rounded border border-gray-200 px-2 py-1 text-center text-xs text-gray-800 focus:border-[#00A838] focus:outline-none"
            />
            <span className="text-[11px] text-gray-400">sec</span>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="compose-hourly">Hourly Limit</label>
            <input
              id="compose-hourly"
              type="number"
              min={1}
              max={10000}
              value={hourlyLimit}
              onChange={(e) => setHourlyLimit(Math.max(1, Number(e.target.value) || 1))}
              className="w-16 rounded border border-gray-200 px-2 py-1 text-center text-xs text-gray-800 focus:border-[#00A838] focus:outline-none"
            />
          </div>

          <button
            type="button"
            onClick={() => setScheduleOpen((prev) => !prev)}
            className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-gray-50 px-2.5 py-1 text-[11px] text-gray-600 hover:bg-gray-100"
          >
            <Clock className="h-3 w-3 text-[#00A838]" />
            Starts: {startDate} {startTime}
          </button>
        </div>

        {/* Rich Text Editor */}
        <div className="mt-4">
          <RichTextEditor
            value={body}
            onChange={setBody}
            onAttachClick={() => attachmentInputRef.current?.click()}
          />
        </div>

        {/* Bottom Attachment Thumbnails matching Compose Figma frames 2 & 3 */}
        {attachments.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-3">
            {attachments.map((att, idx) => {
              const isImage = att.mimeType.startsWith('image/') && att.dataUrl;
              return (
                <div
                  key={`${att.name}-${idx}`}
                  className="relative w-36 overflow-hidden rounded-lg border border-gray-200 bg-white"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setAttachments((prev) => prev.filter((_, i) => i !== idx))
                    }
                    className="absolute right-1 top-1 rounded-full bg-white/90 p-0.5 text-gray-500 shadow hover:text-red-600"
                    aria-label={`Remove ${att.name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                  {isImage ? (
                    <img
                      src={att.dataUrl}
                      alt={att.name}
                      className="h-20 w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-20 w-full items-center justify-center bg-gray-50 text-gray-400">
                      <FileText className="h-6 w-6" />
                    </div>
                  )}
                  <div className="border-t border-gray-100 px-2 py-1">
                    <div className="truncate text-[10px] font-medium text-gray-700">
                      {att.name}
                    </div>
                    <div className="text-[10px] text-gray-400">{formatFileSize(att.size)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
