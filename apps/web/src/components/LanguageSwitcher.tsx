import { LOCALES, type LocaleCode } from '@vedic/i18n';
import { useI18n } from '../i18n';

/** Language picker. Each option is written in its own script so people can find theirs. */
export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();
  return (
    <label className="lang-switch">
      <span className="sr-only">{t('app.language')}</span>
      <span aria-hidden>🌐</span>
      <select value={locale} onChange={(e) => setLocale(e.target.value as LocaleCode)} aria-label={t('app.language')}>
        {LOCALES.map((l) => (
          <option key={l.code} value={l.code} lang={l.tag}>{l.native}{l.code !== 'en' ? ` · ${l.english}` : ''}</option>
        ))}
      </select>
    </label>
  );
}
