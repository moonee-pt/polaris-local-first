import type { WebDavConfig } from '../../../types/domain';
import { useI18n } from '../../../i18n';
import { HelpHint } from '../../HelpHint';
import { Icon } from '../../Icon';
import { MenuSheetItem } from './MenuSheetItem';

type MenuBackupPageProps = {
  webdav: WebDavConfig;
  readyForWebDav: boolean;
  busy: boolean;
  localBackupAvailable: boolean;
  exportingData: boolean;
  importingData: boolean;
  exportingWebDav: boolean;
  importingWebDav: boolean;
  localExportDetail: string;
  localImportDetail: string;
  localExportProgress: number | null;
  localImportProgress: number | null;
  onBack: () => void;
  onSetWebDavEndpoint: (value: string) => void;
  onSetWebDavUsername: (value: string) => void;
  onSetWebDavPassword: (value: string) => void;
  onExportData: () => void;
  onImportData: () => void;
  onExportToWebDav: () => void;
  onImportFromWebDav: () => void;
  exportingCloud: boolean;
  importingCloud: boolean;
  onExportToCloud: () => void;
  onImportFromCloud: () => void;
  cloudLastBackupAt: string;
};

export function MenuBackupPage({
  webdav,
  readyForWebDav,
  busy,
  localBackupAvailable,
  exportingData,
  importingData,
  exportingWebDav,
  importingWebDav,
  localExportDetail,
  localImportDetail,
  localExportProgress,
  localImportProgress,
  onBack,
  onSetWebDavEndpoint,
  onSetWebDavUsername,
  onSetWebDavPassword,
  onExportData,
  onImportData,
  onExportToWebDav,
  onImportFromWebDav,
  exportingCloud,
  importingCloud,
  onExportToCloud,
  onImportFromCloud,
  cloudLastBackupAt
}: MenuBackupPageProps) {
  const { t } = useI18n();

  return (
    <div className="menu-sheet-page">
      <div className="menu-sheet-header">
        <button type="button" className="menu-sheet-back" aria-label={t('settings.pageBack')} onClick={onBack}>
          <span className="menu-sheet-back-icon"><Icon name="chevron" size={26} /></span>
        </button>
        <div className="menu-sheet-title">
          <small>{t('settings.dataSection')}</small>
          <h2>
            {t('settings.backup.title')}
            <HelpHint
              className="help-hint--inline-title"
              label={t('settings.backup.title')}
              text={t('settings.backup.pageHelp')}
            />
          </h2>
          <p>{t('settings.backup.pageDetail')}</p>
        </div>
      </div>

      <section className="menu-section">
        <div className="menu-section-head">
          <span className="menu-section-kicker">{t('settings.backup.localSection')}</span>
          <p className="menu-section-note">
            {localBackupAvailable
              ? t('settings.backup.localAvailableNote')
              : t('settings.backup.localUnavailableNote')}
          </p>
        </div>
        <MenuSheetItem
          icon="copy"
          title={exportingData ? t('settings.backup.exporting') : t('settings.backup.exportCurrent')}
          detail={localExportDetail}
          progress={localExportProgress}
          onClick={onExportData}
          disabled={busy || !localBackupAvailable}
        />
        <MenuSheetItem
          icon="folder"
          title={importingData ? t('settings.backup.importing') : t('settings.backup.importFromPackage')}
          detail={localImportDetail || t('settings.backup.importDetailFallback')}
          progress={localImportProgress}
          onClick={onImportData}
          disabled={busy || !localBackupAvailable}
        />
      </section>

      <section className="menu-section">
        <div className="menu-section-head">
          <span className="menu-section-kicker menu-section-kicker-row">
            WebDAV
            <HelpHint
              label="WebDAV"
              text={t('settings.backup.webdavHelp')}
            />
          </span>
          <p className="menu-section-note">{t('settings.backup.webdavNote')}</p>
        </div>
        <div className="menu-webdav-section">
          <div className="settings-form">
            <label>{t('settings.backup.webdavUrl')}</label>
            <input
              value={webdav.endpoint}
              onChange={(event) => onSetWebDavEndpoint(event.target.value)}
              placeholder="https://dav.jianguoyun.com/dav/Polaris"
            />
            <label>{t('settings.backup.webdavUsername')}</label>
            <input
              value={webdav.username}
              onChange={(event) => onSetWebDavUsername(event.target.value)}
              placeholder={t('settings.backup.webdavUsernamePlaceholder')}
            />
            <label>{t('settings.backup.webdavPassword')}</label>
            <input
              type="password"
              value={webdav.password}
              onChange={(event) => onSetWebDavPassword(event.target.value)}
              placeholder={t('settings.backup.webdavPasswordPlaceholder')}
            />
          </div>
          <div className="provider-inline-actions menu-webdav-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={onExportToWebDav}
              disabled={busy || !readyForWebDav}
            >
              {exportingWebDav ? t('settings.backup.webdavUploading') : t('settings.backup.webdavUpload')}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={onImportFromWebDav}
              disabled={busy || !readyForWebDav}
            >
              {importingWebDav ? t('settings.backup.webdavReading') : t('settings.backup.webdavRestore')}
            </button>
          </div>
          <div className="settings-note">
            {readyForWebDav
              ? t('settings.backup.webdavReadyNote')
              : t('settings.backup.webdavMissingNote')}
          </div>
        </div>
      </section>

      <section className="menu-section">
        <div className="menu-section-head">
          <span className="menu-section-kicker menu-section-kicker-row">
            {t('settings.backup.cloudTitle')}
          </span>
          <p className="menu-section-note">{t('settings.backup.cloudSubtitle')}</p>
        </div>
        <div className="menu-webdav-section">
          <div className="settings-note">
            {t('settings.backup.cloudAutoNote')}
          </div>
          <div className="settings-note settings-note-muted">
            {cloudLastBackupAt
              ? `${t('settings.backup.cloudLastBackup')}: ${new Date(cloudLastBackupAt).toLocaleString()}`
              : t('settings.backup.cloudLastBackupNever')}
          </div>
        </div>
        <div className="provider-inline-actions menu-webdav-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={onExportToCloud}
            disabled={busy || importingCloud}
          >
            {exportingCloud ? t('settings.backup.cloudUploading') : t('settings.backup.cloudUpload')}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={onImportFromCloud}
            disabled={busy || exportingCloud}
          >
            {importingCloud ? t('settings.backup.cloudReading') : t('settings.backup.cloudRestore')}
          </button>
        </div>
      </section>
    </div>
  );
}
