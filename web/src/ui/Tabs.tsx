/** Segmented control. For route tabs, render `<NavLink className="tab">` inside a `.tabs` div instead. */
export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: readonly (readonly [T, string])[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map(([k, label]) => (
        <button key={k} type="button" role="tab" aria-selected={k === value} className={k === value ? 'tab on' : 'tab'} onClick={() => onChange(k)}>
          {label}
        </button>
      ))}
    </div>
  );
}
