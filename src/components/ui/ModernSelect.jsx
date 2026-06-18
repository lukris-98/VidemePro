import React, { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export function ModernSelect({
  label,
  value,
  options,
  onChange,
  leadingIcon: LeadingIcon,
  layout = "row-120",
  buttonClassName = "h-9",
  labelClassName = "text-[var(--text-secondary)]",
  menuClassName = "",
  formatLabel
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const normalized = normalizeOptions(options);
  const selected = normalized.find((option) => option.value === value) ?? normalized.find((option) => !option.group && !option.disabled) ?? normalized[0];
  const SelectedIcon = selected?.icon ?? LeadingIcon;

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (!ref.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const control = (
    <div ref={ref} className="relative min-w-0">
      <button
        type="button"
        onClick={() => setOpen((state) => !state)}
        className={`flex w-full items-center gap-2 rounded-md border bg-[#111] px-2 text-left text-xs text-[var(--text-secondary)] outline-none transition hover:bg-[var(--bg-hover)] ${
          open ? "border-[var(--accent)] shadow-[0_0_0_1px_rgba(77,158,255,0.22)]" : "border-[var(--border)]"
        } ${buttonClassName}`}
      >
        {SelectedIcon ? <SelectedIcon size={14} className="shrink-0 text-[var(--text-muted)]" /> : null}
        <span className="min-w-0 flex-1 truncate">{formatLabel ? formatLabel(selected?.label ?? selected?.value) : selected?.label}</span>
        <ChevronDown size={14} className={`shrink-0 text-[var(--text-muted)] transition ${open ? "rotate-180 text-[var(--accent)]" : ""}`} />
      </button>
      {open ? (
        <div className={`absolute left-0 top-[calc(100%+4px)] z-[90] max-h-56 w-full overflow-auto rounded-md border border-[var(--border)] bg-[#0d0d0d] p-1 shadow-xl shadow-black/50 ${menuClassName}`}>
          {normalized.map((option) => {
            if (option.group) {
              return (
                <div key={`group-${option.label}`} className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase text-[var(--text-muted)]">
                  {option.label}
                </div>
              );
            }
            const OptionIcon = option.icon;
            const active = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                disabled={option.disabled}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`flex h-8 w-full items-center gap-2 rounded px-2 text-left text-xs transition disabled:cursor-not-allowed disabled:opacity-40 ${
                  active ? "bg-[#152235] text-white" : "text-[var(--text-secondary)] hover:bg-[#1d2733] hover:text-white"
                }`}
              >
                {OptionIcon ? <OptionIcon size={13} className={active ? "text-[var(--accent)]" : "text-[var(--text-muted)]"} /> : null}
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {active ? <Check size={12} className="shrink-0 text-[var(--accent)]" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );

  if (!label) return control;

  return (
    <label className={layoutClass(layout)}>
      <span className={labelClassName}>{label}</span>
      {control}
    </label>
  );
}

function normalizeOptions(options) {
  return options.map((option) => {
    if (typeof option === "string" || typeof option === "number") {
      return { value: String(option), label: String(option) };
    }
    return {
      ...option,
      value: String(option.value),
      label: option.label ?? String(option.value)
    };
  });
}

function layoutClass(layout) {
  if (layout === "row-80") return "grid grid-cols-[80px_1fr] items-center gap-3 text-xs";
  if (layout === "row-100") return "grid grid-cols-[100px_1fr] items-center gap-3 text-xs";
  if (layout === "stack") return "grid gap-2 text-xs";
  if (layout === "compact") return "grid gap-1 text-[10px]";
  return "grid grid-cols-[120px_1fr] items-center gap-3 text-xs";
}
