import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '@/types';
import api from '@/lib/axios';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
  fetchProfile: () => Promise<void>;
}

interface RegisterData {
  email: string;
  username: string;
  password: string;
  fullName: string;
  role?: string;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: false,

      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const response = await api.post('/auth/login', { email, password });
          const { user, accessToken } = response.data.data;
          localStorage.setItem('accessToken', accessToken);
          
          // Write cookie synchronously before resolving so middleware sees it
          // on the very next navigation request.
          if (typeof document !== 'undefined') {
            const isSecure = location.protocol === 'https:' ? '; Secure' : '';
            document.cookie = `accessToken=${accessToken}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax${isSecure}`;
          }
          
          set({ user, token: accessToken, isLoading: false });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      register: async (data) => {
        set({ isLoading: true });
        try {
          const response = await api.post('/auth/register', data);
          const { user, accessToken } = response.data.data;
          localStorage.setItem('accessToken', accessToken);
          
          // Write cookie synchronously before resolving so middleware sees it
          // on the very next navigation request.
          if (typeof document !== 'undefined') {
            const isSecure = location.protocol === 'https:' ? '; Secure' : '';
            document.cookie = `accessToken=${accessToken}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax${isSecure}`;
          }
          
          set({ user, token: accessToken, isLoading: false });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      logout: () => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('auth-storage'); // Clear Zustand persisted state
        
        // Clear cookie
        if (typeof window !== 'undefined') {
          document.cookie = 'accessToken=; path=/; max-age=0; SameSite=Lax';
        }
        
        set({ user: null, token: null });
      },

      updateUser: (updatedUser) => {
        set((state) => (
          {
            user: state.user ? { ...state.user, ...updatedUser } : null,
          }
        ));
      },

      fetchProfile: async () => {
        try {
          const response = await api.get('/auth/profile');
          set({ user: response.data.data });
        } catch (error) {
          console.error('Failed to fetch profile:', error);
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user, token: state.token }),
    }
  )
);
