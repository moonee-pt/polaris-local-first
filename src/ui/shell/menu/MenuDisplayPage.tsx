import { useMemo } from 'react';
import type { I18nTranslator } from '../../../i18n/translator';
import { useI18n } from '../../../i18n/useI18n';
import type {
  AppAppearancePreference,
  AppBackgroundThemeId,
  AppDisplayPreferences
} from '../../../types/domain';
import {
  APP_BACKGROUND_THEME_OPTIONS,
  DEFAULT_APP_BACKGROUND_THEME_ID
} from '../../../config/theme/appBackgroundThemes';
import { Icon } from '../../Icon';

type MenuDisplayPageProps = {
  displayPreferences: AppDisplayPreferences;
  onBack: () => void;
  onSetAppearance: (appearance: AppAppearancePreference) => void;
  onSetHapticsEnabled: (enabled: boolean) => void;
  onSetBackgroundTheme: (themeId: AppBackgroundThemeId) => void;
};

function getAppearanceOptions(t: I18nTranslator['t']): Array<{
  id: AppAppearancePreference;
  label: string;
  detail: string;
}> {
  return [
    {
      id: 'system',
      label: t('settings.display.appearanceSystem'),
      detail: t('settings.display.appearanceSystemDetail')
    },
    {
      id: 'light',
      label: t('settings.display.appearanceLight'),
      detail: t('settings.display.appearanceLightDetail')
    },
    {
      id: 'dark',
      label: t('settings.display.appearanceDark'),
      detail: t('settings.display.appearanceDarkDetail')
    }
  ];
}

export function MenuDisplayPage({
  displayPreferences,
  onBack,
  onSetAppearance,
  onSetHapticsEnabled,
  onSetBackgroundTheme
}: MenuDisplayPageProps) {
  const { t } = useI18n();
  const appearanceOptions = useMemo(() => getAppearanceOptions(t), [t]);
  const activeBackgroundTheme = displayPreferences.backgroundTheme ?? DEFAULT_APP_BACKGROUND_THEME_ID;

  return (
    <div className="menu-sheet-page menu-display-page">
      <div className="menu-sheet-header">
        <button type="button" className="menu-sheet-back" aria-label={t('settings.pageBack')} onClick={onBack}>
          <span className="menu-sheet-back-icon"><Icon name="chevron" size={26} /></span>
        </button>
        <div className="menu-sheet-title">
          <small>{t('settings.display.section')}</small>
          <h2>{t('settings.display.title')}</h2>
        </div>
      </div>

      <section className="menu-section menu-display-preferences-section">
        <div className="menu-preference-list">
          <div className="menu-preference-row menu-preference-row--appearance">
            <span className="menu-preference-copy">
              <strong>{t('settings.display.appearanceTitle')}</strong>
              <small>{t('settings.display.appearanceDetail')}</small>
            </span>
            <div className="menu-appearance-options" role="group" aria-label={t('settings.display.appearanceTitle')}>
              {appearanceOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`menu-appearance-option ${displayPreferences.appearance === option.id ? 'active' : ''}`}
                  aria-pressed={displayPreferences.appearance === option.id}
                  onClick={() => onSetAppearance(option.id)}
                >
                  <span>{option.label}</span>
                  <small>{option.detail}</small>
                </button>
              ))}
            </div>
          </div>
          <div className="menu-preference-row menu-preference-row--background">
            <span className="menu-preference-copy">
              <strong>{t('settings.display.backgroundTitle')}</strong>
              <small>{t('settings.display.backgroundDetail')}</small>
            </span>
            <div className="menu-background-theme-options" role="group" aria-label={t('settings.display.backgroundTitle')}>
              {APP_BACKGROUND_THEME_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`menu-background-theme-option ${activeBackgroundTheme === option.id ? 'active' : ''}`}
                  aria-pressed={activeBackgroundTheme === option.id}
                  onClick={() => onSetBackgroundTheme(option.id)}
                >
                  <span className="menu-background-theme-swatch" style={{ background: option.swatch }} />
                  <span className="menu-background-theme-label">{t(option.labelKey)}</span>
                </button>
              ))}
            </div>
          </div>
          <label className="menu-preference-row menu-preference-row--switch">
            <span className="menu-preference-copy">
              <strong>{t('settings.display.hapticsTitle')}</strong>
              <small>{displayPreferences.hapticsEnabled ? t('settings.enabled') : t('settings.disabled')}</small>
            </span>
            <input
              type="checkbox"
              checked={displayPreferences.hapticsEnabled}
              onChange={(event) => onSetHapticsEnabled(event.target.checked)}
            />
          </label>
        </div>
      </section>
    </div>
  );
}
