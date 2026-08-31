// hooks/useSupabaseData.js

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';

// ─────────────────────────────────────────────────────────
// DB <-> App mappers
// ─────────────────────────────────────────────────────────

const mapTeamFromDB = (team) => ({
  id: team.id,
  name: team.name,
  short: team.short_name,
  color: team.color,
  logo: team.logo_url,
  captainId: team.captain_id,
  poolId: team.pool_id,
  players: team.players || [],
});

const mapPlayerFromDB = (player) => ({
  id: player.id,
  teamId: player.team_id,
  name: player.name,
  role: player.role,
  photo: player.photo_url,
});

const mapMatchFromDB = (match) => ({
  id: match.id,
  tournamentId: match.tournament_id,
  teamAId: match.team_a_id,
  teamBId: match.team_b_id,
  teamAName: match.team_a_name,
  teamBName: match.team_b_name,
  teamAShort: match.team_a_short,
  teamBShort: match.team_b_short,
  teamAColor: match.team_a_color,
  teamBColor: match.team_b_color,
  oversLimit: match.overs_limit,
  venue: match.venue,
  stage: match.stage,
  status: match.status,
  tossWinner: match.toss_winner_id,
  tossChoice: match.toss_choice,
  currentInnings: match.current_innings,
  resultType: match.result_type,
  winnerId: match.winner_id,
  summary: match.summary,
  motmId: match.motm_id,
  innings: match.innings || [],
});

const mapInningsFromDB = (innings) => ({
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
  runAdjustment: innings.run_adjustment || 0,
  isComplete: innings.is_complete || false,
  balls: innings.balls || [],
});

const mapBallFromDB = (ball) => ({
  id: ball.id,
  inningsId: ball.innings_id,
  ballIndex: ball.ball_index,
  overNum: ball.over_num,
  batsmanId: ball.batsman_id,
  nonStrikerId: ball.non_striker_id,
  bowlerId: ball.bowler_id,
  runsBat: ball.runs_bat || 0,
  extra: ball.extra,
  extraRuns: ball.extra_runs || 0,
  isWicket: ball.is_wicket || false,
  wicketType: ball.wicket_type,
  outBatsmanId: ball.out_batsman_id,
  fielderNote: ball.fielder_note,
});

// App -> DB mappers (used for saving)

const mapTeamToDB = (team, tournamentId) => ({
  id: team.id,
  tournament_id: tournamentId,
  pool_id: team.poolId || null,
  name: team.name || 'Unnamed Team',
  short_name:
    team.short ||
    (team.name ? team.name.substring(0, 3).toUpperCase() : 'TBD'),
  color: team.color || '#888888',
  logo_url: team.logo || null,
  captain_id: team.captainId || null,
  updated_at: new Date().toISOString(),
});

const mapPlayerToDB = (player, teamId) => ({
  id: player.id,
  team_id: teamId,
  name: player.name || 'Unnamed Player',
  role: player.role || 'Batter',
  photo_url: player.photo || null,
  updated_at: new Date().toISOString(),
});

const mapMatchToDB = (match, tournamentId, teamsById = {}) => {
  const teamA = teamsById[match.teamAId] || {};
  const teamB = teamsById[match.teamBId] || {};

  return {
    id: match.id,
    tournament_id: tournamentId,
    team_a_id: match.teamAId || null,
    team_b_id: match.teamBId || null,
    team_a_name: match.teamAName || teamA.name || null,
    team_b_name: match.teamBName || teamB.name || null,
    team_a_short: match.teamAShort || teamA.short || null,
    team_b_short: match.teamBShort || teamB.short || null,
    team_a_color: match.teamAColor || teamA.color || null,
    team_b_color: match.teamBColor || teamB.color || null,
    overs_limit: match.oversLimit || 20,
    status: match.status || 'upcoming',
    venue: match.venue || null,
    toss_winner_id: match.tossWinner || null,
    toss_choice: match.tossChoice || null,
    result_type: match.resultType || match.result?.type || null,
    winner_id: match.winnerId || match.result?.winnerId || null,
    summary: match.summary || match.result?.summary || null,
    motm_id: match.motmId || null,
    stage: match.stage || null,
    current_innings: match.currentInnings || 0,
    updated_at: new Date().toISOString(),
  };
};

const mapInningsToDB = (innings, matchId) => ({
  id: innings.id,
  match_id: matchId,
  innings_num: innings.inningsNum,
  batting_team_id: innings.battingTeamId || null,
  bowling_team_id: innings.bowlingTeamId || null,
  current_striker_id: innings.currentStrikerId || null,
  current_non_striker_id: innings.currentNonStrikerId || null,
  current_bowler_id: innings.currentBowlerId || null,
  previous_bowler_id: innings.previousBowlerId || null,
  target: innings.target || null,
  run_adjustment: innings.runAdjustment || 0,
  is_complete: innings.isComplete || false,
  updated_at: new Date().toISOString(),
});

const mapBallToDB = (ball, inningsId) => ({
  id: ball.id,
  innings_id: inningsId,
  ball_index: ball.ballIndex,
  over_num: ball.overNum,
  batsman_id: ball.batsmanId || null,
  non_striker_id: ball.nonStrikerId || null,
  bowler_id: ball.bowlerId || null,
  runs_bat: ball.runsBat || 0,
  extra: ball.extra || null,
  extra_runs: ball.extraRuns || 0,
  is_wicket: ball.isWicket || false,
  wicket_type: ball.wicketType || null,
  out_batsman_id: ball.outBatsmanId || null,
  fielder_note: ball.fielderNote || null,
});

const mapPoolToDB = (pool, tournamentId) => ({
  id: pool.id,
  tournament_id: tournamentId,
  name: pool.name,
});

// ─────────────────────────────────────────────────────────
// Generic sync helper: upserts current rows for a parent,
// then deletes any rows for that parent that are no longer
// present (so removed balls/innings/matches/etc. actually
// disappear from the DB instead of lingering forever).
// ─────────────────────────────────────────────────────────

async function upsertRows(table, rows) {
  if (rows.length === 0) return;
  const { error } = await supabase.from(table).upsert(rows, { onConflict: 'id' });
  if (error) {
    console.error(`Upsert error [${table}]:`, {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
      sampleRow: rows[0],
    });
    throw error;
  }
}

async function deleteMissing(table, parentCol, parentId, keepIds) {
  // Special case for matches - check if they're referenced by broadcast_state
  if (table === 'matches') {
    try {
      // Check if any of the matches to be deleted are in broadcast_state
      const { data: broadcastData, error: broadcastError } = await supabase
        .from('broadcast_state')
        .select('match_id')
        .eq('tournament_id', parentId);
      
      if (!broadcastError && broadcastData) {
        const referencedMatchIds = broadcastData
          .map(b => b.match_id)
          .filter(id => id != null);
        
        // If the match is referenced in broadcast_state, clear the reference
        if (referencedMatchIds.length > 0) {
          for (const matchId of referencedMatchIds) {
            if (keepIds && keepIds.includes(matchId)) {
              // This match is being kept, so just clear the broadcast reference
              await supabase
                .from('broadcast_state')
                .update({ match_id: null })
                .eq('match_id', matchId);
            }
          }
        }
      }
    } catch (error) {
      console.warn('Error handling broadcast_state references:', error);
    }
  }

  // Build the delete query
  let deleteQuery = supabase.from(table).delete().eq(parentCol, parentId);
  
  if (keepIds && keepIds.length > 0) {
    const validIds = keepIds.filter(id => id != null);
    if (validIds.length > 0) {
      deleteQuery = deleteQuery.not('id', 'in', `(${validIds.map(id => `'${id}'`).join(',')})`);
    }
  }
  
  const { error } = await deleteQuery;
  if (error) {
    // If it's a foreign key error, try to handle it gracefully
    if (error.code === '23503') {
      console.warn(`⚠️ Foreign key constraint violation in ${table}, skipping delete:`, error.details);
      return; // Don't throw, just warn
    }
    console.error(`Cleanup delete error [${table}]:`, {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
      parentCol,
      parentId,
      keepIds,
    });
    throw error;
  }
}

async function syncCollection(table, rows, parentCol, parentId) {
  const ids = rows.map((r) => r.id).filter(Boolean);
  await upsertRows(table, rows);
  await deleteMissing(table, parentCol, parentId, ids);
}

// ─────────────────────────────────────────────────────────
// Main tournament hook
// ─────────────────────────────────────────────────────────

export function useSupabaseTournament() {
  const [tournament, setTournament] = useState(null);
  const [tournaments, setTournaments] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState('idle');
  const [connectionError, setConnectionError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const saveTimer = useRef(null);
  const firstLoad = useRef(true);
  const skipNextSave = useRef(false);

  // Load full tournament data (teams, players, matches, innings, balls, pools)
  const loadTournamentData = useCallback(async (tournamentId) => {
    if (!tournamentId) return null;

    try {
      const { data: tournamentData, error: tournamentError } = await supabase
        .from('tournaments')
        .select('*')
        .eq('id', tournamentId)
        .maybeSingle();

      if (tournamentError) {
        console.error('Tournament load error:', tournamentError);
        return null;
      }

      if (!tournamentData) {
        console.log('Tournament not found:', tournamentId);
        return null;
      }

      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select(`*, players:players(*)`)
        .eq('tournament_id', tournamentId);

      if (teamsError) {
        console.error('Teams load error:', teamsError);
      }

      const { data: matchesData, error: matchesError } = await supabase
        .from('matches')
        .select(`*, innings:innings(*, balls:balls(*))`)
        .eq('tournament_id', tournamentId)
        .order('created_at', { ascending: true });

      if (matchesError) {
        console.error('Matches load error:', matchesError);
      }

      const { data: poolsData, error: poolsError } = await supabase
        .from('pools')
        .select('*')
        .eq('tournament_id', tournamentId);

      if (poolsError) {
        console.error('Pools load error:', poolsError);
      }

      const teams = (teamsData || []).map(mapTeamFromDB);
      const matches = (matchesData || []).map((m) => ({
        ...mapMatchFromDB(m),
        innings: (m.innings || [])
          .filter(Boolean)
          .sort((a, b) => a.innings_num - b.innings_num)
          .map((i) => ({
            ...mapInningsFromDB(i),
            balls: (i.balls || [])
              .filter(Boolean)
              .sort((a, b) => a.ball_index - b.ball_index)
              .map(mapBallFromDB),
          })),
      }));
      const pools = poolsData || [];

      return {
        id: tournamentData.id,
        name: tournamentData.name,
        defaultOvers: tournamentData.default_overs || 20,
        isDoubleWicket: tournamentData.is_double_wicket || false,
        createdAt: tournamentData.created_at,
        teams,
        matches,
        pools,
      };
    } catch (error) {
      console.error('Load tournament data error:', error);
      return null;
    }
  }, []);

  // Build a minimal empty tournament object from a raw tournaments row
  const buildEmptyTournament = (row) => ({
    id: row.id,
    name: row.name,
    defaultOvers: row.default_overs || 20,
    isDoubleWicket: row.is_double_wicket || false,
    createdAt: row.created_at,
    teams: [],
    matches: [],
    pools: [],
  });

  // Load all tournaments list, with real team/match counts
  const loadTournamentsList = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('tournaments')
        .select('id, name, created_at')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Tournaments list error:', error);
        return [];
      }

      const rows = data || [];

      const withCounts = await Promise.all(
        rows.map(async (t) => {
          const [{ count: teamsCount }, { count: matchesCount }] =
            await Promise.all([
              supabase
                .from('teams')
                .select('id', { count: 'exact', head: true })
                .eq('tournament_id', t.id),
              supabase
                .from('matches')
                .select('id', { count: 'exact', head: true })
                .eq('tournament_id', t.id),
            ]);

          return {
            id: t.id,
            name: t.name,
            createdAt: t.created_at,
            teamsCount: teamsCount || 0,
            matchesCount: matchesCount || 0,
          };
        })
      );

      return withCounts;
    } catch (error) {
      console.error('Load tournaments list error:', error);
      return [];
    }
  }, []);

  // Check if app_settings table exists
  const checkAppSettingsTable = useCallback(async () => {
    try {
      const { error } = await supabase
        .from('app_settings')
        .select('id')
        .limit(1);

      if (error && error.code === '42P01') {
        console.warn(
          'app_settings table does not exist. Create it via a migration.'
        );
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error checking app_settings table:', error);
      return false;
    }
  }, []);

  const getActiveTournamentFromSettings = useCallback(async () => {
    try {
      const tableExists = await checkAppSettingsTable();
      if (!tableExists) return null;

      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'active_tournament_id')
        .maybeSingle();

      if (error) {
        console.error('Error reading app_settings:', error);
        return null;
      }

      return data?.value || null;
    } catch (error) {
      console.error('Error getting active tournament from settings:', error);
      return null;
    }
  }, [checkAppSettingsTable]);

  const saveActiveTournamentToSettings = useCallback(
    async (tournamentId) => {
      try {
        const tableExists = await checkAppSettingsTable();
        if (!tableExists) return false;

        const { error } = await supabase.from('app_settings').upsert(
          {
            key: 'active_tournament_id',
            value: tournamentId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'key' }
        );

        if (error) {
          console.error('Error saving active tournament to app_settings:', error);
          return false;
        }
        return true;
      } catch (error) {
        console.error('Error saving active tournament to settings:', error);
        return false;
      }
    },
    [checkAppSettingsTable]
  );

  const clearActiveTournamentSettings = useCallback(async () => {
    try {
      localStorage.removeItem('supabase_active_tournament');
      const tableExists = await checkAppSettingsTable();
      if (tableExists) {
        await supabase
          .from('app_settings')
          .delete()
          .eq('key', 'active_tournament_id');
      }
    } catch (error) {
      console.error('Error clearing active tournament settings:', error);
    }
  }, [checkAppSettingsTable]);

  // Initialize
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        setLoading(true);
        setConnectionError(false);
        setErrorMessage('');

        console.log('🔍 Initializing Supabase tournament...');

        const list = await loadTournamentsList();
        if (cancelled) return;
        setTournaments(list);
        console.log(`📋 Found ${list.length} tournaments`);

        let active = await getActiveTournamentFromSettings();

        if (!active) {
          active = localStorage.getItem('supabase_active_tournament');
          if (active) {
            await saveActiveTournamentToSettings(active);
          }
        }

        if (!active && list.length > 0) {
          active = list[0].id;
          await saveActiveTournamentToSettings(active);
        }

        if (active) {
          setActiveId(active);
          localStorage.setItem('supabase_active_tournament', active);

          const data = await loadTournamentData(active);
          if (cancelled) return;

          if (data) {
            setTournament(data);
            console.log('✅ Tournament loaded successfully:', data.name);
          } else {
            const { data: rawRow, error: rawError } = await supabase
              .from('tournaments')
              .select('*')
              .eq('id', active)
              .maybeSingle();

            if (!rawError && rawRow) {
              setTournament(buildEmptyTournament(rawRow));
              console.log('✅ Empty tournament created for:', rawRow.name);
            } else {
              console.log('⚠️ Active tournament no longer exists, resetting');
              await clearActiveTournamentSettings();

              if (list.length > 0) {
                const fallbackId = list[0].id;
                setActiveId(fallbackId);
                localStorage.setItem('supabase_active_tournament', fallbackId);
                await saveActiveTournamentToSettings(fallbackId);
                const fallbackData = await loadTournamentData(fallbackId);
                if (!cancelled) {
                  setTournament(fallbackData || null);
                }
              } else {
                setActiveId(null);
                setTournament(null);
              }
            }
          }
        } else {
          console.log('❌ No active tournament found');
        }

        setLoading(false);
        console.log('🏁 Initialization complete.');
      } catch (error) {
        console.error('❌ Init error:', error);
        if (!cancelled) {
          setConnectionError(true);
          setErrorMessage(error.message || 'Failed to load tournament data');
          setLoading(false);
        }
      }
    };

    init();

    return () => {
      cancelled = true;
    };
  }, [
    loadTournamentData,
    loadTournamentsList,
    getActiveTournamentFromSettings,
    saveActiveTournamentToSettings,
    clearActiveTournamentSettings,
  ]);

  // Save full tournament data
 // Save full tournament data
const saveTournamentData = useCallback(
  async (tournamentData) => {
    if (!tournamentData || !tournamentData.id) {
      console.log('⚠️ No tournament data to save');
      return;
    }

    const tournamentId = tournamentData.id;

    try {
      setSaveState('saving');

      // 1. Tournament row
      const { error: tournamentError } = await supabase
        .from('tournaments')
        .update({
          name: tournamentData.name,
          default_overs: tournamentData.defaultOvers || 20,
          is_double_wicket: tournamentData.isDoubleWicket || false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', tournamentId);

      if (tournamentError) throw tournamentError;

      // 2. Pools
      const poolRows = (tournamentData.pools || [])
        .filter(Boolean)
        .map((p) => mapPoolToDB(p, tournamentId));
      
      if (poolRows.length > 0) {
        await upsertRows('pools', poolRows);
      }
      
      // Delete pools that are no longer present
      const poolIds = poolRows.map((p) => p.id);
      await deleteMissing('pools', 'tournament_id', tournamentId, poolIds);

      // 3. Teams - Save teams first
      const teams = (tournamentData.teams || []).filter(Boolean);
      const teamRows = teams.map((t) => mapTeamToDB(t, tournamentId));
      
      if (teamRows.length > 0) {
        await upsertRows('teams', teamRows);
      }

      // 4. Players - Save players for each team
      for (const team of teams) {
        const playerRows = (team.players || [])
          .filter(Boolean)
          .map((p) => mapPlayerToDB(p, team.id));
        
        if (playerRows.length > 0) {
          // Upsert players
          await upsertRows('players', playerRows);
          
          // Delete players that are no longer in this team
          const playerIds = playerRows.map((p) => p.id);
          await deleteMissing('players', 'team_id', team.id, playerIds);
        } else {
          // If no players, delete all players for this team
          await deleteMissing('players', 'team_id', team.id, []);
        }
      }

      // 5. Matches (+ per-match innings (+ per-innings balls))
      const teamsById = Object.fromEntries(teams.map((t) => [t.id, t]));
      const matches = (tournamentData.matches || []).filter(Boolean);
      const matchIds = matches.map((m) => m.id);

      // Clear broadcast_state references before deleting matches
      if (matchIds.length > 0) {
        const { data: broadcastData, error: broadcastFetchError } = await supabase
          .from('broadcast_state')
          .select('tournament_id, match_id')
          .eq('tournament_id', tournamentId);
        
        if (!broadcastFetchError && broadcastData) {
          const referencedMatches = broadcastData
            .filter(b => b.match_id && matchIds.includes(b.match_id));
          
          for (const ref of referencedMatches) {
            await supabase
              .from('broadcast_state')
              .update({ match_id: null })
              .eq('tournament_id', tournamentId)
              .eq('match_id', ref.match_id);
          }
        }
      }

      // Delete matches that are no longer present
      await deleteMissing('matches', 'tournament_id', tournamentId, matchIds);

      const failedMatchIds = [];

      for (const match of matches) {
        try {
          const inningsList = (match.innings || []).filter(Boolean);

          for (const innings of inningsList) {
            const ballRows = (innings.balls || [])
              .filter(Boolean)
              .map((b) => mapBallToDB(b, innings.id));
            
            if (ballRows.length > 0) {
              await upsertRows('balls', ballRows);
            }
            
            await deleteMissing(
              'balls',
              'innings_id',
              innings.id,
              ballRows.map((b) => b.id)
            );
          }

          const inningsRows = inningsList.map((i) =>
            mapInningsToDB(i, match.id)
          );
          
          if (inningsRows.length > 0) {
            await upsertRows('innings', inningsRows);
          }
          
          await deleteMissing(
            'innings',
            'match_id',
            match.id,
            inningsRows.map((i) => i.id)
          );

          // Save the match row
          await upsertRows('matches', [
            mapMatchToDB(match, tournamentId, teamsById),
          ]);
        } catch (matchError) {
          failedMatchIds.push(match.id);
          console.error(
            `⚠️ Failed to save match ${match.id} — skipping it for now, other matches were unaffected:`,
            matchError
          );
        }
      }

      if (failedMatchIds.length > 0) {
        throw new Error(
          `Failed to save ${failedMatchIds.length} match(es): ${failedMatchIds.join(
            ', '
          )}. Other data was saved successfully — see console for details.`
        );
      }

      setSaveState('saved');
      console.log('✅ Data saved successfully!');

      const updatedList = await loadTournamentsList();
      setTournaments(updatedList);
    } catch (error) {
      console.error('Save error:', error);
      setSaveState('error');
      setErrorMessage(error.message || 'Failed to save data');
      throw error;
    }
  },
  [loadTournamentsList]
);

  // Auto-save with debounce
  useEffect(() => {
    if (loading || !tournament || !activeId) return;

    if (firstLoad.current) {
      firstLoad.current = false;
      return;
    }

    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }

    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
    }

    setSaveState('saving');

    saveTimer.current = setTimeout(async () => {
      try {
        await saveTournamentData(tournament);
      } catch (error) {
        console.error('Auto-save error:', error);
      }
    }, 1000);

    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }
    };
  }, [tournament, loading, activeId, saveTournamentData]);

  // Switch tournament
  const switchTournament = useCallback(
    async (id) => {
      if (!id) return;

      setLoading(true);
      try {
        const data = await loadTournamentData(id);
        if (data) {
          skipNextSave.current = true;
          setActiveId(id);
          setTournament(data);
          await saveActiveTournamentToSettings(id);
          localStorage.setItem('supabase_active_tournament', id);
          console.log('Switched to tournament:', data.name);
        } else {
          const { data: rawRow, error } = await supabase
            .from('tournaments')
            .select('*')
            .eq('id', id)
            .maybeSingle();

          if (!error && rawRow) {
            skipNextSave.current = true;
            setActiveId(id);
            setTournament(buildEmptyTournament(rawRow));
            await saveActiveTournamentToSettings(id);
            localStorage.setItem('supabase_active_tournament', id);
            console.log('Switched to empty tournament:', rawRow.name);
          } else {
            console.error('Tournament to switch to was not found:', id);
          }
        }
      } catch (error) {
        console.error('Switch tournament error:', error);
      } finally {
        setLoading(false);
      }
    },
    [loadTournamentData, saveActiveTournamentToSettings]
  );

  // Create tournament
  const createTournament = useCallback(
    async (tournamentData) => {
      try {
        const newId =
          tournamentData.id ||
          (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString());

        const { data, error } = await supabase
          .from('tournaments')
          .insert({
            id: newId,
            name: tournamentData.name,
            default_overs: tournamentData.defaultOvers || 20,
            is_double_wicket: tournamentData.isDoubleWicket || false,
          })
          .select()
          .maybeSingle();

        if (error) {
          console.error('Create tournament error:', error);
          throw error;
        }

        const newTournament = buildEmptyTournament(data);

        setTournaments((prev) => [
          {
            id: data.id,
            name: data.name,
            createdAt: data.created_at,
            teamsCount: 0,
            matchesCount: 0,
          },
          ...prev,
        ]);

        skipNextSave.current = true;
        setActiveId(data.id);
        setTournament(newTournament);
        await saveActiveTournamentToSettings(data.id);
        localStorage.setItem('supabase_active_tournament', data.id);
        console.log('Created new tournament:', data.name);

        return newTournament;
      } catch (error) {
        console.error('Create tournament error:', error);
        throw error;
      }
    },
    [saveActiveTournamentToSettings]
  );

  // Delete tournament
  const deleteTournament = useCallback(
    async (id) => {
      if (!id) {
        console.error('No tournament ID provided');
        return;
      }

      const tournamentToDelete = tournaments.find((t) => t.id === id);
      const tournamentName = tournamentToDelete?.name || 'this tournament';

      if (
        !window.confirm(
          `Delete "${tournamentName}" permanently? This cannot be undone!`
        )
      ) {
        console.log('Deletion cancelled by user');
        return;
      }

      try {
        console.log('🗑️ Deleting tournament:', id);
        setLoading(true);

        // Clear broadcast_state first
        await supabase
          .from('broadcast_state')
          .delete()
          .eq('tournament_id', id);

        const { data: matches, error: matchesFetchError } = await supabase
          .from('matches')
          .select('id')
          .eq('tournament_id', id);
        if (matchesFetchError) throw matchesFetchError;

        if (matches && matches.length > 0) {
          const matchIds = matches.map((m) => m.id);

          const { data: innings, error: inningsFetchError } = await supabase
            .from('innings')
            .select('id')
            .in('match_id', matchIds);
          if (inningsFetchError) throw inningsFetchError;

          if (innings && innings.length > 0) {
            const inningIds = innings.map((i) => i.id);
            const { error: ballsDeleteError } = await supabase
              .from('balls')
              .delete()
              .in('innings_id', inningIds);
            if (ballsDeleteError) throw ballsDeleteError;
          }

          const { error: inningsDeleteError } = await supabase
            .from('innings')
            .delete()
            .in('match_id', matchIds);
          if (inningsDeleteError) throw inningsDeleteError;

          const { error: matchesDeleteError } = await supabase
            .from('matches')
            .delete()
            .in('id', matchIds);
          if (matchesDeleteError) throw matchesDeleteError;
        }

        const { data: teams, error: teamsFetchError } = await supabase
          .from('teams')
          .select('id')
          .eq('tournament_id', id);
        if (teamsFetchError) throw teamsFetchError;

        if (teams && teams.length > 0) {
          const teamIds = teams.map((t) => t.id);
          const { error: playersDeleteError } = await supabase
            .from('players')
            .delete()
            .in('team_id', teamIds);
          if (playersDeleteError) throw playersDeleteError;

          const { error: teamsDeleteError } = await supabase
            .from('teams')
            .delete()
            .in('id', teamIds);
          if (teamsDeleteError) throw teamsDeleteError;
        }

        const { error: poolsDeleteError } = await supabase
          .from('pools')
          .delete()
          .eq('tournament_id', id);
        if (poolsDeleteError) throw poolsDeleteError;

        const { error: tournamentError } = await supabase
          .from('tournaments')
          .delete()
          .eq('id', id);
        if (tournamentError) throw tournamentError;

        console.log('✅ Tournament deleted successfully');

        setTournaments((prev) => prev.filter((t) => t.id !== id));

        if (activeId === id) {
          const remaining = tournaments.filter((t) => t.id !== id);
          if (remaining.length > 0) {
            await switchTournament(remaining[0].id);
          } else {
            setActiveId(null);
            setTournament(null);
            await clearActiveTournamentSettings();
          }
        }
      } catch (error) {
        console.error('Delete tournament error:', error);
        setErrorMessage(error.message || 'Failed to delete tournament');
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [activeId, switchTournament, tournaments, clearActiveTournamentSettings]
  );

  // Rename tournament
  const renameTournament = useCallback(
    async (id, name) => {
      if (!id || !name) {
        console.error('Invalid rename parameters');
        return;
      }

      try {
        const { error } = await supabase
          .from('tournaments')
          .update({ name, updated_at: new Date().toISOString() })
          .eq('id', id);

        if (error) throw error;

        setTournaments((prev) =>
          prev.map((t) => (t.id === id ? { ...t, name } : t))
        );

        if (id === activeId && tournament) {
          skipNextSave.current = true;
          setTournament((prev) => ({ ...prev, name }));
        }

        console.log('✅ Tournament renamed to:', name);
      } catch (error) {
        console.error('Rename tournament error:', error);
        throw error;
      }
    },
    [activeId, tournament]
  );

  // Upload team logo
  const uploadTeamLogo = useCallback(async (teamId, file) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${teamId}_${Date.now()}.${fileExt}`;
      const filePath = `team-logos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('tournament-assets')
        .upload(filePath, file);

      if (uploadError) {
        console.error('Error uploading logo:', uploadError);
        return null;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from('tournament-assets').getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('teams')
        .update({ logo_url: publicUrl })
        .eq('id', teamId);

      if (updateError) {
        console.error('Error updating team logo:', updateError);
        return null;
      }

      return publicUrl;
    } catch (error) {
      console.error('Error uploading team logo:', error);
      return null;
    }
  }, []);

  // Upload player photo
  const uploadPlayerPhoto = useCallback(async (playerId, file) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${playerId}_${Date.now()}.${fileExt}`;
      const filePath = `player-photos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('tournament-assets')
        .upload(filePath, file);

      if (uploadError) {
        console.error('Error uploading photo:', uploadError);
        return null;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from('tournament-assets').getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('players')
        .update({ photo_url: publicUrl })
        .eq('id', playerId);

      if (updateError) {
        console.error('Error updating player photo:', updateError);
        return null;
      }

      return publicUrl;
    } catch (error) {
      console.error('Error uploading player photo:', error);
      return null;
    }
  }, []);

  return {
    tournament,
    setTournament,
    loading,
    saveState,
    connectionError,
    errorMessage,
    tournaments,
    activeId,
    switchTournament,
    createTournament,
    deleteTournament,
    renameTournament,
    uploadTeamLogo,
    uploadPlayerPhoto,
  };
}

// ─────────────────────────────────────────────────────────
// Broadcast state hook
// ─────────────────────────────────────────────────────────

export function useSupabaseBroadcast(tournamentId) {
  const [broadcast, setBroadcastState] = useState(null);
  const [loading, setLoading] = useState(true);
  const subscriptionRef = useRef(null);

  const loadBroadcast = useCallback(async () => {
    if (!tournamentId) return null;

    try {
      const { data, error } = await supabase
        .from('broadcast_state')
        .select('*')
        .eq('tournament_id', tournamentId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Load broadcast error:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Load broadcast error:', error);
      return null;
    }
  }, [tournamentId]);

  const saveBroadcast = useCallback(
    async (broadcastData) => {
      if (!tournamentId) return;

      try {
        const payload = {
          tournament_id: tournamentId,
          match_id: broadcastData.matchId || null,
          layers: broadcastData.layers || {},
          lineup_team_id: broadcastData.lineupTeamId || null,
          show_captain_photos: broadcastData.showCaptainPhotos || false,
        };

        const { error } = await supabase
          .from('broadcast_state')
          .upsert(payload, { onConflict: 'tournament_id' });

        if (error) {
          console.error('Save broadcast error:', error);
          throw error;
        }
      } catch (error) {
        console.error('Save broadcast error:', error);
        throw error;
      }
    },
    [tournamentId]
  );

  useEffect(() => {
    if (!tournamentId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const mapRow = (data) => ({
      matchId: data.match_id,
      layers: data.layers || {},
      lineupTeamId: data.lineup_team_id,
      showCaptainPhotos: data.show_captain_photos || false,
    });

    const init = async () => {
      try {
        const data = await loadBroadcast();
        if (!cancelled) {
          setBroadcastState(
            data
              ? mapRow(data)
              : {
                  matchId: null,
                  layers: { bug: true },
                  lineupTeamId: null,
                  showCaptainPhotos: false,
                }
          );
          setLoading(false);
        }
      } catch (error) {
        console.error('Broadcast init error:', error);
        if (!cancelled) {
          setBroadcastState({
            matchId: null,
            layers: { bug: true },
            lineupTeamId: null,
            showCaptainPhotos: false,
          });
          setLoading(false);
        }
      }
    };

    init();

    const subscription = supabase
      .channel(`broadcast-${tournamentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'broadcast_state',
          filter: `tournament_id=eq.${tournamentId}`,
        },
        (payload) => {
          if (cancelled) return;
          if (payload.eventType === 'DELETE') {
            setBroadcastState({
              matchId: null,
              layers: { bug: true },
              lineupTeamId: null,
              showCaptainPhotos: false,
            });
          } else if (payload.new) {
            setBroadcastState(mapRow(payload.new));
          }
        }
      )
      .subscribe();

    subscriptionRef.current = subscription;

    return () => {
      cancelled = true;
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
  }, [tournamentId, loadBroadcast]);

  const setBroadcast = useCallback(
    (updater) => {
      setBroadcastState((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        queueMicrotask(() => {
          saveBroadcast(next).catch((error) => {
            console.error('Failed to persist broadcast state:', error);
          });
        });
        return next;
      });
    },
    [saveBroadcast]
  );

  return { broadcast, setBroadcast, loading };
}