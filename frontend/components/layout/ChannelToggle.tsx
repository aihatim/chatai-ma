'use client';

import { motion } from 'framer-motion';
import { Globe, MessageCircle, Target, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore, type Channel } from '@/lib/store';

interface ChannelTab {
  id: Channel;
  label: string;
  icon: typeof Globe;
  color: string;
  borderColor: string;
  bgColor: string;
}

const channels: ChannelTab[] = [
  {
    id: 'website',
    label: 'Website',
    icon: Globe,
    color: 'text-teal-400',
    borderColor: 'border-teal-500/30',
    bgColor: 'bg-teal-500/10',
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    icon: MessageCircle,
    color: 'text-whatsapp',
    borderColor: 'border-whatsapp/30',
    bgColor: 'bg-whatsapp/10',
  },
  {
    id: 'prospecting',
    label: 'Prospecting',
    icon: Target,
    color: 'text-amber',
    borderColor: 'border-amber/30',
    bgColor: 'bg-amber/10',
  },
  {
    id: 'all',
    label: 'All Channels',
    icon: LayoutGrid,
    color: 'text-gold-400',
    borderColor: 'border-gold-500/30',
    bgColor: 'bg-gold-500/10',
  },
];

const conversationCounts: Record<Channel, number> = {
  website: 24,
  whatsapp: 18,
  prospecting: 7,
  all: 49,
};

export default function ChannelToggle() {
  const { currentChannel, setChannel } = useAppStore();

  return (
    <div className="flex items-center gap-1 p-1 bg-obsidian-900/80 rounded-xl border border-obsidian-800">
      {channels.map((ch) => {
        const active = currentChannel === ch.id;
        return (
          <motion.button
            key={ch.id}
            layout
            onClick={() => setChannel(ch.id)}
            className={cn(
              'relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              active ? ch.color : 'text-obsidian-400 hover:text-obsidian-200'
            )}
          >
            {active && (
              <motion.div
                layoutId="channel-active-bg"
                className={cn('absolute inset-0 rounded-lg', ch.bgColor, 'border', ch.borderColor)}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-2">
              <span className="relative">
                <ch.icon size={16} />
                <span
                  className={cn(
                    'absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full animate-ping opacity-75',
                    ch.id === 'website' && 'bg-teal-400',
                    ch.id === 'whatsapp' && 'bg-whatsapp',
                    ch.id === 'prospecting' && 'bg-amber',
                    ch.id === 'all' && 'bg-gold-400'
                  )}
                />
              </span>
              <span className="relative z-10">{ch.label}</span>
              <span
                className={cn(
                  'relative z-10 text-xs px-1.5 py-0.5 rounded-full',
                  active ? 'bg-obsidian-800' : 'bg-obsidian-800/50'
                )}
              >
                {conversationCounts[ch.id]}
              </span>
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
