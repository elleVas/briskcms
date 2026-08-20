import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import type { FormField, FormFieldType } from '@brisk/shared-types';
import { Input } from '../components/ui/input.js';
import { Label } from '../components/ui/label.js';
import { Switch } from '../components/ui/switch.js';
import { IconButton } from './icon-button.js';

const FIELD_TYPES: FormFieldType[] = [
  'text',
  'email',
  'textarea',
  'tel',
  'checkbox',
  'select',
  'newsletter-consent',
  'date',
  'time',
  'file',
];

// Same select styling as Input (components/ui/input.tsx) — no shadcn
// <Select> primitive installed yet, and a plain <select> covers this one
// field-type picker without pulling in a new dependency for it.
const selectClassName =
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30';

export interface FormFieldEditorRowProps {
  field: FormField;
  onChange: (field: FormField) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

export function FormFieldEditorRow({
  field,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: FormFieldEditorRowProps) {
  const { t } = useTranslation();

  function handleTypeChange(type: FormFieldType) {
    onChange({
      ...field,
      type,
      options: type === 'select' ? (field.options ?? []) : undefined,
    });
  }

  // Keeps every line, including a trailing empty one — trimming/filtering
  // here would fight the user's cursor the moment they press Enter for a
  // new option (the just-created blank line would immediately vanish).
  // Sanitizing (trim + drop empty lines) happens once, at save time (see
  // form-editor-view.tsx's handleSave).
  function handleOptionsChange(raw: string) {
    onChange({ ...field, options: raw.split('\n') });
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border p-3">
      <div className="flex items-start gap-3">
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor={`field-label-${field.id}`}>
            {t('forms.editor.fieldLabelLabel')}
          </Label>
          <Input
            id={`field-label-${field.id}`}
            value={field.label}
            onChange={(event) =>
              onChange({ ...field, label: event.target.value })
            }
          />
        </div>
        <div className="flex w-40 flex-col gap-2">
          <Label htmlFor={`field-type-${field.id}`}>
            {t('forms.editor.fieldTypeLabel')}
          </Label>
          <select
            id={`field-type-${field.id}`}
            className={selectClassName}
            value={field.type}
            onChange={(event) =>
              handleTypeChange(event.target.value as FormFieldType)
            }
          >
            {FIELD_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`forms.editor.fieldTypes.${type}`)}
              </option>
            ))}
          </select>
        </div>
      </div>
      {field.type === 'select' && (
        <div className="flex flex-col gap-2">
          <Label htmlFor={`field-options-${field.id}`}>
            {t('forms.editor.fieldOptionsLabel')}
          </Label>
          <textarea
            id={`field-options-${field.id}`}
            className="min-h-16 w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            value={(field.options ?? []).join('\n')}
            onChange={(event) => handleOptionsChange(event.target.value)}
            placeholder={t('forms.editor.fieldOptionsPlaceholder')}
          />
        </div>
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Switch
            size="sm"
            checked={field.required}
            onCheckedChange={(checked) =>
              onChange({ ...field, required: checked })
            }
            aria-label={t('forms.editor.fieldRequiredLabel')}
          />
          <span className="text-sm text-muted-foreground">
            {t('forms.editor.fieldRequiredLabel')}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <IconButton
            label={t('forms.editor.moveFieldUp')}
            disabled={!canMoveUp}
            onClick={onMoveUp}
          >
            <ArrowUp />
          </IconButton>
          <IconButton
            label={t('forms.editor.moveFieldDown')}
            disabled={!canMoveDown}
            onClick={onMoveDown}
          >
            <ArrowDown />
          </IconButton>
          <IconButton label={t('forms.editor.removeField')} onClick={onRemove}>
            <Trash2 />
          </IconButton>
        </div>
      </div>
    </div>
  );
}
