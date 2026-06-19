'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

type Sentiment = 'positive' | 'neutral' | 'negative';

interface CellData {
  sentiment: Sentiment;
  count: number;
}

interface SentimentHeatmapProps {
  data: Record<string, Record<number, CellData>>;
  className?: string;
}

const sentimentColors: Record<Sentiment, { bg: string; border: string; text: string }> = {
  positive: { bg: 'bg-teal-500/20', border: 'border-teal-500/30', text: 'text-teal-400' },
  neutral: { bg: 'bg-amber/20', border: 'border-amber/30', text: 'text-amber' },
  negative: { bg: 'bg-red-500/20', border: 'border-red-500/30', text: 'text-red-400' },
};

const sentimentGradient: Record<Sentiment, string> = {
  positive: '#2DD4BF',
  neutral: '#F59E0B',
  negative: '#EF4444',
};

export default function SentimentHeatmap({ data, className }: SentimentHeatmapProps) {
  const [tooltip, setTooltip] = useState<{ day: string; hour: number; cell: CellData } | null>(null);

  const maxCount = useMemo(() => {
    let max = 0;
    for (const day of DAYS) {
      for (const hour of HOURS) {
        const cell = data[day]?.[hour];
        if (cell && cell.count > max) max = cell.count;
      }
    }
    return max || 1;
  }, [data]);

  const getOpacity = (count: number) => {
    return 0.2 + (count / maxCount) * 0.8;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={cn('relative', className)}
    >
      <div className="overflow-x-auto scrollbar-thin">
        <div className="min-w-[700px]">
          <div className="flex">
            <div className="w-12 shrink-0" />
            <div className="flex-1 grid grid-cols-24 gap-[2px]">
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="text-[9px] text-obsidian-500 text-center leading-none pt-0.5 pb-1"
                >
                  {hour === 0 ? '12a' : hour === 12 ? '12p' : hour > 12 ? `${hour - 12}p` : `${hour}a`}
                </div>
              ))}
            </div>
          </div>
          {DAYS.map((day) => (
            <div key={day} className="flex items-center mb-[2px]">
              <div className="w-12 shrink-0 text-[10px] text-obsidian-500 font-medium">{day}</div>
              <div className="flex-1 grid grid-cols-24 gap-[2px]">
                {HOURS.map((hour) => {
                  const cell = data[day]?.[hour];
                  const sentiment = cell?.sentiment || 'neutral';
                  const count = cell?.count || 0;
                  const opacity = getOpacity(count);
                  return (
                    <div
                      key={hour}
                      className="relative aspect-square rounded-sm cursor-pointer transition-transform hover:scale-125"
                      style={{
                        backgroundColor: sentimentGradient[sentiment],
                        opacity: count > 0 ? opacity : 0.05,
                      }}
                      onMouseEnter={() => setTooltip({ day, hour, cell: cell || { sentiment: 'neutral', count: 0 } })}
                      onMouseLeave={() => setTooltip(null)}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4 mt-3">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-teal-400 opacity-60" />
          <span className="text-[10px] text-obsidian-500">Positive</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-amber opacity-60" />
          <span className="text-[10px] text-obsidian-500">Neutral</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-red-400 opacity-60" />
          <span className="text-[10px] text-obsidian-500">Negative</span>
        </div>
      </div>

      {tooltip && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-lg bg-obsidian-800 border border-obsidian-700 text-xs text-obsidian-200 whitespace-nowrap shadow-lg z-10 pointer-events-none">
          {tooltip.day} {tooltip.hour}:00 — <span className={sentimentColors[tooltip.cell.sentiment].text}>
            {tooltip.cell.sentiment}
          </span> ({tooltip.cell.count})
        </div>
      )}
    </motion.div>
  );
}
