import { createContext, useCallback, useEffect, useRef, useState, ReactNode } from 'react';

export interface ConfirmOptions {
  title?: string;
  desc?: string;
  confirmLabel?: string;
  danger?: boolean;
}

export interface PromptOptions {
  title?: string;
  desc?: string;
  value?: string;
  placeholder?: string;
  confirmLabel?: string;
}

export interface FieldSpec {
  key: string;
  label: string;
  value?: string;
  placeholder?: string;
  multiline?: boolean;
  required?: boolean;
}

export interface FieldsOptions {
  title?: string;
  desc?: string;
  fields: FieldSpec[];
  confirmLabel?: string;
}

interface DialogContextType {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  prompt: (opts: PromptOptions) => Promise<string | null>;
  promptFields: (opts: FieldsOptions) => Promise<Record<string, string> | null>;
}

export const DialogContext = createContext<DialogContextType | undefined>(undefined);

type Request =
  | { kind: 'confirm'; opts: ConfirmOptions; resolve: (v: boolean) => void }
  | { kind: 'prompt'; opts: PromptOptions; resolve: (v: string | null) => void }
  | { kind: 'fields'; opts: FieldsOptions; resolve: (v: Record<string, string> | null) => void };

export function DialogProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<Request | null>(null);
  const [value, setValue] = useState('');
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setRequest({ kind: 'confirm', opts, resolve });
    });
  }, []);

  const prompt = useCallback((opts: PromptOptions) => {
    return new Promise<string | null>((resolve) => {
      setValue(opts.value || '');
      setRequest({ kind: 'prompt', opts, resolve });
    });
  }, []);

  const promptFields = useCallback((opts: FieldsOptions) => {
    return new Promise<Record<string, string> | null>((resolve) => {
      const init: Record<string, string> = {};
      opts.fields.forEach((f) => { init[f.key] = f.value || ''; });
      setFieldValues(init);
      setRequest({ kind: 'fields', opts, resolve });
    });
  }, []);

  useEffect(() => {
    if (request?.kind === 'prompt') {
      const t = setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 10);
      return () => clearTimeout(t);
    }
  }, [request]);

  useEffect(() => {
    if (!request) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [request]);

  function close(result: boolean | string | Record<string, string> | null) {
    if (!request) return;
    if (request.kind === 'confirm') request.resolve(result === true);
    else if (request.kind === 'prompt') request.resolve(result as string | null);
    else request.resolve(result as Record<string, string> | null);
    setRequest(null);
  }

  const submitPrompt = () => {
    const v = value.trim();
    if (!v) {
      inputRef.current?.focus();
      return;
    }
    close(v);
  };

  const submitFields = () => {
    if (request?.kind !== 'fields') return;
    for (const f of request.opts.fields) {
      if (f.required && !fieldValues[f.key]?.trim()) return;
    }
    close(fieldValues);
  };

  return (
    <DialogContext.Provider value={{ confirm, prompt, promptFields }}>
      {children}
      {request && (
        <div
          className="modal-veil"
          onMouseDown={(e) => { if (e.target === e.currentTarget) close(null); }}
        >
          <div className="modal" role="dialog" aria-modal="true">
            <div className="modal-head">
              <div>
                <div className="modal-title">{request.opts.title || (request.kind === 'confirm' ? 'Are you sure?' : 'Enter value')}</div>
                {request.opts.desc && <div className="modal-sub">{request.opts.desc}</div>}
              </div>
            </div>

            {request.kind === 'prompt' && (
              <input
                ref={inputRef}
                className="input"
                value={value}
                placeholder={request.opts.placeholder || ''}
                maxLength={80}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') submitPrompt(); }}
              />
            )}

            {request.kind === 'fields' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {request.opts.fields.map((f, i) => (
                  <div key={f.key}>
                    <label className="field-lbl">{f.label}</label>
                    {f.multiline ? (
                      <textarea
                        className="textarea"
                        rows={2}
                        value={fieldValues[f.key] || ''}
                        placeholder={f.placeholder || ''}
                        onChange={(e) => setFieldValues((v) => ({ ...v, [f.key]: e.target.value }))}
                        style={{ fontFamily: 'inherit', fontSize: 13, fontWeight: 500, lineHeight: 1.5 }}
                      />
                    ) : (
                      <input
                        className="input"
                        autoFocus={i === 0}
                        value={fieldValues[f.key] || ''}
                        placeholder={f.placeholder || ''}
                        onChange={(e) => setFieldValues((v) => ({ ...v, [f.key]: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === 'Enter') submitFields(); }}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="modal-foot">
              <button className="btn btn-ghost" onClick={() => close(null)}>
                Cancel
              </button>
              {request.kind === 'confirm' ? (
                <button
                  className={request.opts.danger ? 'btn' : 'btn btn-primary'}
                  style={request.opts.danger ? { background: 'var(--bad)', color: '#fff' } : undefined}
                  onClick={() => close(true)}
                >
                  {request.opts.confirmLabel || 'Confirm'}
                </button>
              ) : request.kind === 'prompt' ? (
                <button className="btn btn-primary" onClick={submitPrompt}>
                  {request.opts.confirmLabel || 'Save'}
                </button>
              ) : (
                <button className="btn btn-primary" onClick={submitFields}>
                  {request.opts.confirmLabel || 'Save'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}
