import React from 'react';
import { Trophy, Users, CalendarDays, Award, BarChart3, Target, ClipboardList, ChevronRight } from 'lucide-react';
import { EmptyState, TeamCrest } from '../components/SharedComponents';
import { teamShort, playerName } from '../lib/utils';
import { computePointsTable, aggregatePlayerStats } from '../lib/cricketMath';

export default function Dashboard({ tournament, onNavigate, setActiveMatchId }) {
  const live = tournament.matches.find(m => m.status === 'live');
  const upcoming = tournament.matches.filter(m => m.status === 'upcoming').slice(0, 5);
  const completed = tournament.matches.filter(m => m.status === 'completed').slice(-5).reverse();
  const table = computePointsTable(tournament).slice(0, 3);
  const { topRuns, topWickets } = aggregatePlayerStats(tournament);

  return (
    <div className="ct-stack">
      {live && (
        <div 
          className="ct-card ct-live-banner" 
          onClick={() => { setActiveMatchId(live.id); onNavigate('scoring'); }}
        >
          <div className="ct-live-dot" /> LIVE NOW — {teamShort(tournament.teams, live.teamAId)} vs {teamShort(tournament.teams, live.teamBId)}
          <ChevronRight size={18} />
        </div>
      )}

      <div className="ct-grid-3">
        <div className="ct-stat-card">
          <div className="ct-stat-num">{tournament.teams.length}</div>
          <div className="ct-stat-label">Teams</div>
        </div>
        <div className="ct-stat-card">
          <div className="ct-stat-num">{tournament.matches.length}</div>
          <div className="ct-stat-label">Matches</div>
        </div>
        <div className="ct-stat-card">
          <div className="ct-stat-num">{tournament.matches.filter(m => m.status === 'completed').length}</div>
          <div className="ct-stat-label">Completed</div>
        </div>
      </div>

      <div className="ct-grid-2">
        <div className="ct-card">
          <div className="ct-card-title">🏆 Points Table (Top 3)</div>
          {table.length === 0 ? (
            <EmptyState icon={<Award size={28} />} title="No results yet" />
          ) : (
            <table className="ct-table">
              <thead>
                <tr><th>Team</th><th>P</th><th>Pts</th><th>NRR</th></tr>
              </thead>
              <tbody>
                {table.map((r) => (
                  <tr key={r.teamId}>
                    <td>{teamShort(tournament.teams, r.teamId)}</td>
                    <td>{r.played}</td>
                    <td>{r.points}</td>
                    <td>{r.nrr.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="ct-card">
          <div className="ct-card-title">📋 Recent Results</div>
          {completed.length === 0 ? (
            <EmptyState icon={<ClipboardList size={28} />} title="No matches completed" />
          ) : (
            <div className="ct-stack-sm">
              {completed.map((m) => (
                <div className="ct-result-row" key={m.id}>
                  <span>{teamShort(tournament.teams, m.teamAId)} vs {teamShort(tournament.teams, m.teamBId)}</span>
                  <span className="ct-result-note">{m.result?.summary}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="ct-grid-2">
        <div className="ct-card">
          <div className="ct-card-title">🏏 Top Run Scorers</div>
          {topRuns.length === 0 ? (
            <EmptyState icon={<BarChart3 size={28} />} title="No runs scored yet" />
          ) : (
            <div className="ct-stack-sm">
              {topRuns.slice(0, 5).map((p) => (
                <div className="ct-result-row" key={p.id}>
                  <span>{p.name}</span>
                  <span className="ct-result-note">{p.runs} runs</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="ct-card">
          <div className="ct-card-title">🎯 Top Wicket Takers</div>
          {topWickets.length === 0 ? (
            <EmptyState icon={<Target size={28} />} title="No wickets yet" />
          ) : (
            <div className="ct-stack-sm">
              {topWickets.slice(0, 5).map((p) => (
                <div className="ct-result-row" key={p.id}>
                  <span>{p.name}</span>
                  <span className="ct-result-note">{p.wickets} wkts</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {upcoming.length > 0 && (
        <div className="ct-card">
          <div className="ct-card-title">📅 Upcoming Matches</div>
          <div className="ct-stack-sm">
            {upcoming.map((m) => (
              <div className="ct-result-row" key={m.id}>
                <span>{teamShort(tournament.teams, m.teamAId)} vs {teamShort(tournament.teams, m.teamBId)}</span>
                <span className="ct-result-note">{m.oversLimit} overs</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}