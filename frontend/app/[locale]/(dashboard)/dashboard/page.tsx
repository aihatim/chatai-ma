'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import {
  DollarSign,
  MessageSquare,
  Clock,
  ThumbsUp,
  TrendingUp,
  Rocket,
  Globe,
  MessageCircle,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import KnowledgeBrain from '@/components/dashboard/KnowledgeBrain';
import PromptForge from '@/components/dashboard/PromptForge';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const channelColors = {
  website: '#2DD4BF',
  whatsapp: '#25D366',
  prospecting: '#F59E0B',
  all: '#D4A853',
};

const revenueData = [
  { channel: 'Website', value: 12400, color: channelColors.website },
  { channel: 'WhatsApp', value: 18900, color: channelColors.whatsapp },
  { channel: 'Prospecting', value: 8600, color: channelColors.prospecting },
];

const conversations = [
  {
    id: 1,
    channel: 'website' as const,
    message: 'What are your pricing plans for enterprise?',
    customer: 'Sarah Johnson',
    time: '2m ago',
    channelIcon: Globe,
    channelColor: 'text-teal-400',
  },
  {
    id: 2,
    channel: 'whatsapp' as const,
    message: 'Bonjour, je voudrais réserver une démo.',
    customer: 'Ahmed Benali',
    time: '5m ago',
    channelIcon: MessageCircle,
    channelColor: 'text-whatsapp',
  },
  {
    id: 3,
    channel: 'prospecting' as const,
    message: 'Interested in your AI prospecting solution for our sales team.',
    customer: 'Maria Garcia',
    time: '12m ago',
    channelIcon: Rocket,
    channelColor: 'text-amber',
  },
  {
    id: 4,
    channel: 'website' as const,
    message: 'How does the chameleon mode work?',
    customer: 'John Smith',
    time: '18m ago',
    channelIcon: Globe,
    channelColor: 'text-teal-400',
  },
];

export default function DashboardPage() {
  const t = useTranslations('dashboard');

  const overviewCards = useMemo(
    () => [
      {
        title: t('totalRevenue'),
        value: '$39,900',
        change: '+12.5%',
        icon: DollarSign,
        color: 'text-gold-400',
        bgColor: 'bg-gold-500/10',
      },
      {
        title: t('activeConversations'),
        value: '49',
        change: '+8.2%',
        icon: MessageSquare,
        color: 'text-teal-400',
        bgColor: 'bg-teal-500/10',
      },
      {
        title: t('responseTime'),
        value: '1.8s',
        change: '-0.3s',
        icon: Clock,
        color: 'text-whatsapp',
        bgColor: 'bg-whatsapp/10',
      },
      {
        title: t('satisfaction'),
        value: '94%',
        change: '+2.1%',
        icon: ThumbsUp,
        color: 'text-amber',
        bgColor: 'bg-amber/10',
      },
    ],
    [t]
  );

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-obsidian-100">{t('overview')}</h1>
          <p className="text-sm text-obsidian-500 mt-1">Real-time metrics across all channels</p>
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {overviewCards.map((card) => (
          <Card key={card.title} animate>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-obsidian-500 font-medium uppercase tracking-wide">
                  {card.title}
                </span>
                <div className={`p-2 rounded-lg ${card.bgColor}`}>
                  <card.icon size={16} className={card.color} />
                </div>
              </div>
              <div className="flex items-end justify-between">
                <span className="text-2xl font-bold text-obsidian-100">{card.value}</span>
                <span className="text-xs text-teal-400 flex items-center gap-1">
                  <TrendingUp size={12} />
                  {card.change}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div variants={itemVariants} className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Revenue by Channel</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <XAxis
                      dataKey="channel"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#8c8d96', fontSize: 12 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#8c8d96', fontSize: 12 }}
                      tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      contentStyle={{
                        background: '#1a1a20',
                        border: '1px solid #333340',
                        borderRadius: '8px',
                        color: '#f0f0f1',
                      }}
                      formatter={(value: number) => [`$${value.toLocaleString()}`, 'Revenue']}
                    />
                    <Bar
                      dataKey="value"
                      radius={[6, 6, 0, 0]}
                      animationBegin={300}
                      animationDuration={800}
                    >
                      {revenueData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle>Live Conversations</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-obsidian-800">
                {conversations.map((conv, idx) => (
                  <motion.div
                    key={conv.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + idx * 0.1, duration: 0.3 }}
                    className="p-4 hover:bg-obsidian-800/30 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 ${conv.channelColor}`}>
                        <conv.channelIcon size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-obsidian-200 truncate">
                            {conv.customer}
                          </span>
                          <span className="text-xs text-obsidian-600 shrink-0">{conv.time}</span>
                        </div>
                        <p className="text-xs text-obsidian-400 mt-1 line-clamp-2">{conv.message}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Knowledge Brain */}
      <motion.div variants={itemVariants}>
        <KnowledgeBrain />
      </motion.div>

      {/* Prompt Forge */}
      <motion.div variants={itemVariants}>
        <PromptForge />
      </motion.div>

      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Button
          variant="gold"
          size="lg"
          className="w-full justify-start"
          onClick={() => window.location.href = '/en/prospecting'}
        >
          <Rocket size={18} />
          Launch Prospecting Campaign
        </Button>
        <Button
          variant="secondary"
          size="lg"
          className="w-full justify-start"
          onClick={() => {}}
        >
          <Globe size={18} />
          Configure Widget
        </Button>
        <Button
          variant="secondary"
          size="lg"
          className="w-full justify-start"
          onClick={() => {}}
        >
          <MessageCircle size={18} />
          Connect WhatsApp
        </Button>
      </motion.div>
    </motion.div>
  );
}
