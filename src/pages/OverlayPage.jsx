import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Trophy, Star, Users, Crown, Coins, CalendarDays, BarChart3, TrendingUp, PartyPopper, Award } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { 
  teamShort, 
  playerName, 
  ballsToOverStr, 
  OVERLAY_LAYERS, 
  defaultBroadcastState,
  normalizeBroadcastLayers,
  initials,
  teamName
} from '../lib/utils';
import { 
  computeInningsStats, 
  computeManhattan, 
  computePointsTable, 
  aggregatePlayerStats,
  aggregateMatchPerformers,
  getPlayerInningsBattingStats,
  getPlayerInningsBowlingStats
} from '../lib/cricketMath';
import { TeamCrest } from '../components/SharedComponents';

export default function OverlayPage() {
  const [tournament, setTournament] = useState(null);
  const [broadcast, setBroadcastState] = useState(defaultBroadcastState());
  const [flash, setFlash] = useState(null);
  const [diag, setDiag] = useState('connecting');
  const lastBallCountRef = useRef(null);
  const lastMatchIdRef = useRef(null);
  const flashTimerRef = useRef(null);
  const tournamentIdRef = useRef(null);

  useEffect(() => {
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';
    document.body.style.margin = '0';
  }, []);

  useEffect(() => {
    let cancelled = false;
    let tournamentSubscription = null;
    let broadcastSubscription = null;

   const loadTournament = async (id) => {
  if (!id) return null;

  try {
    // Load tournament basic info
    const { data: tournamentData, error: tournamentError } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', id)
      .single();

    if (tournamentError) throw new Error(`Tournament error: ${tournamentError.message}`);
    if (!tournamentData) throw new Error('Tournament not found');

    // Load teams with players
    const { data: teamsData, error: teamsError } = await supabase
      .from('teams')
      .select(`
        *,
        players:players(*)
      `)
      .eq('tournament_id', id);

    if (teamsError) throw new Error(`Teams error: ${teamsError.message}`);

    // Load matches with innings and balls
    const { data: matchesData, error: matchesError } = await supabase
      .from('matches')
      .select(`
        *,
        innings:innings(
          *,
          balls:balls(*)
        )
      `)
      .eq('tournament_id', id)
      .order('created_at', { ascending: true });

    if (matchesError) throw new Error(`Matches error: ${matchesError.message}`);

    // Load pools
    const { data: poolsData, error: poolsError } = await supabase
      .from('pools')
      .select('*')
      .eq('tournament_id', id);

    if (poolsError) throw new Error(`Pools error: ${poolsError.message}`);

    // Build tournament object
    const teams = teamsData.map(mapTeamFromDB);
    const matches = matchesData.map(m => ({
      ...mapMatchFromDB(m),
      innings: (m.innings || []).sort((a, b) => a.innings_num - b.innings_num).map(i => ({
        ...mapInningsFromDB(i),
        balls: (i.balls || []).sort((a, b) => a.ball_index - b.ball_index).map(mapBallFromDB),
      })),
    }));
    const pools = poolsData || [];

    return {
      id: tournamentData.id,
      name: tournamentData.name,
      defaultOvers: tournamentData.default_overs,
      isDoubleWicket: tournamentData.is_double_wicket,
      createdAt: tournamentData.created_at,
      teams,
      matches,
      pools,
    };
  } catch (error) {
    console.error('Load tournament error:', error);
    throw new Error(`Failed to load tournament: ${error.message || 'Unknown error'}`);
  }
};

    const loadBroadcast = async (tournamentId) => {
      if (!tournamentId) return null;

      const { data, error } = await supabase
        .from('broadcast_state')
        .select('*')
        .eq('tournament_id', tournamentId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Load broadcast error:', error);
        return null;
      }

      return data ? {
        matchId: data.match_id,
        layers: data.layers || {},
        lineupTeamId: data.lineup_team_id,
        showCaptainPhotos: data.show_captain_photos || false,
      } : null;
    };

    const init = async () => {
  try {
    // Get active tournament ID from local storage
    let activeId = localStorage.getItem('supabase_active_tournament');
    
    if (!activeId) {
      // If no active ID, get the most recent tournament
      const { data: tournaments, error } = await supabase
        .from('tournaments')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;
      if (tournaments && tournaments.length > 0) {
        activeId = tournaments[0].id;
      }
    }

    if (activeId) {
      tournamentIdRef.current = activeId;
      const data = await loadTournament(activeId);
      if (!cancelled && data) {
        setTournament(data);
        setDiag('ok');
      }
      
      const broadcastData = await loadBroadcast(activeId);
      if (!cancelled && broadcastData) {
        setBroadcastState(broadcastData);
      }
    } else {
      setDiag('no-tournament');
    }
  } catch (error) {
    // ✅ Fix: Extract error message properly
    console.error('Init error:', {
      message: error?.message || 'Unknown error',
      stack: error?.stack,
      details: error
    });
    
    if (!cancelled) {
      const errorMessage = error?.message || 
                          error?.toString() || 
                          'Failed to load tournament data';
      setDiag(`error: ${errorMessage}`);
    }
  }
};

    init();

    // Subscribe to tournament changes
    if (tournamentIdRef.current) {
      tournamentSubscription = supabase
        .channel(`tournament-${tournamentIdRef.current}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'tournaments',
          filter: `id=eq.${tournamentIdRef.current}`,
        }, async () => {
          const data = await loadTournament(tournamentIdRef.current);
          if (!cancelled && data) {
            setTournament(data);
          }
        })
        .subscribe();

      // Subscribe to broadcast changes
      broadcastSubscription = supabase
        .channel(`broadcast-${tournamentIdRef.current}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'broadcast_state',
          filter: `tournament_id=eq.${tournamentIdRef.current}`,
        }, async () => {
          const data = await loadBroadcast(tournamentIdRef.current);
          if (!cancelled && data) {
            setBroadcastState(data);
          }
        })
        .subscribe();
    }

    return () => {
      cancelled = true;
      if (tournamentSubscription) tournamentSubscription.unsubscribe();
      if (broadcastSubscription) broadcastSubscription.unsubscribe();
    };
  }, []);

  // Flash effect for boundaries/wickets
  const liveMatch = useMemo(() => {
    if (!tournament) return null;
    return tournament.matches.find((m) => m.status === 'live')
      || [...tournament.matches].reverse().find((m) => m.status === 'completed')
      || null;
  }, [tournament]);

  const sceneMatch = useMemo(() => {
    if (!tournament) return null;
    return tournament.matches.find((m) => m.id === broadcast.matchId) || liveMatch;
  }, [tournament, broadcast.matchId, liveMatch]);

  const innings = liveMatch ? liveMatch.innings[liveMatch.currentInnings] : null;
  const stats = innings ? computeInningsStats(innings, tournament?.teams) : null;

  const layers = normalizeBroadcastLayers(broadcast);
  const bugOn = !!layers.bug;
  const activeExtraLayers = OVERLAY_LAYERS.filter((l) => l.id !== 'bug' && layers[l.id]);

  useEffect(() => {
    if (!innings || !liveMatch || !bugOn) return;
    const matchKey = liveMatch.id + ':' + liveMatch.currentInnings;
    if (lastMatchIdRef.current !== matchKey) {
      lastMatchIdRef.current = matchKey;
      lastBallCountRef.current = innings.balls.length;
      return;
    }
    if (innings.balls.length > (lastBallCountRef.current || 0)) {
      const lastBall = innings.balls[innings.balls.length - 1];
      let type = null;
      if (lastBall.isWicket) type = 'OUT';
      else if (!lastBall.extra && lastBall.runsBat === 6) type = 'SIX';
      else if (!lastBall.extra && lastBall.runsBat === 4) type = 'FOUR';
      else if (lastBall.extra === 'nb' && lastBall.runsBat === 6) type = 'SIX';
      else if (lastBall.extra === 'nb' && lastBall.runsBat === 4) type = 'FOUR';
      else if (lastBall.extra === 'nb') type = 'NO BALL';
      if (type) {
        setFlash({ type, key: Date.now() });
        if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
        flashTimerRef.current = setTimeout(() => setFlash(null), 2200);
      }
    }
    lastBallCountRef.current = innings.balls.length;
  }, [innings, liveMatch, bugOn]);

 if (!tournament) {
  let msg = 'Connecting…';
  if (diag === 'error') {
    msg = 'Can\'t load tournament data — check your internet connection.';
  } else if (diag === 'no-tournament') {
    msg = 'No tournament open yet — open one in the main app tab.';
  } else if (diag && diag.startsWith('error:')) {
    // ✅ Display actual error message
    msg = diag.replace('error:', '').trim();
  }
  return (
    <div className="ct-overlay-root ct-overlay-waiting">
      <OverlayStyles />
      <div className="ct-overlay-diag">{msg}</div>
    </div>
  );
}

  const nothingActive = !bugOn && activeExtraLayers.length === 0;
  if (nothingActive) {
    return <div className="ct-overlay-root"><OverlayStyles /></div>;
  }

  if (bugOn && !liveMatch && activeExtraLayers.length === 0) {
    return (
      <div className="ct-overlay-root ct-overlay-waiting">
        <OverlayStyles />
        <div className="ct-overlay-diag">Tournament is open, but no match is live or completed yet — start a match from Live Scoring.</div>
      </div>
    );
  }

  const bugReady = bugOn && liveMatch && innings && stats;
  const battingTeam = bugReady ? tournament.teams.find((t) => t.id === innings.battingTeamId) : null;
  const bowlingTeam = bugReady ? tournament.teams.find((t) => t.id === innings.bowlingTeamId) : null;
  const striker = bugReady && innings.currentStrikerId ? stats.batsmen[innings.currentStrikerId] : null;
  const nonStriker = bugReady && innings.currentNonStrikerId ? stats.batsmen[innings.currentNonStrikerId] : null;
  const bowler = bugReady && innings.currentBowlerId ? stats.bowlers[innings.currentBowlerId] : null;
  const thisOverBalls = bugReady ? innings.balls.filter((b) => b.overNum === Math.floor(stats.validBalls / 6)) : [];
  
  const OVER_STRIP_WIDTH = 236;
  const OVER_STRIP_GAP = 4;
  const MAX_VISIBLE_OVER_BALLS = 12;
  const overBallsOverflow = Math.max(0, thisOverBalls.length - MAX_VISIBLE_OVER_BALLS);
  const shownOverBalls = overBallsOverflow > 0 ? thisOverBalls.slice(-MAX_VISIBLE_OVER_BALLS) : thisOverBalls;
  const overSlotCount = shownOverBalls.length + (overBallsOverflow > 0 ? 1 : 0);
  const overBallSize = overSlotCount > 0
    ? Math.max(15, Math.min(28, (OVER_STRIP_WIDTH - OVER_STRIP_GAP * (overSlotCount - 1)) / overSlotCount))
    : 28;
  const overBallFont = Math.max(8.5, Math.round(overBallSize * 0.4));
  const target = bugReady ? innings.target : null;
  const runsNeeded = target != null ? target - stats.totalRuns : null;
  const ballsLeft = target != null ? liveMatch.oversLimit * 6 - stats.validBalls : null;

  const scenesZoom = activeExtraLayers.length > 1
    ? (bugOn ? 0.78 : 0.92)
    : (bugOn ? 1 : 1.15);

  return (
    <div className="ct-overlay-root ct-overlay-multi-root">
      <OverlayStyles />

      {activeExtraLayers.length > 0 && (
        <div className="ct-overlay-scenes-area">
          <div
            className={`ct-overlay-scenes-row${activeExtraLayers.length > 1 ? ' ct-overlay-scenes-multi' : ''}`}
            style={{ zoom: scenesZoom }}
          >
            {activeExtraLayers.map((l) => (
              <div className="ct-overlay-scene-slot" key={l.id}>
                {sceneMatch ? (
                  <SceneRenderer 
                    tournament={tournament} 
                    match={sceneMatch} 
                    scene={l.id} 
                    lineupTeamId={broadcast.lineupTeamId} 
                    showCaptainPhotos={broadcast.showCaptainPhotos} 
                  />
                ) : (
                  <div className="ct-scene ct-overlay-waiting">No match selected for {l.label}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {bugOn && (
        <div className="ct-overlay-bug-wrap">
          {flash && (
            <div key={flash.key} className={`ct-flash ct-flash-${flash.type.replace(' ', '')}`}>
              <div className="ct-flash-boundary">
                <div className="ct-flash-ring" />
                <div className="ct-flash-ring ct-flash-ring-2" />
                <div className={`ct-flash-num${flashCenterText(flash.type).length > 1 ? ' ct-flash-num-sm' : ''}`}>
                  {flashCenterText(flash.type)}
                </div>
                <div className="ct-flash-word">{flashWordText(flash.type)}</div>
              </div>
            </div>
          )}
          {bugReady ? (
            <div className="ct-overlay-bug-slot">
              {liveMatch.status === 'completed' && (
                <div className="ct-overlay-result">🏆 {liveMatch.result?.summary}</div>
              )}
              {liveMatch.stage && <div className="ct-ov-stage-tag">{liveMatch.stage}</div>}
              <div className="ct-overlay-bar">
                <div className="ct-ov-score-pill">
                  <TeamCrest team={battingTeam} className="ct-ov-crest" fallbackColor="#7C3AED" />
                  <span className="ct-ov-team">{teamShort(tournament.teams, battingTeam.id)}</span>
                  <span className="ct-ov-runs">{stats.totalRuns}/{stats.totalWickets}</span>
                  <span className="ct-ov-overs">Ov {stats.oversStr}</span>
                </div>

                <div className="ct-ov-batsmen">
                  {striker && (
                    <div className="ct-ov-player-chip ct-ov-onstrike">
                      <span className="ct-ov-dot" /> {playerName(tournament.teams, striker.id)}
                      <b>{striker.runs} ({striker.balls})</b>
                    </div>
                  )}
                  {nonStriker && (
                    <div className="ct-ov-player-chip">
                      {playerName(tournament.teams, nonStriker.id)}
                      <b>{nonStriker.runs} ({nonStriker.balls})</b>
                    </div>
                  )}
                </div>

                <div className="ct-ov-bowler">
                  {bowler && (
                    <div className="ct-ov-player-chip ct-ov-bowler-chip">
                      {playerName(tournament.teams, bowler.id)}
                      <b>{bowler.wickets}-{bowler.runs} ({ballsToOverStr(bowler.balls)})</b>
                    </div>
                  )}
                </div>

                <div className="ct-ov-thisover" style={{ width: OVER_STRIP_WIDTH, gap: OVER_STRIP_GAP }}>
                  {overBallsOverflow > 0 && (
                    <span
                      className="ct-ov-ball ct-ov-ball-more"
                      style={{ minWidth: overBallSize, height: overBallSize, fontSize: overBallFont, borderRadius: overBallSize / 2 }}
                    >
                      +{overBallsOverflow}
                    </span>
                  )}
                  {shownOverBalls.map((b, i) => {
                    const isFour = (!b.extra && b.runsBat === 4) || (b.extra === 'nb' && b.runsBat === 4);
                    const isSix = (!b.extra && b.runsBat === 6) || (b.extra === 'nb' && b.runsBat === 6);
                    return (
                      <span
                        key={i}
                        className={
                          'ct-ov-ball' +
                          (b.isWicket ? ' ct-ov-ball-w' : '') +
                          (b.extra === 'nb' ? ' ct-ov-ball-nb' : '') +
                          (b.extra === 'wd' ? ' ct-ov-ball-wd' : '') +
                          (isFour ? ' ct-ov-ball-4' : '') +
                          (isSix ? ' ct-ov-ball-6' : '') +
                          (b.extra === 'penalty' ? ' ct-ov-ball-penalty' : '')
                        }
                        style={{ minWidth: overBallSize, height: overBallSize, fontSize: overBallFont, borderRadius: overBallSize / 2 }}
                      >
                        {ballLabel(b)}
                      </span>
                    );
                  })}
                </div>
              </div>

              {target != null && liveMatch.status === 'live' && (
                <div className="ct-ov-target">
                  Target {target} · Need {Math.max(runsNeeded, 0)} off {Math.max(ballsLeft, 0)} balls
                </div>
              )}
            </div>
          ) : (
            <div className="ct-overlay-bug-slot ct-overlay-waiting">Waiting for a live match…</div>
          )}
        </div>
      )}
    </div>
  );
}

// Helper functions for overlay
function flashCenterText(type) {
  if (type === 'SIX') return '6';
  if (type === 'FOUR') return '4';
  if (type === 'OUT') return 'W';
  if (type === 'WIDE') return 'WD';
  if (type === 'NO BALL') return 'FH';
  return '';
}

function flashWordText(type) {
  if (type === 'NO BALL') return 'FREE HIT';
  if (type === 'OUT') return 'WICKET';
  return type;
}

function ballLabel(b) {
  if (b.isWicket) return 'W';
  if (b.extra === 'wd') return `wd${b.extraRuns ? '+' + b.extraRuns : ''}`;
  if (b.extra === 'nb') return `nb${b.runsBat ? '+' + b.runsBat : ''}`;
  if (b.extra === 'b') return `${b.extraRuns}b`;
  if (b.extra === 'lb') return `${b.extraRuns}lb`;
  if (b.extra === 'penalty') return `${b.runsBat}`;
  return String(b.runsBat);
}

// Map functions for Supabase data
function mapTeamFromDB(team) {
  return {
    id: team.id,
    name: team.name,
    short: team.short,
    color: team.color,
    logo: team.logo_url,
    captainId: team.captain_id,
    poolId: team.pool_id,
    players: team.players || [],
  };
}

function mapMatchFromDB(match) {
  return {
    id: match.id,
    tournamentId: match.tournament_id,
    teamAId: match.team_a_id,
    teamBId: match.team_b_id,
    oversLimit: match.overs_limit,
    venue: match.venue,
    stage: match.stage,
    status: match.status,
    tossWinner: match.toss_winner_id,
    tossChoice: match.toss_choice,
    currentInnings: match.current_innings,
    result: match.result,
    motmId: match.motm_id,
    playingXI: match.playing_xi,
    innings: match.innings || [],
  };
}

function mapInningsFromDB(innings) {
  return {
    id: innings.id,
    matchId: innings.match_id,
    inningsNum: innings.innings_num,
    battingTeamId: innings.batting_team_id,
    bowlingTeamId: innings.bowling_team_id,
    currentStrikerId: innings.current_striker_id,
    currentNonStrikerId: innings.current_non_striker_id,
    currentBowlerId: innings.current_bowler_id,
    previousBowlerId: innings.previous_bowler_id,
    target: innings.target,
    runAdjustment: innings.run_adjustment,
    isComplete: innings.is_complete,
    balls: innings.balls || [],
  };
}

function mapBallFromDB(ball) {
  return {
    id: ball.id,
    inningsId: ball.innings_id,
    ballIndex: ball.ball_index,
    overNum: ball.over_num,
    batsmanId: ball.batsman_id,
    nonStrikerId: ball.non_striker_id,
    bowlerId: ball.bowler_id,
    runsBat: ball.runs_bat,
    extra: ball.extra,
    extraRuns: ball.extra_runs,
    isWicket: ball.is_wicket,
    wicketType: ball.wicket_type,
    outBatsmanId: ball.out_batsman_id,
    fielderNote: ball.fielder_note,
  };
}

// Scene Renderer component
function SceneRenderer({ tournament, match, scene, lineupTeamId, showCaptainPhotos }) {
  if (!match) return <div className="ct-overlay-waiting">No match selected</div>;
  const teamA = tournament.teams.find((t) => t.id === match.teamAId);
  const teamB = tournament.teams.find((t) => t.id === match.teamBId);

  // Toss scene
  if (scene === 'toss') {
    const winnerTeam = match.tossWinner ? tournament.teams.find((t) => t.id === match.tossWinner) : null;
    const capA = teamA?.players.find((p) => p.id === teamA.captainId);
    const capB = teamB?.players.find((p) => p.id === teamB.captainId);
    return (
      <div className="ct-scene ct-scene-matchup">
        {match.stage && <div className="ct-stage-pill">{match.stage}</div>}
        <div className="ct-matchup-eventbar">{tournament.name}</div>
        <div className="ct-matchup-venuebar">{match.venue || 'Venue TBC'}</div>
        <div className="ct-matchup-body">
          <div className="ct-matchup-side">
            {showCaptainPhotos && capA?.photo ? (
              <img className="ct-captain-crest-photo" src={capA.photo} alt="" style={{ borderColor: teamA?.color || '#7C3AED' }} />
            ) : (
              <TeamCrest team={teamA} className="ct-matchup-crest" fallbackColor="#7C3AED" />
            )}
            <div className="ct-matchup-teamname">{teamA?.name}</div>
            {showCaptainPhotos && capA && <div className="ct-captain-sub-label">{capA.name} (C)</div>}
          </div>
          <div className="ct-matchup-vs">VS</div>
          <div className="ct-matchup-side">
            {showCaptainPhotos && capB?.photo ? (
              <img className="ct-captain-crest-photo" src={capB.photo} alt="" style={{ borderColor: teamB?.color || '#DB2777' }} />
            ) : (
              <TeamCrest team={teamB} className="ct-matchup-crest" fallbackColor="#DB2777" />
            )}
            <div className="ct-matchup-teamname">{teamB?.name}</div>
            {showCaptainPhotos && capB && <div className="ct-captain-sub-label">{capB.name} (C)</div>}
          </div>
        </div>
        <div className="ct-matchup-footer">
          {winnerTeam
            ? `${winnerTeam.name.toUpperCase()} WON THE TOSS & CHOSE TO ${match.tossChoice === 'bat' ? 'BAT' : 'BOWL'}`
            : `${match.oversLimit}-OVER MATCH`}
        </div>
      </div>
    );
  }

  // Captains scene
  if (scene === 'captains') {
    const capA = teamA?.players.find((p) => p.id === teamA.captainId);
    const capB = teamB?.players.find((p) => p.id === teamB.captainId);
    return (
      <div className="ct-scene ct-scene-matchup ct-scene-captains">
        {match.stage && <div className="ct-stage-pill">{match.stage}</div>}
        <div className="ct-matchup-eventbar">{tournament.name}</div>
        <div className="ct-matchup-venuebar">Captains</div>
        <div className="ct-matchup-body">
          <div className="ct-matchup-side">
            {capA?.photo ? (
              <img className="ct-captain-crest-photo" src={capA.photo} alt="" style={{ borderColor: teamA?.color || '#7C3AED' }} />
            ) : capA ? (
              <div className="ct-matchup-crest" style={{ background: teamA?.color || '#7C3AED' }}>{initials(capA.name)}</div>
            ) : (
              <TeamCrest team={teamA} className="ct-matchup-crest" fallbackColor="#7C3AED" />
            )}
            <div className="ct-matchup-teamname">{capA ? capA.name : 'No captain set'}</div>
            <div className="ct-captain-sub-label">{teamA?.name}</div>
          </div>
          <div className="ct-matchup-vs">VS</div>
          <div className="ct-matchup-side">
            {capB?.photo ? (
              <img className="ct-captain-crest-photo" src={capB.photo} alt="" style={{ borderColor: teamB?.color || '#DB2777' }} />
            ) : capB ? (
              <div className="ct-matchup-crest" style={{ background: teamB?.color || '#DB2777' }}>{initials(capB.name)}</div>
            ) : (
              <TeamCrest team={teamB} className="ct-matchup-crest" fallbackColor="#DB2777" />
            )}
            <div className="ct-matchup-teamname">{capB ? capB.name : 'No captain set'}</div>
            <div className="ct-captain-sub-label">{teamB?.name}</div>
          </div>
        </div>
        <div className="ct-matchup-footer">{match.venue || 'Captains'}</div>
      </div>
    );
  }

  // Scorecard scene
  if (scene === 'scorecard') {
    const inn = match.innings[match.currentInnings] || match.innings[0];
    if (!inn) return <div className="ct-overlay-waiting">No innings data yet</div>;
    const s = computeInningsStats(inn, tournament.teams);
    const team = s.battingTeam;
    const extrasTotal = s.extras.wd + s.extras.nb + s.extras.b + s.extras.lb;
    const MAX_SC_ROWS = 8;
    const orderedIds = [...s.battingOrder].reverse();
    const shownIds = orderedIds.slice(0, MAX_SC_ROWS);
    const hiddenCount = orderedIds.length - shownIds.length;
    const scDensity = shownIds.length <= 5 ? 'roomy' : shownIds.length <= 7 ? 'cozy' : 'tight';
    
    return (
      <div className={`ct-scene ct-scene-scorecard ct-density-${scDensity}`}>
        <div className="ct-sc-header" style={team?.color ? { background: `linear-gradient(90deg, ${team.color}CC, rgba(10,14,17,0.4))` } : undefined}>
          <TeamCrest team={team} className="ct-sc-team-badge" fallbackColor="#3C7A4F">
            {team ? teamShort(tournament.teams, team.id) : 'TBD'}
          </TeamCrest>
          <div className="ct-sc-team-name">{team?.name}</div>
        </div>
        <div className="ct-sc-subheader">{tournament.name}</div>
        <div className="ct-sc-rows">
          <div className="ct-sc-row ct-sc-row-head">
            <span>Batter</span><span>Status</span><span className="ct-sc-r">Runs</span><span className="ct-sc-b">Balls</span>
          </div>
          {shownIds.map((id) => {
            const b = s.batsmen[id];
            return (
              <div className={`ct-sc-row${!b.out ? ' ct-sc-row-notout' : ''}`} key={id}>
                <span>{playerName(tournament.teams, id)}</span>
                <span className="ct-sc-status">{b.out ? dismissalText(b.howOut, tournament.teams) : 'Not Out'}</span>
                <span className="ct-sc-r">{b.runs}</span>
                <span className="ct-sc-b">{b.balls}</span>
              </div>
            );
          })}
          {hiddenCount > 0 && <div className="ct-scene-table-more">+{hiddenCount} earlier batter{hiddenCount === 1 ? '' : 's'}</div>}
        </div>
        <div className="ct-sc-footer">
          <span>Extras {extrasTotal}</span>
          <span>Overs {s.oversStr}</span>
          <span className="ct-sc-total">Total {s.totalRuns}-{s.totalWickets}</span>
        </div>
      </div>
    );
  }

  // Summary scene
  if (scene === 'summary') {
    return (
      <div className="ct-scene ct-scene-table ct-scene-summary">
        <div className="ct-matchup-eventbar">{tournament.name}</div>
        <div className="ct-matchup-venuebar">Match Summary</div>
        <div className="ct-summary-cols">
          {match.innings.map((inn, idx) => {
            if (!inn) return null;
            const s = computeInningsStats(inn, tournament.teams);
            const topScorer = Object.values(s.batsmen).sort((a, b) => b.runs - a.runs)[0];
            const topBowler = Object.values(s.bowlers).sort((a, b) => b.wickets - a.wickets || a.runs - b.runs)[0];
            return (
              <div className="ct-summary-col" key={idx}>
                <div className="ct-summary-team-row">
                  <TeamCrest team={s.battingTeam} className="ct-summary-crest" fallbackColor="#7C3AED" />
                  <div className="ct-summary-team">{s.battingTeam?.name}</div>
                </div>
                <div className="ct-summary-score">{s.totalRuns}/{s.totalWickets} <span>({s.oversStr} ov)</span></div>
                <div className="ct-summary-sub">Top scorer</div>
                {topScorer && (
                  <div className="ct-summary-line">
                    {playerName(tournament.teams, topScorer.id)} — {topScorer.runs} ({topScorer.balls})
                  </div>
                )}
                <div className="ct-summary-sub">Best bowler ({s.bowlingTeam?.name})</div>
                {topBowler && (
                  <div className="ct-summary-line">
                    {playerName(tournament.teams, topBowler.id)} — {topBowler.wickets}-{topBowler.runs} <small>({ballsToOverStr(topBowler.balls)} ov)</small>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {match.result && <div className="ct-matchup-footer" style={{ marginTop: 14 }}>{match.result.summary}</div>}
      </div>
    );
  }

  // Points table scene
  if (scene === 'points') {
    const table = computePointsTable(tournament);
    const density = table.length <= 5 ? 'roomy' : table.length <= 8 ? 'cozy' : table.length <= 12 ? 'tight' : 'ultra';
    return (
      <div className={`ct-scene ct-scene-table ct-density-${density}`}>
        <div className="ct-matchup-eventbar">{tournament.name}</div>
        <div className="ct-matchup-venuebar">Points Table</div>
        {table.length === 0 ? (
          <div className="ct-overlay-waiting">No results yet</div>
        ) : (
          <table className="ct-scene-table-el">
            <thead>
              <tr><th>#</th><th>Team</th><th>P</th><th>W</th><th>L</th><th>Pts</th><th>NRR</th></tr>
            </thead>
            <tbody>
              {table.map((r, i) => {
                const t = tournament.teams.find((x) => x.id === r.teamId);
                return (
                  <tr key={r.teamId}>
                    <td>{i + 1}</td>
                    <td className="ct-scene-table-team">
                      <TeamCrest team={t} className="ct-scene-table-crest" fallbackColor="#7C3AED" />
                      <span>{t?.name}</span>
                    </td>
                    <td>{r.played}</td>
                    <td>{r.won}</td>
                    <td>{r.lost}</td>
                    <td><b>{r.points}</b></td>
                    <td>{r.nrr >= 0 ? '+' : ''}{r.nrr.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    );
  }

  // Stats scene
  if (scene === 'stats') {
    const { topRuns, topWickets } = aggregatePlayerStats(tournament);
    return (
      <div className="ct-scene ct-scene-table">
        <div className="ct-matchup-eventbar">{tournament.name}</div>
        <div className="ct-matchup-venuebar">Tournament Stats</div>
        {topRuns.length === 0 && topWickets.length === 0 ? (
          <div className="ct-overlay-waiting">No stats yet</div>
        ) : (
          <div className="ct-stats-cols">
            <div className="ct-stats-col">
              <div className="ct-stats-col-title">Most Runs</div>
              {topRuns.slice(0, 5).map((p, i) => (
                <div className="ct-stats-row" key={p.id}>
                  <span>{i + 1}. {p.name}</span>
                  <b>{p.runs}</b>
                </div>
              ))}
            </div>
            <div className="ct-stats-col">
              <div className="ct-stats-col-title">Most Wickets</div>
              {topWickets.slice(0, 5).map((p, i) => (
                <div className="ct-stats-row" key={p.id}>
                  <span>{i + 1}. {p.name}</span>
                  <b>{p.wickets}-{p.runs}</b>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // MOTM scene
  if (scene === 'motm') {
    if (!match.motmId) return <div className="ct-overlay-waiting">No Man of the Match selected yet</div>;
    const battingLine = getPlayerInningsBattingStats(match, tournament.teams, match.motmId);
    const bowlingLine = getPlayerInningsBowlingStats(match, tournament.teams, match.motmId);
    return (
      <div className="ct-scene ct-scene-table ct-scene-motm">
        <div className="ct-matchup-eventbar">{tournament.name}</div>
        <div className="ct-matchup-venuebar">Player of the Match</div>
        <div className="ct-motm-body">
          <Star size={44} />
          <div className="ct-motm-name">{playerName(tournament.teams, match.motmId)}</div>
          <div className="ct-motm-stats">
            {battingLine && <span>{battingLine.runs} runs ({battingLine.balls} balls)</span>}
            {bowlingLine && bowlingLine.wickets > 0 && <span>{bowlingLine.wickets}-{bowlingLine.runs}</span>}
          </div>
        </div>
        <div className="ct-matchup-footer">{teamA?.name} vs {teamB?.name}</div>
      </div>
    );
  }

  // Default fallback
  return null;
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

function OverlayStyles() {
  return (
    <style>{`
      html, body, #root { background: transparent !important; }
      .ct-overlay-root {
        position: relative; width: 100vw; height: 100vh; overflow: hidden;
        font-family: 'Inter', sans-serif; background: transparent;
        display: flex; align-items: flex-end; justify-content: center;
        box-sizing: border-box;
        padding: 2.5vmin 3vmin 4vmin;
      }
      .ct-overlay-root.ct-overlay-waiting { align-items: center; }
      .ct-overlay-multi-root { display: flex; flex-direction: column; align-items: stretch; justify-content: flex-end; }
      .ct-overlay-scenes-area {
        flex: 1 1 auto; min-height: 0; width: 100%;
        display: flex; align-items: center; justify-content: center; overflow: hidden;
        padding: 14px 0 30px;
        box-sizing: border-box;
      }
      .ct-overlay-scenes-row {
        display: flex; gap: 18px; align-items: center; justify-content: center; flex-wrap: wrap; max-width: 97vw;
        max-height: 100%;
        min-height: 0;
      }
      .ct-overlay-scenes-multi .ct-scene { width: min(46vw, 760px); }
      .ct-overlay-scene-slot {
        display: flex;
        max-height: 100%;
        min-height: 0;
        align-items: center;
      }
      .ct-overlay-bug-wrap {
        position: relative;
        flex: 0 0 auto; width: 100%;
        display: flex; flex-direction: column; align-items: center;
        max-width: 100%;
        box-sizing: border-box;
      }
      .ct-overlay-bug-slot {
        flex: 0 0 auto; width: 100%;
        display: flex; flex-direction: column; align-items: center;
        max-width: 100%;
        box-sizing: border-box;
      }

      .ct-overlay-bar {
        display: flex; flex-wrap: nowrap; align-items: center; justify-content: center;
        gap: 10px 14px; margin: 0 0 18px; max-width: 100%; box-sizing: border-box;
        background: linear-gradient(160deg, rgba(61,17,82,0.94), rgba(10,14,17,0.94));
        border: 1.5px solid rgba(230,0,126,0.55);
        border-radius: 16px; padding: 10px 18px; backdrop-filter: blur(6px);
        box-shadow: 0 10px 34px rgba(0,0,0,0.5);
        overflow: hidden;
      }
      .ct-ov-score-pill {
        display: flex; align-items: center; gap: 8px; background: rgba(10,6,14,0.55); border-radius: 12px;
        padding: 8px 14px; border: 1px solid rgba(230,0,126,0.35); flex-shrink: 0;
      }
      .ct-ov-crest {
        width: 22px; height: 22px; border-radius: 50%; flex-shrink: 0;
        display: flex; align-items: center; justify-content: center;
        font-family: 'JetBrains Mono', monospace; font-weight: 700; font-size: 9px; color: #fff;
      }
      .ct-ov-team { font-family: 'Oswald', sans-serif; font-weight: 700; color: #EDEDE3; font-size: 16px; text-transform: uppercase; letter-spacing: .5px; }
      .ct-ov-runs { font-family: 'JetBrains Mono', monospace; font-weight: 700; color: #F2A93B; font-size: 22px; }
      .ct-ov-overs { font-family: 'JetBrains Mono', monospace; color: #D9A8E0; font-size: 13px; background: rgba(142,20,99,0.35); padding: 3px 8px; border-radius: 8px; }
      .ct-ov-batsmen { display: flex; flex-direction: column; gap: 4px; flex-shrink: 0; }
      .ct-ov-player-chip {
        display: flex; align-items: center; gap: 8px; font-size: 13px; color: #EDEDE3;
        background: rgba(61,17,82,0.55); border-radius: 8px; padding: 4px 10px; min-width: 130px; font-weight: 600;
      }
      .ct-ov-player-chip b { margin-left: auto; font-family: 'JetBrains Mono', monospace; color: #F2A93B; font-size: 13px; }
      .ct-ov-onstrike { border: 1.5px solid #4E9E67; }
      .ct-ov-dot { width: 6px; height: 6px; border-radius: 50%; background: #4E9E67; flex-shrink: 0; }
      .ct-ov-bowler-chip b { color: #D9A8E0; }
      .ct-ov-bowler { flex-shrink: 0; }
      .ct-ov-thisover { display: flex; align-items: center; flex-wrap: nowrap; justify-content: flex-start; overflow: hidden; flex-shrink: 0; }
      .ct-ov-ball {
        box-sizing: border-box; padding: 0 4px;
        display: flex; align-items: center; justify-content: center; white-space: nowrap;
        font-weight: 700; font-family: 'JetBrains Mono', monospace; background: rgba(61,17,82,0.6); color: #EDEDE3; border: 1px solid rgba(230,0,126,0.35); flex-shrink: 0;
      }
      .ct-ov-ball-w { background: #D9564F; border-color: #D9564F; color: #fff; }
      .ct-ov-ball-nb { border-color: #D9A8E0; color: #D9A8E0; font-weight: 700; }
      .ct-ov-ball-wd { border-color: #93A1A8; color: #93A1A8; }
      .ct-ov-ball-4 {
        font-weight: 700;
        background: #3E8FB0; border-color: #3E8FB0; color: #fff; box-shadow: 0 0 10px rgba(62,143,176,0.6);
      }
      .ct-ov-ball-6 {
        font-weight: 700;
        background: #F2A93B; border-color: #F2A93B; color: #1A1204; box-shadow: 0 0 12px rgba(242,169,59,0.7);
      }
      .ct-ov-ball-penalty { border-color: #D9564F; color: #D9564F; background: rgba(217,86,79,0.15); font-weight: 700; }
      .ct-ov-ball-more {
        background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.3); color: #D9A8E0; font-weight: 700;
      }
      .ct-ov-target {
        background: linear-gradient(160deg, rgba(61,17,82,0.94), rgba(10,14,17,0.94)); color: #EDEDE3; font-size: 15px; padding: 6px 16px; border-radius: 10px;
        border: 1px solid rgba(230,0,126,0.45); font-family: 'Inter', sans-serif; font-weight: 600; margin-top: -12px; margin-bottom: 8px;
      }
      .ct-overlay-result {
        background: linear-gradient(90deg, #8E1463, #E6007E); border: none; color: #fff;
        font-family: 'Oswald', sans-serif; text-transform: uppercase; letter-spacing: .5px; font-weight: 600;
        padding: 11px 24px; border-radius: 12px; font-size: 18px; box-shadow: 0 6px 18px rgba(0,0,0,0.45); margin-bottom: 8px;
      }
      .ct-ov-stage-tag {
        background: linear-gradient(90deg, #8E1463, #E6007E); color: #fff;
        font-family: 'Oswald', sans-serif; text-transform: uppercase; letter-spacing: 1px;
        padding: 6px 16px; border-radius: 20px; font-size: 13px; font-weight: 600;
        box-shadow: 0 6px 18px rgba(0,0,0,0.45); margin-bottom: 8px;
      }

      .ct-flash {
        position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%);
        margin-bottom: 16px;
        z-index: 50; pointer-events: none; display: flex; align-items: center; justify-content: center;
      }
      .ct-flash-boundary {
        position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center;
        width: 128px; height: 128px; border-radius: 50%;
        animation: ct-flash-boundary-pop 2.2s cubic-bezier(.2,.9,.25,1) forwards;
      }
      .ct-flash-FOUR .ct-flash-boundary {
        background: radial-gradient(circle at 34% 28%, #6FC0E4, #1F6C8C 72%);
        box-shadow: 0 0 0 4px rgba(62,143,176,0.35), 0 14px 40px rgba(0,0,0,0.55), 0 0 60px rgba(62,143,176,0.8);
      }
      .ct-flash-SIX .ct-flash-boundary {
        background: radial-gradient(circle at 34% 28%, #FFD68A, #C9820F 72%);
        box-shadow: 0 0 0 4px rgba(242,169,59,0.35), 0 14px 40px rgba(0,0,0,0.55), 0 0 66px rgba(242,169,59,0.9);
      }
      .ct-flash-OUT .ct-flash-boundary {
        background: radial-gradient(circle at 34% 28%, #F0837D, #A32B24 72%);
        box-shadow: 0 0 0 4px rgba(217,86,79,0.4), 0 14px 40px rgba(0,0,0,0.55), 0 0 66px rgba(217,86,79,0.85);
      }
      .ct-flash-WIDE .ct-flash-boundary {
        background: radial-gradient(circle at 34% 28%, #C7D2D6, #5C6B72 72%);
        box-shadow: 0 0 0 4px rgba(147,161,168,0.35), 0 14px 40px rgba(0,0,0,0.55), 0 0 60px rgba(147,161,168,0.75);
      }
      .ct-flash-NOBALL .ct-flash-boundary {
        background: radial-gradient(circle at 34% 28%, #8FE0A8, #1F7A45 72%);
        box-shadow: 0 0 0 4px rgba(78,158,103,0.4), 0 14px 40px rgba(0,0,0,0.55), 0 0 66px rgba(78,158,103,0.85);
      }
      .ct-flash-ring {
        position: absolute; inset: -9px; border-radius: 50%; border: 3px solid rgba(255,255,255,0.7);
        animation: ct-flash-ring-burst 1.15s ease-out forwards;
      }
      .ct-flash-ring-2 { animation-delay: .18s; }
      .ct-flash-FOUR .ct-flash-ring { border-color: rgba(111,192,228,0.9); }
      .ct-flash-SIX .ct-flash-ring { border-color: rgba(255,214,138,0.95); }
      .ct-flash-OUT .ct-flash-ring { border-color: rgba(240,131,125,0.95); }
      .ct-flash-WIDE .ct-flash-ring { border-color: rgba(199,210,214,0.9); }
      .ct-flash-NOBALL .ct-flash-ring { border-color: rgba(143,224,168,0.95); }
      .ct-flash-num {
        font-family: 'Oswald', sans-serif; font-weight: 700; font-size: 52px; line-height: 1; color: #fff;
        text-shadow: 0 3px 12px rgba(0,0,0,0.45);
      }
      .ct-flash-SIX .ct-flash-num { color: #1A1204; text-shadow: 0 2px 8px rgba(0,0,0,0.25); }
      .ct-flash-num-sm { font-size: 34px; }
      .ct-flash-word {
        margin-top: 1px; font-family: 'Oswald', sans-serif; font-weight: 600; font-size: 11px; letter-spacing: 2px;
        color: rgba(255,255,255,0.92); text-transform: uppercase;
      }
      .ct-flash-SIX .ct-flash-word { color: rgba(26,18,4,0.8); }

      @keyframes ct-flash-boundary-pop {
        0% { opacity: 0; transform: scale(0.4) rotate(-8deg); }
        14% { opacity: 1; transform: scale(1.14) rotate(2deg); }
        24% { transform: scale(1) rotate(0deg); }
        82% { opacity: 1; transform: scale(1) rotate(0deg); }
        100% { opacity: 0; transform: scale(1.06) rotate(0deg); }
      }
      @keyframes ct-flash-ring-burst {
        0% { opacity: 0.9; transform: scale(0.7); }
        100% { opacity: 0; transform: scale(1.9); }
      }

      .ct-overlay-waiting {
        align-items: center; justify-content: center; color: #EDEDE3; font-family: 'Oswald', sans-serif;
        text-transform: uppercase; letter-spacing: .5px; font-size: 22px; background: rgba(16,22,26,0.6);
        padding: 26px;
      }
      .ct-overlay-diag {
        max-width: min(90vw, 640px); text-align: center; padding: 14px 22px; border-radius: 12px;
        background: rgba(16,22,26,0.85); border: 1px solid rgba(242,169,59,0.35);
        text-transform: none; letter-spacing: normal; font-size: 14px; line-height: 1.5;
      }

      .ct-scene {
        background: rgba(10,14,17,0.9);
        border: 2px solid rgba(242,169,59,0.5);
        border-radius: 28px;
        padding: 34px 44px;
        color: #EDEDE3;
        font-family: 'Inter', sans-serif;
        text-align: center;
        box-shadow: 0 30px 90px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03) inset;
        width: min(90vw, 1500px);
        max-height: 100%;
        overflow: hidden;
        position: relative;
        backdrop-filter: blur(10px);
        animation: ct-scene-pop .5s cubic-bezier(.2,.9,.25,1) both;
      }
      @keyframes ct-scene-pop {
        0% { opacity: 0; transform: scale(0.92) translateY(14px); }
        60% { opacity: 1; }
        100% { opacity: 1; transform: scale(1) translateY(0); }
      }
      .ct-scene::after {
        content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 34px;
        background: linear-gradient(rgba(10,14,17,0), rgba(10,14,17,0.85));
        pointer-events: none; border-radius: 0 0 26px 26px;
      }

      .ct-scene-matchup {
        position: relative; padding: 0; overflow: hidden; text-align: center;
        background: linear-gradient(160deg, rgba(61,17,82,0.94), rgba(10,14,17,0.94));
        border-color: rgba(230,0,126,0.5);
        width: min(60vw, 1020px);
      }
      .ct-matchup-eventbar {
        background: linear-gradient(90deg, #E6007E, #8E1463); color: #fff; font-family: 'Oswald', sans-serif;
        text-transform: uppercase; letter-spacing: 2px; font-size: 26px; padding: 16px 26px; font-weight: 600;
      }
      .ct-matchup-venuebar {
        background: rgba(255,255,255,0.08); color: #EDEDE3; font-size: 17px; letter-spacing: 1.5px;
        text-transform: uppercase; padding: 10px 26px; border-bottom: 1px solid rgba(255,255,255,0.08);
      }
      .ct-matchup-body { display: flex; align-items: center; justify-content: center; gap: 40px; padding: 34px 32px 28px; }
      .ct-matchup-side { display: flex; flex-direction: column; align-items: center; gap: 14px; width: 200px; }
      .ct-matchup-crest {
        width: 116px; height: 116px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
        font-family: 'JetBrains Mono', monospace; font-weight: 700; font-size: 30px; color: #fff;
        box-shadow: 0 14px 36px rgba(0,0,0,0.5); border: 4px solid rgba(255,255,255,0.25);
      }
      .ct-matchup-teamname { font-family: 'Oswald', sans-serif; text-transform: uppercase; font-size: 24px; letter-spacing: .5px; font-weight: 600; }
      .ct-matchup-vs { font-family: 'Oswald', sans-serif; font-size: 48px; font-weight: 700; color: #FF3D9A; text-shadow: 0 0 28px rgba(230,0,126,0.55); }
      .ct-matchup-footer {
        background: linear-gradient(90deg, #8E1463, #E6007E); color: #fff; font-family: 'Oswald', sans-serif;
        text-transform: uppercase; letter-spacing: 1px; font-size: 19px; padding: 14px 26px; font-weight: 600;
      }
      .ct-stage-pill {
        position: absolute; top: 14px; right: 14px; z-index: 5; background: rgba(255,255,255,0.14);
        border: 1px solid rgba(255,255,255,0.4); color: #fff; font-family: 'Oswald', sans-serif; text-transform: uppercase;
        letter-spacing: 1px; font-size: 14px; padding: 6px 16px; border-radius: 20px; font-weight: 600;
      }
      .ct-captain-crest-photo {
        width: 116px; height: 116px; border-radius: 50%; object-fit: cover;
        box-shadow: 0 14px 36px rgba(0,0,0,0.5); border: 4px solid rgba(255,255,255,0.25);
      }
      .ct-captain-sub-label { font-size: 15px; color: #D9A8E0; text-transform: uppercase; letter-spacing: .5px; margin-top: 3px; }

      .ct-scene-scorecard {
        padding: 0; overflow: hidden; text-align: left; width: min(62vw, 860px);
        background: linear-gradient(160deg, rgba(20,40,28,0.94), rgba(10,14,17,0.96));
        border-color: rgba(78,158,103,0.5);
      }
      .ct-sc-header {
        display: flex; align-items: center; gap: 16px; padding: 18px 26px;
        background: linear-gradient(90deg, rgba(60,122,79,0.85), rgba(10,14,17,0.4));
      }
      .ct-sc-team-badge {
        width: 52px; height: 52px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
        font-family: 'JetBrains Mono', monospace; font-weight: 700; font-size: 19px; color: #fff;
        border: 3px solid rgba(255,255,255,0.35); flex-shrink: 0;
      }
      .ct-sc-team-name { font-family: 'Oswald', sans-serif; text-transform: uppercase; letter-spacing: .5px; font-size: 24px; color: #fff; font-weight: 700; }
      .ct-sc-subheader {
        padding: 9px 26px; font-size: 14px; letter-spacing: 1.5px; text-transform: uppercase; color: #D9A8E0;
        background: rgba(255,255,255,0.05); border-bottom: 1px solid rgba(255,255,255,0.08);
      }
      .ct-sc-rows { padding: 8px 26px 12px; overflow: hidden; }
      .ct-density-cozy .ct-sc-row { font-size: 15.5px; padding: 7px 8px; }
      .ct-density-tight .ct-sc-row { font-size: 13px; padding: 5px 8px; }
      .ct-density-cozy .ct-sc-rows, .ct-density-tight .ct-sc-rows { padding: 6px 22px 10px; }
      .ct-sc-row {
        display: grid; grid-template-columns: 1.6fr 1.4fr 80px 80px; gap: 10px; align-items: center;
        padding: 10px 8px; font-size: 18px; color: #EDEDE3; border-bottom: 1px solid rgba(255,255,255,0.06); font-weight: 500;
      }
      .ct-sc-row-head {
        font-size: 13px; text-transform: uppercase; letter-spacing: .6px; color: #93A1A8; font-weight: 600;
        border-bottom: 1px solid rgba(255,255,255,0.18);
      }
      .ct-sc-row-notout { background: rgba(217,86,79,0.22); border-radius: 8px; }
      .ct-sc-status { font-size: 13.5px; color: #93A1A8; text-transform: uppercase; }
      .ct-sc-row-notout .ct-sc-status { color: #F2A93B; font-weight: 700; }
      .ct-sc-r, .ct-sc-b { text-align: right; font-family: 'JetBrains Mono', monospace; font-weight: 700; }
      .ct-sc-footer {
        display: flex; align-items: center; justify-content: space-between; gap: 16px;
        padding: 14px 26px; background: rgba(0,0,0,0.35); font-family: 'JetBrains Mono', monospace;
        font-size: 16px; color: #D9A8E0; text-transform: uppercase; letter-spacing: .5px;
      }
      .ct-sc-total { color: #F2A93B; font-size: 21px; font-weight: 700; }

      .ct-scene-table {
        padding: 0 0 20px; overflow: hidden; text-align: center; width: min(58vw, 800px);
        background: linear-gradient(160deg, rgba(61,17,82,0.94), rgba(10,14,17,0.94));
        border-color: rgba(230,0,126,0.5);
      }
      .ct-scene-table-el { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 16px; }
      .ct-scene-table-el th {
        text-align: center; color: #D9A8E0; font-weight: 600; font-size: 13px; text-transform: uppercase;
        letter-spacing: .6px; padding: 9px 10px; border-bottom: 1px solid rgba(255,255,255,0.15);
      }
      .ct-scene-table-el td { padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.08); text-align: center; color: #EDEDE3; font-weight: 500; }
      .ct-scene-table-el tr:last-child td { border-bottom: none; }
      .ct-scene-table-team { display: flex; align-items: center; gap: 10px; text-align: left; font-weight: 700; }
      .ct-scene-table-crest {
        width: 22px; height: 22px; border-radius: 50%; flex-shrink: 0;
        display: flex; align-items: center; justify-content: center;
        font-family: 'JetBrains Mono', monospace; font-weight: 700; font-size: 9px; color: #fff;
      }
      .ct-density-cozy .ct-scene-table-el { font-size: 15.5px; margin-top: 12px; }
      .ct-density-cozy .ct-scene-table-el th { font-size: 12px; padding: 7px 10px; }
      .ct-density-cozy .ct-scene-table-el td { padding: 8px; }
      .ct-density-cozy .ct-scene-table-crest { width: 19px; height: 19px; font-size: 8px; }
      .ct-density-tight .ct-scene-table-el { font-size: 13px; margin-top: 8px; }
      .ct-density-tight .ct-scene-table-el th { font-size: 10.5px; padding: 5px 8px; }
      .ct-density-tight .ct-scene-table-el td { padding: 5px 8px; }
      .ct-density-tight .ct-scene-table-crest { width: 17px; height: 17px; font-size: 7.5px; }
      .ct-density-ultra .ct-scene-table-el { font-size: 11px; margin-top: 6px; }
      .ct-density-ultra .ct-scene-table-el th { font-size: 9px; padding: 3.5px 6px; }
      .ct-density-ultra .ct-scene-table-el td { padding: 3.5px 6px; }
      .ct-density-ultra .ct-scene-table-crest { width: 15px; height: 15px; font-size: 7px; }
      .ct-density-ultra .ct-scene-table-team { gap: 6px; }

      .ct-summary-cols {
        display: flex;
        gap: 30px;
        justify-content: center;
        margin-top: 12px;
        padding: 0 10px;
        flex-wrap: wrap;
      }
      .ct-summary-col {
        min-width: 210px;
        text-align: left;
        flex: 1;
        max-width: 340px;
      }
      .ct-summary-team-row {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 2px;
      }
      .ct-summary-crest {
        width: 30px; height: 30px; border-radius: 50%; flex-shrink: 0;
        display: flex; align-items: center; justify-content: center;
        font-family: 'JetBrains Mono', monospace; font-weight: 700; font-size: 11px; color: #fff;
      }
      .ct-summary-team {
        font-family: 'Oswald', sans-serif;
        text-transform: uppercase;
        font-size: 16px;
        color: #FF3D9A;
        letter-spacing: .5px;
        font-weight: 600;
      }
      .ct-summary-score {
        font-family: 'JetBrains Mono', monospace;
        font-size: 38px;
        color: #F2A93B;
        font-weight: 700;
        margin: 5px 0 12px;
        line-height: 1;
      }
      .ct-summary-score span {
        font-size: 17px;
        color: #D9A8E0;
      }
      .ct-summary-sub {
        font-size: 13.5px;
        text-transform: uppercase;
        letter-spacing: .6px;
        color: #D9A8E0;
        margin-top: 9px;
      }
      .ct-summary-line {
        font-size: 19px;
        margin-top: 3px;
        color: #EDEDE3;
        font-weight: 600;
      }
      .ct-summary-line small {
        font-family: 'Inter', sans-serif;
        font-size: 13px;
        color: #D9A8E0;
        font-weight: 500;
        margin-left: 5px;
      }

      .ct-stats-cols { display: flex; gap: 42px; justify-content: center; margin-top: 18px; padding: 0 26px; }
      .ct-stats-col { flex: 1; text-align: left; }
      .ct-stats-col-title {
        font-family: 'Oswald', sans-serif; text-transform: uppercase; letter-spacing: 1px; font-size: 17px;
        color: #FF3D9A; margin-bottom: 12px; text-align: center;
      }
      .ct-stats-row {
        display: flex; align-items: center; justify-content: space-between; font-size: 18px; color: #EDEDE3;
        padding: 9px 6px; border-bottom: 1px solid rgba(255,255,255,0.08); font-weight: 500;
      }
      .ct-stats-row:last-child { border-bottom: none; }
      .ct-stats-row b { font-family: 'JetBrains Mono', monospace; color: #F2A93B; font-size: 19px; }

      .ct-scene-motm { color: #F2A93B; }
      .ct-motm-body { padding: 26px 20px 8px; }
      .ct-motm-body svg { width: 56px; height: 56px; }
      .ct-motm-name { font-family: 'Oswald', sans-serif; text-transform: uppercase; font-size: 42px; margin: 14px 0 8px; color: #FF3D9A; letter-spacing: .5px; }
      .ct-motm-stats { display: flex; gap: 26px; justify-content: center; font-family: 'JetBrains Mono', monospace; font-size: 21px; color: #F2A93B; font-weight: 700; }

      @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@600;700&family=Inter:wght@500;600&family=JetBrains+Mono:wght@600;700&display=swap');
    `}</style>
  );
}
export { SceneRenderer };