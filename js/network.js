/* ============================================================
   RESONATIA — js/network.js
   Multiplayer foundation using PeerJS (free WebRTC signaling)

   ARCHITECTURE: HOST-AUTHORITATIVE
   ─────────────────────────────────────────────
   - One player creates a room → becomes "host". Game logic runs
     only on the host (dice rolls, enemy AI, state transitions).
   - Other players are "clients". They render whatever the host
     broadcasts and send actions for the host to validate.
   - This avoids state divergence from independent dice rolls
     and lets us keep the existing single-player code mostly
     intact — the host just runs the game and ships state.

   ROOM CODES
   ─────────────────────────────────────────────
   - 4-char codes drawn from an unambiguous alphabet (no I/O/0/1).
   - Mapped to PeerJS peer IDs of the form "resonatia-XXXX" so
     friends only need to share the short code.

   PROTOCOL
   ─────────────────────────────────────────────
   The connection layer (this file) only handles peer wiring and
   raw message passing. Game-state sync, combat actions, and
   dialogue voting live in their own modules and use Network.send
   / Network.onMessage to communicate.

   Reserved message types in THIS layer:
     {type:'hello',   name}            client → host on join
     {type:'welcome', slot, players}   host → new client
     {type:'reject',  reason}          host → client (full room, etc)
     {type:'roster',  players}         host → all (roster changed)
   All other types are forwarded to onMessage handlers untouched.
   ============================================================ */

'use strict';

const Network = (() => {

  /* ── State ─────────────────────────────────────────────── */
  let peer        = null;     // PeerJS peer object
  let myId        = null;     // My full peer ID
  let roomCode    = null;     // 4-char display code
  let role        = null;     // 'host' | 'client' | null
  let connections = [];       // Host: all clients. Client: [host conn].
  let players     = [];       // [{id, name, slot, isHost}]
  let myName      = 'Player';
  let mySlot      = -1;       // 0–3 party slot

  /* Event hooks — wired by main.js / Lobby module */
  let _onMsg     = () => {};
  let _onPlayers = () => {};
  let _onStatus  = () => {};

  /* ── Room code helpers ─────────────────────────────────── */
  const ROOM_CODE_LENGTH = 4;
  const ROOM_CODE_CHARS  = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // skip I/O/0/1

  function _makeRoomCode() {
    let code = '';
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
      code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
    }
    return code;
  }

  function _peerIdFromCode(code) {
    return `resonatia-${code.toUpperCase()}`;
  }

  /* ── Host: create a new room ───────────────────────────── */
  function host(name) {
    return new Promise((resolve, reject) => {
      myName   = name || 'Host';
      role     = 'host';
      roomCode = _makeRoomCode();
      const peerId = _peerIdFromCode(roomCode);

      _onStatus({ state: 'connecting', message: 'Creating room…' });

      peer = new Peer(peerId, { debug: 1 });

      peer.on('open', (id) => {
        myId    = id;
        mySlot  = 0;
        players = [{ id: myId, name: myName, slot: 0, isHost: true }];
        _onPlayers(players);
        _onStatus({
          state: 'hosting',
          message: `Room ${roomCode} ready — waiting for players…`
        });
        resolve(roomCode);
      });

      peer.on('connection', (conn) => _acceptClient(conn));

      peer.on('error', (err) => {
        // Room-code collision: regenerate and retry once.
        if (err.type === 'unavailable-id') {
          try { peer.destroy(); } catch (e) {}
          peer = null;
          host(name).then(resolve).catch(reject);
          return;
        }
        _onStatus({ state: 'error', message: err.message || String(err) });
        reject(err);
      });
    });
  }

  function _acceptClient(conn) {
    // Reject if room is full BEFORE adding to roster.
    if (players.length >= 4) {
      conn.on('open', () => {
        try { conn.send({ type: 'reject', reason: 'Room is full (max 4 players).' }); } catch (e) {}
        setTimeout(() => { try { conn.close(); } catch (e) {} }, 200);
      });
      return;
    }

    connections.push(conn);

    conn.on('open', () => {
      // Assign first free slot 1..3
      const used = new Set(players.map(p => p.slot));
      let slot = 1;
      while (used.has(slot) && slot < 4) slot++;

      // Wait for client's hello (to learn their name) before adding to roster.
      const onHello = (data) => {
        if (!data || data.type !== 'hello') return;
        conn.off('data', onHello);

        const newPlayer = { id: conn.peer, name: data.name || 'Player', slot, isHost: false };
        players.push(newPlayer);

        try { conn.send({ type: 'welcome', slot, players }); } catch (e) {}
        _broadcast({ type: 'roster', players });
        _onPlayers(players);
        _onStatus({
          state:   'hosting',
          message: `${newPlayer.name} joined — ${players.length}/4 in party`
        });

        // From here on, forward game messages to the app layer.
        conn.on('data', (msg) => _onMsg(msg, conn.peer));
      };
      conn.on('data', onHello);
    });

    conn.on('close', () => {
      connections = connections.filter(c => c !== conn);
      const leaver = players.find(p => p.id === conn.peer);
      players = players.filter(p => p.id !== conn.peer);
      _broadcast({ type: 'roster', players });
      _onPlayers(players);
      if (leaver) {
        _onStatus({ state: 'hosting', message: `${leaver.name} left the party.` });
      }
    });
  }

  /* ── Client: join an existing room ─────────────────────── */
  function join(code, name) {
    return new Promise((resolve, reject) => {
      myName = name || 'Player';
      role   = 'client';
      const targetPeerId = _peerIdFromCode(code);

      _onStatus({ state: 'connecting', message: `Connecting to room ${code}…` });

      peer = new Peer({ debug: 1 });

      peer.on('open', (id) => {
        myId = id;
        const conn = peer.connect(targetPeerId, { reliable: true });
        connections = [conn];

        conn.on('open', () => {
          try { conn.send({ type: 'hello', name: myName }); } catch (e) {}
        });

        conn.on('data', (data) => {
          if (!data || !data.type) return;
          switch (data.type) {
            case 'welcome':
              mySlot   = data.slot;
              players  = data.players || [];
              roomCode = code;
              _onPlayers(players);
              _onStatus({ state: 'connected', message: `Joined room ${code}!` });
              resolve();
              break;
            case 'reject':
              _onStatus({ state: 'error', message: data.reason || 'Connection refused.' });
              try { peer.destroy(); } catch (e) {}
              reject(new Error(data.reason || 'Connection refused.'));
              break;
            case 'roster':
              players = data.players || [];
              _onPlayers(players);
              break;
            default:
              _onMsg(data, conn.peer);
          }
        });

        conn.on('close', () => {
          _onStatus({ state: 'disconnected', message: 'Lost connection to host.' });
        });
      });

      peer.on('error', (err) => {
        // Most common: peer-unavailable (bad room code) or network failure.
        const msg = err.type === 'peer-unavailable'
          ? `No room found with code ${code}.`
          : (err.message || String(err));
        _onStatus({ state: 'error', message: msg });
        reject(new Error(msg));
      });
    });
  }

  /* ── Message helpers ───────────────────────────────────── */
  function _broadcast(data) {
    connections.forEach(c => {
      try { c.send(data); } catch (e) { /* ignore stale conns */ }
    });
  }

  /** Send a message to peer(s). Host → broadcasts; client → host only. */
  function send(data) {
    _broadcast(data);
  }

  /* ── Lifecycle ─────────────────────────────────────────── */
  function disconnect() {
    if (peer) { try { peer.destroy(); } catch (e) {} }
    peer        = null;
    connections = [];
    players     = [];
    role        = null;
    roomCode    = null;
    myId        = null;
    mySlot      = -1;
    _onPlayers([]);
  }

  /* ── Getters ───────────────────────────────────────────── */
  function isHost()      { return role === 'host'; }
  function isClient()    { return role === 'client'; }
  function isOnline()    { return !!peer && !peer.destroyed; }
  function getMySlot()   { return mySlot; }
  function getMyName()   { return myName; }
  function getPlayers()  { return [...players]; }
  function getRoomCode() { return roomCode; }

  /* ── Event registration ────────────────────────────────── */
  function onMessage(fn) { _onMsg     = fn || (() => {}); }
  function onPlayers(fn) { _onPlayers = fn || (() => {}); }
  function onStatus(fn)  { _onStatus  = fn || (() => {}); }

  return {
    host, join, send, disconnect,
    isHost, isClient, isOnline,
    getMySlot, getMyName, getPlayers, getRoomCode,
    onMessage, onPlayers, onStatus
  };
})();
