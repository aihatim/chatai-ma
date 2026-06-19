export interface WidgetConfig {
  token: string;
  apiUrl: string;
  position: 'bottom-right' | 'bottom-left';
  primaryColor: string;
  accentColor: string;
  icon: 'default' | 'chat' | 'bot';
  welcomeMessage: string;
  placeholderText: string;
  language: 'en' | 'fr' | 'ar' | 'es';
  chameleonMode: boolean;
  theme: 'light' | 'dark';
  popupDelay: number;
  popupExitIntent: boolean;
  popupScroll: number;
  popupUrlRules: string[];
  leadCapture: boolean;
  humanHandoff: boolean;
}

export const defaultConfig: WidgetConfig = {
  token: '',
  apiUrl: '',
  position: 'bottom-right',
  primaryColor: '#B8860B',
  accentColor: '#1a1a2e',
  icon: 'default',
  welcomeMessage: 'Hi! How can I help you?',
  placeholderText: 'Type a message...',
  language: 'en',
  chameleonMode: true,
  theme: 'light',
  popupDelay: 30,
  popupExitIntent: false,
  popupScroll: 50,
  popupUrlRules: [],
  leadCapture: false,
  humanHandoff: false,
};
