import { useEffect, useRef, useState } from 'react';

// A controlled text field backed by async/shared state (Supabase-persisted
// profile fields, etc.) needs its own local buffer while typing — committing
// on every keystroke means each keystroke fires a network request, and if
// two ever resolve out of order the earlier response can stomp a later
// keystroke, visibly "eating" characters. This keeps typing instantaneous
// and only calls `onCommit` once the user pauses (default 800ms) or blurs
// the field — matching a normal form's save-on-blur/idle behavior.
export function useDebouncedField<T>(value: T, onCommit: (v: T) => void, delay = 800) {
  const [local, setLocal] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);

  // Only follow external updates while the user isn't mid-edit — otherwise
  // an in-flight save resolving would overwrite what they're currently typing.
  useEffect(() => {
    if (!dirtyRef.current) setLocal(value);
  }, [value]);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const commit = (v: T) => {
    dirtyRef.current = false;
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    onCommit(v);
  };

  const onChange = (v: T) => {
    dirtyRef.current = true;
    setLocal(v);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => commit(v), delay);
  };

  const onBlur = () => {
    if (dirtyRef.current) commit(local);
  };

  return { value: local, onChange, onBlur };
}
