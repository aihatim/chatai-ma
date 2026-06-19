'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import {
  MessageSquare,
  Clock,
  ThumbsUp,
  Globe,
  MessageCircle,
  Target,
  CalendarDays,
  Users,
  Activity,
  Smile,
  BarChart3,
  TrendingUp,
  Zap,
  Phone,
  Mail,
  PieChart as PieChartIcon,
  Gauge,
  DollarSign,
  MessageSquareText,
  Send,
  MousePointerClick,
  Calendar,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import IntentPieChart from '@/components/analytics/IntentPieChart';
import KnowledgeGapList from '@/components/analytics/KnowledgeGapList';
import SentimentHeatmap from '@/components/analytics/SentimentHeatmap';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const PIE_COLORS = ['#2DD4BF', '#25D366', '#F59E0B', '#D4A853'];

type Tab = 'website' | 'whatsapp' | 'prospecting';
type DateRange = '7d' | '30d' | '90d';

const tabs: { id: Tab; label: string; icon: typeof Globe; color: string }[] = [
  { id: 'website', label: 'Website Analytics', icon: Globe, color: 'text-teal-400' },
  { id: 'whatsapp', label: 'WhatsApp Analytics', icon: MessageCircle, color: 'text-whatsapp' },
  { id: 'prospecting', label: 'Prospecting Analytics', icon: Target, color: 'text-amber' },
];

const dateRanges: { id: DateRange; label: string }[] = [
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: '90d', label: '90 days' },
];

function generateSpeedData() {
  const now = new Date();
  return Array.from({ length: 24 }, (_, i) => {
    const h = new Date(now);
    h.setHours(h.getHours() - 23 + i);
    const label = h.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    const base = 800 + Math.random() * 1200;
    return {
      time: label,
      p50: Math.round(base * (0.7 + Math.random() * 0.3)),
      p95: Math.round(base * (1.2 + Math.random() * 0.8)),
    };
  });
}

function generateLiveConversations() {
  const names = ['Alice M.', 'Bob K.', 'Carol S.', 'Dave J.', 'Eve R.', 'Frank L.', 'Grace W.'];
  const pages = ['/pricing', '/product/ai-chat', '/docs', '/contact', '/features', '/blog', '/support'];
  const statuses = ['active', 'typing', 'resolved', 'waiting'] as const;
  const previews = [
    'How do I integrate WhatsApp?',
    'What are your pricing plans?',
    'Can I customize the widget?',
    'Does it support Arabic?',
    'How does the AI training work?',
    'Is there a free trial?',
    'Can I export my data?',
  ];
  return Array.from({ length: 5 + Math.floor(Math.random() * 4) }, () => ({
    name: names[Math.floor(Math.random() * names.length)],
    page: pages[Math.floor(Math.random() * pages.length)],
    time: `${Math.floor(Math.random() * 5) + 1}m ago`,
    preview: previews[Math.floor(Math.random() * previews.length)],
    status: statuses[Math.floor(Math.random() * statuses.length)],
  }));
}

function generateWhatsAppVolume(days: number) {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1) + i);
    return {
      date: d.toISOString().slice(0, 10),
      ai: Math.round(30 + Math.random() * 70),
      human: Math.round(10 + Math.random() * 40),
    };
  });
}

function generateConversionData(days: number) {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1) + i);
    return {
      date: d.toISOString().slice(0, 10),
      messages: Math.round(200 + Math.random() * 400),
      purchases: Math.round(5 + Math.random() * 25),
    };
  });
}

function generateTemplateData() {
  const templates = [
    { name: 'Welcome Message', sent: 12340, delivered: 11800, responded: 3400 },
    { name: 'Order Confirmation', sent: 8920, delivered: 8750, responded: 1200 },
    { name: 'Abandoned Cart', sent: 5600, delivered: 5300, responded: 2100 },
    { name: 'Support Follow-up', sent: 3400, delivered: 3300, responded: 1800 },
    { name: 'Promotional Offer', sent: 21000, delivered: 19500, responded: 4500 },
  ];
  return templates.map((t) => ({
    ...t,
    deliveredRate: ((t.delivered / t.sent) * 100).toFixed(1),
    responseRate: ((t.responded / t.delivered) * 100).toFixed(1),
  }));
}

function generateProspectingMetrics() {
  return {
    totalLeads: 3847,
    contactRate: 68,
    responseRate: 42,
    conversionRate: 12,
    meetingBookedRate: 8,
    revenueGenerated: 147200,
    costPerLead: 3.42,
  };
}

function generatePitchData() {
  return [
    { variant: 'Value prop first', responses: 342, sent: 1200 },
    { variant: 'Question opener', responses: 287, sent: 1100 },
    { variant: 'Social proof', responses: 421, sent: 1300 },
    { variant: 'Pain point', responses: 198, sent: 900 },
    { variant: 'Personalized', responses: 512, sent: 1400 },
    { variant: 'Case study', responses: 156, sent: 800 },
  ];
}

function generateBestTimeData() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const data: Record<string, Record<number, number>> = {};
  for (const day of days) {
    data[day] = {};
    for (let h = 0; h < 24; h++) {
      const base = h >= 8 && h <= 18 ? 12 : 2;
      data[day][h] = Math.round(base + Math.random() * 20);
    }
  }
  return data;
}

function generateRevenueOverTime(days: number) {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1) + i);
    return {
      date: d.toISOString().slice(0, 10),
      revenue: Math.round(2000 + Math.random() * 5000),
    };
  });
}

function generateSentimentData() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const sentiments: Array<'positive' | 'neutral' | 'negative'> = ['positive', 'neutral', 'negative'];
  const data: Record<string, Record<number, { sentiment: 'positive' | 'neutral' | 'negative'; count: number }>> = {};
  for (const day of days) {
    data[day] = {};
    for (let h = 0; h < 24; h++) {
      const sentiment = sentiments[Math.floor(Math.random() * sentiments.length)];
      data[day][h] = {
        sentiment,
        count: Math.floor(Math.random() * 20) + 1,
      };
    }
  }
  return data;
}

function generateKnowledgeGaps() {
  const channels: Array<'website' | 'whatsapp' | 'prospecting'> = ['website', 'whatsapp', 'prospecting'];
  const questions = [
    'How do I cancel my subscription?',
    'Do you offer a free trial?',
    'Can I use my own OpenAI key?',
    'Is there a mobile app?',
    'How does billing work?',
    'Can I migrate from another platform?',
    'What languages do you support?',
    'How secure is my data?',
    'Do you have an API?',
    'Can I customize the chat widget?',
    'What happens when I exceed my limit?',
    'How do I add team members?',
    'Is WhatsApp Business API included?',
    'Can I export my conversations?',
    'How does AI training work?',
  ];
  return questions.map((q) => ({
    question: q,
    timesAsked: Math.floor(Math.random() * 40) + 1,
    channel: channels[Math.floor(Math.random() * channels.length)],
    lastAsked: `${Math.floor(Math.random() * 7) + 1}d ago`,
  }));
}

export default function AnalyticsPage() {
  const t = useTranslations('analytics');
  const [activeTab, setActiveTab] = useState<Tab>('website');
  const [selectedRange, setSelectedRange] = useState<DateRange>('30d');
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [liveConversations, setLiveConversations] = useState<any[]>([]);
  const [speedData, setSpeedData] = useState<any[]>([]);

  const days = selectedRange === '7d' ? 7 : selectedRange === '30d' ? 30 : 90;

  const mockMetrics = useMemo(() => ({
    totalConversations: 12473,
    activeUsers: 892,
    bounceRate: '32.4%',
    satisfactionScore: '4.7',
  }), []);

  const intentData = useMemo(() => [
    { name: 'Pricing', value: 340 },
    { name: 'Technical', value: 520 },
    { name: 'Product', value: 280 },
    { name: 'Shipping', value: 120 },
  ], []);

  const knowledgeGaps = useMemo(() => generateKnowledgeGaps(), []);
  const sentimentData = useMemo(() => generateSentimentData(), []);
  const whatsappVolume = useMemo(() => generateWhatsAppVolume(days), [days]);
  const conversionData = useMemo(() => generateConversionData(days), [days]);
  const templateData = useMemo(() => generateTemplateData(), []);
  const prospectingMetrics = useMemo(() => generateProspectingMetrics(), []);
  const pitchData = useMemo(() => generatePitchData(), []);
  const bestTimeData = useMemo(() => generateBestTimeData(), []);
  const revenueOverTime = useMemo(() => generateRevenueOverTime(days), [days]);

  const responseRateData = useMemo(() => [
    { name: 'AI Answered', value: 68, fill: '#25D366' },
    { name: 'Human Answered', value: 32, fill: '#D4A853' },
  ], []);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const { fetchApi } = await import('@/lib/api');
        const workspaceId = 'demo';
        const overviewRes = await fetchApi(`/api/v1/analytics/${workspaceId}/overview`).catch(() => null);
        setOverview(overviewRes);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [activeTab, selectedRange]);

  useEffect(() => {
    setLiveConversations(generateLiveConversations());
    setSpeedData(generateSpeedData());
    const interval = setInterval(() => {
      setLiveConversations(generateLiveConversations());
      setSpeedData(generateSpeedData());
    }, 5000);
    return () => clearInterval(interval);
  }, [activeTab]);

  const renderStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: 'bg-teal-500/10 text-teal-400 border-teal-500/30',
      typing: 'bg-gold-500/10 text-gold-400 border-gold-500/30',
      resolved: 'bg-obsidian-600 text-obsidian-400 border-obsidian-600',
      waiting: 'bg-amber/10 text-amber border-amber/30',
    };
    return (
      <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${styles[status] || styles.waiting}`}>
        {status}
      </span>
    );
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      <motion.div variants={itemVariants} className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-obsidian-100">Analytics</h1>
          <p className="text-sm text-obsidian-500 mt-1">Cross-channel performance metrics</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-obsidian-900/80 rounded-xl border border-obsidian-800">
            {tabs.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                    active ? tab.color + ' bg-obsidian-800' : 'text-obsidian-400 hover:text-obsidian-200',
                  )}
                >
                  <tab.icon size={14} />
                  {tab.label}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-1 p-1 bg-obsidian-900/80 rounded-xl border border-obsidian-800">
            <CalendarDays size={14} className="text-obsidian-500 ml-1" />
            {dateRanges.map((dr) => {
              const active = selectedRange === dr.id;
              return (
                <button
                  key={dr.id}
                  onClick={() => setSelectedRange(dr.id)}
                  className={cn(
                    'px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors',
                    active ? 'text-gold-400 bg-obsidian-800' : 'text-obsidian-400 hover:text-obsidian-200',
                  )}
                >
                  {dr.label}
                </button>
              );
            })}
          </div>
        </div>
      </motion.div>

      {activeTab === 'website' && (
        <>
          <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <Card animate>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-obsidian-500 font-medium uppercase tracking-wide">Total Conversations</span>
                  <div className="p-2 rounded-lg bg-teal-500/10">
                    <MessageSquare size={16} className="text-teal-400" />
                  </div>
                </div>
                <span className="text-2xl font-bold text-obsidian-100">{mockMetrics.totalConversations.toLocaleString()}</span>
              </CardContent>
            </Card>
            <Card animate>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-obsidian-500 font-medium uppercase tracking-wide">Active Users</span>
                  <div className="p-2 rounded-lg bg-gold-500/10">
                    <Users size={16} className="text-gold-400" />
                  </div>
                </div>
                <span className="text-2xl font-bold text-obsidian-100">{mockMetrics.activeUsers.toLocaleString()}</span>
              </CardContent>
            </Card>
            <Card animate>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-obsidian-500 font-medium uppercase tracking-wide">Bounce Rate</span>
                  <div className="p-2 rounded-lg bg-amber/10">
                    <Activity size={16} className="text-amber" />
                  </div>
                </div>
                <span className="text-2xl font-bold text-obsidian-100">{mockMetrics.bounceRate}</span>
              </CardContent>
            </Card>
            <Card animate>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-obsidian-500 font-medium uppercase tracking-wide">Satisfaction Score</span>
                  <div className="p-2 rounded-lg bg-whatsapp/10">
                    <Smile size={16} className="text-whatsapp" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-obsidian-100">{mockMetrics.satisfactionScore}</span>
                  <span className="text-xs text-obsidian-500">/ 5.0</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <motion.div variants={itemVariants} className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Zap size={16} className="text-teal-400" />
                      Live Conversations
                    </CardTitle>
                    <span className="flex items-center gap-1 text-[10px] text-teal-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
                      Live
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-obsidian-800 max-h-80 overflow-y-auto scrollbar-thin">
                    {liveConversations.map((conv, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="px-6 py-3 hover:bg-obsidian-800/30 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-obsidian-200">{conv.name}</span>
                          <div className="flex items-center gap-2">
                            {renderStatusBadge(conv.status)}
                            <span className="text-[10px] text-obsidian-600">{conv.time}</span>
                          </div>
                        </div>
                        <p className="text-xs text-obsidian-400 truncate">{conv.preview}</p>
                        <span className="text-[10px] text-obsidian-600 mt-0.5 block">{conv.page}</span>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants} className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock size={16} className="text-teal-400" />
                    Speed to Answer
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={speedData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <XAxis
                          dataKey="time"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: '#8c8d96', fontSize: 10 }}
                          interval={3}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: '#8c8d96', fontSize: 11 }}
                          tickFormatter={(v) => `${v}ms`}
                        />
                        <Tooltip
                          contentStyle={{ background: '#1a1a20', border: '1px solid #333340', borderRadius: '8px', color: '#f0f0f1', fontSize: 13 }}
                        />
                        <Line type="monotone" dataKey="p50" stroke="#2DD4BF" strokeWidth={2} dot={false} name="p50" animationBegin={300} animationDuration={800} />
                        <Line type="monotone" dataKey="p95" stroke="#F59E0B" strokeWidth={2} dot={false} name="p95" animationBegin={500} animationDuration={800} />
                        <Legend
                          wrapperStyle={{ fontSize: 11, color: '#8c8d96' }}
                          formatter={(value: string) => <span className="text-obsidian-400">{value}</span>}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChartIcon size={16} className="text-teal-400" />
                    Intent Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <IntentPieChart data={intentData} />
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare size={16} className="text-teal-400" />
                    Knowledge Gap Identifier
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <KnowledgeGapList data={knowledgeGaps} />
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity size={16} className="text-teal-400" />
                    Sentiment Heatmap
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <SentimentHeatmap data={sentimentData} />
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </>
      )}

      {activeTab === 'whatsapp' && (
        <>
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 size={16} className="text-whatsapp" />
                  Conversation Volume
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={whatsappVolume} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <XAxis
                        dataKey="date"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#8c8d96', fontSize: 10 }}
                        interval={Math.max(1, Math.floor(days / 10))}
                        tickFormatter={(v) => v?.slice(5) || ''}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#8c8d96', fontSize: 11 }}
                      />
                      <Tooltip
                        contentStyle={{ background: '#1a1a20', border: '1px solid #333340', borderRadius: '8px', color: '#f0f0f1', fontSize: 13 }}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: 11, color: '#8c8d96' }}
                        formatter={(value: string) => <span className="text-obsidian-400">{value}</span>}
                      />
                      <Bar dataKey="ai" stackId="a" fill="#25D366" radius={[0, 0, 0, 0]} name="AI" animationBegin={300} animationDuration={800} />
                      <Bar dataKey="human" stackId="a" fill="#404050" radius={[4, 4, 0, 0]} name="Human" animationBegin={500} animationDuration={800} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Phone size={16} className="text-whatsapp" />
                    Response Rate
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64 flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={responseRateData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={4}
                          dataKey="value"
                          animationBegin={300}
                          animationDuration={1000}
                        >
                          {responseRateData.map((entry, index) => (
                            <Cell key={index} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ background: '#1a1a20', border: '1px solid #333340', borderRadius: '8px', color: '#f0f0f1', fontSize: 13 }}
                          formatter={(value: number) => [`${value}%`, '']}
                        />
                        <Legend
                          wrapperStyle={{ fontSize: 11, color: '#8c8d96' }}
                          formatter={(value: string) => <span className="text-obsidian-400">{value}</span>}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp size={16} className="text-whatsapp" />
                    Conversion Tracking
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={conversionData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <XAxis
                          dataKey="date"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: '#8c8d96', fontSize: 10 }}
                          interval={Math.max(1, Math.floor(days / 8))}
                          tickFormatter={(v) => v?.slice(5) || ''}
                        />
                        <YAxis
                          yAxisId="left"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: '#8c8d96', fontSize: 11 }}
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: '#8c8d96', fontSize: 11 }}
                        />
                        <Tooltip
                          contentStyle={{ background: '#1a1a20', border: '1px solid #333340', borderRadius: '8px', color: '#f0f0f1', fontSize: 13 }}
                        />
                        <Legend
                          wrapperStyle={{ fontSize: 11, color: '#8c8d96' }}
                          formatter={(value: string) => <span className="text-obsidian-400">{value}</span>}
                        />
                        <Line yAxisId="left" type="monotone" dataKey="messages" stroke="#25D366" strokeWidth={2} dot={false} name="Messages" animationBegin={300} animationDuration={800} />
                        <Line yAxisId="right" type="monotone" dataKey="purchases" stroke="#D4A853" strokeWidth={2} dot={false} name="Purchases" animationBegin={500} animationDuration={800} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send size={16} className="text-whatsapp" />
                  Template Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto scrollbar-thin">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-obsidian-800">
                        <th className="text-left py-3 px-2 text-xs text-obsidian-500 font-medium uppercase tracking-wider">Template</th>
                        <th className="text-right py-3 px-2 text-xs text-obsidian-500 font-medium uppercase tracking-wider">Sent</th>
                        <th className="text-right py-3 px-2 text-xs text-obsidian-500 font-medium uppercase tracking-wider">Delivered</th>
                        <th className="text-right py-3 px-2 text-xs text-obsidian-500 font-medium uppercase tracking-wider">Delivered Rate</th>
                        <th className="text-right py-3 px-2 text-xs text-obsidian-500 font-medium uppercase tracking-wider">Response Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {templateData.map((t, i) => (
                        <motion.tr
                          key={t.name}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.05 }}
                          className="border-b border-obsidian-800/50 hover:bg-obsidian-800/20 transition-colors"
                        >
                          <td className="py-3 px-2 text-obsidian-200 font-medium">{t.name}</td>
                          <td className="py-3 px-2 text-obsidian-200 text-right">{t.sent.toLocaleString()}</td>
                          <td className="py-3 px-2 text-obsidian-200 text-right">{t.delivered.toLocaleString()}</td>
                          <td className="py-3 px-2 text-right">
                            <span className="text-teal-400">{t.deliveredRate}%</span>
                          </td>
                          <td className="py-3 px-2 text-right">
                            <span className="text-amber">{t.responseRate}%</span>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gauge size={16} className="text-whatsapp" />
                  Average Response Time
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center py-6">
                  <div className="relative w-48 h-48">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="40" fill="none" stroke="#262630" strokeWidth="8" />
                      <circle
                        cx="50" cy="50" r="40" fill="none" stroke="#25D366" strokeWidth="8"
                        strokeDasharray={`${(68 / 100) * 251.2} 251.2`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-3xl font-bold text-obsidian-100">42s</span>
                      <span className="text-xs text-obsidian-500 mt-1">Target: 60s</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 mt-4">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-whatsapp" />
                      <span className="text-xs text-obsidian-400">Current: 42s</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-obsidian-600" />
                      <span className="text-xs text-obsidian-400">Target: 60s</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </>
      )}

      {activeTab === 'prospecting' && (
        <>
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 size={16} className="text-amber" />
                  Full Metrics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl bg-obsidian-800/50 border border-obsidian-700">
                    <span className="text-xs text-obsidian-500 block mb-1">Total Leads</span>
                    <span className="text-xl font-bold text-obsidian-100">{prospectingMetrics.totalLeads.toLocaleString()}</span>
                  </div>
                  <div className="p-4 rounded-xl bg-obsidian-800/50 border border-obsidian-700">
                    <span className="text-xs text-obsidian-500 block mb-1">Contact Rate</span>
                    <span className="text-xl font-bold text-teal-400">{prospectingMetrics.contactRate}%</span>
                  </div>
                  <div className="p-4 rounded-xl bg-obsidian-800/50 border border-obsidian-700">
                    <span className="text-xs text-obsidian-500 block mb-1">Response Rate</span>
                    <span className="text-xl font-bold text-amber">{prospectingMetrics.responseRate}%</span>
                  </div>
                  <div className="p-4 rounded-xl bg-obsidian-800/50 border border-obsidian-700">
                    <span className="text-xs text-obsidian-500 block mb-1">Conversion Rate</span>
                    <span className="text-xl font-bold text-whatsapp">{prospectingMetrics.conversionRate}%</span>
                  </div>
                  <div className="p-4 rounded-xl bg-obsidian-800/50 border border-obsidian-700">
                    <span className="text-xs text-obsidian-500 block mb-1">Meeting Booked Rate</span>
                    <span className="text-xl font-bold text-obsidian-100">{prospectingMetrics.meetingBookedRate}%</span>
                  </div>
                  <div className="p-4 rounded-xl bg-obsidian-800/50 border border-obsidian-700">
                    <span className="text-xs text-obsidian-500 block mb-1">Revenue Generated</span>
                    <span className="text-xl font-bold text-gold-400">${prospectingMetrics.revenueGenerated.toLocaleString()}</span>
                  </div>
                  <div className="p-4 rounded-xl bg-obsidian-800/50 border border-obsidian-700">
                    <span className="text-xs text-obsidian-500 block mb-1">Cost Per Lead</span>
                    <span className="text-xl font-bold text-obsidian-100">${prospectingMetrics.costPerLead.toFixed(2)}</span>
                  </div>
                  <div className="p-4 rounded-xl bg-obsidian-800/50 border border-obsidian-700">
                    <span className="text-xs text-obsidian-500 block mb-1">ROI</span>
                    <span className="text-xl font-bold text-teal-400">
                      {((prospectingMetrics.revenueGenerated / (prospectingMetrics.totalLeads * prospectingMetrics.costPerLead)) * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquareText size={16} className="text-amber" />
                    Best Performing Pitch
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={pitchData} layout="vertical" margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                        <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#8c8d96', fontSize: 11 }} />
                        <YAxis dataKey="variant" type="category" axisLine={false} tickLine={false} tick={{ fill: '#8c8d96', fontSize: 10 }} width={100} />
                        <Tooltip
                          contentStyle={{ background: '#1a1a20', border: '1px solid #333340', borderRadius: '8px', color: '#f0f0f1', fontSize: 13 }}
                          formatter={(value: number, name: string) => [value.toLocaleString(), name === 'responses' ? 'Responses' : 'Sent']}
                        />
                        <Legend
                          wrapperStyle={{ fontSize: 11, color: '#8c8d96' }}
                          formatter={(value: string) => <span className="text-obsidian-400">{value === 'responses' ? 'Responses' : 'Sent'}</span>}
                        />
                        <Bar dataKey="sent" fill="#404050" radius={[0, 4, 4, 0]} name="sent" animationBegin={300} animationDuration={800} />
                        <Bar dataKey="responses" fill="#F59E0B" radius={[0, 4, 4, 0]} name="responses" animationBegin={500} animationDuration={800} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar size={16} className="text-amber" />
                    Best Time to Send
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto scrollbar-thin">
                    <div className="min-w-[600px]">
                      <div className="flex mb-1">
                        <div className="w-10 shrink-0" />
                        {Array.from({ length: 24 }, (_, h) => (
                          <div key={h} className="flex-1 text-[8px] text-obsidian-500 text-center">
                            {h === 0 ? '12a' : h === 12 ? '12p' : h > 12 ? `${h - 12}p` : `${h}a`}
                          </div>
                        ))}
                      </div>
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                        <div key={day} className="flex items-center mb-[1px]">
                          <div className="w-10 shrink-0 text-[9px] text-obsidian-500">{day}</div>
                          {Array.from({ length: 24 }, (_, h) => {
                            const val = bestTimeData[day]?.[h] || 0;
                            const maxVal = 32;
                            const opacity = 0.1 + (val / maxVal) * 0.9;
                            return (
                              <div
                                key={h}
                                className="flex-1 aspect-square rounded-sm"
                                style={{ backgroundColor: '#F59E0B', opacity }}
                                title={`${day} ${h}:00 — ${val}%`}
                              />
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3 justify-end">
                    <span className="text-[10px] text-obsidian-500">Low</span>
                    <div className="flex gap-[1px]">
                      {[0.1, 0.3, 0.5, 0.7, 0.9].map((o) => (
                        <span key={o} className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#F59E0B', opacity: o }} />
                      ))}
                    </div>
                    <span className="text-[10px] text-obsidian-500">High</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign size={16} className="text-amber" />
                  Revenue Over Time
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={revenueOverTime} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="date"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#8c8d96', fontSize: 10 }}
                        interval={Math.max(1, Math.floor(days / 8))}
                        tickFormatter={(v) => v?.slice(5) || ''}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#8c8d96', fontSize: 11 }}
                        tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                      />
                      <Tooltip
                        contentStyle={{ background: '#1a1a20', border: '1px solid #333340', borderRadius: '8px', color: '#f0f0f1', fontSize: 13 }}
                        formatter={(value: number) => [`$${value.toLocaleString()}`, 'Revenue']}
                      />
                      <Area type="monotone" dataKey="revenue" stroke="#F59E0B" fill="url(#revenueGradient)" strokeWidth={2} animationBegin={300} animationDuration={1000} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </>
      )}
    </motion.div>
  );
}
