/* ============================================================
   RESONATIA — js/audio.js
   Music & SFX manager — one crossfading track at a time
   ============================================================ */

'use strict';

const AudioManager = (() => {

  /* ── Track library ─────────────────────────────────────── */
  const TRACKS = {
    title:      'assets/audio/Lobby Theme.mp3',
    quiz:       'assets/audio/Unsure Mystery Theme.mp3',
    charSelect: 'assets/audio/Unsure Mystery Theme.mp3',
    tavern:     'assets/audio/Bar-Tavern-Theme.mp3',
    guild:      'assets/audio/Bar-Tavern-Theme.mp3',
    city:       'assets/audio/Suspense Theme.mp3',
    forest:     'assets/audio/Suspense Theme.mp3',
    suspense:   'assets/audio/Suspense Theme.mp3',
    fear:       'assets/audio/Fear Theme.mp3',
    cave:       'assets/audio/Fear Theme.mp3',
    cultist_room: 'assets/audio/Fear Theme.mp3',
    battle:     'assets/audio/Battle Theme.mp3',
    bossBattle: 'assets/audio/Steel_Against_the_Gate.mp3',  // Ashrag — final boss
    victory:    'assets/audio/Victory Theme.mp3',
    defeat:     'assets/audio/Defeat Theme.mp3',
    ending:     'assets/audio/Ending Theme.mp3',
    main:       'assets/audio/MAIN_GAME_MUSIC-(FOR-SPECIAL-USE)(OPTIONAL).mp3'
  };

  /* Screen → music key (auto-triggered via Screen.show) */
  const SCREEN_MAP = {
    'screen-title':   'title',      // Lobby music — title screen only
    'screen-quiz':    'quiz',       // Unsure Mystery Theme during quiz
    'screen-char':    'charSelect', // Unsure Mystery Theme on char select
    'screen-battle':  'battle',     // Battle Theme when combat starts
    'screen-ending':  'ending'      // Ending Theme on the results screen
  };

  /* Scene → music key (auto-triggered via Scene.set) */
  const SCENE_MAP = {
    title:         'suspense',   // Opening monologue — Suspense Theme (NOT the lobby theme)
    city:          'city',       // Suspense Theme
    guild:         'guild',      // Bar-Tavern-Theme
    tavern:        'tavern',     // Bar-Tavern-Theme
    tiefling:      'tavern',     // Tiefling encounter — still in tavern atmosphere
    waitress:      'tavern',     // Waitress — tavern
    forest:        'forest',     // Suspense Theme
    cave_entrance: 'fear',       // Fear Theme starts at the cave entrance
    inside_cave:   'cave',       // Fear Theme deep inside
    cultist_room:  'cultist_room', // Fear Theme — boss area
    endingGood:    'ending',
    endingWorst:   'ending'
  };

  let current       = null;   // active HTMLAudioElement
  let currentKey    = null;   // key string of current track
  let masterVol     = 0.50;   // 0–1 master volume
  let _muted        = false;
  let _lastSceneKey = null;   // last key triggered by SCENE_MAP (for post-battle return)
  let _fadingOut    = null;   // track currently fading out (at most one — older ones get force-stopped)

  /* ── Core helpers ───────────────────────────────────────────
     Each audio element owns its own fade interval (stored as audio._fadeTimer).
     Previously the timer was a shared module-level variable — when the player
     spam-clicked through dialogue, every Scene.set fired a new play() whose
     _fadeOut overwrote the shared timer, killing the previous track's fade-out
     mid-flight. The orphaned audio never reached `audio.pause()` and kept
     playing forever, layering over the new scene's music. Per-audio timers
     make every fade self-contained: a new fade only cancels a fade for the
     same audio, never an unrelated one. */
  function _fadeOut(audio, onDone, duration = 600) {
    if (!audio) { if (onDone) onDone(); return; }
    if (audio._fadeTimer) clearInterval(audio._fadeTimer);
    const step = 16;
    const decr = (audio.volume || masterVol) / (duration / step);
    audio._fadeTimer = setInterval(() => {
      audio.volume = Math.max(0, audio.volume - decr);
      if (audio.volume <= 0) {
        clearInterval(audio._fadeTimer);
        audio._fadeTimer = null;
        audio.pause();
        audio.currentTime = 0;
        if (onDone) onDone();
      }
    }, step);
  }

  function _fadeIn(audio, targetVol, duration = 800) {
    if (audio._fadeTimer) clearInterval(audio._fadeTimer);
    audio.volume = 0;
    const step = 16;
    const incr = targetVol / (duration / step);
    audio._fadeTimer = setInterval(() => {
      audio.volume = Math.min(targetVol, audio.volume + incr);
      if (audio.volume >= targetVol) {
        clearInterval(audio._fadeTimer);
        audio._fadeTimer = null;
      }
    }, step);
  }

  /* ── Public API ─────────────────────────────────────────── */

  /**
   * Play a named track, crossfading from whatever is currently playing.
   * @param {string}  key       — key from TRACKS
   * @param {boolean} [loop]    — default true
   * @param {boolean} [noFade]  — skip fade (instant switch)
   */
  function play(key, loop = true, noFade = false) {
    const src = TRACKS[key];
    if (!src) return;
    if (currentKey === key && current && !current.paused) return;

    const targetVol = _muted ? 0 : masterVol;
    const prev      = current;

    const next  = new Audio(src);
    next.loop   = loop;
    next.volume = noFade ? targetVol : 0;   // always start silent; fade-in below
    next.play().catch(() => {});

    current    = next;
    currentKey = key;

    // Guarantee at most TWO live audios (current + one fading-out). If there's
    // an even-older track still mid-fade-out from a previous rapid click, hard-stop
    // it now — it would only contribute inaudible noise by the time it finished.
    if (_fadingOut && _fadingOut !== prev) {
      if (_fadingOut._fadeTimer) clearInterval(_fadingOut._fadeTimer);
      _fadingOut._fadeTimer = null;
      _fadingOut.pause();
      _fadingOut.currentTime = 0;
      _fadingOut = null;
    }

    if (!noFade) {
      // Crossfade when something is already playing (900 ms in / 700 ms out).
      // Fresh start with no predecessor → gentler 1.5 s fade so it never blasts.
      _fadeIn(next, targetVol, prev ? 900 : 1500);
      if (prev) {
        _fadingOut = prev;
        _fadeOut(prev, () => { if (_fadingOut === prev) _fadingOut = null; }, 700);
      }
    } else if (prev) {
      if (prev._fadeTimer) clearInterval(prev._fadeTimer);
      prev._fadeTimer = null;
      prev.pause();
      prev.currentTime = 0;
    }
  }

  /**
   * Stop all music (fade out).
   */
  function stop() {
    currentKey = null;
    // Also force-kill any lingering fade-out from an earlier rapid transition,
    // otherwise stop() would leave it humming along inaudibly until it expires.
    if (_fadingOut) {
      if (_fadingOut._fadeTimer) clearInterval(_fadingOut._fadeTimer);
      _fadingOut._fadeTimer = null;
      _fadingOut.pause();
      _fadingOut.currentTime = 0;
      _fadingOut = null;
    }
    _fadeOut(current, () => { current = null; });
  }

  /**
   * Play a one-shot track then return to the previous track.
   * Useful for short victory/defeat stings.
   */
  function oneShot(key, returnKey) {
    const src = TRACKS[key];
    if (!src) return;
    const prev   = current;
    const prevKey = currentKey;
    if (prev) { _fadeOut(prev, null, 300); }
    current    = null;
    currentKey = null;

    const sting    = new Audio(src);
    sting.loop     = false;
    sting.volume   = _muted ? 0 : masterVol;
    sting.play().catch(() => {});
    sting.onended = () => {
      if (returnKey) play(returnKey);
    };
    current    = sting;
    currentKey = key;
  }

  /**
   * Set master volume (0–1).
   */
  function setVolume(v) {
    masterVol = Math.max(0, Math.min(1, v));
    if (current && !_muted) current.volume = masterVol;
    _updateVolumeUI();
  }

  function toggleMute() {
    _muted = !_muted;
    if (current) current.volume = _muted ? 0 : masterVol;
    _updateVolumeUI();
    return _muted;
  }

  function isMuted() { return _muted; }

  /* ── First-interaction audio unlock ────────────────────────
     Browsers block autoplay until a real user gesture happens.
     We listen for mousedown/keydown (earliest reliable gestures)
     and start the title music fresh inside the handler — this
     guarantees the play() call is directly tied to the gesture.
     Only fires once; only starts music if still on title screen.
  ────────────────────────────────────────────────────────── */
  let _audioUnlocked = false;

  function _onFirstInteraction() {
    if (_audioUnlocked) return;
    _audioUnlocked = true;

    // Dismiss the tap-to-start overlay
    const overlay = document.getElementById('tap-to-start');
    if (overlay) overlay.classList.add('hidden');

    // Stop any silent/blocked audio left over from the init attempt
    if (current) { current.pause(); current = null; currentKey = null; }

    // Only play title music if still on the title screen.
    const title = document.getElementById('screen-title');
    if (title && title.classList.contains('active')) {
      play('title');
      // Fade music in over 2.4 s — matching the overlay reveal duration
      if (current) {
        current.volume = 0;
        _fadeIn(current, _muted ? 0 : masterVol, 2400);
      }
    }
  }

  document.addEventListener('mousedown',  _onFirstInteraction);
  document.addEventListener('keydown',    _onFirstInteraction);
  document.addEventListener('touchstart', _onFirstInteraction, { passive: true });

  /* ── Volume UI ──────────────────────────────────────────── */
  function _updateVolumeUI() {
    const slider = document.getElementById('audio-vol');
    const icon   = document.getElementById('audio-icon');
    if (slider) slider.value = _muted ? 0 : masterVol * 100;
    if (icon)   icon.textContent = _muted ? '🔇' : masterVol > 0.4 ? '🔊' : '🔉';
  }

  /* ── Auto-hook Screen.show ──────────────────────────────── */
  // Monkey-patch Screen after it is defined so music changes with screens
  function _hookScreens() {
    if (typeof Screen === 'undefined') return;
    const _orig = Screen.show;
    Screen.show = function(id) {
      _orig(id);
      const key = SCREEN_MAP[id];
      if (key) play(key);
    };
  }

  /* ── Auto-hook Scene.set ────────────────────────────────── */
  function _hookScenes() {
    if (typeof Scene === 'undefined') return;
    const _orig = Scene.set;
    Scene.set = function(key) {
      _orig(key);
      const musicKey = SCENE_MAP[key];
      if (musicKey) {
        _lastSceneKey = musicKey;   // remember for post-battle return
        play(musicKey);
      }
    };
  }

  /** Return the music key that was last triggered by a scene change. */
  function getLastScene() { return _lastSceneKey; }

  /* ── Init ───────────────────────────────────────────────── */
  function init() {
    _hookScreens();
    _hookScenes();

    // Wire the single global volume widget
    const slider = document.getElementById('audio-vol');
    const icon   = document.getElementById('audio-icon');
    if (slider) {
      slider.value = masterVol * 100;
      slider.addEventListener('input', () => { _muted = false; setVolume(slider.value / 100); });
    }
    if (icon) icon.addEventListener('click', toggleMute);

    _updateVolumeUI();
  }

  return { init, play, stop, oneShot, setVolume, toggleMute, isMuted, getLastScene };
})();
