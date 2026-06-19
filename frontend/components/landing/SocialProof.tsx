'use client';

import { Star, TrendingUp, MessageCircle, Globe } from 'lucide-react';

const items = [
  {
    text: 'Acme Corp: 85% reduction in support tickets',
    icon: TrendingUp,
    color: 'text-teal-400',
  },
  {
    text: 'TechStore.ma: 45% increase in WhatsApp conversions',
    icon: MessageCircle,
    color: 'text-whatsapp',
  },
  {
    text: 'MegaMart: 60% faster lead qualification with Prospecting AI',
    icon: Star,
    color: 'text-amber',
  },
  {
    text: 'MediClin: 92% patient satisfaction on website chat',
    icon: Globe,
    color: 'text-teal-400',
  },
  {
    text: 'SahaShop: 3x ROI on prospecting campaigns in 30 days',
    icon: TrendingUp,
    color: 'text-amber',
  },
];

export default function SocialProof() {
  return (
    <div className="w-full overflow-hidden py-6">
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .marquee-track {
          animation: marquee 30s linear infinite;
        }
        .marquee-track:hover {
          animation-play-state: paused;
        }
      `}</style>
      <div className="flex marquee-track">
        {[...items, ...items].map((item, i) => (
          <div
            key={i}
            className="flex items-center gap-3 flex-shrink-0 px-8"
          >
            <item.icon className={`w-4 h-4 ${item.color} flex-shrink-0`} />
            <span className="text-sm text-obsidian-400 whitespace-nowrap">{item.text}</span>
            <span className="w-1.5 h-1.5 rounded-full bg-obsidian-600 flex-shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
