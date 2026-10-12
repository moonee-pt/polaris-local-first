import { useEffect } from 'react';
import type { AppBackgroundThemeId, AppDisplayPreferences } from '../types/domain';
import { buildAppBackgroundStyle, normalizeAppBackgroundThemeId } from '../config/theme/appBackgroundThemes';

const MIRRORED_BACKGROUND_VARIABLES = ['--bg', '--warm-bg', '--cool-bg', '--chat-bg', '--card-bg'] as const;

type AppBackgroundPreferences = Pick<
  AppDisplayPreferences,
  'backgroundTheme' | 'backgroundStrength' | 'backgroundCustomColor'
>;

/**
 * Publishes the chosen background two ways:
 * - `data-polaris-app-bg` on <html>, so CSS can target the generated wash;
 * - the wash variables on <html> itself, because full screen sheets (settings, provider,
 *   persona builder, create action) render through a portal on <body>, outside .app-shell,
 *   and would otherwise inherit the flat default wash.
 * Dark mode keeps winning: its rules declare these variables on <html> with !important.
 */
export function useAppBackgroundThemeDomEffects(preferences: AppBackgroundPreferences) {
  const themeId: AppBackgroundThemeId | undefined = preferences.backgroundTheme;
  const strength = preferences.backgroundStrength;
  const customColor = preferences.backgroundCustomColor;

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    const root = document.documentElement;
    root.dataset.polarisAppBg = normalizeAppBackgroundThemeId(themeId);

    const wash = buildAppBackgroundStyle(themeId, strength, customColor) as unknown as Record<string, string>;
    for (const name of MIRRORED_BACKGROUND_VARIABLES) {
      const value = wash[name];
      if (typeof value === 'string' && value) root.style.setProperty(name, value);
    }

    return () => {
      for (const name of MIRRORED_BACKGROUND_VARIABLES) root.style.removeProperty(name);
    };
  }, [themeId, strength, customColor]);
}
