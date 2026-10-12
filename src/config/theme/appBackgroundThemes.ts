import type { CSSProperties } from 'react';
import type { AppBackgroundThemeId } from '../../types/domain';
import type { I18nKey } from '../../i18n/messages';

export const DEFAULT_APP_BACKGROUND_THEME_ID: AppBackgroundThemeId = 'pink';
export const DEFAULT_APP_BACKGROUND_STRENGTH = 0.7;
export const APP_BACKGROUND_STRENGTH_MIN = 0.3;
export const APP_BACKGROUND_STRENGTH_MAX = 1;
export const DEFAULT_APP_BACKGROUND_CUSTOM_COLOR = '#f6b9c9';

const PRESET_APP_BACKGROUND_THEME_IDS = [
  'pink',
  'claude',
  'lotus',
  'sage',
  'mistBlue',
  'mistPurple',
  'apricot',
  'mistTeal',
  'roseBeige'
] as const;

export const APP_BACKGROUND_THEME_IDS = [
  ...PRESET_APP_BACKGROUND_THEME_IDS,
  'custom'
] as const satisfies readonly AppBackgroundThemeId[];

export type AppBackgroundThemeOption = {
  id: AppBackgroundThemeId;
  labelKey: I18nKey;
  swatch: string;
};

export const APP_BACKGROUND_THEME_OPTIONS: AppBackgroundThemeOption[] = [
  { id: 'pink', labelKey: 'settings.display.backgroundPink', swatch: '#f6b9c9' },
  { id: 'claude', labelKey: 'settings.display.backgroundClaude', swatch: '#e8e6dc' },
  { id: 'lotus', labelKey: 'settings.display.backgroundLotus', swatch: '#e7cecc' },
  { id: 'sage', labelKey: 'settings.display.backgroundSage', swatch: '#cbd8cc' },
  { id: 'mistBlue', labelKey: 'settings.display.backgroundMistBlue', swatch: '#c6d4de' },
  { id: 'mistPurple', labelKey: 'settings.display.backgroundMistPurple', swatch: '#d6cee2' },
  { id: 'apricot', labelKey: 'settings.display.backgroundApricot', swatch: '#fae0d2' },
  { id: 'mistTeal', labelKey: 'settings.display.backgroundMistTeal', swatch: '#c8d8d6' },
  { id: 'roseBeige', labelKey: 'settings.display.backgroundRoseBeige', swatch: '#e6d4ce' }
];

export function getAppBackgroundThemeSwatch(themeId: string | null | undefined): string {
  return APP_BACKGROUND_THEME_OPTIONS.find((option) => option.id === themeId)?.swatch
    ?? DEFAULT_APP_BACKGROUND_CUSTOM_COLOR;
}

type Rgb = [number, number, number];
type GlowSpec = { rgb: Rgb; alpha: number };
type ThemeSpec = {
  glows: readonly [GlowSpec, GlowSpec, GlowSpec];
  ramp: readonly [string, string, string];
  card: readonly [string, string, string];
};

const GLOW_GEOMETRY = [
  { w: 56, h: 38, x: 16, y: 6 },
  { w: 52, h: 34, x: 84, y: 4 },
  { w: 70, h: 44, x: 62, y: 100 }
] as const;

const PRESET_SPECS: Record<string, ThemeSpec> = {
  pink: {
    glows: [
      { rgb: [252, 214, 228], alpha: 0.62 },
      { rgb: [255, 238, 244], alpha: 0.85 },
      { rgb: [246, 185, 201], alpha: 0.4 }
    ],
    ramp: ['#fffdfe', '#fff8fb', '#fdf1f6'],
    card: ['#ffffff', '#fff9fb', '#fdf2f6']
  },
  claude: {
    glows: [
      { rgb: [232, 230, 220], alpha: 0.62 },
      { rgb: [240, 238, 230], alpha: 0.85 },
      { rgb: [232, 230, 220], alpha: 0.55 }
    ],
    ramp: ['#fdfcf9', '#f8f7f1', '#f5f4ed'],
    card: ['#ffffff', '#faf9f5', '#f2efe6']
  },
  lotus: {
    glows: [
      { rgb: [231, 206, 204], alpha: 0.62 },
      { rgb: [248, 241, 237], alpha: 0.86 },
      { rgb: [219, 186, 184], alpha: 0.38 }
    ],
    ramp: ['#fefcfa', '#faf4f1', '#f4eae6'],
    card: ['#ffffff', '#fdf8f6', '#f8efec']
  },
  sage: {
    glows: [
      { rgb: [203, 216, 204], alpha: 0.6 },
      { rgb: [241, 246, 240], alpha: 0.86 },
      { rgb: [176, 196, 182], alpha: 0.34 }
    ],
    ramp: ['#fbfdfb', '#f4f8f4', '#e9f0ea'],
    card: ['#ffffff', '#f9fcfa', '#eff4f0']
  },
  mistBlue: {
    glows: [
      { rgb: [198, 212, 222], alpha: 0.6 },
      { rgb: [241, 246, 250], alpha: 0.86 },
      { rgb: [170, 190, 206], alpha: 0.34 }
    ],
    ramp: ['#fbfcfd', '#f4f7fa', '#e8eef3'],
    card: ['#ffffff', '#f9fbfd', '#eef3f7']
  },
  mistPurple: {
    glows: [
      { rgb: [214, 206, 226], alpha: 0.6 },
      { rgb: [245, 242, 249], alpha: 0.86 },
      { rgb: [190, 180, 208], alpha: 0.34 }
    ],
    ramp: ['#fcfbfd', '#f7f4fa', '#efeaf5'],
    card: ['#ffffff', '#fbf9fd', '#f3eff8']
  },
  apricot: {
    glows: [
      { rgb: [250, 224, 210], alpha: 0.62 },
      { rgb: [255, 245, 238], alpha: 0.88 },
      { rgb: [240, 196, 176], alpha: 0.3 }
    ],
    ramp: ['#fffdfb', '#fdf5ef', '#fbeae0'],
    card: ['#ffffff', '#fef9f4', '#fbf0e7']
  },
  mistTeal: {
    glows: [
      { rgb: [200, 216, 214], alpha: 0.6 },
      { rgb: [241, 247, 246], alpha: 0.86 },
      { rgb: [172, 194, 192], alpha: 0.34 }
    ],
    ramp: ['#fbfdfc', '#f4f9f8', '#e9f1f0'],
    card: ['#ffffff', '#f9fcfc', '#eef4f4']
  },
  roseBeige: {
    glows: [
      { rgb: [230, 212, 206], alpha: 0.62 },
      { rgb: [240, 232, 214], alpha: 0.58 },
      { rgb: [250, 246, 240], alpha: 0.86 }
    ],
    ramp: ['#fdfbf8', '#f9f3ee', '#f3ebe2'],
    card: ['#ffffff', '#fcf8f3', '#f5efe7']
  }
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function hexToRgb(hex: string): Rgb {
  const normalized = hex.replace('#', '');
  const expanded = normalized.length === 3
    ? normalized.split('').map((char) => char + char).join('')
    : normalized;
  return [
    parseInt(expanded.slice(0, 2), 16),
    parseInt(expanded.slice(2, 4), 16),
    parseInt(expanded.slice(4, 6), 16)
  ];
}

function rgbToHex([r, g, b]: Rgb): string {
  return '#' + [r, g, b].map((channel) => clamp(Math.round(channel), 0, 255).toString(16).padStart(2, '0')).join('');
}

function mixHex(from: string, to: string, amount: number): string {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  const t = clamp(amount, 0, 1);
  return rgbToHex([
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t
  ]);
}

function buildCustomSpec(hex: string): ThemeSpec {
  const rgb = hexToRgb(hex);
  const soft = hexToRgb(mixHex(hex, '#ffffff', 0.55));
  return {
    glows: [
      { rgb, alpha: 0.55 },
      { rgb: soft, alpha: 0.7 },
      { rgb, alpha: 0.32 }
    ],
    ramp: ['#ffffff', mixHex(hex, '#ffffff', 0.93), mixHex(hex, '#ffffff', 0.85)],
    card: ['#ffffff', mixHex(hex, '#ffffff', 0.95), mixHex(hex, '#ffffff', 0.9)]
  };
}

export function normalizeAppBackgroundThemeId(value: unknown): AppBackgroundThemeId {
  return typeof value === 'string' && (APP_BACKGROUND_THEME_IDS as readonly string[]).includes(value)
    ? (value as AppBackgroundThemeId)
    : DEFAULT_APP_BACKGROUND_THEME_ID;
}

export function normalizeAppBackgroundStrength(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? clamp(value, APP_BACKGROUND_STRENGTH_MIN, APP_BACKGROUND_STRENGTH_MAX)
    : DEFAULT_APP_BACKGROUND_STRENGTH;
}

export function normalizeAppBackgroundCustomColor(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_APP_BACKGROUND_CUSTOM_COLOR;
  const trimmed = value.trim().toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(trimmed)) {
    return '#' + trimmed.slice(1).split('').map((char) => char + char).join('');
  }
  return /^#[0-9a-f]{6}$/.test(trimmed) ? trimmed : DEFAULT_APP_BACKGROUND_CUSTOM_COLOR;
}

export function buildAppBackgroundStyle(
  themeId: AppBackgroundThemeId | undefined,
  strength: number | undefined,
  customColor: string | null | undefined
): CSSProperties {
  const normalizedId = normalizeAppBackgroundThemeId(themeId);
  const resolvedStrength = normalizeAppBackgroundStrength(strength);
  const spec = normalizedId === 'custom'
    ? buildCustomSpec(normalizeAppBackgroundCustomColor(customColor))
    : PRESET_SPECS[normalizedId] ?? PRESET_SPECS[DEFAULT_APP_BACKGROUND_THEME_ID];

  const glows = GLOW_GEOMETRY.map((geometry, index) => {
    const glow = spec.glows[index];
    const alpha = Number((glow.alpha * resolvedStrength).toFixed(3));
    const rgb = glow.rgb.join(', ');
    return 'radial-gradient(' + geometry.w + '% ' + geometry.h + '% at ' + geometry.x + '% ' + geometry.y + '%, rgba(' + rgb + ', ' + alpha + ') 0%, rgba(' + rgb + ', 0) 62%)';
  }).join(', ');

  const flatten = (color: string) => mixHex(color, '#ffffff', 1 - resolvedStrength);
  const [rampTop, rampMid, rampEnd] = spec.ramp.map(flatten);
  const [cardTop, cardMid, cardEnd] = spec.card.map(flatten);
  const wash = glows + ', linear-gradient(180deg, ' + rampTop + ' 0%, ' + rampMid + ' 55%, ' + rampEnd + ' 100%)';
  const card = 'linear-gradient(140deg, ' + cardTop + ' 0%, ' + cardMid + ' 60%, ' + cardEnd + ' 100%)';

  return {
    '--bg': wash,
    '--warm-bg': wash,
    '--cool-bg': wash,
    '--chat-bg': wash,
    '--card-bg': card
  } as CSSProperties;
}
