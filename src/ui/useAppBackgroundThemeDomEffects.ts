import { useEffect } from 'react';
import type { AppBackgroundThemeId } from '../types/domain';
import { normalizeAppBackgroundThemeId } from '../config/theme/appBackgroundThemes';

export function useAppBackgroundThemeDomEffects(themeId: AppBackgroundThemeId | undefined) {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.dataset.polarisAppBg = normalizeAppBackgroundThemeId(themeId);
  }, [themeId]);
}
