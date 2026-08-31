import React, { useState, useEffect } from 'react';
import { ChevronLeft, RotateCcw, Plus, Minus, Radio, AlertTriangle } from 'lucide-react';
import { Modal, DigitTile, EmptyState, InlineBroadcastControl } from '../components/SharedComponents';
import { uid, teamShort, playerName, WICKET_TYPES, teamName, ballsToOverStr, initials } from '../lib/utils';
import { computeInningsStats } from '../lib/cricketMath';
import { FullScorecard } from './ScorecardsPage';

export default function ScoringPage({ 
  tournament, 
  patch, 
  activeMatchId, 
  setActiveMatchId, 
  broadcast, 
  setBroadcast, 
  broadcastLoading 
}) {
  const match = tournament.matches.find((m) => m.id === activeMatchId);

  if (!match) {
    const selectable = tournament.matches.filter((m) => m.status !== 'completed');
    return (
      <div className="ct-stack">
        <div className="ct-section-label">Select a match to score</div>
        {selectable.length === 0 ? (
          <EmptyState 
            icon={<Radio size={32} />} 
            title="No matches available" 
            sub="Add fixtures first, from the Fixtures tab." 
          />
        ) : (
          <div className="ct-stack-sm">
            {selectable.map((m) => (
              <div className="ct-card ct-match-row" key={m.id}>
                <div className="ct-match-teams">
                  <b>{teamShort(tournament.teams, m.teamAId)}</b> vs <b>{teamShort(tournament.teams, m.teamBId)}</b>
                  <div className="ct-muted-note">{m.oversLimit} overs · {m.status}</div>
                </div>
                <button className="ct-btn ct-btn-primary ct-btn-sm" onClick={() => setActiveMatchId(m.id)}>
                  Open
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (match.status === 'upcoming') {
    return <MatchStartPanel tournament={tournament} match={match} patch={patch} />;
  }
  if (match.status === 'completed') {
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
    <div className="ct-captain-row" style={align === 'right' ? { flexDirection: 'row-reverse' } : undefined}>
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
  const [tossChoice, setTossChoice] = useState('bat');
  const [venue, setVenue] = useState(match.venue || '');
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
      m.playingXI = { 
        [match.teamAId]: xiA.length ? xiA : (teamA?.players || []).map((p) => p.id), 
        [match.teamBId]: xiB.length ? xiB : (teamB?.players || []).map((p) => p.id) 
      };
      const battingFirst = (tossChoice === 'bat') ? tossWinner : (tossWinner === m.teamAId ? m.teamBId : m.teamAId);
      const bowlingFirst = battingFirst === m.teamAId ? m.teamBId : m.teamAId;
      m.innings[0] = {
        id: uid('innings'),
        matchId: m.id,
        inningsNum: 0,
        battingTeamId: battingFirst,
        bowlingTeamId: bowlingFirst,
        balls: [],
        currentStrikerId: null,
        currentNonStrikerId: null,
        currentBowlerId: null,
        previousBowlerId: null,
        isComplete: false,
        target: null,
        runAdjustment: 0,
      };
      m.status = 'live';
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
          <div className="ct-warning-note">
            <AlertTriangle size={15} /> Both teams need at least 2 players in their squad before you can start.
          </div>
        )}
        <label className="ct-field-label">Venue (shows on broadcast graphics)</label>
        <input 
          className="ct-input" 
          value={venue} 
          onChange={(e) => setVenue(e.target.value)} 
          placeholder="e.g. Shahkot Cricket Ground" 
        />
        <label className="ct-field-label">Toss won by</label>
        <select className="ct-input" value={tossWinner} onChange={(e) => setTossWinner(e.target.value)}>
          <option value={match.teamAId}>{teamA?.name}</option>
          <option value={match.teamBId}>{teamB?.name}</option>
        </select>
        <label className="ct-field-label">Elected to</label>
        <div className="ct-toggle-row">
          <button 
            className={`ct-toggle${tossChoice === 'bat' ? ' ct-toggle-active' : ''}`} 
            onClick={() => setTossChoice('bat')}
          >
            Bat
          </button>
          <button 
            className={`ct-toggle${tossChoice === 'bowl' ? ' ct-toggle-active' : ''}`} 
            onClick={() => setTossChoice('bowl')}
          >
            Bowl
          </button>
        </div>
        <button className="ct-btn ct-btn-primary ct-btn-block" disabled={!canStart} onClick={startMatch}>
          Start Match →
        </button>
      </div>

      {canStart && (
        <div className="ct-grid-2">
          <div className="ct-card">
            <div className="ct-card-title">Playing XI — {teamA?.name}</div>
            <div className="ct-muted-note">Tick who's playing (for the lineup overlay).</div>
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
            <div className="ct-muted-note">Tick who's playing (for the lineup overlay).</div>
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

function LiveScoringPanel({ tournament, match, patch, onBack, broadcast, setBroadcast, broadcastLoading }) {
  const inningsIdx = match.currentInnings;
  let innings = match.innings[inningsIdx];
  
  // Recovery: If innings is missing but the match is live, try to reconstruct it
  if (!innings && match.status === 'live') {
    // If second innings is missing, we might need to reconstruct it from the first innings
    if (inningsIdx === 1 && match.innings[0]) {
      // Reconstruct the second innings from the first innings data
      const firstInnings = match.innings[0];
      const battingTeamId = firstInnings.bowlingTeamId;
      const bowlingTeamId = firstInnings.battingTeamId;
      const target = firstInnings.totalRuns + 1;
      
      // Create the innings in memory
      match.innings[1] = {
        id: uid('innings'),
        matchId: match.id,
        inningsNum: 1,
        battingTeamId: battingTeamId,
        bowlingTeamId: bowlingTeamId,
        balls: [],
        currentStrikerId: null,
        currentNonStrikerId: null,
        currentBowlerId: null,
        previousBowlerId: null,
        isComplete: false,
        target: target,
        runAdjustment: 0,
        totalRuns: 0,
        totalWickets: 0,
        validBalls: 0,
      };
      innings = match.innings[1];
      
      // Patch the tournament to save this reconstruction
      patch((t) => {
        const m = t.matches.find((x) => x.id === match.id);
        m.innings[1] = match.innings[1];
        return t;
      });
    }
  }

  // Hooks must run unconditionally on every render, so these are declared
  // before any early return, and guarded internally against `innings`
  // being missing.
  const [openBatsmanPicker, setOpenBatsmanPicker] = useState(null);
  const [openBowlerPicker, setOpenBowlerPicker] = useState(false);
  const [wicketModal, setWicketModal] = useState(false);
  const [pendingExtra, setPendingExtra] = useState(null);

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

  // Defensive guard: this should never happen once the save/load path is
  // consistent, but if it ever does (partial save, manual DB edit, a bad
  // reload mid-write), show a recoverable message instead of crashing
  // the whole app with "Cannot read properties of undefined".
  if (!innings) {
    return (
      <div className="ct-stack">
        <button className="ct-btn ct-btn-ghost ct-btn-sm" onClick={onBack}>
          <ChevronLeft size={15} /> Matches
        </button>
        <div className="ct-card ct-warning-note">
          <AlertTriangle size={15} />
          {' '}This match is marked as on innings {inningsIdx + 1}, but that innings hasn't
          been saved yet. Try reloading the page. If this keeps happening, this match's
          data may need a manual reset (see console/DB for match id {match.id}).
        </div>
      </div>
    );
  }

  const battingTeam = tournament.teams.find((t) => t.id === innings.battingTeamId);
  const bowlingTeam = tournament.teams.find((t) => t.id === innings.bowlingTeamId);
  const stats = computeInningsStats(innings, tournament.teams);

  const needsStriker = !innings.currentStrikerId;
  const needsNonStriker = !innings.currentNonStrikerId;
  const needsBowler = !innings.currentBowlerId;

  const target = innings.target;
  const isSecondInnings = inningsIdx === 1;
  const runsNeeded = target ? target - stats.totalRuns : null;
  const ballsLeft = match.oversLimit * 6 - stats.validBalls;

  const commitBall = (ballPatch) => {
    patch((t) => {
      const m = t.matches.find((x) => x.id === match.id);
      const inn = m.innings[inningsIdx];
      const beforeStats = computeInningsStats(inn, t.teams);
      const striker = inn.currentStrikerId;
      const nonStriker = inn.currentNonStrikerId;
      const bowler = inn.currentBowlerId;

      const ball = {
        id: uid('ball'),
        inningsId: inn.id,
        ballIndex: inn.balls.length,
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
      } else if (ball.extra === 'nb' || ball.extra === 'wd') {
        rotate = (ball.runsBat || 0) % 2 === 1 && ball.extra === 'nb' ? true : ((ball.extraRuns || 0) % 2 === 1);
        if (ball.extra === 'nb') rotate = (ball.runsBat || 0) % 2 === 1;
      } else if (ball.extra === 'penalty') {
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
      const overNowComplete = afterStats.validBalls > 0 && afterStats.validBalls % 6 === 0 && ball.extra !== 'wd' && ball.extra !== 'nb';
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
            id: uid('innings'),
            matchId: m.id,
            inningsNum: 1,
            battingTeamId: secondBatting,
            bowlingTeamId: secondBowling,
            balls: [],
            currentStrikerId: null,
            currentNonStrikerId: null,
            currentBowlerId: null,
            previousBowlerId: null,
            isComplete: false,
            target: afterStats.totalRuns + 1,
            runAdjustment: 0,
          };
          m.currentInnings = 1;
        } else {
          const s1 = computeInningsStats(m.innings[0], t.teams);
          const s2 = computeInningsStats(m.innings[1], t.teams);
          let result;
          if (s1.totalRuns === s2.totalRuns) {
            result = { type: 'tie', summary: 'Match tied' };
          } else {
            const winnerId = s2.totalRuns > s1.totalRuns ? m.innings[1].battingTeamId : m.innings[0].battingTeamId;
            const winnerName = t.teams.find((x) => x.id === winnerId)?.name;
            if (s2.totalRuns > s1.totalRuns) {
              const wicketsInHand = t.teams.find((x) => x.id === m.innings[1].battingTeamId).players.length - 1 - s2.totalWickets;
              result = { type: 'win', winnerId, summary: `${winnerName} won by ${wicketsInHand} wicket${wicketsInHand === 1 ? '' : 's'}` };
            } else {
              const margin = s1.totalRuns - s2.totalRuns;
              result = { type: 'win', winnerId, summary: `${winnerName} won by ${margin} run${margin === 1 ? '' : 's'}` };
            }
          }
          m.result = result;
          m.status = 'completed';
        }
      }
      return t;
    });
  };

  const scoreRun = (runs) => {
    if (pendingExtra === 'wd') {
      commitBall({ extra: 'wd', extraRuns: runs });
      setPendingExtra(null);
      return;
    }
    if (pendingExtra === 'nb') {
      commitBall({ extra: 'nb', runsBat: runs });
      setPendingExtra(null);
      return;
    }
    if (pendingExtra === 'b') {
      commitBall({ extra: 'b', extraRuns: runs || 1 });
      setPendingExtra(null);
      return;
    }
    if (pendingExtra === 'lb') {
      commitBall({ extra: 'lb', extraRuns: runs || 1 });
      setPendingExtra(null);
      return;
    }
    commitBall({ runsBat: runs });
  };

  const applyOutPenalty = () => {
    commitBall({ runsBat: -2, extra: 'penalty', extraRuns: 0 });
  };

  const applyScoreCorrection = (delta) => {
    patch((t) => {
      const m = t.matches.find((x) => x.id === match.id);
      const inn = m.innings[inningsIdx];
      inn.runAdjustment = (inn.runAdjustment || 0) + delta;
      return t;
    });
  };

  const confirmWicket = (wicketType, outWho, fielderNote, runsCompleted) => {
    const outId = outWho === 'striker' ? innings.currentStrikerId : innings.currentNonStrikerId;
    commitBall({
      isWicket: true,
      wicketType,
      outBatsmanId: outId,
      fielderNote: fielderNote || null,
      runsBat: wicketType === 'Run Out' ? (runsCompleted || 0) : 0,
    });
    setWicketModal(false);
  };

  const undoLastBall = () => {
    if (!window.confirm('Undo the last ball?')) return;
    patch((t) => {
      const m = t.matches.find((x) => x.id === match.id);
      const inn = m.innings[inningsIdx];
      if (inn.balls.length === 0) return t;
      inn.balls.pop();
      inn.currentStrikerId = null;
      inn.currentNonStrikerId = null;
      inn.currentBowlerId = null;
      inn.isComplete = false;
      if (m.status === 'completed') { m.status = 'live'; m.result = null; }
      return t;
    });
  };

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
        <button className="ct-btn ct-btn-ghost ct-btn-sm" onClick={onBack}>
          <ChevronLeft size={15} /> Matches
        </button>
        <div className="ct-row-gap">
          <button
            className="ct-btn ct-btn-ghost ct-btn-sm"
            onClick={swapBatsmen}
            disabled={!innings.currentStrikerId || !innings.currentNonStrikerId}
            title="Manually swap striker and non-striker anytime"
          >
            <RotateCcw size={14} style={{ transform: 'scaleX(-1)' }} /> Swap Batsmen
          </button>
          <button className="ct-btn ct-btn-ghost ct-btn-sm" onClick={undoLastBall}>
            <RotateCcw size={14} /> Undo Last Ball
          </button>
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
            <div className="ct-scoreboard-teams">
              {teamShort(tournament.teams, battingTeam.id)} batting · vs {teamShort(tournament.teams, bowlingTeam.id)}
            </div>
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
                const isFour = (!b.extra && b.runsBat === 4) || (b.extra === 'nb' && b.runsBat === 4);
                const isSix = (!b.extra && b.runsBat === 6) || (b.extra === 'nb' && b.runsBat === 6);
                return (
                  <span
                    key={i}
                    className={
                      'ct-ball-chip' +
                      (b.isWicket ? ' ct-ball-wicket' : '') +
                      (b.extra ? ' ct-ball-extra' : '') +
                      (b.extra === 'nb' ? ' ct-ball-nb' : '') +
                      (b.extra === 'wd' ? ' ct-ball-wd' : '') +
                      (isFour ? ' ct-ball-4' : '') +
                      (isSix ? ' ct-ball-6' : '') +
                      (b.extra === 'penalty' ? ' ct-ball-penalty' : '')
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
                  {innings.runAdjustment > 0 ? '+' : ''}{innings.runAdjustment} applied
                </span>
              )}
            </div>
            <div className="ct-muted-note">
              Fixes the total score directly for scoring mistakes — this is not a delivery, so it never
              appears in the this-over strip and never affects any batter's or bowler's figures.
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
              <BatterRow 
                label="Striker *" 
                id={innings.currentStrikerId} 
                stats={stats} 
                tournament={tournament} 
                onPick={() => setOpenBatsmanPicker('striker')} 
              />
              <BatterRow 
                label="Non-striker" 
                id={innings.currentNonStrikerId} 
                stats={stats} 
                tournament={tournament} 
                onPick={() => setOpenBatsmanPicker('nonstriker')} 
              />
            </div>
            <div className="ct-card">
              <div className="ct-card-title">Bowling</div>
              <BowlerRow 
                id={innings.currentBowlerId} 
                stats={stats} 
                tournament={tournament} 
                onPick={() => setOpenBowlerPicker(true)} 
              />
            </div>
          </div>

          {(needsStriker || needsNonStriker || needsBowler) ? (
            <div className="ct-card ct-warning-note">
              <AlertTriangle size={15} />
              {needsBowler && ' Select a bowler '}
              {(needsStriker || needsNonStriker) && ' Select batsmen '}
              to continue scoring.
            </div>
          ) : (
            <div className="ct-card ct-scoring-pad">
              <div className="ct-card-title">
                Runs {pendingExtra && <span className="ct-tag ct-tag-active">{extraLongLabel(pendingExtra)} — enter runs</span>}
              </div>
              <div className="ct-run-grid">
                {[0, 1, 2, 3, 4, 5, 6].map((r) => (
                  <button 
                    key={r} 
                    className={`ct-run-btn${r === 4 || r === 6 ? ' ct-run-btn-boundary' : ''}`} 
                    onClick={() => scoreRun(r)}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <div className="ct-extra-grid">
                <button 
                  className={`ct-btn ct-btn-ghost${pendingExtra === 'wd' ? ' ct-toggle-active' : ''}`} 
                  onClick={() => setPendingExtra(pendingExtra === 'wd' ? null : 'wd')}
                >
                  Wide
                </button>
                <button 
                  className={`ct-btn ct-btn-ghost${pendingExtra === 'nb' ? ' ct-toggle-active' : ''}`} 
                  onClick={() => setPendingExtra(pendingExtra === 'nb' ? null : 'nb')}
                >
                  No Ball
                </button>
                <button 
                  className={`ct-btn ct-btn-ghost${pendingExtra === 'b' ? ' ct-toggle-active' : ''}`} 
                  onClick={() => setPendingExtra(pendingExtra === 'b' ? null : 'b')}
                >
                  Bye
                </button>
                <button 
                  className={`ct-btn ct-btn-ghost${pendingExtra === 'lb' ? ' ct-toggle-active' : ''}`} 
                  onClick={() => setPendingExtra(pendingExtra === 'lb' ? null : 'lb')}
                >
                  Leg Bye
                </button>
                <button className="ct-btn ct-btn-danger" onClick={() => setWicketModal(true)}>
                  Wicket
                </button>
                {tournament.isDoubleWicket && (
                  <button
                    className="ct-btn ct-btn-penalty"
                    onClick={applyOutPenalty}
                    title="Double Wicket format: docks 2 runs from the team total for this dismissal"
                  >
                    OUT −2
                  </button>
                )}
              </div>
              {tournament.isDoubleWicket && (
                <div className="ct-muted-note" style={{ paddingTop: 6 }}>
                  Double Wicket tournament: record the dismissal with "Wicket" as usual, then tap "OUT −2" to dock the penalty.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {openBatsmanPicker && (
        <PlayerPickerModal
          title={`Select ${openBatsmanPicker === 'striker' ? 'striker' : 'non-striker'}`}
          players={battingTeam.players.filter((p) => !stats.batsmen[p.id]?.out)}
          onClose={() => setOpenBatsmanPicker(null)}
          onPick={(pid) => {
            patch((t) => {
              const m = t.matches.find((x) => x.id === match.id);
              const inn = m.innings[inningsIdx];
              if (openBatsmanPicker === 'striker') inn.currentStrikerId = pid;
              else inn.currentNonStrikerId = pid;
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
          pendingExtra={pendingExtra}
        />
      )}
    </div>
  );
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

function extraLongLabel(code) {
  return { wd: 'Wide', nb: 'No Ball', b: 'Bye', lb: 'Leg Bye', penalty: 'Out Penalty' }[code] || code;
}

function BatterRow({ label, id, stats, tournament, onPick }) {
  if (!id) {
    return <button className="ct-btn ct-btn-ghost ct-btn-block" onClick={onPick}>Select {label}</button>;
  }
  const rec = stats.batsmen[id];
  return (
    <div className="ct-player-stat-row">
      <span>{playerName(tournament.teams, id)} {label.includes('*') && '*'}</span>
      <span className="ct-mono">{rec ? `${rec.runs} (${rec.balls})` : '0 (0)'}</span>
    </div>
  );
}

function BowlerRow({ id, stats, tournament, onPick }) {
  if (!id) {
    return <button className="ct-btn ct-btn-ghost ct-btn-block" onClick={onPick}>Select bowler</button>;
  }
  const rec = stats.bowlers[id];
  return (
    <div className="ct-player-stat-row">
      <span>{playerName(tournament.teams, id)}</span>
      <span className="ct-mono">{rec ? `${rec.wickets}-${rec.runs} (${ballsToOverStr(rec.balls)})` : '0-0 (0.0)'}</span>
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
    pendingExtra === 'nb' ? ['Run Out'] :
    pendingExtra === 'wd' ? ['Run Out', 'Stumped', 'Hit Wicket'] :
    WICKET_TYPES;
  const [type, setType] = useState(allowedTypes[0]);
  const [outWho, setOutWho] = useState('striker');
  const [fielder, setFielder] = useState('');
  const [runsCompleted, setRunsCompleted] = useState(0);

  return (
    <Modal title="Record Wicket" onClose={onClose}>
      <label className="ct-field-label">Dismissal type</label>
      <select className="ct-input" value={type} onChange={(e) => setType(e.target.value)}>
        {allowedTypes.map((w) => <option key={w}>{w}</option>)}
      </select>
      {type === 'Run Out' && (
        <>
          <label className="ct-field-label">Who's out</label>
          <div className="ct-toggle-row">
            <button 
              className={`ct-toggle${outWho === 'striker' ? ' ct-toggle-active' : ''}`} 
              onClick={() => setOutWho('striker')}
            >
              {strikerName}
            </button>
            <button 
              className={`ct-toggle${outWho === 'nonstriker' ? ' ct-toggle-active' : ''}`} 
              onClick={() => setOutWho('nonstriker')}
            >
              {nonStrikerName}
            </button>
          </div>
          <label className="ct-field-label">Runs completed before dismissal</label>
          <input 
            className="ct-input" 
            type="number" 
            min={0} 
            max={6} 
            value={runsCompleted} 
            onChange={(e) => setRunsCompleted(Number(e.target.value))} 
          />
        </>
      )}
      {(type === 'Caught' || type === 'Stumped' || type === 'Run Out') && (
        <>
          <label className="ct-field-label">Fielder (optional)</label>
          <input 
            className="ct-input" 
            value={fielder} 
            onChange={(e) => setFielder(e.target.value)} 
            placeholder="Fielder name" 
          />
        </>
      )}
      <button className="ct-btn ct-btn-danger ct-btn-block" onClick={() => onConfirm(type, type === 'Run Out' ? outWho : 'striker', fielder, runsCompleted)}>
        Confirm Wicket
      </button>
    </Modal>
  );
}

function MatchSummaryPanel({ tournament, match, onBack }) {
  return (
    <div className="ct-stack">
      <button className="ct-btn ct-btn-ghost ct-btn-sm" onClick={onBack}>
        <ChevronLeft size={15} /> Matches
      </button>
      <div className="ct-card">
        <div className="ct-card-title">Result</div>
        <div className="ct-result-banner">🏆 {match.result?.summary}</div>
      </div>
      <FullScorecard tournament={tournament} match={match} />
    </div>
  );
}