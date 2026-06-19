import { isRTL, type Language } from './i18n';

let styleCleanups: Map<ShadowRoot, () => void> = new Map();

export function createShadowRoot(hostElement: HTMLElement): ShadowRoot {
  return hostElement.attachShadow({ mode: 'closed' });
}

export function injectStyles(shadowRoot: ShadowRoot, css: string): void {
  const style = document.createElement('style');
  style.textContent = css;
  shadowRoot.appendChild(style);
}

export function createElement<K extends keyof HTMLElementTagNameMap>(
  parent: ShadowRoot | HTMLElement,
  tag: K,
  attrs?: Record<string, string> | null,
  children?: (string | HTMLElement)[],
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      if (key === 'className') {
        el.className = value;
      } else if (key === 'innerHTML') {
        el.innerHTML = value;
      } else {
        el.setAttribute(key, value);
      }
    }
  }
  if (children) {
    for (const child of children) {
      if (typeof child === 'string') {
        el.appendChild(document.createTextNode(child));
      } else if (child instanceof Node) {
        el.appendChild(child);
      }
    }
  }
  parent.appendChild(el);
  return el;
}

export function getRootDirection(lang: Language): 'ltr' | 'rtl' {
  return isRTL(lang) ? 'rtl' : 'ltr';
}

export function setDirection(shadowRoot: ShadowRoot, lang: Language): void {
  const root = shadowRoot.querySelector('html') || shadowRoot.firstChild;
  if (root instanceof HTMLElement) {
    root.setAttribute('dir', getRootDirection(lang));
  }
  const host = shadowRoot.host;
  host.setAttribute('dir', getRootDirection(lang));
}

export function clearShadowRoot(shadowRoot: ShadowRoot): void {
  while (shadowRoot.firstChild) {
    shadowRoot.removeChild(shadowRoot.firstChild);
  }
}

export function removeElement(el: HTMLElement): void {
  el.parentNode?.removeChild(el);
}
