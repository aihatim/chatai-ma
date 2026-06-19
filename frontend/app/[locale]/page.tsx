'use client';

import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import ChannelCards from '@/components/landing/ChannelCards';
import LiveDemo from '@/components/landing/LiveDemo';
import SocialProof from '@/components/landing/SocialProof';

const NeuralBrain = dynamic(() => import('@/components/landing/NeuralBrain'), { ssr: false });

const stats = [
  { label: 'Website Chat', value: '< 2s', sub: 'response time', color: 'text-teal-400' },
  { label: 'WhatsApp', value: '< 3s', sub: 'response time', color: 'text-whatsapp' },
  { label: 'Prospecting', value: '> 25%', sub: 'response rate', color: 'text-amber' },
];

export default function LocaleLandingPage() {
  return (
    <main className="min-h-screen bg-obsidian-950 text-white overflow-hidden">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-obsidian-900/50 via-obsidian-950 to-obsidian-950 z-0" />
        <div className="absolute inset-0 z-[1] opacity-60 md:opacity-80">
          <NeuralBrain />
        </div>
        <div className="relative z-10 text-center max-w-5xl mx-auto px-6 pt-20 pb-32">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gold-500/10 border border-gold-500/20 text-gold-400 text-sm mb-8">
              <span className="w-2 h-2 rounded-full bg-gold-400 animate-pulse" />
              Three Channels. One Brain. Infinite Revenue.
            </div>
          </motion.div>
          <motion.h1
            className="text-4xl sm:text-5xl md:text-7xl font-bold mb-6 leading-tight"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15 }}
          >
            Your Business. One Intelligent Brain.{' '}
            <span className="gradient-gold bg-clip-text text-transparent">Deploy Anywhere.</span>
          </motion.h1>
          <motion.p
            className="text-base md:text-lg text-obsidian-300 mb-10 max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
          >
            Train your AI once. Deploy it on your website, WhatsApp, or prospecting—or all three. No coding required.
          </motion.p>
          <motion.div
            className="flex flex-col sm:flex-row gap-4 justify-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.45 }}
          >
            <a
              href="/auth/signup"
              className="px-8 py-4 rounded-xl gradient-gold text-obsidian-950 font-semibold text-lg hover:scale-105 transition-transform"
            >
              Launch Your AI Brain Free &rarr;
            </a>
            <a
              href="#demo"
              className="px-8 py-4 rounded-xl border border-obsidian-600 text-obsidian-200 font-semibold text-lg hover:bg-obsidian-800 transition-colors"
            >
              See Live Demo
            </a>
          </motion.div>
          <motion.div
            className="mt-16 grid grid-cols-3 gap-8 max-w-2xl mx-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.6 }}
          >
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className={`text-3xl md:text-4xl font-bold ${stat.color}`}>{stat.value}</div>
                <div className="text-sm text-obsidian-400 mt-1">{stat.label}</div>
                <div className="text-xs text-obsidian-500">{stat.sub}</div>
              </div>
            ))}
          </motion.div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 z-10">
          <SocialProof />
        </div>
      </section>

      <ChannelCards />

      <LiveDemo />

      {/* CTA Section */}
      <section className="py-24 px-6 text-center relative">
        <div className="absolute inset-0 bg-gradient-to-t from-gold-500/5 to-transparent pointer-events-none" />
        <div className="max-w-3xl mx-auto relative z-10">
          <motion.h2
            className="text-3xl md:text-4xl font-bold mb-6"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            Ready to deploy in{' '}
            <span className="text-gold-400">under 1 hour?</span>
          </motion.h2>
          <motion.p
            className="text-obsidian-300 mb-10 text-lg"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            No code required. No complex setup. Just upload your knowledge base, choose your channels, and launch.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <a
              href="/auth/signup"
              className="inline-block px-10 py-4 rounded-xl gradient-gold text-obsidian-950 font-semibold text-lg hover:scale-105 transition-transform"
            >
              🚀 Start Free Trial - Both Channels Included
            </a>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-obsidian-800 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-gold-400 font-bold text-xl">ChatAi.ma</div>
          <div className="flex gap-6 text-sm text-obsidian-500">
            <a href="#" className="hover:text-obsidian-300">Privacy</a>
            <a href="#" className="hover:text-obsidian-300">Terms</a>
            <a href="#" className="hover:text-obsidian-300">Contact</a>
          </div>
          <div className="text-sm text-obsidian-600">&copy; 2026 ChatAi.ma &mdash; Enterprise AI Revenue Engine</div>
        </div>
      </footer>
    </main>
  );
}
