import React from 'react';
import { RotateCcw, Crown, Loader2 } from 'lucide-react';
import { EmptyState, TeamCrest } from '../components/SharedComponents';
import { teamShort, OVERLAY_LAYERS, teamName, playerName } from '../lib/utils';
import { 
  aggregateMatchPerformers,
  getPlayerInningsBattingStats,
  getPlayerInningsBowlingStats
} from '../lib/cricketMath';
import { SceneRenderer } from './OverlayPage';

export default function BroadcastPage({ tournament, patch, broadcast, setBroadcast, loading }) {
  const matches = tournament.matches.filter((m) => m.status !== 'upcoming');

  // Pick the most recently played match
  const mostRecentlyPlayed = [...matches].reverse().find((m) => m.status === 'completed');
  const defaultMatchId = broadcast.matchId || matches.find((m) => m.status === 'live')?.id || mostRecentlyPlayed?.id || matches[matches.length - 1]?.id || '';
  const match = tournament.matches.find((m) => m.id === defaultMatchId);

  const layers = broadcast?.layers || {};
  const toggleLayer = (id) => {
    setBroadcast((b) => {
      const current = b.layers || {};
      const nextLayers = { ...current };
      if (id === 'bug') {
        nextLayers.bug = !current.bug;
      } else {
        const turningOn = !current[id];
        if (turningOn) {
          OVERLAY_LAYERS.forEach((l) => { if (l.id !== 'bug') nextLayers[l.id] = false; });
        }
        nextLayers[id] = turningOn;
      }
      return { ...b, layers: nextLayers };
    });
  };

  const perf = match ? aggregateMatchPerformers(match, tournament.teams) : { topScorers: [], topBowlers: [] };
  const allMatchPlayers = match ? [
    ...tournament.teams.find((t) => t.id === match.teamAId)?.players || [],
    ...tournament.teams.find((t) => t.id === match.teamBId)?.players || [],
  ] : [];
  const activeExtraLayers = OVERLAY_LAYERS.filter((l) => l.id !== 'bug' && layers[l.id]);

  if (loading) return <EmptyState icon={<Loader2 className="ct-spin" size={28} />} title="Loading broadcast control…" />;

  return (
    <div className="ct-stack">
      <div className="ct-card">
        <div className="ct-row-between">
          <div className="ct-card-title" style={{ marginBottom: 0 }}>Match on air</div>
          {broadcast.matchId && (
            <button
              className="ct-btn ct-btn-ghost ct-btn-sm"
              title="Stop pinning a specific match and follow whichever match is live automatically"
              onClick={() => setBroadcast((b) => ({ ...b, matchId: null }))}
            >
              <RotateCcw size={13} /> Follow latest match
            </button>
          )}
        </div>
        <select 
          className="ct-input" 
          value={defaultMatchId} 
          onChange={(e) => setBroadcast((b) => ({ ...b, matchId: e.target.value }))}
        >
          {matches.length === 0 && <option value="">No matches started yet</option>}
          {matches.map((m) => (
            <option key={m.id} value={m.id}>
              {teamShort(tournament.teams, m.teamAId)} vs {teamShort(tournament.teams, m.teamBId)} {m.status === 'live' ? '(live)' : '(completed)'}
            </option>
          ))}
        </select>
        <div className="ct-muted-note" style={{ paddingBottom: 0 }}>
          {broadcast.matchId
            ? 'Pinned to this match — it will stay selected even after another match finishes.'
            : 'Following automatically: live match if there is one, otherwise the most recently completed match.'}
        </div>
        {match?.tossWinner && (
          <div className="ct-toss-info-line">
            🪙 {teamName(tournament.teams, match.tossWinner)} won the toss, elected to {match.tossChoice === 'bat' ? 'bat' : 'bowl'} first
          </div>
        )}

        {match && (
          <>
            <label className="ct-field-label">Match stage (shows as a badge on overlay)</label>
            <div className="ct-toggle-row">
              {['Group Stage', 'Semi Final', 'Final'].map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`ct-toggle${match.stage === s ? ' ct-toggle-active' : ''}`}
                  onClick={() => patch((t) => { const m = t.matches.find((x) => x.id === match.id); m.stage = s; return t; })}
                >
                  {s}
                </button>
              ))}
            </div>
            <input
              className="ct-input ct-mt"
              placeholder="Or type a custom label, e.g. Quarter Final 2"
              value={match.stage || ''}
              onChange={(e) => patch((t) => { const m = t.matches.find((x) => x.id === match.id); m.stage = e.target.value; return t; })}
            />
          </>
        )}
      </div>

      <div className="ct-grid-2">
        <div className="ct-card">
          <div className="ct-card-title">On-air graphics — tick any combination</div>
          <div className="ct-muted-note">Every option here can be on at the same time — the overlay shows them together.</div>
          <div className="ct-scene-checklist ct-mt">
            {OVERLAY_LAYERS.map((s) => (
              <label className={`ct-scene-check-row${layers[s.id] ? ' ct-scene-check-active' : ''}`} key={s.id}>
                <input
                  type="checkbox"
                  checked={!!layers[s.id]}
                  onChange={() => toggleLayer(s.id)}
                />
                {s.icon} {s.label}
              </label>
            ))}
          </div>

          {layers.toss && (
            <label className="ct-check-row">
              <input
                type="checkbox"
                checked={!!broadcast.showCaptainPhotos}
                onChange={() => setBroadcast((b) => ({ ...b, showCaptainPhotos: !b.showCaptainPhotos }))}
              />
              Show captain photos on Toss graphic
            </label>
          )}

          {layers.lineup && match && (
            <>
              <label className="ct-field-label">Which team's lineup</label>
              <div className="ct-toggle-row">
                <button 
                  className={`ct-toggle${(broadcast.lineupTeamId || match.teamAId) === match.teamAId ? ' ct-toggle-active' : ''}`} 
                  onClick={() => setBroadcast((b) => ({ ...b, lineupTeamId: match.teamAId }))}
                >
                  {teamShort(tournament.teams, match.teamAId)}
                </button>
                <button 
                  className={`ct-toggle${broadcast.lineupTeamId === match.teamBId ? ' ct-toggle-active' : ''}`} 
                  onClick={() => setBroadcast((b) => ({ ...b, lineupTeamId: match.teamBId }))}
                >
                  {teamShort(tournament.teams, match.teamBId)}
                </button>
              </div>
            </>
          )}

          {layers.captains && match && (
            <div className="ct-toss-info-line">
              <Crown size={13} /> Set captains and their photos from the Teams page → Manage Squad.
            </div>
          )}

          {layers.motm && match && (
            <>
              <label className="ct-field-label">Player of the Match</label>
              <select
                className="ct-input"
                value={match.motmId || ''}
                onChange={(e) => patch((t) => { const m = t.matches.find((x) => x.id === match.id); m.motmId = e.target.value || null; return t; })}
              >
                <option value="">Select player</option>
                {allMatchPlayers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              {perf.topScorers[0] && (
                <div className="ct-muted-note">
                  Top scorer this match: {playerName(tournament.teams, perf.topScorers[0].id)} ({perf.topScorers[0].runs} runs)
                </div>
              )}
            </>
          )}
        </div>

        <div className="ct-card">
          <div className="ct-card-title">Live preview</div>
          <div className="ct-preview-frame ct-preview-frame-stack">
            {match ? (
              <>
                {layers.bug && <div className="ct-preview-note">Scorebug is live — open the actual overlay window from the sidebar to see it.</div>}
                {activeExtraLayers.map((l) => (
                  <div className="ct-preview-scene-item" key={l.id}>
                    <SceneRenderer tournament={tournament} match={match} scene={l.id} lineupTeamId={broadcast.lineupTeamId} showCaptainPhotos={broadcast.showCaptainPhotos} />
                  </div>
                ))}
                {!layers.bug && activeExtraLayers.length === 0 && (
                  <div className="ct-preview-note">Nothing is live on the overlay — tick a graphic above to put it on air.</div>
                )}
              </>
            ) : (
              <div className="ct-preview-note">No match selected yet.</div>
            )}
          </div>
        </div>
      </div>

      <div className="ct-muted-note">
        This panel controls what shows on the OBS/vMix overlay in real time. Any number of graphics can be on together with the scorebug.
      </div>
    </div>
  );
}