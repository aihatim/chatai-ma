'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as Dialog from '@radix-ui/react-dialog';
import * as Slider from '@radix-ui/react-slider';
import * as Switch from '@radix-ui/react-switch';
import * as Select from '@radix-ui/react-select';
import {
  Rocket,
  X,
  ChevronLeft,
  ChevronRight,
  Users,
  Settings2,
  PenLine,
  ShieldAlert,
  Send,
  Target,
  Building2,
  Briefcase,
  MapPin,
  Hash,
  Clock,
  Calendar,
  CheckCircle2,
  Sparkles,
  Loader2,
  Plus,
  Trash2,
  Phone,
  MessageCircle,
  Check,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { fetchApi } from '@/lib/api';

interface CampaignData {
  audience: {
    industry: string;
    companySize: string;
    jobTitle: string;
    geography: string;
    keywords: string;
  };
  rules: {
    maxContacts: number;
    startTime: string;
    endTime: string;
    weekendEnabled: boolean;
    noResponseAfter: number;
  };
  pitch: {
    variants: string[];
    selectedVariant: number | null;
    customTone: string;
  };
  objections: { objection: string; response: string }[];
}

const steps = [
  { id: 'audience', label: 'Define Audience', icon: Users },
  { id: 'rules', label: 'Set Rules', icon: Settings2 },
  { id: 'pitch', label: 'Design Pitch', icon: PenLine },
  { id: 'objections', label: 'Objection Handlers', icon: ShieldAlert },
  { id: 'launch', label: 'Launch', icon: Send },
];

const industries = ['Technology', 'Healthcare', 'Finance', 'Education', 'E-commerce', 'Real Estate', 'Manufacturing', 'Consulting'];
const companySizes = ['1-10', '11-50', '51-200', '201-1000', '1000+'];
const jobTitles = ['CEO', 'CTO', 'VP of Sales', 'Head of Marketing', 'Founder', 'Director', 'Manager'];

const defaultObjections = [
  { objection: 'Not interested', response: 'I understand. Would you be open to a brief overview of how we\'ve helped similar companies in your industry?' },
  { objection: 'Too expensive', response: 'Our solutions are designed to scale with your budget. Many clients see ROI within the first month.' },
  { objection: 'Already using a competitor', response: 'That\'s great! We offer unique features like multi-language support and chameleon mode that sets us apart.' },
  { objection: 'Not the right time', response: 'When would be a better time to reconnect? I\'d love to share some success metrics from our recent campaigns.' },
];

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 300 : -300, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -300 : 300, opacity: 0 }),
};

export default function CampaignWizard() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [consent, setConsent] = useState(false);

  const [data, setData] = useState<CampaignData>({
    audience: { industry: '', companySize: '', jobTitle: '', geography: '', keywords: '' },
    rules: { maxContacts: 50, startTime: '09:00', endTime: '18:00', weekendEnabled: false, noResponseAfter: 72 },
    pitch: { variants: [], selectedVariant: null, customTone: '' },
    objections: defaultObjections.map((o) => ({ ...o })),
  });

  const updateAudience = (key: keyof CampaignData['audience'], value: string) =>
    setData((p) => ({ ...p, audience: { ...p.audience, [key]: value } }));

  const updateRules = (key: keyof CampaignData['rules'], value: number | boolean | string) =>
    setData((p) => ({ ...p, rules: { ...p.rules, [key]: value } }));

  const generateVariants = async () => {
    setGenerating(true);
    try {
      const res = await fetchApi<{ variants: string[] }>('/api/v1/prospecting/campaigns/0/opening-messages', {
        method: 'POST',
        body: JSON.stringify({ audience: data.audience }),
      });
      setData((p) => ({ ...p, pitch: { ...p.pitch, variants: res.variants, selectedVariant: null } }));
    } catch {
      setData((p) => ({
        ...p,
        pitch: {
          ...p.pitch,
          variants: [
            'Hi {{name}}, I noticed {{company}} is growing fast. Would you be open to exploring how we can help?',
            'Hey {{name}}, love what {{company}} is doing! We\'ve helped similar teams achieve 3x engagement.',
            'Hello {{name}}, quick question — how are you currently handling customer conversations?',
            'Hi {{name}}, I have an idea that could save {{company}} 10+ hours/week on prospecting.',
            'Hey {{name}}, your profile caught my eye. We\'re helping {{industry}} companies like yours scale outreach.',
          ],
          selectedVariant: null,
        },
      }));
    }
    setGenerating(false);
  };

  const addObjection = () =>
    setData((p) => ({ ...p, objections: [...p.objections, { objection: '', response: '' }] }));

  const updateObjection = (index: number, key: 'objection' | 'response', value: string) =>
    setData((p) => {
      const updated = [...p.objections];
      updated[index] = { ...updated[index], [key]: value };
      return { ...p, objections: updated };
    });

  const removeObjection = (index: number) =>
    setData((p) => ({ ...p, objections: p.objections.filter((_, i) => i !== index) }));

  const nextStep = () => {
    setDirection(1);
    if (step < 4) setStep(step + 1);
  };

  const prevStep = () => {
    setDirection(-1);
    if (step > 0) setStep(step - 1);
  };

  const launchCampaign = async () => {
    setLaunching(true);
    try {
      await fetchApi('/api/v1/prospecting/campaigns', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      setTimeout(() => {
        setOpen(false);
        setStep(0);
        setLaunching(false);
      }, 1500);
    } catch {
      setLaunching(false);
    }
  };

  const Step_Icon = steps[step].icon;

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button variant="gold" size="lg">
          <Rocket size={18} />
          New Campaign
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[95vw] max-w-5xl max-h-[90vh] overflow-hidden bg-obsidian-900 border border-obsidian-800 rounded-2xl shadow-2xl">
          <div className="flex items-center justify-between p-6 pb-0">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gold-500/10">
                <Step_Icon size={18} className="text-gold-400" />
              </div>
              <div>
                <Dialog.Title className="text-lg font-semibold text-obsidian-100">
                  {steps[step].label}
                </Dialog.Title>
                <p className="text-xs text-obsidian-500">Step {step + 1} of 5</p>
              </div>
            </div>
            <Dialog.Close className="text-obsidian-500 hover:text-obsidian-300 transition-colors">
              <X size={20} />
            </Dialog.Close>
          </div>

          {/* Progress bar */}
          <div className="px-6 mt-4">
            <div className="flex gap-1">
              {steps.map((s, i) => (
                <div
                  key={s.id}
                  className={cn(
                    'h-1 flex-1 rounded-full transition-all',
                    i <= step ? 'bg-gold-400' : 'bg-obsidian-700'
                  )}
                />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
            <div className="lg:col-span-2">
              <div className="relative overflow-hidden min-h-[350px]">
                <AnimatePresence mode="wait" custom={direction}>
                  <motion.div
                    key={step}
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="space-y-4"
                  >
                    {/* Step 1: Audience */}
                    {step === 0 && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-xs text-obsidian-400 font-medium flex items-center gap-1.5">
                              <Building2 size={12} /> Industry
                            </label>
                            <select
                              value={data.audience.industry}
                              onChange={(e) => updateAudience('industry', e.target.value)}
                              className="w-full bg-obsidian-800/50 border border-obsidian-700 rounded-xl px-4 py-2.5 text-sm text-obsidian-200 focus:outline-none focus:border-gold-500/50"
                            >
                              <option value="">Select industry</option>
                              {industries.map((ind) => <option key={ind} value={ind}>{ind}</option>)}
                            </select>
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs text-obsidian-400 font-medium flex items-center gap-1.5">
                              <Briefcase size={12} /> Company Size
                            </label>
                            <select
                              value={data.audience.companySize}
                              onChange={(e) => updateAudience('companySize', e.target.value)}
                              className="w-full bg-obsidian-800/50 border border-obsidian-700 rounded-xl px-4 py-2.5 text-sm text-obsidian-200 focus:outline-none focus:border-gold-500/50"
                            >
                              <option value="">Select size</option>
                              {companySizes.map((s) => <option key={s} value={s}>{s} employees</option>)}
                            </select>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-xs text-obsidian-400 font-medium flex items-center gap-1.5">
                              <Users size={12} /> Job Title
                            </label>
                            <select
                              value={data.audience.jobTitle}
                              onChange={(e) => updateAudience('jobTitle', e.target.value)}
                              className="w-full bg-obsidian-800/50 border border-obsidian-700 rounded-xl px-4 py-2.5 text-sm text-obsidian-200 focus:outline-none focus:border-gold-500/50"
                            >
                              <option value="">Select title</option>
                              {jobTitles.map((t) => <option key={t} value={t}>{t}</option>)}
                            </select>
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs text-obsidian-400 font-medium flex items-center gap-1.5">
                              <MapPin size={12} /> Geography
                            </label>
                            <input
                              type="text"
                              value={data.audience.geography}
                              onChange={(e) => updateAudience('geography', e.target.value)}
                              placeholder="e.g. United States, Europe"
                              className="w-full bg-obsidian-800/50 border border-obsidian-700 rounded-xl px-4 py-2.5 text-sm text-obsidian-200 placeholder:text-obsidian-500 focus:outline-none focus:border-gold-500/50"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs text-obsidian-400 font-medium flex items-center gap-1.5">
                            <Hash size={12} /> Keywords
                          </label>
                          <input
                            type="text"
                            value={data.audience.keywords}
                            onChange={(e) => updateAudience('keywords', e.target.value)}
                            placeholder="e.g. AI, SaaS, B2B, lead generation"
                            className="w-full bg-obsidian-800/50 border border-obsidian-700 rounded-xl px-4 py-2.5 text-sm text-obsidian-200 placeholder:text-obsidian-500 focus:outline-none focus:border-gold-500/50"
                          />
                        </div>
                      </div>
                    )}

                    {/* Step 2: Rules */}
                    {step === 1 && (
                      <div className="space-y-6">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <label className="text-xs text-obsidian-400 font-medium">Max contacts/day: <span className="text-gold-400 font-bold">{data.rules.maxContacts}</span></label>
                          </div>
                          <Slider.Root
                            value={[data.rules.maxContacts]}
                            onValueChange={([v]) => updateRules('maxContacts', v)}
                            min={10}
                            max={200}
                            step={5}
                            className="relative flex items-center w-full h-5"
                          >
                            <Slider.Track className="relative h-1.5 flex-1 rounded-full bg-obsidian-700">
                              <Slider.Range className="absolute h-full rounded-full bg-gold-400" />
                            </Slider.Track>
                            <Slider.Thumb className="block w-5 h-5 rounded-full bg-gold-400 shadow-lg shadow-gold-500/30 focus:outline-none focus:ring-2 focus:ring-gold-400" />
                          </Slider.Root>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-xs text-obsidian-400 font-medium flex items-center gap-1.5">
                              <Clock size={12} /> Start Time
                            </label>
                            <input
                              type="time"
                              value={data.rules.startTime}
                              onChange={(e) => updateRules('startTime', e.target.value)}
                              className="w-full bg-obsidian-800/50 border border-obsidian-700 rounded-xl px-4 py-2.5 text-sm text-obsidian-200 focus:outline-none focus:border-gold-500/50"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs text-obsidian-400 font-medium flex items-center gap-1.5">
                              <Clock size={12} /> End Time
                            </label>
                            <input
                              type="time"
                              value={data.rules.endTime}
                              onChange={(e) => updateRules('endTime', e.target.value)}
                              className="w-full bg-obsidian-800/50 border border-obsidian-700 rounded-xl px-4 py-2.5 text-sm text-obsidian-200 focus:outline-none focus:border-gold-500/50"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <label className="text-xs text-obsidian-400 font-medium flex items-center gap-1.5">
                            <Calendar size={12} /> Weekend Outreach
                          </label>
                          <Switch.Root
                            checked={data.rules.weekendEnabled}
                            onCheckedChange={(v) => updateRules('weekendEnabled', v)}
                            className={cn(
                              'w-11 h-6 rounded-full transition-colors relative',
                              data.rules.weekendEnabled ? 'bg-gold-500' : 'bg-obsidian-700'
                            )}
                          >
                            <Switch.Thumb className="block w-5 h-5 bg-white rounded-full shadow-sm transition-transform translate-x-0.5 data-[state=checked]:translate-x-[22px]" />
                          </Switch.Root>
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs text-obsidian-400 font-medium">No-response after (hours): <span className="text-gold-400 font-bold">{data.rules.noResponseAfter}h</span></label>
                          <Slider.Root
                            value={[data.rules.noResponseAfter]}
                            onValueChange={([v]) => updateRules('noResponseAfter', v)}
                            min={12}
                            max={168}
                            step={12}
                            className="relative flex items-center w-full h-5"
                          >
                            <Slider.Track className="relative h-1.5 flex-1 rounded-full bg-obsidian-700">
                              <Slider.Range className="absolute h-full rounded-full bg-amber" />
                            </Slider.Track>
                            <Slider.Thumb className="block w-5 h-5 rounded-full bg-amber shadow-lg shadow-amber/30 focus:outline-none focus:ring-2 focus:ring-amber" />
                          </Slider.Root>
                        </div>
                      </div>
                    )}

                    {/* Step 3: Pitch */}
                    {step === 2 && (
                      <div className="space-y-4">
                        <Button variant="secondary" size="sm" onClick={generateVariants} loading={generating}>
                          <Sparkles size={14} />
                          Generate Opening Messages
                        </Button>

                        {data.pitch.variants.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs text-obsidian-500">Select a variant:</p>
                            {data.pitch.variants.map((v, i) => (
                              <button
                                key={i}
                                onClick={() => setData((p) => ({ ...p, pitch: { ...p.pitch, selectedVariant: i } }))}
                                className={cn(
                                  'w-full text-left p-3 rounded-xl border text-sm transition-all',
                                  data.pitch.selectedVariant === i
                                    ? 'border-gold-500/50 bg-gold-500/10 text-obsidian-200'
                                    : 'border-obsidian-700 bg-obsidian-800/30 text-obsidian-400 hover:border-obsidian-500'
                                )}
                              >
                                <div className="flex items-start gap-2">
                                  <span className={cn(
                                    'w-5 h-5 rounded-full border flex items-center justify-center text-[10px] mt-0.5 shrink-0',
                                    data.pitch.selectedVariant === i
                                      ? 'border-gold-400 bg-gold-400 text-obsidian-950'
                                      : 'border-obsidian-500 text-obsidian-500'
                                  )}>
                                    {data.pitch.selectedVariant === i ? <Check size={10} /> : i + 1}
                                  </span>
                                  <span>{v}</span>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}

                        <div className="space-y-2">
                          <label className="text-xs text-obsidian-400 font-medium">Custom Tone</label>
                          <textarea
                            value={data.pitch.customTone}
                            onChange={(e) => setData((p) => ({ ...p, pitch: { ...p.pitch, customTone: e.target.value } }))}
                            placeholder="e.g. friendly, professional, urgent..."
                            rows={2}
                            className="w-full bg-obsidian-800/50 border border-obsidian-700 rounded-xl p-3 text-sm text-obsidian-200 placeholder:text-obsidian-500 resize-none focus:outline-none focus:border-gold-500/50"
                          />
                        </div>
                      </div>
                    )}

                    {/* Step 4: Objections */}
                    {step === 3 && (
                      <div className="space-y-3">
                        <p className="text-xs text-obsidian-500">Configure responses to common objections:</p>
                        {data.objections.map((obj, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-3 bg-obsidian-800/30 rounded-xl border border-obsidian-700/50 space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-obsidian-500 font-medium">Objection {i + 1}</span>
                              {i >= defaultObjections.length && (
                                <button onClick={() => removeObjection(i)} className="text-obsidian-500 hover:text-red-400 transition-colors">
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                            <input
                              type="text"
                              value={obj.objection}
                              onChange={(e) => updateObjection(i, 'objection', e.target.value)}
                              placeholder="Objection..."
                              className="w-full bg-obsidian-800 border border-obsidian-700 rounded-lg px-3 py-2 text-xs text-obsidian-200 placeholder:text-obsidian-500 focus:outline-none focus:border-gold-500/50"
                            />
                            <textarea
                              value={obj.response}
                              onChange={(e) => updateObjection(i, 'response', e.target.value)}
                              placeholder="Response..."
                              rows={2}
                              className="w-full bg-obsidian-800 border border-obsidian-700 rounded-lg px-3 py-2 text-xs text-obsidian-200 placeholder:text-obsidian-500 resize-none focus:outline-none focus:border-gold-500/50"
                            />
                          </motion.div>
                        ))}
                        <Button variant="ghost" size="sm" onClick={addObjection}>
                          <Plus size={14} /> Add Custom Objection
                        </Button>
                      </div>
                    )}

                    {/* Step 5: Launch */}
                    {step === 4 && (
                      <div className="space-y-4">
                        <div className="space-y-3">
                          <h5 className="text-sm font-medium text-obsidian-200">Campaign Summary</h5>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 bg-obsidian-800/30 rounded-xl border border-obsidian-700/50">
                              <p className="text-[10px] text-obsidian-500 uppercase tracking-wider">Audience</p>
                              <p className="text-xs text-obsidian-200 mt-1">{data.audience.industry || 'Any industry'} • {data.audience.companySize || 'Any size'}</p>
                              <p className="text-xs text-obsidian-400">{data.audience.geography || 'Global'}</p>
                            </div>
                            <div className="p-3 bg-obsidian-800/30 rounded-xl border border-obsidian-700/50">
                              <p className="text-[10px] text-obsidian-500 uppercase tracking-wider">Rules</p>
                              <p className="text-xs text-obsidian-200 mt-1">{data.rules.maxContacts} contacts/day</p>
                              <p className="text-xs text-obsidian-400">{data.rules.startTime} - {data.rules.endTime}{data.rules.weekendEnabled ? ' • weekends' : ''}</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 bg-obsidian-800/30 rounded-xl border border-obsidian-700/50">
                              <p className="text-[10px] text-obsidian-500 uppercase tracking-wider">Pitch</p>
                              <p className="text-xs text-obsidian-200 mt-1 truncate">
                                {data.pitch.selectedVariant !== null
                                  ? data.pitch.variants[data.pitch.selectedVariant]?.slice(0, 60) + '...'
                                  : 'Not selected'}
                              </p>
                            </div>
                            <div className="p-3 bg-obsidian-800/30 rounded-xl border border-obsidian-700/50">
                              <p className="text-[10px] text-obsidian-500 uppercase tracking-wider">Objections</p>
                              <p className="text-xs text-obsidian-200 mt-1">{data.objections.length} handlers configured</p>
                            </div>
                          </div>
                        </div>

                        <label className="flex items-start gap-3 p-4 bg-obsidian-800/30 rounded-xl border border-obsidian-700/50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={consent}
                            onChange={(e) => setConsent(e.target.checked)}
                            className="mt-0.5 accent-gold-400"
                          />
                          <span className="text-xs text-obsidian-400 leading-relaxed">
                            I confirm these contacts have consented to being contacted. I understand that ChatAi.ma is not responsible for compliance with applicable laws and regulations regarding outreach.
                          </span>
                        </label>

                        <Button
                          variant="gold"
                          size="lg"
                          className="w-full relative overflow-hidden"
                          disabled={!consent}
                          onClick={launchCampaign}
                          loading={launching}
                        >
                          {launching ? (
                            <>
                              <Loader2 size={18} className="animate-spin" />
                              Launching...
                            </>
                          ) : (
                            <>
                              <Rocket size={18} />
                              Launch Campaign
                            </>
                          )}
                          {!launching && (
                            <motion.div
                              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                              animate={{ x: ['100%', '-100%'] }}
                              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                            />
                          )}
                        </Button>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-obsidian-800">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={prevStep}
                  disabled={step === 0}
                >
                  <ChevronLeft size={16} />
                  Back
                </Button>
                <div className="flex items-center gap-1.5">
                  {steps.map((_, i) => (
                    <div key={i} className={cn('w-1.5 h-1.5 rounded-full', i === step ? 'bg-gold-400' : 'bg-obsidian-600')} />
                  ))}
                </div>
                {step < 4 ? (
                  <Button variant="gold" size="sm" onClick={nextStep}>
                    Next
                    <ChevronRight size={16} />
                  </Button>
                ) : (
                  <div />
                )}
              </div>
            </div>

            {/* Live preview */}
            <div className="hidden lg:block">
              <Card className="bg-obsidian-950/50 border-obsidian-700 sticky top-0">
                <CardContent className="p-4">
                  <h4 className="text-xs font-semibold text-obsidian-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <MessageCircle size={12} />
                    WhatsApp Preview
                  </h4>
                  <div className="bg-[#075e54] rounded-t-xl p-3 flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-[#128c7e] flex items-center justify-center text-white text-[10px] font-bold">C</div>
                    <div className="text-white text-xs font-medium">ChatAi Prospecting</div>
                  </div>
                  <div className="bg-[#ece5dd] p-3 space-y-2 min-h-[200px]">
                    <div className="flex justify-start">
                      <div className="bg-white rounded-lg rounded-bl-none p-2.5 max-w-[85%] shadow-sm">
                        <p className="text-xs text-[#111b21] leading-relaxed">
                          {data.pitch.selectedVariant !== null && data.pitch.variants[data.pitch.selectedVariant]
                            ? data.pitch.variants[data.pitch.selectedVariant].replace('{{name}}', 'Prospect').replace('{{company}}', 'Acme Inc').replace('{{industry}}', data.audience.industry || 'your')
                            : step >= 2
                              ? 'Select or generate an opening message to preview...'
                              : 'Configure your campaign settings to see a live preview...'}
                        </p>
                        <span className="text-[9px] text-gray-400 float-right mt-1">12:00</span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-[#f0f0f0] rounded-b-xl p-2 flex items-center gap-2">
                    <div className="flex-1 bg-white rounded-lg px-3 py-2 text-xs text-gray-400">
                      {data.pitch.customTone || 'Type a message...'}
                    </div>
                    <button className="w-8 h-8 rounded-full bg-[#128c7e] flex items-center justify-center">
                      <Send size={12} className="text-white" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
