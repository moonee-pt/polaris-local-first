import { describe, expect, it } from 'vitest';
import {
  extractOptionBarBlock,
  normalizeOptionBarMarkup,
  parseRichCardBlock,
  parseRichDetailsBlock,
  parseRichOptionsBlock,
  renderRichInlineContent
} from './messageRichMarkup';

describe('messageRichMarkup', () => {
  it('parses details blocks', () => {
    expect(parseRichDetailsBlock('<details open><summary>点开看</summary>里面是正文</details>')).toEqual({
      open: true,
      summary: '点开看',
      body: '里面是正文'
    });
  });

  it('parses polaris cards', () => {
    expect(parseRichCardBlock('<polaris-card title="今晚" kicker="夜色" tone="rose">慢一点说话</polaris-card>')).toEqual({
      title: '今晚',
      kicker: '夜色',
      tone: 'rose',
      body: '慢一点说话'
    });
  });

  it('unwraps option markup that came back as code', () => {
    const fenced = ['开始吗？', '', '```html', '<polaris-options><option>先聊天气</option></polaris-options>', '```'].join('\n');
    expect(normalizeOptionBarMarkup(fenced)).not.toContain('```');
    expect(normalizeOptionBarMarkup(fenced)).toContain('\n<polaris-options>');

    const inlined = '开始吗？`<polaris-options><option>先聊天气</option></polaris-options>`';
    expect(normalizeOptionBarMarkup(inlined)).not.toContain('`');

    const sameLine = '开始吗？<polaris-options><option>先聊天气</option></polaris-options>好';
    expect(normalizeOptionBarMarkup(sameLine)).toContain('\n\n<polaris-options>');
    expect(normalizeOptionBarMarkup(sameLine)).toContain('</polaris-options>\n\n好');
  });

  it('reads an option block whose closing tag has not arrived yet', () => {
    expect(parseRichOptionsBlock('<polaris-options><option>先聊天气</option>')).toEqual({
      options: ['先聊天气']
    });
  });

  it('pulls the option list out of a whole reply', () => {
    const reply = [
      '想从哪边开始？',
      '',
      '```html',
      '<polaris-options><option>先聊天气</option><option>先聊心情</option></polaris-options>',
      '```',
      '',
      '挑一个就行。'
    ].join('\n');

    expect(extractOptionBarBlock(reply)).toEqual({ options: ['先聊天气', '先聊心情'] });
    expect(extractOptionBarBlock('这条回复没有选项')).toBeNull();
  });

  it('parses option bars and trims blank or overflowing rows', () => {
    expect(parseRichOptionsBlock('<polaris-options><option>先聊天气</option><option> 先聊心情 </option></polaris-options>')).toEqual({
      options: ['先聊天气', '先聊心情']
    });
    expect(parseRichOptionsBlock('<polaris-options></polaris-options>')).toBeNull();
    const overflow = Array.from({ length: 9 }, (_, index) => `<option>o${index}</option>`).join('');
    expect(parseRichOptionsBlock(`<polaris-options>${overflow}</polaris-options>`)?.options).toHaveLength(6);
  });

  it('keeps supported span markup as styled react nodes', () => {
    const nodes = renderRichInlineContent('留一点 <span style="color: #c48; font-weight: 700;">玫瑰色</span> 在这里');
    expect(nodes).toHaveLength(3);
    expect(nodes[1]).toMatchObject({
      props: {
        style: {
          color: '#c48',
          fontWeight: '700'
        }
      }
    });
  });

  it('renders markdown strikethrough into del nodes', () => {
    const nodes = renderRichInlineContent('这里有 ~~删掉的话~~ 留着');
    expect(nodes).toHaveLength(3);
    expect(nodes[1]).toMatchObject({
      type: 'del',
      props: {
        className: 'message-markdown-strikethrough',
        children: '删掉的话'
      }
    });
  });
});
