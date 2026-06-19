'use client';

import { useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import {
  Check,
  X,
  CreditCard,
  FileText,
  TrendingUp,
  Globe,
  MessageCircle,
  Target,
  ExternalLink,
  BarChart3,
  Gauge,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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

interface PlanTier {
  id: string;
  name: string;
  price: string;
  description: string;
  features: string[];
  channels: { website: boolean; whatsapp: boolean; prospecting: boolean };
  highlighted?: boolean;
  ctaLabel: string;
  ctaVariant: 'default' | 'gold' | 'secondary' | 'outline';
  usage?: { whatsapp: number; prospecting: number };
}

const plans: PlanTier[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: '$29/mo',
    description: 'Perfect for small businesses getting started with AI',
    features: [
      '1 Website Widget',
      '1 Knowledge Base',
      '2 Team members',
      'Basic analytics',
      'Email support',
    ],
    ctaLabel: 'Current Plan',
    ctaVariant: 'secondary',
    channels: { website: true, whatsapp: false, prospecting: false },
    usage: { whatsapp: 500, prospecting: 200 },
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$149/mo',
    description: 'For growing teams that need more power',
    features: [
      '3 Website Widgets',
      '3 Knowledge Bases',
      '10 Team members',
      'Advanced analytics',
      'Custom branding',
      'Priority support',
    ],
    highlighted: true,
    ctaLabel: 'Upgrade',
    ctaVariant: 'gold',
    channels: { website: true, whatsapp: true, prospecting: true },
    usage: { whatsapp: 2000, prospecting: 1000 },
  },
  {
    id: 'business',
    name: 'Business',
    price: '$499/mo',
    description: 'For organizations with high-volume needs',
    features: [
      '10 Website Widgets',
      '10 Knowledge Bases',
      'Unlimited team members',
      'Advanced analytics + exports',
      'White-label',
      'Dedicated account manager',
      'API access',
      'Custom integrations',
    ],
    ctaLabel: 'Upgrade',
    ctaVariant: 'default',
    channels: { website: true, whatsapp: true, prospecting: true },
    usage: { whatsapp: 10000, prospecting: 5000 },
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    description: 'For large enterprises with custom requirements',
    features: [
      'Everything in Business',
      'Custom limits',
      'SLA guarantee',
      'On-premise option',
      'Dedicated infrastructure',
      '24/7 phone support',
      'Custom AI model fine-tuning',
      'Dedicated success manager',
    ],
    ctaLabel: 'Contact Sales',
    ctaVariant: 'outline',
    channels: { website: true, whatsapp: true, prospecting: true },
    usage: { whatsapp: 99999, prospecting: 99999 },
  },
];

const invoices = [
  { id: 'INV-001', date: 'Jun 1, 2026', amount: '$149.00', status: 'Paid', pdf: '#' },
  { id: 'INV-002', date: 'May 1, 2026', amount: '$149.00', status: 'Paid', pdf: '#' },
  { id: 'INV-003', date: 'Apr 1, 2026', amount: '$149.00', status: 'Paid', pdf: '#' },
  { id: 'INV-004', date: 'Mar 1, 2026', amount: '$149.00', status: 'Paid', pdf: '#' },
  { id: 'INV-005', date: 'Feb 1, 2026', amount: '$149.00', status: 'Paid', pdf: '#' },
  { id: 'INV-006', date: 'Jan 1, 2026', amount: '$49.00', status: 'Paid', pdf: '#' },
  { id: 'INV-007', date: 'Dec 1, 2025', amount: '$49.00', status: 'Paid', pdf: '#' },
  { id: 'INV-008', date: 'Nov 1, 2025', amount: '$49.00', status: 'Paid', pdf: '#' },
  { id: 'INV-009', date: 'Oct 1, 2025', amount: '$49.00', status: 'Paid', pdf: '#' },
  { id: 'INV-010', date: 'Sep 1, 2025', amount: '$49.00', status: 'Paid', pdf: '#' },
  { id: 'INV-011', date: 'Aug 1, 2025', amount: '$49.00', status: 'Paid', pdf: '#' },
  { id: 'INV-012', date: 'Jul 1, 2025', amount: '$49.00', status: 'Paid', pdf: '#' },
];

const channelUsage = [
  { channel: 'Website', icon: Globe, color: 'text-teal-400', bgColor: 'bg-teal-500/10', conversations: 847, limit: '—', percent: null },
  { channel: 'WhatsApp', icon: MessageCircle, color: 'text-whatsapp', bgColor: 'bg-whatsapp/10', conversations: 1234, limit: 2000, percent: 62 },
  { channel: 'Prospecting', icon: Target, color: 'text-amber', bgColor: 'bg-amber/10', conversations: 456, limit: 1000, percent: 46 },
];

export default function BillingPage() {
  const t = useTranslations('billing');
  const [currentPlan, setCurrentPlan] = useState('pro');

  const currentPlanData = plans.find((p) => p.id === currentPlan)!;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-obsidian-100">{t('plan')}</h1>
          <p className="text-sm text-obsidian-500 mt-1">Manage your subscription and billing</p>
        </div>
        <Button variant="outline" onClick={() => window.open('/api/v1/billing/portal', '_blank')}>
          <CreditCard size={16} />
          Payment Methods
          <ExternalLink size={14} className="text-obsidian-500" />
        </Button>
      </motion.div>

      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Current Plan — {currentPlanData.name}</CardTitle>
            <CardDescription>{currentPlanData.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2 mb-6">
              <span className="text-3xl font-bold text-obsidian-100">{currentPlanData.price}</span>
              <span className="text-sm text-obsidian-500">billed monthly</span>
            </div>
            <div className="space-y-4">
              {channelUsage.map((ch) => (
                <div key={ch.channel}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-lg ${ch.bgColor}`}>
                        <ch.icon size={14} className={ch.color} />
                      </div>
                      <span className="text-sm text-obsidian-200">{ch.channel}</span>
                    </div>
                    <span className="text-xs text-obsidian-400">
                      {ch.conversations.toLocaleString()}
                      {ch.limit ? ` / ${ch.limit.toLocaleString()}` : ''} conversations
                    </span>
                  </div>
                  {ch.percent !== null && (
                    <div className="h-2 bg-obsidian-800 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${ch.percent}%` }}
                        transition={{ duration: 1, delay: 0.3 }}
                        className={cn(
                          'h-full rounded-full',
                          ch.percent > 80 ? 'bg-red-500' : ch.percent > 60 ? 'bg-amber' : 'bg-teal-400',
                        )}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Usage Overview</CardTitle>
            <CardDescription>Billing period: Jun 1 – Jun 30</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {channelUsage.map((ch) => (
              <div key={ch.channel} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ch.icon size={14} className={ch.color} />
                  <span className="text-sm text-obsidian-200">{ch.channel}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-medium text-obsidian-100">{ch.conversations.toLocaleString()}</span>
                  {ch.limit && (
                    <span className="text-xs text-obsidian-500 ml-1">/ {ch.limit.toLocaleString()}</span>
                  )}
                </div>
              </div>
            ))}
            <div className="pt-3 border-t border-obsidian-800">
              <div className="flex items-center justify-between">
                <span className="text-sm text-obsidian-200 font-medium">Total</span>
                <span className="text-sm font-bold text-gold-400">{currentPlanData.price}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle>Compare Plans</CardTitle>
            <CardDescription>Choose the plan that fits your needs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {plans.map((plan) => {
                const isCurrent = plan.id === currentPlan;
                return (
                  <motion.div
                    key={plan.id}
                    whileHover={{ scale: 1.02 }}
                    className={cn(
                      'relative rounded-xl border p-6 flex flex-col',
                      plan.highlighted
                        ? 'border-gold-500/50 bg-gold-500/5 shadow-lg shadow-gold-500/10'
                        : 'border-obsidian-700 bg-obsidian-900/50',
                      isCurrent && 'ring-2 ring-gold-400/50',
                    )}
                  >
                    {plan.highlighted && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-gold-500 text-obsidian-950 text-xs font-semibold rounded-full">
                        Most Popular
                      </div>
                    )}
                    {isCurrent && (
                      <div className="absolute top-3 right-3 px-2 py-0.5 bg-teal-500/10 border border-teal-500/30 text-teal-400 text-[10px] font-semibold rounded-full">
                        Current
                      </div>
                    )}
                    <div className="mb-4">
                      <h3 className="text-lg font-semibold text-obsidian-100">{plan.name}</h3>
                      <div className="flex items-baseline gap-1 mt-2">
                        <span className="text-2xl font-bold text-obsidian-100">{plan.price}</span>
                      </div>
                      <p className="text-xs text-obsidian-500 mt-1">{plan.description}</p>
                    </div>
                    <div className="mb-4 px-3 py-2 rounded-lg bg-obsidian-800/50 border border-obsidian-700">
                      <p className="text-[10px] text-obsidian-500 font-medium uppercase tracking-wider mb-2">Channels</p>
                      <div className="space-y-1.5">
                        {([
                          { id: 'website', label: 'Website' },
                          { id: 'whatsapp', label: 'WhatsApp' },
                          { id: 'prospecting', label: 'Prospecting' },
                        ] as const).map((ch) => (
                          <div key={ch.id} className="flex items-center justify-between text-xs">
                            <span className="text-obsidian-400">{ch.label}</span>
                            {plan.channels[ch.id] ? (
                              <Check size={13} className="text-teal-400" />
                            ) : (
                              <X size={13} className="text-obsidian-600" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                    <ul className="space-y-2 flex-1 mb-4">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2 text-xs text-obsidian-300">
                          <Check size={14} className="text-teal-400 shrink-0 mt-0.5" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <Button
                      variant={plan.ctaVariant as any}
                      className="w-full"
                      disabled={isCurrent}
                      onClick={() => {
                        if (plan.id === 'enterprise') {
                          window.open('mailto:sales@chatai.ma', '_blank');
                        } else if (!isCurrent) {
                          window.location.href = `/api/v1/billing/create-checkout?plan=${plan.id}`;
                        }
                      }}
                    >
                      {isCurrent ? 'Current Plan' : plan.ctaLabel}
                    </Button>
                  </motion.div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle>Payment Method</CardTitle>
              <CardDescription>Managed securely via Stripe</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 bg-obsidian-800/50 rounded-xl border border-obsidian-700">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-obsidian-700 rounded-lg">
                    <CreditCard size={20} className="text-obsidian-300" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-obsidian-100">Visa ending in 4242</p>
                    <p className="text-xs text-obsidian-500">Expires 12/2027</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => window.open('/api/v1/billing/portal', '_blank')}>
                  Update
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Invoice History</CardTitle>
                <CardDescription>Last 12 invoices</CardDescription>
              </div>
              <FileText size={16} className="text-obsidian-500" />
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-obsidian-800">
                {invoices.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between px-6 py-3">
                    <div>
                      <span className="text-sm text-obsidian-200">{inv.date}</span>
                      <span className="text-xs text-obsidian-600 ml-2">{inv.id}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-obsidian-100">{inv.amount}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/30">
                        {inv.status}
                      </span>
                      <button className="text-obsidian-500 hover:text-obsidian-300 transition-colors">
                        <ExternalLink size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}
