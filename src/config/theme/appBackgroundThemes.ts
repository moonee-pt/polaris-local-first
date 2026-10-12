import type { AppBackgroundThemeId } from '../../types/domain';
import type { I18nKey } from '../../i18n/messages';

export const DEFAULT_APP_BACKGROUND_THEME_ID: AppBackgroundThemeId = 'pink';

export const APP_BACKGROUND_THEME_IDS = [
  'pink',
  'claude',
  'lotus',
  'sage',
  'mistBlue',
  'mistPurple',
  'apricot',
  'mistTeal',
  'roseBeige'
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

export function normalizeAppBackgroundThemeId(value: unknown): AppBackgroundThemeId {
  return typeof value === 'string' && (APP_BACKGROUND_THEME_IDS as readonly string[]).includes(value)
    ? (value as AppBackgroundThemeId)
    : DEFAULT_APP_BACKGROUND_THEME_ID;
}
