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

  /* Event hooks — multi-listener so Lobby AND Multiplayer can both
     subscribe to the same channel without clobbering each other. */
  const _msgListeners     = [];
  const _playersListeners = [];
  const _statusListeners  = [];

  function _emit(listeners, ...args) {
    listeners.forEach(fn => { try { fn(...args); } catch (e) { console.error(e); } });
  }

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

  function _peerIdFromCode(code, isPublic) {
    // Public rooms include "public" in the peer ID so the broker can
    // discover them by prefix. Private rooms keep the short prefix and
    // are only findable by people who already know the code.
    return isPublic
      ? `resonatia-public-${code.toUpperCase()}`
      : `resonatia-${code.toUpperCase()}`;
  }

  /* The broker peer maintains a list of active public rooms.
     The first user who creates a public room AND can claim this well-known
     ID becomes the broker; everyone else connects to it for register/list.
     If the broker disconnects, the next public host claims the role. */
  const BROKER_ID = 'resonatia-broker-v1';
  let brokerConn = null;          // Outgoing connection to the broker (non-broker hosts/browsers)
  let isBroker   = false;         // Am I the broker?
  let brokerPeer = null;          // Separate Peer for broker role (so it co-exists with our room peer)
  let publicRoomRegistry = {};    // Only used when isBroker — { code → {name, players, max, lastSeen} }
  let brokerHeartbeat = null;
  let roomHeartbeat   = null;
  let isPublicRoom    = false;    // Whether MY current hosted room is public
  let hostDisplayName = '';       // For broker registration

  /* ── Host: create a new room ─────────────────────────────
     opts.public = true → registered with broker for public browsing
     opts.public = false → private; only findable by code share */
  function host(name, opts) {
    opts = opts || {};
    isPublicRoom = !!opts.public;
    return new Promise((resolve, reject) => {
      myName   = name || 'Host';
      hostDisplayName = myName;
      role     = 'host';
      roomCode = _makeRoomCode();
      const peerId = _peerIdFromCode(roomCode, isPublicRoom);

      _emit(_statusListeners, { state: 'connecting', message: 'Creating room…' });

      peer = new Peer(peerId, { debug: 1 });

      peer.on('open', (id) => {
        myId    = id;
        mySlot  = 0;
        players = [{ id: myId, name: myName, slot: 0, isHost: true }];
        _emit(_playersListeners, players);
        _emit(_statusListeners, {
          state: 'hosting',
          message: `Room ${roomCode} ready — waiting for players…`
        });
        // Public rooms register with the broker so they show up in Browse.
        if (isPublicRoom) _registerWithBroker();
        resolve({ code: roomCode, isPublic: isPublicRoom });
      });

      peer.on('connection', (conn) => _acceptClient(conn));

      peer.on('error', (err) => {
        // Room-code collision: regenerate and retry once.
        if (err.type === 'unavailable-id') {
          try { peer.destroy(); } catch (e) {}
          peer = null;
          host(name, opts).then(resolve).catch(reject);
          return;
        }
        _emit(_statusListeners, { state: 'error', message: err.message || String(err) });
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
        _emit(_playersListeners, players);
        _emit(_statusListeners, {
          state:   'hosting',
          message: `${newPlayer.name} joined — ${players.length}/4 in party`
        });

        // From here on, forward game messages to the app layer.
        conn.on('data', (msg) => _emit(_msgListeners, msg, conn.peer));
      };
      conn.on('data', onHello);
    });

    conn.on('close', () => {
      connections = connections.filter(c => c !== conn);
      const leaver = players.find(p => p.id === conn.peer);
      players = players.filter(p => p.id !== conn.peer);
      _broadcast({ type: 'roster', players });
      _emit(_playersListeners, players);
      if (leaver) {
        _emit(_statusListeners, { state: 'hosting', message: `${leaver.name} left the party.` });
      }
    });
  }

  /* ── Client: join an existing room ─────────────────────────
     Rooms can be hosted under either peer-ID format (public adds the
     "public-" infix). We probe public first, fall back to private on
     peer-unavailable. The user doesn't need to know the visibility —
     they just paste the 4-letter code. */
  function join(code, name) {
    myName = name || 'Player';
    role   = 'client';
    return _joinAttempt(code, true)
      .catch(err => err && err._fallback
        ? _joinAttempt(code, false)
        : Promise.reject(err));
  }

  function _joinAttempt(code, publicMode) {
    return new Promise((resolve, reject) => {
      const targetPeerId = _peerIdFromCode(code, publicMode);
      _emit(_statusListeners, {
        state: 'connecting',
        message: `Connecting to room ${code}…`
      });

      // Each attempt needs its own peer — destroy any prior one first.
      if (peer) { try { peer.destroy(); } catch (e) {} }
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
              // Remember whether THIS room is public or private — driven by
              // which peer-ID format successfully connected (publicMode flag).
              isPublicRoom = publicMode;
              _emit(_playersListeners, players);
              _emit(_statusListeners, { state: 'connected', message: `Joined room ${code}!` });
              resolve();
              break;
            case 'reject':
              _emit(_statusListeners, { state: 'error', message: data.reason || 'Connection refused.' });
              try { peer.destroy(); } catch (e) {}
              reject(new Error(data.reason || 'Connection refused.'));
              break;
            case 'roster':
              players = data.players || [];
              _emit(_playersListeners, players);
              break;
            default:
              _emit(_msgListeners, data, conn.peer);
          }
        });

        conn.on('close', () => {
          _emit(_statusListeners, { state: 'disconnected', message: 'Lost connection to host.' });
        });
      });

      peer.on('error', (err) => {
        // peer-unavailable in the public-first probe → try private as fallback.
        if (err.type === 'peer-unavailable' && publicMode) {
          err._fallback = true;
          reject(err);
          return;
        }
        const msg = err.type === 'peer-unavailable'
          ? `No room found with code ${code}.`
          : (err.message || String(err));
        _emit(_statusListeners, { state: 'error', message: msg });
        reject(new Error(msg));
      });
    });
  }

  /* ── Broker (public room directory) ─────────────────────────
     Architecture: ONE user runs the broker peer (well-known ID).
     Public-room hosts connect to it and register themselves; browsers
     connect to ask for the room list. If the broker disappears, the
     next host that tries to register attempts to claim the broker role.

     This is intentionally fragile — broker tenure is best-effort. A
     real backend (Firebase, Cloudflare) would be more robust, but
     this requires zero infrastructure and works for casual play. */
  const BROKER_PING_INTERVAL = 8000;   // ms between host re-registrations
  const BROKER_STALE_MS      = 25000;  // drop rooms that haven't checked in

  function _registerWithBroker() {
    if (!isPublicRoom) return;
    // Try to connect to the existing broker first
    const probePeer = new Peer({ debug: 0 });
    probePeer.on('open', () => {
      const conn = probePeer.connect(BROKER_ID, { reliable: true });
      let connected = false;
      conn.on('open', () => {
        connected = true;
        brokerConn = conn;
        _sendRoomHeartbeat();
        // Re-send heartbeat on a timer so the broker keeps us alive
        if (roomHeartbeat) clearInterval(roomHeartbeat);
        roomHeartbeat = setInterval(_sendRoomHeartbeat, BROKER_PING_INTERVAL);
      });
      conn.on('error', () => { /* fallback handled below */ });
      // If the connection doesn't open within 4s, broker is dead → claim role
      setTimeout(() => {
        if (!connected) {
          try { probePeer.destroy(); } catch (e) {}
          _claimBrokerRole();
        }
      }, 4000);
    });
    probePeer.on('error', () => _claimBrokerRole());
  }

  function _sendRoomHeartbeat() {
    if (!brokerConn || brokerConn.open === false) return;
    try {
      brokerConn.send({
        type: 'register',
        code: roomCode,
        name: hostDisplayName,
        players: players.length,
        max: 4,
        ts: Date.now()
      });
    } catch (e) {}
  }

  function _claimBrokerRole() {
    if (isBroker) return;
    brokerPeer = new Peer(BROKER_ID, { debug: 0 });
    brokerPeer.on('open', () => {
      isBroker = true;
      // Whenever an inbound connection arrives, it's either a host registering
      // or a browser asking for the list. We respond accordingly.
      brokerPeer.on('connection', (conn) => {
        conn.on('data', (data) => {
          if (!data || !data.type) return;
          if (data.type === 'register' && data.code) {
            publicRoomRegistry[data.code] = {
              name:    data.name || 'Adventurer',
              players: data.players || 1,
              max:     data.max || 4,
              lastSeen: Date.now()
            };
          } else if (data.type === 'unregister' && data.code) {
            delete publicRoomRegistry[data.code];
          } else if (data.type === 'list') {
            _pruneStaleRooms();
            try {
              conn.send({
                type: 'list-response',
                rooms: Object.entries(publicRoomRegistry).map(([code, meta]) => ({
                  code, ...meta
                }))
              });
            } catch (e) {}
          }
        });
      });
      // Now register our own room (we are also a public host)
      brokerConn = { open: true, send: (data) => {
        // Loopback — handle our own register message
        if (data.type === 'register') {
          publicRoomRegistry[data.code] = {
            name: data.name, players: data.players, max: data.max,
            lastSeen: Date.now()
          };
        }
      }};
      _sendRoomHeartbeat();
      if (roomHeartbeat) clearInterval(roomHeartbeat);
      roomHeartbeat = setInterval(_sendRoomHeartbeat, BROKER_PING_INTERVAL);
      // Prune stale rooms periodically
      if (brokerHeartbeat) clearInterval(brokerHeartbeat);
      brokerHeartbeat = setInterval(_pruneStaleRooms, 5000);
    });
    brokerPeer.on('error', (err) => {
      // Someone else claimed the broker between our attempts — try connecting again
      if (err.type === 'unavailable-id') {
        try { brokerPeer.destroy(); } catch (e) {}
        setTimeout(_registerWithBroker, 500);
      }
    });
  }

  function _pruneStaleRooms() {
    const now = Date.now();
    Object.keys(publicRoomRegistry).forEach(code => {
      if (now - publicRoomRegistry[code].lastSeen > BROKER_STALE_MS) {
        delete publicRoomRegistry[code];
      }
    });
  }

  /** Browse: fetch the list of public rooms from the broker.
      Returns Promise<Array<{code, name, players, max}>>. */
  function listPublicRooms() {
    return new Promise((resolve) => {
      const probePeer = new Peer({ debug: 0 });
      let resolved = false;
      const finish = (rooms) => {
        if (resolved) return;
        resolved = true;
        try { probePeer.destroy(); } catch (e) {}
        resolve(rooms || []);
      };
      probePeer.on('open', () => {
        const conn = probePeer.connect(BROKER_ID, { reliable: true });
        conn.on('open', () => {
          try { conn.send({ type: 'list' }); } catch (e) {}
        });
        conn.on('data', (data) => {
          if (data && data.type === 'list-response') finish(data.rooms || []);
        });
        conn.on('error', () => finish([]));
      });
      probePeer.on('error', () => finish([]));
      // Hard timeout in case the broker is unreachable
      setTimeout(() => finish([]), 5000);
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
    // Stop broker heartbeats and unregister our room (best effort)
    if (roomHeartbeat) { clearInterval(roomHeartbeat); roomHeartbeat = null; }
    if (brokerHeartbeat) { clearInterval(brokerHeartbeat); brokerHeartbeat = null; }
    if (brokerConn && brokerConn.open !== false && roomCode) {
      try { brokerConn.send({ type: 'unregister', code: roomCode }); } catch (e) {}
    }
    if (brokerPeer) { try { brokerPeer.destroy(); } catch (e) {} brokerPeer = null; }
    brokerConn = null;
    isBroker = false;
    publicRoomRegistry = {};
    isPublicRoom = false;

    if (peer) { try { peer.destroy(); } catch (e) {} }
    peer        = null;
    connections = [];
    players     = [];
    role        = null;
    roomCode    = null;
    myId        = null;
    mySlot      = -1;
    _emit(_playersListeners, []);
  }

  function isPublic() { return isPublicRoom; }

  /* ── Getters ───────────────────────────────────────────── */
  function isHost()      { return role === 'host'; }
  function isClient()    { return role === 'client'; }
  function isOnline()    { return !!peer && !peer.destroyed; }
  function getMySlot()   { return mySlot; }
  function getMyName()   { return myName; }
  function getMyId()     { return myId; }
  function getPlayers()  { return [...players]; }
  function getRoomCode() { return roomCode; }

  /* ── Event registration ────────────────────────────────── */
  /* Push a listener onto the array (multiple subscribers supported).
     Lobby + Multiplayer both call these; previously the second call
     overwrote the first, which broke roster updates in the lobby. */
  function onMessage(fn) { if (typeof fn === 'function') _msgListeners.push(fn); }
  function onPlayers(fn) { if (typeof fn === 'function') _playersListeners.push(fn); }
  function onStatus(fn)  { if (typeof fn === 'function') _statusListeners.push(fn); }

  return {
    host, join, send, disconnect,
    isHost, isClient, isOnline, isPublic,
    getMySlot, getMyName, getMyId, getPlayers, getRoomCode,
    listPublicRooms,
    onMessage, onPlayers, onStatus
  };
})();
