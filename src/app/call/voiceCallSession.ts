import { create } from 'zustand';

type VoiceCallSessionState = {
  active: boolean;
  open: () => void;
  close: () => void;
};

export const useVoiceCallSession = create<VoiceCallSessionState>((set) => ({
  active: false,
  open: () => set({ active: true }),
  close: () => set({ active: false })
}));
