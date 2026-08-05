import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../../utils/icons';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  className?: string;
  disabled?: boolean;
  placeholder?: string;
  'aria-label'?: string;
}

// Themed replacement for a native <select> — matches the original app's
// .xsel/.xsel-trigger/.xsel-panel/.xsel-opt widget exactly (portaled listbox,
// viewport-fixed positioning, keyboard nav) instead of the browser's own
// unstyled popup.
export function Select({ value, onChange, options, className, disabled, placeholder, ...aria }: SelectProps) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<{ left: number; top?: number; bottom?: number; minWidth: number; flip: boolean } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);
  const selectedIndex = options.findIndex((o) => o.value === value);

  const position = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const r = trigger.getBoundingClientRect();
    const roomBelow = window.innerHeight - r.bottom;
    const flip = roomBelow < 220 && r.top > roomBelow;
    const panelWidth = panelRef.current?.offsetWidth || r.width;
    const maxLeft = window.innerWidth - panelWidth - 10;
    const left = Math.max(10, Math.min(r.left, maxLeft));
    setRect(flip
      ? { left, bottom: window.innerHeight - r.top + 6, minWidth: r.width, flip: true }
      : { left, top: r.bottom + 6, minWidth: r.width, flip: false });
  };

  useLayoutEffect(() => {
    if (!open) return;
    position();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target as Node) &&
        panelRef.current && !panelRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onScroll = () => setOpen(false);
    const onResize = () => position();
    document.addEventListener('mousedown', onDocDown, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('mousedown', onDocDown, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  const choose = (opt: SelectOption) => {
    if (opt.disabled) return;
    onChange(opt.value);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const focusStep = (fromIndex: number, dir: 1 | -1) => {
    const rows = panelRef.current?.querySelectorAll<HTMLDivElement>('.xsel-opt');
    if (!rows || !rows.length) return;
    let n = fromIndex;
    for (let steps = 0; steps < rows.length; steps++) {
      n = (n + dir + rows.length) % rows.length;
      if (!rows[n].classList.contains('is-disabled')) { rows[n].focus(); return; }
    }
  };

  return (
    <div className={`xsel${className ? ` ${className}` : ''}`}>
      <button
        ref={triggerRef}
        type="button"
        className={`xsel-trigger${!selected || !selected.value ? ' is-placeholder' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        {...(aria['aria-label'] ? { 'aria-label': aria['aria-label'] } : {})}
        onClick={() => { if (!disabled) setOpen((o) => !o); }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); if (!open) setOpen(true); }
        }}
      >
        <span className="xsel-label">{selected ? selected.label : placeholder || ''}</span>
        <span className="xsel-chev"><Icon name="chevDown" size={15} strokeWidth={2.2} /></span>
      </button>

      {open && rect && createPortal(
        <div
          ref={panelRef}
          className={`xsel-panel open${rect.flip ? ' flip' : ''}`}
          role="listbox"
          tabIndex={-1}
          style={{ position: 'fixed', left: rect.left, top: rect.top, bottom: rect.bottom, minWidth: rect.minWidth }}
        >
          {options.filter((o) => !(o.value === '' && options.length > 1)).map((opt) => {
            const i = options.indexOf(opt);
            return (
              <div
                key={opt.value}
                className={`xsel-opt${i === selectedIndex ? ' on' : ''}${opt.disabled ? ' is-disabled' : ''}`}
                role="option"
                aria-selected={i === selectedIndex}
                tabIndex={opt.disabled ? -1 : 0}
                onClick={() => choose(opt)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(opt); }
                  else if (e.key === 'ArrowDown') { e.preventDefault(); focusStep(i, 1); }
                  else if (e.key === 'ArrowUp') { e.preventDefault(); focusStep(i, -1); }
                  else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); triggerRef.current?.focus(); }
                }}
              >
                {opt.label}
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}
