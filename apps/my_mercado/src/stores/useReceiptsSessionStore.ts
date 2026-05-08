import { create } from "zustand";

type ReceiptsSessionState = {
  sessionUserId: string | null;
  error: unknown;
  setSessionUserId: (userId: string | null) => void;
  setError: (error: unknown) => void;
  clearError: () => void;
};

export const useReceiptsSessionStore = create<ReceiptsSessionState>((set) => ({
  sessionUserId: null,
  error: null,

  setSessionUserId: (userId) => set({ sessionUserId: userId }),

  setError: (error) => set({ error }),

  clearError: () => set({ error: null }),
}));
