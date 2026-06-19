import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { processDocument } from '../services/knowledge-processor';

export default async function (app: FastifyInstance) {
  app.post('/', async (req, reply) => {
    const { workspaceId, name, description } = req.body as {
      workspaceId: string;
      name: string;
      description?: string;
    };

    if (!workspaceId || !name) {
      return reply.status(400).send({ error: 'workspaceId and name are required' });
    }

    const kb = await prisma.knowledgeBase.create({
      data: { workspaceId, name, description, status: 'Empty' },
    });

    return reply.status(201).send(kb);
  });

  app.get('/', async (req) => {
    const { workspaceId } = req.query as { workspaceId?: string };

    const where = workspaceId ? { workspaceId } : {};

    return prisma.knowledgeBase.findMany({
      where,
      include: { _count: { select: { documents: true } } },
      orderBy: { createdAt: 'desc' },
    });
  });

  app.get('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };

    const kb = await prisma.knowledgeBase.findUnique({
      where: { id },
      include: {
        documents: { orderBy: { createdAt: 'desc' } },
        _count: { select: { documents: true } },
      },
    });

    if (!kb) return reply.status(404).send({ error: 'Knowledge base not found' });

    return kb;
  });

  app.delete('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };

    const existing = await prisma.knowledgeBase.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ error: 'Knowledge base not found' });

    await prisma.$executeRaw`DELETE FROM "DocumentChunk" WHERE "knowledgeBaseId" = ${id}`;
    await prisma.knowledgeDocument.deleteMany({ where: { knowledgeBaseId: id } });
    await prisma.knowledgeBase.delete({ where: { id } });

    return { success: true };
  });

  app.post('/:id/documents', async (req, reply) => {
    const { id } = req.params as { id: string };

    const kb = await prisma.knowledgeBase.findUnique({ where: { id } });
    if (!kb) return reply.status(404).send({ error: 'Knowledge base not found' });

    const data = await req.file();
    if (!data) return reply.status(400).send({ error: 'No file uploaded' });

    const userId = (req as any).userId || 'system';

    const buffer = await data.toBuffer();

    const fileExt = data.filename.split('.').pop()?.toLowerCase() || 'txt';
    const fileTypeMap: Record<string, string> = {
      pdf: 'pdf', docx: 'docx', txt: 'txt', md: 'md', csv: 'csv',
      png: 'png', jpg: 'jpg', jpeg: 'jpg', mp4: 'mp4', mp3: 'mp3',
    };
    const fileType = fileTypeMap[fileExt] || 'txt';

    const document = await prisma.knowledgeDocument.create({
      data: {
        knowledgeBaseId: id,
        filename: data.filename,
        fileType: fileType as any,
        fileSizeBytes: buffer.length,
        storageUrl: buffer.toString('base64').slice(0, 100),
        status: 'Processing',
        uploadedBy: userId,
      },
    });

    return reply.status(201).send(document);
  });

  app.get('/:id/documents', async (req, reply) => {
    const { id } = req.params as { id: string };

    const kb = await prisma.knowledgeBase.findUnique({ where: { id } });
    if (!kb) return reply.status(404).send({ error: 'Knowledge base not found' });

    return prisma.knowledgeDocument.findMany({
      where: { knowledgeBaseId: id },
      orderBy: { createdAt: 'desc' },
    });
  });

  app.delete('/:id/documents/:docId', async (req, reply) => {
    const { id, docId } = req.params as { id: string; docId: string };

    const doc = await prisma.knowledgeDocument.findFirst({
      where: { id: docId, knowledgeBaseId: id },
    });

    if (!doc) return reply.status(404).send({ error: 'Document not found' });

    await prisma.$executeRaw`DELETE FROM "DocumentChunk" WHERE "documentId" = ${docId}`;
    await prisma.knowledgeDocument.delete({ where: { id: docId } });

    const chunkCount = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*)::bigint as count FROM "DocumentChunk"
      WHERE "knowledgeBaseId" = ${id}
    `;

    const remainingChunks = Number(chunkCount[0]?.count || 0);
    const docCount = await prisma.knowledgeDocument.count({ where: { knowledgeBaseId: id } });

    await prisma.knowledgeBase.update({
      where: { id },
      data: {
        totalChunks: remainingChunks,
        totalDocuments: docCount,
        status: docCount === 0 ? 'Empty' : undefined,
      },
    });

    return { success: true };
  });

  app.post('/:id/documents/:docId/process', async (req, reply) => {
    const { id, docId } = req.params as { id: string; docId: string };

    const doc = await prisma.knowledgeDocument.findFirst({
      where: { id: docId, knowledgeBaseId: id },
    });

    if (!doc) return reply.status(404).send({ error: 'Document not found' });

    await prisma.knowledgeBase.update({
      where: { id },
      data: { status: 'Indexing' },
    });

    processDocument(docId).catch((err) => {
      console.error(`Document processing failed: ${docId}`, err);
    });

    return { message: 'Processing started', documentId: docId };
  });
}
