import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { getEmailQueue, getEsIndexQueue } from './emailQueue';

export function createBullBoardMiddleware() {
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');

  createBullBoard({
    queues: [
      new BullMQAdapter(getEmailQueue()),
      new BullMQAdapter(getEsIndexQueue()),
    ],
    serverAdapter,
  });

  return serverAdapter.getRouter();
}
