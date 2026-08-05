import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon, IconName } from '../../utils/icons';
import { useExams } from '../../hooks/useExams';
import { useGroups } from '../../hooks/useGroups';
import { useTheme } from '../../hooks/useTheme';
import type { Exam, ExamGroup } from '../../types/exam';

interface PaletteItem {
  group: string;
  icon: IconName;
  title: string;
  sub?: string;
  hint?: string;
  run: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onDashboard: () => void;
  onProgress: () => void;
  onReview: (examId?: string) => void;
  onImport: () => void;
  onSettings: () => void;
  onGenerator: () => void;
  onStudy: (examId: string) => void;
  onExam: (examId: string) => void;
  onPractice: (examId: string) => void;
  onGroup: (groupId: string) => void;
}

function score(text: string, q: string): number {
  const t = text.toLowerCase();
  const n = q.length;
  if (!n) return 1;
  const direct = t.indexOf(q);
  if (direct === 0) return 1000;
  if (direct > 0) return 700 - Math.min(direct, 200) + (/[\s\-–—:·]/.test(t[direct - 1]) ? 120 : 0);

  let ti = 0, s = 0, run = 0;
  for (let i = 0; i < n; i++) {
    const at = t.indexOf(q[i], ti);
    if (at === -1) return 0;
    run = at === ti && i > 0 ? run + 1 : 0;
    s += 10 + run * 6 + (at === 0 || /[\s\-–—:·]/.test(t[at - 1]) ? 8 : 0);
    ti = at + 1;
  }
  return s - Math.min(t.length / 4, 40);
}

const ACCENT_NAMES = ['indigo', 'cyan', 'emerald', 'amber', 'rose', 'purple'] as const;
const LIGHT_THEMES = ['light', 'sepia'];

export function CommandPalette({
  isOpen, onClose, onDashboard, onProgress, onReview, onImport, onSettings,
  onGenerator, onStudy, onExam, onPractice, onGroup,
}: CommandPaletteProps) {
  const { exams } = useExams();
  const { groups } = useGroups();
  const { theme, setTheme, setAccent } = useTheme();
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setCursor(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [isOpen]);

  const items = useMemo<PaletteItem[]>(() => {
    const list: PaletteItem[] = [
      { group: 'Go', icon: 'dashboard', title: 'Dashboard', hint: 'D', run: onDashboard },
      { group: 'Go', icon: 'chart', title: 'Progress & analytics', hint: 'P', run: onProgress },
      { group: 'Go', icon: 'cards', title: 'Review — flashcards', hint: 'R', run: () => onReview(undefined) },
      { group: 'Go', icon: 'upload', title: 'Import a question bank', hint: 'I', run: onImport },
      { group: 'Go', icon: 'gear', title: 'Settings', hint: 'S', run: onSettings },
      { group: 'Action', icon: 'robot', title: 'Open AI Exam Generator', run: onGenerator },
      {
        group: 'Action',
        icon: LIGHT_THEMES.includes(theme) ? 'moon' : 'sun',
        title: `Switch to ${LIGHT_THEMES.includes(theme) ? 'dark' : 'light'} mode`,
        run: () => setTheme(LIGHT_THEMES.includes(theme) ? 'dark' : 'light'),
      },
    ];

    groups.forEach((g: ExamGroup) => {
      list.push({
        group: 'Exam Group', icon: 'layers', title: g.name,
        sub: `${g.links.length} link${g.links.length === 1 ? '' : 's'}`,
        run: () => onGroup(g.id),
      });
    });

    exams.forEach((e: Exam) => {
      list.push(
        { group: 'Exam', icon: (e.icon as IconName) || 'grad', title: `Exam: ${e.name}`, run: () => onExam(e.id) },
        { group: 'Practice', icon: 'brain', title: `Practice: ${e.name}`, run: () => onPractice(e.id) },
        { group: 'Study', icon: (e.icon as IconName) || 'grad', title: `Study: ${e.name}`, run: () => onStudy(e.id) },
        { group: 'Review', icon: (e.icon as IconName) || 'grad', title: `Review: ${e.name}`, run: () => onReview(e.id) }
      );
    });

    ACCENT_NAMES.forEach((a) => {
      list.push({
        group: 'Theme', icon: 'sparkle', title: `Accent: ${a.charAt(0).toUpperCase()}${a.slice(1)}`,
        run: () => setAccent(a),
      });
    });

    return list;
  }, [exams, groups, theme]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, 12);
    const ranked = items
      .map((it) => ({ it, s: score(it.title, q) + (it.sub ? score(it.sub, q) * 0.25 : 0) }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s);
    return ranked.slice(0, 40).map((r) => r.it);
  }, [items, query]);

  useEffect(() => setCursor(0), [shown]);

  const pick = (i: number) => {
    const it = shown[i];
    if (!it) return;
    onClose();
    setTimeout(() => it.run(), 10);
  };

  const move = (i: number) => {
    if (!shown.length) return;
    const next = (i + shown.length) % shown.length;
    setCursor(next);
    const row = listRef.current?.querySelector(`[data-i="${next}"]`);
    row?.scrollIntoView({ block: 'nearest' });
  };

  if (!isOpen) return null;

  let lastGroup: string | null = null;

  return (
    <div className="cp-veil" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cp-panel" role="dialog" aria-modal="true" aria-label="Command palette">
        <div className="cp-input-row">
          <Icon name="search" size={17} />
          <input
            ref={inputRef}
            id="cp-input"
            className="cp-input"
            placeholder="Search banks, questions and actions…"
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { e.preventDefault(); onClose(); }
              else if (e.key === 'ArrowDown') { e.preventDefault(); move(cursor + 1); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); move(cursor - 1); }
              else if (e.key === 'Enter') { e.preventDefault(); pick(cursor); }
            }}
          />
          <kbd className="cp-esc">Esc</kbd>
        </div>

        <div className="cp-results" id="cp-results" ref={listRef}>
          {shown.length === 0 ? (
            <div className="cp-empty">Nothing matches "{query}".</div>
          ) : (
            shown.map((it, i) => {
              const showHeader = it.group !== lastGroup;
              lastGroup = it.group;
              return (
                <div key={`${it.group}-${it.title}-${i}`}>
                  {showHeader && <div className="cp-group">{it.group}</div>}
                  <button
                    className={`cp-item${i === cursor ? ' on' : ''}`}
                    data-i={i}
                    onClick={() => pick(i)}
                    onMouseMove={() => setCursor(i)}
                  >
                    <span className="cp-ico"><Icon name={it.icon} size={15} /></span>
                    <span className="cp-body">
                      <span className="cp-title">{it.title}</span>
                      {it.sub && <span className="cp-sub">{it.sub}</span>}
                    </span>
                    {it.hint && <kbd>{it.hint}</kbd>}
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="cp-foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
          <span><kbd>↵</kbd> open</span>
        </div>
      </div>
    </div>
  );
}
