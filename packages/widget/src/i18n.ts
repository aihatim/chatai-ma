export type Language = 'en' | 'fr' | 'ar' | 'es';

export interface Translations {
  welcome: string;
  placeholder: string;
  send: string;
  typing: string;
  errorMessage: string;
  retry: string;
  close: string;
  poweredBy: string;
  minimize: string;
  newConversation: string;
  messageNotSent: string;
  resend: string;
  leadName: string;
  leadEmail: string;
  leadPhone: string;
  leadSubmit: string;
  leadRequired: string;
  searchPlaceholder: string;
  handoffConnected: string;
  view: string;
  search: string;
}

const translations: Record<Language, Translations> = {
  en: {
    welcome: 'Hi! How can I help you?',
    placeholder: 'Type a message...',
    send: 'Send',
    typing: 'Typing...',
    errorMessage: 'Something went wrong. Please try again.',
    retry: 'Retry',
    close: 'Close',
    poweredBy: 'Powered by ChatAi.ma',
    minimize: 'Minimize',
    newConversation: 'New conversation',
    messageNotSent: 'Message not sent',
    resend: 'Resend',
    leadName: 'Name',
    leadEmail: 'Email',
    leadPhone: 'Phone (optional)',
    leadSubmit: 'Start Chat',
    leadRequired: 'Required',
    searchPlaceholder: 'Search knowledge base...',
    handoffConnected: 'Connected to a human agent',
    view: 'View',
    search: 'Search',
  },
  fr: {
    welcome: 'Bonjour ! Comment puis-je vous aider ?',
    placeholder: 'Écrivez un message...',
    send: 'Envoyer',
    typing: 'Écrit...',
    errorMessage: 'Une erreur est survenue. Veuillez réessayer.',
    retry: 'Réessayer',
    close: 'Fermer',
    poweredBy: 'Propulsé par ChatAi.ma',
    minimize: 'Réduire',
    newConversation: 'Nouvelle conversation',
    messageNotSent: 'Message non envoyé',
    resend: 'Renvoyer',
    leadName: 'Nom',
    leadEmail: 'Email',
    leadPhone: 'Téléphone (optionnel)',
    leadSubmit: 'Commencer',
    leadRequired: 'Requis',
    searchPlaceholder: 'Rechercher...',
    handoffConnected: 'Connecté à un agent humain',
    view: 'Voir',
    search: 'Rechercher',
  },
  ar: {
    welcome: 'مرحبًا! كيف يمكنني مساعدتك؟',
    placeholder: 'اكتب رسالة...',
    send: 'إرسال',
    typing: 'يكتب...',
    errorMessage: 'حدث خطأ ما. حاول مرة أخرى.',
    retry: 'إعادة المحاولة',
    close: 'إغلاق',
    poweredBy: 'مدعوم من ChatAi.ma',
    minimize: 'تصغير',
    newConversation: 'محادثة جديدة',
    messageNotSent: 'لم يتم إرسال الرسالة',
    resend: 'إعادة إرسال',
    leadName: 'الاسم',
    leadEmail: 'البريد الإلكتروني',
    leadPhone: 'الهاتف (اختياري)',
    leadSubmit: 'بدء المحادثة',
    leadRequired: 'مطلوب',
    searchPlaceholder: 'ابحث في قاعدة المعرفة...',
    handoffConnected: 'متصل بوكيل بشري',
    view: 'عرض',
    search: 'بحث',
  },
  es: {
    welcome: '¡Hola! ¿Cómo puedo ayudarte?',
    placeholder: 'Escribe un mensaje...',
    send: 'Enviar',
    typing: 'Escribiendo...',
    errorMessage: 'Algo salió mal. Inténtalo de nuevo.',
    retry: 'Reintentar',
    close: 'Cerrar',
    poweredBy: 'Desarrollado por ChatAi.ma',
    minimize: 'Minimizar',
    newConversation: 'Nueva conversación',
    messageNotSent: 'Mensaje no enviado',
    resend: 'Reenviar',
    leadName: 'Nombre',
    leadEmail: 'Correo electrónico',
    leadPhone: 'Teléfono (opcional)',
    leadSubmit: 'Iniciar chat',
    leadRequired: 'Requerido',
    searchPlaceholder: 'Buscar en la base de conocimiento...',
    handoffConnected: 'Conectado con un agente humano',
    view: 'Ver',
    search: 'Buscar',
  },
};

export function getTranslation(lang: Language, key: keyof Translations): string {
  return translations[lang]?.[key] ?? translations['en'][key];
}

export function isRTL(lang: Language): boolean {
  return lang === 'ar';
}
