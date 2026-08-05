import { useCallback, useEffect, useState } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { ProfileProvider } from './contexts/ProfileContext';
import { ExamsProvider } from './contexts/ExamsContext';
import { GroupsProvider } from './contexts/GroupsContext';
import { DashboardStatsProvider } from './contexts/DashboardStatsContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';
import { DialogProvider } from './contexts/DialogContext';
import { LookPickerProvider } from './contexts/LookPickerContext';
import { ExplanationProvider } from './contexts/ExplanationContext';
import { AppShell } from './components/layout/AppShell';
import { CommandPalette } from './components/layout/CommandPalette';
import { Dashboard } from './components/views/Dashboard';
import { Study } from './components/views/Study';
import { Review } from './components/views/Review';
import { Exam, MixedSpec } from './components/views/Exam';
import { Practice } from './components/views/Practice';
import { Results } from './components/views/Results';
import { Progress } from './components/views/Progress';
import { Settings } from './components/views/Settings';
import { Importer } from './components/views/Importer';
import { Generator } from './components/views/Generator';
import { Group } from './components/views/Group';
import { Login } from './components/views/Login';
import { useAuth } from './hooks/useAuth';
import { useExams } from './hooks/useExams';
import { useGroups } from './hooks/useGroups';
import { Icon } from './utils/icons';
import { slugify } from './utils/slug';

type ViewState =
  | { name: 'dashboard' }
  | { name: 'study'; examSlug: string }
  | { name: 'review'; examSlug?: string }
  | { name: 'exam'; examSlug: string }
  | { name: 'exam-custom' }
  | { name: 'practice'; examSlug: string }
  | { name: 'results'; examSlug: string; attemptId: string }
  | { name: 'progress' }
  | { name: 'settings' }
  | { name: 'import' }
  | { name: 'generator' }
  | { name: 'group'; groupSlug: string };

function parseHash(hash: string): ViewState {
  const h = (hash || '').replace(/^#\/?/, '');
  const parts = h.split('/').filter(Boolean).map(decodeURIComponent);
  const name = parts[0] || 'dashboard';
  if (name === 'study' && parts[1]) return { name: 'study', examSlug: parts[1] };
  if (name === 'review') return { name: 'review', examSlug: parts[1] };
  if (name === 'exam-custom') return { name: 'exam-custom' };
  if (name === 'exam' && parts[1]) return { name: 'exam', examSlug: parts[1] };
  if (name === 'practice' && parts[1]) return { name: 'practice', examSlug: parts[1] };
  if (name === 'results' && parts[1] && parts[2]) return { name: 'results', examSlug: parts[1], attemptId: parts[2] };
  if (name === 'group' && parts[1]) return { name: 'group', groupSlug: parts[1] };
  if (name === 'progress') return { name: 'progress' };
  if (name === 'settings') return { name: 'settings' };
  if (name === 'import') return { name: 'import' };
  if (name === 'generator') return { name: 'generator' };
  return { name: 'dashboard' };
}

function hashFor(view: ViewState): string {
  switch (view.name) {
    case 'dashboard': return '#/dashboard';
    case 'study': return `#/study/${encodeURIComponent(view.examSlug)}`;
    case 'review': return view.examSlug ? `#/review/${encodeURIComponent(view.examSlug)}` : '#/review';
    case 'exam': return `#/exam/${encodeURIComponent(view.examSlug)}`;
    case 'exam-custom': return '#/exam-custom';
    case 'practice': return `#/practice/${encodeURIComponent(view.examSlug)}`;
    case 'results': return `#/results/${encodeURIComponent(view.examSlug)}/${encodeURIComponent(view.attemptId)}`;
    case 'progress': return '#/progress';
    case 'settings': return '#/settings';
    case 'import': return '#/import';
    case 'generator': return '#/generator';
    case 'group': return `#/group/${encodeURIComponent(view.groupSlug)}`;
  }
}

function useHashRouter(): [ViewState, (view: ViewState, opts?: { replace?: boolean }) => void] {
  const [view, setView] = useState<ViewState>(() => parseHash(window.location.hash));

  useEffect(() => {
    const onHashChange = () => setView(parseHash(window.location.hash));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = useCallback((next: ViewState, opts?: { replace?: boolean }) => {
    const nextHash = hashFor(next);
    if (window.location.hash === nextHash) {
      setView(next);
    } else if (opts?.replace) {
      // Renaming a group/bank changes its slug — swap the URL in place
      // instead of pushing a new history entry, so back-button doesn't land
      // on a now-dead old-slug hash.
      window.history.replaceState(null, '', nextHash);
      setView(next);
    } else {
      window.location.hash = nextHash;
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  return [view, navigate];
}

function LoadingScreen() {
  return (
    <div className="auth-gate">
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-mark brand">
            <Icon name="logo" size={30} strokeWidth={2} />
          </div>
          <div className="auth-spinner" />
          <p className="auth-sub" style={{ marginBottom: 0 }}>Loading…</p>
        </div>
      </div>
    </div>
  );
}

function AuthGate() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Login />;
  return <AppContent />;
}

const SUBTITLES: Record<string, string> = {
  dashboard: 'Your exam banks at a glance',
  review: 'Active recall, scheduled for you',
  progress: 'Trends, mastery and attempt history',
  settings: 'Make it yours',
  import: 'Bring your own questions',
  generator: 'AI-assisted question generation',
};

function AppContent() {
  const [view, navigate] = useHashRouter();
  const { exams } = useExams();
  const { groups } = useGroups();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [pendingDrill, setPendingDrill] = useState<{ examId: string; questionIds: string[]; label: string; passPct: number } | null>(null);
  const [pendingMixed, setPendingMixed] = useState<{ spec: MixedSpec; returnView: ViewState } | null>(null);

  const findExam = (id: string) => exams.find((e) => e.id === id);
  const findExamBySlug = (slug: string) => exams.find((e) => slugify(e.name) === slug);
  const findGroupBySlug = (slug: string) => groups.find((g) => slugify(g.name) === slug);
  const examSlugFor = (examId: string) => { const e = findExam(examId); return e ? slugify(e.name) : examId; };
  const groupSlugFor = (groupId: string) => { const g = groups.find((x) => x.id === groupId); return g ? slugify(g.name) : groupId; };

  const goDashboard = useCallback(() => navigate({ name: 'dashboard' }), [navigate]);
  const goStudy = useCallback((examId: string) => navigate({ name: 'study', examSlug: examSlugFor(examId) }), [navigate, exams]);
  const goReview = useCallback((examId?: string) => navigate({ name: 'review', examSlug: examId ? examSlugFor(examId) : undefined }), [navigate, exams]);
  const goExam = useCallback((examId: string) => navigate({ name: 'exam', examSlug: examSlugFor(examId) }), [navigate, exams]);
  const goPractice = useCallback((examId: string) => navigate({ name: 'practice', examSlug: examSlugFor(examId) }), [navigate, exams]);
  const goDrill = useCallback((examId: string, questionIds: string[], label: string, passPct: number) => {
    setPendingDrill({ examId, questionIds, label, passPct });
    navigate({ name: 'exam', examSlug: examSlugFor(examId) });
  }, [navigate, exams]);
  const goCustomExam = useCallback((spec: MixedSpec, returnView: ViewState) => {
    setPendingMixed({ spec, returnView });
    navigate({ name: 'exam-custom' });
  }, [navigate]);
  const goProgress = useCallback(() => navigate({ name: 'progress' }), [navigate]);
  const goSettings = useCallback(() => navigate({ name: 'settings' }), [navigate]);
  const goImport = useCallback(() => navigate({ name: 'import' }), [navigate]);
  const goGenerator = useCallback(() => navigate({ name: 'generator' }), [navigate]);
  const goGroup = useCallback((groupId: string) => navigate({ name: 'group', groupSlug: groupSlugFor(groupId) }), [navigate, groups]);
  // Exam/Practice's "close" exits into the exam's own group when it has one,
  // rather than always dropping back to the dashboard.
  const goExitFrom = useCallback((exam?: { group_id?: string | null }) => {
    if (exam?.group_id) goGroup(exam.group_id);
    else goDashboard();
  }, [goGroup, goDashboard]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setCommandPaletteOpen((o) => !o);
        return;
      }
      if (commandPaletteOpen) return;
      const target = e.target as HTMLElement;
      if (target?.matches?.('input,textarea,select')) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const jump: Record<string, () => void> = {
        d: goDashboard, i: goImport, p: goProgress, r: () => goReview(undefined), s: goSettings,
      };
      const fn = jump[e.key.toLowerCase()];
      if (fn) { e.preventDefault(); fn(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [commandPaletteOpen, goDashboard, goImport, goProgress, goReview, goSettings]);

  const getPageTitle = (): string => {
    switch (view.name) {
      case 'dashboard': return 'Dashboard';
      case 'study': return findExamBySlug(view.examSlug)?.name || 'Study';
      case 'review': return view.examSlug ? findExamBySlug(view.examSlug)?.name || 'Review' : 'Review';
      case 'exam': return findExamBySlug(view.examSlug)?.name || 'Exam';
      case 'exam-custom': return pendingMixed?.spec.label || 'Custom exam';
      case 'practice': return findExamBySlug(view.examSlug)?.name || 'Practice';
      case 'results': return 'Results';
      case 'progress': return 'Progress';
      case 'settings': return 'Settings';
      case 'import': return 'Import';
      case 'generator': return 'Generate with AI';
      case 'group': return findGroupBySlug(view.groupSlug)?.name || 'Exam Group';
    }
  };

  const renderView = () => {
    switch (view.name) {
      case 'dashboard':
        return (
          <Dashboard
            onStudy={goStudy} onExam={goExam} onPracticeBank={goPractice} onReviewBank={goReview}
            onImport={goImport} onGenerator={goGenerator} onProgress={goProgress} onGroup={goGroup}
          />
        );
      case 'study': {
        const exam = findExamBySlug(view.examSlug);
        if (!exam) return null;
        return <Study exam={exam} onBack={goDashboard} onReview={() => goReview(exam.id)} onExam={() => goExam(exam.id)} />;
      }
      case 'review': {
        const exam = view.examSlug ? findExamBySlug(view.examSlug) : undefined;
        return <Review exam={exam} onDashboard={goDashboard} onProgress={goProgress} onExam={goExam} onStudy={goStudy} />;
      }
      case 'exam': {
        const exam = findExamBySlug(view.examSlug);
        if (!exam) return null;
        const drill = pendingDrill && pendingDrill.examId === exam.id ? pendingDrill : undefined;
        return (
          <Exam
            exam={exam}
            drill={drill}
            onDrillConsumed={() => setPendingDrill(null)}
            onFinish={(attemptId) => navigate({ name: 'results', examSlug: slugify(exam.name), attemptId })}
            onExit={() => goExitFrom(exam)}
          />
        );
      }
      case 'exam-custom': {
        if (!pendingMixed) return null;
        const returnView = pendingMixed.returnView;
        return (
          <Exam
            mixed={pendingMixed.spec}
            onFinish={() => {}}
            onExit={() => { setPendingMixed(null); navigate(returnView); }}
          />
        );
      }
      case 'practice': {
        const exam = findExamBySlug(view.examSlug);
        if (!exam) return null;
        return <Practice exam={exam} onFinish={(attemptId) => navigate({ name: 'results', examSlug: slugify(exam.name), attemptId })} onExit={() => goExitFrom(exam)} />;
      }
      case 'results': {
        const exam = findExamBySlug(view.examSlug);
        if (!exam) return null;
        return (
          <Results
            attemptId={view.attemptId} exam={exam}
            onRetakeExam={() => goExam(exam.id)}
            onRetakePractice={() => goPractice(exam.id)}
            onDrill={(ids, label, passPct) => goDrill(exam.id, ids, label, passPct)}
            onStudy={() => goStudy(exam.id)}
            onProgress={goProgress}
            onDashboard={goDashboard}
          />
        );
      }
      case 'progress':
        return (
          <Progress
            onImport={goImport} onReviewBank={goReview}
            onDrill={goDrill}
            onDrillMixed={(spec) => goCustomExam(spec, { name: 'progress' })}
          />
        );
      case 'settings':
        return <Settings />;
      case 'import':
        return <Importer onImported={(exam) => navigate({ name: 'study', examSlug: slugify(exam.name) })} onCancel={goDashboard} onGenerator={goGenerator} />;
      case 'generator':
        return <Generator onImport={goImport} />;
      case 'group': {
        const group = findGroupBySlug(view.groupSlug);
        if (!group) return null;
        return (
          <Group
            groupId={group.id} onBack={goDashboard} onStudy={goStudy} onExam={goExam} onPracticeBank={goPractice}
            onStartCustomExam={(spec) => goCustomExam(spec, { name: 'group', groupSlug: view.groupSlug })}
            onRenamed={(newName) => navigate({ name: 'group', groupSlug: slugify(newName) }, { replace: true })}
            onImport={goImport}
          />
        );
      }
    }
  };

  const activeGroupId = view.name === 'group' ? findGroupBySlug(view.groupSlug)?.id : undefined;

  return (
    <>
      <AppShell
        activeName={view.name}
        activeGroupId={activeGroupId}
        pageTitle={getPageTitle()}
        pageSubtitle={SUBTITLES[view.name]}
        onCommandClick={() => setCommandPaletteOpen(true)}
        onBrandClick={goSettings}
        onDashboard={goDashboard}
        onReview={() => goReview(undefined)}
        onProgress={goProgress}
        onImport={goImport}
        onGenerator={goGenerator}
        onSettings={goSettings}
        onGroup={goGroup}
        onStudy={goStudy}
      >
        {renderView()}
      </AppShell>

      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onDashboard={goDashboard}
        onProgress={goProgress}
        onReview={goReview}
        onImport={goImport}
        onSettings={goSettings}
        onGenerator={goGenerator}
        onStudy={goStudy}
        onExam={goExam}
        onPractice={goPractice}
        onGroup={goGroup}
      />
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <ProfileProvider>
        <ExamsProvider>
          <GroupsProvider>
            <DashboardStatsProvider>
              <ThemeProvider>
                <ToastProvider>
                  <DialogProvider>
                    <LookPickerProvider>
                      <ExplanationProvider>
                        <AuthGate />
                      </ExplanationProvider>
                    </LookPickerProvider>
                  </DialogProvider>
                </ToastProvider>
              </ThemeProvider>
            </DashboardStatsProvider>
          </GroupsProvider>
        </ExamsProvider>
      </ProfileProvider>
    </AuthProvider>
  );
}

export default App;
