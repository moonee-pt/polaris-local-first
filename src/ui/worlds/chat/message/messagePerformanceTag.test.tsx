import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MessageMarkdown } from './MessageMarkdown';

function html(content: string) {
  return renderToStaticMarkup(<MessageMarkdown content={content} />);
}

describe('message performance tags', () => {
  it('drops delivery tags from the transcript', () => {
    const markup = html('别躲。\n\n[panting]\n\n过来。');
    expect(markup).not.toContain('message-performance-tag');
    expect(markup).not.toContain('[panting]');
    expect(markup).not.toContain('喘息');
    expect(markup).toContain('别躲。');
    expect(markup).toContain('过来。');
  });

  it('drops the longer tag when two share a word', () => {
    const markup = html('[long pause] 等我一下');
    expect(markup).not.toContain('长停顿');
    expect(markup).not.toContain('[long pause]');
    expect(markup).toContain('等我一下');
  });

  it('drops every body-sound cue', () => {
    for (const tag of ['[dryplap]', '[wetplap]', '[wet]', '[stroke]', '[cum]', '[pullout]']) {
      expect(html(tag)).not.toContain(tag.slice(1, -1));
    }
  });

  it('drops body-sound cues with an intensity suffix', () => {
    expect(html('[wetplap:hard]')).not.toContain('wetplap');
    expect(html('[wet:soft]')).not.toContain('wet');
  });

  it('keeps the stage direction styled when a cue sits inside it', () => {
    const markup = html('（她靠过来[wet]）');
    expect(markup).toContain('message-stage-direction');
    expect(markup).toContain('她靠过来');
    expect(markup).not.toContain('wet');
  });

  it('leaves unknown brackets alone', () => {
    expect(html('[whatever] 就这样')).toContain('[whatever]');
  });

  it('keeps markdown links intact', () => {
    const markup = html('看[这里](https://example.com)');
    expect(markup).toContain('href="https://example.com"');
    expect(markup).not.toContain('message-performance-tag');
  });
});
