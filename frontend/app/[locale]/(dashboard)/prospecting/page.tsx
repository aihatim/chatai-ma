'use client';

import { useState } from 'react';
import { motion, Reorder } from 'framer-motion';
import { useTranslations } from 'next-intl';
import {
  Rocket,
  Plus,
  Phone,
  Mail,
  MessageCircle,
  Star,
  Users,
  TrendingUp,
  Target,
  CheckCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import ProspectingFeed from '@/components/dashboard/ProspectingFeed';
import CampaignWizard from '@/components/dashboard/CampaignWizard';

interface Lead {
  id: string;
  name: string;
  company: string;
  score: number;
  lastActivity: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  tags: string[];
}

interface Column {
  id: string;
  title: string;
  leads: Lead[];
}

const initialColumns: Column[] = [
  {
    id: 'new',
    title: 'New',
    leads: [
      { id: '1', name: 'John Smith', company: 'Acme Corp', score: 72, lastActivity: '2h ago', sentiment: 'neutral', tags: ['tech', 'b2b'] },
      { id: '2', name: 'Lisa Wang', company: 'TechFlow', score: 85, lastActivity: '5h ago', sentiment: 'positive', tags: ['saas'] },
    ],
  },
  {
    id: 'contacted',
    title: 'Contacted',
    leads: [
      { id: '3', name: 'Omar Hassan', company: 'Nile Inc', score: 65, lastActivity: '1d ago', sentiment: 'neutral', tags: ['enterprise'] },
    ],
  },
  {
    id: 'responded',
    title: 'Responded',
    leads: [
      { id: '4', name: 'Maria Garcia', company: 'LatAm Digital', score: 91, lastActivity: '3h ago', sentiment: 'positive', tags: ['b2b', 'hot'] },
      { id: '5', name: 'David Kim', company: 'SeoulTech', score: 58, lastActivity: '2d ago', sentiment: 'negative', tags: ['startup'] },
    ],
  },
  {
    id: 'qualified',
    title: 'Qualified',
    leads: [],
  },
  {
    id: 'meeting-booked',
    title: 'Meeting Booked',
    leads: [
      { id: '6', name: 'Sarah Johnson', company: 'GlobalSys', score: 95, lastActivity: '1h ago', sentiment: 'positive', tags: ['enterprise', 'hot'] },
    ],
  },
];

const sentimentIcons = {
  positive: Star,
  neutral: MessageCircle,
  negative: Phone,
};

const sentimentColors = {
  positive: 'text-teal-400',
  neutral: 'text-obsidian-400',
  negative: 'text-red-400',
};

function ScoreRing({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 14;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? '#2DD4BF' : score >= 60 ? '#F59E0B' : '#ef4444';

  return (
    <div className="relative w-8 h-8 flex items-center justify-center">
      <svg className="w-8 h-8 -rotate-90" viewBox="0 0 32 32">
        <circle cx="16" cy="16" r="14" fill="none" stroke="#333340" strokeWidth="3" />
        <motion.circle
          cx="16"
          cy="16"
          r="14"
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </svg>
      <span className="absolute text-[9px] font-bold text-obsidian-200">{score}</span>
    </div>
  );
}

const statsCards = [
  { title: 'Active Campaigns', value: '4', change: '+1', icon: Target, color: 'text-gold-400', bg: 'bg-gold-500/10' },
  { title: "Today's Contacted", value: '127', change: '+18.3%', icon: Users, color: 'text-teal-400', bg: 'bg-teal-500/10' },
  { title: 'Response Rate', value: '24.6%', change: '+3.2%', icon: TrendingUp, color: 'text-whatsapp', bg: 'bg-whatsapp/10' },
  { title: 'Qualified Today', value: '31', change: '+8', icon: CheckCircle, color: 'text-amber', bg: 'bg-amber/10' },
];

export default function ProspectingPage() {
  const t = useTranslations('prospecting');
  const [columns, setColumns] = useState<Column[]>(initialColumns);

  const handleDragEnd = (columnId: string, reorderedLeads: Lead[]) => {
    setColumns((prev) =>
      prev.map((col) => (col.id === columnId ? { ...col, leads: reorderedLeads } : col))
    );
  };

  const moveLead = (leadId: string, fromCol: string, toCol: string) => {
    setColumns((prev) => {
      const source = prev.find((c) => c.id === fromCol);
      const target = prev.find((c) => c.id === toCol);
      if (!source || !target) return prev;
      const lead = source.leads.find((l) => l.id === leadId);
      if (!lead) return prev;
      return prev.map((col) => {
        if (col.id === fromCol) return { ...col, leads: col.leads.filter((l) => l.id !== leadId) };
        if (col.id === toCol) return { ...col, leads: [...col.leads, lead] };
        return col;
      });
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-obsidian-100">{t('pipeline')}</h1>
          <p className="text-sm text-obsidian-500 mt-1">Manage and track your prospecting pipeline</p>
        </div>
        <CampaignWizard />
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((stat) => (
          <Card key={stat.title} animate>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-obsidian-500 font-medium uppercase tracking-wide">{stat.title}</span>
                <div className={`p-2 rounded-lg ${stat.bg}`}>
                  <stat.icon size={16} className={stat.color} />
                </div>
              </div>
              <div className="flex items-end justify-between">
                <span className="text-2xl font-bold text-obsidian-100">{stat.value}</span>
                <span className="text-xs text-teal-400 flex items-center gap-1">
                  <TrendingUp size={12} />
                  {stat.change}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 overflow-x-auto pb-4">
        {columns.map((column) => (
          <div key={column.id} className="min-w-[220px]">
            <div className="flex items-center justify-between mb-3 px-1">
              <h3 className="text-sm font-semibold text-obsidian-400 uppercase tracking-wider">
                {column.title}
              </h3>
              <span className="text-xs text-obsidian-600 bg-obsidian-800 px-2 py-0.5 rounded-full">
                {column.leads.length}
              </span>
            </div>
            <Card variant="default" className="bg-obsidian-900/30 border-obsidian-800/50">
              <CardContent className="p-3 space-y-3">
                <Reorder.Group
                  axis="y"
                  values={column.leads}
                  onReorder={(reordered) => handleDragEnd(column.id, reordered)}
                  className="space-y-3"
                >
                  {column.leads.map((lead) => {
                    const SentimentIcon = sentimentIcons[lead.sentiment];
                    return (
                      <Reorder.Item
                        key={lead.id}
                        value={lead}
                        as="div"
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        dragListener
                        className="bg-obsidian-800/50 rounded-lg p-3 border border-obsidian-700/50 cursor-grab active:cursor-grabbing hover:border-obsidian-600 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-obsidian-200 truncate">{lead.name}</p>
                            <p className="text-xs text-obsidian-500 truncate">{lead.company}</p>
                          </div>
                          <ScoreRing score={lead.score} />
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1">
                            <SentimentIcon size={12} className={sentimentColors[lead.sentiment]} />
                            <span className="text-obsidian-500">{lead.lastActivity}</span>
                          </div>
                          <div className="flex gap-1">
                            {lead.tags.slice(0, 2).map((tag) => (
                              <span
                                key={tag}
                                className="px-1.5 py-0.5 rounded bg-obsidian-700 text-obsidian-400 text-[10px]"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      </Reorder.Item>
                    );
                  })}
                </Reorder.Group>

                {column.leads.length === 0 && (
                  <div className="py-8 text-center text-obsidian-600 text-sm">
                    Drop leads here
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      {/* Conversation feed */}
      <ProspectingFeed />
    </motion.div>
  );
}
