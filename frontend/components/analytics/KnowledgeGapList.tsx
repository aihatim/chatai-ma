'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';

type Channel = 'website' | 'whatsapp' | 'prospecting';

interface GapItem {
  question: string;
  timesAsked: number;
  channel: Channel;
  lastAsked: string;
}

interface KnowledgeGapListProps {
  data: GapItem[];
  className?: string;
}

const channelFilters: { id: Channel | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'website', label: 'Website' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'prospecting', label: 'Prospecting' },
];

const channelBadge: Record<Channel, { bg: string; text: string }> = {
  website: { bg: 'bg-teal-500/10', text: 'text-teal-400' },
  whatsapp: { bg: 'bg-whatsapp/10', text: 'text-whatsapp' },
  prospecting: { bg: 'bg-amber/10', text: 'text-amber' },
};

export default function KnowledgeGapList({ data, className }: KnowledgeGapListProps) {
  const [channelFilter, setChannelFilter] = useState<Channel | 'all'>('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    let items = data;
    if (channelFilter !== 'all') {
      items = items.filter((g) => g.channel === channelFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter((g) => g.question.toLowerCase().includes(q));
    }
    return items.sort((a, b) => b.timesAsked - a.timesAsked);
  }, [data, channelFilter, search]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={cn('space-y-3', className)}
    >
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-obsidian-500" />
          <input
            type="text"
            placeholder="Search questions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-3 rounded-lg bg-obsidian-800 border border-obsidian-700 text-sm text-obsidian-200 placeholder:text-obsidian-500 focus:outline-none focus:border-gold-500/50"
          />
        </div>
        <Filter size={14} className="text-obsidian-500" />
      </div>

      <div className="flex items-center gap-1 p-0.5 bg-obsidian-900 rounded-lg border border-obsidian-800 w-fit">
        {channelFilters.map((f) => {
          const active = channelFilter === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setChannelFilter(f.id)}
              className={cn(
                'px-2.5 py-1 text-xs rounded-md font-medium transition-colors',
                active ? 'bg-obsidian-700 text-obsidian-200' : 'text-obsidian-500 hover:text-obsidian-300',
              )}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      <div className="space-y-1.5 max-h-80 overflow-y-auto scrollbar-thin">
        {filtered.length === 0 ? (
          <p className="text-center text-obsidian-500 text-sm py-8">No knowledge gaps found</p>
        ) : (
          filtered.map((gap, i) => (
            <motion.div
              key={gap.question}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03, duration: 0.3 }}
              className="flex items-center justify-between gap-3 p-3 rounded-lg bg-obsidian-800/50 border border-obsidian-700 hover:border-obsidian-600 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-obsidian-200 truncate">{gap.question}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-obsidian-500">
                    Asked {gap.timesAsked} times
                  </span>
                  <span className="text-[10px] text-obsidian-600">•</span>
                  <span className="text-xs text-obsidian-500">Last: {gap.lastAsked}</span>
                  <span
                    className={cn(
                      'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                      channelBadge[gap.channel].bg,
                      channelBadge[gap.channel].text,
                    )}
                  >
                    {gap.channel}
                  </span>
                </div>
              </div>
              <button
                className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gold-500/10 border border-gold-500/30 text-gold-400 text-xs font-medium hover:bg-gold-500/20 transition-colors"
              >
                <Plus size={12} />
                Add to KB
              </button>
            </motion.div>
          ))
        )}
      </div>
    </motion.div>
  );
}
