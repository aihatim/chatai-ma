import { PrismaClient, Plan, Language, Language as Lang } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding ChatAi.ma database...');

  // ── 1. Default Roles ──────────────────────────────────────────────────────
  await prisma.persona.createMany({
    skipDuplicates: true,
    data: [
      { name: 'Organization Owner', description: 'Full access to everything', systemPrompt: 'You have full ownership and administrative control over the organization.', isBuiltin: true },
      { name: 'Workspace Admin', description: 'Administers workspace settings and members', systemPrompt: 'You manage workspace configurations, team members, and channel integrations.', isBuiltin: true },
      { name: 'Website Editor', description: 'Manages website widget', systemPrompt: 'You configure and maintain the website chat widget, including appearance and behavior.', isBuiltin: true },
      { name: 'WhatsApp Agent', description: 'Handles WhatsApp conversations', systemPrompt: 'You handle incoming WhatsApp conversations and respond to customer inquiries.', isBuiltin: true },
      { name: 'Sales Manager', description: 'Manages prospecting campaigns', systemPrompt: 'You create and manage prospecting campaigns, lead scoring, and team assignments.', isBuiltin: true },
      { name: 'Sales Rep', description: 'Handles assigned leads', systemPrompt: 'You handle assigned leads and work through the prospecting pipeline using BANT qualification.', isBuiltin: true },
      { name: 'Analyst', description: 'Views analytics and reports', systemPrompt: 'You have read-only access to analytics dashboards and reports across all channels.', isBuiltin: true },
      { name: 'API Consumer', description: 'API-only access', systemPrompt: 'You access the platform exclusively via API with limited scope.', isBuiltin: true },
    ],
  });

  // ── 2. Built-in Objection Handler Templates (20+, 4 languages) ────────────
  const objections = [
    { category: 'Price', pattern: 'It\'s too expensive', responses: { en: 'I understand budget is important. Let me show you how our pricing delivers 3x ROI within the first 90 days.', fr: 'Je comprends que le budget est important. Laissez-moi vous montrer comment notre tarification offre un ROI 3x en 90 jours.', ar: 'أتفهم أن الميزانية مهمة. دعني أريك كيف يحقق تسعيرنا عائد استثمار ثلاثي خلال 90 يومًا.', es: 'Entiendo que el presupuesto es importante. Déjame mostrarte cómo nuestro precio ofrece un ROI 3x en los primeros 90 días.' }, isBuiltin: true },
    { category: 'Price', pattern: 'We don\'t have budget right now', responses: { en: 'No problem at all. Many of our clients felt the same way until they saw the potential revenue increase. Could we explore a quick ROI projection?', fr: 'Pas de problème. Beaucoup de nos clients pensaient la même chose jusqu\'à ce qu\'ils voient l\'augmentation potentielle des revenus. Pourrions-nous explorer une projection rapide du ROI?', ar: 'لا مشكلة على الإطلاق.许多 من عملائنا شعروا بنفس الشيء حتى رأوا الزيادة المحتملة في الإيرادات. هل يمكننا استكشاف توقعات سريعة لعائد الاستثمار؟', es: 'No hay problema. Muchos de nuestros clientes pensaron lo mismo hasta que vieron el aumento potencial de ingresos. ¿Podemos explorar una proyección rápida de ROI?' }, isBuiltin: true },
    { category: 'Price', pattern: 'We can get a cheaper solution elsewhere', responses: { en: 'You\'re right that there are cheaper options, but most don\'t offer our unified multi-channel approach with built-in AI. The cost savings from managing one platform instead of three more than covers the difference.', fr: 'Vous avez raison, il existe des options moins chères, mais la plupart n\'offrent pas notre approche multicanal unifiée avec IA intégrée. Les économies réalisées en gérant une plateforme au lieu de trois couvrent largement la différence.', ar: 'أنت محق في وجود خيارات أرخص، لكن معظمها لا يقدم نهجنا الموحد متعدد القنوات مع الذكاء الاصطناعي المدمج. التوفير من إدارة منصة واحدة بدلاً من ثلاث يغطي الفرق.', es: 'Tiene razón, hay opciones más baratas, pero la mayoría no ofrece nuestro enfoque unificado multicanal con IA integrada. El ahorro de gestionar una plataforma en lugar de tres cubre la diferencia.' }, isBuiltin: true },
    { category: 'Timing', pattern: 'Now is not the right time', responses: { en: 'I completely understand. What if we scheduled a brief 15-minute call next month to revisit? In the meantime, I can send you our case studies.', fr: 'Je comprends parfaitement. Et si nous planifions un bref appel de 15 minutes le mois prochain pour en reparler? En attendant, je peux vous envoyer nos études de cas.', ar: 'أتفهم تمامًا. ماذا لو حددنا موعدًا لمكالمة قصيرة مدتها 15 دقيقة الشهر المقبل لمراجعة الأمر؟ في هذه الأثناء، يمكنني إرسال دراسات الحالة الخاصة بنا.', es: 'Lo entiendo perfectamente. ¿Qué tal si programamos una breve llamada de 15 minutos el próximo mes para retomarlo? Mientras tanto, puedo enviarle nuestros casos de éxito.' }, isBuiltin: true },
    { category: 'Timing', pattern: 'We are in the middle of a migration', responses: { en: 'That\'s a critical time. Our solution could actually simplify your stack rather than complicate it. Would you be open to a no-obligation architecture review after your migration?', fr: 'C\'est une période critique. Notre solution pourrait en fait simplifier votre pile technologique plutôt que la complexifier. Seriez-vous ouvert à un examen d\'architecture sans engagement après votre migration?', ar: 'هذا وقت حاسم. حلنا يمكنه في الواقع تبسيط مجموعتك التكنولوجية بدلاً من تعقيدها. هل ستكون منفتحًا لمراجعة معمارية بدون التزام بعد الترحيل؟', es: 'Es un momento crítico. Nuestra solución podría simplificar su stack tecnológico en lugar de complicarlo. ¿Estaría abierto a una revisión de arquitectura sin compromiso después de su migración?' }, isBuiltin: true },
    { category: 'Timing', pattern: 'We need to check with our board first', responses: { en: 'Of course, board approval is important. Would it help if we prepared a personalized board deck with ROI projections, implementation timeline, and competitive analysis?', fr: 'Bien sûr, l\'approbation du conseil est importante. Serait-il utile que nous préparions un dossier personnalisé avec des projections ROI, un calendrier de mise en œuvre et une analyse concurrentielle?', ar: 'بالطبع، موافقة مجلس الإدارة مهمة. هل سيساعد إذا أعددنا عرضًا تقديميًا مخصصًا لمجلس الإدارة مع توقعات عائد الاستثمار وجدول زمني للتنفيذ وتحليل تنافسي؟', es: 'Por supuesto, la aprobación del consejo es importante. ¿Le ayudaría si preparamos una presentación personalizada para el consejo con proyecciones de ROI, cronograma de implementación y análisis competitivo?' }, isBuiltin: true },
    { category: 'Competition', pattern: 'We are already using a competitor', responses: { en: 'That\'s good to know. What do you like most about your current solution? Many teams that switch to us do so because they want a unified brain across all channels rather than separate tools.', fr: 'C\'est bon à savoir. Qu\'est-ce que vous appréciez le plus dans votre solution actuelle? Beaucoup d\'équipes qui nous rejoignent le font parce qu\'elles veulent un cerveau unifié sur tous les canaux plutôt que des outils séparés.', ar: 'من الجيد معرفة ذلك. ما أكثر ما يعجبك في حلك الحالي؟许多 الفرق التي تنتقل إلينا تفعل ذلك لأنها تريد دماغًا موحدًا عبر جميع القنوات بدلاً من أدوات منفصلة.', es: 'Es bueno saberlo. ¿Qué es lo que más le gusta de su solución actual? Muchos equipos que se cambian a nosotros lo hacen porque quieren un cerebro unificado en todos los canales en lugar de herramientas separadas.' }, isBuiltin: true },
    { category: 'Competition', pattern: 'What makes you different from X?', responses: { en: 'Great question! Unlike X, we offer a truly unified AI brain across website, WhatsApp, and prospecting in one platform. You also get built-in Darija support, Moroccan compliance (Law 09-08), and local hosting options.', fr: 'Excellente question! Contrairement à X, nous offrons un véritable cerveau IA unifié sur le site web, WhatsApp et le prospection en une seule plateforme. Vous bénéficiez également du support Darija intégré, de la conformité marocaine (Loi 09-08) et d\'options d\'hébergement local.', ar: 'سؤال ممتاز! على عكس X، نحن نقدم دماغ ذكاء اصطناعي موحد حقًا عبر الموقع الإلكتروني وواتساب والتسويق في منصة واحدة. كما تحصل على دعم مدمج للدارجة والامتثال المغربي (القانون 09-08) وخيارات استضافة محلية.', es: '¡Excelente pregunta! A diferencia de X, ofrecemos un cerebro de IA verdaderamente unificado en sitio web, WhatsApp y prospección en una sola plataforma. También obtiene soporte integrado para Darija, cumplimiento marroquí (Ley 09-08) y opciones de alojamiento local.' }, isBuiltin: true },
    { category: 'NotInterested', pattern: 'Not interested', responses: { en: 'I appreciate your honesty. Would it be okay if I check back in a few months? Our platform evolves rapidly and we might have something that fits your needs better in the future.', fr: 'J\'apprécie votre honnêteté. Puis-je revenir vers vous dans quelques mois? Notre plateforme évolue rapidement et nous pourrions avoir quelque chose qui correspond mieux à vos besoins à l\'avenir.', ar: 'أقدر صراحتك. هل يمكنني التواصل مرة أخرى بعد بضعة أشهر؟ منصتنا تتطور بسرعة وقد يكون لدينا ما يناسب احتياجاتك بشكل أفضل في المستقبل.', es: 'Aprecio su honestidad. ¿Le parece si vuelvo a contactar en unos meses? Nuestra plataforma evoluciona rápidamente y podríamos tener algo que se adapte mejor a sus necesidades en el futuro.' }, isBuiltin: true },
    { category: 'NotInterested', pattern: 'Stop contacting us', responses: { en: 'Understood. I have noted your request and will ensure you are removed from our contact list immediately. You can also unsubscribe at any time via the link in our messages.', fr: 'Compris. J\'ai noté votre demande et je veillerai à ce que vous soyez retiré de notre liste de contact immédiatement. Vous pouvez également vous désabonner à tout moment via le lien dans nos messages.', ar: 'تم الفهم. لقد سجلت طلبك وسأضمن إزالتك من قائمة الاتصال لدينا فورًا. يمكنك أيضًا إلغاء الاشتراك في أي وقت عبر الرابط الموجود في رسائلنا.', es: 'Entendido. He tomado nota de su solicitud y me aseguraré de que sea eliminado de nuestra lista de contacto de inmediato. También puede darse de baja en cualquier momento a través del enlace en nuestros mensajes.' }, isBuiltin: true },
    { category: 'NeedApproval', pattern: 'I need to speak with my manager', responses: { en: 'Absolutely, that makes sense. Would it help if I joined a call with both of you to answer any technical questions? I can also prepare a summary of key benefits for your manager.', fr: 'Absolument, c\'est compréhensible. Serait-il utile que je participe à un appel avec vous deux pour répondre aux questions techniques? Je peux aussi préparer un résumé des avantages clés pour votre responsable.', ar: 'بالتأكيد، هذا منطقي. هل سيساعد إذا انضممت إلى مكالمة معكما للإجابة على أي أسئلة تقنية؟ يمكنني أيضًا إعداد ملخص للفوائد الرئيسية لمديرك.', es: 'Absolutamente, tiene sentido. ¿Le ayudaría si me uno a una llamada con ambos para responder preguntas técnicas? También puedo preparar un resumen de los beneficios clave para su gerente.' }, isBuiltin: true },
    { category: 'NeedApproval', pattern: 'We need to get sign-off from IT', responses: { en: 'Great, IT sign-off is important for security. We have a detailed security whitepaper, SOC 2 report, and data processing agreement ready. Would you like me to send those over for your IT team?', fr: 'Super, l\'approbation IT est importante pour la sécurité. Nous avons un livre blanc de sécurité détaillé, un rapport SOC 2 et un accord de traitement des données prêts. Souhaitez-vous que je les envoie à votre équipe IT?', ar: 'ممتاز، موافقة تكنولوجيا المعلومات مهمة للأمان. لدينا ورقة بيضاء مفصلة عن الأمان وتقرير SOC 2 واتفاقية معالجة بيانات جاهزة. هل تريد مني إرسالها لفريق تكنولوجيا المعلومات لديك؟', es: 'Genial, la aprobación de TI es importante para la seguridad. Tenemos un documento técnico de seguridad detallado, un informe SOC 2 y un acuerdo de procesamiento de datos listos. ¿Quiere que los envíe a su equipo de TI?' }, isBuiltin: true },
    { category: 'AlreadyHaveSolution', pattern: 'We already have a chatbot', responses: { en: 'That\'s great! Many teams use our platform alongside their existing chatbot for prospecting and WhatsApp. Our unique value is unifying all three channels under one AI brain. Could I show you how it works?', fr: 'C\'est génial! Beaucoup d\'équipes utilisent notre plateforme en complément de leur chatbot existant pour la prospection et WhatsApp. Notre valeur unique est d\'unifier les trois canaux sous un seul cerveau IA. Puis-je vous montrer comment ça fonctionne?', ar: 'هذا رائع!许多 الفرق تستخدم منصتنا جنبًا إلى جنب مع chatbot الحالي للتسويق وواتساب. قيمتنا الفريدة هي توحيد القنوات الثلاث تحت دماغ ذكاء اصطناعي واحد. هل يمكنني أن أريك كيف يعمل؟', es: '¡Genial! Muchos equipos usan nuestra plataforma junto con su chatbot existente para prospección y WhatsApp. Nuestro valor único es unificar los tres canales bajo un solo cerebro de IA. ¿Puedo mostrarle cómo funciona?' }, isBuiltin: true },
    { category: 'AlreadyHaveSolution', pattern: 'Our CRM already does this', responses: { en: 'CRMs are great for managing contacts, but they typically don\'t have an AI engine that converses with leads across multiple channels autonomously. Our platform complements your CRM by handling the conversation layer.', fr: 'Les CRM sont excellents pour gérer les contacts, mais ils n\'ont généralement pas de moteur d\'IA qui converse avec les leads sur plusieurs canaux de manière autonome. Notre plateforme complète votre CRM en gérant la couche de conversation.', ar: 'أنظمة CRM رائعة لإدارة جهات الاتصال، لكنها عادةً لا تحتوي على محرك ذكاء اصطناعي يتحدث مع العملاء المحتملين عبر قنوات متعددة بشكل مستقل. منصتنا تكمل نظام CRM الخاص بك من خلال إدارة طبقة المحادثة.', es: 'Los CRM son excelentes para gestionar contactos, pero normalmente no tienen un motor de IA que converse con leads a través de múltiples canales de forma autónoma. Nuestra plataforma complementa su CRM manejando la capa de conversación.' }, isBuiltin: true },
    { category: 'Other', pattern: 'We are not ready for AI', responses: { en: 'That\'s a common concern. Our platform is designed to be progressively adopted — start with just the website chat and expand when you\'re comfortable. The AI gets smarter the more you use it.', fr: 'C\'est une préoccupation courante. Notre plateforme est conçue pour une adoption progressive — commencez simplement par le chat du site web et développez quand vous êtes à l\'aise. L\'IA devient plus intelligente plus vous l\'utilisez.', ar: 'هذا قلق شائع. منصتنا مصممة للتبني التدريجي - ابدأ فقط بمحادثة الموقع الإلكتروني وتوسع عندما تكون مرتاحًا. الذكاء الاصطناعي يصبح أكثر ذكاءً كلما استخدمته أكثر.', es: 'Es una preocupación común. Nuestra plataforma está diseñada para una adopción progresiva: comience solo con el chat del sitio web y expanda cuando se sienta cómodo. La IA se vuelve más inteligente cuanto más la usa.' }, isBuiltin: true },
    { category: 'Other', pattern: 'Send me more information first', responses: { en: 'Absolutely! I\'ll send you our product overview, a few relevant case studies, and a link to book a personalized demo at your convenience. What\'s the best email to send these to?', fr: 'Absolument! Je vais vous envoyer notre aperçu du produit, quelques études de cas pertinentes et un lien pour réserver une démo personnalisée à votre convenance. Quelle est la meilleure adresse email pour vous envoyer ces informations?', ar: 'بالتأكيد! سأرسل لك نظرة عامة على منتجنا وبعض دراسات الحالة ذات الصلة ورابطًا لحجز عرض توضيحي مخصص في الوقت المناسب لك. ما هو أفضل بريد إلكتروني لإرسال هذه المعلومات إليه؟', es: '¡Absolutamente! Le enviaré nuestra descripción general del producto, algunos casos de estudio relevantes y un enlace para reservar una demostración personalizada cuando le convenga. ¿Cuál es el mejor correo electrónico para enviarle esto?' }, isBuiltin: true },
    { category: 'Other', pattern: 'We are a small business', responses: { en: 'Our Starter plan is perfect for small businesses at just $49/month. You get a website widget, 500 WhatsApp conversations, and 200 prospecting leads — all powered by the same AI brain.', fr: 'Notre formule Starter est parfaite pour les petites entreprises à seulement 49$/mois. Vous obtenez un widget de site web, 500 conversations WhatsApp et 200 leads de prospection — le tout alimenté par le même cerveau IA.', ar: 'خطة المبتدئين مثالية للشركات الصغيرة بسعر 49 دولارًا فقط شهريًا. تحصل على أداة وموقع إلكتروني و500 محادثة واتساب و200 عميل محتمل للتسويق - جميعها مدعومة بنفس دماغ الذكاء الاصطناعي.', es: 'Nuestro plan Starter es perfecto para pequeñas empresas por solo $49/mes. Obtiene un widget de sitio web, 500 conversaciones de WhatsApp y 200 clientes potenciales de prospección, todo impulsado por el mismo cerebro de IA.' }, isBuiltin: true },
    { category: 'Other', pattern: 'Data privacy concerns', responses: { en: 'Data privacy is a top priority. We offer local hosting in Morocco (Marbella DC), full encryption, GDPR compliance, and adherence to Morocco Law 09-08. We can also sign a DPA (Data Processing Agreement).', fr: 'La confidentialité des données est une priorité absolue. Nous proposons un hébergement local au Maroc (Marbella DC), un chiffrement complet, la conformité RGPD et le respect de la Loi 09-08 marocaine. Nous pouvons également signer un DPA (Accord de Traitement des Données).', ar: 'خصوصية البيانات هي أولوية قصوى. نحن نقدم استضافة محلية في المغرب (Marbella DC) وتشفير كامل والامتثال للائحة العامة لحماية البيانات والامتثال للقانون المغربي 09-08. يمكننا أيضًا توقيع اتفاقية معالجة البيانات.', es: 'La privacidad de datos es una prioridad absoluta. Ofrecemos alojamiento local en Marruecos (Marbella DC), cifrado completo, cumplimiento GDPR y adhesión a la Ley 09-08 de Marruecos. También podemos firmar un DPA (Acuerdo de Procesamiento de Datos).' }, isBuiltin: true },
    { category: 'Other', pattern: 'Does it support Arabic and French?', responses: { en: 'Absolutely! Our AI natively supports Arabic, French, English, Spanish, and Moroccan Darija. It automatically detects the language and responds appropriately — no manual switching required.', fr: 'Absolument! Notre IA supporte nativement l\'arabe, le français, l\'anglais, l\'espagnol et le darija marocain. Elle détecte automatiquement la langue et répond de manière appropriée — sans commutation manuelle.', ar: 'بالتأكيد! ذكاءنا الاصطناعي يدعم بشكل أصلي العربية والفرنسية والإنجليزية والإسبانية والدارجة المغربية. يكتشف اللغة تلقائيًا ويستجيب بشكل مناسب - بدون تبديل يدوي.', es: '¡Absolutamente! Nuestra IA es compatible de forma nativa con árabe, francés, inglés, español y darija marroquí. Detecta automáticamente el idioma y responde adecuadamente, sin necesidad de cambio manual.' }, isBuiltin: true },
    { category: 'Other', pattern: 'Can I try it before buying?', responses: { en: 'Yes! You can start with a 14-day free trial on any plan, no credit card required. You\'ll have full access to all features including website widget, WhatsApp, and prospecting.', fr: 'Oui! Vous pouvez commencer par un essai gratuit de 14 jours sur n\'importe quel forfait, sans carte de crédit requise. Vous aurez un accès complet à toutes les fonctionnalités.', ar: 'نعم! يمكنك البدء بتجربة مجانية لمدة 14 يومًا على أي خطة، بدون حاجة لبطاقة ائتمان. ستحصل على وصول كامل لجميع الميزات.', es: '¡Sí! Puede comenzar con una prueba gratuita de 14 días en cualquier plan, sin necesidad de tarjeta de crédito. Tendrá acceso completo a todas las funciones.' }, isBuiltin: true },
  ];

  for (const objection of objections) {
    const workspace = await prisma.workspace.findFirst();
    if (workspace) {
      await prisma.objectionTemplate.upsert({
        where: { id: `${workspace.id}-${objection.category}-${objection.pattern.slice(0, 20)}` },
        update: {},
        create: {
          workspaceId: workspace.id,
          category: objection.category,
          objectionPattern: objection.pattern,
          responses: objection.responses,
          isBuiltin: true,
        },
      });
    }
  }

  // ── 3. Built-in Personas ──────────────────────────────────────────────────
  const builtinPersonas = [
    {
      name: 'Friendly Sales Rep',
      description: 'Warm, helpful sales persona for prospecting campaigns',
      systemPrompt: 'You are a friendly and professional sales representative. Your goal is to build rapport, understand customer needs, and guide them toward a solution that adds value. Always be polite, empathetic, and helpful. Never be pushy or aggressive. Use the BANT framework to qualify leads naturally through conversation.',
      isBuiltin: true,
    },
    {
      name: 'Professional Support Agent',
      description: 'Polite and efficient support persona for customer service',
      systemPrompt: 'You are a professional customer support agent. Your goal is to resolve customer issues quickly and accurately. Be concise, clear, and courteous. If you cannot resolve an issue, escalate it to a human agent with a full summary. Always maintain a calm and helpful tone.',
      isBuiltin: true,
    },
    {
      name: 'Multilingual Concierge',
      description: 'Multi-language concierge for website widget',
      systemPrompt: 'You are a multilingual concierge for a Moroccan business. You can communicate in English, French, Arabic, Spanish, and Moroccan Darija. Your goal is to welcome visitors, answer their questions, and guide them to the right department or information. Detect the user\'s language and respond in the same language.',
      isBuiltin: true,
    },
    {
      name: 'Darija-Native Agent',
      description: 'Specialized for Moroccan Darija conversations',
      systemPrompt: 'You specialize in Moroccan Darija conversations. Use Darija naturally mixed with French and Arabic as Moroccans do. Understand local expressions, humor, and cultural references. Be warm and approachable. When appropriate, explain concepts in simple terms.',
      isBuiltin: true,
    },
    {
      name: 'Lead Qualification Bot',
      description: 'BANT-focused prospecting persona',
      systemPrompt: 'You are a lead qualification specialist for B2B sales. Your goal is to qualify leads using the BANT framework: Budget, Authority, Need, and Timeline. Ask natural questions to uncover each dimension. Do not sound like a robot — make the conversation feel natural. Record responses and update lead scores accordingly.',
      isBuiltin: true,
    },
  ];

  for (const persona of builtinPersonas) {
    await prisma.persona.upsert({
      where: { id: persona.name.toLowerCase().replace(/\s+/g, '-') },
      update: {},
      create: {
        id: persona.name.toLowerCase().replace(/\s+/g, '-'),
        ...persona,
      },
    });
  }

  // ── 4. Sample Dev Data ────────────────────────────────────────────────────
  const devEmail = process.env.SEED_EMAIL || 'admin@chatai.ma';
  const devPassword = process.env.SEED_PASSWORD || 'Test1234!';
  const passwordHash = await bcrypt.hash(devPassword, 12);

  const existingUser = await prisma.user.findUnique({ where: { email: devEmail } });
  if (!existingUser) {
    const user = await prisma.user.create({
      data: {
        email: devEmail,
        name: 'Admin User',
        passwordHash,
      },
    });

    const org = await prisma.organization.create({
      data: {
        name: 'ChatAi Demo',
        ownerId: user.id,
        slug: 'chatai-demo',
        plan: 'Pro',
      },
    });

    await prisma.orgMember.create({
      data: { organizationId: org.id, userId: user.id, role: 'owner' },
    });

    const workspace = await prisma.workspace.create({
      data: {
        organizationId: org.id,
        name: 'Main Workspace',
        slug: 'main-workspace',
      },
    });

    await prisma.workspaceMember.create({
      data: { workspaceId: workspace.id, userId: user.id, role: 'admin' },
    });

    console.log(`✅ Dev user created: ${devEmail} / ${devPassword}`);
  } else {
    console.log(`ℹ️  Dev user already exists: ${devEmail}`);
  }

  console.log('✅ Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
