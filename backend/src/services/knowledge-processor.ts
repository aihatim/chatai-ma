import { prisma } from '../lib/prisma';
import { generateEmbedding } from './groq';
import { readFile } from 'fs/promises';
import { extname } from 'path';

const CHUNK_SIZE = 2000;
const CHUNK_OVERLAP = 200;

const MEDIA_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.svg',
  '.mp4', '.avi', '.mov', '.mkv', '.webm',
  '.mp3', '.wav', '.ogg', '.flac', '.m4a',
]);

export async function processDocument(documentId: string): Promise<void> {
  const document = await prisma.knowledgeDocument.findUnique({
    where: { id: documentId },
    include: { knowledgeBase: true },
  });

  if (!document) throw new Error(`Document ${documentId} not found`);

  await prisma.knowledgeDocument.update({
    where: { id: documentId },
    data: { status: 'Processing' },
  });

  try {
    if (!document.storageUrl) {
      throw new Error('Document has no storage URL');
    }

    const ext = extname(document.filename).toLowerCase();

    if (MEDIA_EXTENSIONS.has(ext)) {
      await handleMediaDocument(document);
      return;
    }

    const text = await extractText(document.storageUrl, ext);
    const chunks = chunkText(text, document.filename, ext);
    const kbId = document.knowledgeBaseId;

    await prisma.knowledgeDocument.update({
      where: { id: documentId },
      data: { chunkCount: chunks.length },
    });

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = await generateEmbedding(chunk.content);

      await prisma.$executeRaw`
        INSERT INTO "DocumentChunk" (
          id, "documentId", "knowledgeBaseId", "chunkIndex", content,
          embedding, source, metadata, "createdAt"
        ) VALUES (
          ${`${documentId}-chunk-${i}`},
          ${documentId},
          ${kbId},
          ${i},
          ${chunk.content},
          ${embedding}::vector,
          ${chunk.source},
          ${JSON.stringify(chunk.metadata)}::jsonb,
          NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          content = EXCLUDED.content,
          embedding = EXCLUDED.embedding,
          source = EXCLUDED.source,
          metadata = EXCLUDED.metadata
      `;
    }

    await prisma.knowledgeDocument.update({
      where: { id: documentId },
      data: { status: 'Ready', processedAt: new Date() },
    });

    const chunkCount = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*)::bigint as count FROM "DocumentChunk"
      WHERE "knowledgeBaseId" = ${kbId}
    `;

    const totalChunks = Number(chunkCount[0]?.count || 0);

    await prisma.knowledgeBase.update({
      where: { id: kbId },
      data: {
        totalChunks,
        totalDocuments: { increment: 1 },
        totalSizeMb: { increment: document.fileSizeBytes / (1024 * 1024) },
        lastIndexedAt: new Date(),
        status: 'Ready',
      },
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';

    await prisma.knowledgeDocument.update({
      where: { id: documentId },
      data: {
        status: 'Error',
        errorMessage,
      },
    });

    await prisma.knowledgeBase.update({
      where: { id: document.knowledgeBaseId },
      data: { status: 'Error' },
    });

    throw err;
  }
}

async function handleMediaDocument(document: {
  id: string;
  knowledgeBaseId: string;
  filename: string;
}): Promise<void> {
  const content = 'Media detected — transcription needed';
  const embedding = await generateEmbedding(content);

  await prisma.$executeRaw`
    INSERT INTO "DocumentChunk" (
      id, "documentId", "knowledgeBaseId", "chunkIndex", content,
      embedding, source, metadata, "createdAt"
    ) VALUES (
      ${`${document.id}-chunk-0`},
      ${document.id},
      ${document.knowledgeBaseId},
      ${0},
      ${content},
      ${embedding}::vector,
      ${document.filename},
      ${JSON.stringify({ type: 'media', filename: document.filename })}::jsonb,
      NOW()
    )
  `;

  await prisma.knowledgeDocument.update({
    where: { id: document.id },
    data: { status: 'Ready', chunkCount: 1, processedAt: new Date() },
  });

  await prisma.knowledgeBase.update({
    where: { id: document.knowledgeBaseId },
    data: {
      totalChunks: { increment: 1 },
      totalDocuments: { increment: 1 },
      lastIndexedAt: new Date(),
      status: 'Ready',
    },
  });
}

async function extractText(
  filePath: string,
  ext: string
): Promise<string> {
  switch (ext) {
    case '.txt':
    case '.md': {
      return await readFile(filePath, 'utf-8');
    }

    case '.pdf': {
      const pdfParse = await import('pdf-parse').then((m) => m.default);
      const buffer = await readFile(filePath);
      const data = await pdfParse(buffer);
      return data.text;
    }

    case '.docx': {
      const mammoth = await import('mammoth');
      const buffer = await readFile(filePath);
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }

    case '.csv': {
      const content = await readFile(filePath, 'utf-8');
      return content;
    }

    default:
      throw new Error(`Unsupported file type: ${ext}`);
  }
}

interface TextChunk {
  content: string;
  source: string | null;
  metadata: Record<string, unknown>;
}

function chunkText(
  text: string,
  filename: string,
  ext: string
): TextChunk[] {
  const charsPerToken = 4;
  const targetChars = CHUNK_SIZE * charsPerToken;
  const overlapChars = CHUNK_OVERLAP * charsPerToken;

  if (ext === '.csv') {
    return chunkCSV(text, filename);
  }

  const chunks: TextChunk[] = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + targetChars, text.length);

    if (end < text.length) {
      const breakAt = findSplitPoint(text, end);
      if (breakAt > start) end = breakAt;
    }

    const content = text.slice(start, end).trim();
    if (content) {
      chunks.push({
        content,
        source: filename,
        metadata: { chunkIndex: chunks.length, fileType: ext },
      });
    }

    start = end - overlapChars;
    if (start >= text.length) break;
    if (start < 0) start = 0;
  }

  return chunks;
}

function chunkCSV(text: string, filename: string): TextChunk[] {
  const lines = text.split('\n');
  if (lines.length <= 1) {
    return [{ content: text, source: filename, metadata: { fileType: '.csv' } }];
  }

  const header = lines[0];
  const chunks: TextChunk[] = [];
  let currentChunk = header;
  let rowCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (currentChunk.length + line.length > CHUNK_SIZE * 4 && rowCount > 0) {
      chunks.push({
        content: currentChunk,
        source: filename,
        metadata: { fileType: '.csv', rowCount, startRow: i - rowCount },
      });
      currentChunk = header + '\n' + line;
      rowCount = 1;
    } else {
      currentChunk += '\n' + line;
      rowCount++;
    }
  }

  if (currentChunk.trim()) {
    chunks.push({
      content: currentChunk,
      source: filename,
      metadata: { fileType: '.csv', rowCount, startRow: lines.length - rowCount },
    });
  }

  return chunks;
}

function findSplitPoint(text: string, preferredEnd: number): number {
  const searchStart = Math.max(preferredEnd - 200, 0);

  const newlineIdx = text.lastIndexOf('\n\n', preferredEnd);
  if (newlineIdx > searchStart) return newlineIdx;

  const sentenceIdx = text.lastIndexOf('. ', preferredEnd);
  if (sentenceIdx > searchStart) return sentenceIdx + 1;

  const newlineSingle = text.lastIndexOf('\n', preferredEnd);
  if (newlineSingle > searchStart) return newlineSingle;

  const spaceIdx = text.lastIndexOf(' ', preferredEnd);
  if (spaceIdx > searchStart) return spaceIdx;

  return preferredEnd;
}
