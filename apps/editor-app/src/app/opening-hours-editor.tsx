import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import type { DayOfWeek, OpeningHoursDay } from '@brisk/shared-types';
import { Button } from '../components/ui/button.js';
import { Input } from '../components/ui/input.js';
import { IconButton } from './icon-button.js';

const DAYS: DayOfWeek[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

export interface OpeningHoursEditorProps {
  value: OpeningHoursDay[];
  onChange: (value: OpeningHoursDay[]) => void;
}

// Always renders all 7 days — the caller (BusinessInfoDialog) fills in the
// skeleton once from a possibly-null API value, this component never has
// to reason about a partial week.
export function OpeningHoursEditor({
  value,
  onChange,
}: OpeningHoursEditorProps) {
  const { t } = useTranslation();

  function rangesFor(day: DayOfWeek) {
    return value.find((d) => d.dayOfWeek === day)?.ranges ?? [];
  }

  function updateDay(day: DayOfWeek, ranges: OpeningHoursDay['ranges']) {
    onChange(
      DAYS.map((d) => ({
        dayOfWeek: d,
        ranges: d === day ? ranges : rangesFor(d),
      })),
    );
  }

  function addRange(day: DayOfWeek) {
    updateDay(day, [...rangesFor(day), { opens: '09:00', closes: '18:00' }]);
  }

  function removeRange(day: DayOfWeek, index: number) {
    updateDay(
      day,
      rangesFor(day).filter((_, i) => i !== index),
    );
  }

  function changeRange(
    day: DayOfWeek,
    index: number,
    field: 'opens' | 'closes',
    time: string,
  ) {
    updateDay(
      day,
      rangesFor(day).map((range, i) =>
        i === index ? { ...range, [field]: time } : range,
      ),
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {DAYS.map((day) => {
        const ranges = rangesFor(day);
        return (
          <div key={day} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {t(`openingHours.days.${day}`)}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => addRange(day)}
              >
                <Plus className="size-3.5" />
                {t('openingHours.addRange')}
              </Button>
            </div>
            {ranges.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {t('openingHours.closed')}
              </p>
            ) : (
              // No stable id per range — index is fine, only ever
              // appended/removed here, never reordered.
              ranges.map((range, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    type="time"
                    value={range.opens}
                    onChange={(event) =>
                      changeRange(day, index, 'opens', event.target.value)
                    }
                    className="w-28"
                  />
                  <span className="text-muted-foreground">–</span>
                  <Input
                    type="time"
                    value={range.closes}
                    onChange={(event) =>
                      changeRange(day, index, 'closes', event.target.value)
                    }
                    className="w-28"
                  />
                  <IconButton
                    label={t('openingHours.removeRange')}
                    onClick={() => removeRange(day, index)}
                  >
                    <Trash2 />
                  </IconButton>
                </div>
              ))
            )}
          </div>
        );
      })}
    </div>
  );
}
