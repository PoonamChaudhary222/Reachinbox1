import { NextFunction, Request, Response, Router } from 'express';
import {
  handleSearchEmails,
  searchEmailsQuerySchema,
} from '../controllers/emailController';
import { requireAuth } from '../middleware/auth';
import { validateQuery } from '../middleware/validate';

const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res, next)).catch(next);

const router = Router();
router.use(requireAuth);
router.get('/emails', validateQuery(searchEmailsQuerySchema), asyncHandler(handleSearchEmails));

export default router;
