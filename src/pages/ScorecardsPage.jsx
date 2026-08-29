import React, { useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { EmptyState } from '../components/SharedComponents';
import { teamShort, playerName, ballsToOverStr } from '../lib/utils';
import { computeInningsStats } from '../lib/cricketMath';

export default function ScorecardsPage({ tournament }) {
  const [matchId, setMatchId] = useState(null);
  const playable = tournament.matches.filter((m) => m.status !== 'upcoming');
  const match = playable.find((m) => m.id === matchId) || playable[playable.length - 1];

  if (playable.length === 0) {
    return <EmptyState icon={<ClipboardList size={32} />} title="No matches started yet" />;
  }

  return (
    <div className="ct-stack">
      <select className="ct-input" value={match?.id || ''} onChange={(e) => setMatchId(e.target.value)}>
        {playable.map((m) => (
          <option key={m.id} value={m.id}>
            {teamShort(tournament.teams, m.teamAId)} vs {teamShort(tournament.teams, m.teamBId)} {m.status === 'live' ? '(live)' : ''}
          </option>
        ))}
      </select>
      {match && <FullScorecard tournament={tournament} match={match} />}
    </div>
  );
}

export function FullScorecard({ tournament, match }) {
  return (
    <div className="ct-stack">
      {match.innings.map((inn, idx) => inn && (
        <InningsCard key={idx} innings={inn} tournament={tournament} label={`Innings ${idx + 1}`} />
      ))}
    </div>
  );
}

function InningsCard({ innings, tournament, label }) {
  const stats = computeInningsStats(innings, tournament.teams);
  const battingOrderSorted = [...stats.battingOrder];

  return (
    <div className="ct-card">
      <div className="ct-card-title">{label}: {stats.battingTeam?.name} — {stats.totalRuns}/{stats.totalWickets} ({stats.oversStr} ov)</div>
      <table className="ct-table">
        <thead>
          <tr>
            <th>Batter</th>
            <th>R</th>
            <th>B</th>
          </tr>
        </thead>
        <tbody>
          {battingOrderSorted.map((id) => {
            const b = stats.batsmen[id];
            return (
              <tr key={id}>
                <td>
                  {playerName(tournament.teams, id)}{!b.out ? ' *' : ''}
                  {b.out && <div className="ct-dismissal-note">{dismissalText(b.howOut, tournament.teams)}</div>}
                </td>
                <td>{b.runs}</td>
                <td>{b.balls}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="ct-extras-line">
        Extras: {stats.extras.wd + stats.extras.nb + stats.extras.b + stats.extras.lb}
        {" "}(wd {stats.extras.wd}, nb {stats.extras.nb}, b {stats.extras.b}, lb {stats.extras.lb})
        {stats.extras.penalty !== 0 && <> · Out penalty: {stats.extras.penalty}</>}
        {stats.runAdjustment !== 0 && <> · Score correction: {stats.runAdjustment > 0 ? '+' : ''}{stats.runAdjustment}</>}
      </div>

      <div className="ct-card-title ct-mt">Bowling</div>
      <table className="ct-table">
        <thead>
          <tr>
            <th>Bowler</th>
            <th>O</th>
            <th>R</th>
            <th>W</th>
          </tr>
        </thead>
        <tbody>
          {Object.values(stats.bowlers).map((b) => (
            <tr key={b.id}>
              <td>{playerName(tournament.teams, b.id)}</td>
              <td>{ballsToOverStr(b.balls)}</td>
              <td>{b.runs}</td>
              <td>{b.wickets}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {stats.fow.length > 0 && (
        <div className="ct-fow">
          <b>Fall of wickets:</b> {stats.fow.map((f) => 
            `${f.score}-${f.wicketNum} (${playerName(tournament.teams, f.batsmanId)}, ${f.overStr} ov)`
          ).join(', ')}
        </div>
      )}
    </div>
  );
}

function dismissalText(howOut, teams) {
  if (!howOut) return '';
  if (howOut.type === 'Bowled') return `b ${playerName(teams, howOut.bowlerId)}`;
  if (howOut.type === 'LBW') return `lbw b ${playerName(teams, howOut.bowlerId)}`;
  if (howOut.type === 'Caught') return `c ${howOut.fielder || 'fielder'} b ${playerName(teams, howOut.bowlerId)}`;
  if (howOut.type === 'Stumped') return `st ${howOut.fielder || 'keeper'} b ${playerName(teams, howOut.bowlerId)}`;
  if (howOut.type === 'Run Out') return `run out${howOut.fielder ? ' (' + howOut.fielder + ')' : ''}`;
  if (howOut.type === 'Hit Wicket') return `hit wicket b ${playerName(teams, howOut.bowlerId)}`;
  return howOut.type;
}