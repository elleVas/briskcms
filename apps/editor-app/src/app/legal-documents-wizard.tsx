import { useEffect, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { Plus, X } from 'lucide-react';
import type { SiteRecord } from '@brisk/shared-types';
import {
  LEGAL_DOCUMENT_KINDS,
  type GenerateLegalDocumentsResponse,
  type LegalDocumentAnswers,
  type LegalDocumentKind,
  type PreviewLegalDocumentsResponse,
} from '../lib/legal-documents-api-client';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../components/ui/accordion';
import {
  useGenerateLegalDocuments,
  usePreviewLegalDocuments,
} from './use-generate-legal-documents';

export interface LegalDocumentsWizardProps {
  siteId: string;
  site: SiteRecord;
}

type WizardStep = 'identity' | 'usage' | 'documents' | 'review';
const STEPS: WizardStep[] = ['identity', 'usage', 'documents', 'review'];

interface WizardFormValues {
  legalEntityName: string;
  contactEmail: string;
  address: string;
  phone: string;
  vatId: string;
  domain: string;
  dataCollected: {
    contactForm: boolean;
    newsletter: boolean;
    accounts: boolean;
  };
  thirdPartyServices: string[];
  retentionDays: string;
  jurisdictionCountry: string;
  documents: LegalDocumentKind[];
  locales: string[];
  confirmed: boolean;
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.length > 0)));
}

function toDefaultValues(site: SiteRecord): WizardFormValues {
  return {
    legalEntityName: site.name,
    contactEmail: '',
    address: site.businessAddress ?? '',
    phone: site.businessPhone ?? '',
    vatId: '',
    domain: site.domain ?? '',
    dataCollected: { contactForm: false, newsletter: false, accounts: false },
    thirdPartyServices: dedupe([
      ...site.themeTrackerScripts.map((entry) => entry.label),
      ...site.themeAllowedTrackerDomains.map((entry) => entry.label),
    ]),
    retentionDays:
      site.formSubmissionRetentionDays != null
        ? String(site.formSubmissionRetentionDays)
        : '',
    jurisdictionCountry: '',
    documents: [],
    locales: [...site.enabledLocales],
    confirmed: false,
  };
}

function toAnswers(values: WizardFormValues): LegalDocumentAnswers {
  const retentionDays = values.retentionDays.trim();
  return {
    legalEntityName: values.legalEntityName.trim(),
    contactEmail: values.contactEmail.trim(),
    address: values.address.trim() || null,
    phone: values.phone.trim() || null,
    vatId: values.vatId.trim() || null,
    domain: values.domain.trim() || null,
    dataCollected: values.dataCollected,
    thirdPartyServices: values.thirdPartyServices,
    retentionDays: retentionDays ? Number(retentionDays) : null,
    jurisdictionCountry: values.jurisdictionCountry.trim(),
  };
}

const STEP_FIELDS: Record<WizardStep, (keyof WizardFormValues)[]> = {
  identity: ['legalEntityName', 'contactEmail', 'domain'],
  usage: ['retentionDays'],
  documents: ['documents', 'locales', 'jurisdictionCountry'],
  review: ['confirmed'],
};

/**
 * The generator's stepper (docs/adr/0040): a single `useForm` instance holds
 * every answer across all 4 steps (ADR-0027's react-hook-form, extended here
 * to a multi-step flow rather than a single-shot dialog), with `trigger()`
 * gating each "Avanti". Iubenda's own flow inspired the shape, but Brisk's
 * version pre-fills what it already knows (BusinessInfo, enabledLocales,
 * formSubmissionRetentionDays, the categorized tracker list) instead of
 * asking blind — see LegalDocumentAnswers's own comment.
 */
export function LegalDocumentsWizard({
  siteId,
  site,
}: LegalDocumentsWizardProps) {
  const { t } = useTranslation();
  const [stepIndex, setStepIndex] = useState(0);
  const step = STEPS[stepIndex];
  const [newThirdParty, setNewThirdParty] = useState('');
  const [preview, setPreview] = useState<PreviewLegalDocumentsResponse | null>(
    null,
  );
  const [result, setResult] = useState<GenerateLegalDocumentsResponse | null>(
    null,
  );

  const {
    preview: runPreview,
    isPreviewing,
    previewError,
  } = usePreviewLegalDocuments(siteId);
  const { generate, isGenerating, generateError } =
    useGenerateLegalDocuments(siteId);

  const { register, control, handleSubmit, trigger, getValues } =
    useForm<WizardFormValues>({ defaultValues: toDefaultValues(site) });
  const confirmed = useWatch({ control, name: 'confirmed' });

  useEffect(() => {
    if (step !== 'review' || preview) return;
    const values = getValues();
    void runPreview({
      documents: values.documents,
      locales: values.locales,
      answers: toAnswers(values),
    }).then(setPreview);
    // Only re-run when landing on the review step, not on every keystroke —
    // "Indietro" clears `preview` (below) so fixing an earlier answer and
    // stepping forward again naturally re-triggers this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, preview]);

  async function goNext() {
    const valid = await trigger(STEP_FIELDS[step]);
    if (!valid) return;
    setStepIndex((index) => Math.min(index + 1, STEPS.length - 1));
  }

  function goBack() {
    setPreview(null);
    setStepIndex((index) => Math.max(index - 1, 0));
  }

  async function onGenerate(values: WizardFormValues) {
    const created = await generate({
      documents: values.documents,
      locales: values.locales,
      answers: toAnswers(values),
    });
    setResult(created);
  }

  if (result) {
    return (
      <div className="flex max-w-2xl flex-col gap-4">
        <h1 className="text-lg font-semibold">
          {t('legalDocuments.successTitle')}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t('legalDocuments.successHint')}
        </p>
        <ul className="flex flex-col gap-2">
          {result.documents.map((doc) => (
            <li
              key={doc.pageGroupId}
              className="flex items-center justify-between rounded-md border px-3 py-2"
            >
              <span className="text-sm font-medium">
                {t(`legalDocuments.kind.${doc.kind}`)}
              </span>
              <Link
                to="/page-groups/$groupId"
                params={{ groupId: doc.pageGroupId }}
                className="text-sm text-primary underline-offset-2 hover:underline"
              >
                {t('legalDocuments.openDraft')}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <form
      onSubmit={(event) => void handleSubmit(onGenerate)(event)}
      className="flex max-w-2xl flex-col gap-6"
    >
      <div>
        <h1 className="text-lg font-semibold">{t('legalDocuments.title')}</h1>
        <p className="text-xs text-muted-foreground">
          {t('legalDocuments.intro')}
        </p>
      </div>

      <ol className="flex items-center gap-2 text-xs text-muted-foreground">
        {STEPS.map((s, index) => (
          <li
            key={s}
            className={
              index === stepIndex ? 'font-semibold text-foreground' : undefined
            }
          >
            {index + 1}. {t(`legalDocuments.step.${s}`)}
            {index < STEPS.length - 1 ? ' →' : ''}
          </li>
        ))}
      </ol>

      {step === 'identity' && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="legal-entity-name">
              {t('legalDocuments.legalEntityNameLabel')}
            </Label>
            <Input
              id="legal-entity-name"
              {...register('legalEntityName', { required: true })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="legal-contact-email">
              {t('legalDocuments.contactEmailLabel')}
            </Label>
            <Input
              id="legal-contact-email"
              type="email"
              {...register('contactEmail', { required: true })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="legal-vat-id">
                {t('legalDocuments.vatIdLabel')}
              </Label>
              <Input id="legal-vat-id" {...register('vatId')} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="legal-domain">
                {t('legalDocuments.domainLabel')}
              </Label>
              <Input
                id="legal-domain"
                {...register('domain', { required: true })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="legal-address">
                {t('legalDocuments.addressLabel')}
              </Label>
              <Input id="legal-address" {...register('address')} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="legal-phone">
                {t('legalDocuments.phoneLabel')}
              </Label>
              <Input id="legal-phone" {...register('phone')} />
            </div>
          </div>
        </div>
      )}

      {step === 'usage' && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>{t('legalDocuments.dataCollectedLabel')}</Label>
            <p className="text-xs text-muted-foreground">
              {t('legalDocuments.dataCollectedHint')}
            </p>
            <div className="flex flex-col gap-2">
              {(['contactForm', 'newsletter', 'accounts'] as const).map(
                (field) => (
                  <Controller
                    key={field}
                    control={control}
                    name={`dataCollected.${field}`}
                    render={({ field: controllerField }) => (
                      <label className="flex items-center gap-2 text-sm">
                        <Switch
                          checked={controllerField.value}
                          onCheckedChange={controllerField.onChange}
                        />
                        {t(`legalDocuments.dataCollected.${field}`)}
                      </label>
                    )}
                  />
                ),
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>{t('legalDocuments.thirdPartyServicesLabel')}</Label>
            <p className="text-xs text-muted-foreground">
              {t('legalDocuments.thirdPartyServicesHint')}
            </p>
            <Controller
              control={control}
              name="thirdPartyServices"
              render={({ field }) => (
                <>
                  <div className="flex flex-wrap gap-2">
                    {field.value.map((service) => (
                      <Badge
                        key={service}
                        variant="secondary"
                        className="gap-1"
                      >
                        {service}
                        <button
                          type="button"
                          aria-label={t('legalDocuments.removeThirdParty', {
                            service,
                          })}
                          onClick={() =>
                            field.onChange(
                              field.value.filter((s) => s !== service),
                            )
                          }
                        >
                          <X className="size-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      value={newThirdParty}
                      placeholder={t(
                        'legalDocuments.thirdPartyServicePlaceholder',
                      )}
                      onChange={(event) => setNewThirdParty(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key !== 'Enter') return;
                        event.preventDefault();
                        const value = newThirdParty.trim();
                        if (!value || field.value.includes(value)) return;
                        field.onChange([...field.value, value]);
                        setNewThirdParty('');
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const value = newThirdParty.trim();
                        if (!value || field.value.includes(value)) return;
                        field.onChange([...field.value, value]);
                        setNewThirdParty('');
                      }}
                    >
                      <Plus className="size-3.5" />
                      {t('legalDocuments.addThirdParty')}
                    </Button>
                  </div>
                </>
              )}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="legal-retention-days">
              {t('legalDocuments.retentionDaysLabel')}
            </Label>
            <Input
              id="legal-retention-days"
              type="number"
              min={1}
              placeholder={t('legalDocuments.retentionDaysPlaceholder')}
              {...register('retentionDays')}
            />
            <p className="text-xs text-muted-foreground">
              {t('legalDocuments.retentionDaysHint')}
            </p>
          </div>
        </div>
      )}

      {step === 'documents' && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>{t('legalDocuments.documentsLabel')}</Label>
            <Controller
              control={control}
              name="documents"
              rules={{ validate: (value) => value.length > 0 }}
              render={({ field }) => (
                <div className="flex flex-col gap-2">
                  {LEGAL_DOCUMENT_KINDS.map((kind) => (
                    <label
                      key={kind}
                      className="flex items-center gap-2 text-sm"
                    >
                      <Switch
                        checked={field.value.includes(kind)}
                        onCheckedChange={(checked) =>
                          field.onChange(
                            checked
                              ? [...field.value, kind]
                              : field.value.filter((k) => k !== kind),
                          )
                        }
                      />
                      {t(`legalDocuments.kind.${kind}`)}
                    </label>
                  ))}
                </div>
              )}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>{t('legalDocuments.localesLabel')}</Label>
            <Controller
              control={control}
              name="locales"
              rules={{ validate: (value) => value.length > 0 }}
              render={({ field }) => (
                <div className="flex flex-col gap-2">
                  {site.enabledLocales.map((locale) => (
                    <label
                      key={locale}
                      className="flex items-center gap-2 text-sm uppercase"
                    >
                      <Switch
                        checked={field.value.includes(locale)}
                        onCheckedChange={(checked) =>
                          field.onChange(
                            checked
                              ? [...field.value, locale]
                              : field.value.filter((l) => l !== locale),
                          )
                        }
                      />
                      {locale}
                    </label>
                  ))}
                </div>
              )}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="legal-jurisdiction">
              {t('legalDocuments.jurisdictionLabel')}
            </Label>
            <p className="text-xs text-muted-foreground">
              {t('legalDocuments.jurisdictionHint')}
            </p>
            <Input
              id="legal-jurisdiction"
              {...register('jurisdictionCountry', { required: true })}
            />
          </div>
        </div>
      )}

      {step === 'review' && (
        <div className="flex flex-col gap-4">
          <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
            {t('legalDocuments.disclaimer')}
          </p>

          {isPreviewing && (
            <p className="text-sm text-muted-foreground">
              {t('legalDocuments.loadingPreview')}
            </p>
          )}
          {previewError && (
            <p role="alert" className="text-sm text-destructive">
              {String(previewError)}
            </p>
          )}
          {preview && (
            <Accordion type="multiple">
              {preview.documents.map((doc) =>
                Object.entries(doc.locales).map(([locale, outline]) => (
                  <AccordionItem
                    key={`${doc.kind}-${locale}`}
                    value={`${doc.kind}-${locale}`}
                  >
                    <AccordionTrigger>
                      {t(`legalDocuments.kind.${doc.kind}`)} —{' '}
                      {locale.toUpperCase()}
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="flex flex-col gap-3 text-sm">
                        <p className="font-semibold">{outline.title}</p>
                        {outline.sections.map((section) => (
                          <div key={section.heading}>
                            <p className="font-medium">{section.heading}</p>
                            {section.paragraphs.map((paragraph, index) => (
                              <p key={index} className="text-muted-foreground">
                                {paragraph}
                              </p>
                            ))}
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )),
              )}
            </Accordion>
          )}

          <Controller
            control={control}
            name="confirmed"
            rules={{ validate: (value) => value === true }}
            render={({ field }) => (
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
                {t('legalDocuments.confirmLabel')}
              </label>
            )}
          />
        </div>
      )}

      {generateError && (
        <p role="alert" className="text-sm text-destructive">
          {String(generateError)}
        </p>
      )}

      <div className="flex items-center gap-3">
        {stepIndex > 0 && (
          <Button type="button" variant="outline" onClick={goBack}>
            {t('legalDocuments.back')}
          </Button>
        )}
        {step !== 'review' ? (
          <Button type="button" onClick={() => void goNext()}>
            {t('legalDocuments.next')}
          </Button>
        ) : (
          <Button type="submit" disabled={isGenerating || !confirmed}>
            {isGenerating
              ? t('legalDocuments.generating')
              : t('legalDocuments.generate')}
          </Button>
        )}
      </div>
    </form>
  );
}
