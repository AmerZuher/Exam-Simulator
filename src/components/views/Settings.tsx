import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { useProfile } from '../../hooks/useProfile';
import { useExams } from '../../hooks/useExams';
import { useGroups } from '../../hooks/useGroups';
import { useDialog } from '../../hooks/useDialog';
import { useLookPicker } from '../../hooks/useLookPicker';
import { useToast } from '../../hooks/useToast';
import { useDebouncedField } from '../../hooks/useDebouncedField';
import { Icon, IconName } from '../../utils/icons';
import { faviconUrl } from '../../utils/favicon';
import { isSafeUrl } from '../../utils/url';
import { BankBadge } from '../ui/BankBadge';
import { LinkFavicon } from '../ui/LinkFavicon';
import { Select } from '../ui/Select';
import { LoadingState } from '../ui/LoadingState';
import { EmptyState } from '../ui/EmptyState';
import type { SidebarLink, ThemeName } from '../../types/user';

const ACCENT_SWATCHES: [string, string][] = [
  ['indigo', '#6366f1'], ['cyan', '#06b6d4'], ['emerald', '#10b981'],
  ['amber', '#f59e0b'], ['rose', '#f43f5e'], ['purple', '#a855f7'],
  ['sky', '#7aa2f7'], ['mint', '#9ece6a'], ['coral', '#f7768e'], ['gold', '#ff9e64'],
];

const THEME_OPTS: { key: ThemeName; label: string; icon: IconName }[] = [
  { key: 'light', label: 'Light', icon: 'sun' },
  { key: 'sepia', label: 'Sepia', icon: 'book' },
  { key: 'dark', label: 'Dark', icon: 'moon' },
  { key: 'oled', label: 'OLED', icon: 'moon' },
  { key: 'tokyo-night', label: 'Tokyo Night', icon: 'sparkle' },
  { key: 'nord', label: 'Nord', icon: 'globe' },
];

const AI_PROVIDERS = [
  { key: 'openai', label: 'OpenAI' },
  { key: 'anthropic', label: 'Anthropic' },
  { key: 'google', label: 'Google' },
  { key: 'other', label: 'Other' },
];
const AI_MODEL_PLACEHOLDERS: Record<string, string> = {
  openai: 'e.g. gpt-4o', anthropic: 'e.g. claude-sonnet-5', google: 'e.g. gemini-2.5-pro', other: 'e.g. model name',
};

function AddShortcutModal({ onClose, onAdded }: { onClose: () => void; onAdded: (l: Omit<SidebarLink, 'id'>) => void }) {
  const { groups } = useGroups();
  const { exams } = useExams();
  const toast = useToast();
  const [type, setType] = useState<'group' | 'bank' | 'link'>('group');
  const [groupName, setGroupName] = useState(groups[0]?.id || '');
  const [bankKey, setBankKey] = useState(exams[0]?.id || '');
  const [mode, setMode] = useState<'exam' | 'study' | 'practice'>('exam');
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');

  const add = () => {
    if (type === 'group') {
      if (!groupName) { toast('Create an exam group first.', 'err'); return; }
      onAdded({ type: 'group', groupName });
    } else if (type === 'bank') {
      if (!bankKey) { toast('Import an exam bank first.', 'err'); return; }
      onAdded({ type: 'bank', bankKey, mode });
    } else {
      if (!label.trim() || !url.trim()) { toast('Enter both a label and a URL.', 'err'); return; }
      if (!isSafeUrl(url.trim())) { toast('Enter a valid http:// or https:// URL.', 'err'); return; }
      onAdded({ type: 'link', label: label.trim(), url: url.trim() });
    }
    onClose();
  };

  return (
    <div className="modal-veil" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-head">
          <div>
            <div className="modal-title">Add sidebar shortcut</div>
            <div className="modal-sub">Pin something to the sidebar for one-click access.</div>
          </div>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={15} /></button>
        </div>

        <div className="seg-tabs">
          <button type="button" className={`seg-tab${type === 'group' ? ' on' : ''}`} onClick={() => setType('group')}><Icon name="layers" size={13} />Exam Group</button>
          <button type="button" className={`seg-tab${type === 'bank' ? ' on' : ''}`} onClick={() => setType('bank')}><Icon name="book" size={13} />Exam Bank</button>
          <button type="button" className={`seg-tab${type === 'link' ? ' on' : ''}`} onClick={() => setType('link')}><Icon name="link" size={13} />Custom Link</button>
        </div>

        {type === 'group' && (
          <div style={{ marginTop: 14 }}>
            {groups.length ? (
              <>
                <label className="field-lbl">Group</label>
                <Select value={groupName} onChange={setGroupName} options={groups.map((g) => ({ value: g.id, label: g.name }))} />
              </>
            ) : (
              <div className="field-hint">No exam groups yet — create one from the dashboard first.</div>
            )}
          </div>
        )}

        {type === 'bank' && (
          <div style={{ marginTop: 14 }}>
            {exams.length ? (
              <>
                <label className="field-lbl">Bank</label>
                <Select value={bankKey} onChange={setBankKey} options={exams.map((e) => ({ value: e.id, label: e.name }))} />
                <label className="field-lbl" style={{ marginTop: 12 }}>Launch mode</label>
                <div className="seg-tabs">
                  <button type="button" className={`seg-tab${mode === 'exam' ? ' on' : ''}`} onClick={() => setMode('exam')}><Icon name="play" size={13} />Exam</button>
                  <button type="button" className={`seg-tab${mode === 'study' ? ' on' : ''}`} onClick={() => setMode('study')}><Icon name="study" size={13} />QA Review</button>
                </div>
              </>
            ) : (
              <div className="field-hint">No exam banks yet — import one first.</div>
            )}
          </div>
        )}

        {type === 'link' && (
          <div style={{ marginTop: 14 }}>
            <label className="field-lbl">Label</label>
            <input className="input" maxLength={40} placeholder="e.g. Course notes" value={label} onChange={(e) => setLabel(e.target.value)} />
            <label className="field-lbl" style={{ marginTop: 12 }}>URL</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span className="glink-preview-wrap">
                {url.trim() && faviconUrl(url.trim()) ? <LinkFavicon url={url.trim()} size={18} /> : <span style={{ width: 18, height: 18, display: 'inline-block' }} />}
              </span>
              <input className="input" maxLength={300} placeholder="https://… — paste a link and its logo shows up here" value={url} onChange={(e) => setUrl(e.target.value)} style={{ flex: 1 }} />
            </div>
          </div>
        )}

        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={add}><Icon name="check" size={15} />Add shortcut</button>
        </div>
      </div>
    </div>
  );
}

export function Settings() {
  const { user, signOut } = useAuth();
  const { theme, accent, accentCustom, setTheme, setAccent, setCustomAccent, accentPair } = useTheme();
  const { profile, loading: profileLoading, update } = useProfile();
  const { exams } = useExams();
  const { groups } = useGroups();
  const { confirm } = useDialog();
  const { pickLook } = useLookPicker();
  const toast = useToast();

  const [showKey, setShowKey] = useState(false);
  const [shortcutModalOpen, setShortcutModalOpen] = useState(false);
  const [hexInput, setHexInput] = useState(accentCustom || accentPair().a);
  const [avatarPreviewOpen, setAvatarPreviewOpen] = useState(false);

  // Debounced so typing never fires a save per keystroke — commits after a
  // pause or on blur (see useDebouncedField for why that matters here).
  const fullNameField = useDebouncedField(profile?.full_name || '', (v) => update({ full_name: v || null }));
  const taglineField = useDebouncedField(profile?.tagline || '', (v) => update({ tagline: v || null }));
  const aiModelField = useDebouncedField(profile?.ai_model || '', (v) => update({ ai_model: v }));
  const aiApiKeyField = useDebouncedField(profile?.ai_api_key || '', (v) => update({ ai_api_key: v }));

  if (profileLoading) {
    return <div className="view"><LoadingState label="Loading settings…" /></div>;
  }

  if (!profile) {
    return (
      <div className="view">
        <EmptyState
          icon="warn" title="Couldn't load your profile"
          desc="This usually means a database migration hasn't been run yet — check the migrations/ folder in the repo (run 002 through 005, in order), then reload."
          actions={<button className="btn btn-primary" onClick={() => window.location.reload()}><Icon name="refresh" size={15} />Reload</button>}
        />
      </div>
    );
  }

  const customHex = accentCustom || accentPair().a;
  const hasCustomImage = !!profile.avatar_url && !profile.avatar_url.startsWith('icon:');

  const handleChangePicture = async () => {
    const result = await pickLook({
      title: 'Profile picture', subtitle: profile.full_name || user?.email || 'Your account',
      icon: (profile.avatar_url?.startsWith('icon:') ? profile.avatar_url.slice(5) : 'user') as IconName,
      logo: profile.avatar_url && !profile.avatar_url.startsWith('icon:') ? profile.avatar_url : null,
      showTone: false,
    });
    if (!result) return;
    const avatar_url = result.logo || (result.icon ? `icon:${result.icon}` : null);
    await update({ avatar_url });
    toast('Picture updated.', 'ok');
  };

  const handleSignOut = async () => {
    const ok = await confirm({
      title: 'Sign out?',
      desc: "You'll need to sign in again to get back into ExamPro. Nothing stored is deleted.",
      confirmLabel: 'Sign out',
    });
    if (ok) await signOut();
  };

  const addShortcut = async (link: Omit<SidebarLink, 'id'>) => {
    const links = [...profile.sidebar_links, { ...link, id: crypto.randomUUID() }];
    await update({ sidebar_links: links });
    toast('Shortcut added.', 'ok');
  };

  const moveShortcut = async (id: string, dir: -1 | 1) => {
    const links = [...profile.sidebar_links];
    const i = links.findIndex((l) => l.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= links.length) return;
    [links[i], links[j]] = [links[j], links[i]];
    await update({ sidebar_links: links });
  };

  const removeShortcut = async (id: string) => {
    await update({ sidebar_links: profile.sidebar_links.filter((l) => l.id !== id) });
    toast('Shortcut removed.', 'info');
  };

  const shortcutStale = (l: SidebarLink) => {
    if (l.type === 'group') return !groups.find((g) => g.id === l.groupName);
    if (l.type === 'bank') return !exams.find((e) => e.id === l.bankKey);
    return false;
  };
  const shortcutLabel = (l: SidebarLink) => {
    if (l.type === 'group') return groups.find((g) => g.id === l.groupName)?.name || l.groupName || '';
    if (l.type === 'bank') return exams.find((e) => e.id === l.bankKey)?.name || l.bankKey || '';
    return l.label || '';
  };
  const shortcutTypeLabel = (l: SidebarLink) => l.type === 'group' ? 'Group' : l.type === 'bank' ? (l.mode === 'exam' ? 'Exam' : 'QA Review') : 'Link';
  const shortcutIcon = (l: SidebarLink) => {
    if (l.type === 'link' && l.url) return <LinkFavicon url={l.url} size={15} />;
    if (l.type === 'group') {
      const g = groups.find((x) => x.id === l.groupName);
      return <BankBadge icon={g?.icon} color={g?.color} logo={g?.logo} name={shortcutLabel(l)} size="sm" />;
    }
    const e = l.type === 'bank' ? exams.find((x) => x.id === l.bankKey) : undefined;
    return <BankBadge icon={e?.icon} color={e?.color} name={shortcutLabel(l)} size="sm" />;
  };

  return (
    <div className="view" style={{ maxWidth: 820, margin: '0 auto' }}>
      {/* ---- user profile ---- */}
      <section className="card card-pad rise settings-card">
        <div className="set-head">
          <div className="set-ico"><Icon name="user" size={17} /></div>
          <div><h3>User Profile</h3><p>Seeded from Google on first sign-in — everything here is yours to change.</p></div>
        </div>

        <div className="profile-head">
          <span className="avatar-ring">
            <span
              className={`bp-badge${hasCustomImage ? ' has-img editable' : ''}`}
              role={hasCustomImage ? 'button' : undefined}
              tabIndex={hasCustomImage ? 0 : undefined}
              aria-label={hasCustomImage ? 'View profile picture' : undefined}
              onClick={hasCustomImage ? () => setAvatarPreviewOpen(true) : undefined}
              onKeyDown={hasCustomImage ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAvatarPreviewOpen(true); } } : undefined}
            >
              {hasCustomImage ? (
                <img src={profile.avatar_url!} alt="" referrerPolicy="no-referrer" />
              ) : (
                <Icon name={(profile.avatar_url?.startsWith('icon:') ? profile.avatar_url.slice(5) : 'user') as IconName} size={30} strokeWidth={2} />
              )}
            </span>
            <button className="avatar-edit-btn" title="Change picture" aria-label="Change picture" onClick={handleChangePicture}>
              <Icon name="upload" size={12} strokeWidth={2.4} />
            </button>
          </span>
          <div style={{ minWidth: 0 }}>
            <div className="bp-name">{profile.full_name?.trim() || user?.email || 'Your account'}</div>
            {profile.tagline?.trim() && (
              <div className="bp-sub"><Icon name="briefcase" size={12} strokeWidth={2.4} /><span>{profile.tagline}</span></div>
            )}
            {user && (
              <div className="bp-account">
                <Icon name="shield" size={12} strokeWidth={2.4} /><span>{user.email}</span>
              </div>
            )}
          </div>
        </div>

        <div className="set-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 20 }}>
          <div>
            <label className="field-lbl">Username</label>
            <input
              className="input" maxLength={60} placeholder="Your name"
              value={fullNameField.value} onChange={(e) => fullNameField.onChange(e.target.value)} onBlur={fullNameField.onBlur}
            />
            <div className="field-hint">Defaults to your Google name — change it any time.</div>
          </div>
          <div>
            <label className="field-lbl">Role</label>
            <input
              className="input" maxLength={40} placeholder="e.g. Software Engineer"
              value={taglineField.value} onChange={(e) => taglineField.onChange(e.target.value)} onBlur={taglineField.onBlur}
            />
            <div className="field-hint">Shown as the chip under your name above.</div>
          </div>
        </div>

        <div className="signout-zone">
          <div>
            <div className="sz-t">Sign out</div>
            <div className="sz-s">You'll need to sign in again to get back into ExamPro.</div>
          </div>
          <button className="btn btn-danger btn-sm" onClick={handleSignOut}><Icon name="logout" size={14} />Sign out</button>
        </div>
      </section>

      {avatarPreviewOpen && hasCustomImage && (
        <div className="modal-veil" onMouseDown={(e) => { if (e.target === e.currentTarget) setAvatarPreviewOpen(false); }}>
          <div className="modal" role="dialog" aria-modal="true" style={{ maxWidth: 360 }}>
            <div className="modal-head">
              <div><div className="modal-title">Profile picture</div></div>
              <button className="icon-btn" onClick={() => setAvatarPreviewOpen(false)}><Icon name="x" size={15} /></button>
            </div>
            <img
              src={profile.avatar_url!} alt="" referrerPolicy="no-referrer"
              style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: 16, display: 'block' }}
            />
          </div>
        </div>
      )}

      {/* ---- appearance ---- */}
      <section className="card card-pad rise settings-card" style={{ animationDelay: '.05s' }}>
        <div className="set-head">
          <div className="set-ico"><Icon name="palette" size={17} /></div>
          <div><h3>Appearance</h3><p>Theme and accent colour, mirrored from the sidebar.</p></div>
        </div>
        <label className="field-lbl">Theme</label>
        <div className="seg-tabs" style={{ flexWrap: 'wrap' }}>
          {THEME_OPTS.map((t) => (
            <button key={t.key} type="button" className={`seg-tab${theme === t.key ? ' on' : ''}`} onClick={() => setTheme(t.key)}>
              <Icon name={t.icon} size={13} />{t.label}
            </button>
          ))}
        </div>

        <label className="field-lbl" style={{ marginTop: 16 }}>Accent</label>
        <div className="accent-picker">
          {ACCENT_SWATCHES.map(([name, hex]) => (
            <button
              key={name}
              className={`accent-swatch${accent === name ? ' on' : ''}`}
              style={{ background: hex }}
              title={name}
              aria-label={name}
              onClick={() => setAccent(name)}
            />
          ))}
          <span className="accent-sep" />
          <button
            className={`accent-swatch custom${accent === 'custom' ? ' on' : ''}`}
            style={{ background: customHex }}
            title="Custom colour"
            aria-label="Custom colour"
            onClick={() => setCustomAccent(hexInput)}
          >
            <Icon name="palette" size={15} />
          </button>
        </div>

        <div className={`custom-accent${accent === 'custom' ? ' open' : ''}`}>
          <input
            type="color"
            aria-label="Pick a custom accent colour"
            value={customHex}
            onChange={(e) => { setHexInput(e.target.value); setCustomAccent(e.target.value); }}
          />
          <input
            className="input mono"
            id="set-hex"
            maxLength={7}
            spellCheck={false}
            value={hexInput}
            aria-label="Accent hex value"
            onChange={(e) => { setHexInput(e.target.value); setCustomAccent(e.target.value); }}
          />
          <span className="field-hint" style={{ margin: 0 }}>Any hex colour — the gradient partner is derived for you.</span>
        </div>
      </section>

      {/* ---- study ---- */}
      <section className="card card-pad rise settings-card" style={{ animationDelay: '.1s' }}>
        <div className="set-head">
          <div className="set-ico"><Icon name="target" size={17} /></div>
          <div><h3>Study</h3><p>Defaults for review sessions and your daily target.</p></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }} className="set-grid">
          <div>
            <label className="field-lbl">Daily goal (questions)</label>
            <Select
              value={String(profile.daily_goal)}
              onChange={(v) => update({ daily_goal: parseInt(v, 10) })}
              options={[10, 20, 30, 50, 100].map((n) => ({ value: String(n), label: `${n} a day` }))}
            />
          </div>
          <div>
            <label className="field-lbl">Review session size</label>
            <Select
              value={String(profile.review_size)}
              onChange={(v) => update({ review_size: parseInt(v, 10) })}
              options={[10, 20, 30, 50].map((n) => ({ value: String(n), label: `${n} cards` }))}
            />
          </div>
        </div>
      </section>

      {/* ---- Shortcuts ---- */}
      <section className="card card-pad rise settings-card" style={{ animationDelay: '.12s' }}>
        <div className="set-head">
          <div className="set-ico"><Icon name="layers" size={17} /></div>
          <div><h3>Shortcuts</h3><p>Pin exam groups, specific banks, or your own links to the sidebar.</p></div>
        </div>
        <div className="shortcut-list">
          {profile.sidebar_links.length === 0 ? (
            <div className="field-hint">No shortcuts yet — add one below.</div>
          ) : (
            profile.sidebar_links.map((l, i) => {
              const stale = shortcutStale(l);
              return (
                <div key={l.id} className={`shortcut-row${stale ? ' is-stale' : ''}`}>
                  <span className="shortcut-ico">{shortcutIcon(l)}</span>
                  <div className="shortcut-body">
                    <div className="shortcut-label">{shortcutLabel(l)}{stale && <span className="chip chip-bad">Removed</span>}</div>
                    <span className="chip chip-mut">{shortcutTypeLabel(l)}</span>
                  </div>
                  <div className="shortcut-actions">
                    <button className="icon-btn" disabled={i === 0} onClick={() => moveShortcut(l.id, -1)} aria-label="Move up" title="Move up">
                      <span style={{ display: 'inline-flex', transform: 'rotate(180deg)' }}><Icon name="chevDown" size={13} strokeWidth={2.2} /></span>
                    </button>
                    <button className="icon-btn" disabled={i === profile.sidebar_links.length - 1} onClick={() => moveShortcut(l.id, 1)} aria-label="Move down" title="Move down">
                      <Icon name="chevDown" size={13} strokeWidth={2.2} />
                    </button>
                    <button className="icon-btn danger" onClick={() => removeShortcut(l.id)} aria-label="Remove shortcut" title="Remove">
                      <Icon name="trash" size={13} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
        <button className="btn btn-soft btn-sm" style={{ marginTop: 12 }} onClick={() => setShortcutModalOpen(true)}>
          <Icon name="layers" size={14} />Add shortcut
        </button>
      </section>

      {/* ---- ai (beta) ---- */}
      <section className="card card-pad rise settings-card" style={{ animationDelay: '.17s' }}>
        <div className="set-head">
          <div className="set-ico"><Icon name="robot" size={17} /></div>
          <div><h3>AI<span className="beta-badge">Beta</span></h3><p>Connect your own AI provider for generation features to use later. Not wired to any live calls yet.</p></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }} className="set-grid">
          <div>
            <label className="field-lbl">Provider</label>
            <Select value={profile.ai_provider} onChange={(v) => update({ ai_provider: v })} options={AI_PROVIDERS.map((p) => ({ value: p.key, label: p.label }))} />
          </div>
          <div>
            <label className="field-lbl">Model</label>
            <input
              className="input"
              maxLength={60}
              placeholder={AI_MODEL_PLACEHOLDERS[profile.ai_provider] || AI_MODEL_PLACEHOLDERS.other}
              value={aiModelField.value}
              onChange={(e) => aiModelField.onChange(e.target.value)}
              onBlur={aiModelField.onBlur}
            />
          </div>
        </div>
        <label className="field-lbl" style={{ marginTop: 14 }}>API key</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="input mono"
            type={showKey ? 'text' : 'password'}
            maxLength={200}
            placeholder="sk-…"
            value={aiApiKeyField.value}
            onChange={(e) => aiApiKeyField.onChange(e.target.value)}
            onBlur={aiApiKeyField.onBlur}
            style={{ flex: 1 }}
          />
          <button className="icon-btn" title={showKey ? 'Hide API key' : 'Show API key'} onClick={() => setShowKey(!showKey)}>
            <Icon name="eyeOff" size={15} />
          </button>
        </div>
        <div className="field-hint">Stored in your account only — ExamPro never sends it anywhere.</div>
      </section>

      {shortcutModalOpen && (
        <AddShortcutModal onClose={() => setShortcutModalOpen(false)} onAdded={addShortcut} />
      )}
    </div>
  );
}
