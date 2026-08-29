import { ballsToOverStr, oversFloatForNRR, playerName } from './utils';

export function computeInningsStats(innings, teams) {
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
      batsmen[outId].howOut = { 
        type: b.wicketType, 
        bowlerId: b.wicketType === "Run Out" ? null : b.bowlerId, 
        fielder: b.fielderNote || null 
      };
      if (b.wicketType !== "Run Out" && b.wicketType !== "Retired Hurt") bowlerRec.wickets += 1;
      fow.push({ 
        score: totalRuns, 
        wicketNum: totalWickets, 
        batsmanId: outId, 
        overStr: ballsToOverStr(validBalls) 
      });
    }
  });

  return {
    battingTeam,
    bowlingTeam,
    batsmen,
    bowlers,
    fow,
    totalRuns: totalRuns + (innings.runAdjustment || 0),
    totalWickets,
    validBalls,
    extras,
    battingOrder,
    runAdjustment: innings.runAdjustment || 0,
    oversStr: ballsToOverStr(validBalls),
    runRate: validBalls > 0 ? ((totalRuns + (innings.runAdjustment || 0)) / (validBalls / 6)).toFixed(2) : "0.00",
  };
}

export function computePointsTable(tournament, teamIds) {
  const scope = teamIds ? tournament.teams.filter((t) => teamIds.includes(t.id)) : tournament.teams;
  const table = {};
  scope.forEach((t) => {
    table[t.id] = {
      teamId: t.id,
      played: 0,
      won: 0,
      lost: 0,
      tied: 0,
      noResult: 0,
      points: 0,
      runsFor: 0,
      oversFor: 0,
      runsAgainst: 0,
      oversAgainst: 0,
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
      if (table[m.result.winnerId]) { 
        table[m.result.winnerId].won += 1; 
        table[m.result.winnerId].points += 2; 
      }
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

export function computeManhattan(innings) {
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

export function aggregateMatchPerformers(match, teams) {
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

export function getPlayerInningsBattingStats(match, teams, playerId) {
  for (const inn of match.innings || []) {
    if (!inn) continue;
    const s = computeInningsStats(inn, teams);
    if (s.batsmen[playerId]) return s.batsmen[playerId];
  }
  return null;
}

export function getPlayerInningsBowlingStats(match, teams, playerId) {
  for (const inn of match.innings || []) {
    if (!inn) continue;
    const s = computeInningsStats(inn, teams);
    if (s.bowlers[playerId]) return s.bowlers[playerId];
  }
  return null;
}

export function aggregatePlayerStats(tournament) {
  const runsMap = {};
  const wicketsMap = {};
  
  tournament.matches.forEach((m) => {
    (m.innings || []).forEach((inn) => {
      if (!inn) return;
      const stats = computeInningsStats(inn, tournament.teams);
      Object.values(stats.batsmen).forEach((b) => {
        if (!runsMap[b.id]) {
          runsMap[b.id] = { 
            id: b.id, 
            name: playerName(tournament.teams, b.id), 
            runs: 0, 
            balls: 0, 
            fours: 0, 
            sixes: 0, 
            matches: new Set() 
          };
        }
        runsMap[b.id].runs += b.runs;
        runsMap[b.id].balls += b.balls;
        runsMap[b.id].fours += b.fours;
        runsMap[b.id].sixes += b.sixes;
        runsMap[b.id].matches.add(m.id);
      });
      Object.values(stats.bowlers).forEach((b) => {
        if (!wicketsMap[b.id]) {
          wicketsMap[b.id] = { 
            id: b.id, 
            name: playerName(tournament.teams, b.id), 
            wickets: 0, 
            runs: 0, 
            balls: 0, 
            matches: new Set() 
          };
        }
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