import { NextFunction, Request, Response, Router } from 'express';
import {
  createSenderSchema,
  handleCreateSender,
  handleDeleteSender,
  handleListSenders,
  handleUpdateSender,
  updateSenderSchema,
} from '../controllers/senderController';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';

const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res, next)).catch(next);

const router = Router();
router.use(requireAuth);

router.post('/', validateBody(createSenderSchema), asyncHandler(handleCreateSender));
router.get('/', asyncHandler(handleListSenders));
router.patch('/:id', validateBody(updateSenderSchema), asyncHandler(handleUpdateSender));
router.delete('/:id', asyncHandler(handleDeleteSender));

export default router;
