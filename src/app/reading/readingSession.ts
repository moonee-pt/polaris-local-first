import { create } from 'zustand';

type ReadingSessionState = {
  active: boolean;
  open: () => void;
  close: () => void;
};

export const useReadingSession = create<ReadingSessionState>((set) => ({
  active: false,
  open: () => set({ active: true }),
  close: () => set({ active: false })
}));
