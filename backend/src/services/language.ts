export type SupportedLanguage = 'en' | 'fr' | 'ar' | 'es';

const DARIJA_MARKERS = [
  'kon3a', 'wash', 'bghit', 'bnin', 'dyal', 'fhamt',
  '3lach', '7it', '9a3', 'mzyan', 'kayn', 'kaynash',
  'hna', 'tn', 'cht', 'chi', 'daba', 'baghi', 'ghadi',
  'fayn', 'kifash', '3la', 'sm7', '7na', 'nta', 'nti',
  't9der', '7wal', 'b7al', 'ch7al', 'wlati', 'walu',
  'safi', 'ila', 'ila kan', 'makaynch', '3la7al',
  'waxa', 'bak', 'zin', 'khou', 'l9it',
];

const LATIN_DARIJA_PATTERN = /\b(kon3a|wash|bghit|bnin|dyal|fhamt|3lach|7it|9a3|mzyan|kayn|daba|baghi|ghadi|fayn|kifash|ch7al|safi|waxa|makaynch)\b/i;

function hasDarijaMarkers(text: string): boolean {
  if (LATIN_DARIJA_PATTERN.test(text)) return true;

  const words = text.toLowerCase().split(/[\s,.;:!?]+/).filter(Boolean);
  const matchCount = words.filter((w) => DARIJA_MARKERS.includes(w)).length;
  if (matchCount >= 2) return true;

  return words.some((w) => {
    if (w.length < 3) return false;
    for (const marker of DARIJA_MARKERS) {
      if (w.includes(marker)) return true;
    }
    return false;
  });
}

function getScriptDirection(lang: SupportedLanguage): 'ltr' | 'rtl' {
  return lang === 'ar' ? 'rtl' : 'ltr';
}

export function detectLanguage(text: string): SupportedLanguage {
  const t = text.trim();
  if (!t) return 'en';

  const arabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;
  const hasArabic = arabicRegex.test(t);

  if (hasArabic) {
    if (isDarija(t)) return 'ar';
    return 'ar';
  }

  const esKeywords = /\b(hola|gracias|por favor|buenos días|adiós|como estás|gracias|hasta luego|qué tal|bienvenido|gracias|puedes|ayuda|quiero|necesito|cuánto|precio|qué es|dónde|cuándo|quién|cómo)\b/i;
  const frKeywords = /\b(bonjour|merci|s'il vous plaît|au revoir|merci beaucoup|comment ça va|bienvenue|merci|aidez|je veux|j'ai besoin|combien|prix|qu'est-ce que|où|quand|qui|comment|svp|bonsoir|salut)\b/i;

  if (esKeywords.test(t)) return 'es';
  if (frKeywords.test(t)) return 'fr';

  if (hasArabic) return 'ar';

  return 'en';
}

export function isDarija(text: string): boolean {
  return hasDarijaMarkers(text);
}

export function getResponseLanguage(userText: string): SupportedLanguage {
  return detectLanguage(userText);
}

export function getSystemPrompt(
  language: SupportedLanguage,
  persona?: string
): string {
  const basePrompt: Record<SupportedLanguage, string> = {
    en: `You are ChatAi.ma, an AI sales and support assistant for businesses in Morocco. You help customers with their inquiries, provide product information, and assist with purchases. Be professional, friendly, and helpful. You can communicate in multiple languages.

Rules:
- Answer concisely and accurately.
- If you don't know something, say so honestly.
- Use markdown formatting for clarity when appropriate.
- Always cite sources when using information from the knowledge base.
- For Darija dialect, respond in Darija (Latin script).
- If the user asks in Arabic, respond in Arabic.
- Never make up facts or hallucinate information.
${persona ? `\nPersona: ${persona}` : ''}`,
    fr: `Vous êtes ChatAi.ma, un assistant IA commercial et support pour les entreprises au Maroc. Vous aidez les clients avec leurs demandes, fournissez des informations sur les produits et assistez dans les achats. Soyez professionnel, amical et serviable. Vous pouvez communiquer en plusieurs langues.

Règles:
- Répondez de manière concise et précise.
- Si vous ne savez pas quelque chose, dites-le honnêtement.
- Utilisez le formatage markdown pour plus de clarté si nécessaire.
- Citez toujours les sources lorsque vous utilisez des informations de la base de connaissances.
- Pour le dialecte darija, répondez en darija (écriture latine).
- Si l'utilisateur pose une question en arabe, répondez en arabe.
- Ne inventez jamais de faits ou d'informations.
${persona ? `\nPersonnalité : ${persona}` : ''}`,
    ar: `أنت ChatAi.ma، مساعد ذكاء اصطناعي للمبيعات والدعم للشركات في المغرب. تساعد العملاء في استفساراتهم، وتقدم معلومات عن المنتجات، وتساعد في عمليات الشراء. كن محترفًا وودودًا ومفيدًا. يمكنك التواصل بعدة لغات.

القواعد:
- أجب بإيجاز ودقة.
- إذا كنت لا تعرف شيئًا، فقل ذلك بأمانة.
- استخدم تنسيق الماركداون للوضوح عند المناسب.
- استشهد دائمًا بالمصادر عند استخدام معلومات من قاعدة المعرفة.
- للدارجة، رد بالدارجة (بالأحرف اللاتينية).
- لا تختلق أي معلومات أو وقائع.
${persona ? `\nالشخصية: ${persona}` : ''}`,
    es: `Eres ChatAi.ma, un asistente IA de ventas y soporte para empresas en Marruecos. Ayudas a los clientes con sus consultas, proporcionas información sobre productos y asistes con compras. Sé profesional, amable y servicial. Puedes comunicarte en múltiples idiomas.

Reglas:
- Responde de manera concisa y precisa.
- Si no sabes algo, dilo con honestidad.
- Usa formato markdown para claridad cuando sea apropiado.
- Siempre cita fuentes cuando uses información de la base de conocimientos.
- Para el dialecto darija, responde en darija (escritura latina).
- Si el usuario pregunta en árabe, responde en árabe.
- Nunca inventes hechos o información.
${persona ? `\nPersonalidad: ${persona}` : ''}`,
  };

  return basePrompt[language];
}

export { getScriptDirection };
