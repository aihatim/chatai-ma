import { redis } from '../lib/prisma';
import crypto from 'crypto';

const API_VERSION = process.env.WHATSAPP_API_VERSION || 'v22.0';
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`;
const RATE_LIMIT_PER_HOUR = 950;

function getEncryptionKey(): Buffer {
  return crypto.scryptSync(process.env.JWT_SECRET || 'chatai-dev-secret-change-in-production', 'chatai-wa-salt', 32);
}

export function encryptToken(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export function decryptToken(ciphertext: string): string {
  const key = getEncryptionKey();
  const [ivHex, authTagHex, encrypted] = ciphertext.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export function hashPhone(phone: string): string {
  return crypto.createHash('sha256').update(phone.trim()).digest('hex');
}

async function checkRateLimit(phoneNumberId: string): Promise<boolean> {
  const key = `wa:ratelimit:${phoneNumberId}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, 3600);
  }
  return count <= RATE_LIMIT_PER_HOUR;
}

async function makeRequest(phoneNumberId: string, accessToken: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const url = `${BASE_URL}/${phoneNumberId}/messages`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json() as Record<string, unknown>;
  if (!response.ok) {
    const err = data as { error?: { message?: string; code?: number } };
    throw new Error(`WhatsApp API error ${err.error?.code || response.status}: ${err.error?.message || response.statusText}`);
  }
  return data;
}

export async function sendText(
  to: string,
  text: string,
  previewUrl: boolean,
  phoneNumberId: string,
  accessToken: string,
): Promise<Record<string, unknown>> {
  if (!(await checkRateLimit(phoneNumberId))) {
    return { queued: true, reason: 'RATE_LIMITED' };
  }
  return makeRequest(phoneNumberId, accessToken, {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: { preview_url: previewUrl, body: text },
  });
}

export async function sendTemplate(
  to: string,
  templateName: string,
  language: string,
  phoneNumberId: string,
  accessToken: string,
  components?: Record<string, unknown>[],
): Promise<Record<string, unknown>> {
  if (!(await checkRateLimit(phoneNumberId))) {
    return { queued: true, reason: 'RATE_LIMITED' };
  }
  const payload: Record<string, unknown> = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: language },
    },
  };
  if (components) {
    (payload.template as Record<string, unknown>).components = components;
  }
  return makeRequest(phoneNumberId, accessToken, payload);
}

export async function sendImage(
  to: string,
  mediaUrl: string,
  phoneNumberId: string,
  accessToken: string,
  caption?: string,
): Promise<Record<string, unknown>> {
  if (!(await checkRateLimit(phoneNumberId))) {
    return { queued: true, reason: 'RATE_LIMITED' };
  }
  const payload: Record<string, unknown> = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'image',
    image: { link: mediaUrl },
  };
  if (caption) (payload.image as Record<string, unknown>).caption = caption;
  return makeRequest(phoneNumberId, accessToken, payload);
}

export async function sendInteractive(
  to: string,
  type: 'button' | 'list',
  body: string,
  actions: Record<string, unknown>,
  phoneNumberId: string,
  accessToken: string,
): Promise<Record<string, unknown>> {
  if (!(await checkRateLimit(phoneNumberId))) {
    return { queued: true, reason: 'RATE_LIMITED' };
  }
  return makeRequest(phoneNumberId, accessToken, {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'interactive',
    interactive: { type, body: { text: body }, action: actions },
  });
}

export async function markAsRead(
  messageId: string,
  phoneNumberId: string,
  accessToken: string,
): Promise<Record<string, unknown>> {
  return makeRequest(phoneNumberId, accessToken, {
    messaging_product: 'whatsapp',
    status: 'read',
    message_id: messageId,
  });
}

export async function getMediaUrl(mediaId: string, accessToken: string): Promise<string> {
  const url = `${BASE_URL}/${mediaId}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await response.json() as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(`Failed to get media URL: ${(data as { error?: { message?: string } }).error?.message || response.statusText}`);
  }
  return `${BASE_URL}/${data.url as string}`;
}

export function validateWebhookSignature(signature: string, body: string, appSecret: string): boolean {
  const expected = crypto
    .createHmac('sha256', appSecret)
    .update(body, 'utf8')
    .digest('hex');
  if (signature.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export async function detectLanguage(text: string): Promise<{ language: string; isDarija: boolean }> {
  const DARIJA_KEYWORDS = [
    'شنو', 'كاين', 'ماشي', 'هاد', 'هادشي', 'واش', 'فين', 'منين', 'اشمن',
    'دابا', 'غادي', 'جاي', 'بقا', 'مزال', 'بزاف', 'شويا', 'ولكن', 'حيت',
    'علاش', 'كي', 'كت', 'كان', 'هو', 'هي', 'هما', 'ههيا', 'واخا', 'واه',
    'لا', 'نعم', 'شكرا', 'بصح', 'واخا', 'smekt', 'labas', 'saha',
  ];
  const lower = text.toLowerCase();
  const darijaScore = DARIJA_KEYWORDS.filter((w) => lower.includes(w)).length;

  const arabicChars = (text.match(/[\u0600-\u06FF]/g) || []).length;
  const latinChars = (text.match(/[a-zA-Z]/g) || []).length;
  const frenchChars = (text.match(/[éèêëàâîïôûùçœæ]/gi) || []).length;
  const totalChars = arabicChars + latinChars + frenchChars || 1;

  if (darijaScore >= 2 || (arabicChars > 0 && latinChars > 0 && darijaScore > 0)) {
    return { language: 'ar', isDarija: true };
  }
  if (arabicChars / totalChars > 0.3) {
    return { language: 'ar', isDarija: false };
  }
  if (frenchChars > 0 && frenchChars / (latinChars || 1) > 0.05) {
    return { language: 'fr', isDarija: false };
  }
  if (latinChars / totalChars > 0.5) {
    return { language: 'en', isDarija: false };
  }
  return { language: 'fr', isDarija: false };
}

async function uploadMediaToWhatsApp(
  buffer: Buffer,
  mimeType: string,
  filename: string,
  phoneNumberId: string,
  accessToken: string,
): Promise<string> {
  const url = `${BASE_URL}/${phoneNumberId}/media`;
  const boundary = `----FormBoundary${crypto.randomBytes(16).toString('hex')}`;
  const encoder = new TextEncoder();
  const header = encoder.encode(
    `--${boundary}\r\nContent-Disposition: form-data; name="messaging_product"\r\n\r\nwhatsapp\r\n` +
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`
  );
  const footer = encoder.encode(`\r\n--${boundary}--\r\n`);
  const body = Buffer.concat([header, buffer, footer]);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body,
  });

  const data = await response.json() as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(`Media upload failed: ${(data as { error?: { message?: string } }).error?.message || response.statusText}`);
  }
  return data.id as string;
}

export async function sendCarousel(
  to: string,
  products: Array<{ title: string; description: string; imageUrl: string; linkUrl: string }>,
  language: string,
  phoneNumberId: string,
  accessToken: string,
): Promise<Record<string, unknown>> {
  if (!(await checkRateLimit(phoneNumberId))) {
    return { queued: true, reason: 'RATE_LIMITED' };
  }

  const cards = products.slice(0, 10).map(p => ({
    title: p.title.slice(0, 20),
    description: p.description.slice(0, 72),
    media: { link: p.imageUrl },
    buttons: [{
      type: 'url',
      url: p.linkUrl,
      title: 'View',
    }],
  }));

  try {
    return await makeRequest(phoneNumberId, accessToken, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive: {
        type: 'carousel',
        body: { text: 'Check out our products' },
        action: { cards },
      },
    });
  } catch {
    const results: Array<Record<string, unknown>> = [];
    for (const product of products) {
      const caption = `${product.title}\n${product.description}\n${product.linkUrl}`;
      const sent = await sendImage(to, product.imageUrl, phoneNumberId, accessToken, caption);
      results.push(sent);
    }
    return { fallback: true, sent: results.length };
  }
}

const MIME_MAP: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain',
  csv: 'text/csv',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
};

async function getDocumentBuffer(documentUrl: string, filename: string): Promise<{ buffer: Buffer; mimeType: string }> {
  if (documentUrl.startsWith('file://')) {
    const fs = await import('fs/promises');
    const filePath = documentUrl.slice(7);
    const buffer = await fs.readFile(filePath);
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    return { buffer, mimeType: MIME_MAP[ext] || 'application/octet-stream' };
  }
  const response = await fetch(documentUrl);
  if (!response.ok) {
    throw new Error(`Failed to download document: ${response.statusText}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  const mimeType = response.headers.get('content-type') || 'application/octet-stream';
  return { buffer, mimeType };
}

export async function sendDocument(
  to: string,
  documentUrl: string,
  filename: string,
  phoneNumberId: string,
  accessToken: string,
  caption?: string,
): Promise<Record<string, unknown>> {
  if (!(await checkRateLimit(phoneNumberId))) {
    return { queued: true, reason: 'RATE_LIMITED' };
  }

  const { buffer, mimeType } = await getDocumentBuffer(documentUrl, filename);
  const maxSize = 16 * 1024 * 1024;
  if (buffer.length > maxSize) {
    throw new Error(`Document exceeds 16MB limit (${(buffer.length / (1024 * 1024)).toFixed(1)}MB)`);
  }

  const mediaId = await uploadMediaToWhatsApp(buffer, mimeType, filename, phoneNumberId, accessToken);

  const payload: Record<string, unknown> = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'document',
    document: { id: mediaId, filename },
  };
  if (caption) (payload.document as Record<string, unknown>).caption = caption;
  return makeRequest(phoneNumberId, accessToken, payload);
}

export async function transcribeVoice(mediaId: string, accessToken: string): Promise<string> {
  try {
    const downloadUrl = await getMediaUrl(mediaId, accessToken);
    const response = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      throw new Error(`Failed to download audio: ${response.statusText}`);
    }
    // TODO: Integrate with Whisper API or Groq's audio transcription
    return '[Voice message - transcription pending]';
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    throw new Error(`Voice transcription failed: ${errorMessage}`);
  }
}

export async function sendProactiveAlert(
  to: string,
  alertType: 'order_confirmation' | 'shipping_update' | 'abandoned_cart' | 'appointment_reminder',
  data: Record<string, string>,
  phoneNumberId: string,
  accessToken: string,
): Promise<Record<string, unknown>> {
  if (!(await checkRateLimit(phoneNumberId))) {
    return { queued: true, reason: 'RATE_LIMITED' };
  }

  const bodyParameters = Object.entries(data).map(([, value]) => ({ type: 'text' as const, text: value }));

  try {
    return await sendTemplate(to, alertType, 'en', phoneNumberId, accessToken, [
      { type: 'body', parameters: bodyParameters },
    ]);
  } catch {
    const messages: Record<string, string> = {
      order_confirmation: `Order confirmed! 🎉\n\nOrder: ${data.orderId || ''}\nTotal: ${data.total || ''}\nThank you for your purchase!`,
      shipping_update: `Shipping update for your order! 📦\n\nOrder: ${data.orderId || ''}\nStatus: ${data.status || ''}\nTrack: ${data.trackingUrl || ''}`,
      abandoned_cart: `You left items in your cart! 🛒\n\nComplete your purchase now and enjoy ${data.discount || 'a special offer'}!`,
      appointment_reminder: `Appointment reminder 📅\n\nDate: ${data.date || ''}\nTime: ${data.time || ''}\nLocation: ${data.location || ''}`,
    };
    const text = messages[alertType] || `Alert: ${alertType}`;
    return sendText(to, text, false, phoneNumberId, accessToken);
  }
}

export function generateQRCode(phoneNumber: string): { whatsappLink: string; qrImageUrl: string } {
  const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
  const whatsappLink = `https://wa.me/${cleanNumber}?text=Hi`;
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(whatsappLink)}`;
  return { whatsappLink, qrImageUrl };
}
