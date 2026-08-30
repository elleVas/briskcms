import { renderHook } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';
import { useResetFormOnOpen } from './use-reset-form-on-open';

interface Source {
  id: string;
  name: string;
}

interface FormValues {
  name: string;
}

function setup(open: boolean, source: Source | undefined) {
  return renderHook(
    ({ open, source }: { open: boolean; source: Source | undefined }) => {
      const form = useForm<FormValues>({ defaultValues: { name: '' } });
      useResetFormOnOpen(open, source, form.reset, (s) => ({ name: s.name }));
      return form;
    },
    { initialProps: { open, source } },
  );
}

describe('useResetFormOnOpen', () => {
  it('does nothing while closed, even once source arrives', () => {
    const { result, rerender } = setup(false, undefined);
    rerender({ open: false, source: { id: '1', name: 'Sito A' } });

    expect(result.current.getValues('name')).toBe('');
  });

  it('seeds the form once open and source have both arrived', () => {
    const { result, rerender } = setup(true, undefined);
    expect(result.current.getValues('name')).toBe('');

    rerender({ open: true, source: { id: '1', name: 'Sito A' } });

    expect(result.current.getValues('name')).toBe('Sito A');
  });

  it('re-seeds on every fresh open, discarding an unsaved edit from the previous one', () => {
    const { result, rerender } = setup(true, { id: '1', name: 'Sito A' });
    result.current.setValue('name', 'edited but not saved');

    rerender({ open: false, source: { id: '1', name: 'Sito A' } });
    rerender({ open: true, source: { id: '1', name: 'Sito A' } });

    expect(result.current.getValues('name')).toBe('Sito A');
  });

  it('does not reset again on a re-render with the same open+source state', () => {
    const { result, rerender } = setup(true, { id: '1', name: 'Sito A' });
    result.current.setValue('name', 'still editing');

    rerender({ open: true, source: { id: '1', name: 'Sito A' } });

    expect(result.current.getValues('name')).toBe('still editing');
  });
});
