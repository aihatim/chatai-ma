'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageCircle,
  X,
  ExternalLink,
  Clock,
  Smile,
  Frown,
  Meh,
  Building2,
  User,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { fetchApi } from '@/lib/api';

interface ProspectingMessage {
  id: string;
  prospectName: string;
  company: string;
  message: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  timestamp: string;
  campaignId: string;
}

const sentimentConfig = {
  positive: { icon: Smile, color: 'text-teal-400', dot: 'bg-teal-400' },
  neutral: { icon: Meh, color: 'text-obsidian-400', dot: 'bg-obsidian-400' },
  negative: { icon: Frown, color: 'text-red-400', dot: 'bg-red-400' },
};

export default function ProspectingFeed({ campaignId }: { campaignId?: string }) {
  const [messages, setMessages] = useState<ProspectingMessage[]>([]);
  const [selected, setSelected] = useState<ProspectingMessage | null>(null);

  const poll = useCallback(async () => {
    try {
      const path = campaignId
        ? `/api/v1/prospecting/campaigns/${campaignId}/messages?limit=20`
        : '/api/v1/prospecting/messages?limit=20';
      const data = await fetchApi<ProspectingMessage[]>(path);
      if (data && Array.isArray(data)) {
        setMessages((prev) => {
          const existing = new Set(prev.map((m) => m.id));
          const newOnes = data.filter((m) => !existing.has(m.id));
          return [...newOnes, ...prev].slice(0, 50);
        });
      }
    } catch {
      // silent fail
    }
  }, [campaignId]);

  useEffect(() => {
    poll();
    const interval = setInterval(poll, 10000);
    return () => clearInterval(interval);
  }, [poll]);

  const timeAgo = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className={cn('space-y-3', selected ? 'lg:col-span-2' : 'lg:col-span-3')}>
        <h3 className="text-sm font-semibold text-obsidian-400 uppercase tracking-wider flex items-center gap-2">
          <MessageCircle size={14} />
          Live Prospecting Feed
        </h3>
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {messages.map((msg) => {
              const sConfig = sentimentConfig[msg.sentiment];
              const SentIcon = sConfig.icon;
              const isSelected = selected?.id === msg.id;
              return (
                <motion.div
                  key={msg.id}
                  layout
                  initial={{ opacity: 0, y: -20, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, y: -10, height: 0 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  onClick={() => setSelected(isSelected ? null : msg)}
                  className={cn(
                    'p-4 rounded-xl border cursor-pointer transition-all',
                    isSelected
                      ? 'border-gold-500/30 bg-gold-500/5'
                      : 'border-obsidian-800 bg-obsidian-900/30 hover:border-obsidian-600 hover:bg-obsidian-800/30'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="relative mt-1">
                      <div className="w-8 h-8 rounded-full bg-obsidian-700 flex items-center justify-center">
                        <User size={14} className="text-obsidian-400" />
                      </div>
                      <span className={cn('absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-obsidian-900', sConfig.dot)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-obsidian-200 truncate">{msg.prospectName}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] text-obsidian-600 flex items-center gap-1">
                            <Clock size={10} />
                            {timeAgo(msg.timestamp)}
                          </span>
                          <SentIcon size={12} className={sConfig.color} />
                        </div>
                      </div>
                      <p className="text-xs text-obsidian-500 mt-0.5 flex items-center gap-1">
                        <Building2 size={10} />
                        {msg.company}
                      </p>
                      <p className="text-xs text-obsidian-400 mt-2 line-clamp-2">{msg.message.slice(0, 100)}{msg.message.length > 100 ? '...' : ''}</p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {messages.length === 0 && (
            <div className="py-12 text-center">
              <MessageCircle size={32} className="mx-auto text-obsidian-600 mb-3" />
              <p className="text-sm text-obsidian-500">No prospecting messages yet</p>
              <p className="text-xs text-obsidian-600 mt-1">Messages will appear here in real-time</p>
            </div>
          )}
        </div>
      </div>

      {/* Side panel */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.25 }}
            className="lg:col-span-1"
          >
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Message Details</CardTitle>
                  <button onClick={() => setSelected(null)} className="text-obsidian-500 hover:text-obsidian-300 transition-colors">
                    <X size={16} />
                  </button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-obsidian-700 flex items-center justify-center">
                    <User size={16} className="text-obsidian-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-obsidian-200">{selected.prospectName}</p>
                    <p className="text-xs text-obsidian-500">{selected.company}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={cn('w-2 h-2 rounded-full', sentimentConfig[selected.sentiment].dot)} />
                  <span className={cn('text-xs font-medium capitalize', sentimentConfig[selected.sentiment].color)}>
                    {selected.sentiment}
                  </span>
                </div>

                <div className="p-3 bg-obsidian-800/50 rounded-xl">
                  <p className="text-sm text-obsidian-200 leading-relaxed">{selected.message}</p>
                </div>

                <div className="flex items-center gap-2 text-xs text-obsidian-500">
                  <Clock size={12} />
                  {new Date(selected.timestamp).toLocaleString()}
                </div>

                <a
                  href={`/en/prospecting?campaign=${selected.campaignId}`}
                  className="flex items-center gap-2 text-xs text-gold-400 hover:text-gold-300 transition-colors"
                >
                  <ExternalLink size={12} />
                  View in Campaign
                </a>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
