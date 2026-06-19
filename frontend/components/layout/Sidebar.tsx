'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Globe,
  MessageCircle,
  Target,
  BarChart3,
  BookOpen,
  Settings,
  Users,
  CreditCard,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/lib/store';

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard', channel: 'all' },
  { label: 'Website', icon: Globe, href: '/website', channel: 'website' },
  { label: 'WhatsApp', icon: MessageCircle, href: '/whatsapp', channel: 'whatsapp' },
  { label: 'Prospecting', icon: Target, href: '/prospecting', channel: 'prospecting' },
  { label: 'Analytics', icon: BarChart3, href: '/analytics', channel: 'all' },
  { label: 'Knowledge Base', icon: BookOpen, href: '/knowledge-base', channel: 'all' },
  { label: 'Settings', icon: Settings, href: '/settings', channel: 'all' },
  { label: 'Team', icon: Users, href: '/team', channel: 'all' },
  { label: 'Billing', icon: CreditCard, href: '/billing', channel: 'all' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar } = useAppStore();

  const locale = pathname.split('/')[1];
  const isActive = (href: string) => pathname.includes(href);

  return (
    <motion.aside
      layout
      className={cn(
        'fixed left-0 top-0 h-full bg-obsidian-900 border-r border-obsidian-800 z-40 flex flex-col',
        sidebarCollapsed ? 'w-16' : 'w-60'
      )}
      animate={{ width: sidebarCollapsed ? 64 : 240 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
    >
      <div className="flex items-center h-16 px-4 border-b border-obsidian-800">
        <AnimatePresence mode="wait">
          {sidebarCollapsed ? (
            <motion.span
              key="logo-icon"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-gold-400 font-bold text-xl mx-auto"
            >
              C
            </motion.span>
          ) : (
            <motion.span
              key="logo-full"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-gold-400 font-bold text-xl"
            >
              ChatAi.ma
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <nav className="flex-1 py-4 overflow-y-auto scrollbar-thin">
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={`/${locale}${item.href}`}
              className={cn(
                'relative flex items-center gap-3 px-4 py-3 text-sm transition-colors',
                active
                  ? 'text-gold-400 bg-gold-500/5'
                  : 'text-obsidian-400 hover:text-obsidian-200 hover:bg-obsidian-800/50'
              )}
            >
              {active && (
                <motion.div
                  layoutId="sidebar-indicator"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-gold-400 rounded-r-full"
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              )}
              <item.icon className="shrink-0" size={20} />
              <AnimatePresence mode="wait">
                {!sidebarCollapsed && (
                  <motion.span
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.15 }}
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          );
        })}
      </nav>

      <button
        onClick={toggleSidebar}
        className="flex items-center justify-center h-12 border-t border-obsidian-800 text-obsidian-500 hover:text-obsidian-300 hover:bg-obsidian-800/50 transition-colors"
      >
        {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
      </button>
    </motion.aside>
  );
}
