import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import type { GemeentePocOption } from "@/lib/poc/gemeentePocIndex";

import "./GemeenteAutocomplete.css";

export interface GemeenteAutocompleteProps {
  options: readonly GemeentePocOption[];
  value: string | null;
  onChange: (gmCode: string | null) => void;
  loading?: boolean;
}

export default function GemeenteAutocomplete({
  options,
  value,
  onChange,
  loading = false,
}: GemeenteAutocompleteProps) {
  const id = useId();
  const listId = `${id}-list`;
  const wrapRef = useRef<HTMLDivElement>(null);

  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const selected = useMemo(
    () => (value ? options.find((g) => g.gmCode === value) : undefined),
    [options, value],
  );

  useEffect(() => {
    if (selected) {
      setInput(`${selected.naam} (${selected.gmCode})`);
    } else if (!value) {
      setInput("");
    }
  }, [selected, value]);

  const filtered = useMemo(() => {
    const q = input.trim().toLowerCase();
    if (!q) return [...options];
    return options.filter(
      (g) => g.naam.toLowerCase().includes(q) || g.gmCode.toLowerCase().includes(q),
    );
  }, [input, options]);

  const pick = useCallback(
    (g: GemeentePocOption) => {
      onChange(g.gmCode);
      setInput(`${g.naam} (${g.gmCode})`);
      setOpen(false);
      setHighlight(0);
    },
    [onChange],
  );

  const onInputChange = (v: string) => {
    setInput(v);
    if (value) onChange(null);
    setOpen(true);
    setHighlight(0);
  };

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    setHighlight((h) => Math.min(h, Math.max(0, filtered.length - 1)));
  }, [filtered.length]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, Math.max(0, filtered.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter" && filtered[highlight]) {
      e.preventDefault();
      pick(filtered[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="gemeente-ac" ref={wrapRef}>
      <label className="poc-flow-label" htmlFor={`${id}-input`}>
        Gemeente
      </label>
      <p className="gemeente-ac-help">Zoek op gemeentenaam of GM-code.</p>
      <div className="gemeente-ac-input-wrap">
        <input
          id={`${id}-input`}
          type="search"
          className="gemeente-ac-input poc-flow-input"
          autoComplete="off"
          spellCheck={false}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && filtered[highlight] ? `${id}-opt-${filtered[highlight]!.gmCode}` : undefined}
          placeholder="Zoek je gemeente"
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {loading && <span className="gemeente-ac-loading">Laden…</span>}
      </div>
      {open && (
        <>
          {filtered.length > 0 ? (
            <ul id={listId} className="gemeente-ac-list" role="listbox">
              {filtered.map((g, i) => (
                <li
                  id={`${id}-opt-${g.gmCode}`}
                  key={g.gmCode}
                  role="option"
                  aria-selected={value === g.gmCode}
                  className={
                    i === highlight ? "gemeente-ac-item gemeente-ac-item--hi" : "gemeente-ac-item"
                  }
                  onMouseEnter={() => setHighlight(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(g)}
                >
                  <span className="gemeente-ac-name">{g.naam}</span>
                  <span className="gemeente-ac-code">{g.gmCode}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="gemeente-ac-empty" role="status">
              Geen gemeenten gevonden voor deze zoekterm.
            </div>
          )}
        </>
      )}
    </div>
  );
}
