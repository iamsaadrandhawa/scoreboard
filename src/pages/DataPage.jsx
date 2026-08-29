import React, { useRef } from 'react';
import { Download, Upload, Database, AlertTriangle } from 'lucide-react';
import { uid } from '../lib/utils';

export default function DataPage({ tournament, setTournament }) {
  const fileInputRef = useRef(null);

  const exportBackup = () => {
    const blob = new Blob([JSON.stringify(tournament, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = (tournament.name || 'tournament').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    a.href = url;
    a.download = `${safeName}-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const importBackup = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed.teams || !parsed.matches) throw new Error('not a tournament file');
        if (!parsed.id) parsed.id = uid('tour');
        setTournament(parsed);
        alert('Backup restored successfully!');
      } catch (e) {
        alert('That file doesn\'t look like a valid tournament backup.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="ct-stack">
      <div className="ct-card">
        <div className="ct-card-title">Match Format</div>
        <div className="ct-muted-note">
          Turn this on for Double Wicket tournaments. When it's on, the Live Scoring screen shows an extra
          "OUT −2" button next to Wicket, which docks 2 runs from the batting team's total the moment a
          batter is given out. This counts as a normal legal delivery — it uses up a ball from the over,
          adds to the batter's and bowler's over count, and swaps the strike, exactly like any other
          scored ball. Leave this off for a normal tournament and scoring works exactly as before.
        </div>
        <label className="ct-check-row">
          <input
            type="checkbox"
            checked={!!tournament.isDoubleWicket}
            onChange={() => setTournament((prev) => (prev ? { ...prev, isDoubleWicket: !prev.isDoubleWicket } : prev))}
          />
          This is a Double Wicket tournament (−2 penalty on dismissal)
        </label>
      </div>

      <div className="ct-card">
        <div className="ct-card-title">Where your data actually lives</div>
        <div className="ct-muted-note">
          Everything you enter is saved to Supabase in the cloud. Your data is automatically synced 
          across all devices and browsers. The real-time updates mean any change you make appears 
          instantly on the broadcast overlay.
        </div>
        <div className="ct-muted-note" style={{ paddingTop: 0 }}>
          <strong>Pro tip:</strong> Use the backup feature below to download a local copy of your 
          tournament data for extra safety.
        </div>
      </div>

      <div className="ct-grid-2">
        <div className="ct-card">
          <div className="ct-card-title">Backup this tournament</div>
          <div className="ct-muted-note">Download everything — teams, fixtures, every ball bowled, stats — as one file you can keep anywhere.</div>
          <button className="ct-btn ct-btn-primary ct-btn-block" onClick={exportBackup}>
            <Download size={15} /> Download Backup (.json)
          </button>
        </div>
        <div className="ct-card">
          <div className="ct-card-title">Restore a backup</div>
          <div className="ct-muted-note">This replaces "{tournament.name}"'s data with the file you pick. To keep the current data too, open the tournament switcher (top of the sidebar) and create a new tournament first, then restore into that one instead.</div>
          <input 
            ref={fileInputRef} 
            type="file" 
            accept=".json" 
            style={{ display: 'none' }} 
            onChange={(e) => { 
              if (e.target.files[0]) importBackup(e.target.files[0]); 
              e.target.value = ''; 
            }} 
          />
          <button className="ct-btn ct-btn-ghost ct-btn-block" onClick={() => fileInputRef.current?.click()}>
            <Upload size={15} /> Choose Backup File
          </button>
        </div>
      </div>

      <div className="ct-card">
        <div className="ct-card-title">Running more than one tournament</div>
        <div className="ct-muted-note">
          Click the tournament name at the top of the sidebar to open the switcher — create a new tournament, 
          jump between existing ones, or rename/delete an old one. Each tournament is saved completely separately 
          in Supabase, so switching away from one never touches its data, and the OBS overlay always follows 
          whichever tournament you currently have open.
        </div>
      </div>

      <div className="ct-card">
        <div className="ct-card-title">Supabase Realtime Sync</div>
        <div className="ct-muted-note">
          <div className="ct-toss-info-line">
            <Database size={14} /> All data is stored in Supabase PostgreSQL
          </div>
          <div className="ct-toss-info-line">
            🔄 Real-time sync is active for matches, innings, balls, and broadcast state
          </div>
          <div className="ct-toss-info-line">
            📸 Team logos and player photos are stored in Supabase Storage
          </div>
          <div className="ct-muted-note" style={{ paddingTop: 8 }}>
            Any change you make in the app is instantly synced to the cloud and broadcast to the overlay.
            No refresh needed — everything updates in real-time.
          </div>
        </div>
      </div>
    </div>
  );
}