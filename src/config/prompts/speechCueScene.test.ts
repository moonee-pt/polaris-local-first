import { describe, expect, it } from 'vitest';
import { shouldIncludeSpeechCueInstruction } from './speechCueScene';
import type { ChatMessage, Persona } from '../../types/domain';

function message(content: string, role: ChatMessage['role'] = 'user'): ChatMessage {
  return { id: `m-${content.length}-${role}`, role, content, timestamp: 0 };
}

function persona(patch: Partial<Persona>): Persona {
  return patch as unknown as Persona;
}

describe('shouldIncludeSpeechCueInstruction', () => {
  it('stays quiet for plain work and small talk when nothing is performed', () => {
    expect(shouldIncludeSpeechCueInstruction({
      persona: persona({ relationship: 'assistant', expression: 'natural' }),
      messages: [message('帮我改一下这段代码'), message('好的，先把循环拆开', 'assistant')]
    })).toBe(false);
  });

  it('turns on while a voice call is running', () => {
    expect(shouldIncludeSpeechCueInstruction({ callActive: true, messages: [] })).toBe(true);
  });

  it('turns on when the persona is a performance persona', () => {
    expect(shouldIncludeSpeechCueInstruction({
      persona: persona({ relationship: 'roleplay', expression: 'natural' }),
      messages: []
    })).toBe(true);
    expect(shouldIncludeSpeechCueInstruction({
      persona: persona({ relationship: 'companion', expression: 'intimate' }),
      messages: []
    })).toBe(true);
  });

  it('turns on once recent messages carry spoken lines or delivery cues', () => {
    expect(shouldIncludeSpeechCueInstruction({
      persona: persona({ relationship: 'assistant', expression: 'natural' }),
      messages: [message('【我在这里。】\n（轻轻关上门）', 'assistant')]
    })).toBe(true);
    expect(shouldIncludeSpeechCueInstruction({
      persona: persona({ relationship: 'assistant', expression: 'natural' }),
      messages: [message('好，我马上来。[break] 等我一下。', 'assistant')]
    })).toBe(true);
  });

  it('forgets the scene once the cue signals fall out of the scanned tail', () => {
    const history: ChatMessage[] = [message('【只剩这一句。】', 'assistant')];
    for (let i = 0; i < 40; i += 1) history.push(message(`普通消息 ${i}`));
    expect(shouldIncludeSpeechCueInstruction({
      persona: persona({ relationship: 'assistant', expression: 'natural' }),
      messages: history
    })).toBe(false);
  });
});