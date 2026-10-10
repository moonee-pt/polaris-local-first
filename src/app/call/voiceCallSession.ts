import { create } from 'zustand';
import { primeCallAudio } from './callAudio';

type VoiceCallSessionState = {
  active: boolean;
  open: () => void;
  close: () => void;
};

export const useVoiceCallSession = create<VoiceCallSessionState>((set) => ({
  active: false,
  // Runs inside the tap that opens the call, which is the only moment a browser
  // lets us unlock the shared audio element.
  open: () => {
    primeCallAudio();
    set({ active: true });
  },
  close: () => set({ active: false })
}));
