// Generate unique ID
export const uid = (prefix = 'id') => 
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

// Team colors
export const TEAM_COLORS = [
  '#1D4ED8', '#DC2626', '#059669', '#D97706', 
  '#7C3AED', '#DB2777', '#0891B2', '#65A30D'
];

export const nextTeamColor = (teams) => TEAM_COLORS[teams.length % TEAM_COLORS.length];

// Get initials from name
export const initials = (name = '') => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

// Convert balls to overs string
export const ballsToOverStr = (validBalls) => {
  const overs = Math.floor(validBalls / 6);
  const rem = validBalls % 6;
  return `${overs}.${rem}`;
};

// Get team name by ID
export const teamName = (teams, id) => {
  const t = teams.find(x => x.id === id);
  return t ? t.name : 'TBD';
};

// Get team short name by ID
export const teamShort = (teams, id) => {
  const t = teams.find(x => x.id === id);
  return t ? (t.short || t.name.slice(0, 3).toUpperCase()) : 'TBD';
};

// Get player name by ID
export const playerName = (teams, id) => {
  for (const t of teams) {
    const p = t.players.find(pl => pl.id === id);
    if (p) return p.name;
  }
  return 'Unknown';
};

// Wicket types
export const WICKET_TYPES = [
  'Bowled', 'Caught', 'LBW', 'Run Out', 'Stumped', 'Hit Wicket', 'Retired Hurt'
];

// Overlay layers
export const OVERLAY_LAYERS = [
  { id: 'bug', label: 'Live Scorebug', icon: '📺' },
  { id: 'toss', label: 'Toss Result', icon: '🪙' },
  { id: 'lineup', label: 'Team Lineup', icon: '👥' },
  { id: 'captains', label: 'Captains Face-off', icon: '👑' },
  { id: 'scorecard', label: 'Live Scorecard', icon: '📊' },
  { id: 'points', label: 'Points Table', icon: '🏆' },
  { id: 'stats', label: 'Tournament Stats', icon: '📈' },
  { id: 'summary', label: 'Match Summary', icon: '📋' },
  { id: 'graph', label: 'Run Rate Graph', icon: '📉' },
  { id: 'ceremony', label: 'Post-Match Ceremony', icon: '🎉' },
  { id: 'motm', label: 'Man of the Match', icon: '⭐' },
  { id: 'upcoming', label: 'Upcoming Matches', icon: '📅' },
];

// Deep clone
export const structuredClone = (obj) => {
  try { return structuredClone(obj); } catch (e) { return JSON.parse(JSON.stringify(obj)); }
};

// Round-robin generator
export const generateRoundRobin = (teamIds, oversLimit, double) => {
  const matches = [];
  for (let i = 0; i < teamIds.length; i++) {
    for (let j = i + 1; j < teamIds.length; j++) {
      matches.push({
        id: uid('match'),
        teamAId: teamIds[i],
        teamBId: teamIds[j],
        oversLimit,
        status: 'upcoming',
        tossWinner: null,
        tossChoice: null,
        innings: [null, null],
        currentInnings: 0,
        result: null,
      });
      if (double) {
        matches.push({
          id: uid('match'),
          teamAId: teamIds[j],
          teamBId: teamIds[i],
          oversLimit,
          status: 'upcoming',
          tossWinner: null,
          tossChoice: null,
          innings: [null, null],
          currentInnings: 0,
          result: null,
        });
      }
    }
  }
  return matches;
};

// Default broadcast state
export const defaultBroadcastState = () => {
  const layers = {};
  OVERLAY_LAYERS.forEach(l => { layers[l.id] = l.id === 'bug'; });
  return { layers, matchId: null, lineupTeamId: null, showCaptainPhotos: false };
};

// Normalize broadcast layers
export const normalizeBroadcastLayers = (broadcast) => {
  if (broadcast?.layers) return broadcast.layers;
  const base = defaultBroadcastState().layers;
  if (broadcast?.scene) {
    if (broadcast.scene === 'none') base.bug = false;
    else base[broadcast.scene] = true;
  }
  return base;
};

// Add this function to utils.js
export const oversFloatForNRR = (validBalls) => {
  const overs = Math.floor(validBalls / 6);
  const rem = validBalls % 6;
  return overs + rem / 6;
};