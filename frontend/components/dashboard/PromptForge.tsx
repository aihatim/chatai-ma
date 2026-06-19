'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  User,
  MessageSquare,
  Beaker,
  Send,
  ChevronDown,
  ChevronRight,
  Wand2,
  Code,
  Quote,
  Building2,
} from 'lucide-react';
import * as Tabs from '@radix-ui/react-tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { fetchApi } from '@/lib/api';

interface Persona {
  id: string;
  name: string;
  description: string;
  icon: typeof User;
  color: string;
}

const personas: Persona[] = [
  { id: 'friendly', name: 'Friendly Expert', description: 'Warm, knowledgeable, approachable', icon: User, color: 'text-teal-400' },
  { id: 'consultant', name: 'Professional Consultant', description: 'Formal, data-driven, authoritative', icon: Building2, color: 'text-whatsapp' },
  { id: 'witty', name: 'Witty Companion', description: 'Humorous, playful, memorable', icon: Sparkles, color: 'text-amber' },
  { id: 'darija', name: 'Darija-Native', description: 'Moroccan dialect, culturally aware', icon: MessageSquare, color: 'text-gold-400' },
  { id: 'qualifier', name: 'Lead Qualifier', description: 'Goal-oriented, BANT-focused', icon: Wand2, color: 'text-teal-400' },
];

const variables = [
  { label: 'CONTEXT', icon: Code, value: '[CONTEXT]' },
  { label: 'USER_QUERY', icon: Quote, value: '[USER_QUERY]' },
  { label: 'COMPANY_TONE', icon: Building2, value: '[COMPANY_TONE]' },
];

export default function PromptForge() {
  const [expanded, setExpanded] = useState(true);
  const [selectedPersona, setSelectedPersona] = useState<string | null>(null);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [websitePrompt, setWebsitePrompt] = useState('');
  const [whatsappPrompt, setWhatsappPrompt] = useState('');
  const [promptA, setPromptA] = useState('');
  const [promptB, setPromptB] = useState('');
  const [abTestResult, setAbTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [tab, setTab] = useState('website');

  const insertVar = (val: string, setter: (v: string) => void, current: string) => {
    setter(current + val);
  };

  const runTest = async () => {
    setTesting(true);
    setAbTestResult(null);
    try {
      const res = await fetchApi<{ response: string }>('/api/v1/prompts/test', {
        method: 'POST',
        body: JSON.stringify({ promptA, promptB }),
      });
      setAbTestResult(res.response);
    } catch (e) {
      setAbTestResult(`Test completed (simulated). Prompt A: "${promptA.slice(0, 30)}..." / Prompt B: "${promptB.slice(0, 30)}..."`);
    }
    setTesting(false);
  };

  return (
    <Card animate>
      <CardHeader>
        <button onClick={() => setExpanded(!expanded)} className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <Sparkles size={20} className="text-gold-400" />
            <CardTitle>Prompt Forge</CardTitle>
          </div>
          {expanded ? <ChevronDown size={18} className="text-obsidian-400" /> : <ChevronRight size={18} className="text-obsidian-400" />}
        </button>
      </CardHeader>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <CardContent className="space-y-6">
              {/* Persona Selection */}
              <div>
                <h4 className="text-sm font-semibold text-obsidian-300 mb-3">Persona Selection</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  {personas.map((p) => {
                    const active = selectedPersona === p.id;
                    return (
                      <motion.button
                        key={p.id}
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setSelectedPersona(p.id)}
                        className={cn(
                          'p-4 rounded-xl border text-left transition-all',
                          active
                            ? 'border-gold-400 bg-gold-500/10 shadow-lg shadow-gold-500/10'
                            : 'border-obsidian-700 bg-obsidian-800/30 hover:border-obsidian-500'
                        )}
                      >
                        <div className={cn('mb-2', active ? p.color : 'text-obsidian-400')}>
                          <p.icon size={24} />
                        </div>
                        <p className={cn('text-sm font-medium', active ? 'text-obsidian-100' : 'text-obsidian-300')}>{p.name}</p>
                        <p className="text-[10px] text-obsidian-500 mt-1">{p.description}</p>
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Instruction Builder */}
              <div>
                <h4 className="text-sm font-semibold text-obsidian-300 mb-3">Instruction Builder</h4>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    {variables.map((v) => (
                      <button
                        key={v.label}
                        onClick={() => insertVar(v.value, setSystemPrompt, systemPrompt)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-obsidian-800 border border-obsidian-700 text-obsidian-300 hover:border-gold-500/50 hover:text-gold-400 transition-all"
                      >
                        <v.icon size={12} />
                        {v.label}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    placeholder="Enter your system prompt here. Use variable buttons above to insert dynamic content..."
                    rows={5}
                    className="w-full bg-obsidian-800/50 border border-obsidian-700 rounded-xl p-4 text-sm text-obsidian-200 placeholder:text-obsidian-500 resize-none focus:outline-none focus:border-gold-500/50 transition-colors"
                  />
                </div>
              </div>

              {/* Channel-Specific Customization */}
              <div>
                <h4 className="text-sm font-semibold text-obsidian-300 mb-3">Channel-Specific Customization</h4>
                <Tabs.Root value={tab} onValueChange={setTab} className="w-full">
                  <Tabs.List className="flex gap-1 p-1 bg-obsidian-800/50 rounded-xl border border-obsidian-700 w-fit mb-4">
                    <Tabs.Trigger
                      value="website"
                      className={cn(
                        'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                        tab === 'website' ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30' : 'text-obsidian-400 hover:text-obsidian-200'
                      )}
                    >
                      Website Tone
                    </Tabs.Trigger>
                    <Tabs.Trigger
                      value="whatsapp"
                      className={cn(
                        'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                        tab === 'whatsapp' ? 'bg-whatsapp/20 text-whatsapp border border-whatsapp/30' : 'text-obsidian-400 hover:text-obsidian-200'
                      )}
                    >
                      WhatsApp Tone
                    </Tabs.Trigger>
                  </Tabs.List>
                  <Tabs.Content value="website">
                    <textarea
                      value={websitePrompt}
                      onChange={(e) => setWebsitePrompt(e.target.value)}
                      placeholder="Website-specific prompt adjustments..."
                      rows={4}
                      className="w-full bg-obsidian-800/50 border border-obsidian-700 rounded-xl p-4 text-sm text-obsidian-200 placeholder:text-obsidian-500 resize-none focus:outline-none focus:border-teal-500/50 transition-colors"
                    />
                  </Tabs.Content>
                  <Tabs.Content value="whatsapp">
                    <textarea
                      value={whatsappPrompt}
                      onChange={(e) => setWhatsappPrompt(e.target.value)}
                      placeholder="WhatsApp-specific prompt adjustments (shorter, more conversational)..."
                      rows={4}
                      className="w-full bg-obsidian-800/50 border border-obsidian-700 rounded-xl p-4 text-sm text-obsidian-200 placeholder:text-obsidian-500 resize-none focus:outline-none focus:border-whatsapp/50 transition-colors"
                    />
                  </Tabs.Content>
                </Tabs.Root>
              </div>

              {/* A/B Testing */}
              <div>
                <h4 className="text-sm font-semibold text-obsidian-300 mb-3">Prompt A/B Testing</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs text-obsidian-500 font-medium">Prompt Variant A</label>
                    <textarea
                      value={promptA}
                      onChange={(e) => setPromptA(e.target.value)}
                      placeholder="Enter prompt variant A..."
                      rows={4}
                      className="w-full bg-obsidian-800/50 border border-obsidian-700 rounded-xl p-4 text-sm text-obsidian-200 placeholder:text-obsidian-500 resize-none focus:outline-none focus:border-amber/50 transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-obsidian-500 font-medium">Prompt Variant B</label>
                    <textarea
                      value={promptB}
                      onChange={(e) => setPromptB(e.target.value)}
                      placeholder="Enter prompt variant B..."
                      rows={4}
                      className="w-full bg-obsidian-800/50 border border-obsidian-700 rounded-xl p-4 text-sm text-obsidian-200 placeholder:text-obsidian-500 resize-none focus:outline-none focus:border-amber/50 transition-colors"
                    />
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <Button variant="gold" size="sm" onClick={runTest} loading={testing}>
                    <Beaker size={14} />
                    Test
                  </Button>
                  {abTestResult && (
                    <motion.p
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="text-xs text-obsidian-400 flex-1"
                    >
                      {abTestResult}
                    </motion.p>
                  )}
                </div>
              </div>
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
