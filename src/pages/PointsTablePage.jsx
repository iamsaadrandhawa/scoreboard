import React from 'react';
import { Award } from 'lucide-react';  // Add this import
import { EmptyState } from '../components/SharedComponents';
import { teamName } from '../lib/utils';
import { computePointsTable } from '../lib/cricketMath';

export default function PointsTablePage({ tournament }) {
  const pools = tournament.pools || [];
  if (tournament.teams.length === 0) return <EmptyState icon={<Award size={32} />} title="Add teams first" />;

  if (pools.length === 0) {
    const table = computePointsTable(tournament);
    return (
      <div className="ct-card">
        <table className="ct-table">
          <thead>
            <tr><th>#</th><th>Team</th><th>P</th><th>W</th><th>L</th><th>T</th><th>NR</th><th>Pts</th><th>NRR</th></tr>
          </thead>
          <PointsTableRows table={table} tournament={tournament} />
        </table>
      </div>
    );
  }

  const unassigned = tournament.teams.filter((t) => !t.poolId);

  return (
    <div className="ct-stack">
      {pools.map((pool) => {
        const poolTeamIds = tournament.teams.filter((t) => t.poolId === pool.id).map((t) => t.id);
        const table = computePointsTable(tournament, poolTeamIds);
        return (
          <div className="ct-card" key={pool.id}>
            <div className="ct-card-title">{pool.name}</div>
            {table.length === 0 ? (
              <div className="ct-muted-note">No teams assigned to this pool yet.</div>
            ) : (
              <table className="ct-table">
                <thead>
                  <tr><th>#</th><th>Team</th><th>P</th><th>W</th><th>L</th><th>T</th><th>NR</th><th>Pts</th><th>NRR</th></tr>
                </thead>
                <PointsTableRows table={table} tournament={tournament} />
              </table>
            )}
          </div>
        );
      })}
      {unassigned.length > 0 && (
        <div className="ct-card">
          <div className="ct-card-title">Unassigned</div>
          <table className="ct-table">
            <thead>
              <tr><th>#</th><th>Team</th><th>P</th><th>W</th><th>L</th><th>T</th><th>NR</th><th>Pts</th><th>NRR</th></tr>
            </thead>
            <PointsTableRows table={computePointsTable(tournament, unassigned.map((t) => t.id))} tournament={tournament} />
          </table>
        </div>
      )}
    </div>
  );
}

function PointsTableRows({ table, tournament }) {
  return (
    <tbody>
      {table.map((r, i) => (
        <tr key={r.teamId}>
          <td>{i + 1}</td>
          <td>{teamName(tournament.teams, r.teamId)}</td>
          <td>{r.played}</td><td>{r.won}</td><td>{r.lost}</td><td>{r.tied}</td><td>{r.noResult}</td>
          <td><b>{r.points}</b></td><td>{r.nrr >= 0 ? '+' : ''}{r.nrr.toFixed(3)}</td>
        </tr>
      ))}
    </tbody>
  );
}