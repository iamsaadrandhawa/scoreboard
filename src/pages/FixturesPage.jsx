import React, { useState } from 'react';
import { CalendarDays, Plus, Trash2, ChevronRight, ClipboardList, AlertTriangle } from 'lucide-react';
import { Modal, EmptyState } from '../components/SharedComponents';
import { uid, generateRoundRobin, teamShort } from '../lib/utils';

export default function FixturesPage({ tournament, patch, onOpenMatch }) {
  const [genOpen, setGenOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  const removeMatch = (id) => {
    if (!window.confirm('Remove this match?')) return;
    patch((t) => { 
      t.matches = t.matches.filter((m) => m.id !== id); 
      return t; 
    });
  };

  return (
    <div className="ct-stack">
      <div className="ct-row-between">
        <div className="ct-section-label">Fixtures</div>
        <div className="ct-row-gap">
          <button className="ct-btn ct-btn-ghost" onClick={() => setBulkOpen(true)} disabled={tournament.teams.length < 2}>
            <ClipboardList size={16} /> Bulk Import
          </button>
          <button className="ct-btn ct-btn-ghost" onClick={() => setManualOpen(true)}>
            <Plus size={16} /> Add Match
          </button>
          <button className="ct-btn ct-btn-primary" onClick={() => setGenOpen(true)} disabled={tournament.teams.length < 2}>
            <CalendarDays size={16} /> Generate Round-Robin
          </button>
        </div>
      </div>

      {tournament.matches.length === 0 ? (
        <EmptyState 
          icon={<CalendarDays size={32} />} 
          title="No fixtures yet" 
          sub="Generate a round-robin or add matches manually." 
        />
      ) : (
        <div className="ct-stack-sm">
          {tournament.matches.map((m, idx) => (
            <div className="ct-card ct-match-row" key={m.id}>
              <div className="ct-match-num">#{idx + 1}</div>
              <div className="ct-match-teams">
                <b>{teamShort(tournament.teams, m.teamAId)}</b> vs <b>{teamShort(tournament.teams, m.teamBId)}</b>
                <div className="ct-muted-note">
                  {m.oversLimit} overs · {m.status === 'completed' ? m.result?.summary : m.status}
                  {m.venue && ` · ${m.venue}`}
                </div>
              </div>
              <div className="ct-row-gap">
                {m.status !== 'completed' && (
                  <button className="ct-btn ct-btn-primary ct-btn-sm" onClick={() => onOpenMatch(m.id)}>
                    {m.status === 'live' ? 'Resume' : 'Start'} <ChevronRight size={14} />
                  </button>
                )}
                {m.status === 'completed' && (
                  <button className="ct-btn ct-btn-ghost ct-btn-sm" onClick={() => onOpenMatch(m.id)}>
                    View
                  </button>
                )}
                <button className="ct-icon-btn" onClick={() => removeMatch(m.id)}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {genOpen && (
        <RoundRobinModal
          tournament={tournament}
          onClose={() => setGenOpen(false)}
          onGenerate={(overs, double) => {
            patch((t) => {
              const generated = generateRoundRobin(
                t.teams.map((x) => x.id), 
                overs, 
                double
              );
              t.matches = [...t.matches, ...generated];
              return t;
            });
            setGenOpen(false);
          }}
        />
      )}
      {manualOpen && (
        <ManualMatchModal
          tournament={tournament}
          onClose={() => setManualOpen(false)}
          onAdd={(teamAId, teamBId, overs, venue) => {
            patch((t) => {
              t.matches.push({
                id: uid('match'),
                teamAId,
                teamBId,
                oversLimit: overs,
                status: 'upcoming',
                venue: venue || '',
                tossWinner: null,
                tossChoice: null,
                innings: [null, null],
                currentInnings: 0,
                result: null,
              });
              return t;
            });
            setManualOpen(false);
          }}
        />
      )}
      {bulkOpen && (
        <BulkImportFixturesModal tournament={tournament} patch={patch} onClose={() => setBulkOpen(false)} />
      )}
    </div>
  );
}

function RoundRobinModal({ tournament, onClose, onGenerate }) {
  const [overs, setOvers] = useState(tournament.defaultOvers || 20);
  const [double, setDouble] = useState(false);
  const count = tournament.teams.length;
  const totalMatches = double ? count * (count - 1) : (count * (count - 1)) / 2;

  return (
    <Modal title="Generate Round-Robin Fixtures" onClose={onClose}>
      <label className="ct-field-label">Overs per match</label>
      <input 
        className="ct-input" 
        type="number" 
        value={overs} 
        onChange={(e) => setOvers(Number(e.target.value))} 
      />
      <label className="ct-check-row">
        <input 
          type="checkbox" 
          checked={double} 
          onChange={(e) => setDouble(e.target.checked)} 
        />
        Home & away (each team plays every other team twice)
      </label>
      <div className="ct-muted-note">This will create {totalMatches} matches for {count} teams.</div>
      <button className="ct-btn ct-btn-primary ct-btn-block" onClick={() => onGenerate(overs, double)}>
        Generate {totalMatches} Matches
      </button>
    </Modal>
  );
}

function ManualMatchModal({ tournament, onClose, onAdd }) {
  const [teamA, setTeamA] = useState(tournament.teams[0]?.id || '');
  const [teamB, setTeamB] = useState(tournament.teams[1]?.id || '');
  const [overs, setOvers] = useState(tournament.defaultOvers || 20);
  const [venue, setVenue] = useState('');

  return (
    <Modal title="Add Match" onClose={onClose}>
      <label className="ct-field-label">Team A</label>
      <select className="ct-input" value={teamA} onChange={(e) => setTeamA(e.target.value)}>
        {tournament.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
      <label className="ct-field-label">Team B</label>
      <select className="ct-input" value={teamB} onChange={(e) => setTeamB(e.target.value)}>
        {tournament.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
      <label className="ct-field-label">Overs</label>
      <input 
        className="ct-input" 
        type="number" 
        value={overs} 
        onChange={(e) => setOvers(Number(e.target.value))} 
      />
      <label className="ct-field-label">Venue (optional)</label>
      <input 
        className="ct-input" 
        value={venue} 
        onChange={(e) => setVenue(e.target.value)} 
        placeholder="e.g. Shahkot Cricket Ground" 
      />
      <button 
        className="ct-btn ct-btn-primary ct-btn-block" 
        disabled={!teamA || !teamB || teamA === teamB} 
        onClick={() => onAdd(teamA, teamB, overs, venue.trim())}
      >
        Add Match
      </button>
    </Modal>
  );
}

function BulkImportFixturesModal({ tournament, patch, onClose }) {
  const [text, setText] = useState('');
  const [result, setResult] = useState(null);

  const findTeamId = (teams, name) => {
    const n = name.trim().toLowerCase();
    if (!n) return null;
    const exact = teams.find((t) => t.name.toLowerCase() === n || (t.short || '').toLowerCase() === n);
    if (exact) return exact.id;
    const partial = teams.find((t) => t.name.toLowerCase().includes(n) || n.includes(t.name.toLowerCase()));
    return partial ? partial.id : null;
  };

  const doImport = () => {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    let added = 0;
    const failed = [];
    patch((t) => {
      lines.forEach((line) => {
        const segments = line.split('|').map((s) => s.trim());
        const matchupPart = segments[0];
        const oversRaw = segments[1] ? Number(segments[1]) : NaN;
        const venue = segments[2] || '';
        const vsMatch = matchupPart.match(/(.+?)\s+vs\.?\s+(.+)/i);
        if (!vsMatch) { failed.push(line); return; }
        const teamAId = findTeamId(t.teams, vsMatch[1]);
        const teamBId = findTeamId(t.teams, vsMatch[2]);
        if (!teamAId || !teamBId || teamAId === teamBId) { failed.push(line); return; }
        t.matches.push({
          id: uid('match'),
          teamAId,
          teamBId,
          oversLimit: Number.isFinite(oversRaw) && oversRaw > 0 ? oversRaw : (t.defaultOvers || 20),
          status: 'upcoming',
          venue,
          tossWinner: null,
          tossChoice: null,
          innings: [null, null],
          currentInnings: 0,
          result: null,
        });
        added += 1;
      });
      return t;
    });
    setResult({ added, failed });
    setText('');
  };

  return (
    <Modal title="Bulk Import Fixtures" onClose={onClose} wide>
      <div className="ct-muted-note">
        One match per line: <code>Team A vs Team B</code>. Optionally add overs and venue:{' '}
        <code>Team A vs Team B | 20 | Gaddafi Stadium</code>. Team names must match (or closely
        match) teams already added on the Teams page.
      </div>
      <textarea
        className="ct-input ct-textarea"
        rows={10}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={
          "Lahore Lions vs Karachi Kings\n" +
          "Multan Sultans vs Peshawar Zalmi | 20 | Gaddafi Stadium"
        }
      />
      {result && (
        <div className="ct-stack-sm ct-mt">
          <div className="ct-toss-info-line">
            ✅ Added {result.added} match{result.added === 1 ? '' : 'es'}.
          </div>
          {result.failed.length > 0 && (
            <div className="ct-warning-note">
              <AlertTriangle size={15} />
              Couldn't match {result.failed.length} line{result.failed.length === 1 ? '' : 's'} to
              existing teams — check spelling: {result.failed.join(' · ')}
            </div>
          )}
        </div>
      )}
      <button className="ct-btn ct-btn-primary ct-btn-block" onClick={doImport} disabled={!text.trim()}>
        Import Fixtures
      </button>
    </Modal>
  );
}