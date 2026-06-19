'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { ChevronDown, LogOut, Building2 } from 'lucide-react';
import Sidebar from '@/components/layout/Sidebar';
import ChannelToggle from '@/components/layout/ChannelToggle';
import { useAppStore } from '@/lib/store';

const pageTransition = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.3, ease: 'easeInOut' },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { sidebarCollapsed, user, organization } = useAppStore();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-obsidian-950">
      <Sidebar />

      <div
        className="transition-all duration-300"
        style={{ marginLeft: sidebarCollapsed ? 64 : 240 }}
      >
        <header className="sticky top-0 z-30 h-16 bg-obsidian-950/80 backdrop-blur-xl border-b border-obsidian-800 flex items-center justify-between px-6">
          <ChannelToggle />

          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-obsidian-800/50 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-gold-500/20 flex items-center justify-center text-gold-400 text-sm font-semibold">
                {user?.name?.charAt(0) || 'U'}
              </div>
              <div className="text-left hidden sm:block">
                <p className="text-sm text-obsidian-100 font-medium leading-tight">
                  {user?.name || 'User'}
                </p>
                <p className="text-xs text-obsidian-500 leading-tight">
                  {organization?.name || 'Workspace'}
                </p>
              </div>
              <ChevronDown size={14} className="text-obsidian-500 hidden sm:block" />
            </button>

            <AnimatePresence>
              {userMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.96 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-2 w-56 bg-obsidian-900 border border-obsidian-800 rounded-xl shadow-xl py-2"
                >
                  <div className="px-4 py-2 border-b border-obsidian-800">
                    <p className="text-sm font-medium text-obsidian-100">{user?.name || 'User'}</p>
                    <p className="text-xs text-obsidian-500">{user?.email || 'user@chatai.ma'}</p>
                  </div>
                  <button className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-obsidian-300 hover:bg-obsidian-800 transition-colors">
                    <Building2 size={16} className="text-obsidian-500" />
                    Switch Organization
                  </button>
                  <button className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-400 hover:bg-obsidian-800 transition-colors">
                    <LogOut size={16} />
                    Sign Out
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </header>

        <main className="p-6">
          <AnimatePresence mode="wait">
            <motion.div key={pathname} {...pageTransition}>
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
