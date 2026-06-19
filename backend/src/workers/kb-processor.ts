import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { processDocument } from '../services/knowledge-processor';
import { prisma } from '../lib/prisma';

const QUEUE_NAME = 'kb-processing';

const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

interface KbProcessingJob {
  documentId: string;
}

const worker = new Worker<KbProcessingJob>(
  QUEUE_NAME,
  async (job: Job<KbProcessingJob>) => {
    const { documentId } = job.data;
    console.log(`[kb-processor] Processing document ${documentId} (job ${job.id})`);

    await prisma.knowledgeDocument.update({
      where: { id: documentId },
      data: { status: 'Processing' },
    });

    try {
      await processDocument(documentId);

      const doc = await prisma.knowledgeDocument.findUnique({
        where: { id: documentId },
        select: { chunkCount: true, knowledgeBaseId: true },
      });

      if (doc) {
        await prisma.knowledgeDocument.update({
          where: { id: documentId },
          data: { status: 'Ready' },
        });

        const chunkCount = await prisma.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(*)::bigint as count FROM "DocumentChunk"
          WHERE "knowledgeBaseId" = ${doc.knowledgeBaseId}
        `;

        await prisma.knowledgeBase.update({
          where: { id: doc.knowledgeBaseId },
          data: {
            totalChunks: Number(chunkCount[0]?.count || 0),
            lastIndexedAt: new Date(),
            status: 'Ready',
          },
        });
      }

      console.log(`[kb-processor] Document ${documentId} processed successfully`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';

      await prisma.knowledgeDocument.update({
        where: { id: documentId },
        data: { status: 'Error', errorMessage },
      });

      console.error(`[kb-processor] Document ${documentId} failed:`, errorMessage);
      throw err;
    }
  },
  {
    connection,
    concurrency: 3,
  }
);

worker.on('completed', (job) => {
  console.log(`[kb-processor] Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`[kb-processor] Job ${job?.id} failed:`, err.message);
});

worker.on('error', (err) => {
  console.error('[kb-processor] Worker error:', err);
});

export { worker, QUEUE_NAME, connection };

process.on('SIGTERM', async () => {
  await worker.close();
  await connection.quit();
});
