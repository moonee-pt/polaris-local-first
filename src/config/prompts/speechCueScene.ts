import type { ChatMessage, Persona } from '../../types/domain';

/**
 * Recognised delivery/body cue tags. Kept in sync with the speech cue instruction:
 * 【】 lines and these tags are the only reliable sign that a scene is being performed.
 */
const SPEECH_CUE_TAG_PATTERN = /\[(?:break|long-break|angry|sad|embarrassed|emphasis|whispering|soft|breathy|excited|laughing|chuckling|moaning|clear throat|sobbing|crying loudly|sighing|panting|groaning|wetplap|dryplap|wet|stroke|cum|pullout)(?::(?:soft|hard|extreme))?\]/i;

/** How far back the scene scan looks. Older history cannot keep the instruction alive. */
const SPEECH_SCENE_SCAN_LIMIT = 40;

function textShowsSpeechScene(text: string | null | undefined): boolean {
  if (!text) return false;
  if (text.includes('【') || text.includes('】')) return true;
  return SPEECH_CUE_TAG_PATTERN.test(text);
}

function personaShowsSpeechScene(persona: Persona | null | undefined): boolean {
  if (!persona) return false;
  if (persona.relationship === 'roleplay') return true;
  return persona.expression === 'intimate' || persona.expression === 'unbounded';
}

/**
 * The speech cue instruction only pays for itself while a scene is actually being
 * performed: plain questions, code work and small talk never emit spoken lines or
 * delivery cues, so the instruction is withheld there and the tokens stay saved.
 */
export function shouldIncludeSpeechCueInstruction(args: {
  callActive?: boolean;
  persona?: Persona | null;
  messages: ChatMessage[];
}): boolean {
  if (args.callActive) return true;
  if (personaShowsSpeechScene(args.persona)) return true;
  const tail = args.messages.slice(-SPEECH_SCENE_SCAN_LIMIT);
  return tail.some((message) => textShowsSpeechScene(message.content));
}
