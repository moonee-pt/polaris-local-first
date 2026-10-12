import { describe, expect, it } from 'vitest';
import {
  DEFAULT_APP_BACKGROUND_STRENGTH,
  buildAppBackgroundStyle,
  normalizeAppBackgroundCustomColor,
  normalizeAppBackgroundStrength,
  normalizeAppBackgroundThemeId
} from './appBackgroundThemes';

type StyleVars = Record<string, string>;

describe('normalizeAppBackgroundThemeId', () => {
  it('keeps known ids and falls back to pink', () => {
    expect(normalizeAppBackgroundThemeId('custom')).toBe('custom');
    expect(normalizeAppBackgroundThemeId('claude')).toBe('claude');
    expect(normalizeAppBackgroundThemeId('nope')).toBe('pink');
    expect(normalizeAppBackgroundThemeId(undefined)).toBe('pink');
  });
});

describe('normalizeAppBackgroundStrength', () => {
  it('clamps to the allowed range and defaults when missing', () => {
    expect(normalizeAppBackgroundStrength(0.05)).toBe(0.3);
    expect(normalizeAppBackgroundStrength(9)).toBe(1);
    expect(normalizeAppBackgroundStrength(undefined)).toBe(DEFAULT_APP_BACKGROUND_STRENGTH);
  });
});

describe('normalizeAppBackgroundCustomColor', () => {
  it('expands short hex and rejects junk', () => {
    expect(normalizeAppBackgroundCustomColor('#ABC')).toBe('#aabbcc');
    expect(normalizeAppBackgroundCustomColor('nope')).toBe('#f6b9c9');
  });
});

describe('buildAppBackgroundStyle', () => {
  it('defines the shell wash and card variables', () => {
    const style = buildAppBackgroundStyle('pink', 0.7, null) as unknown as StyleVars;
    expect(style['--bg']).toBe(style['--cool-bg']);
    expect(style['--bg']).toBe(style['--warm-bg']);
    expect(style['--bg']).toContain('linear-gradient(180deg');
    expect(style['--card-bg']).toContain('linear-gradient(140deg');
  });

  it('scales the wash alpha with strength', () => {
    const strong = buildAppBackgroundStyle('pink', 1, null) as unknown as StyleVars;
    const light = buildAppBackgroundStyle('pink', 0.3, null) as unknown as StyleVars;
    expect(strong['--bg']).toContain('0.62)');
    expect(light['--bg']).toContain('0.186)');
  });

  it('reads the custom color when the custom theme is active', () => {
    const style = buildAppBackgroundStyle('custom', 1, '#4488cc') as unknown as StyleVars;
    expect(style['--bg']).toContain('68, 136, 204');
  });
});
