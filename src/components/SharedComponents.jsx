import React, { useState } from 'react';
import { X, Plus, Trash2, Pencil, ChevronDown, ChevronUp, AlertTriangle, Loader2, Camera } from 'lucide-react';
import { uid, TEAM_COLORS, nextTeamColor, initials, OVERLAY_LAYERS, teamShort } from '../lib/utils';  // Add teamShort here
// Modal Component
export function Modal({ title, onClose, children, wide }) {
  return (
    <div className="ct-modal-backdrop" onClick={onClose}>
      <div className={`ct-modal${wide ? ' ct-modal-wide' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="ct-modal-head">
          <span>{title}</span>
          <button className="ct-icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="ct-modal-body">{children}</div>
      </div>
    </div>
  );
}

// Digit Tile
export function DigitTile({ value, label }) {
  return (
    <div className="ct-digit-tile">
      <div className="ct-digit-value">{value}</div>
      <div className="ct-digit-label">{label}</div>
    </div>
  );
}

// Empty State
export function EmptyState({ icon, title, sub, action }) {
  return (
    <div className="ct-empty">
      {icon}
      <div className="ct-empty-title">{title}</div>
      {sub && <div className="ct-empty-sub">{sub}</div>}
      {action}
    </div>
  );
}

// Team Crest
export function TeamCrest({ team, className, fallbackColor, children }) {
  if (team?.logo) {
    return <img className={className} src={team.logo} alt="" style={{ objectFit: 'cover' }} />;
  }
  return (
    <div className={className} style={{ background: team?.color || fallbackColor || '#7C3AED' }}>
      {children != null ? children : (team?.short || 'TBD')}
    </div>
  );
}

// Tournament Switcher Modal
export function TournamentSwitcherModal({ tournaments, activeId, onSwitch, onCreate, onDelete, onRename, onClose }) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newOvers, setNewOvers] = useState(20);
  const [newDoubleWicket, setNewDoubleWicket] = useState(false);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');

  const submitCreate = () => {
    if (!newName.trim()) return;
    onCreate({
      id: uid('tour'),
      name: newName.trim(),
      defaultOvers: Number(newOvers) || 20,
      isDoubleWicket: newDoubleWicket,
      teams: [],
      matches: [],
      pools: [],
      createdAt: Date.now(),
    });
    setCreating(false);
    setNewName('');
    setNewOvers(20);
    setNewDoubleWicket(false);
  };

  const submitRename = (id) => {
    if (renameValue.trim()) onRename(id, renameValue.trim());
    setRenamingId(null);
  };

  const sorted = [...tournaments].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

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
                <div className={`ct-card ct-match-row${t.id === activeId ? ' ct-switcher-row-active' : ''}`} key={t.id}>
                  <div className="ct-match-teams">
                    {renamingId === t.id ? (
                      <input
                        className="ct-input"
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={() => submitRename(t.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') submitRename(t.id);
                          if (e.key === 'Escape') setRenamingId(null);
                        }}
                      />
                    ) : (
                      <>
                        <b>{t.name}</b>
                        {t.id === activeId && <span className="ct-tag ct-tag-active" style={{ marginLeft: 8 }}>Open now</span>}
                        <div className="ct-muted-note">{t.teamsCount || 0} teams · {t.matchesCount || 0} matches</div>
                      </>
                    )}
                  </div>
                  <div className="ct-row-gap">
                    {t.id !== activeId && (
                      <button className="ct-btn ct-btn-ghost ct-btn-sm" onClick={() => onSwitch(t.id)}>Switch</button>
                    )}
                    <button className="ct-icon-btn" onClick={() => { setRenamingId(t.id); setRenameValue(t.name); }}>
                      <Pencil size={15} />
                    </button>
                    <button
                      className="ct-icon-btn"
                      onClick={() => {
                        if (window.confirm(`Delete "${t.name}" permanently? This can't be undone.`)) onDelete(t.id);
                      }}
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
              <input
                className="ct-input"
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Shahkot Premier League 2026"
              />
              <label className="ct-field-label">Default overs per innings</label>
              <input
                className="ct-input"
                type="number"
                min={1}
                max={50}
                value={newOvers}
                onChange={(e) => setNewOvers(e.target.value)}
              />
              <label className="ct-check-row">
                <input
                  type="checkbox"
                  checked={newDoubleWicket}
                  onChange={(e) => setNewDoubleWicket(e.target.checked)}
                />
                Double Wicket tournament (−2 penalty on dismissal)
              </label>
              <div className="ct-row-gap ct-mt">
                <button className="ct-btn ct-btn-primary ct-btn-sm" onClick={submitCreate} disabled={!newName.trim()}>
                  Create
                </button>
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

// Setup Screen
export function SetupScreen({ onCreate }) {
  const [name, setName] = useState('');
  const [overs, setOvers] = useState(20);
  const [doubleWicket, setDoubleWicket] = useState(false);

  const create = () => {
    if (!name.trim()) return;
    onCreate({
      id: uid('tour'),
      name: name.trim(),
      defaultOvers: Number(overs) || 20,
      isDoubleWicket: doubleWicket,
      teams: [],
      matches: [],
      pools: [],
      createdAt: Date.now(),
    });
  };

  return (
    <div className="ct-root ct-setup-screen">
      <div className="ct-setup-card">
        <div className="ct-setup-mark">🏏</div>
        <h1>New Tournament</h1>
        <p className="ct-setup-sub">Set it up once — teams, fixtures, live scoring and stats all live here.</p>
        <label className="ct-field-label">Tournament name</label>
        <input
          className="ct-input"
          placeholder="e.g. Shahkot Premier League 2026"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <label className="ct-field-label">Default overs per innings</label>
        <input
          className="ct-input"
          type="number"
          min={1}
          max={50}
          value={overs}
          onChange={(e) => setOvers(e.target.value)}
        />
        <label className="ct-check-row">
          <input
            type="checkbox"
            checked={doubleWicket}
            onChange={(e) => setDoubleWicket(e.target.checked)}
          />
          Double Wicket tournament (out hone par −2 penalty)
        </label>
        <button className="ct-btn ct-btn-primary ct-btn-block" onClick={create} disabled={!name.trim()}>
          Create tournament →
        </button>
      </div>
    </div>
  );
}

// Inline Broadcast Control (used in scoring)
export function InlineBroadcastControl({ tournament, match, patch, broadcast, setBroadcast, loading }) {
  const [open, setOpen] = useState(true);

  if (loading || !broadcast) {
    return (
      <div className="ct-card">
        <div className="ct-card-title">📺 Broadcast Control</div>
        <div className="ct-muted-note">Loading broadcast state…</div>
      </div>
    );
  }

  const layers = broadcast.layers || {};
  const isThisMatchOnAir = broadcast.matchId === match.id;

  const toggleLayer = (id) => {
    setBroadcast((b) => {
      const current = b.layers || {};
      const nextLayers = { ...current };
      if (id === 'bug') {
        nextLayers.bug = !current.bug;
      } else {
        const turningOn = !current[id];
        if (turningOn) {
          OVERLAY_LAYERS.forEach(l => { if (l.id !== 'bug') nextLayers[l.id] = false; });
        }
        nextLayers[id] = turningOn;
      }
      return { ...b, layers: nextLayers };
    });
  };

  const putThisMatchOnAir = () => {
    setBroadcast((b) => ({ ...b, matchId: match.id }));
  };

  const activeCount = OVERLAY_LAYERS.filter(l => layers[l.id]).length;

  return (
    <div className="ct-card">
      <button className="ct-row-between ct-bc-toggle-btn" onClick={() => setOpen(v => !v)}>
        <span className="ct-card-title" style={{ marginBottom: 0 }}>
          📺 Broadcast Control
          {activeCount > 0 && <span className="ct-tag ct-tag-active" style={{ marginLeft: 6 }}>{activeCount} live</span>}
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
              📡 Put this match on overlay
            </button>
          ) : (
            <div className="ct-toss-info-line">📡 This match is on air for the graphics below</div>
          )}

          <div className="ct-scene-checklist ct-scene-checklist-1col ct-mt">
            {OVERLAY_LAYERS.map((l) => (
              <label className={`ct-scene-check-row${layers[l.id] ? ' ct-scene-check-active' : ''}`} key={l.id}>
                <input type="checkbox" checked={!!layers[l.id]} onChange={() => toggleLayer(l.id)} />
                {l.icon} {l.label}
              </label>
            ))}
          </div>

          {layers.toss && (
            <label className="ct-check-row">
              <input
                type="checkbox"
                checked={!!broadcast.showCaptainPhotos}
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
                  className={`ct-toggle${(broadcast.lineupTeamId || match.teamAId) === match.teamAId ? ' ct-toggle-active' : ''}`}
                  onClick={() => setBroadcast((b) => ({ ...b, lineupTeamId: match.teamAId }))}
                >
                  {teamShort(tournament.teams, match.teamAId)}
                </button>
                <button
                  className={`ct-toggle${broadcast.lineupTeamId === match.teamBId ? ' ct-toggle-active' : ''}`}
                  onClick={() => setBroadcast((b) => ({ ...b, lineupTeamId: match.teamBId }))}
                >
                  {teamShort(tournament.teams, match.teamBId)}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}