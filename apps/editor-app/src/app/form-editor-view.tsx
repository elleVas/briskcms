import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';
import { FormSubmissionsList } from './form-submissions-list';
import { Link } from '@tanstack/react-router';
import { Plus, Trash2 } from 'lucide-react';
import {
  formConditionProblems,
  type FormField,
  type FormStep,
} from '@brisk/shared-types';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { FormFieldEditorRow } from './form-field-editor-row';
import { IconButton } from './icon-button';
import { ConfirmActionDialog } from './confirm-action-dialog';
import { useFormEditor } from './use-form-editor';
import {
  useNavigationBlocker,
  useUnsavedChangesGuard,
} from './use-unsaved-changes-guard';

export interface FormEditorViewProps {
  formId: string;
}

/** Mirrors MAX_NOTIFICATION_EMAILS in @brisk/domain-core, which the API enforces; the editor stops offering more at the same point. */
const MAX_NOTIFICATION_EMAILS = 10;

/** A select's options as they are stored: trimmed, and without the empty one a trailing newline in the textarea leaves behind. */
function sanitizeOptions(field: FormField): FormField {
  if (field.type !== 'select') return field;
  return {
    ...field,
    options: (field.options ?? [])
      .map((option) => option.trim())
      .filter((option) => option.length > 0),
  };
}

/**
 * The form as it would be SAVED, which is the only shape worth comparing.
 *
 * The dirty mark used to compare the raw state against a baseline built
 * from the sanitised one, so anything the save tidied up — an option list
 * ending in a newline, an email with a trailing space — left the editor
 * permanently "unsaved": the mark stayed on a saved form, and the guard
 * put "you will lose your work" in front of every link from then on. A
 * warning that is always wrong is worse than no warning, because people
 * learn to click through it.
 */
function draftOf(
  name: string,
  fields: FormField[],
  steps: FormStep[],
  notificationEmails: string[],
) {
  return {
    name,
    fields: fields.map(sanitizeOptions),
    steps,
    // The inputs keep blank rows while someone is adding an address; what
    // is saved is the addresses themselves.
    notificationEmails: notificationEmails
      .map((address) => address.trim())
      .filter((address) => address !== ''),
  };
}

function serializeDraft(draft: ReturnType<typeof draftOf>): string {
  return JSON.stringify(draft);
}

export function FormEditorView({ formId }: FormEditorViewProps) {
  const { t } = useTranslation();
  const { form, save, isSaving } = useFormEditor(formId);
  const [tab, setTab] = useState<'structure' | 'submissions'>('structure');
  // Read off the form the editor already loaded rather than fetched again:
  // the tab label only needs a number, and the list itself fetches the
  // real data when it is opened.
  const submissionCount = form?.submissionCount ?? 0;

  // Lazy-initialized from the route-loaded form; safe because the route
  // remounts this component on every formId change (see
  // routes/_shell.forms.$formId.tsx's `key={formId}`, same pattern as
  // PageEditorView) — no "adjust state during render" resync needed here,
  // unlike dialogs that stay mounted across multiple opens.
  const [name, setName] = useState(form.name);
  const [fields, setFields] = useState<FormField[]>(form.fields);
  const [steps, setSteps] = useState<FormStep[]>(form.steps);
  // At least one row, empty if the form emails nobody yet: an address is
  // typed straight in rather than behind an "Add" click.
  const [notificationEmails, setNotificationEmails] = useState<string[]>(
    form.notificationEmails.length > 0 ? form.notificationEmails : [''],
  );
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  /*
   * This editor has no autosave: it writes only when somebody presses
   * Save, and until now it let you walk away from a half-built form
   * without a word — no dirty mark, no question, nothing.
   *
   * The baseline is what the server last confirmed, so a change that is
   * typed and then typed back does not count as unsaved. State rather than
   * a ref: it is read while rendering — the dirty mark and the guard both
   * follow it — and reading a ref there is what the React Compiler's rule
   * forbids, for the good reason that nothing would re-render when it
   * moved.
   */
  const [baseline, setBaseline] = useState(() =>
    serializeDraft(
      draftOf(form.name, form.fields, form.steps, form.notificationEmails),
    ),
  );
  const draft = draftOf(name, fields, steps, notificationEmails);
  // Refused by the API too; checked here so the problem is named next to
  // the field that has it, and Save says why it will not work.
  const conditionProblems = useMemo(
    () => formConditionProblems(draft.fields),
    [draft.fields],
  );
  const isDirty = serializeDraft(draft) !== baseline;
  useUnsavedChangesGuard({ hasUnsavedChanges: isDirty });
  // And a question in front of an in-app link too, which the canvas does
  // not need: there is nothing here that saves itself, so following one
  // really does throw the work away.
  const guard = useNavigationBlocker(isDirty);

  function updateField(index: number, next: FormField) {
    setFields((current) => current.map((f, i) => (i === index ? next : f)));
  }

  // Also drops any condition that named the removed field, the way
  // removeStep clears stepId: a condition on a field that no longer exists
  // would hide its own field for good.
  function removeField(index: number) {
    const removedId = fields[index].id;
    setFields((current) =>
      current
        .filter((_, i) => i !== index)
        .map((field) =>
          field.showWhen?.fieldId === removedId
            ? { ...field, showWhen: null }
            : field,
        ),
    );
  }

  function updateNotificationEmail(index: number, address: string) {
    setNotificationEmails((current) =>
      current.map((existing, i) => (i === index ? address : existing)),
    );
  }

  function removeNotificationEmail(index: number) {
    setNotificationEmails((current) => {
      const next = current.filter((_, i) => i !== index);
      return next.length > 0 ? next : [''];
    });
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

  function addStep() {
    setSteps((current) => [...current, { id: crypto.randomUUID(), title: '' }]);
  }

  function updateStepTitle(index: number, title: string) {
    setSteps((current) =>
      current.map((step, i) => (i === index ? { ...step, title } : step)),
    );
  }

  // Also clears stepId on any field pointing at the removed step, so
  // saving never leaves a field referencing a step that no longer exists.
  function removeStep(index: number) {
    const removedId = steps[index].id;
    setSteps((current) => current.filter((_, i) => i !== index));
    setFields((current) =>
      current.map((field) =>
        field.stepId === removedId ? { ...field, stepId: null } : field,
      ),
    );
  }

  // The options textarea (FormFieldEditorRow) keeps blank/untrimmed lines
  // while the user is typing, so a newly pressed Enter never immediately
  // collapses back — this is the one point where that raw text turns into
  // clean, saved option strings.
  async function handleSave() {
    setError('');
    setSaved(false);
    try {
      const saved = await save(draft);
      // From what came BACK, not from what was sent: the comment above
      // promises the baseline is what the server confirmed, and anything
      // the server normalises on its way in would otherwise leave the
      // editor dirty exactly as the client-side tidying used to.
      setBaseline(
        serializeDraft(
          draftOf(
            saved?.name ?? draft.name,
            saved?.fields ?? draft.fields,
            saved?.steps ?? draft.steps,
            saved?.notificationEmails ?? draft.notificationEmails,
          ),
        ),
      );
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
        <div className="flex items-center gap-3">
          {/* A dirty mark, which this screen had none of: "Save" looked
              exactly the same whether or not there was anything to save. */}
          {isDirty && !isSaving && (
            <span className="text-xs text-muted-foreground">
              {t('forms.editor.unsaved')}
            </span>
          )}
          {conditionProblems.size > 0 && (
            <span className="text-xs text-destructive">
              {t('forms.editor.conditionBlocksSave')}
            </span>
          )}
          <Button
            disabled={isSaving || conditionProblems.size > 0}
            onClick={() => void handleSave()}
          >
            {isSaving ? t('forms.editor.saving') : t('forms.editor.save')}
          </Button>
        </div>
      </div>
      {/* Two panels rather than one long page: editing what a form asks
          and reading what people answered are different jobs, done at
          different times. The count sits in the label so the answers are
          discoverable from here without opening the tab. */}
      <div role="tablist" className="border-border flex gap-1 border-b">
        {(['structure', 'submissions'] as const).map((id) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm',
              tab === id
                ? 'border-primary text-foreground font-medium'
                : 'text-muted-foreground border-transparent hover:text-foreground',
            )}
          >
            {t(`forms.tabs.${id}`)}
            {id === 'submissions' && submissionCount > 0 && (
              <span className="text-muted-foreground ml-1.5 tabular-nums">
                ({submissionCount})
              </span>
            )}
          </button>
        ))}
      </div>
      {tab === 'submissions' ? (
        <div role="tabpanel">
          <FormSubmissionsList formId={formId} />
        </div>
      ) : (
        <div role="tabpanel" className="flex flex-col gap-4">
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
          <fieldset className="flex max-w-md flex-col gap-2">
            <legend className="mb-2 text-sm leading-none font-medium">
              {t('forms.editor.notificationEmailsLabel')}
            </legend>
            <p className="text-sm text-muted-foreground">
              {t('forms.editor.notificationEmailsHint')}
            </p>
            {notificationEmails.map((address, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  type="email"
                  aria-label={t('forms.editor.notificationEmailAddress', {
                    number: index + 1,
                  })}
                  value={address}
                  onChange={(event) =>
                    updateNotificationEmail(index, event.target.value)
                  }
                  placeholder={t('forms.editor.notificationEmailPlaceholder')}
                />
                <IconButton
                  label={t('forms.editor.removeNotificationEmail')}
                  disabled={notificationEmails.length === 1 && address === ''}
                  onClick={() => removeNotificationEmail(index)}
                >
                  <Trash2 />
                </IconButton>
              </div>
            ))}
            {notificationEmails.length < MAX_NOTIFICATION_EMAILS && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                onClick={() =>
                  setNotificationEmails((current) => [...current, ''])
                }
              >
                <Plus className="size-3.5" />
                {t('forms.editor.addNotificationEmail')}
              </Button>
            )}
          </fieldset>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Label>{t('forms.editor.stepsLabel')}</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addStep}
              >
                <Plus className="size-3.5" />
                {t('forms.editor.addStep')}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              {steps.length === 0
                ? t('forms.editor.noSteps')
                : t('forms.editor.stepsHint')}
            </p>
            {steps.length > 0 &&
              steps.map((step, index) => (
                <div key={step.id} className="flex items-center gap-2">
                  <Input
                    aria-label={t('forms.editor.stepTitlePlaceholder')}
                    value={step.title}
                    placeholder={t('forms.editor.stepTitlePlaceholder')}
                    onChange={(event) =>
                      updateStepTitle(index, event.target.value)
                    }
                  />
                  <IconButton
                    label={t('forms.editor.removeStep')}
                    onClick={() => removeStep(index)}
                  >
                    <Trash2 />
                  </IconButton>
                </div>
              ))}
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Label>{t('forms.editor.fieldsLabel')}</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addField}
              >
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
                  steps={steps}
                  earlierFields={fields.slice(0, index)}
                  conditionProblem={conditionProblems.get(field.id)}
                />
              ))
            )}
          </div>
        </div>
      )}
      {/* Leaving really does throw the work away here — there is no
          autosave behind this screen, only the Save button. */}
      <ConfirmActionDialog
        open={guard.isBlocked}
        onOpenChange={(open) => !open && guard.stay()}
        title={t('forms.editor.leaveTitle')}
        description={t('forms.editor.leaveBody')}
        onConfirm={guard.proceed}
        actionLabel={t('forms.editor.leaveAction')}
      />
    </div>
  );
}
