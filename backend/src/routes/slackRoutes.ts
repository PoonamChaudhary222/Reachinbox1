import { NextFunction, Request, Response, Router } from 'express';
import {
  handleSlackCallback,
  handleSlackConnect,
  handleSlackDisconnect,
  handleSlackStatus,
} from '../controllers/slackController';
import { requireAuth } from '../middleware/auth';

const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res, next)).catch(next);

const router = Router();

router.get('/connect', requireAuth, asyncHandler(handleSlackConnect));
router.get('/status', requireAuth, asyncHandler(handleSlackStatus));
router.get('/callback', asyncHandler(handleSlackCallback));
router.post('/disconnect', requireAuth, asyncHandler(handleSlackDisconnect));

export default router;
