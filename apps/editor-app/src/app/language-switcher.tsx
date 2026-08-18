import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils.js';

const LANGUAGES = [
  { code: 'it', label: 'IT' },
  { code: 'en', label: 'EN' },
] as const;

export function LanguageSwitcher() {
  const { i18n } = useTranslation();

  return (
    <div className="flex items-center gap-1 text-xs">
      {LANGUAGES.map(({ code, label }) => (
        <button
          key={code}
          type="button"
          onClick={() => void i18n.changeLanguage(code)}
          aria-pressed={i18n.language === code}
          className={cn(
            'rounded px-1.5 py-0.5 font-medium',
            i18n.language === code
              ? 'bg-muted text-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
