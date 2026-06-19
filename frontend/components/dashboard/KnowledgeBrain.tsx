'use client';

import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  FileText,
  BookOpen,
  Globe,
  MessageCircle,
  Target,
  X,
  Check,
  Plus,
  ChevronDown,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { fetchApi } from '@/lib/api';

interface KnowledgeBase {
  id: string;
  name: string;
  description: string;
  channels: { website: boolean; whatsapp: boolean; prospecting: boolean };
  documentCount: number;
}

interface UploadDoc {
  id: string;
  name: string;
  type: string;
  progress: number;
  status: 'uploading' | 'processing' | 'ready' | 'error';
}

const channelMeta = {
  website: { icon: Globe, color: 'text-teal-400', bg: 'bg-teal-500/10', label: 'Website' },
  whatsapp: { icon: MessageCircle, color: 'text-whatsapp', bg: 'bg-whatsapp/10', label: 'WhatsApp' },
  prospecting: { icon: Target, color: 'text-amber', bg: 'bg-amber/10', label: 'Prospecting' },
} as const;

type ChannelKey = keyof typeof channelMeta;

export default function KnowledgeBrain() {
  const [expanded, setExpanded] = useState(true);
  const [bases, setBases] = useState<KnowledgeBase[]>([
    { id: '1', name: 'Product Catalog', description: 'All product specs and pricing', channels: { website: true, whatsapp: false, prospecting: true }, documentCount: 12 },
    { id: '2', name: 'Support FAQ', description: 'Common customer questions', channels: { website: true, whatsapp: true, prospecting: false }, documentCount: 8 },
    { id: '3', name: 'Sales Playbook', description: 'Prospecting scripts & objection handling', channels: { website: false, whatsapp: false, prospecting: true }, documentCount: 5 },
  ]);
  const [docs, setDocs] = useState<UploadDoc[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files) return;
    const items: UploadDoc[] = Array.from(files).map((f, i) => ({
      id: `doc-${Date.now()}-${i}`,
      name: f.name,
      type: f.name.split('.').pop()?.toUpperCase() || 'FILE',
      progress: 0,
      status: 'uploading' as const,
    }));
    setDocs((p) => [...items, ...p]);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const item = items[i];
      const fd = new FormData();
      fd.append('file', file);
      try {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            setDocs((p) => p.map((d) => (d.id === item.id ? { ...d, progress: pct } : d)));
          }
        };
        await new Promise<void>((resolve, reject) => {
          xhr.onload = () => resolve();
          xhr.onerror = () => reject();
          xhr.open('POST', '/api/v1/knowledge-base/upload');
          const token = localStorage.getItem('auth_token');
          if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
          xhr.send(fd);
        });
        setDocs((p) => p.map((d) => (d.id === item.id ? { ...d, status: 'processing', progress: 100 } : d)));
        setTimeout(() => {
          setDocs((p) => p.map((d) => (d.id === item.id ? { ...d, status: 'ready' } : d)));
        }, 1200);
      } catch {
        setDocs((p) => p.map((d) => (d.id === item.id ? { ...d, status: 'error' } : d)));
      }
    }
  }, []);

  const toggleChannel = async (kbId: string, ch: ChannelKey) => {
    setBases((p) =>
      p.map((kb) =>
        kb.id === kbId ? { ...kb, channels: { ...kb.channels, [ch]: !kb.channels[ch] } } : kb
      )
    );
    try {
      await fetchApi(`/api/v1/knowledge-base/${kbId}/channel`, {
        method: 'PATCH',
        body: JSON.stringify({ channel: ch, enabled: !bases.find((kb) => kb.id === kbId)?.channels[ch] }),
      });
    } catch {
      setBases((p) =>
        p.map((kb) =>
          kb.id === kbId ? { ...kb, channels: { ...kb.channels, [ch]: !kb.channels[ch] } } : kb
        )
      );
    }
  };

  const removeDoc = (id: string) => setDocs((p) => p.filter((d) => d.id !== id));

  return (
    <Card animate>
      <CardHeader>
        <button onClick={() => setExpanded(!expanded)} className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <BookOpen size={20} className="text-gold-400" />
            <CardTitle>Knowledge Brain</CardTitle>
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
              <div>
                <h4 className="text-sm font-semibold text-obsidian-300 mb-3">Multi-Source Ingestion</h4>
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
                  className={cn(
                    'border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer',
                    dragOver ? 'border-gold-400 bg-gold-500/5' : 'border-obsidian-600 hover:border-obsidian-500'
                  )}
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload size={32} className="mx-auto mb-3 text-obsidian-400" />
                  <p className="text-sm text-obsidian-300 mb-1">Drop files here or click to browse</p>
                  <p className="text-xs text-obsidian-500 mb-4">PDF, DOCX, TXT, CSV</p>
                  <input
                    ref={fileRef}
                    type="file"
                    multiple
                    accept=".pdf,.docx,.txt,.csv"
                    onChange={(e) => handleFiles(e.target.files)}
                    className="hidden"
                  />
                  <Button variant="secondary" size="sm" type="button">Browse Files</Button>
                </div>

                <AnimatePresence>
                  {docs.length > 0 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 space-y-2">
                      {docs.map((doc) => (
                        <motion.div
                          key={doc.id}
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, height: 0 }}
                          className="flex items-center gap-3 p-3 bg-obsidian-800/50 rounded-lg"
                        >
                          <FileText size={16} className="text-obsidian-400 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-obsidian-200 truncate">{doc.name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <div className="flex-1 h-1.5 bg-obsidian-700 rounded-full overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${doc.progress}%` }}
                                  className={cn('h-full rounded-full', doc.status === 'error' ? 'bg-red-500' : 'bg-teal-400')}
                                />
                              </div>
                              <span className={cn(
                                'text-[10px] shrink-0',
                                doc.status === 'ready' ? 'text-teal-400' : doc.status === 'error' ? 'text-red-400' : 'text-obsidian-400'
                              )}>
                                {doc.status === 'uploading' ? `${doc.progress}%` : doc.status === 'processing' ? 'Processing...' : doc.status === 'ready' ? 'Ready' : 'Error'}
                              </span>
                            </div>
                          </div>
                          <button onClick={() => removeDoc(doc.id)} className="text-obsidian-500 hover:text-red-400 transition-colors shrink-0">
                            <X size={14} />
                          </button>
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-obsidian-300">Living Context Library</h4>
                  <Button variant="ghost" size="sm"><Plus size={14} /> Add KB</Button>
                </div>
                <div className="space-y-3">
                  {bases.map((kb) => (
                    <motion.div
                      key={kb.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="p-4 bg-obsidian-800/30 rounded-xl border border-obsidian-700/50"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="text-sm font-medium text-obsidian-200">{kb.name}</p>
                          <p className="text-xs text-obsidian-500 mt-0.5">{kb.description}</p>
                          <span className="text-[10px] text-obsidian-500 mt-1 block">{kb.documentCount} documents</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] text-obsidian-500 uppercase tracking-wider mr-1">Channels:</span>
                        {(Object.keys(channelMeta) as ChannelKey[]).map((ch) => {
                          const m = channelMeta[ch];
                          const active = kb.channels[ch];
                          return (
                            <button
                              key={ch}
                              onClick={() => toggleChannel(kb.id, ch)}
                              className={cn(
                                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all',
                                active
                                  ? `${m.color} ${m.bg} border border-current/30`
                                  : 'text-obsidian-500 bg-obsidian-800/50 border border-obsidian-700/50 hover:text-obsidian-300'
                              )}
                            >
                              <m.icon size={12} />
                              {m.label}
                              {active && <Check size={10} className="ml-0.5" />}
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
