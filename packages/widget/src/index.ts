import { type WidgetConfig, defaultConfig } from './config';
import { type Language } from './i18n';
import { widgetStyles } from './styles';
import { createShadowRoot, injectStyles, setDirection } from './shadow-dom';
import { fetchConfig, connectChat, sendMessage, sendLeadCapture, searchKnowledge, sendHumanMessage, type ChatMessage, type KnowledgeResult } from './api';
import {
  renderBubble,
  renderWindow,
  renderMessage,
  renderTyping,
  removeTyping,
  showError,
  updateLanguage,
  setWindowOpen,
  renderLeadForm,
  hideLeadForm,
  renderHandoffBanner,
  removeHandoffBanner,
  renderCarousel,
  renderSearchInput,
  hideSearchInput,
  renderSearchResults,
} from './ui';
import { extractColorsFromLogo, generateColorScheme, applyTheme } from './chameleon';

interface WidgetState {
  config: WidgetConfig;
  sessionId: string;
  isOpen: boolean;
  isConnected: boolean;
  isStreaming: boolean;
  messages: ChatMessage[];
  disconnect: (() => void) | null;
  hostElement: HTMLElement | null;
  shadowRoot: ShadowRoot | null;
  isHandoff: boolean;
  isSearchMode: boolean;
  leadCaptured: boolean;
  popupDismissed: boolean;
  popupTriggered: boolean;
  popupTimer: ReturnType<typeof setTimeout> | null;
  popupTriggersSetup: boolean;
}

const state: WidgetState = {
  config: { ...defaultConfig },
  sessionId: '',
  isOpen: false,
  isConnected: false,
  isStreaming: false,
  messages: [],
  disconnect: null,
  hostElement: null,
  shadowRoot: null,
  isHandoff: false,
  isSearchMode: false,
  leadCaptured: false,
  popupDismissed: false,
  popupTriggered: false,
  popupTimer: null,
  popupTriggersSetup: false,
};

function generateSessionId(): string {
  return 'sess_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 10);
}

function getDismissedKey(): string {
  return 'chatai_popup_dismissed_' + (state.config.token || 'default');
}

function getLeadKey(): string {
  return 'chatai_lead_captured_' + (state.config.token || 'default');
}

function getScriptAttributes(): Partial<WidgetConfig> {
  const attrs: Partial<WidgetConfig> = {};

  let script = document.currentScript as HTMLScriptElement | null;

  if (!script) {
    const scripts = document.querySelectorAll<HTMLScriptElement>('script');
    const srcPattern = /widget\.js/i;
    for (const s of scripts) {
      if (srcPattern.test(s.src || '')) {
        script = s;
        break;
      }
    }
  }

  if (!script) return attrs;

  const token = script.getAttribute('data-token');
  if (token) attrs.token = token;

  const position = script.getAttribute('data-position');
  if (position === 'bottom-right' || position === 'bottom-left') {
    attrs.position = position;
  }

  const color = script.getAttribute('data-color');
  if (color) attrs.primaryColor = color;

  const language = script.getAttribute('data-language');
  if (language === 'en' || language === 'fr' || language === 'ar' || language === 'es') {
    attrs.language = language;
  }

  const apiUrl = script.getAttribute('data-api-url');
  if (apiUrl) attrs.apiUrl = apiUrl;

  const theme = script.getAttribute('data-theme');
  if (theme === 'light' || theme === 'dark') attrs.theme = theme;

  const chameleon = script.getAttribute('data-chameleon');
  if (chameleon === 'false' || chameleon === '0') attrs.chameleonMode = false;

  const urlRules = script.getAttribute('data-url-rules');
  if (urlRules) {
    attrs.popupUrlRules = urlRules.split(',').map((r) => r.trim()).filter(Boolean);
  }

  const popupDelay = script.getAttribute('data-popup-delay');
  if (popupDelay !== null) {
    const n = parseInt(popupDelay, 10);
    if (!isNaN(n) && n >= 0) attrs.popupDelay = n;
  }

  const popupExitIntent = script.getAttribute('data-popup-exit-intent');
  if (popupExitIntent === 'true' || popupExitIntent === '1') attrs.popupExitIntent = true;

  const popupScroll = script.getAttribute('data-popup-scroll');
  if (popupScroll !== null) {
    const n = parseInt(popupScroll, 10);
    if (!isNaN(n) && n >= 0 && n <= 100) attrs.popupScroll = n;
  }

  const leadCapture = script.getAttribute('data-lead-capture');
  if (leadCapture === 'true' || leadCapture === '1') attrs.leadCapture = true;

  const humanHandoff = script.getAttribute('data-human-handoff');
  if (humanHandoff === 'true' || humanHandoff === '1') attrs.humanHandoff = true;

  return attrs;
}

async function loadConfig(): Promise<void> {
  const attrs = getScriptAttributes();
  Object.assign(state.config, attrs);

  if (state.config.token) {
    try {
      const remoteConfig = await fetchConfig(state.config.token);
      if (remoteConfig.position) state.config.position = remoteConfig.position;
      if (remoteConfig.primaryColor) state.config.primaryColor = remoteConfig.primaryColor;
      if (remoteConfig.accentColor) state.config.accentColor = remoteConfig.accentColor;
      if (remoteConfig.icon) state.config.icon = remoteConfig.icon;
      if (remoteConfig.welcomeMessage) state.config.welcomeMessage = remoteConfig.welcomeMessage;
      if (remoteConfig.placeholderText) state.config.placeholderText = remoteConfig.placeholderText;
      if (remoteConfig.language) state.config.language = remoteConfig.language;
      if (remoteConfig.chameleonMode !== undefined) state.config.chameleonMode = remoteConfig.chameleonMode;
      if (remoteConfig.theme) state.config.theme = remoteConfig.theme;
      if (remoteConfig.apiUrl) state.config.apiUrl = remoteConfig.apiUrl;

      if (state.config.chameleonMode && remoteConfig.logoUrl) {
        try {
          const { primary } = await extractColorsFromLogo(remoteConfig.logoUrl);
          state.config.primaryColor = primary;
        } catch {
          // Keep existing primary color
        }
      }
    } catch {
      // Fail silently and use data-attribute config
    }
  }
}

function createHostElement(): HTMLElement {
  const host = document.createElement('div');
  host.id = 'chatai-widget-' + state.config.token.substring(0, 8);
  host.className = `position-${state.config.position}`;
  if (state.config.theme === 'dark') {
    host.classList.add('chatai-theme-dark');
  }
  document.body.appendChild(host);
  return host;
}

function checkUrlRules(): boolean {
  const rules = state.config.popupUrlRules;
  if (!rules || rules.length === 0) return true;
  const currentUrl = window.location.href;
  return rules.some((rule) => {
    if (rule.startsWith('/') && rule.endsWith('/') && rule.length > 1) {
      try {
        return new RegExp(rule.slice(1, -1)).test(currentUrl);
      } catch {
        return currentUrl.includes(rule);
      }
    }
    return currentUrl.includes(rule);
  });
}

/* === POPUP TRIGGERS === */
function setupPopupTriggers(): void {
  if (state.popupTriggersSetup || !state.shadowRoot) return;
  state.popupTriggersSetup = true;

  if (!checkUrlRules()) return;

  const wasDismissed = sessionStorage.getItem(getDismissedKey()) === 'true';

  if (wasDismissed) return;

  const trigger = () => {
    if (state.isOpen || state.popupTriggered) return;
    state.popupTriggered = true;
    openWindow();
  };

  // Time delay
  if (state.config.popupDelay > 0) {
    state.popupTimer = setTimeout(trigger, state.config.popupDelay * 1000);
  }

  // Exit intent
  if (state.config.popupExitIntent) {
    const onMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0 && !state.isOpen && !state.popupTriggered) {
        state.popupTriggered = true;
        openWindow();
        document.removeEventListener('mouseleave', onMouseLeave);
      }
    };
    document.addEventListener('mouseleave', onMouseLeave);
  }

  // Page scroll
  if (state.config.popupScroll > 0 && state.config.popupScroll <= 100) {
    const onScroll = () => {
      const scrollPercent = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
      if (scrollPercent >= state.config.popupScroll && !state.isOpen && !state.popupTriggered) {
        state.popupTriggered = true;
        openWindow();
        window.removeEventListener('scroll', onScroll);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
  }
}

function attachUI(shadowRoot: ShadowRoot): void {
  renderBubble(shadowRoot, state.config);
  const { window: win, messages, input, sendBtn, headerTitle } = renderWindow(shadowRoot, state.config);

  const bubble = shadowRoot.querySelector('.chatai-bubble') as HTMLElement;

  if (bubble) {
    bubble.addEventListener('click', () => {
      toggleWindow();
    });
  }

  const closeBtn = shadowRoot.querySelector('.chatai-header-btn:nth-child(4)') as HTMLElement;
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      closeWindow();
    });
  }

  const minimizeBtn = shadowRoot.querySelector('.chatai-header-btn:nth-child(3)') as HTMLElement;
  if (minimizeBtn) {
    minimizeBtn.addEventListener('click', () => {
      closeWindow();
    });
  }

  const newBtn = shadowRoot.querySelector('.chatai-header-btn:nth-child(2)') as HTMLElement;
  if (newBtn) {
    newBtn.addEventListener('click', () => {
      resetConversation();
    });
  }

  // Search button
  const searchBtn = shadowRoot.querySelector('.chatai-header-btn:nth-child(1)') as HTMLElement;
  if (searchBtn) {
    searchBtn.addEventListener('click', () => {
      toggleSearchMode();
    });
  }

  // Auto-resize textarea
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';

    if (input.value.trim()) {
      sendBtn.removeAttribute('disabled');
    } else {
      sendBtn.setAttribute('disabled', '');
    }
  });

  // Send on Enter (Shift+Enter for newline)
  input.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  sendBtn.addEventListener('click', () => {
    handleSend();
  });

  // Set direction
  setDirection(shadowRoot, state.config.language);

  // Popup triggers
  setupPopupTriggers();
}

function toggleSearchMode(): void {
  if (!state.shadowRoot) return;
  state.isSearchMode = !state.isSearchMode;

  const inputArea = state.shadowRoot.querySelector('.chatai-input-area') as HTMLElement;
  const searchBtn = state.shadowRoot.querySelector('.chatai-header-btn:nth-child(1)') as HTMLElement;

  if (state.isSearchMode) {
    if (inputArea) inputArea.style.display = 'none';
    if (searchBtn) searchBtn.classList.add('is-active');
    renderSearchInput(state.shadowRoot, state.config, (query: string) => {
      handleSearch(query);
    });
  } else {
    hideSearchInput(state.shadowRoot);
    if (inputArea) inputArea.style.display = '';
    if (searchBtn) searchBtn.classList.remove('is-active');
  }
}

async function handleSearch(query: string): Promise<void> {
  if (!state.shadowRoot) return;
  const msgs = state.shadowRoot.querySelector('.chatai-messages') as HTMLElement;
  if (!msgs) return;

  hideSearchInput(state.shadowRoot);
  const inputArea = state.shadowRoot.querySelector('.chatai-input-area') as HTMLElement;
  if (inputArea) inputArea.style.display = '';
  const searchBtn = state.shadowRoot.querySelector('.chatai-header-btn:nth-child(1)') as HTMLElement;
  if (searchBtn) searchBtn.classList.remove('is-active');
  state.isSearchMode = false;

  renderTyping(state.shadowRoot, msgs);

  try {
    const data = await searchKnowledge(state.config.token, state.sessionId, query);
    removeTyping(msgs);

    if (data && data.results && data.results.length > 0) {
      renderSearchResults(state.shadowRoot, data.results, msgs, (result: KnowledgeResult) => {
        const msg = result.title + (result.excerpt ? ': ' + result.excerpt : '');
        const input = state.shadowRoot?.querySelector('.chatai-input') as HTMLTextAreaElement | null;
        if (input) {
          input.value = msg;
          const sendBtn = state.shadowRoot?.querySelector('.chatai-send-btn') as HTMLElement | null;
          if (sendBtn) sendBtn.removeAttribute('disabled');
        }
      });
    } else {
      removeTyping(msgs);
      const empty = document.createElement('div');
      empty.className = 'chatai-search-empty';
      empty.textContent = 'No results found.';
      msgs.appendChild(empty);
    }
  } catch {
    removeTyping(msgs);
    showError(state.shadowRoot, 'Search failed. Please try again.', msgs, () => {
      handleSearch(query);
    });
  }

  msgs.scrollTop = msgs.scrollHeight;
}

function getInputArea(): HTMLElement | null {
  if (!state.shadowRoot) return null;
  return state.shadowRoot.querySelector('.chatai-input-area') as HTMLElement | null;
}

function getMessagesArea(): HTMLElement | null {
  if (!state.shadowRoot) return null;
  return state.shadowRoot.querySelector('.chatai-messages') as HTMLElement | null;
}

function toggleWindow(): void {
  if (state.isOpen) {
    closeWindow();
  } else {
    openWindow();
  }
}

function openWindow(): void {
  if (!state.shadowRoot) return;
  state.isOpen = true;
  setWindowOpen(state.shadowRoot, true);

  if (state.config.leadCapture && !state.leadCaptured) {
    const lcKey = getLeadKey();
    if (sessionStorage.getItem(lcKey) === 'true') {
      state.leadCaptured = true;
    } else {
      const msgs = getMessagesArea();
      const inputArea = getInputArea();
      if (msgs && inputArea) {
        const form = renderLeadForm(state.shadowRoot, state.config, msgs, inputArea);
        form.addEventListener('chatai-lead-submit', async (e: Event) => {
          const detail = (e as CustomEvent).detail;
          if (!detail) return;
          try {
            await sendLeadCapture(state.config.token, state.sessionId, detail);
            state.leadCaptured = true;
            sessionStorage.setItem(lcKey, 'true');
            hideLeadForm(state.shadowRoot!, msgs, inputArea);
            if (!state.isConnected && state.config.token) {
              connectToStream();
            }
          } catch {
            const submitBtn = form.querySelector('.chatai-lead-submit') as HTMLButtonElement | null;
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.textContent = 'Start Chat';
              submitBtn.style.border = '1px solid #dc3545';
              submitBtn.style.color = '#dc3545';
              submitBtn.style.background = 'transparent';
              setTimeout(() => {
                submitBtn.style.border = '';
                submitBtn.style.color = '';
                submitBtn.style.background = '';
              }, 2000);
            }
          }
        });
        return;
      }
    }
  }

  if (!state.isConnected && state.config.token) {
    connectToStream();
  }
}

function closeWindow(): void {
  if (!state.shadowRoot) return;
  state.isOpen = false;
  setWindowOpen(state.shadowRoot, false);

  if (state.isSearchMode) {
    state.isSearchMode = false;
    hideSearchInput(state.shadowRoot);
    const inputArea = getInputArea();
    if (inputArea) inputArea.style.display = '';
    const searchBtn = state.shadowRoot.querySelector('.chatai-header-btn:nth-child(1)') as HTMLElement;
    if (searchBtn) searchBtn.classList.remove('is-active');
  }

  if (state.popupTriggered) {
    sessionStorage.setItem(getDismissedKey(), 'true');
    state.popupDismissed = true;
  }
}

async function handleSend(): Promise<void> {
  if (!state.shadowRoot) return;

  const input = state.shadowRoot.querySelector('.chatai-input') as HTMLTextAreaElement | null;
  if (!input) return;

  const message = input.value.trim();
  if (!message || state.isStreaming) return;

  input.value = '';
  input.style.height = 'auto';
  const sendBtn = state.shadowRoot.querySelector('.chatai-send-btn') as HTMLElement | null;
  if (sendBtn) sendBtn.setAttribute('disabled', '');
  const messagesArea = state.shadowRoot.querySelector('.chatai-messages') as HTMLElement;
  if (!messagesArea) return;

  const welcome = messagesArea.querySelector('.chatai-welcome');
  if (welcome) welcome.remove();

  const userMsg: ChatMessage = {
    id: 'msg_' + Date.now().toString(36),
    content: message,
    role: 'user',
    timestamp: Date.now(),
  };
  state.messages.push(userMsg);
  renderMessage(state.shadowRoot, userMsg, true, messagesArea);

  renderTyping(state.shadowRoot, messagesArea);
  state.isStreaming = true;

  try {
    if (state.isHandoff && state.config.humanHandoff) {
      await sendHumanMessage(state.config.token, state.sessionId, message);
      removeTyping(messagesArea);
      state.isStreaming = false;

      const agentMsg: ChatMessage = {
        id: 'msg_' + Date.now().toString(36) + '_agent',
        content: 'Message sent to agent.',
        role: 'assistant',
        timestamp: Date.now(),
      };
      state.messages.push(agentMsg);
      renderMessage(state.shadowRoot, agentMsg, false, messagesArea);
    } else {
      await sendMessage(state.config.token, state.sessionId, message);
    }
  } catch (err) {
    removeTyping(messagesArea);
    state.isStreaming = false;
    const errorMsg = err instanceof Error ? err.message : 'Failed to send message';
    showError(state.shadowRoot, errorMsg, messagesArea, () => {
      handleSend();
    });
  }
}

function handleSpecialMessage(content: string): boolean {
  if (content.startsWith('__handoff__')) {
    if (state.config.humanHandoff && state.shadowRoot) {
      state.isHandoff = true;
      const msgs = getMessagesArea();
      if (msgs) {
        removeTyping(msgs);
        renderHandoffBanner(state.shadowRoot, msgs, state.config);
      }
    }
    return true;
  }

  if (content.startsWith('__carousel__')) {
    try {
      const jsonStr = content.substring('__carousel__'.length);
      const data = JSON.parse(jsonStr);
      if (data && data.type === 'carousel' && Array.isArray(data.products) && state.shadowRoot) {
        const msgs = getMessagesArea();
        if (msgs) {
          removeTyping(msgs);
          renderCarousel(state.shadowRoot, data.products, msgs);
        }
      }
    } catch {
      // Invalid carousel data, render as normal message
      return false;
    }
    return true;
  }

  return false;
}

function connectToStream(): void {
  if (!state.shadowRoot) return;

  state.isConnected = true;
  const messagesArea = state.shadowRoot.querySelector('.chatai-messages') as HTMLElement;
  if (!messagesArea) return;

  state.disconnect = connectChat(
    state.config.token,
    state.sessionId,
    (message: ChatMessage) => {
      if (!state.shadowRoot) return;
      const msgs = state.shadowRoot.querySelector('.chatai-messages') as HTMLElement;
      if (!msgs) return;

      removeTyping(msgs);
      state.isStreaming = false;

      const lastMsg = state.messages[state.messages.length - 1];
      if (lastMsg && lastMsg.role === 'assistant' && lastMsg.id === message.id) {
        const newContent = lastMsg.content + message.content;
        lastMsg.content = newContent;

        if (handleSpecialMessage(newContent)) {
          state.messages.pop();
          const bubbles = msgs.querySelectorAll('.chatai-message--ai');
          const lastBubble = bubbles[bubbles.length - 1] as HTMLElement | null;
          if (lastBubble) lastBubble.remove();
          return;
        }

        const bubbles = msgs.querySelectorAll('.chatai-message--ai');
        const lastBubble = bubbles[bubbles.length - 1] as HTMLElement | null;
        if (lastBubble) {
          lastBubble.textContent = lastMsg.content;
          const time = document.createElement('div');
          time.className = 'chatai-message-time';
          time.textContent = new Date(lastMsg.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          });
          lastBubble.appendChild(time);
        }
      } else {
        if (handleSpecialMessage(message.content)) {
          return;
        }
        state.messages.push(message);
        renderMessage(state.shadowRoot, message, false, msgs);
      }

      msgs.scrollTop = msgs.scrollHeight;
    },
    (error: Error) => {
      if (!state.shadowRoot) return;
      const msgs = state.shadowRoot.querySelector('.chatai-messages') as HTMLElement;
      if (!msgs) return;

      removeTyping(msgs);
      state.isStreaming = false;
    },
  );
}

function resetConversation(): void {
  if (state.disconnect) {
    state.disconnect();
    state.disconnect = null;
  }

  state.sessionId = generateSessionId();
  state.messages = [];
  state.isConnected = false;
  state.isStreaming = false;
  state.isHandoff = false;

  if (!state.shadowRoot) return;

  removeHandoffBanner(state.shadowRoot);
  hideSearchInput(state.shadowRoot);
  state.isSearchMode = false;
  const inputArea = getInputArea();
  if (inputArea) inputArea.style.display = '';
  const searchBtn = state.shadowRoot.querySelector('.chatai-header-btn:nth-child(1)') as HTMLElement;
  if (searchBtn) searchBtn.classList.remove('is-active');

  const messagesArea = state.shadowRoot.querySelector('.chatai-messages') as HTMLElement;
  if (messagesArea) {
    messagesArea.innerHTML = '';
    const welcomeDiv = document.createElement('div');
    welcomeDiv.className = 'chatai-welcome';
    welcomeDiv.innerHTML = `
      <div class="chatai-welcome-icon">
        <svg viewBox="0 0 24 24"><path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/></svg>
      </div>
      <div class="chatai-welcome-title">ChatAi.ma</div>
      <div class="chatai-welcome-text">${state.config.welcomeMessage}</div>
    `;
    messagesArea.appendChild(welcomeDiv);
  }

  const input = state.shadowRoot.querySelector('.chatai-input') as HTMLTextAreaElement | null;
  if (input) {
    input.value = '';
    input.disabled = false;
    input.focus();
  }
}

async function init(): Promise<void> {
  await loadConfig();

  if (state.config.chameleonMode && !state.config.primaryColor) {
    const logos = document.querySelectorAll('img[alt*="logo" i], img[class*="logo" i], img[id*="logo" i]');
    if (logos.length > 0) {
      const logoImg = logos[0] as HTMLImageElement;
      if (logoImg.src) {
        try {
          const { primary } = await extractColorsFromLogo(logoImg.src);
          state.config.primaryColor = primary;
        } catch {
          // Keep default
        }
      }
    }
  }

  state.sessionId = generateSessionId();

  const host = createHostElement();
  state.hostElement = host;

  const shadowRoot = createShadowRoot(host);
  state.shadowRoot = shadowRoot;

  injectStyles(shadowRoot, widgetStyles);

  const scheme = generateColorScheme(state.config.primaryColor, state.config.theme);
  applyTheme(shadowRoot, scheme, state.config.theme);

  attachUI(shadowRoot);
}

// Public API
const ChatAiWidget = {
  open(): void {
    if (!state.isOpen) {
      openWindow();
    }
  },

  close(): void {
    if (state.isOpen) {
      closeWindow();
    }
  },

  toggle(): void {
    toggleWindow();
  },

  setLanguage(lang: Language): void {
    state.config.language = lang;
    if (state.shadowRoot) {
      updateLanguage(state.shadowRoot, lang);
      setDirection(state.shadowRoot, lang);
    }
  },

  setTheme(theme: 'light' | 'dark'): void {
    state.config.theme = theme;
    if (state.shadowRoot) {
      const scheme = generateColorScheme(state.config.primaryColor, theme);
      applyTheme(state.shadowRoot, scheme, theme);
    }
  },

  setPrimaryColor(color: string): void {
    state.config.primaryColor = color;
    if (state.shadowRoot) {
      const scheme = generateColorScheme(color, state.config.theme);
      applyTheme(state.shadowRoot, scheme, state.config.theme);
    }
  },

  resetConversation(): void {
    resetConversation();
  },

  getConfig(): WidgetConfig {
    return { ...state.config };
  },

  isOpen(): boolean {
    return state.isOpen;
  },
};

if (typeof window !== 'undefined') {
  (window as any).ChatAiWidget = ChatAiWidget;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

export default ChatAiWidget;
