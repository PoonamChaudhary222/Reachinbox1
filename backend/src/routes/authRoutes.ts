import { NextFunction, Request, Response, Router } from 'express';
import {
  getCurrentUser,
  handleGoogleCallback,
  handleGooglePost,
  handleLogin,
  handleRegister,
  initiateGoogleOAuth,
  loginSchema,
  logout,
  registerSchema,
  googlePostSchema,
} from '../controllers/authController';
import { requireAuth } from '../middleware/auth';
import { authRateLimiter } from '../middleware/rateLimiter';
import { validateBody } from '../middleware/validate';

const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res, next)).catch(next);

const router = Router();

router.get('/google', authRateLimiter, asyncHandler(initiateGoogleOAuth));
router.post(
  '/google',
  authRateLimiter,
  validateBody(googlePostSchema),
  asyncHandler(handleGooglePost)
);
router.get('/google/callback', asyncHandler(handleGoogleCallback));
router.post(
  '/register',
  authRateLimiter,
  validateBody(registerSchema),
  asyncHandler(handleRegister)
);
router.post(
  '/login',
  authRateLimiter,
  validateBody(loginSchema),
  asyncHandler(handleLogin)
);
router.get('/me', requireAuth, asyncHandler(getCurrentUser));
router.post('/logout', asyncHandler(logout));

export default router;
