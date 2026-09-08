import type { PickedForm } from '@brisk/shared-types';
import { useTranslation } from '../../../lib/use-translation';
import { Button } from '../../../components/ui/button';
import { useFormList } from '../../form-list-context';

export interface FormPickerFieldProps {
  value: PickedForm | null;
  onChange: (value: PickedForm | null) => void;
}

export function FormPickerField({ value, onChange }: FormPickerFieldProps) {
  const { t } = useTranslation();
  const { pick } = useFormList();

  async function handlePick() {
    const picked = await pick();
    if (picked) onChange(picked);
  }

  return (
    <div className="flex flex-col gap-2">
      {value && <p className="m-0 text-sm">{value.formName}</p>}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => void handlePick()}
      >
        {value
          ? t('canvas.pickers.form.change')
          : t('canvas.pickers.form.choose')}
      </Button>
    </div>
  );
}
