export interface SegmentedTab<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedTabsProps<T extends string> {
  tabs: readonly SegmentedTab<T>[];
  value: T;
  onChange: (value: T) => void;
}

/**
 * A row of buttons that switches what a dialog shows below it — the icon
 * picker's sets, the version history's sources. One copy, so the two
 * cannot drift into looking like different controls for the same idea.
 */
export function SegmentedTabs<T extends string>({
  tabs,
  value,
  onChange,
}: SegmentedTabsProps<T>) {
  return (
    <div className="flex gap-1" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={value === tab.value}
          onClick={() => onChange(tab.value)}
          className={
            value === tab.value
              ? 'rounded-md border border-input bg-accent px-3 py-1.5 text-sm font-medium'
              : 'rounded-md border border-transparent px-3 py-1.5 text-sm text-muted-foreground'
          }
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
