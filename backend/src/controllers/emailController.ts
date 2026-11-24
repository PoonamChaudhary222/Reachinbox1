import { EmailStatus } from '@prisma/client';
import { Request, Response } from 'express';
import { z } from 'zod';
import {
  cancelOrDeleteEmail,
  getUserDashboardStats,
  getUserEmailById,
  listUserEmails,
  parseCsvOrTextEmails,
  scheduleEmails,
  searchUserEmails,
  toggleUserEmailStar,
} from '../services/emailService';
import { BadRequestError } from '../utils/errors';

const attachmentSchema = z.object({
  name: z.string().min(1).max(255),
  size: z.number().nonnegative().max(10 * 1024 * 1024),
  mimeType: z.string().min(1).max(128),
  dataUrl: z.string().max(14 * 1024 * 1024).optional(),
});

export const scheduleEmailSchema = z.object({
  senderId: z.string().min(1),
  recipients: z.array(z.string().email()).min(1).max(5000),
  subject: z.string().min(1, 'Subject is required').max(500),
  body: z.string().min(1, 'Email body is required'),
  scheduledAt: z.string().min(1),
  delayBetweenEmailsSeconds: z.coerce.number().min(0).max(3600).optional(),
  hourlyLimit: z.coerce.number().int().min(1).max(10000).optional(),
  attachments: z.array(attachmentSchema).max(10).optional(),
  requestIdempotencyKey: z.string().min(4).max(128).optional(),
});

export const listEmailsQuerySchema = z.object({
  status: z.nativeEnum(EmailStatus).optional(),
  search: z.string().optional(),
  senderId: z.string().optional(),
  sortBy: z.enum(['scheduledAt', 'sentAt', 'createdAt']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const searchEmailsQuerySchema = z.object({
  q: z.string().optional(),
  status: z.nativeEnum(EmailStatus).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export async function handleScheduleEmails(req: Request, res: Response): Promise<void> {
  const result = await scheduleEmails(req.user!.id, req.body);
  res.status(201).json({
    success: true,
    data: result,
  });
}

export async function handleParseCsv(req: Request, res: Response): Promise<void> {
  if (!req.file) {
    throw new BadRequestError('Please upload a CSV or TXT file.');
  }
  const content = req.file.buffer.toString('utf8');
  const parsed = parseCsvOrTextEmails(content);
  res.status(200).json({
    success: true,
    data: parsed,
  });
}

export async function handleListAllEmails(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as z.infer<typeof listEmailsQuerySchema>;
  const result = await listUserEmails(req.user!.id, query);
  res.status(200).json({
    success: true,
    data: result,
  });
}

export async function handleListScheduledEmails(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as z.infer<typeof listEmailsQuerySchema>;
  const result = await listUserEmails(req.user!.id, {
    ...query,
    status: [EmailStatus.SCHEDULED, EmailStatus.PROCESSING],
  });
  res.status(200).json({
    success: true,
    data: result,
  });
}

export async function handleListSentEmails(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as z.infer<typeof listEmailsQuerySchema>;
  const statusFilter =
    query.status === EmailStatus.SENT || query.status === EmailStatus.FAILED
      ? query.status
      : [EmailStatus.SENT, EmailStatus.FAILED];

  const result = await listUserEmails(req.user!.id, {
    ...query,
    status: statusFilter,
    sortBy: query.sortBy || 'sentAt',
  });
  res.status(200).json({
    success: true,
    data: result,
  });
}

export async function handleGetEmailById(req: Request, res: Response): Promise<void> {
  const email = await getUserEmailById(req.user!.id, String(req.params.id));
  res.status(200).json({
    success: true,
    data: { email },
  });
}

export async function handleToggleStar(req: Request, res: Response): Promise<void> {
  const email = await toggleUserEmailStar(req.user!.id, String(req.params.id));
  res.status(200).json({
    success: true,
    data: { email },
  });
}

export async function handleDeleteOrCancelEmail(req: Request, res: Response): Promise<void> {
  const result = await cancelOrDeleteEmail(req.user!.id, String(req.params.id));
  res.status(200).json({
    success: true,
    data: result,
  });
}

export async function handleDashboardStats(req: Request, res: Response): Promise<void> {
  const stats = await getUserDashboardStats(req.user!.id);
  res.status(200).json({
    success: true,
    data: { stats },
  });
}

export async function handleSearchEmails(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as z.infer<typeof searchEmailsQuerySchema>;
  const result = await searchUserEmails(req.user!.id, query);
  res.status(200).json({
    success: true,
    data: result,
  });
}
