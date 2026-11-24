import { NextFunction, Request, Response, Router } from 'express';
import multer from 'multer';
import {
  handleDeleteOrCancelEmail,
  handleGetEmailById,
  handleListAllEmails,
  handleListScheduledEmails,
  handleListSentEmails,
  handleParseCsv,
  handleScheduleEmails,
  handleToggleStar,
  listEmailsQuerySchema,
  scheduleEmailSchema,
} from '../controllers/emailController';
import { requireAuth } from '../middleware/auth';
import { validateBody, validateQuery } from '../middleware/validate';
import { BadRequestError } from '../utils/errors';

const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res, next)).catch(next);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const allowed =
      file.mimetype === 'text/csv' ||
      file.mimetype === 'text/plain' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      file.originalname.toLowerCase().endsWith('.csv') ||
      file.originalname.toLowerCase().endsWith('.txt');

    if (!allowed) {
      cb(new BadRequestError('Only .csv and .txt files are allowed.'));
      return;
    }
    cb(null, true);
  },
});

const router = Router();
router.use(requireAuth);

router.post(
  '/schedule',
  validateBody(scheduleEmailSchema),
  asyncHandler(handleScheduleEmails)
);
router.post('/parse-csv', upload.single('file'), asyncHandler(handleParseCsv));
router.get('/', validateQuery(listEmailsQuerySchema), asyncHandler(handleListAllEmails));
router.get(
  '/scheduled',
  validateQuery(listEmailsQuerySchema),
  asyncHandler(handleListScheduledEmails)
);
router.get(
  '/sent',
  validateQuery(listEmailsQuerySchema),
  asyncHandler(handleListSentEmails)
);
router.get('/:id', asyncHandler(handleGetEmailById));
router.patch('/:id/star', asyncHandler(handleToggleStar));
router.delete('/:id', asyncHandler(handleDeleteOrCancelEmail));

export default router;
