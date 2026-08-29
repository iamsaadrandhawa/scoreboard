import React from 'react';
import { BarChart3, Target } from 'lucide-react';
import { EmptyState } from '../components/SharedComponents';  // Fix: import from SharedComponents
import { aggregatePlayerStats } from '../lib/cricketMath';

export default function StatsPage({ tournament }) {
  const { topRuns, topWickets } = aggregatePlayerStats(tournament);
  
  return (
    <div className="ct-grid-2">
      <div className="ct-card">
        <div className="ct-card-title">Most Runs</div>
        {topRuns.length === 0 ? (
          <EmptyState icon={<BarChart3 size={28} />} title="No data yet" />
        ) : (
          <table className="ct-table">
            <thead><tr><th>Player</th><th>M</th><th>Runs</th><th>Balls</th></tr></thead>
            <tbody>
              {topRuns.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td><td>{p.matches}</td><td>{p.runs}</td><td>{p.balls}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="ct-card">
        <div className="ct-card-title">Most Wickets</div>
        {topWickets.length === 0 ? (
          <EmptyState icon={<Target size={28} />} title="No data yet" />
        ) : (
          <table className="ct-table">
            <thead><tr><th>Player</th><th>M</th><th>O</th><th>R</th><th>W</th></tr></thead>
            <tbody>
              {topWickets.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td><td>{p.matches}</td><td>{p.oversStr}</td><td>{p.runs}</td><td>{p.wickets}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}