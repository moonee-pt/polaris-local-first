import type { ChatOutputMode } from '../../types/domain';
import { CHAT_MODE_INSTRUCTION } from './chatModePrompt';
import { NOVEL_MODE_INSTRUCTION } from './novelModePrompt';
import { VOICE_SCRIPT_MODE_INSTRUCTION } from './voiceScriptModePrompt';

export { CHAT_MODE_INSTRUCTION } from './chatModePrompt';
export { NOVEL_MODE_INSTRUCTION } from './novelModePrompt';
export { VOICE_SCRIPT_MODE_INSTRUCTION } from './voiceScriptModePrompt';

export const DEFAULT_CHAT_OUTPUT_MODE: ChatOutputMode = 'chat';

export function resolveChatOutputMode(mode: ChatOutputMode | null | undefined): ChatOutputMode {
  return mode === 'novel' || mode === 'voice' ? mode : DEFAULT_CHAT_OUTPUT_MODE;
}

export function buildOutputModeInstruction(mode: ChatOutputMode | null | undefined): string {
  switch (resolveChatOutputMode(mode)) {
    case 'novel':
      return NOVEL_MODE_INSTRUCTION;
    case 'voice':
      return VOICE_SCRIPT_MODE_INSTRUCTION;
    default:
      return CHAT_MODE_INSTRUCTION;
  }
}

/** Novel/voice modes define their own delivery, so the generic speech-cue layer is skipped. */
export function outputModeSuppressesSpeechCue(mode: ChatOutputMode | null | undefined): boolean {
  const resolved = resolveChatOutputMode(mode);
  return resolved === 'novel' || resolved === 'voice';
}
