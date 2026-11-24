import { Request, Response } from 'express';
import { z } from 'zod';
import {
  createUserSender,
  deleteUserSender,
  listUserSenders,
  updateUserSender,
} from '../services/senderService';

export const createSenderSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(1).max(120),
  smtpHost: z.string().max(255).optional(),
  smtpPort: z.coerce.number().int().min(1).max(65535).optional(),
  smtpUser: z.string().max(255).optional(),
  smtpPass: z.string().max(255).optional(),
  isDefault: z.boolean().optional(),
});

export const updateSenderSchema = z.object({
  displayName: z.string().min(1).max(120).optional(),
  smtpHost: z.string().max(255).optional(),
  smtpPort: z.coerce.number().int().min(1).max(65535).optional(),
  smtpUser: z.string().max(255).optional(),
  smtpPass: z.string().max(255).optional(),
  isDefault: z.boolean().optional(),
});

export async function handleListSenders(req: Request, res: Response): Promise<void> {
  const senders = await listUserSenders(req.user!.id);
  res.status(200).json({
    success: true,
    data: { senders },
  });
}

export async function handleCreateSender(req: Request, res: Response): Promise<void> {
  const sender = await createUserSender(req.user!.id, req.body);
  res.status(201).json({
    success: true,
    data: { sender },
  });
}

export async function handleUpdateSender(req: Request, res: Response): Promise<void> {
  const sender = await updateUserSender(req.user!.id, String(req.params.id), req.body);
  res.status(200).json({
    success: true,
    data: { sender },
  });
}

export async function handleDeleteSender(req: Request, res: Response): Promise<void> {
  await deleteUserSender(req.user!.id, String(req.params.id));
  res.status(200).json({
    success: true,
    message: 'Sender removed successfully',
  });
}
