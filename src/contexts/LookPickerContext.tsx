import { createContext, useState, ReactNode } from 'react';
import { Icon, IconName, PICKER_ICONS, BANK_TONES } from '../utils/icons';
import { readImageFile } from '../utils/image';
import { useToast } from '../hooks/useToast';

type Tone = (typeof BANK_TONES)[number];

export interface LookPickOptions {
  title?: string;
  subtitle?: string;
  icon?: IconName;
  tone?: Tone;
  logo?: string | null;
  showTone?: boolean;
  nameField?: boolean;
  nameValue?: string;
  descField?: boolean;
  descValue?: string;
  allowUpload?: boolean;
  iconOptions?: IconName[];
}

export interface LookPickResult {
  icon: IconName | null;
  tone: Tone;
  logo: string | null;
  name?: string;
  description?: string;
}

interface LookPickerContextType {
  pickLook: (opts: LookPickOptions) => Promise<LookPickResult | null>;
}

export const LookPickerContext = createContext<LookPickerContextType | undefined>(undefined);

interface Request {
  opts: LookPickOptions;
  resolve: (v: LookPickResult | null) => void;
}

function PickerForm({ request, onClose }: { request: Request; onClose: (r: LookPickResult | null) => void }) {
  const toast = useToast();
  const { opts } = request;
  const showTone = opts.showTone !== false;
  const iconOptions = opts.iconOptions || PICKER_ICONS;

  const [icon, setIcon] = useState<IconName>(opts.icon || 'grad');
  const [tone, setTone] = useState<Tone>(opts.tone || 'acc');
  const [logo, setLogo] = useState<string | null>(opts.logo || null);
  const [name, setName] = useState(opts.nameValue || '');
  const [desc, setDesc] = useState(opts.descValue || '');

  const handleUpload = async (file: File) => {
    try {
      const dataUri = await readImageFile(file);
      setLogo(dataUri);
      toast('Image loaded — click Save to apply it.', 'ok');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not process that image.', 'err');
    }
  };

  const save = () => {
    onClose({
      icon: logo ? null : icon,
      tone,
      logo,
      ...(opts.nameField ? { name: name.trim() } : {}),
      ...(opts.descField ? { description: desc.trim() } : {}),
    });
  };

  return (
    <div className="modal-veil" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(null); }}>
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-head">
          <div>
            <div className="modal-title">{opts.title || 'Icon'}</div>
            {opts.subtitle && <div className="modal-sub">{opts.subtitle}</div>}
          </div>
          <button className="icon-btn" onClick={() => onClose(null)}><Icon name="x" size={15} /></button>
        </div>

        {opts.nameField && (
          <>
            <label className="field-lbl">Name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} style={{ marginBottom: 16 }} />
          </>
        )}

        {opts.descField && (
          <>
            <label className="field-lbl">Description</label>
            <textarea
              className="textarea"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              maxLength={200}
              rows={2}
              placeholder="What ties these banks together?"
              style={{ marginBottom: 16, fontFamily: 'inherit', fontSize: 13, fontWeight: 500, lineHeight: 1.5 }}
            />
          </>
        )}

        <div className="picker-preview">
          <span className={`bank-badge lg${logo ? ' has-img' : ` tone-${tone}`}`}>
            {logo ? <img className="bank-badge-img" src={logo} alt="" /> : <Icon name={icon} size={30} />}
          </span>
          <div>
            <div className="pp-name">{opts.subtitle || 'Preview'}</div>
            <div className="pp-sub">This is how it appears everywhere.</div>
          </div>
        </div>

        {showTone && (
          <>
            <label className="field-lbl">Colour</label>
            <div className="tone-row">
              {BANK_TONES.map((t) => (
                <button
                  key={t}
                  className={`tone-dot tone-${t}${t === tone ? ' on' : ''}`}
                  aria-label={`${t} colour`}
                  onClick={() => setTone(t)}
                />
              ))}
            </div>
          </>
        )}

        <label className="field-lbl" style={{ marginTop: 14 }}>Icon</label>
        <div className="icon-grid">
          {iconOptions.map((n) => (
            <button
              key={n}
              className={`icon-cell${n === icon && !logo ? ' on' : ''}`}
              title={n}
              onClick={() => { setIcon(n); setLogo(null); }}
            >
              <Icon name={n} size={19} />
            </button>
          ))}
        </div>

        {opts.allowUpload !== false && (
          <>
            <label className="field-lbl" style={{ marginTop: 14 }}>Or upload your own</label>
            <div className="pick-upload">
              <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer' }}>
                <Icon name="upload" size={13} />Upload image
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
                />
              </label>
              {logo && (
                <button className="btn btn-ghost btn-sm" onClick={() => setLogo(null)}>
                  <Icon name="x" size={13} />Remove image
                </button>
              )}
            </div>
          </>
        )}

        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={() => onClose(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={save}><Icon name="check" size={15} />Save</button>
        </div>
      </div>
    </div>
  );
}

export function LookPickerProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<Request | null>(null);

  const pickLook = (opts: LookPickOptions): Promise<LookPickResult | null> => {
    return new Promise((resolve) => {
      setRequest({ opts, resolve });
    });
  };

  const handleClose = (result: LookPickResult | null) => {
    if (request) request.resolve(result);
    setRequest(null);
  };

  return (
    <LookPickerContext.Provider value={{ pickLook }}>
      {children}
      {request && <PickerForm request={request} onClose={handleClose} />}
    </LookPickerContext.Provider>
  );
}
