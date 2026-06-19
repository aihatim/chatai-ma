import { create } from 'zustand';

export type Channel = 'website' | 'whatsapp' | 'prospecting' | 'all';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: 'free' | 'starter' | 'growth' | 'enterprise';
}

export interface Workspace {
  id: string;
  name: string;
  organizationId: string;
}

interface AppState {
  currentWorkspace: Workspace | null;
  currentChannel: Channel;
  user: User | null;
  organization: Organization | null;
  sidebarCollapsed: boolean;
  setChannel: (channel: Channel) => void;
  setWorkspace: (workspace: Workspace) => void;
  setUser: (user: User | null, organization?: Organization | null) => void;
  toggleSidebar: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentWorkspace: null,
  currentChannel: 'all',
  user: null,
  organization: null,
  sidebarCollapsed: false,
  setChannel: (channel) => set({ currentChannel: channel }),
  setWorkspace: (workspace) => set({ currentWorkspace: workspace }),
  setUser: (user, organization = null) => set({ user, organization }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
}));
