export type GroqRole = 'system' | 'user' | 'assistant';

export interface GroqMessage {
  role: GroqRole;
  content: string;
}

export interface ChatOptions {
  temperature?: number;
  max_tokens?: number;
  systemPrompt?: string;
}

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_EMBED_URL = 'https://api.groq.com/openai/v1/embeddings';
const MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const EMBED_MODEL = 'nomic-embed-text';

function getApiKey(): string {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('GROQ_API_KEY is not set');
  return key;
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 3
): Promise<Response> {
  const delays = [1000, 2000, 4000];
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;

      const errorBody = await res.json().catch(() => ({})) as { error?: { message?: string; type?: string } };
      const errMsg = errorBody.error?.message || res.statusText;
      const errType = errorBody.error?.type;

      if (res.status === 429 || (res.status >= 500 && res.status < 600)) {
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, delays[attempt]));
          continue;
        }
      }

      throw new Error(`Groq API error ${res.status}: ${errMsg}${errType ? ` (${errType})` : ''}`);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, delays[attempt]));
      }
    }
  }

  throw lastError || new Error('Groq API request failed after retries');
}

export async function* chat(
  messages: GroqMessage[],
  options?: ChatOptions
): AsyncGenerator<string, void, unknown> {
  const groqMessages: GroqMessage[] = [];

  if (options?.systemPrompt) {
    groqMessages.push({ role: 'system', content: options.systemPrompt });
  }

  groqMessages.push(...messages);

  const res = await fetchWithRetry(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: groqMessages,
      stream: true,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.max_tokens ?? 1024,
    }),
  });

  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response body stream');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'data: [DONE]') continue;
      if (!trimmed.startsWith('data: ')) continue;

      try {
        const json = JSON.parse(trimmed.slice(6)) as { choices?: { delta?: { content?: string } }[] };
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch {
        // skip malformed chunks
      }
    }
  }
}

export async function chatComplete(
  messages: GroqMessage[],
  options?: ChatOptions
): Promise<string> {
  const groqMessages: GroqMessage[] = [];

  if (options?.systemPrompt) {
    groqMessages.push({ role: 'system', content: options.systemPrompt });
  }

  groqMessages.push(...messages);

  const res = await fetchWithRetry(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: groqMessages,
      stream: false,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.max_tokens ?? 1024,
    }),
  });

  const json = await res.json() as { choices?: { message?: { content?: string } }[] };
  return json.choices?.[0]?.message?.content || '';
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const res = await fetchWithRetry(GROQ_EMBED_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({
      model: EMBED_MODEL,
      input: text,
    }),
  });

  const json = await res.json() as { data?: { embedding?: number[] }[] };
  return json.data?.[0]?.embedding || [];
}
