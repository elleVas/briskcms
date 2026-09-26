import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { FileText, X } from 'lucide-react';
import {
  cookieBannerPositionSchema,
  cookieBannerReopenPositionSchema,
  cookieBannerSettingsSchema,
  type CookieBannerCopy,
  type CookieBannerPosition,
  type CookieBannerReopenPosition,
  type SiteRecord,
} from '@brisk/shared-types';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { OptionsSelect } from '../components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../components/ui/accordion';
import { IconButton } from './icon-button';
import { PagePickerDialog, type PagePickerOption } from './page-picker-dialog';
import { useSiteCookieBannerSettings } from './use-site-cookie-banner-settings';

export interface CookieBannerViewProps {
  siteId: string;
  site: SiteRecord;
}

type PolicyKind = 'privacy' | 'cookie';

/**
 * Configures the site-wide consent banner PageLayout.astro renders
 * directly (docs/adr/0039) — a full route (`_shell.cookies.index.tsx`),
 * not a small Dialog, following IntegrationsView's own precedent for a
 * comparably-scoped config surface. The categorized tracker script list
 * itself (which category each snippet belongs to) is edited in
 * Integrations, not here — see integrations-view.tsx's own comment for why
 * that stays a single writer on ThemeSettings.
 */
export function CookieBannerView({ siteId, site }: CookieBannerViewProps) {
  const { t } = useTranslation();
  const { updateCookieBannerSettings, isSaving } =
    useSiteCookieBannerSettings(siteId);

  const [enabled, setEnabled] = useState(site.cookieBannerSettings.enabled);
  const [position, setPosition] = useState<CookieBannerPosition>(
    site.cookieBannerSettings.position,
  );
  const [acceptButtonSide, setAcceptButtonSide] = useState<'left' | 'right'>(
    site.cookieBannerSettings.acceptButtonSide,
  );
  const [showReopenTab, setShowReopenTab] = useState(
    site.cookieBannerSettings.showReopenTab,
  );
  const [reopenPosition, setReopenPosition] =
    useState<CookieBannerReopenPosition>(
      site.cookieBannerSettings.reopenPosition,
    );
  const [privacyPolicyPageGroupId, setPrivacyPolicyPageGroupId] = useState(
    site.cookieBannerSettings.privacyPolicyPageGroupId,
  );
  const [privacyPolicyLabel, setPrivacyPolicyLabel] = useState<string | null>(
    null,
  );
  const [cookiePolicyPageGroupId, setCookiePolicyPageGroupId] = useState(
    site.cookieBannerSettings.cookiePolicyPageGroupId,
  );
  const [cookiePolicyLabel, setCookiePolicyLabel] = useState<string | null>(
    null,
  );
  const [copyOverrides, setCopyOverrides] = useState(
    site.cookieBannerSettings.copyOverrides,
  );
  const [pickerFor, setPickerFor] = useState<PolicyKind | null>(null);
  const [error, setError] = useState('');
  const [savedAt, setSavedAt] = useState(0);

  function handlePick(option: PagePickerOption) {
    if (pickerFor === 'privacy') {
      setPrivacyPolicyPageGroupId(option.pageGroupId);
      setPrivacyPolicyLabel(option.title);
    } else if (pickerFor === 'cookie') {
      setCookiePolicyPageGroupId(option.pageGroupId);
      setCookiePolicyLabel(option.title);
    }
    setPickerFor(null);
  }

  function updateCopyField(
    locale: string,
    field: keyof CookieBannerCopy,
    value: string,
  ) {
    setCopyOverrides((prev) => ({
      ...prev,
      [locale]: { ...prev[locale], [field]: value },
    }));
  }

  async function handleSubmit() {
    setError('');
    try {
      await updateCookieBannerSettings({
        enabled,
        position,
        acceptButtonSide,
        showReopenTab,
        reopenPosition,
        privacyPolicyPageGroupId,
        cookiePolicyPageGroupId,
        copyOverrides,
      });
      setSavedAt(Date.now());
    } catch (err) {
      setError(String(err));
    }
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          {t('cookieBanner.title')}
        </h1>
        <p className="text-xs text-muted-foreground">
          {t('cookieBanner.intro')}
        </p>
      </div>

      <Link
        to="/cookies/legal-documents"
        className="flex w-fit items-center gap-2 rounded-md border px-3 py-2 text-sm text-primary hover:bg-accent"
      >
        <FileText className="size-4" />
        {t('cookieBanner.legalDocumentsLink')}
      </Link>

      <div className="flex items-center gap-2">
        <Switch
          checked={enabled}
          onCheckedChange={setEnabled}
          aria-label={t('cookieBanner.enabledLabel')}
        />
        <span className="text-sm font-medium">
          {t('cookieBanner.enabledLabel')}
        </span>
      </div>

      {enabled && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="cookie-banner-position">
                {t('cookieBanner.positionLabel')}
              </Label>
              <OptionsSelect
                id="cookie-banner-position"
                value={position}
                onValueChange={(value) => {
                  const next = cookieBannerPositionSchema.options.find(
                    (candidate) => candidate === value,
                  );
                  if (next) setPosition(next);
                }}
                options={[
                  {
                    value: 'bottom-bar',
                    label: t('cookieBanner.position.bottomBar'),
                  },
                  {
                    value: 'bottom-left',
                    label: t('cookieBanner.position.bottomLeft'),
                  },
                  {
                    value: 'bottom-right',
                    label: t('cookieBanner.position.bottomRight'),
                  },
                  {
                    value: 'center-modal',
                    label: t('cookieBanner.position.centerModal'),
                  },
                ]}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="cookie-banner-accept-side">
                {t('cookieBanner.acceptButtonSideLabel')}
              </Label>
              <OptionsSelect
                id="cookie-banner-accept-side"
                value={acceptButtonSide}
                onValueChange={(value) => {
                  const next =
                    cookieBannerSettingsSchema.shape.acceptButtonSide.options.find(
                      (candidate) => candidate === value,
                    );
                  if (next) setAcceptButtonSide(next);
                }}
                options={[
                  { value: 'left', label: t('cookieBanner.side.left') },
                  { value: 'right', label: t('cookieBanner.side.right') },
                ]}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={showReopenTab}
              onCheckedChange={setShowReopenTab}
              aria-label={t('cookieBanner.showReopenTabLabel')}
            />
            <span className="text-sm font-medium">
              {t('cookieBanner.showReopenTabLabel')}
            </span>
          </div>
          {showReopenTab && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="cookie-banner-reopen-position">
                {t('cookieBanner.reopenPositionLabel')}
              </Label>
              <OptionsSelect
                id="cookie-banner-reopen-position"
                className="w-48"
                value={reopenPosition}
                onValueChange={(value) => {
                  const next = cookieBannerReopenPositionSchema.options.find(
                    (candidate) => candidate === value,
                  );
                  if (next) setReopenPosition(next);
                }}
                options={[
                  {
                    value: 'bottom-left',
                    label: t('cookieBanner.position.bottomLeft'),
                  },
                  {
                    value: 'bottom-right',
                    label: t('cookieBanner.position.bottomRight'),
                  },
                ]}
              />
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label>{t('cookieBanner.privacyPolicyLabel')}</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPickerFor('privacy')}
              >
                {privacyPolicyPageGroupId
                  ? (privacyPolicyLabel ?? t('cookieBanner.pageSelected'))
                  : t('cookieBanner.selectPage')}
              </Button>
              {privacyPolicyPageGroupId && (
                <IconButton
                  label={t('cookieBanner.clearSelection')}
                  onClick={() => {
                    setPrivacyPolicyPageGroupId(null);
                    setPrivacyPolicyLabel(null);
                  }}
                >
                  <X />
                </IconButton>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label>{t('cookieBanner.cookiePolicyLabel')}</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPickerFor('cookie')}
              >
                {cookiePolicyPageGroupId
                  ? (cookiePolicyLabel ?? t('cookieBanner.pageSelected'))
                  : t('cookieBanner.selectPage')}
              </Button>
              {cookiePolicyPageGroupId && (
                <IconButton
                  label={t('cookieBanner.clearSelection')}
                  onClick={() => {
                    setCookiePolicyPageGroupId(null);
                    setCookiePolicyLabel(null);
                  }}
                >
                  <X />
                </IconButton>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>{t('cookieBanner.copyOverridesLabel')}</Label>
            <p className="text-xs text-muted-foreground">
              {t('cookieBanner.copyOverridesHint')}
            </p>
            <Accordion type="multiple">
              {site.enabledLocales.map((locale) => (
                <AccordionItem key={locale} value={locale}>
                  <AccordionTrigger>{locale}</AccordionTrigger>
                  <AccordionContent>
                    <div className="flex flex-col gap-2">
                      <Input
                        placeholder={t('cookieBanner.titlePlaceholder')}
                        value={copyOverrides[locale]?.title ?? ''}
                        onChange={(event) =>
                          updateCopyField(locale, 'title', event.target.value)
                        }
                      />
                      <Input
                        placeholder={t('cookieBanner.bodyPlaceholder')}
                        value={copyOverrides[locale]?.body ?? ''}
                        onChange={(event) =>
                          updateCopyField(locale, 'body', event.target.value)
                        }
                      />
                      <Input
                        placeholder={t('cookieBanner.acceptAllPlaceholder')}
                        value={copyOverrides[locale]?.acceptAll ?? ''}
                        onChange={(event) =>
                          updateCopyField(
                            locale,
                            'acceptAll',
                            event.target.value,
                          )
                        }
                      />
                      <Input
                        placeholder={t('cookieBanner.rejectAllPlaceholder')}
                        value={copyOverrides[locale]?.rejectAll ?? ''}
                        onChange={(event) =>
                          updateCopyField(
                            locale,
                            'rejectAll',
                            event.target.value,
                          )
                        }
                      />
                      <Input
                        placeholder={t('cookieBanner.customizePlaceholder')}
                        value={copyOverrides[locale]?.customize ?? ''}
                        onChange={(event) =>
                          updateCopyField(
                            locale,
                            'customize',
                            event.target.value,
                          )
                        }
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex items-center gap-3">
        <Button
          type="button"
          disabled={isSaving}
          onClick={() => void handleSubmit()}
        >
          {isSaving ? t('cookieBanner.saving') : t('cookieBanner.save')}
        </Button>
        {savedAt > 0 && !isSaving && !error && (
          <span role="status" className="text-sm text-muted-foreground">
            {t('cookieBanner.saved')}
          </span>
        )}
      </div>

      <PagePickerDialog
        siteId={siteId}
        locale={site.defaultLocale}
        open={pickerFor !== null}
        onOpenChange={(open) => {
          if (!open) setPickerFor(null);
        }}
        onSelect={handlePick}
      />
    </div>
  );
}
