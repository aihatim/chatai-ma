export const widgetStyles = `
  :host {
    all: initial;
    --widget-primary: #B8860B;
    --widget-primary-hover: #D4AF37;
    --widget-primary-light: rgba(184, 134, 11, 0.1);
    --widget-bg: #ffffff;
    --widget-bg-secondary: #f8f9fa;
    --widget-text: #1a1a2e;
    --widget-text-secondary: #6c757d;
    --widget-user-bubble: #B8860B;
    --widget-user-text: #ffffff;
    --widget-ai-bubble: #f0f0f5;
    --widget-ai-text: #1a1a2e;
    --widget-input-bg: #f5f5f5;
    --widget-input-border: #e0e0e0;
    --widget-input-focus: #B8860B;
    --widget-border: #e8e8e8;
    --widget-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
    --widget-shadow-hover: 0 12px 40px rgba(0, 0, 0, 0.2);
    --widget-radius: 16px;
    --widget-radius-sm: 8px;
    --widget-font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    --widget-z: 2147483647;
    --widget-transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    position: fixed !important;
    z-index: var(--widget-z) !important;
    bottom: 0 !important;
    right: 0 !important;
    pointer-events: none !important;
  }

  :host([dir="rtl"]) {
    right: auto !important;
    left: 0 !important;
  }

  :host(.position-bottom-left) {
    right: auto !important;
    left: 0 !important;
  }

  :host(.position-bottom-left[dir="rtl"]) {
    left: auto !important;
    right: 0 !important;
  }

  *,
  *::before,
  *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  .chatai-container {
    font-family: var(--widget-font);
    color: var(--widget-text);
    pointer-events: auto;
    position: relative;
    direction: ltr;
  }

  [dir="rtl"] .chatai-container {
    direction: rtl;
  }

  /* === BUBBLE BUTTON === */
  .chatai-bubble {
    position: fixed;
    bottom: 24px;
    right: 24px;
    width: 60px;
    height: 60px;
    border-radius: 50%;
    background: var(--widget-primary);
    color: #fff;
    border: none;
    cursor: pointer;
    box-shadow: 0 4px 16px rgba(184, 134, 11, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--widget-transition);
    z-index: calc(var(--widget-z) - 1);
    animation: chatai-bubble-enter 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  }

  .chatai-bubble:hover {
    transform: scale(1.08);
    box-shadow: 0 6px 24px rgba(184, 134, 11, 0.4);
  }

  .chatai-bubble:active {
    transform: scale(0.95);
  }

  .chatai-bubble svg {
    width: 28px;
    height: 28px;
    fill: currentColor;
    transition: transform var(--widget-transition);
  }

  .chatai-bubble.is-open svg {
    transform: rotate(45deg);
  }

  .position-bottom-left .chatai-bubble {
    right: auto;
    left: 24px;
  }

  @keyframes chatai-bubble-enter {
    0% { opacity: 0; transform: scale(0) translateY(20px); }
    100% { opacity: 1; transform: scale(1) translateY(0); }
  }

  /* === BADGE === */
  .chatai-badge {
    position: absolute;
    top: -4px;
    right: -4px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #dc3545;
    color: #fff;
    font-size: 11px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid #fff;
    animation: chatai-badge-pulse 2s infinite;
  }

  @keyframes chatai-badge-pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.1); }
  }

  /* === WINDOW === */
  .chatai-window {
    position: fixed;
    bottom: 96px;
    right: 24px;
    width: 380px;
    max-height: 600px;
    height: min(600px, calc(100vh - 120px));
    background: var(--widget-bg);
    border-radius: var(--widget-radius);
    box-shadow: var(--widget-shadow);
    display: none;
    flex-direction: column;
    overflow: hidden;
    z-index: calc(var(--widget-z) - 1);
    animation: chatai-window-enter var(--widget-transition) both;
    transform-origin: bottom right;
  }

  :host(.position-bottom-left) .chatai-window {
    right: auto;
    left: 24px;
    transform-origin: bottom left;
  }

  .chatai-window.is-open {
    display: flex;
  }

  @keyframes chatai-window-enter {
    0% { opacity: 0; transform: scale(0.9) translateY(20px); }
    100% { opacity: 1; transform: scale(1) translateY(0); }
  }

  /* === HEADER === */
  .chatai-header {
    background: var(--widget-primary);
    color: #fff;
    padding: 16px 20px;
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
    position: relative;
  }

  .chatai-header-icon {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .chatai-header-icon svg {
    width: 18px;
    height: 18px;
    fill: #fff;
  }

  .chatai-header-info {
    flex: 1;
    min-width: 0;
  }

  .chatai-header-title {
    font-size: 15px;
    font-weight: 600;
    line-height: 1.3;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .chatai-header-subtitle {
    font-size: 12px;
    opacity: 0.8;
    line-height: 1.3;
  }

  .chatai-header-actions {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
  }

  .chatai-header-btn {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: none;
    background: transparent;
    color: rgba(255, 255, 255, 0.8);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background var(--widget-transition);
    padding: 0;
  }

  .chatai-header-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    color: #fff;
  }

  .chatai-header-btn svg {
    width: 18px;
    height: 18px;
    fill: currentColor;
  }

  .chatai-header-btn.is-active {
    background: rgba(255, 255, 255, 0.25);
    color: #fff;
  }

  /* === MESSAGES AREA === */
  .chatai-messages {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    scroll-behavior: smooth;
    background: var(--widget-bg);
  }

  .chatai-messages::-webkit-scrollbar {
    width: 6px;
  }

  .chatai-messages::-webkit-scrollbar-track {
    background: transparent;
  }

  .chatai-messages::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.15);
    border-radius: 3px;
  }

  .chatai-messages::-webkit-scrollbar-thumb:hover {
    background: rgba(0, 0, 0, 0.25);
  }

  /* === MESSAGE BUBBLES === */
  .chatai-message {
    max-width: 85%;
    padding: 10px 14px;
    border-radius: var(--widget-radius-sm);
    font-size: 14px;
    line-height: 1.5;
    word-wrap: break-word;
    animation: chatai-message-enter 0.25s ease-out both;
    position: relative;
  }

  .chatai-message + .chatai-message {
    margin-top: 2px;
  }

  @keyframes chatai-message-enter {
    0% { opacity: 0; transform: translateY(8px); }
    100% { opacity: 1; transform: translateY(0); }
  }

  .chatai-message--user {
    align-self: flex-end;
    background: var(--widget-user-bubble);
    color: var(--widget-user-text);
    border-bottom-right-radius: 4px;
  }

  .chatai-message--ai {
    align-self: flex-start;
    background: var(--widget-ai-bubble);
    color: var(--widget-ai-text);
    border-bottom-left-radius: 4px;
  }

  .chatai-message--error {
    align-self: center;
    background: #fff3f3;
    color: #dc3545;
    border: 1px solid #ffd7d7;
    font-size: 13px;
    max-width: 90%;
    text-align: center;
  }

  .chatai-message-time {
    font-size: 10px;
    opacity: 0.6;
    margin-top: 4px;
    text-align: right;
  }

  [dir="rtl"] .chatai-message-time {
    text-align: left;
  }

  /* === TYPING INDICATOR === */
  .chatai-typing {
    align-self: flex-start;
    background: var(--widget-ai-bubble);
    padding: 12px 18px;
    border-radius: var(--widget-radius-sm);
    border-bottom-left-radius: 4px;
    display: flex;
    gap: 4px;
    align-items: center;
  }

  .chatai-typing-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--widget-text-secondary);
    animation: chatai-typing-bounce 1.4s infinite ease-in-out both;
  }

  .chatai-typing-dot:nth-child(1) { animation-delay: 0s; }
  .chatai-typing-dot:nth-child(2) { animation-delay: 0.16s; }
  .chatai-typing-dot:nth-child(3) { animation-delay: 0.32s; }

  @keyframes chatai-typing-bounce {
    0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
    40% { transform: scale(1); opacity: 1; }
  }

  /* === INPUT AREA === */
  .chatai-input-area {
    padding: 12px 16px;
    border-top: 1px solid var(--widget-border);
    display: flex;
    gap: 8px;
    align-items: flex-end;
    background: var(--widget-bg);
    flex-shrink: 0;
  }

  .chatai-input {
    width: 100%;
    padding: 10px 14px;
    border: 1.5px solid var(--widget-input-border);
    border-radius: 24px;
    font-size: 14px;
    font-family: inherit;
    background: var(--widget-input-bg);
    color: var(--widget-text);
    outline: none;
    transition: border-color var(--widget-transition), box-shadow var(--widget-transition);
    resize: none;
    min-height: 40px;
    max-height: 120px;
    line-height: 1.4;
  }

  .chatai-input::placeholder {
    color: var(--widget-text-secondary);
    opacity: 0.7;
  }

  .chatai-input:focus {
    border-color: var(--widget-input-focus);
    box-shadow: 0 0 0 3px var(--widget-primary-light);
    background: var(--widget-bg);
  }

  .chatai-input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  [dir="rtl"] .chatai-input {
    text-align: right;
  }

  .chatai-send-btn {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: none;
    background: var(--widget-primary);
    color: #fff;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--widget-transition);
    flex-shrink: 0;
    padding: 0;
  }

  .chatai-send-btn:hover {
    background: var(--widget-primary-hover);
    transform: scale(1.05);
  }

  .chatai-send-btn:active {
    transform: scale(0.95);
  }

  .chatai-send-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }

  .chatai-send-btn svg {
    width: 18px;
    height: 18px;
    fill: currentColor;
  }

  /* === WELCOME MESSAGE === */
  .chatai-welcome {
    text-align: center;
    padding: 32px 20px 20px;
    color: var(--widget-text-secondary);
  }

  .chatai-welcome-icon {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: var(--widget-primary-light);
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 16px;
  }

  .chatai-welcome-icon svg {
    width: 28px;
    height: 28px;
    fill: var(--widget-primary);
  }

  .chatai-welcome-text {
    font-size: 14px;
    line-height: 1.6;
    color: var(--widget-text-secondary);
  }

  .chatai-welcome-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--widget-text);
    margin-bottom: 8px;
  }

  /* === LOADING SPINNER === */
  .chatai-spinner {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px;
  }

  .chatai-spinner-circle {
    width: 32px;
    height: 32px;
    border: 3px solid var(--widget-border);
    border-top-color: var(--widget-primary);
    border-radius: 50%;
    animation: chatai-spin 0.8s linear infinite;
  }

  @keyframes chatai-spin {
    to { transform: rotate(360deg); }
  }

  /* === ERROR STATE === */
  .chatai-error {
    text-align: center;
    padding: 32px 20px;
    color: var(--widget-text-secondary);
  }

  .chatai-error-icon {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: #fff3f3;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 12px;
  }

  .chatai-error-icon svg {
    width: 24px;
    height: 24px;
    fill: #dc3545;
  }

  .chatai-error-text {
    font-size: 14px;
    color: #dc3545;
    margin-bottom: 16px;
  }

  .chatai-error-retry {
    padding: 8px 20px;
    border-radius: 20px;
    border: 1.5px solid var(--widget-primary);
    background: transparent;
    color: var(--widget-primary);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all var(--widget-transition);
    font-family: inherit;
  }

  .chatai-error-retry:hover {
    background: var(--widget-primary);
    color: #fff;
  }

  /* === FOOTER === */
  .chatai-footer {
    text-align: center;
    padding: 8px 16px;
    font-size: 11px;
    color: var(--widget-text-secondary);
    border-top: 1px solid var(--widget-border);
    background: var(--widget-bg-secondary);
    flex-shrink: 0;
  }

  .chatai-footer a {
    color: var(--widget-primary);
    text-decoration: none;
    font-weight: 500;
  }

  .chatai-footer a:hover {
    text-decoration: underline;
  }

  /* === LEAD CAPTURE FORM === */
  .chatai-lead-form {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    padding: 24px 20px;
    background: var(--widget-bg);
    animation: chatai-fade-in 0.3s ease-out;
  }

  .chatai-lead-form-card {
    width: 100%;
    max-width: 320px;
    text-align: center;
  }

  .chatai-lead-form-icon {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: var(--widget-primary-light);
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 16px;
  }

  .chatai-lead-form-icon svg {
    width: 28px;
    height: 28px;
    fill: var(--widget-primary);
  }

  .chatai-lead-form h3 {
    font-size: 18px;
    font-weight: 600;
    color: var(--widget-text);
    margin-bottom: 4px;
  }

  .chatai-lead-form p {
    font-size: 13px;
    color: var(--widget-text-secondary);
    margin-bottom: 20px;
  }

  .chatai-lead-input {
    width: 100%;
    padding: 12px 14px;
    border: 1.5px solid var(--widget-input-border);
    border-radius: var(--widget-radius-sm);
    font-size: 14px;
    font-family: inherit;
    background: var(--widget-input-bg);
    color: var(--widget-text);
    outline: none;
    transition: border-color var(--widget-transition), box-shadow var(--widget-transition);
    margin-bottom: 10px;
  }

  .chatai-lead-input:focus {
    border-color: var(--widget-input-focus);
    box-shadow: 0 0 0 3px var(--widget-primary-light);
    background: var(--widget-bg);
  }

  .chatai-lead-input.is-error {
    border-color: #dc3545;
  }

  .chatai-lead-error {
    font-size: 11px;
    color: #dc3545;
    text-align: left;
    margin-top: -6px;
    margin-bottom: 10px;
    display: none;
  }

  .chatai-lead-error.is-visible {
    display: block;
  }

  .chatai-lead-submit {
    width: 100%;
    padding: 12px;
    border: none;
    border-radius: var(--widget-radius-sm);
    background: var(--widget-primary);
    color: #fff;
    font-size: 15px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition: background var(--widget-transition), transform var(--widget-transition);
    margin-top: 4px;
  }

  .chatai-lead-submit:hover {
    background: var(--widget-primary-hover);
    transform: translateY(-1px);
  }

  .chatai-lead-submit:active {
    transform: translateY(0);
  }

  .chatai-lead-submit:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  /* === HANDOFF BANNER === */
  .chatai-handoff-banner {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    margin: 0 16px 8px;
    background: #e8f5e9;
    border-radius: var(--widget-radius-sm);
    font-size: 13px;
    color: #2e7d32;
    animation: chatai-fade-in 0.3s ease-out;
    flex-shrink: 0;
  }

  .chatai-handoff-banner svg {
    width: 18px;
    height: 18px;
    fill: #2e7d32;
    flex-shrink: 0;
  }

  :host(.chatai-theme-dark) .chatai-handoff-banner {
    background: rgba(46, 125, 50, 0.2);
    color: #81c784;
  }

  :host(.chatai-theme-dark) .chatai-handoff-banner svg {
    fill: #81c784;
  }

  /* === PRODUCT CAROUSEL === */
  .chatai-carousel {
    position: relative;
    margin: 4px 0;
    max-width: 100%;
    animation: chatai-fade-in 0.3s ease-out;
  }

  .chatai-carousel-track {
    display: flex;
    gap: 10px;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    scroll-behavior: smooth;
    padding: 4px 0 8px;
    -webkit-overflow-scrolling: touch;
  }

  .chatai-carousel-track::-webkit-scrollbar {
    height: 4px;
  }

  .chatai-carousel-track::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.15);
    border-radius: 2px;
  }

  .chatai-carousel-card {
    flex: 0 0 160px;
    scroll-snap-align: start;
    border-radius: var(--widget-radius-sm);
    border: 1px solid var(--widget-border);
    background: var(--widget-bg);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    overflow: hidden;
    transition: box-shadow var(--widget-transition), transform var(--widget-transition);
  }

  .chatai-carousel-card:hover {
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
    transform: translateY(-2px);
  }

  .chatai-carousel-card img {
    width: 100%;
    height: 120px;
    object-fit: cover;
    display: block;
  }

  .chatai-carousel-card-body {
    padding: 10px 12px 12px;
  }

  .chatai-carousel-card-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--widget-text);
    line-height: 1.3;
    margin-bottom: 4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .chatai-carousel-card-desc {
    font-size: 11px;
    color: var(--widget-text-secondary);
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    margin-bottom: 8px;
  }

  .chatai-carousel-card-btn {
    display: inline-block;
    padding: 5px 14px;
    border-radius: 16px;
    background: var(--widget-primary);
    color: #fff;
    font-size: 12px;
    font-weight: 500;
    text-decoration: none;
    border: none;
    cursor: pointer;
    font-family: inherit;
    transition: background var(--widget-transition);
  }

  .chatai-carousel-card-btn:hover {
    background: var(--widget-primary-hover);
  }

  .chatai-carousel-arrow {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: none;
    background: var(--widget-bg);
    color: var(--widget-text);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1;
    opacity: 0;
    transition: opacity var(--widget-transition);
    font-size: 16px;
    line-height: 1;
  }

  .chatai-carousel-arrow.is-visible {
    opacity: 1;
  }

  .chatai-carousel-arrow:hover {
    background: var(--widget-bg-secondary);
  }

  .chatai-carousel-arrow--left {
    left: -6px;
  }

  .chatai-carousel-arrow--right {
    right: -6px;
  }

  @media (hover: none) {
    .chatai-carousel-arrow {
      display: none;
    }
  }

  /* === SEARCH RESULTS === */
  .chatai-search-result {
    padding: 12px 14px;
    border-radius: var(--widget-radius-sm);
    border: 1px solid var(--widget-border);
    background: var(--widget-bg);
    cursor: pointer;
    transition: border-color var(--widget-transition), box-shadow var(--widget-transition);
    animation: chatai-fade-in 0.25s ease-out both;
    margin-bottom: 4px;
  }

  .chatai-search-result:hover {
    border-color: var(--widget-primary);
    box-shadow: 0 0 0 2px var(--widget-primary-light);
  }

  .chatai-search-result-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--widget-text);
    margin-bottom: 3px;
    line-height: 1.3;
  }

  .chatai-search-result-excerpt {
    font-size: 12px;
    color: var(--widget-text-secondary);
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .chatai-search-prompt {
    font-size: 12px;
    color: var(--widget-text-secondary);
    text-align: center;
    padding: 16px;
    font-style: italic;
  }

  .chatai-search-empty {
    font-size: 13px;
    color: var(--widget-text-secondary);
    text-align: center;
    padding: 24px 16px;
  }

  /* === SEARCH INPUT === */
  .chatai-search-input-area {
    padding: 12px 16px;
    border-top: 1px solid var(--widget-border);
    display: flex;
    gap: 8px;
    align-items: center;
    background: var(--widget-bg);
    flex-shrink: 0;
    animation: chatai-fade-in 0.2s ease-out;
  }

  .chatai-search-input {
    flex: 1;
    padding: 10px 14px;
    border: 1.5px solid var(--widget-input-border);
    border-radius: 24px;
    font-size: 14px;
    font-family: inherit;
    background: var(--widget-input-bg);
    color: var(--widget-text);
    outline: none;
    transition: border-color var(--widget-transition), box-shadow var(--widget-transition);
    line-height: 1.4;
  }

  .chatai-search-input::placeholder {
    color: var(--widget-text-secondary);
    opacity: 0.7;
  }

  .chatai-search-input:focus {
    border-color: var(--widget-input-focus);
    box-shadow: 0 0 0 3px var(--widget-primary-light);
    background: var(--widget-bg);
  }

  .chatai-search-close-btn {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: none;
    background: transparent;
    color: var(--widget-text-secondary);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background var(--widget-transition), color var(--widget-transition);
    flex-shrink: 0;
    padding: 0;
  }

  .chatai-search-close-btn:hover {
    background: var(--widget-bg-secondary);
    color: var(--widget-text);
  }

  .chatai-search-close-btn svg {
    width: 18px;
    height: 18px;
    fill: currentColor;
  }

  /* === KEYFRAMES === */
  @keyframes chatai-fade-in {
    0% { opacity: 0; }
    100% { opacity: 1; }
  }

  /* === RESPONSIVE === */
  @media (max-width: 480px) {
    .chatai-window {
      position: fixed;
      bottom: 0;
      right: 0;
      left: 0;
      width: 100%;
      max-height: 100vh;
      height: 100vh;
      border-radius: 0;
      box-shadow: none;
    }

    .chatai-bubble {
      bottom: 16px;
      right: 16px;
      width: 54px;
      height: 54px;
    }

    :host(.position-bottom-left) .chatai-bubble {
      right: auto;
      left: 16px;
    }

    :host(.position-bottom-left) .chatai-window {
      right: 0;
      left: 0;
    }
  }

  @media (max-width: 480px) and (min-height: 800px) {
    .chatai-window {
      border-radius: var(--widget-radius) var(--widget-radius) 0 0;
    }
  }

  /* === DARK THEME === */
  :host(.chatai-theme-dark) {
    --widget-bg: #1a1a2e;
    --widget-bg-secondary: #16213e;
    --widget-text: #e8e8e8;
    --widget-text-secondary: #a0a0b0;
    --widget-ai-bubble: #2a2a3e;
    --widget-ai-text: #e8e8e8;
    --widget-input-bg: #2a2a3e;
    --widget-input-border: #3a3a4e;
    --widget-border: #2a2a3e;
    --widget-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  }

  :host(.chatai-theme-dark) .chatai-message--error {
    background: rgba(220, 53, 69, 0.15);
    border-color: rgba(220, 53, 69, 0.3);
  }

  :host(.chatai-theme-dark) .chatai-error-icon {
    background: rgba(220, 53, 69, 0.15);
  }

  :host(.chatai-theme-dark) .chatai-messages::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.15);
  }

  :host(.chatai-theme-dark) .chatai-messages::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.25);
  }
`;
