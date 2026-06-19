'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Bot, User, Smartphone, Monitor } from 'lucide-react';

type Message = {
  id: string;
  role: 'user' | 'ai';
  text: string;
};

const demoResponses: { pattern: RegExp | 'default'; text: string }[] = [
  { pattern: /hello|hi|hey|bonjour|salam|marhaba/i, text: 'Hello! Welcome to ChatAi.ma. I can help you with website chat, WhatsApp, or prospecting. What would you like to know?' },
  { pattern: /price|cost|pricing|how much|plan/i, text: 'We offer a single plan at 999 MAD/month that includes all three channels—Website widget, WhatsApp, and Prospecting. No hidden fees. Want to start a free trial?' },
  { pattern: /feature|what can you|capabilities|how does/i, text: 'I can answer customer questions on your website, handle WhatsApp inquiries automatically, and run AI-powered prospecting campaigns. One brain, trained once, deployed everywhere.' },
  { pattern: /demo|show|see how|example/i, text: 'Sure! Try typing something like "pricing" or "how does it work" and I will show you how the same response appears across both channels simultaneously.' },
  { pattern: /darija|arabic|french|language/i, text: 'Yes! I automatically detect Darija, Arabic, French, and English. You can train me in any language and I will respond in the same language.' },
  { pattern: 'default', text: 'Great question! I can help you get started with ChatAi.ma in under 1 hour. Would you like to see a demo or learn more about pricing?' },
];

function getResponse(input: string): string {
  for (const r of demoResponses) {
    if (r.pattern !== 'default' && r.pattern.test(input)) {
      return r.text;
    }
  }
  return demoResponses[demoResponses.length - 1].text;
}

function ChatBubble({ message, variant }: { message: Message; variant: 'website' | 'whatsapp' }) {
  const isUser = message.role === 'user';
  const isWhatsApp = variant === 'whatsapp';

  const bubbleClasses = isUser
    ? isWhatsApp
      ? 'bg-[#dcf8c6] text-gray-800 self-end rounded-br-sm'
      : 'bg-teal-600 text-white self-end rounded-br-sm'
    : isWhatsApp
      ? 'bg-white text-gray-800 self-start rounded-bl-sm'
      : 'bg-obsidian-700 text-obsidian-100 self-start rounded-bl-sm';

  return (
    <motion.div
      className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${bubbleClasses}`}
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.25 }}
    >
      {message.text}
    </motion.div>
  );
}

function ChatPanel({
  variant,
  messages,
  input,
  setInput,
  handleSend,
}: {
  variant: 'website' | 'whatsapp';
  messages: Message[];
  input: string;
  setInput: (v: string) => void;
  handleSend: () => void;
}) {
  const isWhatsApp = variant === 'whatsapp';
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className={`rounded-2xl border border-obsidian-700 overflow-hidden flex flex-col h-[480px] ${isWhatsApp ? '' : ''}`}>
      {/* Header */}
      <div className={`flex items-center gap-3 px-5 py-4 ${isWhatsApp ? 'bg-whatsapp' : 'bg-obsidian-800'}`}>
        <div className={`w-9 h-9 rounded-full flex items-center justify-center ${isWhatsApp ? 'bg-white/20' : 'bg-teal-500/20'}`}>
          {isWhatsApp ? <Smartphone className="w-5 h-5 text-white" /> : <Monitor className="w-5 h-5 text-teal-400" />}
        </div>
        <div>
          <div className="font-semibold text-sm text-white">
            {isWhatsApp ? 'WhatsApp Chat' : 'Website Widget'}
          </div>
          <div className="text-xs text-white/70">Online</div>
        </div>
      </div>

      {/* Messages */}
      <div className={`flex-1 overflow-y-auto p-4 space-y-3 flex flex-col ${isWhatsApp ? 'bg-[#e5ddd5]' : 'bg-obsidian-900'}`}>
        {messages.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-center px-4">
            <div>
              <Bot className={`w-10 h-10 mx-auto mb-3 ${isWhatsApp ? 'text-whatsapp' : 'text-teal-400'}`} />
              <p className={`text-sm ${isWhatsApp ? 'text-gray-500' : 'text-obsidian-500'}`}>
                Type a message to see the same response appear in both channels simultaneously.
              </p>
            </div>
          </div>
        )}
        <AnimatePresence>
          {messages.map((msg) => (
            <ChatBubble key={msg.id} message={msg} variant={variant} />
          ))}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className={`flex items-center gap-2 p-3 ${isWhatsApp ? 'bg-obsidian-50' : 'bg-obsidian-800'}`}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
          placeholder={isWhatsApp ? 'Type a message...' : 'Ask me anything...'}
          className={`flex-1 px-4 py-2.5 rounded-full text-sm outline-none ${
            isWhatsApp
              ? 'bg-white text-gray-800 placeholder-gray-400 border-0'
              : 'bg-obsidian-700 text-white placeholder-obsidian-400 border border-obsidian-600'
          }`}
        />
        <button
          onClick={handleSend}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
            isWhatsApp ? 'bg-whatsapp hover:bg-whatsapp-dark text-white' : 'bg-teal-600 hover:bg-teal-500 text-white'
          }`}
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default function LiveDemo() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isResponding, setIsResponding] = useState(false);
  const idCounter = useRef(0);

  const handleSend = () => {
    const text = input.trim();
    if (!text || isResponding) return;
    setInput('');

    const userMsg: Message = { id: String(++idCounter.current), role: 'user', text };
    setMessages((prev) => [...prev, userMsg]);
    setIsResponding(true);

    setTimeout(() => {
      const aiMsg: Message = {
        id: String(++idCounter.current),
        role: 'ai',
        text: getResponse(text),
      };
      setMessages((prev) => [...prev, aiMsg]);
      setIsResponding(false);
    }, 800);
  };

  return (
    <section id="demo" className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <motion.h2
          className="text-3xl md:text-4xl font-bold text-center mb-4"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          See It In{' '}
          <span className="gradient-gold bg-clip-text text-transparent">Action</span>
        </motion.h2>
        <motion.p
          className="text-center text-obsidian-400 mb-12 max-w-xl mx-auto"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          Type a message once. Watch the same intelligent response appear on both channels.
        </motion.p>
        <div className="grid md:grid-cols-2 gap-8">
          <ChatPanel variant="website" messages={messages} input={input} setInput={setInput} handleSend={handleSend} />
          <ChatPanel variant="whatsapp" messages={messages} input={input} setInput={setInput} handleSend={handleSend} />
        </div>
        <motion.p
          className="text-center text-xs text-obsidian-500 mt-6"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          This is a simulation. Actual responses will reflect your trained knowledge base.
        </motion.p>
      </div>
    </section>
  );
}
