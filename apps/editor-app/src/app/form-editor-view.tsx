import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import type { FormField } from '@brisk/shared-types';
import { Button } from '../components/ui/button.js';
import { Input } from '../components/ui/input.js';
import { Label } from '../components/ui/label.js';
import { FormFieldEditorRow } from './form-field-editor-row.js';
import { useFormEditor } from './use-form-editor.js';

export interface FormEditorViewProps {
  formId: string;
}

export function FormEditorView({ formId }: FormEditorViewProps) {
  const { t } = useTranslation();
  const { form, save, isSaving } = useFormEditor(formId);

  // Lazy-initialized from the route-loaded form; safe because the route
  // remounts this component on every formId change (see
  // routes/_shell.forms.$formId.tsx's `key={formId}`, same pattern as
  // PageEditorView) — no "adjust state during render" resync needed here,
  // unlike dialogs that stay mounted across multiple opens.
  const [name, setName] = useState(form.name);
  const [fields, setFields] = useState<FormField[]>(form.fields);
  const [notificationEmail, setNotificationEmail] = useState(
    form.notificationEmail ?? '',
  );
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  function updateField(index: number, next: FormField) {
    setFields((current) => current.map((f, i) => (i === index ? next : f)));
  }

  function removeField(index: number) {
    setFields((current) => current.filter((_, i) => i !== index));
  }

  function addField() {
    setFields((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        label: '',
        type: 'text',
        required: false,
      },
    ]);
  }

  function moveField(index: number, direction: -1 | 1) {
    setFields((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = current.slice();
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  // The options textarea (FormFieldEditorRow) keeps blank/untrimmed lines
  // while the user is typing, so a newly pressed Enter never immediately
  // collapses back — this is the one point where that raw text turns into
  // clean, saved option strings.
  function sanitizeOptions(field: FormField): FormField {
    if (field.type !== 'select') return field;
    return {
      ...field,
      options: (field.options ?? [])
        .map((option) => option.trim())
        .filter((option) => option.length > 0),
    };
  }

  async function handleSave() {
    setError('');
    setSaved(false);
    try {
      await save({
        name,
        fields: fields.map(sanitizeOptions),
        notificationEmail: notificationEmail.trim() || null,
      });
      setSaved(true);
    } catch (err) {
      setError(String(err));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Link
          to="/forms"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← {t('forms.editor.backToList')}
        </Link>
        <Button disabled={isSaving} onClick={() => void handleSave()}>
          {isSaving ? t('forms.editor.saving') : t('forms.editor.save')}
        </Button>
      </div>
      {saved && (
        <p className="text-sm text-muted-foreground">
          {t('forms.editor.saved')}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex max-w-md flex-col gap-2">
        <Label htmlFor="form-name">{t('forms.editor.nameLabel')}</Label>
        <Input
          id="form-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      <div className="flex max-w-md flex-col gap-2">
        <Label htmlFor="form-notification-email">
          {t('forms.editor.notificationEmailLabel')}
        </Label>
        <Input
          id="form-notification-email"
          type="email"
          value={notificationEmail}
          onChange={(event) => setNotificationEmail(event.target.value)}
          placeholder={t('forms.editor.notificationEmailPlaceholder')}
        />
      </div>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Label>{t('forms.editor.fieldsLabel')}</Label>
          <Button type="button" variant="outline" size="sm" onClick={addField}>
            <Plus className="size-3.5" />
            {t('forms.editor.addField')}
          </Button>
        </div>
        {fields.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('forms.editor.noFields')}
          </p>
        ) : (
          fields.map((field, index) => (
            <FormFieldEditorRow
              key={field.id}
              field={field}
              onChange={(next) => updateField(index, next)}
              onRemove={() => removeField(index)}
              onMoveUp={() => moveField(index, -1)}
              onMoveDown={() => moveField(index, 1)}
              canMoveUp={index > 0}
              canMoveDown={index < fields.length - 1}
            />
          ))
        )}
      </div>
    </div>
  );
}
