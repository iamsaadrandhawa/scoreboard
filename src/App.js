import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Trophy, Users, CalendarDays, Radio, ClipboardList, Award, BarChart3, Tv, Database, Menu, ChevronDown, Loader2, AlertTriangle } from 'lucide-react';

// Import all pages
import Dashboard from './pages/Dashboard';
import TeamsPage from './pages/TeamsPage';
import FixturesPage from './pages/FixturesPage';
import ScoringPage from './pages/ScoringPage';
import ScorecardsPage from './pages/ScorecardsPage';
import PointsTablePage from './pages/PointsTablePage';
import StatsPage from './pages/StatsPage';
import BroadcastPage from './pages/BroadcastPage';
import DataPage from './pages/DataPage';
import OverlayPage from './pages/OverlayPage';

// Import hooks
import { useSupabaseTournament, useSupabaseBroadcast } from './hooks/useSupabaseData';

// Import styles and components
import './App.css';
import { SetupScreen, TournamentSwitcherModal, InlineBroadcastControl } from './components/SharedComponents';
import { uid } from './lib/utils';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/overlay" element={<OverlayPage />} />
        <Route path="/*" element={<MainApp />} />
      </Routes>
    </BrowserRouter>
  );
}

function MainApp() {
  const navigate = useNavigate();
  const location = useLocation();
  
  const {
    tournament,
    setTournament,
    loading,
    saveState,
    connectionError,
    tournaments,
    activeId,
    switchTournament,
    createTournament,
    deleteTournament,
    renameTournament,
    uploadTeamLogo,
    uploadPlayerPhoto,
  } = useSupabaseTournament();

  const { broadcast, setBroadcast, loading: broadcastLoading } = useSupabaseBroadcast(activeId);
  
  const [navOpen, setNavOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [activeMatchId, setActiveMatchId] = useState(null);

  // Get current route
  const currentRoute = location.pathname.slice(1) || 'dashboard';

  const patchTournament = (fn) => {
    setTournament(prev => {
      if (!prev) return prev;
      const next = typeof fn === 'function' ? fn(structuredClone(prev)) : fn;
      return next;
    });
  };

  // Navigation items
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <Trophy size={17} /> },
    { id: 'teams', label: 'Teams', icon: <Users size={17} /> },
    { id: 'fixtures', label: 'Fixtures', icon: <CalendarDays size={17} /> },
    { id: 'scoring', label: 'Live Scoring', icon: <Radio size={17} /> },
    { id: 'scorecards', label: 'Scorecards', icon: <ClipboardList size={17} /> },
    { id: 'points', label: 'Points Table', icon: <Award size={17} /> },
    { id: 'stats', label: 'Stats', icon: <BarChart3 size={17} /> },
    { id: 'broadcast', label: 'Broadcast Control', icon: <Tv size={17} /> },
    { id: 'data', label: 'Data & Backup', icon: <Database size={17} /> },
  ];

  const openOverlay = () => {
    const url = window.location.origin + '/overlay';
    window.open(url, 'ct_overlay', 'width=1920,height=1080');
  };

  if (loading) {
    return (
      <div className="ct-root ct-loading-screen">
        <Loader2 className="ct-spin" size={28} />
        <div>Loading tournament…</div>
      </div>
    );
  }

  if (connectionError && !tournament) {
    return (
      <div className="ct-root ct-loading-screen">
        <AlertTriangle size={28} color="#F2A93B" />
        <div>Can't reach Supabase…</div>
        <div className="ct-empty-sub">
          Make sure you have a stable internet connection and your Supabase credentials are correct.
        </div>
      </div>
    );
  }

  if (!tournament) {
    return <SetupScreen onCreate={(t) => createTournament(t)} />;
  }

  const navigateTo = (route) => {
    navigate(`/${route}`);
    setNavOpen(false);
  };

  return (
    <div className="ct-root">
      <div className="ct-shell">
        <aside className={`ct-sidebar${navOpen ? ' ct-sidebar-open' : ''}`}>
          <button className="ct-brand ct-brand-btn" onClick={() => setSwitcherOpen(true)}>
            <div className="ct-brand-mark">🏏</div>
            <div>
              <div className="ct-brand-title">
                {tournament.name}
                {tournament.isDoubleWicket && (
                  <span className="ct-tag ct-tag-active" style={{ marginLeft: 6 }}>Double Wicket</span>
                )}
              </div>
              <div className="ct-brand-sub">
                {tournament.teams.length} teams · {tournament.matches.length} matches
              </div>
            </div>
            <ChevronDown size={16} className="ct-brand-chevron" />
          </button>
          
          <nav className="ct-nav">
            {navItems.map((item) => (
              <button
                key={item.id}
                className={`ct-nav-item${currentRoute === item.id ? ' ct-nav-item-active' : ''}`}
                onClick={() => navigateTo(item.id)}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
          
          <button className="ct-btn ct-btn-ghost ct-btn-block ct-overlay-launch" onClick={openOverlay}>
            <Radio size={15} /> Open Broadcast Overlay
          </button>
          
          <div className="ct-save-indicator">
            {saveState === 'saving' && <>Saving…</>}
            {saveState === 'saved' && <>All changes saved</>}
            {saveState === 'error' && <>Save failed</>}
          </div>
        </aside>

        <div className="ct-main">
          <header className="ct-topbar">
            <button className="ct-icon-btn ct-hide-desktop" onClick={() => setNavOpen(v => !v)}>
              <Menu size={20} />
            </button>
            <div className="ct-topbar-title">
              {navItems.find(item => item.id === currentRoute)?.label || 'Dashboard'}
            </div>
          </header>
          
          <div className="ct-content">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route 
                path="/dashboard" 
                element={
                  <Dashboard 
                    tournament={tournament} 
                    onNavigate={navigateTo}
                    setActiveMatchId={setActiveMatchId}
                  />
                } 
              />
              <Route 
                path="/teams" 
                element={
                  <TeamsPage 
                    tournament={tournament} 
                    patch={patchTournament}
                    uploadTeamLogo={uploadTeamLogo}
                  />
                } 
              />
              <Route 
                path="/fixtures" 
                element={
                  <FixturesPage 
                    tournament={tournament} 
                    patch={patchTournament}
                    onOpenMatch={(id) => { setActiveMatchId(id); navigateTo('scoring'); }}
                  />
                } 
              />
              <Route 
                path="/scoring" 
                element={
                  <ScoringPage 
                    tournament={tournament}
                    patch={patchTournament}
                    activeMatchId={activeMatchId}
                    setActiveMatchId={setActiveMatchId}
                    broadcast={broadcast}
                    setBroadcast={setBroadcast}
                    broadcastLoading={broadcastLoading}
                  />
                } 
              />
              <Route 
                path="/scoring/:matchId" 
                element={
                  <ScoringPage 
                    tournament={tournament}
                    patch={patchTournament}
                    activeMatchId={activeMatchId}
                    setActiveMatchId={setActiveMatchId}
                    broadcast={broadcast}
                    setBroadcast={setBroadcast}
                    broadcastLoading={broadcastLoading}
                  />
                } 
              />
              <Route 
                path="/scorecards" 
                element={<ScorecardsPage tournament={tournament} />} 
              />
              <Route 
                path="/points" 
                element={<PointsTablePage tournament={tournament} />} 
              />
              <Route 
                path="/stats" 
                element={<StatsPage tournament={tournament} />} 
              />
              <Route 
                path="/broadcast" 
                element={
                  <BroadcastPage 
                    tournament={tournament}
                    patch={patchTournament}
                    broadcast={broadcast}
                    setBroadcast={setBroadcast}
                    loading={broadcastLoading}
                  />
                } 
              />
              <Route 
                path="/data" 
                element={
                  <DataPage 
                    tournament={tournament}
                    setTournament={setTournament}
                  />
                } 
              />
            </Routes>
          </div>
        </div>
      </div>

      {switcherOpen && (
        <TournamentSwitcherModal
          tournaments={tournaments}
          activeId={activeId}
          onSwitch={async (id) => { await switchTournament(id); setSwitcherOpen(false); }}
          onCreate={async (t) => { await createTournament(t); setSwitcherOpen(false); }}
          onDelete={(id) => deleteTournament(id)}
          onRename={(id, name) => renameTournament(id, name)}
          onClose={() => setSwitcherOpen(false)}
        />
      )}
    </div>
  );
}

export default App;