import { NextFunction, Request, Response, Router } from 'express';
import { handleDashboardStats } from '../controllers/emailController';
import { requireAuth } from '../middleware/auth';

const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res, next)).catch(next);

const router = Router();
router.use(requireAuth);
router.get('/stats', asyncHandler(handleDashboardStats));

export default router;
