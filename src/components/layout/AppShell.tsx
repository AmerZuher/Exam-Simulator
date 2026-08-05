import { ReactNode, useState } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { useTheme } from '../../hooks/useTheme';

interface AppShellProps {
  children: ReactNode;
  activeName: string;
  activeGroupId?: string;
  pageTitle: string;
  pageSubtitle?: string;
  onBrandClick: () => void;
  onCommandClick: () => void;
  onDashboard: () => void;
  onReview: () => void;
  onProgress: () => void;
  onImport: () => void;
  onGenerator: () => void;
  onSettings: () => void;
  onGroup: (groupId: string) => void;
  onStudy: (examId: string) => void;
  showTimer?: boolean;
  timerValue?: string;
  onTimerPause?: () => void;
}

export function AppShell({
  children, activeName, activeGroupId, pageTitle, pageSubtitle,
  onBrandClick, onCommandClick,
  onDashboard, onReview, onProgress, onImport, onGenerator, onSettings, onGroup, onStudy,
  showTimer = false, timerValue = '00:00:00', onTimerPause,
}: AppShellProps) {
  const { sidebarCollapsed, setSidebarCollapsed } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const closeSidebar = () => {
    setSidebarOpen(false);
    document.body.classList.remove('no-scroll');
  };

  const openSidebar = () => {
    setSidebarOpen(true);
    document.body.classList.add('no-scroll');
  };

  return (
    <div className={`shell${sidebarCollapsed ? ' sb-collapsed' : ''}`}>
      <div className={`scrim${sidebarOpen ? ' show' : ''}`} id="scrim" onClick={closeSidebar} />

      <Sidebar
        activeName={activeName}
        activeGroupId={activeGroupId}
        isOpen={sidebarOpen}
        isCollapsed={sidebarCollapsed}
        onBrandClick={() => { closeSidebar(); onBrandClick(); }}
        onCollapseToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        onDashboard={() => { closeSidebar(); onDashboard(); }}
        onReview={() => { closeSidebar(); onReview(); }}
        onProgress={() => { closeSidebar(); onProgress(); }}
        onImport={() => { closeSidebar(); onImport(); }}
        onGenerator={() => { closeSidebar(); onGenerator(); }}
        onSettings={() => { closeSidebar(); onSettings(); }}
        onGroup={(id) => { closeSidebar(); onGroup(id); }}
        onStudy={(id) => { closeSidebar(); onStudy(id); }}
      />

      <div className="main">
        <Header
          title={pageTitle}
          subtitle={pageSubtitle}
          onHamburgerClick={openSidebar}
          onCommandClick={onCommandClick}
          onUserClick={onBrandClick}
          showTimer={showTimer}
          timerValue={timerValue}
          onTimerPause={onTimerPause}
        />
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
