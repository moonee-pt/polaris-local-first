import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MessageMarkdown } from './MessageMarkdown';

function html(content: string) {
  return renderToStaticMarkup(<MessageMarkdown content={content} />);
}

describe('message performance tags', () => {
  it('shows a readable label instead of the raw English tag', () => {
    const markup = html('别躲。\n\n[panting]\n\n过来。');
    expect(markup).toContain('message-performance-tag');
    expect(markup).toContain('喘息');
    expect(markup).not.toContain('[panting]');
  });

  it('prefers the longer tag when two share a word', () => {
    const markup = html('[long pause] 等我一下');
    expect(markup).toContain('长停顿');
    expect(markup).not.toContain('[long pause]');
  });

  it('labels every body-sound folder one to one', () => {
    expect(html('[dryplap]')).toContain('干拍打');
    expect(html('[wetplap]')).toContain('湿拍打');
    expect(html('[wet]')).toContain('水声');
    expect(html('[stroke]')).toContain('撸动');
    expect(html('[cum]')).toContain('高潮音');
    expect(html('[pullout]')).toContain('退出音');
  });

  it('shows the intensity suffix when present', () => {
    expect(html('[wetplap:hard]')).toContain('湿拍打·重');
    expect(html('[wet:soft]')).toContain('水声·轻');
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
