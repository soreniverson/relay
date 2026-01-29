import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Project {
  id: string;
  name: string;
  region: string;
  role?: string;
}

interface User {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  projects?: Project[];
}

interface AuthState {
  user: User | null;
  token: string | null;
  currentProject: Project | null;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setCurrentProject: (project: Project | null) => void;
  login: (user: User, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      currentProject: null,
      setUser: (user) => set({ user }),
      setToken: (token) => set({ token }),
      setCurrentProject: (currentProject) => set({ currentProject }),
      login: (user, token) => {
        const currentProject = user.projects?.[0] || null;
        set({ user, token, currentProject });
      },
      logout: () => {
        set({ user: null, token: null, currentProject: null });
        if (typeof window !== 'undefined') {
          localStorage.removeItem('relay_token');
          window.location.href = '/auth/login';
        }
      },
    }),
    {
      name: 'relay-auth',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        currentProject: state.currentProject,
      }),
    }
  )
);
