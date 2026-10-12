import { describe, expect, it } from 'vitest';
import { toolEventCopy, toolStatusLabel } from './chatToolLabels';
import type { ToolInvocation } from '../../../types/domain';

function baseToolInvocation(partial: Partial<ToolInvocation>): ToolInvocation {
  return {
    id: 'tool-1',
    kind: 'patchRawCss',
    status: 'preview',
    title: '创意 CSS 试穿',
    summary: '回复气泡 · .app-shell.chat .bubble.assistant { background: pink; }',
    ...partial
  };
}

describe('chatToolLabels', () => {
  it('describes creative previews without mount jargon', () => {
    expect(toolEventCopy(baseToolInvocation({
      themeScope: 'chat'
    }))).toContain('可应用这版，或取消这次试穿');
  });

  it('describes applied creative previews without old shell language', () => {
    expect(toolEventCopy(baseToolInvocation({
      themeScope: 'app',
      status: 'applied'
    }))).toContain('这一版改动已保留');
  });

  it('uses confirmation wording for persona rewrites instead of theme try-on copy', () => {
    expect(toolEventCopy(baseToolInvocation({
      kind: 'updatePersonaPrompt',
      detailText: undefined,
      summary: '小满 · 想换一版'
    }))).toContain('这版人设还没生效');

    expect(toolEventCopy(baseToolInvocation({
      kind: 'updatePersonaPrompt',
      detailText: undefined,
      status: 'applied'
    }))).toContain('人设已更新');

    expect(toolEventCopy(baseToolInvocation({
      kind: 'updatePersonaPrompt',
      detailText: undefined,
      status: 'rolled_back'
    }))).toContain('这次人设改动已取消');

    expect(toolStatusLabel('preview', undefined, 'updatePersonaPrompt')).toBe('待确认');
    expect(toolStatusLabel('preview', undefined, 'patchRawCss')).toBe('试穿中');
  });
});
