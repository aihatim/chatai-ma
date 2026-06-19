import type { WidgetConfig } from './config';
import { getTranslation, isRTL, type Language } from './i18n';
import { createElement, setDirection } from './shadow-dom';
import type { ChatMessage, KnowledgeResult } from './api';

interface UIElements {
  container: HTMLElement;
  bubble: HTMLElement;
  window: HTMLElement;
  messages: HTMLElement;
  input: HTMLTextAreaElement;
  sendBtn: HTMLElement;
  headerTitle: HTMLElement;
  leadForm: HTMLElement | null;
  handoffBanner: HTMLElement | null;
  searchBtn: HTMLElement | null;
}

let elements: UIElements | null = null;

const S = {
  bot: '<svg viewBox="0 0 24 24"><path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2zM9 10a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm6 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm-6 4a3 3 0 0 0 6 0H9z"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>',
  minimize: '<svg viewBox="0 0 24 24"><path d="M19 13H5v-2h14v2z"/></svg>',
  send: '<svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>',
  newChat: '<svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>',
  chatBubble: '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>',
  search: '<svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>',
  person: '<svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>',
  chevronLeft: '<svg viewBox="0 0 24 24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>',
  chevronRight: '<svg viewBox="0 0 24 24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>',
};

function createHeader(shadowRoot: ShadowRoot, config: WidgetConfig): HTMLElement {
  const header = createElement(shadowRoot, 'div', { className: 'chatai-header' });

  const iconWrap = createElement(header, 'div', { className: 'chatai-header-icon' });
  iconWrap.innerHTML = S.bot;

  const info = createElement(header, 'div', { className: 'chatai-header-info' });
  const title = createElement(info, 'div', { className: 'chatai-header-title' });
  title.textContent = 'ChatAi.ma';

  const subtitle = createElement(info, 'div', { className: 'chatai-header-subtitle' });
  subtitle.textContent = getTranslation(config.language, 'welcome');

  const actions = createElement(header, 'div', { className: 'chatai-header-actions' });

  const searchBtn = createElement(actions, 'button', {
    className: 'chatai-header-btn',
    'aria-label': getTranslation(config.language, 'search'),
  });
  searchBtn.innerHTML = S.search;

  const newBtn = createElement(actions, 'button', {
    className: 'chatai-header-btn',
    'aria-label': getTranslation(config.language, 'newConversation'),
  });
  newBtn.innerHTML = S.newChat;

  const minimizeBtn = createElement(actions, 'button', {
    className: 'chatai-header-btn',
    'aria-label': getTranslation(config.language, 'minimize'),
  });
  minimizeBtn.innerHTML = S.minimize;

  const closeBtn = createElement(actions, 'button', {
    className: 'chatai-header-btn',
    'aria-label': getTranslation(config.language, 'close'),
  });
  closeBtn.innerHTML = S.close;

  return header;
}

function createMessagesArea(shadowRoot: ShadowRoot): HTMLElement {
  return createElement(shadowRoot, 'div', { className: 'chatai-messages', 'role': 'log', 'aria-live': 'polite' });
}

function createWelcome(shadowRoot: ShadowRoot, config: WidgetConfig, messagesArea: HTMLElement): HTMLElement {
  const welcome = createElement(messagesArea, 'div', { className: 'chatai-welcome' });

  const iconWrap = createElement(welcome, 'div', { className: 'chatai-welcome-icon' });
  iconWrap.innerHTML = S.bot;

  const title = createElement(welcome, 'div', { className: 'chatai-welcome-title' });
  title.textContent = 'ChatAi.ma';

  const text = createElement(welcome, 'div', { className: 'chatai-welcome-text' });
  text.textContent = config.welcomeMessage || getTranslation(config.language, 'welcome');

  return welcome;
}

function createInputArea(shadowRoot: ShadowRoot, config: WidgetConfig): { area: HTMLElement; input: HTMLTextAreaElement; sendBtn: HTMLElement } {
  const area = createElement(shadowRoot, 'div', { className: 'chatai-input-area' });

  const input = createElement(area, 'textarea', {
    className: 'chatai-input',
    placeholder: getTranslation(config.language, 'placeholder'),
    'aria-label': getTranslation(config.language, 'placeholder'),
    rows: '1',
  }) as HTMLTextAreaElement;

  const sendBtn = createElement(area, 'button', {
    className: 'chatai-send-btn',
    'aria-label': getTranslation(config.language, 'send'),
    disabled: '',
  });
  sendBtn.innerHTML = S.send;

  return { area, input, sendBtn };
}

function createFooter(shadowRoot: ShadowRoot, config: WidgetConfig): HTMLElement {
  const footer = createElement(shadowRoot, 'div', { className: 'chatai-footer' });
  const link = createElement(footer, 'a', {
    href: 'https://chatai.ma',
    target: '_blank',
    rel: 'noopener noreferrer',
  });
  link.textContent = getTranslation(config.language, 'poweredBy');
  return footer;
}

export function renderBubble(shadowRoot: ShadowRoot, config: WidgetConfig): HTMLElement {
  const container = createElement(shadowRoot, 'div', { className: 'chatai-container' });

  const bubble = createElement(container, 'button', {
    className: 'chatai-bubble',
    'aria-label': 'Open chat',
    'aria-expanded': 'false',
  });
  bubble.innerHTML = S.chatBubble;

  return bubble;
}

export function renderWindow(shadowRoot: ShadowRoot, config: WidgetConfig): {
  window: HTMLElement;
  messages: HTMLElement;
  input: HTMLTextAreaElement;
  sendBtn: HTMLElement;
  headerTitle: HTMLElement;
} {
  const win = createElement(shadowRoot, 'div', { className: 'chatai-window' });

  const header = createHeader(shadowRoot, config);
  const messages = createMessagesArea(shadowRoot);
  const { area, input, sendBtn } = createInputArea(shadowRoot, config);
  const footer = createFooter(shadowRoot, config);

  createWelcome(shadowRoot, config, messages);

  const headerTitle = header.querySelector('.chatai-header-title') as HTMLElement;

  elements = {
    container: shadowRoot.querySelector('.chatai-container') as HTMLElement,
    bubble: shadowRoot.querySelector('.chatai-bubble') as HTMLElement,
    window: win,
    messages,
    input,
    sendBtn,
    headerTitle,
    leadForm: null,
    handoffBanner: null,
    searchBtn: header.querySelector('.chatai-header-btn:first-child') as HTMLElement,
  };

  return {
    window: win,
    messages,
    input,
    sendBtn,
    headerTitle,
  };
}

export function renderMessage(
  shadowRoot: ShadowRoot,
  message: ChatMessage,
  isUser: boolean,
  messagesArea: HTMLElement,
): HTMLElement {
  const el = createElement(messagesArea, 'div', {
    className: `chatai-message chatai-message--${isUser ? 'user' : 'ai'}`,
  });
  el.textContent = message.content;

  const time = createElement(el, 'div', { className: 'chatai-message-time' });
  time.textContent = new Date(message.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  messagesArea.scrollTop = messagesArea.scrollHeight;
  return el;
}

export function renderTyping(shadowRoot: ShadowRoot, messagesArea: HTMLElement): HTMLElement {
  const el = createElement(messagesArea, 'div', { className: 'chatai-typing' });

  for (let i = 0; i < 3; i++) {
    createElement(el, 'span', { className: 'chatai-typing-dot' });
  }

  messagesArea.scrollTop = messagesArea.scrollHeight;
  return el;
}

export function removeTyping(messagesArea: HTMLElement): void {
  const typing = messagesArea.querySelector('.chatai-typing');
  if (typing) {
    typing.remove();
  }
}

export function showError(shadowRoot: ShadowRoot, message: string, messagesArea: HTMLElement, onRetry: () => void): HTMLElement {
  const el = createElement(messagesArea, 'div', { className: 'chatai-message chatai-message--error' });
  el.textContent = message;

  const retryBtn = createElement(el, 'button', { className: 'chatai-error-retry' });
  retryBtn.textContent = 'Retry';
  retryBtn.addEventListener('click', () => {
    el.remove();
    onRetry();
  });

  messagesArea.scrollTop = messagesArea.scrollHeight;
  return el;
}

export function showLoading(shadowRoot: ShadowRoot, messagesArea: HTMLElement): HTMLElement {
  const spinner = createElement(messagesArea, 'div', { className: 'chatai-spinner' });
  createElement(spinner, 'div', { className: 'chatai-spinner-circle' });
  return spinner;
}

export function removeLoading(shadowRoot: ShadowRoot, messagesArea: HTMLElement): void {
  const spinner = messagesArea.querySelector('.chatai-spinner');
  if (spinner) {
    spinner.remove();
  }
}

export function updateLanguage(shadowRoot: ShadowRoot, lang: Language): void {
  setDirection(shadowRoot, lang);

  const container = shadowRoot.querySelector('.chatai-container');
  if (container) {
    (container as HTMLElement).style.direction = isRTL(lang) ? 'rtl' : 'ltr';
  }

  const input = shadowRoot.querySelector('.chatai-input') as HTMLTextAreaElement | null;
  if (input) {
    input.placeholder = getTranslation(lang, 'placeholder');
  }

  const sendBtn = shadowRoot.querySelector('.chatai-send-btn') as HTMLElement | null;
  if (sendBtn) {
    sendBtn.setAttribute('aria-label', getTranslation(lang, 'send'));
  }

  const welcomeText = shadowRoot.querySelector('.chatai-welcome-text') as HTMLElement | null;
  if (welcomeText) {
    welcomeText.textContent = getTranslation(lang, 'welcome');
  }

  const footerLink = shadowRoot.querySelector('.chatai-footer a') as HTMLElement | null;
  if (footerLink) {
    footerLink.textContent = getTranslation(lang, 'poweredBy');
  }

  const minimizeBtn = shadowRoot.querySelector('.chatai-header-btn:nth-child(3)') as HTMLElement | null;
  if (minimizeBtn) {
    minimizeBtn.setAttribute('aria-label', getTranslation(lang, 'minimize'));
  }

  const closeBtn = shadowRoot.querySelector('.chatai-header-btn:nth-child(4)') as HTMLElement | null;
  if (closeBtn) {
    closeBtn.setAttribute('aria-label', getTranslation(lang, 'close'));
  }

  const newBtn = shadowRoot.querySelector('.chatai-header-btn:nth-child(2)') as HTMLElement | null;
  if (newBtn) {
    newBtn.setAttribute('aria-label', getTranslation(lang, 'newConversation'));
  }

  const searchBtn = shadowRoot.querySelector('.chatai-header-btn:nth-child(1)') as HTMLElement | null;
  if (searchBtn) {
    searchBtn.setAttribute('aria-label', getTranslation(lang, 'search'));
  }

  const langT = getTranslation(lang, 'leadName');
  const leadInputs = shadowRoot.querySelectorAll('.chatai-lead-input');
  const leadLabels = ['leadName', 'leadEmail', 'leadPhone'];
  leadInputs.forEach((el, i) => {
    if (i < leadLabels.length) {
      (el as HTMLInputElement).placeholder = getTranslation(lang, leadLabels[i] as any);
    }
  });

  const leadSubmit = shadowRoot.querySelector('.chatai-lead-submit') as HTMLElement | null;
  if (leadSubmit) {
    leadSubmit.textContent = getTranslation(lang, 'leadSubmit');
  }
}

export function setWindowOpen(shadowRoot: ShadowRoot, isOpen: boolean): void {
  const bubble = shadowRoot.querySelector('.chatai-bubble') as HTMLElement | null;
  if (bubble) {
    bubble.classList.toggle('is-open', isOpen);
    bubble.setAttribute('aria-expanded', String(isOpen));
  }

  const win = shadowRoot.querySelector('.chatai-window') as HTMLElement | null;
  if (win) {
    win.classList.toggle('is-open', isOpen);
  }
}

/* === LEAD CAPTURE FORM === */
export function renderLeadForm(shadowRoot: ShadowRoot, config: WidgetConfig, messagesArea: HTMLElement, inputArea: HTMLElement): HTMLElement {
  messagesArea.style.display = 'none';
  inputArea.style.display = 'none';

  const existing = shadowRoot.querySelector('.chatai-lead-form') as HTMLElement;
  if (existing) existing.remove();

  const form = createElement(shadowRoot, 'div', { className: 'chatai-lead-form' });

  const card = createElement(form, 'div', { className: 'chatai-lead-form-card' });

  const icon = createElement(card, 'div', { className: 'chatai-lead-form-icon' });
  icon.innerHTML = S.bot;

  const h3 = createElement(card, 'h3');
  h3.textContent = 'ChatAi.ma';

  const p = createElement(card, 'p');
  p.textContent = getTranslation(config.language, 'welcome');

  const nameInput = createElement(card, 'input', {
    className: 'chatai-lead-input',
    placeholder: getTranslation(config.language, 'leadName'),
    type: 'text',
    autocomplete: 'name',
    required: '',
  }) as HTMLInputElement;

  const nameError = createElement(card, 'div', { className: 'chatai-lead-error' });
  nameError.textContent = getTranslation(config.language, 'leadRequired');

  const emailInput = createElement(card, 'input', {
    className: 'chatai-lead-input',
    placeholder: getTranslation(config.language, 'leadEmail'),
    type: 'email',
    autocomplete: 'email',
    required: '',
  }) as HTMLInputElement;

  const emailError = createElement(card, 'div', { className: 'chatai-lead-error' });
  emailError.textContent = getTranslation(config.language, 'leadRequired');

  const phoneInput = createElement(card, 'input', {
    className: 'chatai-lead-input',
    placeholder: getTranslation(config.language, 'leadPhone'),
    type: 'tel',
    autocomplete: 'tel',
  }) as HTMLInputElement;

  const submitBtn = createElement(card, 'button', { className: 'chatai-lead-submit' }) as HTMLButtonElement;
  submitBtn.textContent = getTranslation(config.language, 'leadSubmit');

  function validate(): boolean {
    let valid = true;
    if (!nameInput.value.trim()) {
      nameError.classList.add('is-visible');
      nameInput.classList.add('is-error');
      valid = false;
    } else {
      nameError.classList.remove('is-visible');
      nameInput.classList.remove('is-error');
    }
    if (!emailInput.value.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.value.trim())) {
      emailError.classList.add('is-visible');
      emailInput.classList.add('is-error');
      valid = false;
    } else {
      emailError.classList.remove('is-visible');
      emailInput.classList.remove('is-error');
    }
    return valid;
  }

  nameInput.addEventListener('input', () => {
    if (nameInput.value.trim()) {
      nameError.classList.remove('is-visible');
      nameInput.classList.remove('is-error');
    }
  });

  emailInput.addEventListener('input', () => {
    if (emailInput.value.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.value.trim())) {
      emailError.classList.remove('is-visible');
      emailInput.classList.remove('is-error');
    }
  });

  submitBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (!validate()) return;
    submitBtn.disabled = true;
    submitBtn.textContent = '...';
    const detail = {
      name: nameInput.value.trim(),
      email: emailInput.value.trim(),
      phone: phoneInput.value.trim() || undefined,
    };
    const event = new CustomEvent('chatai-lead-submit', { detail, bubbles: true, composed: true });
    form.dispatchEvent(event);
  });

  if (elements) elements.leadForm = form;
  return form;
}

export function hideLeadForm(shadowRoot: ShadowRoot, messagesArea: HTMLElement, inputArea: HTMLElement): void {
  const form = shadowRoot.querySelector('.chatai-lead-form') as HTMLElement;
  if (form) form.remove();
  messagesArea.style.display = '';
  inputArea.style.display = '';
  if (elements) elements.leadForm = null;
}

/* === HANDOFF BANNER === */
export function renderHandoffBanner(shadowRoot: ShadowRoot, messagesArea: HTMLElement, config: WidgetConfig): HTMLElement {
  const existing = shadowRoot.querySelector('.chatai-handoff-banner') as HTMLElement;
  if (existing) return existing;

  const banner = createElement(messagesArea, 'div', { className: 'chatai-handoff-banner' });
  banner.innerHTML = S.person;
  const span = createElement(banner, 'span');
  span.textContent = getTranslation(config.language, 'handoffConnected');

  if (elements) elements.handoffBanner = banner;
  return banner;
}

export function removeHandoffBanner(shadowRoot: ShadowRoot): void {
  const banner = shadowRoot.querySelector('.chatai-handoff-banner');
  if (banner) banner.remove();
  if (elements) elements.handoffBanner = null;
}

/* === PRODUCT CAROUSEL === */
export function renderCarousel(
  shadowRoot: ShadowRoot,
  products: Array<{ title: string; description: string; imageUrl: string; linkUrl: string }>,
  messagesArea: HTMLElement,
): HTMLElement {
  const wrapper = createElement(messagesArea, 'div', { className: 'chatai-carousel' });

  const track = createElement(wrapper, 'div', { className: 'chatai-carousel-track' });

  for (const product of products) {
    const card = createElement(track, 'div', { className: 'chatai-carousel-card' });

    if (product.imageUrl) {
      const img = createElement(card, 'img', {
        src: product.imageUrl,
        alt: product.title || '',
        loading: 'lazy',
      }) as HTMLImageElement;
      img.onerror = () => { img.style.display = 'none'; };
    }

    const body = createElement(card, 'div', { className: 'chatai-carousel-card-body' });
    const title = createElement(body, 'div', { className: 'chatai-carousel-card-title' });
    title.textContent = product.title || '';

    const desc = createElement(body, 'div', { className: 'chatai-carousel-card-desc' });
    desc.textContent = product.description || '';

    if (product.linkUrl) {
      const link = createElement(body, 'a', {
        className: 'chatai-carousel-card-btn',
        href: product.linkUrl,
        target: '_blank',
        rel: 'noopener noreferrer',
      });
      link.textContent = 'View';
    }
  }

  const showArrows = () => {
    if (track.scrollWidth > track.clientWidth) {
      leftArrow.classList.add('is-visible');
      rightArrow.classList.add('is-visible');
    }
  };

  const leftArrow = createElement(wrapper, 'button', { className: 'chatai-carousel-arrow chatai-carousel-arrow--left' });
  leftArrow.innerHTML = S.chevronLeft;
  leftArrow.addEventListener('click', () => {
    track.scrollBy({ left: -200, behavior: 'smooth' });
  });

  const rightArrow = createElement(wrapper, 'button', { className: 'chatai-carousel-arrow chatai-carousel-arrow--right' });
  rightArrow.innerHTML = S.chevronRight;
  rightArrow.addEventListener('click', () => {
    track.scrollBy({ left: 200, behavior: 'smooth' });
  });

  requestAnimationFrame(showArrows);

  messagesArea.scrollTop = messagesArea.scrollHeight;
  return wrapper;
}

/* === SEARCH UI === */
export function renderSearchInput(shadowRoot: ShadowRoot, config: WidgetConfig, onSearch: (query: string) => void): HTMLElement {
  const existing = shadowRoot.querySelector('.chatai-search-input-area') as HTMLElement;
  if (existing) return existing;

  const area = createElement(shadowRoot, 'div', { className: 'chatai-search-input-area' });

  const input = createElement(area, 'input', {
    className: 'chatai-search-input',
    placeholder: getTranslation(config.language, 'searchPlaceholder'),
    'aria-label': getTranslation(config.language, 'searchPlaceholder'),
    type: 'text',
    autocomplete: 'off',
  }) as HTMLInputElement;

  input.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const q = input.value.trim();
      if (q) onSearch(q);
    }
  });

  const closeBtn = createElement(area, 'button', {
    className: 'chatai-search-close-btn',
    'aria-label': 'Close search',
  });
  closeBtn.innerHTML = S.close;
  closeBtn.addEventListener('click', () => {
    hideSearchInput(shadowRoot);
  });

  input.focus();
  return area;
}

export function hideSearchInput(shadowRoot: ShadowRoot): void {
  const area = shadowRoot.querySelector('.chatai-search-input-area') as HTMLElement;
  if (area) area.remove();
}

export function renderSearchResults(
  shadowRoot: ShadowRoot,
  results: KnowledgeResult[],
  messagesArea: HTMLElement,
  onSelect: (result: KnowledgeResult) => void,
): void {
  if (results.length === 0) {
    const empty = createElement(messagesArea, 'div', { className: 'chatai-search-empty' });
    empty.textContent = 'No results found.';
    return;
  }

  for (const result of results) {
    const el = createElement(messagesArea, 'div', { className: 'chatai-search-result' });
    const title = createElement(el, 'div', { className: 'chatai-search-result-title' });
    title.textContent = result.title;
    const excerpt = createElement(el, 'div', { className: 'chatai-search-result-excerpt' });
    excerpt.textContent = result.excerpt;

    el.addEventListener('click', () => {
      onSelect(result);
    });
  }

  messagesArea.scrollTop = messagesArea.scrollHeight;
}


