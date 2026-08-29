// hooks/useSupabaseData.js

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';

// Helper to convert Supabase data to app format
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

const mapMatchFromDB = (match) => ({
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

  // Load tournament data
  const loadTournamentData = useCallback(async (tournamentId) => {
    if (!tournamentId) return null;

    try {
      // Load tournament basic info
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

      // Load teams with players
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select(`
          *,
          players:players(*)
        `)
        .eq('tournament_id', tournamentId);

      if (teamsError) {
        console.error('Teams load error:', teamsError);
        // Continue with empty teams
      }

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
        .eq('tournament_id', tournamentId)
        .order('created_at', { ascending: true });

      if (matchesError) {
        console.error('Matches load error:', matchesError);
        // Continue with empty matches
      }

      // Load pools
      const { data: poolsData, error: poolsError } = await supabase
        .from('pools')
        .select('*')
        .eq('tournament_id', tournamentId);

      if (poolsError) {
        console.error('Pools load error:', poolsError);
        // Continue with empty pools
      }

      // Build tournament object
      const teams = (teamsData || []).map(mapTeamFromDB);
      const matches = (matchesData || []).map(m => ({
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

  // Load all tournaments list
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

      return (data || []).map(t => ({
        id: t.id,
        name: t.name,
        createdAt: t.created_at,
        teamsCount: 0,
        matchesCount: 0,
      }));
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
        console.log('app_settings table not found, creating...');
        try {
          const { error: createError } = await supabase
            .from('app_settings')
            .insert({ key: '_init', value: 'initialized' });

          if (createError) {
            console.error('Could not create app_settings table:', createError);
            return false;
          }
        } catch (e) {
          console.error('Error creating app_settings:', e);
          return false;
        }
        
        await supabase
          .from('app_settings')
          .delete()
          .eq('key', '_init');
        
        console.log('app_settings table created successfully');
        return true;
      }
      
      return true;
    } catch (error) {
      console.error('Error checking app_settings table:', error);
      return false;
    }
  }, []);

  // Get active tournament ID from app_settings
  const getActiveTournamentFromSettings = useCallback(async () => {
    try {
      const tableExists = await checkAppSettingsTable();
      if (!tableExists) {
        console.log('app_settings table not available');
        return null;
      }

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

  // Save active tournament ID to app_settings
  const saveActiveTournamentToSettings = useCallback(async (tournamentId) => {
    try {
      const tableExists = await checkAppSettingsTable();
      if (!tableExists) {
        console.log('app_settings table not available, skipping save');
        return false;
      }

      const { error } = await supabase
        .from('app_settings')
        .upsert({
          key: 'active_tournament_id',
          value: tournamentId,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });

      if (error) {
        console.error('Error saving active tournament to app_settings:', error);
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error saving active tournament to settings:', error);
      return false;
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
          console.log('📱 Active from localStorage:', active);
          
          if (active) {
            await saveActiveTournamentToSettings(active);
          }
        }

        if (!active && list.length > 0) {
          active = list[0].id;
          console.log('📌 Using first tournament as active:', active);
          await saveActiveTournamentToSettings(active);
        }

        if (active) {
          console.log('🎯 Loading tournament:', active);
          setActiveId(active);
          localStorage.setItem('supabase_active_tournament', active);
          
          const data = await loadTournamentData(active);
          if (!cancelled) {
            if (data) {
              setTournament(data);
              console.log('✅ Tournament loaded successfully:', data.name);
            } else {
              const { data: tournamentData, error } = await supabase
                .from('tournaments')
                .select('*')
                .eq('id', active)
                .maybeSingle();
              
              if (!error && tournamentData) {
                const emptyTournament = {
                  id: tournamentData.id,
                  name: tournamentData.name,
                  defaultOvers: tournamentData.default_overs || 20,
                  isDoubleWicket: tournamentData.is_double_wicket || false,
                  createdAt: tournamentData.created_at,
                  teams: [],
                  matches: [],
                  pools: [],
                };
                setTournament(emptyTournament);
                console.log('✅ Empty tournament created for:', tournamentData.name);
              } else {
                console.log('❌ Could not find tournament in database');
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

    return () => { cancelled = true; };
  }, [loadTournamentData, loadTournamentsList, getActiveTournamentFromSettings, saveActiveTournamentToSettings]);

  // Save tournament data - COMPLETELY FIXED
  const saveTournamentData = useCallback(async (tournamentData) => {
    if (!tournamentData || !tournamentData.id) {
      console.log('⚠️ No tournament data to save');
      return;
    }

    try {
      setSaveState('saving');
      console.log('💾 Saving tournament:', tournamentData.name);

      // Update tournament
      const { error: tournamentError } = await supabase
        .from('tournaments')
        .update({
          name: tournamentData.name,
          default_overs: tournamentData.defaultOvers || 20,
          is_double_wicket: tournamentData.isDoubleWicket || false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', tournamentData.id);

      if (tournamentError) {
        console.error('Tournament update error:', tournamentError);
        throw tournamentError;
      }

      // Update teams
      for (const team of tournamentData.teams || []) {
        // Check if team exists
        const { data: existingTeam, error: checkError } = await supabase
          .from('teams')
          .select('id')
          .eq('id', team.id)
          .maybeSingle();

        if (checkError) {
          console.error('Error checking team:', checkError);
          continue;
        }

        // Prepare team data
        const teamData = {
          id: team.id,
          tournament_id: tournamentData.id,
          pool_id: team.poolId || null,
          name: team.name,
          short_name: team.short || team.name.substring(0, 3).toUpperCase(),
          color: team.color || '#888888',
          logo_url: team.logo || null,
          captain_id: team.captainId || null,
          updated_at: new Date().toISOString(),
        };

        let teamError;
        if (existingTeam) {
          // Update existing team
          const { error } = await supabase
            .from('teams')
            .update(teamData)
            .eq('id', team.id);
          teamError = error;
        } else {
          // Insert new team
          const { error } = await supabase
            .from('teams')
            .insert(teamData);
          teamError = error;
        }

        if (teamError) {
          console.error('Team save error:', teamError);
          throw teamError;
        }

        // Update players for this team
        for (const player of team.players || []) {
          // Check if player exists
          const { data: existingPlayer, error: checkPlayerError } = await supabase
            .from('players')
            .select('id')
            .eq('id', player.id)
            .maybeSingle();

          if (checkPlayerError) {
            console.error('Error checking player:', checkPlayerError);
            continue;
          }

          const playerData = {
            id: player.id,
            team_id: team.id,
            name: player.name,
            role: player.role || 'Batter',
            photo_url: player.photo || null,
            updated_at: new Date().toISOString(),
          };

          let playerError;
          if (existingPlayer) {
            // Update existing player
            const { error } = await supabase
              .from('players')
              .update(playerData)
              .eq('id', player.id);
            playerError = error;
          } else {
            // Insert new player
            const { error } = await supabase
              .from('players')
              .insert(playerData);
            playerError = error;
          }

          if (playerError) {
            console.error('Player save error:', playerError);
            throw playerError;
          }
        }
      }

      setSaveState('saved');
      console.log('✅ Data saved successfully!');
      
      // Update tournaments list with new counts
      const updatedList = await loadTournamentsList();
      setTournaments(updatedList);
      
    } catch (error) {
      console.error('Save error:', error);
      setSaveState('error');
      setErrorMessage(error.message || 'Failed to save data');
      throw error;
    }
  }, [loadTournamentsList]);

  // Auto-save with debounce - FIXED
  useEffect(() => {
    if (loading || !tournament || !activeId) return;
    
    // Skip first load
    if (firstLoad.current) { 
      firstLoad.current = false; 
      return; 
    }

    // Clear existing timer
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
    }, 1000); // Increased to 1 second for better debouncing

    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }
    };
  }, [tournament, loading, activeId, saveTournamentData]);

  // Switch tournament
  const switchTournament = useCallback(async (id) => {
    if (!id) return;
    
    setLoading(true);
    try {
      const data = await loadTournamentData(id);
      if (data) {
        setActiveId(id);
        setTournament(data);
        await saveActiveTournamentToSettings(id);
        localStorage.setItem('supabase_active_tournament', id);
        console.log('Switched to tournament:', data.name);
      } else {
        const { data: tournamentData, error } = await supabase
          .from('tournaments')
          .select('*')
          .eq('id', id)
          .maybeSingle();
        
        if (!error && tournamentData) {
          const emptyTournament = {
            id: tournamentData.id,
            name: tournamentData.name,
            defaultOvers: tournamentData.default_overs || 20,
            isDoubleWicket: tournamentData.is_double_wicket || false,
            createdAt: tournamentData.created_at,
            teams: [],
            matches: [],
            pools: [],
          };
          setActiveId(id);
          setTournament(emptyTournament);
          await saveActiveTournamentToSettings(id);
          localStorage.setItem('supabase_active_tournament', id);
          console.log('Switched to empty tournament:', tournamentData.name);
        }
      }
    } catch (error) {
      console.error('Switch tournament error:', error);
    } finally {
      setLoading(false);
    }
  }, [loadTournamentData, saveActiveTournamentToSettings]);

  // Create tournament
  const createTournament = useCallback(async (tournamentData) => {
    try {
      const newId = tournamentData.id || (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString());
      
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

      const newTournament = {
        id: data.id,
        name: data.name,
        defaultOvers: data.default_overs || 20,
        isDoubleWicket: data.is_double_wicket || false,
        createdAt: data.created_at,
        teams: [],
        matches: [],
        pools: [],
      };

      setTournaments(prev => [{ 
        id: data.id, 
        name: data.name, 
        createdAt: data.created_at,
        teamsCount: 0,
        matchesCount: 0,
      }, ...prev]);
      
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
  }, [saveActiveTournamentToSettings]);

  // Delete tournament - COMPLETELY FIXED
  const deleteTournament = useCallback(async (id) => {
    if (!id) {
      console.error('No tournament ID provided');
      return;
    }

    // Find tournament name for confirmation
    const tournamentToDelete = tournaments.find(t => t.id === id);
    const tournamentName = tournamentToDelete?.name || 'this tournament';
    
    if (!window.confirm(`Delete "${tournamentName}" permanently? This cannot be undone!`)) {
      console.log('Deletion cancelled by user');
      return;
    }

    try {
      console.log('🗑️ Deleting tournament:', id);
      setLoading(true);

      // Step 1: Delete balls
      const { data: matches } = await supabase
        .from('matches')
        .select('id')
        .eq('tournament_id', id);
      
      if (matches && matches.length > 0) {
        const matchIds = matches.map(m => m.id);
        
        const { data: innings } = await supabase
          .from('innings')
          .select('id')
          .in('match_id', matchIds);
        
        if (innings && innings.length > 0) {
          const inningIds = innings.map(i => i.id);
          await supabase
            .from('balls')
            .delete()
            .in('innings_id', inningIds);
        }
        
        await supabase
          .from('innings')
          .delete()
          .in('match_id', matchIds);
        
        await supabase
          .from('matches')
          .delete()
          .in('id', matchIds);
      }

      // Step 2: Delete players
      const { data: teams } = await supabase
        .from('teams')
        .select('id')
        .eq('tournament_id', id);
      
      if (teams && teams.length > 0) {
        const teamIds = teams.map(t => t.id);
        await supabase
          .from('players')
          .delete()
          .in('team_id', teamIds);
        
        await supabase
          .from('teams')
          .delete()
          .in('id', teamIds);
      }

      // Step 3: Delete pools
      await supabase
        .from('pools')
        .delete()
        .eq('tournament_id', id);

      // Step 4: Delete broadcast state
      await supabase
        .from('broadcast_state')
        .delete()
        .eq('tournament_id', id);

      // Step 5: Finally delete the tournament
      const { error: tournamentError } = await supabase
        .from('tournaments')
        .delete()
        .eq('id', id);

      if (tournamentError) {
        console.error('Tournament delete error:', tournamentError);
        throw tournamentError;
      }

      console.log('✅ Tournament deleted successfully');

      // Update state
      setTournaments(prev => prev.filter(t => t.id !== id));
      
      if (activeId === id) {
        const remaining = tournaments.filter(t => t.id !== id);
        if (remaining.length > 0) {
          await switchTournament(remaining[0].id);
        } else {
          setActiveId(null);
          setTournament(null);
          localStorage.removeItem('supabase_active_tournament');
          await supabase
            .from('app_settings')
            .delete()
            .eq('key', 'active_tournament_id');
        }
      }
      
    } catch (error) {
      console.error('Delete tournament error:', error);
      setErrorMessage(error.message || 'Failed to delete tournament');
      throw error;
    } finally {
      setLoading(false);
    }
  }, [activeId, switchTournament, tournaments]);

  // Rename tournament
  const renameTournament = useCallback(async (id, name) => {
    if (!id || !name) {
      console.error('Invalid rename parameters');
      return;
    }

    try {
      const { error } = await supabase
        .from('tournaments')
        .update({ name, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        console.error('Rename tournament error:', error);
        throw error;
      }

      setTournaments(prev => prev.map(t =>
        t.id === id ? { ...t, name } : t
      ));

      if (id === activeId && tournament) {
        setTournament(prev => ({ ...prev, name }));
      }
      
      console.log('✅ Tournament renamed to:', name);
      
    } catch (error) {
      console.error('Rename tournament error:', error);
      throw error;
    }
  }, [activeId, tournament]);

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

      const { data: { publicUrl } } = supabase.storage
        .from('tournament-assets')
        .getPublicUrl(filePath);

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

      const { data: { publicUrl } } = supabase.storage
        .from('tournament-assets')
        .getPublicUrl(filePath);

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

// Broadcast state hook
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

  const saveBroadcast = useCallback(async (broadcastData) => {
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
  }, [tournamentId]);

  useEffect(() => {
    if (!tournamentId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const init = async () => {
      try {
        const data = await loadBroadcast();
        if (!cancelled) {
          setBroadcastState(data ? {
            matchId: data.match_id,
            layers: data.layers || {},
            lineupTeamId: data.lineup_team_id,
            showCaptainPhotos: data.show_captain_photos || false,
          } : {
            matchId: null,
            layers: { bug: true },
            lineupTeamId: null,
            showCaptainPhotos: false,
          });
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
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'broadcast_state',
        filter: `tournament_id=eq.${tournamentId}`,
      }, async () => {
        const data = await loadBroadcast();
        if (!cancelled && data) {
          setBroadcastState({
            matchId: data.match_id,
            layers: data.layers || {},
            lineupTeamId: data.lineup_team_id,
            showCaptainPhotos: data.show_captain_photos || false,
          });
        }
      })
      .subscribe();

    subscriptionRef.current = subscription;

    return () => {
      cancelled = true;
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
  }, [tournamentId, loadBroadcast]);

  const setBroadcast = useCallback(async (updater) => {
    setBroadcastState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      saveBroadcast(next);
      return next;
    });
  }, [saveBroadcast]);

  return { broadcast, setBroadcast, loading };
}