import type { WidgetConfig } from './config';

interface ApiError {
  code?: string;
  message: string;
}

interface ConfigResponse {
  position?: 'bottom-right' | 'bottom-left';
  primaryColor?: string;
  accentColor?: string;
  icon?: 'default' | 'chat' | 'bot';
  welcomeMessage?: string;
  placeholderText?: string;
  language?: 'en' | 'fr' | 'ar' | 'es';
  chameleonMode?: boolean;
  theme?: 'light' | 'dark';
  apiUrl?: string;
  logoUrl?: string;
}

export interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: number;
}

interface SSEMessage {
  type: 'chunk' | 'done' | 'error';
  data?: string;
  messageId?: string;
  error?: string;
}

const API_TIMEOUT = 10000;

async function apiFetch<T>(
  url: string,
  options: RequestInit = {},
  timeout = API_TIMEOUT,
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!res.ok) {
      let errorData: ApiError;
      try {
        errorData = await res.json();
      } catch {
        errorData = { message: `HTTP ${res.status}: ${res.statusText}` };
      }
      throw new Error(errorData.message || `Request failed with status ${res.status}`);
    }

    return res.json() as Promise<T>;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchConfig(token: string): Promise<ConfigResponse> {
  return apiFetch<ConfigResponse>(`/api/v1/website/${token}/config`, {
    method: 'GET',
  });
}

export function connectChat(
  token: string,
  sessionId: string,
  onMessage: (message: ChatMessage) => void,
  onError: (error: Error) => void,
): () => void {
  let eventSource: EventSource | null = null;
  let xhr: XMLHttpRequest | null = null;
  let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 5;
  const baseDelay = 1000;
  let closed = false;

  function getReconnectDelay(): number {
    const delay = baseDelay * Math.pow(2, reconnectAttempts);
    reconnectAttempts++;
    return Math.min(delay, 30000);
  }

  function cleanup(): void {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    if (xhr) {
      xhr.abort();
      xhr = null;
    }
  }

  function connectWithEventSource(): void {
    if (closed) return;

    const url = `/api/v1/website/${token}/chat/stream?sessionId=${encodeURIComponent(sessionId)}`;

    try {
      eventSource = new EventSource(url);

      eventSource.onopen = () => {
        reconnectAttempts = 0;
      };

      eventSource.addEventListener('message', (event: MessageEvent) => {
        if (closed) return;
        try {
          const sseMessage: SSEMessage = JSON.parse(event.data);

          if (sseMessage.type === 'chunk' && sseMessage.data) {
            onMessage({
              id: sseMessage.messageId || crypto.randomUUID(),
              content: sseMessage.data,
              role: 'assistant',
              timestamp: Date.now(),
            });
          } else if (sseMessage.type === 'done') {
            cleanup();
          } else if (sseMessage.type === 'error') {
            onError(new Error(sseMessage.error || 'Stream error'));
            cleanup();
          }
        } catch {
          // ignore parse errors
        }
      });

      eventSource.onerror = () => {
        if (closed) return;
        cleanup();
        onError(new Error('Connection lost'));
        scheduleReconnect();
      };
    } catch (err) {
      if (closed) return;
      cleanup();
      onError(err instanceof Error ? err : new Error('Failed to create EventSource'));
      scheduleReconnect();
    }
  }

  function connectWithXHR(): void {
    if (closed) return;

    const url = `/api/v1/website/${token}/chat/stream?sessionId=${encodeURIComponent(sessionId)}`;

    xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.setRequestHeader('Accept', 'text/event-stream');

    let lastIndex = 0;

    xhr.onprogress = () => {
      if (closed || !xhr) return;

      const newData = xhr.responseText.substring(lastIndex);
      lastIndex = xhr.responseText.length;

      const lines = newData.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.substring(6));
            const sseMessage: SSEMessage = data;

            if (sseMessage.type === 'chunk' && sseMessage.data) {
              onMessage({
                id: sseMessage.messageId || crypto.randomUUID(),
                content: sseMessage.data,
                role: 'assistant',
                timestamp: Date.now(),
              });
            } else if (sseMessage.type === 'done') {
              cleanup();
            } else if (sseMessage.type === 'error') {
              onError(new Error(sseMessage.error || 'Stream error'));
              cleanup();
            }
          } catch {
            // ignore
          }
        }
      }
    };

    xhr.onerror = () => {
      if (closed) return;
      cleanup();
      onError(new Error('XHR connection failed'));
      scheduleReconnect();
    };

    xhr.onloadend = () => {
      if (closed) return;
      // Stream ended
    };

    xhr.send();
  }

  function scheduleReconnect(): void {
    if (closed || reconnectAttempts >= maxReconnectAttempts) return;

    const delay = getReconnectDelay();
    reconnectTimeout = setTimeout(() => {
      if (closed) return;
      if (typeof EventSource !== 'undefined') {
        connectWithEventSource();
      } else {
        connectWithXHR();
      }
    }, delay);
  }

  if (typeof EventSource !== 'undefined') {
    connectWithEventSource();
  } else {
    connectWithXHR();
  }

  return function disconnect(): void {
    closed = true;
    cleanup();
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
  };
}

export async function sendMessage(
  token: string,
  sessionId: string,
  message: string,
): Promise<void> {
  await apiFetch<void>(`/api/v1/website/${token}/chat`, {
    method: 'POST',
    body: JSON.stringify({ sessionId, message }),
  });
}

export async function sendFeedback(
  token: string,
  sessionId: string,
  rating: number,
): Promise<void> {
  await apiFetch<void>(`/api/v1/website/${token}/feedback`, {
    method: 'POST',
    body: JSON.stringify({ sessionId, rating }),
  }, 5000);
}

export async function sendLeadCapture(
  token: string,
  sessionId: string,
  data: { name: string; email: string; phone?: string },
): Promise<void> {
  await apiFetch<void>(`/api/v1/website/${token}/lead`, {
    method: 'POST',
    body: JSON.stringify({ sessionId, ...data }),
  });
}

export async function searchKnowledge(
  token: string,
  sessionId: string,
  query: string,
): Promise<{ results: Array<{ title: string; excerpt: string; url?: string }> }> {
  return apiFetch(`/api/v1/website/${token}/knowledge-search`, {
    method: 'POST',
    body: JSON.stringify({ sessionId, query }),
  });
}

export async function sendHumanMessage(
  token: string,
  sessionId: string,
  message: string,
): Promise<void> {
  await apiFetch<void>(`/api/v1/website/${token}/human-response`, {
    method: 'POST',
    body: JSON.stringify({ sessionId, message }),
  });
}

export interface KnowledgeResult {
  title: string;
  excerpt: string;
  url?: string;
}
