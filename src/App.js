import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Trophy, Users, CalendarDays, Radio, ClipboardList, BarChart3,
  Plus, Minus, Trash2, X, Check, RotateCcw, ChevronRight, ChevronLeft,
  Circle, Target, Award, Loader2, AlertTriangle, Menu,
  Tv, Star, Sparkles, TrendingUp, PartyPopper, Database, Download, Upload, Coins,
  Pencil, ChevronDown, ChevronUp, Crown, Percent, Camera
} from "lucide-react";

/* ============================================================
   CONSTANTS & UTILITIES
   ============================================================ */

const STORAGE_KEY = "ct_tournament_v1";
const BROADCAST_KEY = "ct_broadcast_v1";
const ARCHIVE_KEY = "ct_tournament_archive_v1";
const TOURNAMENTS_INDEX_KEY = "ct_tournaments_index_v1";
const ACTIVE_TOURNAMENT_KEY = "ct_active_tournament_id_v1";
const tournamentDataKey = (id) => `ct_tournament_data_v1__${id}`;

/* ============================================================
   LOCAL STORAGE SERVER
   ============================================================ */

if (typeof window !== "undefined" && !window.storage) {

  // Local Node.js storage server
  const STORAGE_SERVER = "http://127.0.0.1:4000";

  console.log("[storage] Server:", STORAGE_SERVER);

  window.storage = {

    async get(key, shared = false) {

      const url =
        `${STORAGE_SERVER}/api/storage` +
        `?key=${encodeURIComponent(key)}` +
        `&shared=${shared ? 1 : 0}`;

      console.log("[storage] GET:", url);

      try {

        const res = await fetch(url);

        if (!res.ok) {
          throw new Error(`Storage GET failed: HTTP ${res.status}`);
        }

        const data = await res.json();

        if (data.value === null || data.value === undefined) {
          throw new Error("not found");
        }

        return {
          key,
          value: data.value,
          shared: !!shared
        };

      } catch (error) {

        console.error("[storage] GET error:", error);

        throw error;
      }
    },


    async set(key, value, shared = false) {

      const url = `${STORAGE_SERVER}/api/storage`;

      console.log("[storage] SET:", {
        url,
        key,
        shared
      });

      try {

        const res = await fetch(url, {
          method: "POST",

          headers: {
            "Content-Type": "application/json"
          },

          body: JSON.stringify({
            key,
            value,
            shared: !!shared
          })
        });

        if (!res.ok) {

          let errorBody = "";

          try {
            errorBody = await res.text();
          } catch (e) {}

          throw new Error(
            `Storage SET failed: HTTP ${res.status} ${errorBody}`
          );
        }

        const data = await res.json();

        console.log("[storage] SET successful:", key);

        return {
          key,
          value,
          shared: !!shared
        };

      } catch (error) {

        console.error(
          "[storage] SET error:",
          error
        );

        throw error;
      }
    },


    async delete(key, shared = false) {

      const url =
        `${STORAGE_SERVER}/api/storage` +
        `?key=${encodeURIComponent(key)}` +
        `&shared=${shared ? 1 : 0}`;

      console.log("[storage] DELETE:", url);

      try {

        const res = await fetch(url, {
          method: "DELETE"
        });

        if (!res.ok) {
          throw new Error(
            `Storage DELETE failed: HTTP ${res.status}`
          );
        }

        return {
          key,
          deleted: true,
          shared: !!shared
        };

      } catch (error) {

        console.error(
          "[storage] DELETE error:",
          error
        );

        throw error;
      }
    },


    async list(prefix = "", shared = false) {

      const url =
        `${STORAGE_SERVER}/api/storage/list` +
        `?prefix=${encodeURIComponent(prefix)}` +
        `&shared=${shared ? 1 : 0}`;

      console.log("[storage] LIST:", url);

      try {

        const res = await fetch(url);

        if (!res.ok) {
          throw new Error(
            `Storage LIST failed: HTTP ${res.status}`
          );
        }

        const data = await res.json();

        return {
          keys: data.keys || [],
          prefix,
          shared: !!shared
        };

      } catch (error) {

        console.error(
          "[storage] LIST error:",
          error
        );

        throw error;
      }
    }
  };
}
const WICKET_TYPES = [
  "Bowled", "Caught", "LBW", "Run Out", "Stumped", "Hit Wicket", "Retired Hurt"
];

const uid = (p = "id") => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const TEAM_COLORS = ["#1D4ED8", "#DC2626", "#059669", "#D97706", "#7C3AED", "#DB2777", "#0891B2", "#65A30D"];
const nextTeamColor = (teams) => TEAM_COLORS[teams.length % TEAM_COLORS.length];

const OVERLAY_LAYERS = [
  { id: "bug", label: "Live Scorebug", icon: <Radio size={16} /> },
  { id: "toss", label: "Toss Result", icon: <Coins size={16} /> },
  { id: "lineup", label: "Team Lineup", icon: <Users size={16} /> },
  { id: "captains", label: "Captains Face-off", icon: <Crown size={16} /> },
  { id: "scorecard", label: "Live Scorecard", icon: <Circle size={16} /> },
  { id: "points", label: "Points Table", icon: <Award size={16} /> },
  { id: "stats", label: "Tournament Stats", icon: <BarChart3 size={16} /> },
  { id: "summary", label: "Match Summary", icon: <ClipboardList size={16} /> },
  { id: "graph", label: "Run Rate Graph", icon: <TrendingUp size={16} /> },
  { id: "ceremony", label: "Post-Match Ceremony", icon: <PartyPopper size={16} /> },
  { id: "motm", label: "Man of the Match", icon: <Star size={16} /> },
  { id: "upcoming", label: "Upcoming Matches", icon: <CalendarDays size={16} /> },
];

function initials(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function ballsToOverStr(validBalls) {
  const overs = Math.floor(validBalls / 6);
  const rem = validBalls % 6;
  return `${overs}.${rem}`;
}

function oversFloatForNRR(validBalls) {
  const overs = Math.floor(validBalls / 6);
  const rem = validBalls % 6;
  return overs + rem / 6;
}

function teamName(teams, id) {
  const t = teams.find((x) => x.id === id);
  return t ? t.name : "TBD";
}
function teamShort(teams, id) {
  const t = teams.find((x) => x.id === id);
  return t ? (t.short || t.name.slice(0, 3).toUpperCase()) : "TBD";
}
function playerName(teams, id) {
  for (const t of teams) {
    const p = t.players.find((pl) => pl.id === id);
    if (p) return p.name;
  }
  return "Unknown";
}

function computeInningsStats(innings, teams) {
  const battingTeam = teams.find((t) => t.id === innings.battingTeamId);
  const bowlingTeam = teams.find((t) => t.id === innings.bowlingTeamId);

  const batsmen = {};
  const bowlers = {};
  const fow = [];
  let totalRuns = 0;
  let totalWickets = 0;
  let validBalls = 0;
  let extras = { wd: 0, nb: 0, b: 0, lb: 0, penalty: 0 };
  let orderCounter = 0;
  const battingOrder = [];

  const ensureBatsman = (id) => {
    if (!batsmen[id]) {
      batsmen[id] = { id, runs: 0, balls: 0, fours: 0, sixes: 0, out: false, howOut: null, order: orderCounter++ };
      battingOrder.push(id);
    }
  };
  const ensureBowler = (id) => {
    if (!bowlers[id]) bowlers[id] = { id, balls: 0, runs: 0, wickets: 0 };
  };

  innings.balls.forEach((b) => {
    ensureBatsman(b.batsmanId);
    if (b.nonStrikerId) ensureBatsman(b.nonStrikerId);
    ensureBowler(b.bowlerId);

    const bowlerRec = bowlers[b.bowlerId];
    const batRec = batsmen[b.batsmanId];

    if (!b.extra) {
      validBalls += 1;
      batRec.balls += 1;
      batRec.runs += b.runsBat;
      if (b.runsBat === 4) batRec.fours += 1;
      if (b.runsBat === 6) batRec.sixes += 1;
      totalRuns += b.runsBat;
      bowlerRec.balls += 1;
      bowlerRec.runs += b.runsBat;
    } else if (b.extra === "wd") {
      totalRuns += 1 + (b.extraRuns || 0);
      extras.wd += 1 + (b.extraRuns || 0);
      bowlerRec.runs += 1 + (b.extraRuns || 0);
    } else if (b.extra === "nb") {
      validBalls += 0;
      totalRuns += 1 + (b.runsBat || 0);
      extras.nb += 1;
      batRec.runs += b.runsBat || 0;
      if (b.runsBat === 4) batRec.fours += 1;
      if (b.runsBat === 6) batRec.sixes += 1;
      bowlerRec.runs += 1 + (b.runsBat || 0);
    } else if (b.extra === "b") {
      validBalls += 1;
      batRec.balls += 1;
      totalRuns += b.extraRuns || 0;
      extras.b += b.extraRuns || 0;
      bowlerRec.balls += 1;
    } else if (b.extra === "lb") {
      validBalls += 1;
      batRec.balls += 1;
      totalRuns += b.extraRuns || 0;
      extras.lb += b.extraRuns || 0;
      bowlerRec.balls += 1;
    } else if (b.extra === "penalty") {
      // Double Wicket "OUT −2": this now counts as a normal legal delivery —
      // it consumes a ball from the over (validBalls++), counts against the
      // striker's balls-faced, and counts against the bowler's over tally,
      // exactly like any other legal ball. Only the run value is different
      // (it deducts from the team total instead of adding).
      validBalls += 1;
      batRec.balls += 1;
      totalRuns += b.runsBat;
      extras.penalty += b.runsBat;
      bowlerRec.balls += 1;
    }

    if (b.isWicket) {
      totalWickets += 1;
      const outId = b.outBatsmanId || b.batsmanId;
      ensureBatsman(outId);
      batsmen[outId].out = true;
      batsmen[outId].howOut = { type: b.wicketType, bowlerId: b.wicketType === "Run Out" ? null : b.bowlerId, fielder: b.fielderNote || null };
      if (b.wicketType !== "Run Out" && b.wicketType !== "Retired Hurt") bowlerRec.wickets += 1;
      fow.push({ score: totalRuns, wicketNum: totalWickets, batsmanId: outId, overStr: ballsToOverStr(validBalls) });
    }
  });

  return {
    battingTeam, bowlingTeam, batsmen, bowlers, fow, totalRuns: totalRuns + (innings.runAdjustment || 0), totalWickets,
    validBalls, extras, battingOrder, runAdjustment: innings.runAdjustment || 0,
    oversStr: ballsToOverStr(validBalls),
    runRate: validBalls > 0 ? ((totalRuns + (innings.runAdjustment || 0)) / (validBalls / 6)).toFixed(2) : "0.00",
  };
}

function computePointsTable(tournament, teamIds) {
  const scope = teamIds ? tournament.teams.filter((t) => teamIds.includes(t.id)) : tournament.teams;
  const table = {};
  scope.forEach((t) => {
    table[t.id] = {
      teamId: t.id, played: 0, won: 0, lost: 0, tied: 0, noResult: 0,
      points: 0, runsFor: 0, oversFor: 0, runsAgainst: 0, oversAgainst: 0,
    };
  });

  tournament.matches.forEach((m) => {
    if (m.status !== "completed" || !m.result) return;
    const [inn1, inn2] = m.innings;
    if (!inn1 || !inn2) return;
    const s1 = computeInningsStats(inn1, tournament.teams);
    const s2 = computeInningsStats(inn2, tournament.teams);

    [inn1.battingTeamId, inn2.battingTeamId].forEach((id) => {
      if (table[id]) table[id].played += 1;
    });

    if (table[inn1.battingTeamId]) {
      table[inn1.battingTeamId].runsFor += s1.totalRuns;
      table[inn1.battingTeamId].oversFor += oversFloatForNRR(s1.validBalls);
      table[inn1.battingTeamId].runsAgainst += s2.totalRuns;
      table[inn1.battingTeamId].oversAgainst += oversFloatForNRR(s2.validBalls);
    }
    if (table[inn2.battingTeamId]) {
      table[inn2.battingTeamId].runsFor += s2.totalRuns;
      table[inn2.battingTeamId].oversFor += oversFloatForNRR(s2.validBalls);
      table[inn2.battingTeamId].runsAgainst += s1.totalRuns;
      table[inn2.battingTeamId].oversAgainst += oversFloatForNRR(s1.validBalls);
    }

    if (m.result.type === "win") {
      if (table[m.result.winnerId]) { table[m.result.winnerId].won += 1; table[m.result.winnerId].points += 2; }
      const loserId = m.result.winnerId === inn1.battingTeamId ? inn2.battingTeamId : inn1.battingTeamId;
      if (table[loserId]) table[loserId].lost += 1;
    } else if (m.result.type === "tie") {
      [inn1.battingTeamId, inn2.battingTeamId].forEach((id) => {
        if (table[id]) { table[id].tied += 1; table[id].points += 1; }
      });
    } else if (m.result.type === "noresult") {
      [inn1.battingTeamId, inn2.battingTeamId].forEach((id) => {
        if (table[id]) { table[id].noResult += 1; table[id].points += 1; }
      });
    }
  });

  return Object.values(table)
    .map((r) => {
      const nrr = r.oversFor > 0 && r.oversAgainst > 0
        ? (r.runsFor / r.oversFor - r.runsAgainst / r.oversAgainst)
        : 0;
      return { ...r, nrr };
    })
    .sort((a, b) => b.points - a.points || b.nrr - a.nrr);
}

function generateRoundRobin(teamIds, oversLimit, double) {
  const matches = [];
  for (let i = 0; i < teamIds.length; i++) {
    for (let j = i + 1; j < teamIds.length; j++) {
      matches.push({
        id: uid("match"), teamAId: teamIds[i], teamBId: teamIds[j],
        oversLimit, status: "upcoming", tossWinner: null, tossChoice: null,
        innings: [null, null], currentInnings: 0, result: null,
      });
      if (double) {
        matches.push({
          id: uid("match"), teamAId: teamIds[j], teamBId: teamIds[i],
          oversLimit, status: "upcoming", tossWinner: null, tossChoice: null,
          innings: [null, null], currentInnings: 0, result: null,
        });
      }
    }
  }
  return matches;
}

/* ============================================================
   STORAGE HOOK
   ============================================================ */

function fireAndForget(maybePromise) {
  return Promise.resolve(maybePromise).catch(() => {});
}

function useTournamentStorage() {
  const [tournaments, setTournaments] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [tournament, setTournamentState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState("idle");
  const [connectionError, setConnectionError] = useState(false);
  const saveTimer = useRef(null);
  const firstLoad = useRef(true);

  const loadTournamentData = useCallback(async (id) => {
    try {
      const res = await window.storage.get(tournamentDataKey(id), true);
      return res && res.value ? JSON.parse(res.value) : null;
    } catch (e) {
      return null;
    }
  }, []);

  const indexEntryFor = (t) => ({
    id: t.id, name: t.name, updatedAt: Date.now(), teamsCount: t.teams.length, matchesCount: t.matches.length,
  });

  useEffect(() => {
    let cancelled = false;
    const tryLoad = async () => {
      try {
        let index = [];
        try {
          const res = await window.storage.get(TOURNAMENTS_INDEX_KEY, true);
          index = res && res.value ? JSON.parse(res.value) : [];
        } catch (e) { }

        let active = null;
        try {
          const res = await window.storage.get(ACTIVE_TOURNAMENT_KEY, true);
          active = res && res.value ? res.value : null;
        } catch (e) { }

        if (index.length === 0) {
          const migrated = [];
          try {
            const legacy = await window.storage.get(STORAGE_KEY, true);
            if (legacy && legacy.value) {
              const t = JSON.parse(legacy.value);
              await window.storage.set(tournamentDataKey(t.id), JSON.stringify(t), true);
              migrated.push(indexEntryFor(t));
              active = t.id;
            }
          } catch (e) { }
          try {
            const legacyArchive = await window.storage.get(ARCHIVE_KEY, true);
            const list = legacyArchive && legacyArchive.value ? JSON.parse(legacyArchive.value) : [];
            for (const a of list) {
              const t = a.data;
              if (!t || !t.id) continue;
              await window.storage.set(tournamentDataKey(t.id), JSON.stringify(t), true);
              migrated.push({ ...indexEntryFor(t), name: a.name || t.name, updatedAt: a.savedAt || Date.now() });
            }
          } catch (e) { }
          if (migrated.length > 0) {
            index = migrated;
            await window.storage.set(TOURNAMENTS_INDEX_KEY, JSON.stringify(index), true);
          }
        }

        if (!active && index.length > 0) active = index[0].id;
        if (active) fireAndForget(window.storage.set(ACTIVE_TOURNAMENT_KEY, active, true));

        if (cancelled) return;
        setTournaments(index);
        setActiveId(active);

        if (active) {
          const data = await loadTournamentData(active);
          if (!cancelled) setTournamentState(data);
        }
        setConnectionError(false);
        setLoading(false);
      } catch (e) {
        if (cancelled) return;
        setLoading(false);
        setConnectionError(true);
        setTimeout(tryLoad, 1500);
      }
    };
    tryLoad();
    return () => { cancelled = true; };
  }, [loadTournamentData]);

  // ⭐ THIS WAS MISSING — autosave tournament state to storage so the
  // overlay (a separate window polling storage) actually sees live updates.
  useEffect(() => {
    if (loading || !tournament || !activeId) return;
    if (firstLoad.current) { firstLoad.current = false; return; }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState("saving");
    saveTimer.current = setTimeout(async () => {
      try {
        await window.storage.set(tournamentDataKey(activeId), JSON.stringify(tournament), true);
        setTournaments((prev) => {
          const next = prev.map((x) =>
            x.id === activeId
              ? {
                  ...x,
                  updatedAt: Date.now(),
                  teamsCount: tournament.teams.length,
                  matchesCount: tournament.matches.length,
                  name: tournament.name,
                }
              : x
          );
          fireAndForget(window.storage.set(TOURNAMENTS_INDEX_KEY, JSON.stringify(next), true));
          return next;
        });
        setSaveState("saved");
      } catch (e) {
        setSaveState("error");
      }
    }, 300); // debounce so rapid ball-by-ball scoring doesn't spam storage
    return () => clearTimeout(saveTimer.current);
  }, [tournament, loading, activeId]);

  const switchTournament = useCallback(async (id) => {
    setLoading(true);
    const data = await loadTournamentData(id);
    setActiveId(id);
    setTournamentState(data);
    firstLoad.current = true;
    await fireAndForget(window.storage.set(ACTIVE_TOURNAMENT_KEY, id, true));
    setLoading(false);
  }, [loadTournamentData]);

  const createTournament = useCallback(async (t) => {
    await window.storage.set(tournamentDataKey(t.id), JSON.stringify(t), true);
    setTournaments((prev) => {
      const next = [indexEntryFor(t), ...prev];
      fireAndForget(window.storage.set(TOURNAMENTS_INDEX_KEY, JSON.stringify(next), true));
      return next;
    });
    await fireAndForget(window.storage.set(ACTIVE_TOURNAMENT_KEY, t.id, true));
    setActiveId(t.id);
    firstLoad.current = true;
    setTournamentState(t);
  }, []);

  const deleteTournament = useCallback(async (id) => {
    let remaining = [];
    setTournaments((prev) => {
      remaining = prev.filter((x) => x.id !== id);
      fireAndForget(window.storage.set(TOURNAMENTS_INDEX_KEY, JSON.stringify(remaining), true));
      return remaining;
    });
    fireAndForget(window.storage.delete(tournamentDataKey(id), true));
    if (activeId === id) {
      if (remaining.length > 0) {
        await switchTournament(remaining[0].id);
      } else {
        setActiveId(null);
        setTournamentState(null);
        fireAndForget(window.storage.delete(ACTIVE_TOURNAMENT_KEY, true));
      }
    }
  }, [activeId, switchTournament]);

  const renameTournament = useCallback(async (id, name) => {
    if (id === activeId) {
      setTournamentState((prev) => (prev ? { ...prev, name } : prev));
      return;
    }
    const data = await loadTournamentData(id);
    if (!data) return;
    const updated = { ...data, name };
    await window.storage.set(tournamentDataKey(id), JSON.stringify(updated), true);
    setTournaments((prev) => {
      const next = prev.map((x) => (x.id === id ? { ...x, name } : x));
      fireAndForget(window.storage.set(TOURNAMENTS_INDEX_KEY, JSON.stringify(next), true));
      return next;
    });
  }, [activeId, loadTournamentData]);

  return {
    tournament, setTournament: setTournamentState, loading, saveState, connectionError,
    tournaments, activeId, switchTournament, createTournament, deleteTournament, renameTournament,
  };
}

function defaultBroadcastState() {
  const layers = {};
  OVERLAY_LAYERS.forEach((l) => { layers[l.id] = l.id === "bug"; });
  return { layers, matchId: null, lineupTeamId: null, showCaptainPhotos: false };
}

function normalizeBroadcastLayers(broadcast) {
  if (broadcast && broadcast.layers) return broadcast.layers;
  const base = defaultBroadcastState().layers;
  if (broadcast && broadcast.scene) {
    if (broadcast.scene === "none") base.bug = false;
    else base[broadcast.scene] = true;
  }
  return base;
}

function useBroadcastControl() {
  const [state, setState] = useState(defaultBroadcastState());
  const [loading, setLoading] = useState(true);
  const saveTimer = useRef(null);
  const firstLoad = useRef(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get(BROADCAST_KEY, true);
        if (res && res.value) {
          const parsed = JSON.parse(res.value);
          setState({ ...parsed, layers: normalizeBroadcastLayers(parsed) });
        }
      } catch (e) { }
      finally { setLoading(false); }
    })();
  }, []);

  useEffect(() => {
    if (loading) return;
    if (firstLoad.current) { firstLoad.current = false; return; }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await window.storage.set(BROADCAST_KEY, JSON.stringify(state), true);
      } catch (e) { }
    }, 250);
    return () => clearTimeout(saveTimer.current);
  }, [state, loading]);

  return { broadcast: state, setBroadcast: setState, loading };
}

function computeManhattan(innings) {
  const overs = {};
  innings.balls.forEach((b) => {
    const overNum = b.overNum;
    if (!overs[overNum]) overs[overNum] = { over: overNum + 1, runs: 0, wickets: 0 };
    let runs = 0;
    if (!b.extra) runs = b.runsBat;
    else if (b.extra === "wd") runs = 1 + (b.extraRuns || 0);
    else if (b.extra === "nb") runs = 1 + (b.runsBat || 0);
    else if (b.extra === "penalty") runs = b.runsBat || 0;
    else runs = b.extraRuns || 0;
    overs[overNum].runs += runs;
    if (b.isWicket) overs[overNum].wickets += 1;
  });
  return Object.values(overs).sort((a, b) => a.over - b.over);
}

function aggregateMatchPerformers(match, teams) {
  const battersAll = [];
  const bowlersAll = [];
  (match.innings || []).forEach((inn) => {
    if (!inn) return;
    const s = computeInningsStats(inn, teams);
    Object.values(s.batsmen).forEach((b) => battersAll.push(b));
    Object.values(s.bowlers).forEach((b) => bowlersAll.push(b));
  });
  return {
    topScorers: battersAll.sort((a, b) => b.runs - a.runs).slice(0, 3),
    topBowlers: bowlersAll.sort((a, b) => b.wickets - a.wickets || a.runs - b.runs).slice(0, 3),
  };
}

// FIX (bug #3): look up a specific player's batting/bowling figures for this
// match directly, instead of only searching inside the top-3 aggregated
// lists above. Previously the "Man of the Match" graphic went blank for any
// MOTM pick who wasn't already a top-3 run scorer / wicket taker.
function getPlayerInningsBattingStats(match, teams, playerId) {
  for (const inn of match.innings || []) {
    if (!inn) continue;
    const s = computeInningsStats(inn, teams);
    if (s.batsmen[playerId]) return s.batsmen[playerId];
  }
  return null;
}
function getPlayerInningsBowlingStats(match, teams, playerId) {
  for (const inn of match.innings || []) {
    if (!inn) continue;
    const s = computeInningsStats(inn, teams);
    if (s.bowlers[playerId]) return s.bowlers[playerId];
  }
  return null;
}

function aggregatePlayerStats(tournament) {
  const runsMap = {};
  const wicketsMap = {};
  tournament.matches.forEach((m) => {
    (m.innings || []).forEach((inn) => {
      if (!inn) return;
      const stats = computeInningsStats(inn, tournament.teams);
      Object.values(stats.batsmen).forEach((b) => {
        if (!runsMap[b.id]) runsMap[b.id] = { id: b.id, name: playerName(tournament.teams, b.id), runs: 0, balls: 0, fours: 0, sixes: 0, matches: new Set() };
        runsMap[b.id].runs += b.runs;
        runsMap[b.id].balls += b.balls;
        runsMap[b.id].fours += b.fours;
        runsMap[b.id].sixes += b.sixes;
        runsMap[b.id].matches.add(m.id);
      });
      Object.values(stats.bowlers).forEach((b) => {
        if (!wicketsMap[b.id]) wicketsMap[b.id] = { id: b.id, name: playerName(tournament.teams, b.id), wickets: 0, runs: 0, balls: 0, matches: new Set() };
        wicketsMap[b.id].wickets += b.wickets;
        wicketsMap[b.id].runs += b.runs;
        wicketsMap[b.id].balls += b.balls;
        wicketsMap[b.id].matches.add(m.id);
      });
    });
  });
  const topRuns = Object.values(runsMap)
    .map((p) => ({
      ...p,
      matches: p.matches.size,
      strikeRate: p.balls > 0 ? (p.runs / p.balls) * 100 : 0,
    }))
    .sort((a, b) => b.runs - a.runs);
  const topWickets = Object.values(wicketsMap)
    .map((p) => ({
      ...p,
      matches: p.matches.size,
      oversStr: ballsToOverStr(p.balls),
      economy: p.balls > 0 ? p.runs / (p.balls / 6) : 0,
      average: p.wickets > 0 ? p.runs / p.wickets : null,
    }))
    .sort((a, b) => b.wickets - a.wickets);
  return { topRuns, topWickets };
}

/* ============================================================
   SMALL UI PRIMITIVES
   ============================================================ */

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="ct-modal-backdrop" onClick={onClose}>
      <div className={"ct-modal" + (wide ? " ct-modal-wide" : "")} onClick={(e) => e.stopPropagation()}>
        <div className="ct-modal-head">
          <span>{title}</span>
          <button className="ct-icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="ct-modal-body">{children}</div>
      </div>
    </div>
  );
}

function DigitTile({ value, label }) {
  return (
    <div className="ct-digit-tile">
      <div className="ct-digit-value">{value}</div>
      <div className="ct-digit-label">{label}</div>
    </div>
  );
}

function EmptyState({ icon, title, sub, action }) {
  return (
    <div className="ct-empty">
      {icon}
      <div className="ct-empty-title">{title}</div>
      {sub && <div className="ct-empty-sub">{sub}</div>}
      {action}
    </div>
  );
}

// Shows the team's uploaded logo image when set; otherwise falls back to the
// existing colored initials badge. `className` supplies sizing/shape from
// whichever context renders it (matchup crest, scorecard badge, points
// table row, etc.) so logo and fallback always match the surrounding style.
function TeamCrest({ team, className, fallbackColor, children }) {
  if (team?.logo) {
    return <img className={className} src={team.logo} alt="" style={{ objectFit: "cover" }} />;
  }
  return (
    <div className={className} style={{ background: team?.color || fallbackColor || "#7C3AED" }}>
      {children != null ? children : (team?.short || "TBD")}
    </div>
  );
}

/* ============================================================
   ROOT APP
   ============================================================ */

export default function App() {
  const [route, setRoute] = useState(() => (typeof window !== "undefined" ? window.location.hash : ""));
  useEffect(() => {
    const onHash = () => setRoute(window.location.hash);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  useEffect(() => {
    if (typeof document !== "undefined") document.title = "Meriiz Cric Score — Live";
  }, []);
  if (route === "#overlay") return <OverlayApp />;
  return <MainApp />;
}

function MainApp() {
  const {
    tournament, setTournament, loading, saveState, connectionError,
    tournaments, activeId, switchTournament, createTournament, deleteTournament, renameTournament,
  } = useTournamentStorage();
  const { broadcast, setBroadcast, loading: broadcastLoading } = useBroadcastControl();
  const [tab, setTab] = useState("dashboard");
  const [activeMatchId, setActiveMatchId] = useState(null);
  const [navOpen, setNavOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const patchTournament = useCallback((fn) => {
    setTournament((prev) => {
      if (!prev) return prev;
      const next = typeof fn === "function" ? fn(structuredCloneSafe(prev)) : fn;
      return next;
    });
  }, [setTournament]);

  if (loading) {
    return (
      <div className="ct-root ct-loading-screen">
        <Loader2 className="ct-spin" size={28} />
        <div>Loading tournament…</div>
        <Styles />
      </div>
    );
  }

  if (connectionError && !tournament) {
    return (
      <div className="ct-root ct-loading-screen">
        <Styles />
        <AlertTriangle size={28} color="#F2A93B" />
        <div>Can't reach the storage server (localhost:4000)…</div>
        <div className="ct-empty-sub">Your saved data is safe — this just means the app can't read it back yet. Make sure <code>node server.js</code> is running in its own terminal, then this will connect automatically.</div>
      </div>
    );
  }

  if (!tournament) {
    return <SetupScreen onCreate={(t) => createTournament(t)} />;
  }

  const nav = [
    { id: "dashboard", label: "Dashboard", icon: <Trophy size={17} /> },
    { id: "teams", label: "Teams", icon: <Users size={17} /> },
    { id: "fixtures", label: "Fixtures", icon: <CalendarDays size={17} /> },
    { id: "scoring", label: "Live Scoring", icon: <Radio size={17} /> },
    { id: "scorecards", label: "Scorecards", icon: <ClipboardList size={17} /> },
    { id: "points", label: "Points Table", icon: <Award size={17} /> },
    { id: "stats", label: "Stats", icon: <BarChart3 size={17} /> },
    { id: "broadcast", label: "Broadcast Control", icon: <Tv size={17} /> },
    { id: "data", label: "Data & Backup", icon: <Database size={17} /> },
  ];

  const openOverlay = () => {
    const url = window.location.href.split("#")[0] + "#overlay";
    window.open(url, "ct_overlay", "width=1920,height=1080");
  };

  return (
    <div className="ct-root">
      <Styles />
      <div className="ct-shell">
        <aside className={"ct-sidebar" + (navOpen ? " ct-sidebar-open" : "")}>
          <button className="ct-brand ct-brand-btn" onClick={() => setSwitcherOpen(true)}>
            <div className="ct-brand-mark">🏏</div>
            <div>
              <div className="ct-brand-title">
                {tournament.name}
                {tournament.isDoubleWicket && <span className="ct-tag ct-tag-active" style={{ marginLeft: 6 }}>Double Wicket</span>}
              </div>
              <div className="ct-brand-sub">{tournament.teams.length} teams · {tournament.matches.length} matches</div>
            </div>
            <ChevronDown size={16} className="ct-brand-chevron" />
          </button>
          <nav className="ct-nav">
            {nav.map((n) => (
              <button
                key={n.id}
                className={"ct-nav-item" + (tab === n.id ? " ct-nav-item-active" : "")}
                onClick={() => { setTab(n.id); setNavOpen(false); }}
              >
                {n.icon}<span>{n.label}</span>
              </button>
            ))}
          </nav>
          <button className="ct-btn ct-btn-ghost ct-btn-block ct-overlay-launch" onClick={openOverlay}>
            <Radio size={15} /> Open Broadcast Overlay
          </button>
          <div className="ct-save-indicator">
            {saveState === "saving" && <>Saving…</>}
            {saveState === "saved" && <>All changes saved</>}
            {saveState === "error" && <>Save failed</>}
          </div>
        </aside>

        <div className="ct-main">
          <header className="ct-topbar">
            <button className="ct-icon-btn ct-hide-desktop" onClick={() => setNavOpen((v) => !v)}><Menu size={20} /></button>
            <div className="ct-topbar-title">{nav.find((n) => n.id === tab)?.label}</div>
          </header>
          <div className="ct-content">
            {tab === "dashboard" && <Dashboard tournament={tournament} setTab={setTab} setActiveMatchId={setActiveMatchId} />}
            {tab === "teams" && <TeamsTab tournament={tournament} patch={patchTournament} />}
            {tab === "fixtures" && (
              <FixturesTab
                tournament={tournament}
                patch={patchTournament}
                onOpenMatch={(id) => { setActiveMatchId(id); setTab("scoring"); }}
              />
            )}
            {tab === "scoring" && (
              <ScoringTab
                tournament={tournament}
                patch={patchTournament}
                activeMatchId={activeMatchId}
                setActiveMatchId={setActiveMatchId}
                broadcast={broadcast}
                setBroadcast={setBroadcast}
                broadcastLoading={broadcastLoading}
              />
            )}
            {tab === "scorecards" && <ScorecardsTab tournament={tournament} />}
            {tab === "points" && <PointsTableTab tournament={tournament} />}
            {tab === "stats" && <StatsTab tournament={tournament} />}
            {tab === "broadcast" && (
              <BroadcastTab
                tournament={tournament}
                patch={patchTournament}
                broadcast={broadcast}
                setBroadcast={setBroadcast}
                loading={broadcastLoading}
              />
            )}
            {tab === "data" && <DataTab tournament={tournament} setTournament={setTournament} />}
          </div>
        </div>
      </div>

      {switcherOpen && (
        <TournamentSwitcherModal
          tournaments={tournaments}
          activeId={activeId}
          onSwitch={async (id) => { await switchTournament(id); setSwitcherOpen(false); }}
          onCreate={async (t) => { await createTournament(t); setSwitcherOpen(false); }}
          onDelete={(id) => deleteTournament(id)}
          onRename={(id, name) => renameTournament(id, name)}
          onClose={() => setSwitcherOpen(false)}
        />
      )}
    </div>
  );
}

/* ============================================================
   TOURNAMENT SWITCHER
   ============================================================ */

function TournamentSwitcherModal({ tournaments, activeId, onSwitch, onCreate, onDelete, onRename, onClose }) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newOvers, setNewOvers] = useState(20);
  const [newDoubleWicket, setNewDoubleWicket] = useState(false);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");

  const submitCreate = () => {
    if (!newName.trim()) return;
    onCreate({
      id: uid("tour"), name: newName.trim(), defaultOvers: Number(newOvers) || 20,
      isDoubleWicket: newDoubleWicket,
      teams: [], matches: [], pools: [], createdAt: Date.now(),
    });
    setCreating(false); setNewName(""); setNewOvers(20); setNewDoubleWicket(false);
  };

  const submitRename = (id) => {
    if (renameValue.trim()) onRename(id, renameValue.trim());
    setRenamingId(null);
  };

  const sorted = [...tournaments].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  return (
    <div className="ct-modal-backdrop" onClick={onClose}>
      <div className="ct-modal ct-modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="ct-modal-head">
          Your Tournaments
          <button className="ct-icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="ct-modal-body">
          {sorted.length === 0 ? (
            <div className="ct-muted-note">No tournaments yet — create your first one below.</div>
          ) : (
            <div className="ct-stack-sm">
              {sorted.map((t) => (
                <div className={"ct-card ct-match-row" + (t.id === activeId ? " ct-switcher-row-active" : "")} key={t.id}>
                  <div className="ct-match-teams">
                    {renamingId === t.id ? (
                      <input
                        className="ct-input" autoFocus value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={() => submitRename(t.id)}
                        onKeyDown={(e) => { if (e.key === "Enter") submitRename(t.id); if (e.key === "Escape") setRenamingId(null); }}
                      />
                    ) : (
                      <>
                        <b>{t.name}</b>{t.id === activeId && <span className="ct-tag ct-tag-active" style={{ marginLeft: 8 }}>Open now</span>}
                        <div className="ct-muted-note">{t.teamsCount || 0} teams · {t.matchesCount || 0} matches</div>
                      </>
                    )}
                  </div>
                  <div className="ct-row-gap">
                    {t.id !== activeId && (
                      <button className="ct-btn ct-btn-ghost ct-btn-sm" onClick={() => onSwitch(t.id)}>Switch</button>
                    )}
                    <button className="ct-icon-btn" onClick={() => { setRenamingId(t.id); setRenameValue(t.name); }}><Pencil size={15} /></button>
                    <button
                      className="ct-icon-btn"
                      onClick={() => { if (window.confirm(`Delete "${t.name}" permanently? This can't be undone.`)) onDelete(t.id); }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {creating ? (
            <div className="ct-card" style={{ marginTop: 14 }}>
              <label className="ct-field-label">Tournament name</label>
              <input className="ct-input" autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Shahkot Premier League 2026" />
              <label className="ct-field-label">Default overs per innings</label>
              <input className="ct-input" type="number" min={1} max={50} value={newOvers} onChange={(e) => setNewOvers(e.target.value)} />
              <label className="ct-check-row">
                <input type="checkbox" checked={newDoubleWicket} onChange={(e) => setNewDoubleWicket(e.target.checked)} />
                Double Wicket tournament (−2 penalty on dismissal)
              </label>
              <div className="ct-row-gap ct-mt">
                <button className="ct-btn ct-btn-primary ct-btn-sm" onClick={submitCreate} disabled={!newName.trim()}>Create</button>
                <button className="ct-btn ct-btn-ghost ct-btn-sm" onClick={() => setCreating(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <button className="ct-btn ct-btn-primary ct-btn-block" style={{ marginTop: 14 }} onClick={() => setCreating(true)}>
              <Plus size={15} /> New Tournament
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   BROADCAST OVERLAY
   ============================================================ */

function isNotFoundErr(e) {
  return !!e && e.message === "not found";
}

function OverlayApp() {
  const [tournament, setTournament] = useState(null);
  const [broadcast, setBroadcastState] = useState(defaultBroadcastState());
  const [flash, setFlash] = useState(null);
  const [diag, setDiag] = useState("connecting");
  const lastBallCountRef = useRef(null);
  const lastMatchIdRef = useRef(null);
  const flashTimerRef = useRef(null);

  useEffect(() => {
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
    document.body.style.margin = "0";
  }, []);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      let activeId = null;
      let unreachable = false;
      try {
        const activeRes = await window.storage.get(ACTIVE_TOURNAMENT_KEY, true);
        activeId = activeRes && activeRes.value ? activeRes.value : null;
      } catch (e) {
        if (!isNotFoundErr(e)) unreachable = true;
      }

      if (unreachable) {
        if (!cancelled) setDiag("error");
      } else if (activeId) {
        let found = false;
        try {
          const res = await window.storage.get(tournamentDataKey(activeId), true);
          if (!cancelled && res && res.value) {
            setTournament(JSON.parse(res.value));
            setDiag("ok");
            found = true;
          }
        } catch (e) {
          if (!cancelled && !isNotFoundErr(e)) setDiag("error");
        }
        if (!found && !cancelled) {
          try {
            const idxRes = await window.storage.get(TOURNAMENTS_INDEX_KEY, true);
            const index = idxRes && idxRes.value ? JSON.parse(idxRes.value) : [];
            const mostRecent = [...index].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
            if (mostRecent) {
              const res2 = await window.storage.get(tournamentDataKey(mostRecent.id), true);
              if (!cancelled && res2 && res2.value) {
                setTournament(JSON.parse(res2.value));
                setDiag("ok");
                fireAndForget(window.storage.set(ACTIVE_TOURNAMENT_KEY, mostRecent.id, true));
                found = true;
              }
            }
          } catch (e) { }
          if (!found && !cancelled) setDiag("no-tournament");
        }
      } else {
        let recovered = false;
        try {
          const legacy = await window.storage.get(STORAGE_KEY, true);
          if (!cancelled && legacy && legacy.value) {
            setTournament(JSON.parse(legacy.value));
            setDiag("ok");
            recovered = true;
          }
        } catch (e) { }

        if (!recovered) {
          try {
            const idxRes = await window.storage.get(TOURNAMENTS_INDEX_KEY, true);
            const index = idxRes && idxRes.value ? JSON.parse(idxRes.value) : [];
            const mostRecent = [...index].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
            if (mostRecent) {
              const res = await window.storage.get(tournamentDataKey(mostRecent.id), true);
              if (!cancelled && res && res.value) {
                setTournament(JSON.parse(res.value));
                setDiag("ok");
                fireAndForget(window.storage.set(ACTIVE_TOURNAMENT_KEY, mostRecent.id, true));
                recovered = true;
              }
            }
          } catch (e) {
            if (!cancelled && !isNotFoundErr(e)) setDiag("error");
          }
        }

        if (!recovered && !cancelled) setDiag("no-tournament");
      }

      try {
        const res2 = await window.storage.get(BROADCAST_KEY, true);
        if (!cancelled && res2 && res2.value) setBroadcastState(JSON.parse(res2.value));
      } catch (e) { }
    };
    poll();
    const iv = setInterval(poll, 1200);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  const liveMatch = useMemo(() => {
    if (!tournament) return null;
    return tournament.matches.find((m) => m.status === "live")
      || [...tournament.matches].reverse().find((m) => m.status === "completed")
      || null;
  }, [tournament]);

  const sceneMatch = useMemo(() => {
    if (!tournament) return null;
    return tournament.matches.find((m) => m.id === broadcast.matchId) || liveMatch;
  }, [tournament, broadcast.matchId, liveMatch]);

  const innings = liveMatch ? liveMatch.innings[liveMatch.currentInnings] : null;
  const stats = innings ? computeInningsStats(innings, tournament.teams) : null;

  const layers = normalizeBroadcastLayers(broadcast);
  const bugOn = !!layers.bug;
  const activeExtraLayers = OVERLAY_LAYERS.filter((l) => l.id !== "bug" && layers[l.id]);

  useEffect(() => {
    if (!innings || !liveMatch || !bugOn) return;
    const matchKey = liveMatch.id + ":" + liveMatch.currentInnings;
    if (lastMatchIdRef.current !== matchKey) {
      lastMatchIdRef.current = matchKey;
      lastBallCountRef.current = innings.balls.length;
      return;
    }
    if (innings.balls.length > (lastBallCountRef.current || 0)) {
      const lastBall = innings.balls[innings.balls.length - 1];
      let type = null;
      if (lastBall.isWicket) type = "OUT";
      else if (!lastBall.extra && lastBall.runsBat === 6) type = "SIX";
      else if (!lastBall.extra && lastBall.runsBat === 4) type = "FOUR";
      else if (lastBall.extra === "nb" && lastBall.runsBat === 6) type = "SIX";
      else if (lastBall.extra === "nb" && lastBall.runsBat === 4) type = "FOUR";
      else if (lastBall.extra === "nb") type = "NO BALL";
      if (type) {
        setFlash({ type, key: Date.now() });
        if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
        flashTimerRef.current = setTimeout(() => setFlash(null), 2200);
      }
    }
    lastBallCountRef.current = innings.balls.length;
  }, [innings, liveMatch, bugOn]);

  if (!tournament) {
    let msg = "Connecting…";
    if (diag === "error") msg = "Can't reach the storage server (localhost:4000) — make sure node server.js is running.";
    else if (diag === "no-tournament") msg = "No tournament open yet — open one in the main app tab.";
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
  // Professional broadcast strips are always the same physical size on
  // screen — the box never grows. Instead of scaling the whole row up/down
  // in visible jumps (the old CSS-zoom approach), the strip is fixed to one
  // standard pixel width and every ball chip is sized continuously, so any
  // number of deliveries (including a wild wide-filled over) always tiles
  // inside that same standard box, edge to edge, with no jumpy resizing steps.
  const OVER_STRIP_WIDTH = 236; // standard width — never changes, however many balls
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
            className={"ct-overlay-scenes-row" + (activeExtraLayers.length > 1 ? " ct-overlay-scenes-multi" : "")}
            style={{ zoom: scenesZoom }}
          >
            {activeExtraLayers.map((l) => (
              <div className="ct-overlay-scene-slot" key={l.id}>
                {sceneMatch ? (
                  <SceneRenderer tournament={tournament} match={sceneMatch} scene={l.id} lineupTeamId={broadcast.lineupTeamId} showCaptainPhotos={broadcast.showCaptainPhotos} />
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
            <div key={flash.key} className={"ct-flash ct-flash-" + flash.type.replace(" ", "")}>
              <div className="ct-flash-boundary">
                <div className="ct-flash-ring" />
                <div className="ct-flash-ring ct-flash-ring-2" />
                <div className={"ct-flash-num" + (flashCenterText(flash.type).length > 1 ? " ct-flash-num-sm" : "")}>
                  {flashCenterText(flash.type)}
                </div>
                <div className="ct-flash-word">{flashWordText(flash.type)}</div>
              </div>
            </div>
          )}
          {bugReady ? (
            <div className="ct-overlay-bug-slot">
            {liveMatch.status === "completed" && (
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
                  const isFour = (!b.extra && b.runsBat === 4) || (b.extra === "nb" && b.runsBat === 4);
                  const isSix = (!b.extra && b.runsBat === 6) || (b.extra === "nb" && b.runsBat === 6);
                  return (
                    <span
                      key={i}
                      className={
                        "ct-ov-ball" +
                        (b.isWicket ? " ct-ov-ball-w" : "") +
                        (b.extra === "nb" ? " ct-ov-ball-nb" : "") +
                        (b.extra === "wd" ? " ct-ov-ball-wd" : "") +
                        (isFour ? " ct-ov-ball-4" : "") +
                        (isSix ? " ct-ov-ball-6" : "") +
                        (b.extra === "penalty" ? " ct-ov-ball-penalty" : "")
                      }
                      style={{ minWidth: overBallSize, height: overBallSize, fontSize: overBallFont, borderRadius: overBallSize / 2 }}
                    >
                      {ballLabel(b)}
                    </span>
                  );
                })}
              </div>
            </div>

            {target != null && liveMatch.status === "live" && (
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

function flashCenterText(type) {
  if (type === "SIX") return "6";
  if (type === "FOUR") return "4";
  if (type === "OUT") return "W";
  if (type === "WIDE") return "WD";
  if (type === "NO BALL") return "FH";
  return "";
}
function flashWordText(type) {
  if (type === "NO BALL") return "FREE HIT";
  if (type === "OUT") return "WICKET";
  return type;
}

function SceneRenderer({ tournament, match, scene, lineupTeamId, showCaptainPhotos }) {
  if (!match) return <div className="ct-overlay-waiting">No match selected</div>;
  const teamA = tournament.teams.find((t) => t.id === match.teamAId);
  const teamB = tournament.teams.find((t) => t.id === match.teamBId);

  if (scene === "toss") {
    const winnerTeam = match.tossWinner ? tournament.teams.find((t) => t.id === match.tossWinner) : null;
    const capA = teamA?.players.find((p) => p.id === teamA.captainId);
    const capB = teamB?.players.find((p) => p.id === teamB.captainId);
    return (
      <div className="ct-scene ct-scene-matchup">
        {match.stage && <div className="ct-stage-pill">{match.stage}</div>}
        <div className="ct-matchup-eventbar">{tournament.name}</div>
        <div className="ct-matchup-venuebar">{match.venue || "Venue TBC"}</div>
        <div className="ct-matchup-body">
          <div className="ct-matchup-side">
            {showCaptainPhotos && capA?.photo ? (
              <img className="ct-captain-crest-photo" src={capA.photo} alt="" style={{ borderColor: teamA?.color || "#7C3AED" }} />
            ) : (
              <TeamCrest team={teamA} className="ct-matchup-crest" fallbackColor="#7C3AED" />
            )}
            <div className="ct-matchup-teamname">{teamA?.name}</div>
            {showCaptainPhotos && capA && <div className="ct-captain-sub-label">{capA.name} (C)</div>}
          </div>
          <div className="ct-matchup-vs">VS</div>
          <div className="ct-matchup-side">
            {showCaptainPhotos && capB?.photo ? (
              <img className="ct-captain-crest-photo" src={capB.photo} alt="" style={{ borderColor: teamB?.color || "#DB2777" }} />
            ) : (
              <TeamCrest team={teamB} className="ct-matchup-crest" fallbackColor="#DB2777" />
            )}
            <div className="ct-matchup-teamname">{teamB?.name}</div>
            {showCaptainPhotos && capB && <div className="ct-captain-sub-label">{capB.name} (C)</div>}
          </div>
        </div>
        <div className="ct-matchup-footer">
          {winnerTeam
            ? <>{winnerTeam.name.toUpperCase()} WON THE TOSS &amp; CHOSE TO {match.tossChoice === "bat" ? "BAT" : "BOWL"}</>
            : `${match.oversLimit}-OVER MATCH`}
        </div>
      </div>
    );
  }

  if (scene === "captains") {
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
              <img className="ct-captain-crest-photo" src={capA.photo} alt="" style={{ borderColor: teamA?.color || "#7C3AED" }} />
            ) : capA ? (
              <div className="ct-matchup-crest" style={{ background: teamA?.color || "#7C3AED" }}>{initials(capA.name)}</div>
            ) : (
              <TeamCrest team={teamA} className="ct-matchup-crest" fallbackColor="#7C3AED" />
            )}
            <div className="ct-matchup-teamname">{capA ? capA.name : "No captain set"}</div>
            <div className="ct-captain-sub-label">{teamA?.name}</div>
          </div>
          <div className="ct-matchup-vs">VS</div>
          <div className="ct-matchup-side">
            {capB?.photo ? (
              <img className="ct-captain-crest-photo" src={capB.photo} alt="" style={{ borderColor: teamB?.color || "#DB2777" }} />
            ) : capB ? (
              <div className="ct-matchup-crest" style={{ background: teamB?.color || "#DB2777" }}>{initials(capB.name)}</div>
            ) : (
              <TeamCrest team={teamB} className="ct-matchup-crest" fallbackColor="#DB2777" />
            )}
            <div className="ct-matchup-teamname">{capB ? capB.name : "No captain set"}</div>
            <div className="ct-captain-sub-label">{teamB?.name}</div>
          </div>
        </div>
        <div className="ct-matchup-footer">{match.venue || "Captains"}</div>
      </div>
    );
  }

  if (scene === "scorecard") {
    const inn = match.innings[match.currentInnings] || match.innings[0];
    if (!inn) return <div className="ct-overlay-waiting">No innings data yet</div>;
    const s = computeInningsStats(inn, tournament.teams);
    const team = s.battingTeam;
    const extrasTotal = s.extras.wd + s.extras.nb + s.extras.b + s.extras.lb;
    // Show the most recent batters first, capped so a long innings can never
    // push this card down into the scorebug — same fix as the points table.
    const MAX_SC_ROWS = 8;
    const orderedIds = [...s.battingOrder].reverse();
    const shownIds = orderedIds.slice(0, MAX_SC_ROWS);
    const hiddenCount = orderedIds.length - shownIds.length;
    const scDensity = shownIds.length <= 5 ? "roomy" : shownIds.length <= 7 ? "cozy" : "tight";
    return (
      <div className={"ct-scene ct-scene-scorecard ct-density-" + scDensity}>
        <div className="ct-sc-header" style={team?.color ? { background: `linear-gradient(90deg, ${team.color}CC, rgba(10,14,17,0.4))` } : undefined}>
          <TeamCrest team={team} className="ct-sc-team-badge" fallbackColor="#3C7A4F">{team ? teamShort(tournament.teams, team.id) : "TBD"}</TeamCrest>
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
              <div className={"ct-sc-row" + (!b.out ? " ct-sc-row-notout" : "")} key={id}>
                <span>{playerName(tournament.teams, id)}</span>
                <span className="ct-sc-status">{b.out ? dismissalText(b.howOut, tournament.teams) : "Not Out"}</span>
                <span className="ct-sc-r">{b.runs}</span>
                <span className="ct-sc-b">{b.balls}</span>
              </div>
            );
          })}
          {hiddenCount > 0 && <div className="ct-scene-table-more">+{hiddenCount} earlier batter{hiddenCount === 1 ? "" : "s"}</div>}
        </div>
        <div className="ct-sc-footer">
          <span>Extras {extrasTotal}</span>
          <span>Overs {s.oversStr}</span>
          <span className="ct-sc-total">Total {s.totalRuns}-{s.totalWickets}</span>
        </div>
      </div>
    );
  }

  if (scene === "lineup") {
    const teamId = lineupTeamId || match.teamAId;
    const team = tournament.teams.find((t) => t.id === teamId);
    const xiIds = (match.playingXI && match.playingXI[teamId]) || (team?.players || []).map((p) => p.id);
    return (
      <div className="ct-scene ct-scene-lineup-v2">
        <div className="ct-lineup-v2-header">
          <span className={teamId === match.teamAId ? "ct-lineup-v2-active" : ""}>{teamA?.name}</span>
          <span className="ct-lineup-v2-vs">VS</span>
          <span className={teamId === match.teamBId ? "ct-lineup-v2-active" : ""}>{teamB?.name}</span>
        </div>
        {xiIds.length === 0 ? (
          <div className="ct-overlay-waiting">No playing XI set for this team yet</div>
        ) : (
          <div className="ct-lineup-v2-grid">
            {xiIds.map((pid) => {
              const p = team?.players.find((x) => x.id === pid);
              if (!p) return null;
              return (
                <div className="ct-lineup-v2-card" key={pid}>
                  {p.photo ? (
                    <img className="ct-lineup-v2-avatar-photo" src={p.photo} alt="" />
                  ) : (
                    <div className="ct-lineup-v2-avatar" style={{ background: team?.color || "#7C3AED" }}>{initials(p.name)}</div>
                  )}
                  <div className="ct-lineup-v2-name">{p.name}</div>
                  <div className="ct-lineup-v2-role">{p.role}</div>
                </div>
              );
            })}
          </div>
        )}
        <div className="ct-lineup-v2-footer">{match.venue || "Playing XI"}</div>
      </div>
    );
  }

  // FIXED: Match Summary — properly attributes each innings' own top scorer
  // and best bowler, instead of showing the match-wide top performer in both
  // columns (see comment in aggregateMatchPerformers).
  if (scene === "summary") {
    return (
      <div className="ct-scene ct-scene-table ct-scene-summary">
        <div className="ct-matchup-eventbar">{tournament.name}</div>
        <div className="ct-matchup-venuebar">Match Summary</div>
        <div className="ct-summary-cols">
          {match.innings.map((inn, idx) => {
            if (!inn) return null;
            const s = computeInningsStats(inn, tournament.teams);
            // FIX (bug #1): pick this innings' own top scorer (from s.batsmen,
            // which belongs to s.battingTeam) and this innings' own top
            // bowler (from s.bowlers, which belongs to s.bowlingTeam) —
            // previously both columns pulled from aggregateMatchPerformers(),
            // which combines BOTH innings together, so both teams showed the
            // exact same "best" player.
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

  if (scene === "graph") {
    const inn = match.innings[match.currentInnings] || match.innings[0];
    if (!inn) return <div className="ct-overlay-waiting">No innings data yet</div>;
    const manhattan = computeManhattan(inn);
    const s = computeInningsStats(inn, tournament.teams);

    let running = 0;
    const points = [{ over: 0, total: 0, wickets: 0 }, ...manhattan.map((o) => {
      running += o.runs;
      return { over: o.over, total: running, wickets: o.wickets };
    })];
    const maxTotal = Math.max(10, ...points.map((p) => p.total));
    const maxOver = Math.max(1, ...points.map((p) => p.over));

    const W = 900, H = 360, padL = 20, padR = 20, padT = 20, padB = 40;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const xFor = (over) => padL + (over / maxOver) * plotW;
    const yFor = (total) => padT + plotH - (total / maxTotal) * plotH;

    const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(p.over).toFixed(1)} ${yFor(p.total).toFixed(1)}`).join(" ");
    const lastPoint = points[points.length - 1];
    const areaPath = `${linePath} L ${xFor(lastPoint.over).toFixed(1)} ${(padT + plotH).toFixed(1)} L ${xFor(0).toFixed(1)} ${(padT + plotH).toFixed(1)} Z`;

    return (
      <div className="ct-scene ct-scene-table ct-scene-graph">
        <div className="ct-matchup-eventbar">{tournament.name}</div>
        <div className="ct-matchup-venuebar">{s.battingTeam?.name} — Run Rate by Over</div>
        <div className="ct-graph-body">
          <svg className="ct-graph-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
            <defs>
              <linearGradient id="ctGraphFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(230,0,126,0.5)" />
                <stop offset="100%" stopColor="rgba(230,0,126,0)" />
              </linearGradient>
            </defs>
            {[0.25, 0.5, 0.75, 1].map((f) => (
              <line key={f} x1={padL} x2={W - padR} y1={padT + plotH * (1 - f)} y2={padT + plotH * (1 - f)} className="ct-graph-grid" />
            ))}
            <path d={areaPath} fill="url(#ctGraphFill)" stroke="none" />
            <path d={linePath} className="ct-graph-line" fill="none" />
            {points.map((p, i) => (
              <g key={i}>
                <circle cx={xFor(p.over)} cy={yFor(p.total)} r={p.wickets > 0 ? 8 : 4.5} className={p.wickets > 0 ? "ct-graph-dot-wkt" : "ct-graph-dot"} />
                {p.wickets > 0 && <text x={xFor(p.over)} y={yFor(p.total) - 15} className="ct-graph-wkt-label">{p.wickets > 1 ? `-${p.wickets}` : "W"}</text>}
              </g>
            ))}
            {manhattan.map((o) => (
              <text key={o.over} x={xFor(o.over)} y={H - 12} className="ct-graph-axis-label">{o.over}</text>
            ))}
            <text x={xFor(lastPoint.over)} y={yFor(lastPoint.total) - (lastPoint.wickets > 0 ? 30 : 15)} className="ct-graph-total-label">{lastPoint.total}</text>
          </svg>
        </div>
      </div>
    );
  }

  if (scene === "points") {
    const table = computePointsTable(tournament);
    // Show every team on the table — as the list grows, density scales
    // font size, row padding, and crest size down through more steps
    // (instead of truncating with a "+N more" message) so any number of
    // teams still fits cleanly inside the same card.
    const density =
      table.length <= 5 ? "roomy" :
      table.length <= 8 ? "cozy" :
      table.length <= 12 ? "tight" : "ultra";
    return (
      <div className={"ct-scene ct-scene-table ct-density-" + density}>
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
                    <td className="ct-scene-table-team"><TeamCrest team={t} className="ct-scene-table-crest" fallbackColor="#7C3AED" /><span>{t?.name}</span></td>
                    <td>{r.played}</td>
                    <td>{r.won}</td>
                    <td>{r.lost}</td>
                    <td><b>{r.points}</b></td>
                    <td>{r.nrr >= 0 ? "+" : ""}{r.nrr.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    );
  }

  if (scene === "stats") {
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

  if (scene === "ceremony") {
    if (!match.result) return <div className="ct-overlay-waiting">Match result not available yet</div>;
    const winnerTeamForCeremony = tournament.teams.find((t) => t.id === match.result.winnerId);
    return (
      <div className="ct-scene ct-scene-table ct-scene-ceremony">
        <div className="ct-matchup-eventbar">{tournament.name}</div>
        <div className="ct-matchup-venuebar">Match Ceremony</div>
        <div className="ct-ceremony-body">
          {winnerTeamForCeremony && <TeamCrest team={winnerTeamForCeremony} className="ct-ceremony-crest" fallbackColor="#F2A93B" />}
          <Trophy size={54} />
          <div className="ct-ceremony-winner">{winnerTeamForCeremony?.name || "Match Tied"}</div>
          <div className="ct-ceremony-summary">{match.result.summary}</div>
        </div>
        <div className="ct-matchup-footer">{teamA?.name} vs {teamB?.name}</div>
      </div>
    );
  }

  if (scene === "motm") {
    if (!match.motmId) return <div className="ct-overlay-waiting">No Man of the Match selected yet</div>;
    // FIX (bug #3): look up the chosen player's actual figures directly
    // instead of only checking the top-3 aggregated lists — previously an
    // MOTM pick who wasn't a top-3 run scorer / wicket taker for the match
    // rendered with no stats at all.
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

  if (scene === "upcoming") {
    const upcoming = tournament.matches.filter((m) => m.status === "upcoming").slice(0, 5);
    return (
      <div className="ct-scene ct-scene-table ct-scene-upcoming">
        <div className="ct-matchup-eventbar">{tournament.name}</div>
        <div className="ct-matchup-venuebar">Upcoming Matches</div>
        {upcoming.length === 0 ? (
          <div className="ct-overlay-waiting">No upcoming fixtures</div>
        ) : (
          <div className="ct-upcoming-list">
            {upcoming.map((m) => {
              const uTeamA = tournament.teams.find((t) => t.id === m.teamAId);
              const uTeamB = tournament.teams.find((t) => t.id === m.teamBId);
              return (
                <div className="ct-upcoming-row" key={m.id}>
                  <span className="ct-upcoming-matchup">
                    <TeamCrest team={uTeamA} className="ct-upcoming-crest" fallbackColor="#7C3AED" />
                    {teamShort(tournament.teams, m.teamAId)} vs {teamShort(tournament.teams, m.teamBId)}
                    <TeamCrest team={uTeamB} className="ct-upcoming-crest" fallbackColor="#DB2777" />
                  </span>
                  <span className="ct-tag">{m.oversLimit} ov</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return null;
}

function SceneStyles() {
  return (
    <style>{`
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

      .ct-overlay-root.ct-overlay-scene-mode { align-items: center; }
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
        /* Every broadcast graphic mounts with this same pop-in — a fresh
           React element is created whenever a graphic is switched on or
           swapped for another, so the animation replays naturally each
           time, matching how the SIX/FOUR/OUT flashes animate in. */
        animation: ct-scene-pop .5s cubic-bezier(.2,.9,.25,1) both;
      }
      @keyframes ct-scene-pop {
        0% { opacity: 0; transform: scale(0.92) translateY(14px); }
        60% { opacity: 1; }
        100% { opacity: 1; transform: scale(1) translateY(0); }
      }
      /* Safety net: if a graphic's content is ever taller than the space left
         above the scorebug, fade the bottom instead of hard-cutting a row in
         half. Row counts are capped in JS so this should rarely trigger. */
      .ct-scene::after {
        content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 34px;
        background: linear-gradient(rgba(10,14,17,0), rgba(10,14,17,0.85));
        pointer-events: none; border-radius: 0 0 26px 26px;
      }
      .ct-scene-title { font-family: 'Oswald', sans-serif; text-transform: uppercase; letter-spacing: 1.5px; color: #F2A93B; font-size: 34px; margin-bottom: 30px; }

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

      .ct-graph-body { padding: 14px 24px 4px; }
      .ct-graph-svg { width: 100%; height: 400px; overflow: visible; }
      .ct-graph-grid { stroke: rgba(255,255,255,0.08); stroke-width: 1; }
      .ct-graph-line { stroke: #FF3D9A; stroke-width: 4.5; stroke-linejoin: round; stroke-linecap: round; }
      .ct-graph-dot { fill: #10161A; stroke: #FF3D9A; stroke-width: 3; }
      .ct-graph-dot-wkt { fill: #D9564F; stroke: #10161A; stroke-width: 2.5; }
      .ct-graph-wkt-label { fill: #FF3D9A; font-family: 'JetBrains Mono', monospace; font-size: 20px; font-weight: 700; text-anchor: middle; }
      .ct-graph-axis-label { fill: #D9A8E0; font-family: 'JetBrains Mono', monospace; font-size: 17px; text-anchor: middle; }
      .ct-graph-total-label { fill: #F2A93B; font-family: 'JetBrains Mono', monospace; font-size: 24px; font-weight: 700; text-anchor: middle; }

      .ct-scene-ceremony { color: #F2A93B; }
      .ct-ceremony-body { padding: 26px 20px 8px; }
      .ct-ceremony-body svg { width: 64px; height: 64px; }
      .ct-ceremony-crest {
        width: 64px; height: 64px; border-radius: 50%; margin: 0 auto 10px;
        display: flex; align-items: center; justify-content: center;
        font-family: 'JetBrains Mono', monospace; font-weight: 700; font-size: 20px; color: #fff;
        box-shadow: 0 8px 22px rgba(0,0,0,0.4); border: 3px solid rgba(255,255,255,0.25);
      }
      .ct-ceremony-winner { font-family: 'Oswald', sans-serif; text-transform: uppercase; font-size: 46px; margin: 16px 0 8px; letter-spacing: 1px; line-height: 1.1; color: #FF3D9A; }
      .ct-ceremony-summary { color: #EDEDE3; font-size: 21px; font-weight: 600; }

      .ct-scene-motm { color: #F2A93B; }
      .ct-motm-body { padding: 26px 20px 8px; }
      .ct-motm-body svg { width: 56px; height: 56px; }
      .ct-motm-name { font-family: 'Oswald', sans-serif; text-transform: uppercase; font-size: 42px; margin: 14px 0 8px; color: #FF3D9A; letter-spacing: .5px; }
      .ct-motm-stats { display: flex; gap: 26px; justify-content: center; font-family: 'JetBrains Mono', monospace; font-size: 21px; color: #F2A93B; font-weight: 700; }

      .ct-upcoming-list { display: flex; flex-direction: column; gap: 12px; text-align: left; padding: 18px 24px 4px; }
      .ct-upcoming-row { display: flex; align-items: center; justify-content: space-between; font-size: 21px; padding: 10px 6px; border-bottom: 1px solid rgba(255,255,255,0.1); color: #EDEDE3; font-weight: 600; }
      .ct-upcoming-matchup { display: flex; align-items: center; gap: 8px; }
      .ct-upcoming-crest {
        width: 24px; height: 24px; border-radius: 50%; flex-shrink: 0;
        display: flex; align-items: center; justify-content: center;
        font-family: 'JetBrains Mono', monospace; font-weight: 700; font-size: 9.5px; color: #fff;
      }
      .ct-scene-upcoming .ct-tag { background: rgba(230,0,126,0.16); color: #FF3D9A; font-size: 14px; padding: 5px 10px; }

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

      .ct-scene-lineup-v2 {
        padding: 0; overflow: hidden; text-align: center; width: min(64vw, 940px);
        background: linear-gradient(160deg, rgba(61,17,82,0.94), rgba(10,14,17,0.94));
        border-color: rgba(230,0,126,0.5);
      }
      .ct-lineup-v2-header {
        display: flex; align-items: center; justify-content: center; gap: 18px; background: #fff; color: #1A1024;
        padding: 16px 22px; font-family: 'Oswald', sans-serif; text-transform: uppercase; font-size: 21px; letter-spacing: .5px;
      }
      .ct-lineup-v2-header span { opacity: .4; }
      .ct-lineup-v2-active { opacity: 1 !important; font-weight: 700; }
      .ct-lineup-v2-vs { color: #E6007E; font-weight: 700; opacity: 1 !important; }
      .ct-lineup-v2-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px 14px; padding: 22px 26px 6px; }
      .ct-lineup-v2-card { display: flex; flex-direction: column; align-items: center; gap: 8px; }
      .ct-lineup-v2-avatar {
        width: 62px; height: 62px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
        color: #fff; font-family: 'JetBrains Mono', monospace; font-weight: 700; font-size: 19px; border: 3px solid rgba(255,255,255,0.3);
      }
      .ct-lineup-v2-avatar-photo {
        width: 62px; height: 62px; border-radius: 50%; object-fit: cover; border: 3px solid rgba(255,255,255,0.3);
      }
      .ct-lineup-v2-name { font-size: 16px; font-weight: 700; text-align: center; line-height: 1.25; }
      .ct-lineup-v2-role { font-size: 13px; color: #D9A8E0; text-transform: uppercase; letter-spacing: .5px; }
      .ct-lineup-v2-footer {
        margin-top: 20px; background: linear-gradient(90deg, #8E1463, #E6007E); color: #fff; font-family: 'Oswald', sans-serif;
        text-transform: uppercase; letter-spacing: 1px; font-size: 17px; padding: 12px 22px; font-weight: 600;
      }

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
      .ct-scene-table-more {
        margin-top: 10px; font-size: 13px; color: #D9A8E0; text-transform: uppercase;
        letter-spacing: .6px; font-weight: 600;
      }
      /* Density variants: as the points/stats table grows past a comfortable row
         count, shrink font, padding, and crest size in steps so the whole
         list always fits inside the same card with a clean bottom edge —
         no row is ever truncated or hidden behind a "+N more" message. */
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
      .ct-stats-row small { font-family: 'Inter', sans-serif; font-size: 13px; color: #D9A8E0; font-weight: 500; margin-left: 6px; }
    `}</style>
  );
}

function OverlayStyles() {
  return (
    <>
      <SceneStyles />
      <style>{`
      html, body, #root { background: transparent !important; }
      .ct-overlay-root {
        position: relative; width: 100vw; height: 100vh; overflow: hidden;
        font-family: 'Inter', sans-serif; background: transparent;
        display: flex; align-items: flex-end; justify-content: center;
        box-sizing: border-box;
        /* Broadcast-safe margin: OBS/vMix crop, scaling, or a Browser Source
           that isn't sized exactly to the canvas will nibble the outer edge
           first — this keeps every graphic clear of that edge on all sides. */
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

      /* This-over strip: fixed to one standard width (set inline from JS as
         OVER_STRIP_WIDTH) so the scorebug never grows or shrinks as the over
         fills up. Every ball chip's size is computed continuously in JS so
         any number of legal balls, wides or no-balls always tiles exactly
         inside that same fixed box — no CSS "zoom" steps, no jumpy resizing. */
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

      /* Boundary / wicket / extras flash: every event — SIX, FOUR, OUT,
         WIDE, and NO BALL (shown as "FREE HIT") — gets the same
         broadcast-style circular badge: a big center symbol, a radiating
         double ring burst, and a small word label underneath. Only the
         color and center symbol change per event type. */
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
      /* Two-letter center symbols (WD, FH) need a smaller size than the
         single-digit/letter badges so they never crowd the circle. */
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

      @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@600;700&family=Inter:wght@500;600&family=JetBrains+Mono:wght@600;700&display=swap');
    `}</style>
    </>
  );
}

function structuredCloneSafe(obj) {
  try { return structuredClone(obj); } catch (e) { return JSON.parse(JSON.stringify(obj)); }
}

/* ============================================================
   SETUP SCREEN (create tournament)
   ============================================================ */

function SetupScreen({ onCreate }) {
  const [name, setName] = useState("");
  const [overs, setOvers] = useState(20);
  const [doubleWicket, setDoubleWicket] = useState(false);

  const create = () => {
    if (!name.trim()) return;
    onCreate({
      id: uid("tour"), name: name.trim(), defaultOvers: Number(overs) || 20,
      isDoubleWicket: doubleWicket,
      teams: [], matches: [], pools: [], createdAt: Date.now(),
    });
  };

  return (
    <div className="ct-root ct-setup-screen">
      <Styles />
      <div className="ct-setup-card">
        <div className="ct-setup-mark">🏏</div>
        <h1>New Tournament</h1>
        <p className="ct-setup-sub">Set it up once — teams, fixtures, live scoring and stats all live here.</p>
        <label className="ct-field-label">Tournament name</label>
        <input className="ct-input" placeholder="e.g. Shahkot Premier League 2026" value={name} onChange={(e) => setName(e.target.value)} />
        <label className="ct-field-label">Default overs per innings</label>
        <input className="ct-input" type="number" min={1} max={50} value={overs} onChange={(e) => setOvers(e.target.value)} />
        <label className="ct-check-row">
          <input type="checkbox" checked={doubleWicket} onChange={(e) => setDoubleWicket(e.target.checked)} />
          Double Wicket tournament (out hone par −2 penalty)
        </label>
        <button className="ct-btn ct-btn-primary ct-btn-block" onClick={create} disabled={!name.trim()}>
          Create tournament <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   DASHBOARD
   ============================================================ */

function Dashboard({ tournament, setTab, setActiveMatchId }) {
  const live = tournament.matches.find((m) => m.status === "live");
  const upcoming = tournament.matches.filter((m) => m.status === "upcoming").slice(0, 5);
  const completed = tournament.matches.filter((m) => m.status === "completed").slice(-5).reverse();
  const table = computePointsTable(tournament).slice(0, 3);

  const { topRuns, topWickets } = useMemo(() => aggregatePlayerStats(tournament), [tournament]);

  return (
    <div className="ct-stack">
      {live && (
        <div className="ct-card ct-live-banner" onClick={() => { setActiveMatchId(live.id); setTab("scoring"); }}>
          <div className="ct-live-dot" /> LIVE NOW — {teamShort(tournament.teams, live.teamAId)} vs {teamShort(tournament.teams, live.teamBId)}
          <ChevronRight size={18} />
        </div>
      )}

      <div className="ct-grid-3">
        <div className="ct-stat-card"><div className="ct-stat-num">{tournament.teams.length}</div><div className="ct-stat-label">Teams</div></div>
        <div className="ct-stat-card"><div className="ct-stat-num">{tournament.matches.length}</div><div className="ct-stat-label">Matches</div></div>
        <div className="ct-stat-card"><div className="ct-stat-num">{tournament.matches.filter(m=>m.status==="completed").length}</div><div className="ct-stat-label">Completed</div></div>
      </div>

      <div className="ct-grid-2">
        <div className="ct-card">
          <div className="ct-card-title">Points Table (Top 3)</div>
          {table.length === 0 ? <EmptyState icon={<Award size={28} />} title="No results yet" /> : (
            <table className="ct-table">
              <thead><tr><th>Team</th><th>P</th><th>Pts</th><th>NRR</th></tr></thead>
              <tbody>
                {table.map((r) => (
                  <tr key={r.teamId}><td>{teamShort(tournament.teams, r.teamId)}</td><td>{r.played}</td><td>{r.points}</td><td>{r.nrr.toFixed(2)}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="ct-card">
          <div className="ct-card-title">Recent Results</div>
          {completed.length === 0 ? <EmptyState icon={<ClipboardList size={28} />} title="No matches completed" /> : (
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
          <div className="ct-card-title">Top Run Scorers</div>
          {topRuns.length === 0 ? <EmptyState icon={<BarChart3 size={28} />} title="No runs scored yet" /> : (
            <div className="ct-stack-sm">
              {topRuns.slice(0, 5).map((p) => (
                <div className="ct-result-row" key={p.id}><span>{p.name}</span><span className="ct-result-note">{p.runs} runs</span></div>
              ))}
            </div>
          )}
        </div>
        <div className="ct-card">
          <div className="ct-card-title">Top Wicket Takers</div>
          {topWickets.length === 0 ? <EmptyState icon={<Target size={28} />} title="No wickets yet" /> : (
            <div className="ct-stack-sm">
              {topWickets.slice(0, 5).map((p) => (
                <div className="ct-result-row" key={p.id}><span>{p.name}</span><span className="ct-result-note">{p.wickets} wkts</span></div>
              ))}
            </div>
          )}
        </div>
      </div>

      {upcoming.length > 0 && (
        <div className="ct-card">
          <div className="ct-card-title">Upcoming Matches</div>
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

/* ============================================================
   TEAMS TAB
   ============================================================ */

function TeamsTab({ tournament, patch }) {
  const [newTeamOpen, setNewTeamOpen] = useState(false);
  const [editTeamId, setEditTeamId] = useState(null);
  const [poolsOpen, setPoolsOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const pools = tournament.pools || [];

  const addTeam = (name, short, color, logo) => {
    patch((t) => {
      t.teams.push({ id: uid("team"), name, short: short || name.slice(0, 3).toUpperCase(), color: color || nextTeamColor(t.teams), logo: logo || null, players: [], captainId: null, poolId: null });
      return t;
    });
    setNewTeamOpen(false);
  };
  const removeTeam = (id) => {
    patch((t) => { t.teams = t.teams.filter((x) => x.id !== id); return t; });
  };
  const setTeamPool = (teamId, poolId) => {
    patch((t) => {
      const tm = t.teams.find((x) => x.id === teamId);
      if (tm) tm.poolId = poolId || null;
      return t;
    });
  };
  const setTeamLogo = (teamId, dataUrl) => {
    patch((t) => {
      const tm = t.teams.find((x) => x.id === teamId);
      if (tm) tm.logo = dataUrl;
      return t;
    });
  };
  const handleTeamLogoFile = (teamId, file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setTeamLogo(teamId, reader.result);
    reader.readAsDataURL(file);
  };

  return (
    <div className="ct-stack">
      <div className="ct-row-between">
        <div className="ct-section-label">Teams</div>
        <div className="ct-row-gap">
          <button className="ct-btn ct-btn-ghost" onClick={() => setBulkOpen(true)}><ClipboardList size={16} /> Bulk Import</button>
          <button className="ct-btn ct-btn-ghost" onClick={() => setPoolsOpen(true)}><Users size={16} /> Manage Pools</button>
          <button className="ct-btn ct-btn-primary" onClick={() => setNewTeamOpen(true)}><Plus size={16} /> Add Team</button>
        </div>
      </div>

      {tournament.teams.length === 0 ? (
        <EmptyState icon={<Users size={32} />} title="No teams yet" sub="Add teams to start building your tournament." />
      ) : (
        <div className="ct-grid-cards">
          {tournament.teams.map((team) => (
            <div className="ct-card ct-team-card" key={team.id}>
              <div className="ct-row-between">
                <div className="ct-team-badge-row">
                  <TeamCrest team={team} className="ct-team-badge" />
                  <label className="ct-photo-upload-btn" title="Add / change team logo">
                    <Camera size={12} />
                    <input
                      type="file" accept="image/*" style={{ display: "none" }}
                      onChange={(e) => handleTeamLogoFile(team.id, e.target.files[0])}
                    />
                  </label>
                </div>
                <button className="ct-icon-btn" onClick={() => removeTeam(team.id)}><Trash2 size={16} /></button>
              </div>
              <div className="ct-team-name">{team.name}</div>
              <div className="ct-team-players-count">{team.players.length} players</div>
              {pools.length > 0 && (
                <>
                  <label className="ct-field-label" style={{ marginTop: 6 }}>Pool / Group</label>
                  <select className="ct-input ct-input-sm" value={team.poolId || ""} onChange={(e) => setTeamPool(team.id, e.target.value)}>
                    <option value="">Unassigned</option>
                    {pools.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </>
              )}
              <button className="ct-btn ct-btn-ghost ct-btn-block" onClick={() => setEditTeamId(team.id)}>Manage Squad</button>
            </div>
          ))}
        </div>
      )}

      {newTeamOpen && <AddTeamModal onClose={() => setNewTeamOpen(false)} onAdd={addTeam} />}
      {editTeamId && (
        <SquadModal
          team={tournament.teams.find((t) => t.id === editTeamId)}
          onClose={() => setEditTeamId(null)}
          patch={patch}
        />
      )}
      {poolsOpen && (
        <PoolsModal tournament={tournament} patch={patch} onClose={() => setPoolsOpen(false)} />
      )}
      {bulkOpen && (
        <BulkImportTeamsModal tournament={tournament} patch={patch} onClose={() => setBulkOpen(false)} />
      )}
    </div>
  );
}

function PoolsModal({ tournament, patch, onClose }) {
  const [newPoolName, setNewPoolName] = useState("");
  const pools = tournament.pools || [];

  const addPool = () => {
    if (!newPoolName.trim()) return;
    patch((t) => {
      if (!t.pools) t.pools = [];
      t.pools.push({ id: uid("pool"), name: newPoolName.trim() });
      return t;
    });
    setNewPoolName("");
  };
  const renamePool = (id, name) => {
    patch((t) => {
      const p = (t.pools || []).find((x) => x.id === id);
      if (p) p.name = name;
      return t;
    });
  };
  const removePool = (id) => {
    patch((t) => {
      t.pools = (t.pools || []).filter((x) => x.id !== id);
      t.teams.forEach((tm) => { if (tm.poolId === id) tm.poolId = null; });
      return t;
    });
  };

  return (
    <Modal title="Manage Pools / Groups" onClose={onClose}>
      <div className="ct-muted-note">Create pools (e.g. "Pool A", "Pool B") then assign each team to one from its card on the Teams page.</div>
      <div className="ct-row-gap ct-mt">
        <input
          className="ct-input" placeholder="e.g. Pool A" value={newPoolName}
          onChange={(e) => setNewPoolName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addPool()}
        />
        <button className="ct-btn ct-btn-primary" onClick={addPool}><Plus size={16} /></button>
      </div>
      <div className="ct-player-list">
        {pools.length === 0 && <div className="ct-muted-note">No pools yet — add one above.</div>}
        {pools.map((p) => (
          <div className="ct-player-row" key={p.id}>
            <input
              className="ct-input ct-input-sm" style={{ flex: 1 }} value={p.name}
              onChange={(e) => renamePool(p.id, e.target.value)}
            />
            <span className="ct-tag">{tournament.teams.filter((t) => t.poolId === p.id).length} teams</span>
            <button className="ct-icon-btn" onClick={() => removePool(p.id)}><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
    </Modal>
  );
}

function BulkImportTeamsModal({ tournament, patch, onClose }) {
  const [text, setText] = useState("");
  const [result, setResult] = useState(null);

  const VALID_ROLES = ["Batter", "Bowler", "All-rounder", "Wicketkeeper"];
  const normalizeRole = (r) => {
    if (!r) return "Batter";
    const hit = VALID_ROLES.find((v) => v.toLowerCase() === r.trim().toLowerCase());
    return hit || "Batter";
  };

  const doImport = () => {
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    let added = 0;
    let poolsCreated = 0;
    let playersAdded = 0;
    patch((t) => {
      if (!t.pools) t.pools = [];
      lines.forEach((line) => {
        const parts = line.split("|").map((s) => s.trim());
        const name = parts[0];
        if (!name) return;
        const poolName = parts[1] || "";
        const playersRaw = parts[2] || "";

        let poolId = null;
        if (poolName) {
          let pool = t.pools.find((p) => p.name.toLowerCase() === poolName.toLowerCase());
          if (!pool) {
            pool = { id: uid("pool"), name: poolName };
            t.pools.push(pool);
            poolsCreated += 1;
          }
          poolId = pool.id;
        }

        const players = playersRaw
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean)
          .map((p) => {
            const [pname, prole] = p.split(":");
            playersAdded += 1;
            return { id: uid("player"), name: pname.trim(), role: normalizeRole(prole), photo: null };
          });

        t.teams.push({
          id: uid("team"), name,
          short: name.slice(0, 3).toUpperCase(),
          color: nextTeamColor(t.teams), logo: null, players, captainId: null, poolId,
        });
        added += 1;
      });
      return t;
    });
    setResult({ added, poolsCreated, playersAdded });
    setText("");
  };

  return (
    <Modal title="Bulk Import Teams" onClose={onClose} wide>
      <div className="ct-muted-note">
        One team per line: <code>Team Name | Pool Name | Player1, Player2, Player3</code>. Pool and
        players are both optional — leave the pool blank (but keep the "|") to add players without a
        pool: <code>Team Name | | Player1, Player2</code>. Give a player a role with a colon, e.g.{' '}
        <code>Ali:Bowler</code> (Batter, Bowler, All-rounder, or Wicketkeeper — defaults to Batter).
        Existing pool names are reused automatically, and everything lands directly on the Teams page
        with squads already filled in.
      </div>
      <textarea
        className="ct-input ct-textarea" rows={10} value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={"Lahore Lions | Pool A | Ahmed Raza:Bowler, Bilal Khan, Saad Ali:Wicketkeeper\nKarachi Kings | Pool A | Izhar Ahmed, Usman Tariq:Bowler\nMultan Sultans | Pool B\nPeshawar Zalmi"}
      />
      {result && (
        <div className="ct-toss-info-line">
          <Check size={14} /> Added {result.added} team{result.added === 1 ? "" : "s"}
          {result.playersAdded > 0 ? `, ${result.playersAdded} player${result.playersAdded === 1 ? "" : "s"}` : ""}
          {result.poolsCreated > 0 ? `, created ${result.poolsCreated} new pool${result.poolsCreated === 1 ? "" : "s"}` : ""}.
        </div>
      )}
      <button className="ct-btn ct-btn-primary ct-btn-block" onClick={doImport} disabled={!text.trim()}>
        Import Teams
      </button>
    </Modal>
  );
}

function AddTeamModal({ onClose, onAdd }) {
  const [name, setName] = useState("");
  const [short, setShort] = useState("");
  const [color, setColor] = useState(TEAM_COLORS[0]);
  const [logo, setLogo] = useState(null);

  const handleLogoFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setLogo(reader.result);
    reader.readAsDataURL(file);
  };

  return (
    <Modal title="Add Team" onClose={onClose}>
      <label className="ct-field-label">Team name</label>
      <input className="ct-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Lahore Lions" autoFocus />
      <label className="ct-field-label">Short code (3 letters)</label>
      <input className="ct-input" value={short} onChange={(e) => setShort(e.target.value.toUpperCase().slice(0, 4))} placeholder="e.g. LAH" />
      <label className="ct-field-label">Team logo (optional)</label>
      <div className="ct-row-gap">
        {logo ? (
          <img className="ct-team-logo-preview" src={logo} alt="" />
        ) : (
          <div className="ct-team-logo-preview ct-team-logo-preview-empty" style={{ background: color }}>{short || "?"}</div>
        )}
        <label className="ct-btn ct-btn-ghost ct-btn-sm" style={{ cursor: "pointer" }}>
          <Camera size={14} /> Upload logo
          <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handleLogoFile(e.target.files[0])} />
        </label>
        {logo && <button className="ct-btn ct-btn-ghost ct-btn-sm" onClick={() => setLogo(null)}>Remove</button>}
      </div>
      <div className="ct-muted-note">If no logo is uploaded, the kit color and short code below are used instead — on overlays, scorecards, points table and more.</div>
      <label className="ct-field-label">Kit color</label>
      <div className="ct-color-row">
        {TEAM_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className={"ct-color-swatch" + (color === c ? " ct-color-swatch-active" : "")}
            style={{ background: c }}
            onClick={() => setColor(c)}
            aria-label={c}
          />
        ))}
        <input type="color" className="ct-color-custom" value={color} onChange={(e) => setColor(e.target.value)} title="Custom color" />
      </div>
      <button className="ct-btn ct-btn-primary ct-btn-block" disabled={!name.trim()} onClick={() => onAdd(name.trim(), short.trim(), color, logo)}>
        Add Team
      </button>
    </Modal>
  );
}

function SquadModal({ team, onClose, patch }) {
  const [playerName_, setPlayerName] = useState("");
  const [role, setRole] = useState("Batter");

  if (!team) return null;

  const addPlayer = () => {
    if (!playerName_.trim()) return;
    patch((t) => {
      const tm = t.teams.find((x) => x.id === team.id);
      tm.players.push({ id: uid("player"), name: playerName_.trim(), role, photo: null });
      return t;
    });
    setPlayerName("");
  };
  const removePlayer = (pid) => {
    patch((t) => {
      const tm = t.teams.find((x) => x.id === team.id);
      tm.players = tm.players.filter((p) => p.id !== pid);
      if (tm.captainId === pid) tm.captainId = null;
      return t;
    });
  };
  const setCaptain = (pid) => {
    patch((t) => {
      const tm = t.teams.find((x) => x.id === team.id);
      tm.captainId = tm.captainId === pid ? null : pid;
      return t;
    });
  };
  const setPhoto = (pid, dataUrl) => {
    patch((t) => {
      const tm = t.teams.find((x) => x.id === team.id);
      const p = tm.players.find((x) => x.id === pid);
      if (p) p.photo = dataUrl;
      return t;
    });
  };
  const handlePhotoFile = (pid, file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhoto(pid, reader.result);
    reader.readAsDataURL(file);
  };

  return (
    <Modal title={`Squad — ${team.name}`} onClose={onClose}>
      <div className="ct-muted-note">
        Tap the star to make a player captain, and the camera icon to add their photo — captains (with photo) can be shown on the overlay via the "Captains Face-off" broadcast graphic, or on the Toss graphic when "Show captain photos" is ticked.
      </div>
      <div className="ct-row-gap ct-mt">
        <input className="ct-input" placeholder="Player name" value={playerName_} onChange={(e) => setPlayerName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addPlayer()} />
        <select className="ct-input ct-input-sm" value={role} onChange={(e) => setRole(e.target.value)}>
          <option>Batter</option><option>Bowler</option><option>All-rounder</option><option>Wicketkeeper</option>
        </select>
        <button className="ct-btn ct-btn-primary" onClick={addPlayer}><Plus size={16} /></button>
      </div>
      <div className="ct-player-list">
        {team.players.length === 0 && <div className="ct-muted-note">No players added yet.</div>}
        {team.players.map((p) => (
          <div className="ct-player-row" key={p.id}>
            <button
              className={"ct-captain-star-btn" + (team.captainId === p.id ? " ct-captain-star-active" : "")}
              onClick={() => setCaptain(p.id)}
              title={team.captainId === p.id ? "Captain — tap to unset" : "Set as captain"}
            >
              <Star size={14} fill={team.captainId === p.id ? "currentColor" : "none"} />
            </button>
            {p.photo ? (
              <img className="ct-player-avatar" src={p.photo} alt="" />
            ) : (
              <div className="ct-player-avatar-fallback">{initials(p.name)}</div>
            )}
            <label className="ct-photo-upload-btn" title="Add / change photo">
              <Camera size={12} />
              <input
                type="file" accept="image/*" style={{ display: "none" }}
                onChange={(e) => handlePhotoFile(p.id, e.target.files[0])}
              />
            </label>
            <span style={{ flex: 1 }}>{p.name}{team.captainId === p.id && <span className="ct-tag ct-tag-active" style={{ marginLeft: 6 }}>Captain</span>}</span>
            <span className="ct-tag">{p.role}</span>
            <button className="ct-icon-btn" onClick={() => removePlayer(p.id)}><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
    </Modal>
  );
}

/* ============================================================
   FIXTURES TAB
   ============================================================ */

function FixturesTab({ tournament, patch, onOpenMatch }) {
  const [genOpen, setGenOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  const removeMatch = (id) => patch((t) => { t.matches = t.matches.filter((m) => m.id !== id); return t; });

  return (
    <div className="ct-stack">
      <div className="ct-row-between">
        <div className="ct-section-label">Fixtures</div>
        <div className="ct-row-gap">
          <button className="ct-btn ct-btn-ghost" onClick={() => setBulkOpen(true)} disabled={tournament.teams.length < 2}>
            <ClipboardList size={16} /> Bulk Import
          </button>
          <button className="ct-btn ct-btn-ghost" onClick={() => setManualOpen(true)}><Plus size={16} /> Add Match</button>
          <button className="ct-btn ct-btn-primary" onClick={() => setGenOpen(true)} disabled={tournament.teams.length < 2}>
            <CalendarDays size={16} /> Generate Round-Robin
          </button>
        </div>
      </div>

      {tournament.matches.length === 0 ? (
        <EmptyState icon={<CalendarDays size={32} />} title="No fixtures yet" sub="Generate a round-robin or add matches manually." />
      ) : (
        <div className="ct-stack-sm">
          {tournament.matches.map((m, idx) => (
            <div className="ct-card ct-match-row" key={m.id}>
              <div className="ct-match-num">#{idx + 1}</div>
              <div className="ct-match-teams">
                <b>{teamShort(tournament.teams, m.teamAId)}</b> vs <b>{teamShort(tournament.teams, m.teamBId)}</b>
                <div className="ct-muted-note">{m.oversLimit} overs · {m.status === "completed" ? m.result?.summary : m.status}</div>
              </div>
              <div className="ct-row-gap">
                {m.status !== "completed" && (
                  <button className="ct-btn ct-btn-primary ct-btn-sm" onClick={() => onOpenMatch(m.id)}>
                    {m.status === "live" ? "Resume" : "Start"} <ChevronRight size={14} />
                  </button>
                )}
                {m.status === "completed" && (
                  <button className="ct-btn ct-btn-ghost ct-btn-sm" onClick={() => onOpenMatch(m.id)}>View</button>
                )}
                <button className="ct-icon-btn" onClick={() => removeMatch(m.id)}><Trash2 size={16} /></button>
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
              const generated = generateRoundRobin(t.teams.map((x) => x.id), overs, double);
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
                id: uid("match"), teamAId, teamBId, oversLimit: overs, status: "upcoming", venue: venue || "",
                tossWinner: null, tossChoice: null, innings: [null, null], currentInnings: 0, result: null,
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

function BulkImportFixturesModal({ tournament, patch, onClose }) {
  const [text, setText] = useState("");
  const [result, setResult] = useState(null);

  const findTeamId = (teams, name) => {
    const n = name.trim().toLowerCase();
    if (!n) return null;
    const exact = teams.find((t) => t.name.toLowerCase() === n || (t.short || "").toLowerCase() === n);
    if (exact) return exact.id;
    const partial = teams.find((t) => t.name.toLowerCase().includes(n) || n.includes(t.name.toLowerCase()));
    return partial ? partial.id : null;
  };

  const doImport = () => {
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    let added = 0;
    const failed = [];
    patch((t) => {
      lines.forEach((line) => {
        const segments = line.split("|").map((s) => s.trim());
        const matchupPart = segments[0];
        const oversRaw = segments[1] ? Number(segments[1]) : NaN;
        const venue = segments[2] || "";
        const vsMatch = matchupPart.match(/(.+?)\s+vs\.?\s+(.+)/i);
        if (!vsMatch) { failed.push(line); return; }
        const teamAId = findTeamId(t.teams, vsMatch[1]);
        const teamBId = findTeamId(t.teams, vsMatch[2]);
        if (!teamAId || !teamBId || teamAId === teamBId) { failed.push(line); return; }
        t.matches.push({
          id: uid("match"), teamAId, teamBId,
          oversLimit: Number.isFinite(oversRaw) && oversRaw > 0 ? oversRaw : (t.defaultOvers || 20),
          status: "upcoming", venue,
          tossWinner: null, tossChoice: null, innings: [null, null], currentInnings: 0, result: null,
        });
        added += 1;
      });
      return t;
    });
    setResult({ added, failed });
    setText("");
  };

  return (
    <Modal title="Bulk Import Fixtures" onClose={onClose} wide>
      <div className="ct-muted-note">
        One match per line: <code>Team A vs Team B</code>. Optionally add overs and venue:{' '}
        <code>Team A vs Team B | 20 | Gaddafi Stadium</code>. Team names must match (or closely
        match) teams already added on the Teams page.
      </div>
      <textarea
        className="ct-input ct-textarea" rows={10} value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={"Lahore Lions vs Karachi Kings\nMultan Sultans vs Peshawar Zalmi | 20 | Gaddafi Stadium"}
      />
      {result && (
        <div className="ct-stack-sm ct-mt">
          <div className="ct-toss-info-line">
            <Check size={14} /> Added {result.added} match{result.added === 1 ? "" : "es"}.
          </div>
          {result.failed.length > 0 && (
            <div className="ct-warning-note">
              <AlertTriangle size={15} />
              Couldn't match {result.failed.length} line{result.failed.length === 1 ? "" : "s"} to
              existing teams — check spelling: {result.failed.join(" · ")}
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

function RoundRobinModal({ tournament, onClose, onGenerate }) {
  const [overs, setOvers] = useState(tournament.defaultOvers || 20);
  const [double, setDouble] = useState(false);
  const count = tournament.teams.length;
  const totalMatches = double ? count * (count - 1) : (count * (count - 1)) / 2;
  return (
    <Modal title="Generate Round-Robin Fixtures" onClose={onClose}>
      <label className="ct-field-label">Overs per match</label>
      <input className="ct-input" type="number" value={overs} onChange={(e) => setOvers(Number(e.target.value))} />
      <label className="ct-check-row">
        <input type="checkbox" checked={double} onChange={(e) => setDouble(e.target.checked)} />
        Home & away (each team plays every other team twice)
      </label>
      <div className="ct-muted-note">This will create {totalMatches} matches for {count} teams.</div>
      <button className="ct-btn ct-btn-primary ct-btn-block" onClick={() => onGenerate(overs, double)}>Generate {totalMatches} Matches</button>
    </Modal>
  );
}

function ManualMatchModal({ tournament, onClose, onAdd }) {
  const [teamA, setTeamA] = useState(tournament.teams[0]?.id || "");
  const [teamB, setTeamB] = useState(tournament.teams[1]?.id || "");
  const [overs, setOvers] = useState(tournament.defaultOvers || 20);
  const [venue, setVenue] = useState("");
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
      <input className="ct-input" type="number" value={overs} onChange={(e) => setOvers(Number(e.target.value))} />
      <label className="ct-field-label">Venue (optional)</label>
      <input className="ct-input" value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="e.g. Shahkot Cricket Ground" />
      <button className="ct-btn ct-btn-primary ct-btn-block" disabled={!teamA || !teamB || teamA === teamB} onClick={() => onAdd(teamA, teamB, overs, venue.trim())}>
        Add Match
      </button>
    </Modal>
  );
}

/* ============================================================
   SCORING TAB
   ============================================================ */

function ScoringTab({ tournament, patch, activeMatchId, setActiveMatchId, broadcast, setBroadcast, broadcastLoading }) {
  const match = tournament.matches.find((m) => m.id === activeMatchId);

  if (!match) {
    const selectable = tournament.matches.filter((m) => m.status !== "completed");
    return (
      <div className="ct-stack">
        <div className="ct-section-label">Select a match to score</div>
        {selectable.length === 0 ? (
          <EmptyState icon={<Radio size={32} />} title="No matches available" sub="Add fixtures first, from the Fixtures tab." />
        ) : (
          <div className="ct-stack-sm">
            {selectable.map((m) => (
              <div className="ct-card ct-match-row" key={m.id}>
                <div className="ct-match-teams">
                  <b>{teamShort(tournament.teams, m.teamAId)}</b> vs <b>{teamShort(tournament.teams, m.teamBId)}</b>
                  <div className="ct-muted-note">{m.oversLimit} overs · {m.status}</div>
                </div>
                <button className="ct-btn ct-btn-primary ct-btn-sm" onClick={() => setActiveMatchId(m.id)}>Open</button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (match.status === "upcoming") {
    return <MatchStartPanel tournament={tournament} match={match} patch={patch} />;
  }
  if (match.status === "completed") {
    return <MatchSummaryPanel tournament={tournament} match={match} onBack={() => setActiveMatchId(null)} />;
  }
  return (
    <LiveScoringPanel
      tournament={tournament}
      match={match}
      patch={patch}
      onBack={() => setActiveMatchId(null)}
      broadcast={broadcast}
      setBroadcast={setBroadcast}
      broadcastLoading={broadcastLoading}
    />
  );
}

function CaptainBadge({ team, align }) {
  if (!team) return null;
  const captain = team.players.find((p) => p.id === team.captainId);
  if (!captain) {
    return <div className="ct-muted-note" style={{ padding: 0 }}>No captain set for {team.name}</div>;
  }
  return (
    <div className="ct-captain-row" style={align === "right" ? { flexDirection: "row-reverse" } : undefined}>
      {captain.photo ? (
        <img className="ct-captain-avatar" src={captain.photo} alt="" />
      ) : (
        <div className="ct-captain-avatar-fallback">{initials(captain.name)}</div>
      )}
      <div>
        <div style={{ fontSize: 12.5 }}>{captain.name}</div>
        <div className="ct-muted-note" style={{ padding: 0, fontSize: 10.5 }}>Captain, {team.name}</div>
      </div>
    </div>
  );
}

function MatchStartPanel({ tournament, match, patch }) {
  const teamA = tournament.teams.find((t) => t.id === match.teamAId);
  const teamB = tournament.teams.find((t) => t.id === match.teamBId);
  const [tossWinner, setTossWinner] = useState(match.teamAId);
  const [tossChoice, setTossChoice] = useState("bat");
  const [venue, setVenue] = useState(match.venue || "");
  const [xiA, setXiA] = useState(() => (teamA?.players || []).map((p) => p.id));
  const [xiB, setXiB] = useState(() => (teamB?.players || []).map((p) => p.id));

  const canStart = teamA?.players.length >= 2 && teamB?.players.length >= 2;

  const toggleXi = (setXi, xi, pid) => {
    setXi(xi.includes(pid) ? xi.filter((id) => id !== pid) : [...xi, pid]);
  };

  const startMatch = () => {
    patch((t) => {
      const m = t.matches.find((x) => x.id === match.id);
      m.tossWinner = tossWinner;
      m.tossChoice = tossChoice;
      m.venue = venue.trim();
      m.playingXI = { [match.teamAId]: xiA.length ? xiA : (teamA?.players || []).map((p) => p.id), [match.teamBId]: xiB.length ? xiB : (teamB?.players || []).map((p) => p.id) };
      const battingFirst = (tossChoice === "bat") ? tossWinner : (tossWinner === m.teamAId ? m.teamBId : m.teamAId);
      const bowlingFirst = battingFirst === m.teamAId ? m.teamBId : m.teamAId;
      m.innings[0] = {
        battingTeamId: battingFirst, bowlingTeamId: bowlingFirst, balls: [],
        currentStrikerId: null, currentNonStrikerId: null, currentBowlerId: null,
        previousBowlerId: null, isComplete: false, target: null,
      };
      m.status = "live";
      m.currentInnings = 0;
      return t;
    });
  };

  return (
    <div className="ct-stack">
      <div className="ct-card ct-setup-match-card">
        <div className="ct-vs-row">
          <div className="ct-vs-team">{teamA?.name}</div>
          <div className="ct-vs-divider">vs</div>
          <div className="ct-vs-team">{teamB?.name}</div>
        </div>
        <div className="ct-row-between">
          <CaptainBadge team={teamA} />
          <CaptainBadge team={teamB} align="right" />
        </div>
        {!canStart && (
          <div className="ct-warning-note"><AlertTriangle size={15} /> Both teams need at least 2 players in their squad before you can start. Add players from the Teams tab.</div>
        )}
        <label className="ct-field-label">Venue (shows on broadcast graphics)</label>
        <input className="ct-input" value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="e.g. Shahkot Cricket Ground" />
        <label className="ct-field-label">Toss won by</label>
        <select className="ct-input" value={tossWinner} onChange={(e) => setTossWinner(e.target.value)}>
          <option value={match.teamAId}>{teamA?.name}</option>
          <option value={match.teamBId}>{teamB?.name}</option>
        </select>
        <label className="ct-field-label">Elected to</label>
        <div className="ct-toggle-row">
          <button className={"ct-toggle" + (tossChoice === "bat" ? " ct-toggle-active" : "")} onClick={() => setTossChoice("bat")}>Bat</button>
          <button className={"ct-toggle" + (tossChoice === "bowl" ? " ct-toggle-active" : "")} onClick={() => setTossChoice("bowl")}>Bowl</button>
        </div>
        <button className="ct-btn ct-btn-primary ct-btn-block" disabled={!canStart} onClick={startMatch}>
          Start Match <ChevronRight size={16} />
        </button>
      </div>

      {canStart && (
        <div className="ct-grid-2">
          <div className="ct-card">
            <div className="ct-card-title">Playing XI — {teamA?.name}</div>
            <div className="ct-muted-note">Tick who's playing (for the lineup overlay). Leave all ticked to use the full squad.</div>
            <div className="ct-player-list">
              {teamA?.players.map((p) => (
                <label className="ct-check-row" key={p.id}>
                  <input type="checkbox" checked={xiA.includes(p.id)} onChange={() => toggleXi(setXiA, xiA, p.id)} />
                  {p.name} <span className="ct-tag">{p.role}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="ct-card">
            <div className="ct-card-title">Playing XI — {teamB?.name}</div>
            <div className="ct-muted-note">Tick who's playing (for the lineup overlay). Leave all ticked to use the full squad.</div>
            <div className="ct-player-list">
              {teamB?.players.map((p) => (
                <label className="ct-check-row" key={p.id}>
                  <input type="checkbox" checked={xiB.includes(p.id)} onChange={() => toggleXi(setXiB, xiB, p.id)} />
                  {p.name} <span className="ct-tag">{p.role}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InlineBroadcastControl({ tournament, match, patch, broadcast, setBroadcast, loading }) {
  const [open, setOpen] = useState(true);

  if (loading || !broadcast) {
    return (
      <div className="ct-card">
        <div className="ct-card-title"><Tv size={14} style={{ verticalAlign: "middle", marginRight: 6 }} />Broadcast Control</div>
        <div className="ct-muted-note">Loading broadcast state…</div>
      </div>
    );
  }

  const layers = normalizeBroadcastLayers(broadcast);
  const isThisMatchOnAir = broadcast.matchId === match.id;

  const toggleLayer = (id) => {
    setBroadcast((b) => {
      const current = normalizeBroadcastLayers(b);
      const nextLayers = { ...current };
      if (id === "bug") {
        nextLayers.bug = !current.bug;
      } else {
        const turningOn = !current[id];
        if (turningOn) {
          OVERLAY_LAYERS.forEach((l) => { if (l.id !== "bug") nextLayers[l.id] = false; });
        }
        nextLayers[id] = turningOn;
      }
      return { ...b, layers: nextLayers };
    });
  };

  const putThisMatchOnAir = () => {
    setBroadcast((b) => ({ ...b, matchId: match.id }));
  };

  const activeCount = OVERLAY_LAYERS.filter((l) => layers[l.id]).length;

  return (
    <div className="ct-card">
      <button
        className="ct-row-between ct-bc-toggle-btn"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="ct-card-title" style={{ marginBottom: 0 }}>
          <Tv size={14} style={{ verticalAlign: "middle", marginRight: 6 }} />
          Broadcast Control {activeCount > 0 && <span className="ct-tag ct-tag-active" style={{ marginLeft: 6 }}>{activeCount} live</span>}
        </span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="ct-bc-panel">
          <div className="ct-muted-note">
            Tick any graphics to put them on the OBS overlay right now — several can be live together with the scorebug.
          </div>

          {!isThisMatchOnAir ? (
            <button className="ct-btn ct-btn-ghost ct-btn-sm ct-mt" onClick={putThisMatchOnAir}>
              <Radio size={14} /> Put this match on overlay
            </button>
          ) : (
            <div className="ct-toss-info-line"><Radio size={13} /> This match is on air for the graphics below</div>
          )}

          <div className="ct-scene-checklist ct-scene-checklist-1col ct-mt">
            {OVERLAY_LAYERS.map((l) => (
              <label className={"ct-scene-check-row" + (layers[l.id] ? " ct-scene-check-active" : "")} key={l.id}>
                <input type="checkbox" checked={!!layers[l.id]} onChange={() => toggleLayer(l.id)} />
                {l.icon} {l.label}
              </label>
            ))}
          </div>

          {layers.toss && (
            <label className="ct-check-row">
              <input
                type="checkbox" checked={!!broadcast.showCaptainPhotos}
                onChange={() => setBroadcast((b) => ({ ...b, showCaptainPhotos: !b.showCaptainPhotos }))}
              />
              Show captain photos on Toss graphic
            </label>
          )}

          {layers.lineup && (
            <>
              <label className="ct-field-label">Lineup — which team</label>
              <div className="ct-toggle-row">
                <button
                  className={"ct-toggle" + ((broadcast.lineupTeamId || match.teamAId) === match.teamAId ? " ct-toggle-active" : "")}
                  onClick={() => setBroadcast((b) => ({ ...b, lineupTeamId: match.teamAId }))}
                >
                  {teamShort(tournament.teams, match.teamAId)}
                </button>
                <button
                  className={"ct-toggle" + (broadcast.lineupTeamId === match.teamBId ? " ct-toggle-active" : "")}
                  onClick={() => setBroadcast((b) => ({ ...b, lineupTeamId: match.teamBId }))}
                >
                  {teamShort(tournament.teams, match.teamBId)}
                </button>
              </div>
            </>
          )}

          {layers.captains && (
            <div className="ct-toss-info-line">
              <Crown size={13} /> Shows both teams' captains — set who's captain (and their photo) from the Teams page → Manage Squad.
            </div>
          )}

          {layers.motm && (
            <>
              <label className="ct-field-label">Player of the Match</label>
              <select
                className="ct-input"
                value={match.motmId || ""}
                onChange={(e) => {
                  const pid = e.target.value || null;
                  window.__ct_setMotm && window.__ct_setMotm(pid);
                }}
              >
                <option value="">Select player</option>
                {[
                  ...(tournament.teams.find((t) => t.id === match.teamAId)?.players || []),
                  ...(tournament.teams.find((t) => t.id === match.teamBId)?.players || []),
                ].map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function LiveScoringPanel({ tournament, match, patch, onBack, broadcast, setBroadcast, broadcastLoading }) {
  const inningsIdx = match.currentInnings;
  const innings = match.innings[inningsIdx];
  const battingTeam = tournament.teams.find((t) => t.id === innings.battingTeamId);
  const bowlingTeam = tournament.teams.find((t) => t.id === innings.bowlingTeamId);
  const stats = computeInningsStats(innings, tournament.teams);

  const [openBatsmanPicker, setOpenBatsmanPicker] = useState(null);
  const [openBowlerPicker, setOpenBowlerPicker] = useState(false);
  const [wicketModal, setWicketModal] = useState(false);
  const [pendingExtra, setPendingExtra] = useState(null);

  const needsStriker = !innings.currentStrikerId;
  const needsNonStriker = !innings.currentNonStrikerId;
  const needsBowler = !innings.currentBowlerId;

  const target = innings.target;
  const isSecondInnings = inningsIdx === 1;
  const runsNeeded = target ? target - stats.totalRuns : null;
  const ballsLeft = match.oversLimit * 6 - stats.validBalls;

  useEffect(() => {
    window.__ct_setMotm = (pid) => {
      patch((t) => {
        const m = t.matches.find((x) => x.id === match.id);
        m.motmId = pid;
        return t;
      });
    };
    return () => { window.__ct_setMotm = null; };
  }, [patch, match.id]);

  const commitBall = (ballPatch) => {
    patch((t) => {
      const m = t.matches.find((x) => x.id === match.id);
      const inn = m.innings[inningsIdx];
      const beforeStats = computeInningsStats(inn, t.teams);
      const striker = inn.currentStrikerId;
      const nonStriker = inn.currentNonStrikerId;
      const bowler = inn.currentBowlerId;

      const ball = {
        overNum: Math.floor(beforeStats.validBalls / 6),
        batsmanId: striker,
        nonStrikerId: nonStriker,
        bowlerId: bowler,
        runsBat: 0,
        extra: null,
        extraRuns: 0,
        isWicket: false,
        wicketType: null,
        outBatsmanId: null,
        fielderNote: null,
        ...ballPatch,
      };
      inn.balls.push(ball);

      let rotate = false;
      if (!ball.extra) {
        rotate = ball.runsBat % 2 === 1;
      } else if (ball.extra === "nb" || ball.extra === "wd") {
        rotate = (ball.runsBat || 0) % 2 === 1 && ball.extra === "nb" ? true : ((ball.extraRuns || 0) % 2 === 1);
        if (ball.extra === "nb") rotate = (ball.runsBat || 0) % 2 === 1;
      } else if (ball.extra === "penalty") {
        // Double Wicket "OUT −2": now a legal delivery, so strike swaps
        // just like it would after any other completed ball.
        rotate = true;
      } else {
        rotate = (ball.extraRuns || 0) % 2 === 1;
      }

      if (ball.isWicket) {
        const outId = ball.outBatsmanId || striker;
        if (outId === inn.currentStrikerId) {
          inn.currentStrikerId = null;
        } else if (outId === inn.currentNonStrikerId) {
          inn.currentNonStrikerId = null;
        }
      } else if (rotate) {
        const tmp = inn.currentStrikerId;
        inn.currentStrikerId = inn.currentNonStrikerId;
        inn.currentNonStrikerId = tmp;
      }

      const afterStats = computeInningsStats(inn, t.teams);
      // FIX (bug #2): a bye or leg-bye ("b"/"lb") is still a LEGAL delivery —
      // it counts toward the 6-ball over just like a normal run. The old
      // check `!ball.extra` was false for byes/leg-byes too (since their
      // `extra` field is set), so an over ending on a bye/leg-bye never
      // rotated the strike or changed the bowler — the same bowler would
      // silently keep bowling past 6 legal balls. Only wides ("wd") and
      // no-balls ("nb") should be excluded, since those don't consume a
      // legal delivery.
      const overNowComplete = afterStats.validBalls > 0 && afterStats.validBalls % 6 === 0 && ball.extra !== "wd" && ball.extra !== "nb";
      if (overNowComplete && afterStats.validBalls !== beforeStats.validBalls) {
        const tmp = inn.currentStrikerId;
        inn.currentStrikerId = inn.currentNonStrikerId;
        inn.currentNonStrikerId = tmp;
        inn.previousBowlerId = inn.currentBowlerId;
        inn.currentBowlerId = null;
      }

      const wickets = afterStats.totalWickets;
      const allOut = wickets >= t.teams.find((x) => x.id === inn.battingTeamId).players.length - 1;
      const oversUp = afterStats.validBalls >= m.oversLimit * 6;
      const chased = inn.target != null && afterStats.totalRuns >= inn.target;

      if (allOut || oversUp || chased) {
        inn.isComplete = true;
        if (m.currentInnings === 0) {
          const secondBatting = inn.bowlingTeamId;
          const secondBowling = inn.battingTeamId;
          m.innings[1] = {
            battingTeamId: secondBatting, bowlingTeamId: secondBowling, balls: [],
            currentStrikerId: null, currentNonStrikerId: null, currentBowlerId: null,
            previousBowlerId: null, isComplete: false, target: afterStats.totalRuns + 1,
          };
          m.currentInnings = 1;
        } else {
          const s1 = computeInningsStats(m.innings[0], t.teams);
          const s2 = computeInningsStats(m.innings[1], t.teams);
          let result;
          if (s1.totalRuns === s2.totalRuns) {
            result = { type: "tie", summary: "Match tied" };
          } else {
            const winnerId = s2.totalRuns > s1.totalRuns ? m.innings[1].battingTeamId : m.innings[0].battingTeamId;
            const winnerName = t.teams.find((x) => x.id === winnerId)?.name;
            if (s2.totalRuns > s1.totalRuns) {
              const wicketsInHand = t.teams.find((x) => x.id === m.innings[1].battingTeamId).players.length - 1 - s2.totalWickets;
              result = { type: "win", winnerId, summary: `${winnerName} won by ${wicketsInHand} wicket${wicketsInHand === 1 ? "" : "s"}` };
            } else {
              const margin = s1.totalRuns - s2.totalRuns;
              result = { type: "win", winnerId, summary: `${winnerName} won by ${margin} run${margin === 1 ? "" : "s"}` };
            }
          }
          m.result = result;
          m.status = "completed";
        }
      }
      return t;
    });
  };

  const scoreRun = (runs) => {
    if (pendingExtra === "wd") {
      commitBall({ extra: "wd", extraRuns: runs });
      setPendingExtra(null);
      return;
    }
    if (pendingExtra === "nb") {
      commitBall({ extra: "nb", runsBat: runs });
      setPendingExtra(null);
      return;
    }
    if (pendingExtra === "b") {
      commitBall({ extra: "b", extraRuns: runs || 1 });
      setPendingExtra(null);
      return;
    }
    if (pendingExtra === "lb") {
      commitBall({ extra: "lb", extraRuns: runs || 1 });
      setPendingExtra(null);
      return;
    }
    commitBall({ runsBat: runs });
  };

  const applyOutPenalty = () => {
    commitBall({ runsBat: -2, extra: "penalty", extraRuns: 0 });
  };

  // Score Correction: adjusts the running total directly without recording
  // a ball — nothing is pushed to innings.balls, so it never appears in the
  // this-over strip, never consumes a delivery, and never touches any
  // batter's or bowler's figures. Can be applied any number of times in
  // either direction; +1 undoes an accidental extra −1 press.
  const applyScoreCorrection = (delta) => {
    patch((t) => {
      const m = t.matches.find((x) => x.id === match.id);
      const inn = m.innings[inningsIdx];
      inn.runAdjustment = (inn.runAdjustment || 0) + delta;
      return t;
    });
  };

  const confirmWicket = (wicketType, outWho, fielderNote, runsCompleted) => {
    const outId = outWho === "striker" ? innings.currentStrikerId : innings.currentNonStrikerId;
    commitBall({
      isWicket: true, wicketType, outBatsmanId: outId, fielderNote: fielderNote || null,
      runsBat: wicketType === "Run Out" ? (runsCompleted || 0) : 0,
    });
    setWicketModal(false);
  };

  const undoLastBall = () => {
    patch((t) => {
      const m = t.matches.find((x) => x.id === match.id);
      const inn = m.innings[inningsIdx];
      if (inn.balls.length === 0) return t;
      inn.balls.pop();
      inn.currentStrikerId = null;
      inn.currentNonStrikerId = null;
      inn.currentBowlerId = null;
      inn.isComplete = false;
      if (m.status === "completed") { m.status = "live"; m.result = null; }
      return t;
    });
  };

  // Manually swap striker and non-striker at any point — independent of
  // ball scoring. Doesn't touch innings.balls, doesn't consume a delivery,
  // and doesn't affect anyone's runs/balls figures — purely fixes who's on
  // strike, for whenever the on-field situation needs a manual correction
  // (crossed on a missed run-out call, wrong end recorded, etc).
  const swapBatsmen = () => {
    patch((t) => {
      const m = t.matches.find((x) => x.id === match.id);
      const inn = m.innings[inningsIdx];
      const tmp = inn.currentStrikerId;
      inn.currentStrikerId = inn.currentNonStrikerId;
      inn.currentNonStrikerId = tmp;
      return t;
    });
  };

  const thisOverBalls = innings.balls.filter((b) => b.overNum === Math.floor(stats.validBalls / 6));

  return (
    <div className="ct-stack">
      <div className="ct-row-between">
        <button className="ct-btn ct-btn-ghost ct-btn-sm" onClick={onBack}><ChevronLeft size={15} /> Matches</button>
        <div className="ct-row-gap">
          <button
            className="ct-btn ct-btn-ghost ct-btn-sm"
            onClick={swapBatsmen}
            disabled={!innings.currentStrikerId || !innings.currentNonStrikerId}
            title="Manually swap striker and non-striker anytime"
          >
            <RotateCcw size={14} style={{ transform: "scaleX(-1)" }} /> Swap Batsmen
          </button>
          <button className="ct-btn ct-btn-ghost ct-btn-sm" onClick={undoLastBall}><RotateCcw size={14} /> Undo Last Ball</button>
        </div>
      </div>

      <div className="ct-live-scoring-layout">
        <div className="ct-live-scoring-side">
          <InlineBroadcastControl
            tournament={tournament}
            match={match}
            patch={patch}
            broadcast={broadcast}
            setBroadcast={setBroadcast}
            loading={broadcastLoading}
          />
        </div>

        <div className="ct-live-scoring-main">
          <div className="ct-scoreboard">
            <div className="ct-scoreboard-teams">{teamShort(tournament.teams, battingTeam.id)} batting · vs {teamShort(tournament.teams, bowlingTeam.id)}</div>
            <div className="ct-digit-row">
              <DigitTile value={stats.totalRuns} label="RUNS" />
              <DigitTile value={stats.totalWickets} label="WKTS" />
              <DigitTile value={stats.oversStr} label="OVERS" />
              <DigitTile value={stats.runRate} label="RUN RATE" />
            </div>
            {isSecondInnings && target && (
              <div className="ct-target-note">
                Target {target} · Need {Math.max(runsNeeded, 0)} runs from {Math.max(ballsLeft, 0)} balls
              </div>
            )}
            <div className="ct-this-over">
              {thisOverBalls.map((b, i) => {
                const isFour = (!b.extra && b.runsBat === 4) || (b.extra === "nb" && b.runsBat === 4);
                const isSix = (!b.extra && b.runsBat === 6) || (b.extra === "nb" && b.runsBat === 6);
                return (
                  <span
                    key={i}
                    className={
                      "ct-ball-chip" +
                      (b.isWicket ? " ct-ball-wicket" : "") +
                      (b.extra ? " ct-ball-extra" : "") +
                      (b.extra === "nb" ? " ct-ball-nb" : "") +
                      (b.extra === "wd" ? " ct-ball-wd" : "") +
                      (isFour ? " ct-ball-4" : "") +
                      (isSix ? " ct-ball-6" : "") +
                      (b.extra === "penalty" ? " ct-ball-penalty" : "")
                    }
                  >
                    {ballLabel(b)}
                  </span>
                );
              })}
            </div>
          </div>

          <div className="ct-card ct-score-correction-card">
            <div className="ct-card-title">
              Score Correction
              {!!innings.runAdjustment && (
                <span className="ct-tag ct-tag-active" style={{ marginLeft: 8 }}>
                  {innings.runAdjustment > 0 ? "+" : ""}{innings.runAdjustment} applied
                </span>
              )}
            </div>
            <div className="ct-muted-note">
              Fixes the total score directly for scoring mistakes — this is not a delivery, so it never
              appears in the this-over strip and never affects any batter's or bowler's figures. Available
              in every tournament, including Double Wicket. Press as many times as needed.
            </div>
            <div className="ct-row-gap ct-mt">
              <button className="ct-btn ct-btn-danger" onClick={() => applyScoreCorrection(-1)}>
                <Minus size={14} /> −1 Run
              </button>
              <button className="ct-btn ct-btn-ghost" onClick={() => applyScoreCorrection(1)}>
                <Plus size={14} /> +1 Run (Undo)
              </button>
            </div>
          </div>

          <div className="ct-grid-2">
            <div className="ct-card">
              <div className="ct-card-title">Batting</div>
              <BatterRow label="Striker *" id={innings.currentStrikerId} stats={stats} tournament={tournament} onPick={() => setOpenBatsmanPicker("striker")} />
              <BatterRow label="Non-striker" id={innings.currentNonStrikerId} stats={stats} tournament={tournament} onPick={() => setOpenBatsmanPicker("nonstriker")} />
            </div>
            <div className="ct-card">
              <div className="ct-card-title">Bowling</div>
              <BowlerRow id={innings.currentBowlerId} stats={stats} tournament={tournament} onPick={() => setOpenBowlerPicker(true)} />
            </div>
          </div>

          {(needsStriker || needsNonStriker || needsBowler) ? (
            <div className="ct-card ct-warning-note">
              <AlertTriangle size={15} />
              {needsBowler && " Select a bowler "}
              {(needsStriker || needsNonStriker) && " Select batsmen "}
              to continue scoring.
            </div>
          ) : (
            <div className="ct-card ct-scoring-pad">
              <div className="ct-card-title">Runs {pendingExtra && <span className="ct-tag ct-tag-active">{extraLongLabel(pendingExtra)} — enter runs</span>}</div>
              <div className="ct-run-grid">
                {[0, 1, 2, 3, 4, 5, 6].map((r) => (
                  <button key={r} className={"ct-run-btn" + (r === 4 || r === 6 ? " ct-run-btn-boundary" : "")} onClick={() => scoreRun(r)}>{r}</button>
                ))}
              </div>
              <div className="ct-extra-grid">
                <button className={"ct-btn ct-btn-ghost" + (pendingExtra === "wd" ? " ct-toggle-active" : "")} onClick={() => setPendingExtra(pendingExtra === "wd" ? null : "wd")}>Wide</button>
                <button className={"ct-btn ct-btn-ghost" + (pendingExtra === "nb" ? " ct-toggle-active" : "")} onClick={() => setPendingExtra(pendingExtra === "nb" ? null : "nb")}>No Ball</button>
                <button className={"ct-btn ct-btn-ghost" + (pendingExtra === "b" ? " ct-toggle-active" : "")} onClick={() => setPendingExtra(pendingExtra === "b" ? null : "b")}>Bye</button>
                <button className={"ct-btn ct-btn-ghost" + (pendingExtra === "lb" ? " ct-toggle-active" : "")} onClick={() => setPendingExtra(pendingExtra === "lb" ? null : "lb")}>Leg Bye</button>
                <button className="ct-btn ct-btn-danger" onClick={() => setWicketModal(true)}>Wicket</button>
                {tournament.isDoubleWicket && (
                  <button
                    className="ct-btn ct-btn-penalty"
                    onClick={applyOutPenalty}
                    title="Double Wicket format: docks 2 runs from the team total for this dismissal — counts as a legal ball and swaps the strike"
                  >
                    OUT −2
                  </button>
                )}
              </div>
              {tournament.isDoubleWicket && (
                <div className="ct-muted-note" style={{ paddingTop: 6 }}>
                  Double Wicket tournament: record the dismissal with "Wicket" as usual, then tap "OUT −2" to dock the penalty from the team total. "OUT −2" now counts as a normal legal ball — it uses up a delivery from the over, adds to the batter's/bowler's over count, and swaps the strike, just like any other ball.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {openBatsmanPicker && (
        <PlayerPickerModal
          title={`Select ${openBatsmanPicker === "striker" ? "striker" : "non-striker"}`}
          players={battingTeam.players.filter((p) => !stats.batsmen[p.id]?.out)}
          onClose={() => setOpenBatsmanPicker(null)}
          onPick={(pid) => {
            patch((t) => {
              const m = t.matches.find((x) => x.id === match.id);
              const inn = m.innings[inningsIdx];
              if (openBatsmanPicker === "striker") inn.currentStrikerId = pid; else inn.currentNonStrikerId = pid;
              return t;
            });
            setOpenBatsmanPicker(null);
          }}
        />
      )}
      {openBowlerPicker && (
        <PlayerPickerModal
          title="Select bowler"
          players={bowlingTeam.players.filter((p) => p.id !== innings.previousBowlerId)}
          onClose={() => setOpenBowlerPicker(false)}
          onPick={(pid) => {
            patch((t) => {
              const m = t.matches.find((x) => x.id === match.id);
              m.innings[inningsIdx].currentBowlerId = pid;
              return t;
            });
            setOpenBowlerPicker(false);
          }}
        />
      )}
      {wicketModal && (
        <WicketModal
          onClose={() => setWicketModal(false)}
          onConfirm={confirmWicket}
          strikerName={playerName(tournament.teams, innings.currentStrikerId)}
          nonStrikerName={playerName(tournament.teams, innings.currentNonStrikerId)}
        />
      )}
    </div>
  );
}

function ballLabel(b) {
  if (b.isWicket) return "W";
  if (b.extra === "wd") return `wd${b.extraRuns ? "+" + b.extraRuns : ""}`;
  if (b.extra === "nb") return `nb${b.runsBat ? "+" + b.runsBat : ""}`;
  if (b.extra === "b") return `${b.extraRuns}b`;
  if (b.extra === "lb") return `${b.extraRuns}lb`;
  if (b.extra === "penalty") return `${b.runsBat}`;
  return String(b.runsBat);
}
function extraLongLabel(code) {
  return { wd: "Wide", nb: "No Ball", b: "Bye", lb: "Leg Bye", penalty: "Out Penalty" }[code] || code;
}

function BatterRow({ label, id, stats, tournament, onPick }) {
  if (!id) {
    return (
      <button className="ct-btn ct-btn-ghost ct-btn-block" onClick={onPick}>Select {label}</button>
    );
  }
  const rec = stats.batsmen[id];
  return (
    <div className="ct-player-stat-row">
      <span>{playerName(tournament.teams, id)} {label.includes("*") && "*"}</span>
      <span className="ct-mono">{rec ? `${rec.runs} (${rec.balls})` : "0 (0)"}</span>
    </div>
  );
}
function BowlerRow({ id, stats, tournament, onPick }) {
  if (!id) {
    return (
      <button className="ct-btn ct-btn-ghost ct-btn-block" onClick={onPick}>Select bowler</button>
    );
  }
  const rec = stats.bowlers[id];
  return (
    <div className="ct-player-stat-row">
      <span>{playerName(tournament.teams, id)}</span>
      <span className="ct-mono">{rec ? `${rec.wickets}-${rec.runs} (${ballsToOverStr(rec.balls)})` : "0-0 (0.0)"}</span>
    </div>
  );
}

function PlayerPickerModal({ title, players, onClose, onPick }) {
  return (
    <Modal title={title} onClose={onClose}>
      <div className="ct-player-list">
        {players.length === 0 && <div className="ct-muted-note">No eligible players.</div>}
        {players.map((p) => (
          <button key={p.id} className="ct-player-pick-row" onClick={() => onPick(p.id)}>
            <span>{p.name}</span><span className="ct-tag">{p.role}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}

function WicketModal({ onClose, onConfirm, strikerName, nonStrikerName, pendingExtra }) {
  const allowedTypes =
    pendingExtra === "nb" ? ["Run Out"] :
    pendingExtra === "wd" ? ["Run Out", "Stumped", "Hit Wicket"] :
    WICKET_TYPES;
  const [type, setType] = useState(allowedTypes[0]);
  const [outWho, setOutWho] = useState("striker");
  const [fielder, setFielder] = useState("");
  const [runsCompleted, setRunsCompleted] = useState(0);

  return (
    <Modal title="Record Wicket" onClose={onClose}>
      <label className="ct-field-label">Dismissal type</label>
      <select className="ct-input" value={type} onChange={(e) => setType(e.target.value)}>
{allowedTypes.map((w) => <option key={w}>{w}</option>)}      </select>
      {type === "Run Out" && (
        <>
          <label className="ct-field-label">Who's out</label>
          <div className="ct-toggle-row">
            <button className={"ct-toggle" + (outWho === "striker" ? " ct-toggle-active" : "")} onClick={() => setOutWho("striker")}>{strikerName}</button>
            <button className={"ct-toggle" + (outWho === "nonstriker" ? " ct-toggle-active" : "")} onClick={() => setOutWho("nonstriker")}>{nonStrikerName}</button>
          </div>
          <label className="ct-field-label">Runs completed before dismissal</label>
          <input className="ct-input" type="number" min={0} max={6} value={runsCompleted} onChange={(e) => setRunsCompleted(Number(e.target.value))} />
        </>
      )}
      {(type === "Caught" || type === "Stumped" || type === "Run Out") && (
        <>
          <label className="ct-field-label">Fielder (optional)</label>
          <input className="ct-input" value={fielder} onChange={(e) => setFielder(e.target.value)} placeholder="Fielder name" />
        </>
      )}
      <button className="ct-btn ct-btn-danger ct-btn-block" onClick={() => onConfirm(type, type === "Run Out" ? outWho : "striker", fielder, runsCompleted)}>
        Confirm Wicket
      </button>
    </Modal>
  );
}

/* ============================================================
   MATCH SUMMARY (post-completion view inside scoring tab)
   ============================================================ */

function MatchSummaryPanel({ tournament, match, onBack }) {
  return (
    <div className="ct-stack">
      <button className="ct-btn ct-btn-ghost ct-btn-sm" onClick={onBack}><ChevronLeft size={15} /> Matches</button>
      <div className="ct-card">
        <div className="ct-card-title">Result</div>
        <div className="ct-result-banner"><Trophy size={18} /> {match.result?.summary}</div>
      </div>
      <FullScorecard tournament={tournament} match={match} />
    </div>
  );
}

/* ============================================================
   SCORECARDS TAB
   ============================================================ */

function ScorecardsTab({ tournament }) {
  const [matchId, setMatchId] = useState(null);
  const playable = tournament.matches.filter((m) => m.status !== "upcoming");
  const match = playable.find((m) => m.id === matchId) || playable[playable.length - 1];

  if (playable.length === 0) {
    return <EmptyState icon={<ClipboardList size={32} />} title="No matches started yet" />;
  }

  return (
    <div className="ct-stack">
      <select className="ct-input" value={match?.id || ""} onChange={(e) => setMatchId(e.target.value)}>
        {playable.map((m) => (
          <option key={m.id} value={m.id}>
            {teamShort(tournament.teams, m.teamAId)} vs {teamShort(tournament.teams, m.teamBId)} {m.status === "live" ? "(live)" : ""}
          </option>
        ))}
      </select>
      {match && <FullScorecard tournament={tournament} match={match} />}
    </div>
  );
}

function FullScorecard({ tournament, match }) {
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
        <thead><tr><th>Batter</th><th>R</th><th>B</th></tr></thead>
        <tbody>
          {battingOrderSorted.map((id) => {
            const b = stats.batsmen[id];
            return (
              <tr key={id}>
                <td>{playerName(tournament.teams, id)}{!b.out ? " *" : ""}
                  {b.out && <div className="ct-dismissal-note">{dismissalText(b.howOut, tournament.teams)}</div>}
                </td>
                <td>{b.runs}</td><td>{b.balls}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="ct-extras-line">
        Extras: {stats.extras.wd + stats.extras.nb + stats.extras.b + stats.extras.lb}
        {" "}(wd {stats.extras.wd}, nb {stats.extras.nb}, b {stats.extras.b}, lb {stats.extras.lb})
        {stats.extras.penalty !== 0 && <> · Out penalty: {stats.extras.penalty}</>}
        {stats.runAdjustment !== 0 && <> · Score correction: {stats.runAdjustment > 0 ? "+" : ""}{stats.runAdjustment}</>}
      </div>

      <div className="ct-card-title ct-mt">Bowling</div>
      <table className="ct-table">
        <thead><tr><th>Bowler</th><th>O</th><th>R</th><th>W</th></tr></thead>
        <tbody>
          {Object.values(stats.bowlers).map((b) => (
            <tr key={b.id}>
              <td>{playerName(tournament.teams, b.id)}</td>
              <td>{ballsToOverStr(b.balls)}</td><td>{b.runs}</td><td>{b.wickets}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {stats.fow.length > 0 && (
        <div className="ct-fow">
          <b>Fall of wickets:</b> {stats.fow.map((f) => `${f.score}-${f.wicketNum} (${playerName(tournament.teams, f.batsmanId)}, ${f.overStr} ov)`).join(", ")}
        </div>
      )}
    </div>
  );
}

function dismissalText(howOut, teams) {
  if (!howOut) return "";
  if (howOut.type === "Bowled") return `b ${playerName(teams, howOut.bowlerId)}`;
  if (howOut.type === "LBW") return `lbw b ${playerName(teams, howOut.bowlerId)}`;
  if (howOut.type === "Caught") return `c ${howOut.fielder || "fielder"} b ${playerName(teams, howOut.bowlerId)}`;
  if (howOut.type === "Stumped") return `st ${howOut.fielder || "keeper"} b ${playerName(teams, howOut.bowlerId)}`;
  if (howOut.type === "Run Out") return `run out${howOut.fielder ? " (" + howOut.fielder + ")" : ""}`;
  if (howOut.type === "Hit Wicket") return `hit wicket b ${playerName(teams, howOut.bowlerId)}`;
  return howOut.type;
}

/* ============================================================
   POINTS TABLE TAB
   ============================================================ */

function PointsTableRows({ table, tournament }) {
  return (
    <tbody>
      {table.map((r, i) => (
        <tr key={r.teamId}>
          <td>{i + 1}</td>
          <td>{teamName(tournament.teams, r.teamId)}</td>
          <td>{r.played}</td><td>{r.won}</td><td>{r.lost}</td><td>{r.tied}</td><td>{r.noResult}</td>
          <td><b>{r.points}</b></td><td>{r.nrr >= 0 ? "+" : ""}{r.nrr.toFixed(3)}</td>
        </tr>
      ))}
    </tbody>
  );
}

function PointsTableTab({ tournament }) {
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

/* ============================================================
   BROADCAST CONTROL TAB
   ============================================================ */

function BroadcastTab({ tournament, patch, broadcast, setBroadcast, loading }) {
  const matches = tournament.matches.filter((m) => m.status !== "upcoming");

  // FIX (UX issue reported): "Match on air" used to just fall back to
  // `matches[matches.length - 1]` (the LAST entry in fixture-creation order)
  // whenever no matchId was explicitly chosen. That is not necessarily the
  // most recently PLAYED match — e.g. if a fixture created earlier in the
  // list was completed most recently, the old code would still point at
  // whichever match happens to sit last in the array. We now explicitly
  // pick, in priority order: (1) whatever the operator already selected,
  // (2) the currently live match, (3) the most recently completed match
  // (by completedAt/updated order, not array position).
  const mostRecentlyPlayed = [...matches].reverse().find((m) => m.status === "completed");
  const defaultMatchId = broadcast.matchId || matches.find((m) => m.status === "live")?.id || mostRecentlyPlayed?.id || matches[matches.length - 1]?.id || "";
  const match = tournament.matches.find((m) => m.id === defaultMatchId);

  const layers = normalizeBroadcastLayers(broadcast);
  const toggleLayer = (id) => {
    setBroadcast((b) => {
      const current = normalizeBroadcastLayers(b);
      const nextLayers = { ...current };
      if (id === "bug") {
        nextLayers.bug = !current.bug;
      } else {
        const turningOn = !current[id];
        if (turningOn) {
          OVERLAY_LAYERS.forEach((l) => { if (l.id !== "bug") nextLayers[l.id] = false; });
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
  const activeExtraLayers = OVERLAY_LAYERS.filter((l) => l.id !== "bug" && layers[l.id]);

  if (loading) return <EmptyState icon={<Loader2 className="ct-spin" size={28} />} title="Loading broadcast control…" />;

  return (
    <div className="ct-stack">
      <div className="ct-card">
        <div className="ct-row-between">
          <div className="ct-card-title" style={{ marginBottom: 0 }}>Match on air</div>
          {broadcast.matchId && (
            <button
              className="ct-btn ct-btn-ghost ct-btn-sm"
              title="Stop pinning a specific match and follow whichever match is live (or most recently completed) automatically"
              onClick={() => setBroadcast((b) => ({ ...b, matchId: null }))}
            >
              <RotateCcw size={13} /> Follow latest match
            </button>
          )}
        </div>
        <select className="ct-input" value={defaultMatchId} onChange={(e) => setBroadcast((b) => ({ ...b, matchId: e.target.value }))}>
          {matches.length === 0 && <option value="">No matches started yet</option>}
          {matches.map((m) => (
            <option key={m.id} value={m.id}>
              {teamShort(tournament.teams, m.teamAId)} vs {teamShort(tournament.teams, m.teamBId)} {m.status === "live" ? "(live)" : "(completed)"}
            </option>
          ))}
        </select>
        <div className="ct-muted-note" style={{ paddingBottom: 0 }}>
          {broadcast.matchId
            ? "Pinned to this match — it will stay selected even after another match finishes. Use \"Follow latest match\" to go back to automatic."
            : "Following automatically: live match if there is one, otherwise the most recently completed match."}
        </div>
        {match?.tossWinner && (
          <div className="ct-toss-info-line">
            <Coins size={14} /> {teamName(tournament.teams, match.tossWinner)} won the toss, elected to {match.tossChoice === "bat" ? "bat" : "bowl"} first
          </div>
        )}

        {match && (
          <>
            <label className="ct-field-label">Match stage (shows as a badge on overlay)</label>
            <div className="ct-toggle-row">
              {["Group Stage", "Semi Final", "Final"].map((s) => (
                <button
                  key={s}
                  type="button"
                  className={"ct-toggle" + (match.stage === s ? " ct-toggle-active" : "")}
                  onClick={() => patch((t) => { const m = t.matches.find((x) => x.id === match.id); m.stage = s; return t; })}
                >
                  {s}
                </button>
              ))}
            </div>
            <input
              className="ct-input ct-mt"
              placeholder="Or type a custom label, e.g. Quarter Final 2"
              value={match.stage || ""}
              onChange={(e) => patch((t) => { const m = t.matches.find((x) => x.id === match.id); m.stage = e.target.value; return t; })}
            />
          </>
        )}
      </div>

      <div className="ct-grid-2">
        <div className="ct-card">
          <div className="ct-card-title">On-air graphics — tick any combination</div>
          <div className="ct-muted-note">Every option here can be on at the same time as the others — the overlay shows them together.</div>
          <div className="ct-scene-checklist ct-mt">
            {OVERLAY_LAYERS.map((s) => (
              <label className={"ct-scene-check-row" + (layers[s.id] ? " ct-scene-check-active" : "")} key={s.id}>
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
                type="checkbox" checked={!!broadcast.showCaptainPhotos}
                onChange={() => setBroadcast((b) => ({ ...b, showCaptainPhotos: !b.showCaptainPhotos }))}
              />
              Show captain photos on Toss graphic (Team 1 vs Team 2 with captain pics)
            </label>
          )}

          {layers.lineup && match && (
            <>
              <label className="ct-field-label">Which team's lineup</label>
              <div className="ct-toggle-row">
                <button className={"ct-toggle" + ((broadcast.lineupTeamId || match.teamAId) === match.teamAId ? " ct-toggle-active" : "")} onClick={() => setBroadcast((b) => ({ ...b, lineupTeamId: match.teamAId }))}>
                  {teamShort(tournament.teams, match.teamAId)}
                </button>
                <button className={"ct-toggle" + (broadcast.lineupTeamId === match.teamBId ? " ct-toggle-active" : "")} onClick={() => setBroadcast((b) => ({ ...b, lineupTeamId: match.teamBId }))}>
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
                value={match.motmId || ""}
                onChange={(e) => patch((t) => { const m = t.matches.find((x) => x.id === match.id); m.motmId = e.target.value || null; return t; })}
              >
                <option value="">Select player</option>
                {allMatchPlayers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              {perf.topScorers[0] && (
                <div className="ct-muted-note">Top scorer this match: {playerName(tournament.teams, perf.topScorers[0].id)} ({perf.topScorers[0].runs} runs)</div>
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
        This panel controls what shows on the OBS/vMix overlay in real time, and it's the same broadcast doc used by the quick panel inside Live Scoring — toggle from either place and both stay in sync. Any number of graphics can be on together with the scorebug.
      </div>
    </div>
  );
}

/* ============================================================
   DATA & BACKUP TAB
   ============================================================ */

function DataTab({ tournament, setTournament }) {
  const fileInputRef = useRef(null);

  const exportBackup = () => {
    const blob = new Blob([JSON.stringify(tournament, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safeName = (tournament.name || "tournament").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    a.href = url;
    a.download = `${safeName}-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const importBackup = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed.teams || !parsed.matches) throw new Error("not a tournament file");
        if (!parsed.id) parsed.id = uid("tour");
        setTournament(parsed);
      } catch (e) {
        alert("That file doesn't look like a valid tournament backup.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="ct-stack">
      <div className="ct-card">
        <div className="ct-card-title">Match Format</div>
        <div className="ct-muted-note">
          Turn this on for Double Wicket tournaments. When it's on, the Live Scoring screen shows an extra
          "OUT −2" button next to Wicket, which docks 2 runs from the batting team's total the moment a
          batter is given out. This counts as a normal legal delivery — it uses up a ball from the over,
          adds to the batter's and bowler's over count, and swaps the strike, exactly like any other
          scored ball. Leave this off for a normal tournament and scoring works exactly as before.
        </div>
        <label className="ct-check-row">
          <input
            type="checkbox"
            checked={!!tournament.isDoubleWicket}
            onChange={() => setTournament((prev) => (prev ? { ...prev, isDoubleWicket: !prev.isDoubleWicket } : prev))}
          />
          This is a Double Wicket tournament (−2 penalty on dismissal)
        </label>
      </div>

      <div className="ct-card">
        <div className="ct-card-title">Where your data actually lives</div>
        <div className="ct-muted-note">
          Everything you enter is saved by <code>server.js</code> into a file called <code>storage-data.json</code>, sitting right next to it in your <code>cricket-app</code> folder on this laptop. As long as that file exists, your data is safe — even if the app screen looks blank because the server wasn't running yet when you opened it. Copy that file somewhere (a USB drive, cloud folder) any time for a raw backup.
        </div>
      </div>

      <div className="ct-grid-2">
        <div className="ct-card">
          <div className="ct-card-title">Backup this tournament</div>
          <div className="ct-muted-note">Download everything — teams, fixtures, every ball bowled, stats — as one file you can keep anywhere.</div>
          <button className="ct-btn ct-btn-primary ct-btn-block" onClick={exportBackup}><Download size={15} /> Download Backup (.json)</button>
        </div>
        <div className="ct-card">
          <div className="ct-card-title">Restore a backup into this tournament</div>
          <div className="ct-muted-note">This replaces "{tournament.name}"'s data with the file you pick. To keep the current data too, open the tournament switcher (top of the sidebar) and create a new tournament first, then restore into that one instead.</div>
          <input ref={fileInputRef} type="file" accept=".json" style={{ display: "none" }} onChange={(e) => { if (e.target.files[0]) importBackup(e.target.files[0]); e.target.value = ""; }} />
          <button className="ct-btn ct-btn-ghost ct-btn-block" onClick={() => fileInputRef.current?.click()}><Upload size={15} /> Choose Backup File</button>
        </div>
      </div>

      <div className="ct-card">
        <div className="ct-card-title">Running more than one tournament</div>
        <div className="ct-muted-note">
          Click the tournament name at the top of the sidebar to open the switcher — create a new tournament, jump between existing ones, or rename/delete an old one. Each tournament is saved completely separately, so switching away from one never touches its data, and the OBS overlay always follows whichever tournament you currently have open.
        </div>
      </div>
    </div>
  );
}

function StatsTab({ tournament }) {
  const { topRuns, topWickets } = aggregatePlayerStats(tournament);
  return (
    <div className="ct-grid-2">
      <div className="ct-card">
        <div className="ct-card-title">Most Runs</div>
        {topRuns.length === 0 ? <EmptyState icon={<BarChart3 size={28} />} title="No data yet" /> : (
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
        {topWickets.length === 0 ? <EmptyState icon={<Target size={28} />} title="No data yet" /> : (
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

/* ============================================================
   STYLES
   ============================================================ */

function Styles() {
  return (
    <>
      <SceneStyles />
      <style>{`
      :root {
        --bg: #10161A;
        --bg-panel: #1A232B;
        --bg-panel-2: #212C35;
        --pitch: #3C7A4F;
        --pitch-bright: #4E9E67;
        --floodlight: #F2A93B;
        --floodlight-dim: #C98A2C;
        --chalk: #EDEDE3;
        --chalk-dim: #93A1A8;
        --danger: #D9564F;
        --border: #2B3946;
      }
      * { box-sizing: border-box; }
      .ct-root {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        background: var(--bg);
        color: var(--chalk);
        min-height: 100%;
        width: 100%;
      }
      .ct-loading-screen, .ct-setup-screen {
        min-height: 500px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px;
      }
      .ct-spin { animation: ct-spin 1s linear infinite; color: var(--floodlight); }
      @keyframes ct-spin { to { transform: rotate(360deg); } }

      .ct-setup-card {
        background: var(--bg-panel); border: 1px solid var(--border); border-radius: 14px;
        padding: 36px; max-width: 420px; width: 90%; text-align: center;
      }
      .ct-setup-mark { font-size: 40px; margin-bottom: 8px; }
      .ct-setup-card h1 { font-family: 'Oswald', 'Arial Narrow', sans-serif; font-weight: 700; letter-spacing: 0.5px; margin: 4px 0; font-size: 26px; text-transform: uppercase; }
      .ct-setup-sub { color: var(--chalk-dim); font-size: 13px; margin-bottom: 20px; }

      .ct-shell { display: flex; min-height: 100vh; }
      .ct-sidebar {
        width: 230px; flex-shrink: 0; background: var(--bg-panel); border-right: 1px solid var(--border);
        display: flex; flex-direction: column; padding: 18px 14px;
      }
      .ct-brand { display: flex; align-items: center; gap: 12px; padding: 14px 12px; margin-bottom: 16px; background: linear-gradient(160deg, var(--bg-panel-2), var(--bg-panel)); border: 1px solid var(--border); border-radius: 12px; }
      .ct-brand-btn { width: 100%; background: none; border: none; cursor: pointer; font-family: inherit; text-align: left; border-radius: 12px; }
      .ct-brand-btn:hover { background: var(--bg-panel-2); }
      .ct-brand-chevron { margin-left: auto; color: var(--chalk-dim); flex-shrink: 0; }
      .ct-brand-mark { font-size: 28px; }
      .ct-brand-title { font-family: 'Oswald', sans-serif; font-weight: 700; font-size: 16px; text-transform: uppercase; letter-spacing: 0.5px; line-height: 1.25; color: var(--floodlight); }
      .ct-brand-sub { font-size: 11.5px; color: var(--chalk-dim); margin-top: 2px; }
      .ct-switcher-row-active { border-color: var(--floodlight); }
      .ct-nav { display: flex; flex-direction: column; gap: 3px; flex: 1; }
      .ct-nav-item {
        display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 8px;
        background: none; border: none; color: var(--chalk-dim); font-size: 13.5px; cursor: pointer; text-align: left;
        font-family: inherit; font-weight: 500; transition: background .15s, color .15s;
      }
      .ct-nav-item:hover { background: var(--bg-panel-2); color: var(--chalk); }
      .ct-nav-item-active { background: var(--pitch); color: #fff; }
      .ct-save-indicator { font-size: 10.5px; color: var(--chalk-dim); padding: 10px 6px 0; border-top: 1px solid var(--border); margin-top: 10px; }
      .ct-overlay-launch { border-color: var(--floodlight); color: var(--floodlight); margin-top: 6px; }

      .ct-scene-checklist { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; }
      @media (max-width: 900px) { .ct-scene-checklist { grid-template-columns: 1fr; } }
      .ct-scene-checklist-1col { grid-template-columns: 1fr; }
      .ct-scene-check-row {
        display: flex; align-items: center; gap: 7px; padding: 8px 9px; border-radius: 8px;
        background: var(--bg); border: 1px solid var(--border); font-size: 12.5px; cursor: pointer;
        line-height: 1.25;
      }
      .ct-scene-check-active { border-color: var(--floodlight); background: rgba(242,169,59,0.08); color: var(--floodlight); }
      .ct-preview-frame {
        background: #050708; border: 1px solid var(--border); border-radius: 10px; min-height: 220px;
        display: flex; align-items: center; justify-content: center; padding: 14px; overflow: hidden;
      }
      .ct-preview-frame-stack { flex-direction: column; gap: 12px; overflow-y: auto; max-height: 520px; }
      .ct-preview-frame .ct-scene { transform: scale(0.6); }
      .ct-preview-scene-item { display: flex; justify-content: center; }
      .ct-preview-note { color: var(--chalk-dim); font-size: 12.5px; text-align: center; padding: 10px; }
      .ct-toss-info-line { display: flex; align-items: center; gap: 7px; font-size: 12.5px; color: var(--floodlight); margin-top: 10px; }

      .ct-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
      .ct-topbar { display: none; align-items: center; gap: 10px; padding: 14px 18px; border-bottom: 1px solid var(--border); }
      .ct-topbar-title { font-family: 'Oswald', sans-serif; text-transform: uppercase; font-size: 15px; letter-spacing: .5px; }
      .ct-content { padding: 22px; flex: 1; }

      .ct-hide-desktop { display: none; }

      @media (max-width: 860px) {
        .ct-sidebar { position: fixed; z-index: 40; height: 100vh; transform: translateX(-100%); transition: transform .2s; }
        .ct-sidebar-open { transform: translateX(0); }
        .ct-topbar { display: flex; }
        .ct-hide-desktop { display: inline-flex; }
        .ct-content { padding: 14px; }
      }

      .ct-stack { display: flex; flex-direction: column; gap: 16px; }
      .ct-stack-sm { display: flex; flex-direction: column; gap: 8px; }
      .ct-row-between { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
      .ct-row-gap { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
      .ct-section-label { font-family: 'Oswald', sans-serif; text-transform: uppercase; font-size: 18px; letter-spacing: .4px; }

      .ct-card { background: var(--bg-panel); border: 1px solid var(--border); border-radius: 12px; padding: 16px; }
      .ct-card-title { font-family: 'Oswald', sans-serif; font-size: 13px; text-transform: uppercase; letter-spacing: .5px; color: var(--floodlight); margin-bottom: 10px; }
      .ct-mt { margin-top: 16px; }

      .ct-bc-toggle-btn {
        width: 100%; background: none; border: none; cursor: pointer; color: inherit; padding: 0;
        font: inherit; display: flex; align-items: center; justify-content: space-between;
      }
      .ct-bc-panel { margin-top: 4px; }

      .ct-live-scoring-layout { display: grid; grid-template-columns: 320px 1fr; gap: 16px; align-items: start; }
      .ct-live-scoring-side { position: sticky; top: 14px; max-height: calc(100vh - 28px); overflow-y: auto; display: flex; flex-direction: column; gap: 16px; }
      .ct-live-scoring-main { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
      @media (max-width: 980px) {
        .ct-live-scoring-layout { grid-template-columns: 1fr; }
        .ct-live-scoring-side { position: static; max-height: none; }
      }

      .ct-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
      .ct-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
      .ct-grid-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 14px; }
      @media (max-width: 700px) { .ct-grid-2, .ct-grid-3 { grid-template-columns: 1fr; } }

      .ct-stat-card { background: var(--bg-panel); border: 1px solid var(--border); border-radius: 12px; padding: 16px; text-align: center; }
      .ct-stat-num { font-family: 'JetBrains Mono', monospace; font-size: 28px; color: var(--floodlight); font-weight: 700; }
      .ct-stat-label { font-size: 11px; color: var(--chalk-dim); text-transform: uppercase; letter-spacing: .5px; margin-top: 2px; }

      .ct-live-banner {
        display: flex; align-items: center; gap: 10px; background: linear-gradient(90deg, var(--pitch), var(--bg-panel));
        cursor: pointer; font-family: 'Oswald', sans-serif; text-transform: uppercase; letter-spacing: .5px; font-size: 13.5px;
      }
      .ct-live-dot { width: 9px; height: 9px; border-radius: 50%; background: var(--danger); animation: ct-pulse 1.2s infinite; }
      @keyframes ct-pulse { 0%,100% { opacity: 1; } 50% { opacity: .3; } }

      .ct-table { width: 100%; border-collapse: collapse; font-size: 13px; }
      .ct-table th { text-align: left; color: var(--chalk-dim); font-weight: 500; font-size: 11px; text-transform: uppercase; padding: 6px 8px; border-bottom: 1px solid var(--border); }
      .ct-table td { padding: 7px 8px; border-bottom: 1px solid var(--border); }
      .ct-table tr:last-child td { border-bottom: none; }

      .ct-result-row { display: flex; align-items: center; justify-content: space-between; font-size: 13px; padding: 6px 2px; }
      .ct-result-note { color: var(--chalk-dim); font-size: 12px; }

      .ct-empty { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px; padding: 30px 10px; color: var(--chalk-dim); }
      .ct-empty-title { font-size: 14px; color: var(--chalk); font-weight: 600; }
      .ct-empty-sub { font-size: 12.5px; max-width: 320px; }

      .ct-btn {
        display: inline-flex; align-items: center; justify-content: center; gap: 6px; border-radius: 8px; border: 1px solid var(--border);
        background: var(--bg-panel-2); color: var(--chalk); padding: 9px 14px; font-size: 13px; cursor: pointer; font-family: inherit; font-weight: 600;
        transition: background .15s, opacity .15s; white-space: nowrap;
      }
      .ct-btn:hover { background: #29343E; }
      .ct-btn:disabled { opacity: .4; cursor: not-allowed; }
      .ct-btn-primary { background: var(--floodlight); border-color: var(--floodlight); color: #1A1204; }
      .ct-btn-primary:hover { background: var(--floodlight-dim); }
      .ct-btn-ghost { background: transparent; }
      .ct-btn-danger { background: var(--danger); border-color: var(--danger); color: #fff; }
      .ct-btn-penalty { background: rgba(217,86,79,0.14); border-color: var(--danger); color: var(--danger); }
      .ct-btn-penalty:hover { background: rgba(217,86,79,0.28); }
      .ct-btn-block { width: 100%; margin-top: 14px; }
      .ct-btn-sm { padding: 6px 10px; font-size: 12px; }

      .ct-icon-btn { background: none; border: none; color: var(--chalk-dim); cursor: pointer; padding: 6px; border-radius: 6px; display: inline-flex; }
      .ct-icon-btn:hover { background: var(--bg-panel-2); color: var(--chalk); }

      .ct-field-label { display: block; font-size: 11.5px; text-transform: uppercase; letter-spacing: .4px; color: var(--chalk-dim); margin: 12px 0 5px; }
      .ct-input {
        width: 100%; background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 10px 11px;
        color: var(--chalk); font-size: 13.5px; font-family: inherit;
      }
      .ct-input:focus { outline: none; border-color: var(--floodlight); }
      .ct-input-sm { width: auto; }
      .ct-textarea { resize: vertical; min-height: 120px; line-height: 1.5; font-family: 'JetBrains Mono', monospace; font-size: 12.5px; }
      .ct-check-row { display: flex; align-items: center; gap: 8px; font-size: 13px; margin-top: 14px; color: var(--chalk-dim); }
      .ct-color-row { display: flex; gap: 9px; align-items: center; flex-wrap: wrap; margin-top: 4px; }
      .ct-color-swatch { width: 26px; height: 26px; border-radius: 50%; border: 2px solid transparent; cursor: pointer; padding: 0; }
      .ct-color-swatch-active { border-color: var(--floodlight); box-shadow: 0 0 0 2px var(--bg-panel); }
      .ct-color-custom { width: 28px; height: 28px; border: 1px solid var(--border); background: none; padding: 0; cursor: pointer; border-radius: 50%; overflow: hidden; }

      .ct-modal-backdrop { position: fixed; inset: 0; background: rgba(6,9,11,.72); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 16px; }
      .ct-modal { background: var(--bg-panel); border: 1px solid var(--border); border-radius: 14px; width: 380px; max-width: 100%; max-height: 86vh; overflow-y: auto; }
      .ct-modal-wide { width: 520px; }
      .ct-modal-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid var(--border); font-family: 'Oswald', sans-serif; text-transform: uppercase; font-size: 13.5px; letter-spacing: .4px; }
      .ct-modal-body { padding: 16px; }

      .ct-team-card { display: flex; flex-direction: column; gap: 6px; }
      .ct-team-badge-row { display: flex; align-items: center; gap: 8px; }
      .ct-team-badge { width: 40px; height: 40px; border-radius: 8px; background: var(--pitch); display: flex; align-items: center; justify-content: center; font-family: 'JetBrains Mono', monospace; font-weight: 700; font-size: 12px; color: #fff; }
      .ct-team-logo-preview { width: 44px; height: 44px; border-radius: 10px; object-fit: cover; flex-shrink: 0; }
      .ct-team-logo-preview-empty { display: flex; align-items: center; justify-content: center; font-family: 'JetBrains Mono', monospace; font-weight: 700; font-size: 13px; color: #fff; }
      .ct-team-name { font-weight: 600; font-size: 14.5px; margin-top: 4px; }
      .ct-team-players-count { font-size: 12px; color: var(--chalk-dim); margin-bottom: 6px; }

      .ct-player-list { display: flex; flex-direction: column; gap: 4px; margin-top: 14px; max-height: 260px; overflow-y: auto; }
      .ct-player-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 7px 8px; border-radius: 6px; background: var(--bg); font-size: 13px; }
      .ct-player-pick-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 10px; border-radius: 8px; background: var(--bg); border: 1px solid var(--border); font-size: 13.5px; color: var(--chalk); cursor: pointer; margin-bottom: 6px; width: 100%; font-family: inherit; }
      .ct-player-pick-row:hover { border-color: var(--floodlight); }
      .ct-tag { font-size: 10.5px; background: var(--bg-panel-2); padding: 3px 7px; border-radius: 5px; color: var(--chalk-dim); }
      .ct-tag-active { background: var(--floodlight); color: #1A1204; }
      .ct-muted-note { color: var(--chalk-dim); font-size: 12.5px; padding: 10px 0; }

      .ct-match-row { display: flex; align-items: center; gap: 14px; }
      .ct-match-num { font-family: 'JetBrains Mono', monospace; color: var(--chalk-dim); font-size: 12px; width: 30px; }
      .ct-match-teams { flex: 1; font-size: 13.5px; }

      .ct-setup-match-card { max-width: 420px; }
      .ct-vs-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
      .ct-vs-team { font-family: 'Oswald', sans-serif; font-size: 15px; text-transform: uppercase; }
      .ct-vs-divider { color: var(--chalk-dim); font-size: 12px; }
      .ct-toggle-row { display: flex; gap: 8px; margin-top: 4px; }
      .ct-toggle { flex: 1; padding: 9px; border-radius: 8px; border: 1px solid var(--border); background: var(--bg); color: var(--chalk-dim); cursor: pointer; font-family: inherit; font-size: 13px; font-weight: 600; }
      .ct-toggle-active { background: var(--floodlight); color: #1A1204; border-color: var(--floodlight); }
      .ct-warning-note { display: flex; align-items: center; gap: 8px; color: var(--floodlight); font-size: 12.5px; background: rgba(242,169,59,0.08); border: 1px solid rgba(242,169,59,0.3); padding: 10px; border-radius: 8px; margin: 10px 0; }

      .ct-poll-control { margin-top: 4px; }
      .ct-poll-control-labels { display: flex; justify-content: space-between; font-size: 12px; color: var(--chalk-dim); margin-bottom: 6px; font-family: 'JetBrains Mono', monospace; }
      .ct-poll-slider { width: 100%; accent-color: var(--floodlight); cursor: pointer; }

      .ct-captain-row { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
      .ct-captain-avatar { width: 30px; height: 30px; border-radius: 50%; object-fit: cover; border: 2px solid var(--floodlight); flex-shrink: 0; }
      .ct-captain-avatar-fallback { width: 30px; height: 30px; border-radius: 50%; background: var(--pitch); display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; flex-shrink: 0; border: 2px solid var(--floodlight); }
      .ct-photo-upload-btn { width: 22px; height: 22px; border-radius: 50%; background: var(--bg-panel-2); border: 1px solid var(--border); display: inline-flex; align-items: center; justify-content: center; cursor: pointer; color: var(--chalk-dim); flex-shrink: 0; }
      .ct-photo-upload-btn:hover { color: var(--floodlight); border-color: var(--floodlight); }
      .ct-captain-star-btn { background: none; border: none; cursor: pointer; color: var(--chalk-dim); display: inline-flex; padding: 2px; flex-shrink: 0; }
      .ct-captain-star-btn.ct-captain-star-active { color: var(--floodlight); }
      .ct-player-avatar { width: 24px; height: 24px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
      .ct-player-avatar-fallback { width: 24px; height: 24px; border-radius: 50%; background: var(--bg-panel-2); display: flex; align-items: center; justify-content: center; font-size: 9.5px; font-weight: 700; color: var(--chalk-dim); flex-shrink: 0; }

      .ct-scoreboard { background: linear-gradient(180deg, #151D22, #10161A); border: 1px solid var(--border); border-radius: 14px; padding: 18px; }
      .ct-scoreboard-teams { font-family: 'Oswald', sans-serif; text-transform: uppercase; font-size: 12.5px; color: var(--chalk-dim); letter-spacing: .5px; margin-bottom: 10px; }
      .ct-digit-row { display: flex; gap: 10px; flex-wrap: wrap; }
      .ct-digit-tile { background: #050708; border: 1px solid var(--border); border-radius: 8px; padding: 10px 16px; text-align: center; min-width: 78px; }
      .ct-digit-value { font-family: 'JetBrains Mono', monospace; font-size: 26px; color: var(--floodlight); font-weight: 700; letter-spacing: 1px; }
      .ct-digit-label { font-size: 9.5px; color: var(--chalk-dim); letter-spacing: .8px; margin-top: 2px; }
      .ct-target-note { margin-top: 10px; font-size: 12.5px; color: var(--chalk-dim); }
      .ct-this-over { display: flex; gap: 6px; margin-top: 14px; flex-wrap: wrap; align-items: center; }
      .ct-ball-chip { width: 28px; height: 28px; border-radius: 50%; background: var(--bg-panel-2); display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 600; font-family: 'JetBrains Mono', monospace; border: 1px solid var(--border); }
      .ct-ball-wicket { background: var(--danger); color: #fff; border-color: var(--danger); }
      .ct-ball-extra { border-color: var(--floodlight); color: var(--floodlight); }
      .ct-ball-nb { border-color: #D9A8E0; color: #D9A8E0; font-weight: 700; }
      .ct-ball-wd { border-color: var(--chalk-dim); color: var(--chalk-dim); }
      .ct-ball-4 {
        width: 32px; height: 32px; font-size: 12.5px; font-weight: 700; border-radius: 50%;
        background: #3E8FB0; border-color: #3E8FB0; color: #fff; box-shadow: 0 0 10px rgba(62,143,176,0.5);
      }
      .ct-ball-6 {
        width: 34px; height: 34px; font-size: 13.5px; font-weight: 700; border-radius: 50%;
        background: var(--floodlight); border-color: var(--floodlight); color: #1A1204; box-shadow: 0 0 12px rgba(242,169,59,0.6);
      }
      .ct-ball-penalty { border-color: var(--danger); color: var(--danger); background: rgba(217,86,79,0.14); font-weight: 700; }

      .ct-player-stat-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 2px; font-size: 13.5px; border-bottom: 1px solid var(--border); }
      .ct-player-stat-row:last-child { border-bottom: none; }
      .ct-mono { font-family: 'JetBrains Mono', monospace; color: var(--chalk-dim); font-size: 12.5px; }

      .ct-scoring-pad { }
      .ct-run-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; margin-bottom: 12px; }
      .ct-run-btn { aspect-ratio: 1; border-radius: 10px; border: 1px solid var(--border); background: var(--bg-panel-2); color: var(--chalk); font-family: 'JetBrains Mono', monospace; font-size: 17px; font-weight: 700; cursor: pointer; }
      .ct-run-btn:hover { background: var(--pitch); border-color: var(--pitch); }
      .ct-run-btn-boundary { color: var(--floodlight); }
      .ct-extra-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(90px, 1fr)); gap: 8px; }
      @media (max-width: 600px) { .ct-extra-grid { grid-template-columns: repeat(2, 1fr); } .ct-run-grid { grid-template-columns: repeat(4, 1fr); } }

      .ct-result-banner { display: flex; align-items: center; gap: 8px; font-family: 'Oswald', sans-serif; text-transform: uppercase; font-size: 15px; color: var(--floodlight); }
      .ct-dismissal-note { font-size: 11px; color: var(--chalk-dim); }
      .ct-extras-line { font-size: 12px; color: var(--chalk-dim); margin-top: 6px; }
      .ct-fow { font-size: 12px; color: var(--chalk-dim); margin-top: 12px; line-height: 1.6; }

      @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap');
    `}</style>
    </>
  );
}