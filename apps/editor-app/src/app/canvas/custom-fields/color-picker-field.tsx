import { useTranslation } from 'react-i18next';
import type { ThemeBaseTokens } from '@brisk/shared-types';

const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;

/**
 * A value that names a theme token instead of freezing a colour
 * (ADR-0050) — `var(--primary)` and friends.
 *
 * Accepted alongside a hex in the text field, and what a theme swatch
 * writes. The whole point of the swatches: a block painted with
 * `var(--primary)` re-tints itself when the site changes theme, exactly
 * as the theme's own CSS does, where `#5b9bd5` stays that blue forever.
 */
const THEME_VAR_PATTERN = /^var\(--[a-z][a-z0-9-]*\)$/;

/**
 * The theme colours offered as swatches, in the order they are shown.
 * Each is dropped when the active theme does not declare it — see
 * `themeBaseTokensSchema`, where all but the first two are optional.
 */
const SWATCH_TOKENS = [
  { key: 'primary', cssVar: '--primary' },
  { key: 'secondary', cssVar: '--secondary' },
  { key: 'background', cssVar: '--background' },
  { key: 'foreground', cssVar: '--foreground' },
  { key: 'muted', cssVar: '--muted' },
  { key: 'mutedForeground', cssVar: '--muted-foreground' },
  { key: 'border', cssVar: '--border' },
  { key: 'link', cssVar: '--link' },
] as const satisfies readonly {
  key: keyof ThemeBaseTokens;
  cssVar: string;
}[];

export interface ColorPickerFieldProps {
  value: string | null;
  onChange: (value: string | null) => void;
  /**
   * The RESOLVED value of the active theme for this field (docs/adr/0022's
   * follow-up on pre-fill) — `null`/absent = not loaded yet or no known
   * default. Shown as a preview when `value` isn't set, so the field
   * already starts from the current real appearance instead of being
   * empty. Not always a hex value (often `oklch(...)`, like this
   * project's theme tokens): `<input type="color">` only accepts hex, so
   * that stays black until it's a match; the preview swatch below
   * instead accepts any valid CSS color syntax.
   */
  defaultValue?: string | null;
  /**
   * The active theme's own colours (ADR-0050). Absent = no swatch row,
   * which is what every caller that has not been given the theme's tokens
   * gets: the field still works, it just cannot offer them.
   */
  themeTokens?: ThemeBaseTokens | null;
}

/**
 * Per-instance color override — `null`/absent means "inherit from the
 * theme" (the block renderer only applies a CSS-var scoping wrapper when
 * this is non-empty). The check is a truthiness check, not `!== null`:
 * `value` can arrive as `undefined` (property never customized, so
 * absent from the sparse object), and `undefined !== null` is `true` in
 * JS — with `!== null` the "back to theme" button would show up even
 * without any real customization.
 */
export function ColorPickerField({
  value,
  onChange,
  defaultValue,
  themeTokens,
}: ColorPickerFieldProps) {
  const { t } = useTranslation();
  const hexDefault =
    defaultValue && HEX_PATTERN.test(defaultValue) ? defaultValue : null;
  const swatches = SWATCH_TOKENS.flatMap((token) => {
    const resolved = themeTokens?.[token.key];
    return typeof resolved === 'string' && resolved !== ''
      ? [{ ...token, resolved, cssValue: `var(${token.cssVar})` }]
      : [];
  });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="color"
          value={value ?? hexDefault ?? '#000000'}
          onChange={(event) => onChange(event.target.value)}
          style={{
            width: 36,
            height: 28,
            padding: 0,
            border: '1px solid #d4d4d8',
            borderRadius: 4,
            cursor: 'pointer',
          }}
        />
        {!value && defaultValue && (
          <span
            aria-hidden="true"
            title={`Valore attuale del tema: ${defaultValue}`}
            style={{
              width: 16,
              height: 16,
              flexShrink: 0,
              borderRadius: 3,
              border: '1px solid #d4d4d8',
              background: defaultValue,
            }}
          />
        )}
        <input
          type="text"
          value={value ?? ''}
          placeholder={
            defaultValue
              ? t('canvas.colorPicker.themeValue', { value: defaultValue })
              : t('canvas.colorPicker.inherit')
          }
          onChange={(event) => {
            const next = event.target.value;
            if (next === '') {
              onChange(null);
            } else if (HEX_PATTERN.test(next) || THEME_VAR_PATTERN.test(next)) {
              // A theme token is as valid a colour as a hex here, and it has
              // to be typeable: the swatches below cover the theme's own
              // palette, but a theme may declare colours core knows nothing
              // about, and refusing them would make those unreachable.
              onChange(next);
            }
          }}
          style={{
            flex: 1,
            minWidth: 0,
            padding: '6px 8px',
            borderRadius: 4,
            border: '1px solid #d4d4d8',
            background: '#fff',
            color: '#18181b',
            font: 'inherit',
            fontSize: 13,
          }}
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            title={t('canvas.colorPicker.clear')}
            style={{
              padding: '6px 10px',
              borderRadius: 4,
              border: '1px solid #d4d4d8',
              background: '#fff',
              color: '#18181b',
              font: 'inherit',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        )}
      </div>
      {swatches.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {swatches.map((swatch) => (
            <button
              key={swatch.key}
              type="button"
              onClick={() => onChange(swatch.cssValue)}
              title={`${t(`canvas.colorPicker.tokens.${swatch.key}`)} — ${swatch.cssValue}`}
              aria-label={t('canvas.colorPicker.useToken', {
                token: t(`canvas.colorPicker.tokens.${swatch.key}`),
              })}
              aria-pressed={value === swatch.cssValue}
              style={{
                width: 22,
                height: 22,
                padding: 0,
                borderRadius: 4,
                cursor: 'pointer',
                background: swatch.resolved,
                // The selected token is the one outlined: a swatch row
                // where nothing shows which is active leaves the field
                // saying `var(--primary)` with no visible answer to
                // "which of these is that?".
                border:
                  value === swatch.cssValue
                    ? '2px solid #18181b'
                    : '1px solid #d4d4d8',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
