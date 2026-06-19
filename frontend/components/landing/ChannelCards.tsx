'use client';

import { motion } from 'framer-motion';
import { Globe, MessageCircle, Target, Check } from 'lucide-react';

const channels = [
  {
    name: 'Website Widget',
    icon: Globe,
    color: 'teal',
    borderClass: 'border-teal-500/40',
    bgClass: 'bg-teal-500/5',
    glowClass: 'shadow-teal-500/20',
    iconBg: 'bg-teal-500/10 text-teal-400',
    features: [
      '< 40KB gzipped embed',
      'Shadow DOM isolation',
      'Chameleon Mode theming',
      'SSE streaming responses',
      'Multi-language support',
    ],
    actionLabel: 'Deploy Now',
    actionHref: '/auth/signup',
  },
  {
    name: 'WhatsApp Channel',
    icon: MessageCircle,
    color: 'whatsapp',
    borderClass: 'border-whatsapp/40',
    bgClass: 'bg-whatsapp/5',
    glowClass: 'shadow-whatsapp/20',
    iconBg: 'bg-whatsapp/10 text-whatsapp',
    features: [
      '< 3s p95 response time',
      'Darija / Arabic / French detection',
      'Template message support',
      'Seamless human handoff',
      'Rich media carousels',
    ],
    actionLabel: 'Connect Now',
    actionHref: '/auth/signup',
  },
  {
    name: 'Prospecting Engine',
    icon: Target,
    color: 'amber',
    borderClass: 'border-amber/40',
    bgClass: 'bg-amber/5',
    glowClass: 'shadow-amber/20',
    iconBg: 'bg-amber/10 text-amber',
    features: [
      'AI-personalized outreach',
      '> 25% response rate',
      'BANT qualification engine',
      'Automated meeting booking',
      'Revenue attribution dashboard',
    ],
    actionLabel: 'Launch Prospector',
    actionHref: '/auth/signup',
  },
];

function ChannelIcon({ icon: Icon }: { icon: typeof Globe }) {
  return <Icon className="w-6 h-6" />;
}

export default function ChannelCards() {
  return (
    <section className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <motion.h2
          className="text-3xl md:text-4xl font-bold text-center mb-16"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          Choose Your{' '}
          <span className="gradient-gold bg-clip-text text-transparent">Channel</span>
        </motion.h2>
        <div className="grid md:grid-cols-3 gap-8">
          {channels.map((ch, i) => (
            <motion.div
              key={ch.name}
              className={`rounded-2xl border ${ch.borderClass} ${ch.bgClass} p-8 flex flex-col hover:scale-[1.02] transition-all duration-300 hover:shadow-xl ${ch.glowClass}`}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.15 }}
            >
              <div className={`w-12 h-12 rounded-xl ${ch.iconBg} flex items-center justify-center mb-5`}>
                <ChannelIcon icon={ch.icon} />
              </div>
              <h3 className={`text-2xl font-bold text-${ch.color === 'teal' ? 'teal-400' : ch.color === 'whatsapp' ? 'whatsapp' : 'amber'} mb-5`}>
                {ch.name}
              </h3>
              <ul className="space-y-3 flex-1 mb-8">
                {ch.features.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm text-obsidian-300">
                    <Check className={`w-4 h-4 mt-0.5 flex-shrink-0 text-${ch.color === 'teal' ? 'teal-400' : ch.color === 'whatsapp' ? 'whatsapp' : 'amber'}`} />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="flex flex-col sm:flex-row gap-3 mt-auto">
                <a
                  href="#demo"
                  className="flex-1 text-center px-4 py-3 rounded-xl border border-obsidian-600 text-obsidian-300 text-sm font-medium hover:bg-obsidian-800 transition-colors"
                >
                  Learn More
                </a>
                <a
                  href={ch.actionHref}
                  className={`flex-1 text-center px-4 py-3 rounded-xl text-sm font-medium text-white transition-all hover:brightness-110 ${
                    ch.color === 'teal'
                      ? 'bg-teal-600'
                      : ch.color === 'whatsapp'
                      ? 'bg-whatsapp'
                      : 'bg-amber'
                  }`}
                >
                  {ch.actionLabel}
                </a>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
