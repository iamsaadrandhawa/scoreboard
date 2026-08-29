import React, { useState } from 'react';
import { Plus, Trash2, Star, Camera, Users, ClipboardList } from 'lucide-react';
import { Modal, EmptyState, TeamCrest } from '../components/SharedComponents';
import { uid, TEAM_COLORS, nextTeamColor, initials } from '../lib/utils';

export default function TeamsPage({ tournament, patch, uploadTeamLogo }) {
  const [newTeamOpen, setNewTeamOpen] = useState(false);
  const [editTeamId, setEditTeamId] = useState(null);
  const [poolsOpen, setPoolsOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const pools = tournament.pools || [];

  const addTeam = (name, short, color, logo) => {
    patch((t) => {
      t.teams.push({ 
        id: uid('team'), 
        name, 
        short: short || name.slice(0, 3).toUpperCase(), 
        color: color || nextTeamColor(t.teams), 
        logo: logo || null, 
        players: [], 
        captainId: null, 
        poolId: null 
      });
      return t;
    });
    setNewTeamOpen(false);
  };

  const removeTeam = (id) => {
    if (!window.confirm('Remove this team and all its players?')) return;
    patch((t) => { 
      t.teams = t.teams.filter((x) => x.id !== id); 
      return t; 
    });
  };

  const setTeamPool = (teamId, poolId) => {
    patch((t) => {
      const tm = t.teams.find((x) => x.id === teamId);
      if (tm) tm.poolId = poolId || null;
      return t;
    });
  };

  const handleTeamLogoFile = async (teamId, file) => {
    if (!file) return;
    try {
      const url = await uploadTeamLogo(teamId, file);
      patch((t) => {
        const tm = t.teams.find((x) => x.id === teamId);
        if (tm) tm.logo = url;
        return t;
      });
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload logo. Please try again.');
    }
  };

  return (
    <div className="ct-stack">
      <div className="ct-row-between">
        <div className="ct-section-label">Teams</div>
        <div className="ct-row-gap">
          <button className="ct-btn ct-btn-ghost" onClick={() => setBulkOpen(true)}>
            <ClipboardList size={16} /> Bulk Import
          </button>
          <button className="ct-btn ct-btn-ghost" onClick={() => setPoolsOpen(true)}>
            <Users size={16} /> Manage Pools
          </button>
          <button className="ct-btn ct-btn-primary" onClick={() => setNewTeamOpen(true)}>
            <Plus size={16} /> Add Team
          </button>
        </div>
      </div>

      {tournament.teams.length === 0 ? (
        <EmptyState 
          icon={<Users size={32} />} 
          title="No teams yet" 
          sub="Add teams to start building your tournament." 
        />
      ) : (
        <div className="ct-grid-tiles">
          {tournament.teams.map((team) => (
            <div className="ct-tile-card" key={team.id}>
              <div className="ct-tile-header">
                <div className="ct-tile-crest-wrapper">
                  <TeamCrest team={team} className="ct-tile-crest" />
                  <label className="ct-tile-photo-btn" title="Add / change team logo">
                    <Camera size={10} />
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => handleTeamLogoFile(team.id, e.target.files[0])}
                    />
                  </label>
                </div>
                <button className="ct-tile-delete" onClick={() => removeTeam(team.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
              
              <div className="ct-tile-body">
                <div className="ct-tile-name">{team.name}</div>
                <div className="ct-tile-players">{team.players.length} players</div>
                
                {pools.length > 0 && (
                  <select 
                    className="ct-tile-select" 
                    value={team.poolId || ''} 
                    onChange={(e) => setTeamPool(team.id, e.target.value)}
                  >
                    <option value="">Unassigned</option>
                    {pools.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                )}
              </div>
              
              <button 
                className="ct-tile-action" 
                onClick={() => setEditTeamId(team.id)}
              >
                Manage Squad
              </button>
            </div>
          ))}
        </div>
      )}

      {newTeamOpen && (
        <AddTeamModal onClose={() => setNewTeamOpen(false)} onAdd={addTeam} />
      )}
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

function AddTeamModal({ onClose, onAdd }) {
  const [name, setName] = useState('');
  const [short, setShort] = useState('');
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
      <input 
        className="ct-input" 
        value={name} 
        onChange={(e) => setName(e.target.value)} 
        placeholder="e.g. Lahore Lions" 
        autoFocus 
      />
      <label className="ct-field-label">Short code (3 letters)</label>
      <input 
        className="ct-input" 
        value={short} 
        onChange={(e) => setShort(e.target.value.toUpperCase().slice(0, 4))} 
        placeholder="e.g. LAH" 
      />
      <label className="ct-field-label">Team logo (optional)</label>
      <div className="ct-row-gap">
        {logo ? (
          <img className="ct-team-logo-preview" src={logo} alt="" />
        ) : (
          <div className="ct-team-logo-preview ct-team-logo-preview-empty" style={{ background: color }}>
            {short || '?'}
          </div>
        )}
        <label className="ct-btn ct-btn-ghost ct-btn-sm" style={{ cursor: 'pointer' }}>
          <Camera size={14} /> Upload logo
          <input 
            type="file" 
            accept="image/*" 
            style={{ display: 'none' }} 
            onChange={(e) => handleLogoFile(e.target.files[0])} 
          />
        </label>
        {logo && (
          <button className="ct-btn ct-btn-ghost ct-btn-sm" onClick={() => setLogo(null)}>
            Remove
          </button>
        )}
      </div>
      <div className="ct-muted-note">
        If no logo is uploaded, the kit color and short code below are used instead.
      </div>
      <label className="ct-field-label">Kit color</label>
      <div className="ct-color-row">
        {TEAM_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className={`ct-color-swatch${color === c ? ' ct-color-swatch-active' : ''}`}
            style={{ background: c }}
            onClick={() => setColor(c)}
            aria-label={c}
          />
        ))}
        <input 
          type="color" 
          className="ct-color-custom" 
          value={color} 
          onChange={(e) => setColor(e.target.value)} 
          title="Custom color" 
        />
      </div>
      <button 
        className="ct-btn ct-btn-primary ct-btn-block" 
        disabled={!name.trim()} 
        onClick={() => onAdd(name.trim(), short.trim(), color, logo)}
      >
        Add Team
      </button>
    </Modal>
  );
}

function SquadModal({ team, onClose, patch }) {
  const [playerName, setPlayerName] = useState('');
  const [role, setRole] = useState('Batter');

  if (!team) return null;

  const addPlayer = () => {
    if (!playerName.trim()) return;
    patch((t) => {
      const tm = t.teams.find((x) => x.id === team.id);
      tm.players.push({ id: uid('player'), name: playerName.trim(), role, photo: null });
      return t;
    });
    setPlayerName('');
  };

  const removePlayer = (pid) => {
    if (!window.confirm('Remove this player?')) return;
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
        Tap the star to make a player captain, and the camera icon to add their photo.
      </div>
      <div className="ct-row-gap ct-mt">
        <input 
          className="ct-input" 
          placeholder="Player name" 
          value={playerName} 
          onChange={(e) => setPlayerName(e.target.value)} 
          onKeyDown={(e) => e.key === 'Enter' && addPlayer()} 
        />
        <select className="ct-input ct-input-sm" value={role} onChange={(e) => setRole(e.target.value)}>
          <option>Batter</option>
          <option>Bowler</option>
          <option>All-rounder</option>
          <option>Wicketkeeper</option>
        </select>
        <button className="ct-btn ct-btn-primary" onClick={addPlayer}>
          <Plus size={16} />
        </button>
      </div>
      <div className="ct-player-list">
        {team.players.length === 0 && <div className="ct-muted-note">No players added yet.</div>}
        {team.players.map((p) => (
          <div className="ct-player-row" key={p.id}>
            <button
              className={`ct-captain-star-btn${team.captainId === p.id ? ' ct-captain-star-active' : ''}`}
              onClick={() => setCaptain(p.id)}
              title={team.captainId === p.id ? 'Captain — tap to unset' : 'Set as captain'}
            >
              <Star size={14} fill={team.captainId === p.id ? 'currentColor' : 'none'} />
            </button>
            {p.photo ? (
              <img className="ct-player-avatar" src={p.photo} alt="" />
            ) : (
              <div className="ct-player-avatar-fallback">{initials(p.name)}</div>
            )}
            <label className="ct-photo-upload-btn" title="Add / change photo">
              <Camera size={12} />
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => handlePhotoFile(p.id, e.target.files[0])}
              />
            </label>
            <span style={{ flex: 1 }}>
              {p.name}
              {team.captainId === p.id && <span className="ct-tag ct-tag-active" style={{ marginLeft: 6 }}>Captain</span>}
            </span>
            <span className="ct-tag">{p.role}</span>
            <button className="ct-icon-btn" onClick={() => removePlayer(p.id)}>
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </Modal>
  );
}

function PoolsModal({ tournament, patch, onClose }) {
  const [newPoolName, setNewPoolName] = useState('');
  const pools = tournament.pools || [];

  const addPool = () => {
    if (!newPoolName.trim()) return;
    patch((t) => {
      if (!t.pools) t.pools = [];
      t.pools.push({ id: uid('pool'), name: newPoolName.trim() });
      return t;
    });
    setNewPoolName('');
  };

  const renamePool = (id, name) => {
    patch((t) => {
      const p = (t.pools || []).find((x) => x.id === id);
      if (p) p.name = name;
      return t;
    });
  };

  const removePool = (id) => {
    if (!window.confirm('Remove this pool?')) return;
    patch((t) => {
      t.pools = (t.pools || []).filter((x) => x.id !== id);
      t.teams.forEach((tm) => { if (tm.poolId === id) tm.poolId = null; });
      return t;
    });
  };

  return (
    <Modal title="Manage Pools / Groups" onClose={onClose}>
      <div className="ct-muted-note">
        Create pools (e.g. "Pool A", "Pool B") then assign each team to one from its card on the Teams page.
      </div>
      <div className="ct-row-gap ct-mt">
        <input
          className="ct-input"
          placeholder="e.g. Pool A"
          value={newPoolName}
          onChange={(e) => setNewPoolName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addPool()}
        />
        <button className="ct-btn ct-btn-primary" onClick={addPool}>
          <Plus size={16} />
        </button>
      </div>
      <div className="ct-player-list">
        {pools.length === 0 && <div className="ct-muted-note">No pools yet — add one above.</div>}
        {pools.map((p) => (
          <div className="ct-player-row" key={p.id}>
            <input
              className="ct-input ct-input-sm"
              style={{ flex: 1 }}
              value={p.name}
              onChange={(e) => renamePool(p.id, e.target.value)}
            />
            <span className="ct-tag">{tournament.teams.filter((t) => t.poolId === p.id).length} teams</span>
            <button className="ct-icon-btn" onClick={() => removePool(p.id)}>
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </Modal>
  );
}

function BulkImportTeamsModal({ tournament, patch, onClose }) {
  const [text, setText] = useState('');
  const [result, setResult] = useState(null);

  const VALID_ROLES = ['Batter', 'Bowler', 'All-rounder', 'Wicketkeeper'];
  const normalizeRole = (r) => {
    if (!r) return 'Batter';
    const hit = VALID_ROLES.find((v) => v.toLowerCase() === r.trim().toLowerCase());
    return hit || 'Batter';
  };

  const doImport = () => {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    let added = 0;
    let poolsCreated = 0;
    let playersAdded = 0;
    patch((t) => {
      if (!t.pools) t.pools = [];
      lines.forEach((line) => {
        const parts = line.split('|').map((s) => s.trim());
        const name = parts[0];
        if (!name) return;
        const poolName = parts[1] || '';
        const playersRaw = parts[2] || '';

        let poolId = null;
        if (poolName) {
          let pool = t.pools.find((p) => p.name.toLowerCase() === poolName.toLowerCase());
          if (!pool) {
            pool = { id: uid('pool'), name: poolName };
            t.pools.push(pool);
            poolsCreated += 1;
          }
          poolId = pool.id;
        }

        const players = playersRaw
          .split(',')
          .map((p) => p.trim())
          .filter(Boolean)
          .map((p) => {
            const [pname, prole] = p.split(':');
            playersAdded += 1;
            return { id: uid('player'), name: pname.trim(), role: normalizeRole(prole), photo: null };
          });

        t.teams.push({
          id: uid('team'),
          name,
          short: name.slice(0, 3).toUpperCase(),
          color: nextTeamColor(t.teams),
          logo: null,
          players,
          captainId: null,
          poolId,
        });
        added += 1;
      });
      return t;
    });
    setResult({ added, poolsCreated, playersAdded });
    setText('');
  };

  return (
    <Modal title="Bulk Import Teams" onClose={onClose} wide>
      <div className="ct-muted-note">
        One team per line: <code>Team Name | Pool Name | Player1, Player2, Player3</code>. Pool and
        players are both optional — leave the pool blank (but keep the "|") to add players without a
        pool: <code>Team Name | | Player1, Player2</code>. Give a player a role with a colon, e.g.{' '}
        <code>Ali:Bowler</code> (Batter, Bowler, All-rounder, or Wicketkeeper — defaults to Batter).
      </div>
      <textarea
        className="ct-input ct-textarea"
        rows={10}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={
          "Lahore Lions | Pool A | Ahmed Raza:Bowler, Bilal Khan, Saad Ali:Wicketkeeper\n" +
          "Karachi Kings | Pool A | Izhar Ahmed, Usman Tariq:Bowler\n" +
          "Multan Sultans | Pool B\n" +
          "Peshawar Zalmi"
        }
      />
      {result && (
        <div className="ct-toss-info-line">
          ✅ Added {result.added} team{result.added === 1 ? '' : 's'}
          {result.playersAdded > 0 ? `, ${result.playersAdded} player${result.playersAdded === 1 ? '' : 's'}` : ''}
          {result.poolsCreated > 0 ? `, created ${result.poolsCreated} new pool${result.poolsCreated === 1 ? '' : 's'}` : ''}.
        </div>
      )}
      <button className="ct-btn ct-btn-primary ct-btn-block" onClick={doImport} disabled={!text.trim()}>
        Import Teams
      </button>
    </Modal>
  );
}