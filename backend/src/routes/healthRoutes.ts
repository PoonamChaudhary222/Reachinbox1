import { NextFunction, Request, Response, Router } from 'express';
import { handleHealthCheck } from '../controllers/healthController';

const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res, next)).catch(next);

const router = Router();
router.get('/', asyncHandler(handleHealthCheck));

export default router;
