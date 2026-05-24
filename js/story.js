/* ============================================================
   RESONATIA — js/story.js
   Revised narrative — Resonatia-Scripting (March 12, 2026 Campaign)
   Character sprites wired via CharSprite.show() / .setState() / .hide()
   ============================================================ */

'use strict';

/* ──────────────────────────────────────────────
   CLASS DATA
   ────────────────────────────────────────────── */
const CLASSES = {
  Wizard: {
    stats:   { STR: 8, INT: 16, CHA: 12, DEX: 13 },
    flavor:  'You have studied the arcane arts for decades. Your mind is your greatest weapon, and your tongue is almost as sharp. Physically frail but devastatingly clever.',
    archetype: 'INT'
  },
  Cleric: {
    stats:   { STR: 10, INT: 13, CHA: 15, DEX: 11 },
    flavor:  'Devoted to your deity, you walk between the mortal world and the divine. Your faith grants you persuasive power and healing grace.',
    archetype: 'CHA_INT'
  },
  Barbarian: {
    stats:   { STR: 17, INT: 9, CHA: 10, DEX: 13 },
    flavor:  'Rage is your religion. Where others deliberate, you act. Where others fear, you charge. Your raw strength commands respect — or terror.',
    archetype: 'STR'
  },
  Bard: {
    stats:   { STR: 10, INT: 11, CHA: 17, DEX: 14 },
    flavor:  'Every tavern is your stage. Every stranger a potential ally — or victim. Your voice can charm the most hardened soul, and your feet can carry you out before trouble starts.',
    archetype: 'CHA'
  }
};

/* ──────────────────────────────────────────────
   SPECIES DATA
   ────────────────────────────────────────────── */
const SPECIES = {
  Tiefling: {
    icon: '😈', bonus: { CHA: 2, INT: 1 }, bonusText: '+2 CHA, +1 INT',
    desc: 'Born of infernal pacts. Silver-tongued and sharp-eyed.'
  },
  Dwarf: {
    icon: '⛏️', bonus: { STR: 2 }, bonusText: '+2 STR',
    desc: 'Stubborn as stone. Strong as iron. Loyal as a mountain.'
  },
  Human: {
    icon: '🧑', bonus: { STR: 1, CHA: 1, INT: 1, DEX: 1 }, bonusText: '+1 to all stats',
    desc: 'Adaptable survivors with surprising versatility.'
  },
  Elf: {
    icon: '🧝', bonus: { DEX: 2, INT: 1 }, bonusText: '+2 DEX, +1 INT',
    desc: 'Ancient blood flows through ancient veins. Graceful and perceptive.'
  }
};

/* ──────────────────────────────────────────────
   QUIZ DATA
   ────────────────────────────────────────────── */
const QUIZ = [
  {
    q: 'A scholar approaches you with a riddle you cannot solve. What do you do?',
    opts: [
      { text: 'Spend hours puzzling it out alone — knowledge yields to patience.',  val: 'INT'     },
      { text: 'Pray for divine insight and trust the answer will come.',             val: 'CHA_INT' },
      { text: 'Smash the scholar\'s table and demand the answer directly.',          val: 'STR'     },
      { text: 'Flatter the scholar into revealing the answer themselves.',           val: 'CHA'     }
    ]
  },
  {
    q: 'You are outnumbered in a dark alley. Your first instinct is to…',
    opts: [
      { text: 'Cast an illusion — let them chase shadows.',                          val: 'INT'     },
      { text: 'Call upon your god and stand firm with faith.',                       val: 'CHA_INT' },
      { text: 'Roar, charge, and make them regret choosing you.',                    val: 'STR'     },
      { text: 'Talk your way out — silver words cost nothing.',                      val: 'CHA'     }
    ]
  },
  {
    q: 'Which treasure would you claim from a dragon\'s hoard?',
    opts: [
      { text: 'A tome of forbidden spells, bound in shadow-skin.',                   val: 'INT'     },
      { text: 'A divine relic that hums with holy light.',                           val: 'CHA_INT' },
      { text: 'A legendary war-axe that roars when swung.',                          val: 'STR'     },
      { text: 'A lute that plays itself — and compels audiences to tip.',             val: 'CHA'     }
    ]
  },
  {
    q: 'A noble offers you gold to spy on a city official. You…',
    opts: [
      { text: 'Accept — and research the official\'s secrets first.',                val: 'INT'     },
      { text: 'Consult your conscience and ask what truly serves justice.',          val: 'CHA_INT' },
      { text: 'Decline loudly, then challenge the noble to a fight.',               val: 'STR'     },
      { text: 'Accept — and negotiate a cut from both sides.',                       val: 'CHA'     }
    ]
  },
  {
    q: 'How do you face the unknown?',
    opts: [
      { text: 'I analyze every variable before I step forward.',                     val: 'INT'     },
      { text: 'I trust in something greater than myself.',                           val: 'CHA_INT' },
      { text: 'I step forward and deal with what comes.',                            val: 'STR'     },
      { text: 'I convince someone else to step forward first.',                      val: 'CHA'     }
    ]
  }
];

/* ──────────────────────────────────────────────
   CLASS DETERMINATION
   ────────────────────────────────────────────── */
function determineClass() {
  const map = {
    Wizard:    GameState.quizAnswers.INT,
    Cleric:    GameState.quizAnswers.CHA_INT,
    Barbarian: GameState.quizAnswers.STR,
    Bard:      GameState.quizAnswers.CHA
  };
  return Object.entries(map).sort((a, b) => b[1] - a[1])[0][0];
}

/* ──────────────────────────────────────────────
   STAT CALCULATION
   ────────────────────────────────────────────── */
function computeStats(cls, species) {
  const base  = { ...CLASSES[cls].stats };
  const bonus = SPECIES[species].bonus;
  const final = { ...base };
  Object.entries(bonus).forEach(([k, v]) => { final[k] = (final[k] || 0) + v; });
  return final;
}

function getModifier(value) {
  return Math.floor((value - 10) / 2);
}

/* ──────────────────────────────────────────────
   SHORTHAND LINE HELPERS
   ────────────────────────────────────────────── */
const N = (text) => Dialogue.line('Narrator', text, 'narrator');
const S = (speaker, text) => Dialogue.line(speaker, text, '');
const Y = (text) => Dialogue.line('You', text, '');

/* ─────────────────────────────────────────────
   SPRITE SHORTHAND HELPERS
   CS(defs) — show characters; e.g. CS([L('Kiave'), R('Ashrag')])
   ───────────────────────────────────────────── */
const L = (key, state = 'stance') => ({ key, state, side: 'left' });
const C = (key, state = 'stance') => ({ key, state, side: 'center' });
const R = (key, state = 'stance') => ({ key, state, side: 'right' });
const CS = (defs) => CharSprite.show(defs);

/* ══════════════════════════════════════════════
   ACT 0 — MONOLOGUE
   ══════════════════════════════════════════════ */
function act0_monologue() {
  Scene.set('title');
  CharSprite.hide();
  Dialogue.show([
    N('Listen well, for the winds of Elmenstria carry a new scent today.'),
    N('From the far reaches of the deep west — from the salt-sprayed shores of Pacifica and the ancient echoes of Ionia — travelers have crossed the threshold of the known world.'),
    N('Before you lies Jurnaheim. Its spires reach for the heavens, yet its shadows stretch much further.'),
    N('Within these walls, glory and mystery await the bold — but let it be known that a jagged, silent death waits just as patiently for the foolish.'),
    N('What becomes of you here? Even the Gods hold their breath, their tongues bound by a divine peace, waiting to see if you will become a legend... or a warning.')
  ], () => act1_arrive());
}

/* ══════════════════════════════════════════════
   ACT 1 — THE TAVERN
   ══════════════════════════════════════════════ */
function act1_arrive() {
  Scene.set('city');
  CharSprite.hide();
  const isElf = GameState.player.species === 'Elf';
  const runicText = isElf
    ? 'You have read the runic symbol many times — yet it defies understanding. Someone wanted a party dead, but the mark was not meant for you. You sought answers from your ancestors. They offered only silence... save for one whispered word: Jurnaheim.'
    : 'You couldn\'t make sense of the runic symbol — you assumed it was some holy Elven mark. Yet it planted a seed of curiosity. The local Elves you asked scrambled in fear, but some pointed toward Jurnaheim. You don\'t know why. But here you are.';

  Dialogue.show([
    N('Traveling from Pacifica, you have reached the City of Jurnaheim.'),
    N('The City of Illegal Drugs and Trading in the Black Market — at least, that is what the citizens of Ionia warned before you left.'),
    N('The reason for your trip? You picked up a runic symbol along the roads of Osovia. Its origin: unknown.'),
    N(runicText),
    N('You enter the first tavern you find. Mediocre, as taverns go. The usual crowd: drunken adventurers, duelists eager to fight everyone, and the kind of people you don\'t want to talk to nor mess with.'),
    N('Two figures catch your eye...')
  ], () => act1_choices());
}

function act1_choices() {
  Scene.set('tavern');
  CharSprite.hide();
  Dialogue.show([N('You survey the tavern. Who do you approach?')], () => {
    Dialogue.showChoices([
      { text: 'A) The Tiefling Rogue — missing an arm, silver prosthetic leg, eyes shut, drinking alone.', action: () => act1_tiefling() },
      { text: 'B) The Tavern Waitress — she seems to have information to share.',                            action: () => act1_waitress() }
    ]);
  });
}

/* ── ACT 1-A: TIEFLING ROGUE ──────────────────── */
function act1_tiefling() {
  Scene.set('tiefling');
  CharSprite.hide(); // No Tiefling sprite provided
  Dialogue.show([
    N('You approach the Tiefling Rogue who has been drinking for a while — Tieflings can hold their drink, as they say. She gives you a disagreeable sneer.'),
    S('Tiefling Rogue', `What do you want, ${GameState.player.species}? I don't want to join your party.`)
  ], () => {
    Dialogue.showChoices([
      { text: '(30) Ask nicely about the runic.',                           dc: 12, stat: 'CHA', action: () => tiefling_ask() },
      { text: '(50) Show her the runic and try to convince her.',           dc: 14, stat: 'CHA', action: () => tiefling_persuade() },
      { text: '(40) Ask for a duel — information in exchange for a win.',   dc: 14, stat: 'STR', action: () => tiefling_duel() }
    ]);
  });
}

function tiefling_reveal() {
  /* Shared success scene — all three Tiefling approaches converge here */
  GameState.player.flags.tieflingWarned = true;
  Dialogue.show([
    N('As the Tiefling inspected the runic, her hands trembled. Fear and death mixed across her face — you could feel her terror.'),
    S('Tiefling Rogue', 'How did you get this?'),
    Y('I don\'t really know, I just picked this up. I just want some information—'),
    S('Tiefling Rogue', 'DID YOU KNOW THIS RUNIC KILLED MY PARTY MEMBERS? MY FRIENDS? MY FAMILY? THE ONLY REMAINDER OF THE EVENT WAS MY MISSING EYES AND LIMBS!'),
    N('The whole tavern went silent and looked at the scene unfolding.'),
    Y('I just really wanted to know. I\'m sorry it happened to you. I\'m also seeking knowledge about it.'),
    S('Tiefling Rogue', 'Take my advice, kid. Destroy that runic. Or put it back where you picked that shit from.'),
    N('The Tiefling left as the tavern continued its business. You were left with chilling, scarce information: the runic carries death.')
  ], () => act2_guild());
}

function tiefling_ask() {
  Dice.check('CHA', 12, 'Charisma — Ask Nicely (DC 12)',
    () => {
      updateScore(30);
      Dialogue.show([S('Tiefling Rogue', 'Fine. Let me see. It\'s not like I can give you any information.')], () => tiefling_reveal());
    },
    () => {
      Dialogue.show([
        S('Tiefling Rogue', 'Nice try. But you should leave — you reek of attention.'),
        N('She turns away. You try another approach.')
      ], () => act1_choices_retry());
    }
  );
}

function tiefling_persuade() {
  Dice.check('CHA', 14, 'Persuasion — Convince Her (DC 14)',
    () => {
      updateScore(50);
      Dialogue.show([S('Tiefling Rogue', 'Fine. Show me then.')], () => tiefling_reveal());
    },
    () => {
      Dialogue.show([
        S('Tiefling Rogue', 'Nice try. But you should leave — you reek of attention.'),
        N('She turns away.')
      ], () => act1_choices_retry());
    }
  );
}

function tiefling_duel() {
  Dice.check('STR', 14, 'Athletics — Challenge to Duel (DC 14)',
    () => {
      updateScore(40);
      Dialogue.show([
        S('Tiefling Rogue', 'Alright. If you win, I\'ll tell you. If you don\'t — fucking scram.'),
        N('The brawl is brief, brutal, and beautiful. You win — barely.')
      ], () => tiefling_reveal());
    },
    () => {
      Dialogue.show([
        S('Tiefling Rogue', 'We had our deal. Fucking scram and never come near me again.'),
        N('The tavern chuckles. You retreat, bruised.')
      ], () => act1_choices_retry());
    }
  );
}

/* ── ACT 1-B: TAVERN WAITRESS ─────────────────── */
function act1_waitress() {
  Scene.set('waitress');
  CharSprite.hide(); // No waitress sprite provided
  Dialogue.show([
    N('You approach the Tavern Waitress who seems to be waiting for another service.'),
    S('Tavern Waitress', 'What do you want?'),
    Y('Could you tell me about what\'s in this runic?'),
    S('Tavern Waitress', 'That\'s cursed. Might want to report that to the Adventurers\' Guild. Just go straight ahead and they\'ll be there.'),
    N('Short, direct, and clear. You have a direction.')
  ], () => act2_guild());
}

function act1_choices_retry() {
  Dialogue.show([N('You consider your options again...')], () => act1_choices());
}

/* ══════════════════════════════════════════════
   ACT 2 — THE ADVENTURER'S GUILD
   ══════════════════════════════════════════════ */
function act2_guild() {
  Scene.set('guild');
  CS([L('Kiave'), R('Shaira')]);
  Dialogue.show([
    N('Following the waitress\'s lead — or perhaps driven by the Tiefling\'s chilling warning — you find yourself before the heavy oak doors of the Jurnaheim Adventurers\' Guild.'),
    N('The air smells of old parchment, iron, and the sweat of people making a living out of danger.'),
    N('Behind the main desk, two Elves are deep in discussion over a sprawling map. One counts gold with surgical precision; the other sharpens a dagger with a rhythmic shink-shink-shink.'),
    N('You see:')
  ], () => {
    Dialogue.showChoices([
      { text: 'Kiave — sharp-eyed Elf with silver-rimmed spectacles, managing the Guild\'s ledgers. (60)', action: () => act2_kiave_approach() },
      { text: 'Shaira — restless Elf with battle-scarred armor, leaning against the counter. (40)',         action: () => act2_shaira_approach() }
    ]);
  });
}

/* ── ACT 2-A: KIAVE ───────────────────────────── */
function act2_kiave_approach() {
  CS([C('Kiave')]);
  Dialogue.show([
    Y('Excuse me. I was told I could find answers here regarding a certain runic symbol.'),
    S('Kiave', '(Without looking up) Knowledge is the most expensive commodity in Jurnaheim, traveler. Unless you\'re here to register a party or settle a debt, my ledgers are closed.')
  ], () => {
    Dialogue.showChoices([
      { text: '(30) Offer gold for his time.',                               dc: 12, stat: 'CHA', action: () => kiave_gold() },
      { text: '(50) Present the runic immediately — no roll, but a risk.',   action: () => kiave_present_runic() },
      { text: '(40) Mention the Tiefling Rogue from the Tavern.',            dc: 13, stat: 'CHA', action: () => kiave_mention_tiefling() }
    ]);
  });
}

function kiave_gold() {
  Dice.check('CHA', 12, 'Persuasion — Offer Gold (DC 12)',
    () => {
      updateScore(30);
      GameState.player.flags.kiaveBond = true;
      CS([C('Kiave')]);
      Dialogue.show([
        S('Kiave', '(Sighs and closes the book) Money speaks louder than curiosity. Let me see it.')
      ], () => guild_reveal());
    },
    () => {
      Dialogue.show([
        S('Kiave', 'That\'s hardly enough to warrant my attention, traveler.'),
        N('He returns to his ledger. You try a different approach.')
      ], () => act2_kiave_approach());
    }
  );
}

function kiave_present_runic() {
  updateScore(50);
  GameState.player.flags.kiaveBond = true;
  CS([C('Kiave')]);
  Dialogue.show([
    N('You place the runic on the desk without a word. Kiave\'s eyes snap to it immediately.'),
    S('Kiave', '(Adjusts spectacles, face turning pale) Where did you find this? This isn\'t just a rune — it\'s a signature of the "Silent Descent."'),
    N('The scratch of Shaira\'s dagger goes still.')
  ], () => guild_reveal());
}

function kiave_mention_tiefling() {
  Dice.check('CHA', 13, 'Charisma — Mention the Tiefling (DC 13)',
    () => {
      updateScore(40);
      GameState.player.flags.kiaveBond = true;
      CS([C('Kiave')]);
      const line = GameState.player.flags.tieflingWarned
        ? 'So... that old rogue is still drinking her memories away? If she spoke to you about this, it must be grave. Show me.'
        : 'A Tiefling Rogue with missing limbs, you say? (His pen stops) If she reacted to that symbol, it must be more than grave. Show me.';
      Dialogue.show([S('Kiave', line)], () => guild_reveal());
    },
    () => {
      Dialogue.show([
        S('Kiave', 'I don\'t know what Tiefling you\'re referring to. Move along.'),
        N('He waves you off.')
      ], () => act2_kiave_approach());
    }
  );
}

/* ── ACT 2-B: SHAIRA ──────────────────────────── */
function act2_shaira_approach() {
  CS([C('Shaira')]);
  Dialogue.show([
    Y('You look like someone who knows their way around a mystery.'),
    S('Shaira', '(Stops sharpening) I know my way around a blade. Mysteries usually lead to funerals. What\'s it to you?')
  ], () => {
    Dialogue.showChoices([
      { text: '(30) Flatter her skills.',                                               dc: 12, stat: 'CHA', action: () => shaira_flatter() },
      { text: '(50) Ask about the "Silent Death" mentioned in Elmenstria.',             dc: 14, stat: 'INT', action: () => shaira_silent_death() },
      { text: '(40) Show her the runic directly.',                                      action: () => shaira_show_runic() }
    ]);
  });
}

function shaira_flatter() {
  Dice.check('CHA', 12, 'Charisma — Flatter Her Skills (DC 12)',
    () => {
      updateScore(30);
      GameState.player.flags.shairaBond = true;
      CS([C('Shaira')]);
      Dialogue.show([
        S('Shaira', '(Laughs — a bright sound that makes Kiave wince) Darling, in Jurnaheim, you either laugh at the shadows or they eat you. I choose to laugh! It keeps the skin glowing and the enemies confused. Now, what\'s that sparkle in your pocket?')
      ], () => guild_reveal());
    },
    () => {
      CS([C('Shaira')]);
      Dialogue.show([
        S('Shaira', 'Aww, you\'re cute, but you\'re a bit dull, aren\'t you? No fire in the belly! Where\'s the passion?'),
        Y('I just need the information.'),
        N('Shaira shrugs and resumes sharpening. You try again.')
      ], () => act2_shaira_approach());
    }
  );
}

function shaira_silent_death() {
  Dice.check('INT', 14, 'History — Ask About the Silent Death (DC 14)',
    () => {
      updateScore(50);
      GameState.player.flags.shairaBond = true;
      CS([C('Shaira')]);
      Dialogue.show([
        S('Shaira', '(Eyes light up like a child seeing a holiday gift) Osovia! Ooh, spicy! Nobody goes there unless they\'re looking for a legendary story or a very quick way to meet the Gods. Show me, show me! I love a good mystery.')
      ], () => guild_reveal());
    },
    () => {
      CS([C('Shaira')]);
      Dialogue.show([
        S('Shaira', 'Aww, you\'re cute, but you\'re a bit dull. No fire in the belly! You\'re talking about Osovia like you\'re reading a grocery list. Where\'s the "I\'m-about-to-die-but-it\'s-okay" energy?'),
        Y('I just need the information.'),
        N('Shaira looks unimpressed. You try another approach.')
      ], () => act2_shaira_approach());
    }
  );
}

function shaira_show_runic() {
  updateScore(40);
  GameState.player.flags.shairaBond = true;
  CS([C('Shaira')]);
  Dialogue.show([
    N('You pull out the runic and set it on the counter. Shaira\'s dagger goes quiet.'),
    S('Shaira', 'Only on days ending in \'y\'! Life is too short to be as miserable as Kiave over there. (She leans closer, whispering) I think his heart is actually a small, very organized rock.'),
    N('But then she leans in toward the runic — and her teasing fades entirely.')
  ], () => guild_reveal());
}

/* ── GUILD REVEAL — both Kiave and Shaira paths converge ── */
function guild_reveal() {
  Scene.set('guild');
  CS([L('Kiave'), R('Shaira')]);
  Dialogue.show([
    N('Kiave and Shaira exchange a glance that carries more weight than words. The tension in the room shifts. The other adventurers nearby suddenly find their boots very interesting.'),
    S('Shaira', 'That runic... it\'s linked to the Osovia disappearance cases. We\'ve been tracking the source, but the trail always ends in blood.'),
    S('Kiave', 'It\'s an Echo Runic. It doesn\'t just store power — it records the final moments of those nearby. That Tiefling\'s family? Their essences were harvested.'),
    S('Shaira', '(Grabbing her cloak) If you have that thing on you, you\'re not just a traveler anymore. You\'re a beacon. And the things that follow that light don\'t knock on doors.'),
    S('Kiave', 'We were supposed to head out at dawn. But since you\'ve brought the trouble to our doorstep, I suppose we\'re starting early.'),
    Y('Starting what?'),
    S('Shaira', '(Grinning dangerously) Your survival training. Or your funeral. Depending on how well you can run.'),
    N('Kiave begins packing a specialized containment case for the runic. Shaira checks her blade one last time. You came for information — but it seems you\'ve gained two allies, and a much larger target on your back.')
  ], () => act3_forest());
}

/* ══════════════════════════════════════════════
   ACT 3 — THE WHISPERING WILDS OF OSOVIA
   ══════════════════════════════════════════════ */
function act3_forest() {
  Scene.set('forest');
  CS([L('Kiave'), R('Shaira')]);
  Dialogue.show([
    N('The journey from Jurnaheim to the outskirts of Osovia takes three days. The air here is different — thick and heavy, like the atmosphere before a thunderstorm that never arrives.'),
    N('The trees in the Osovia Forest don\'t sway with the wind. They seem to lean toward you as you pass.'),
    S('Shaira', '(Skipping over a fallen rotted log) Oh, look at these mushrooms! They only grow near burial sites. Aren\'t they the loveliest shade of "You\'re-In-Trouble" Purple?'),
    S('Kiave', '(Checking a compass and a map) Focus, Shaira. The ley lines are distorted here. The runic is vibrating in the traveler\'s bag. We are close to the cave entrance.'),
    N('You reach a clearing. The entrance to the Osovia Hollows looms before you — a jagged mouth carved into the hillside.')
  ], () => act3_cave_entrance());
}

function act3_cave_entrance() {
  Scene.set('cave_entrance');
  CS([L('Kiave'), R('Shaira')]);
  Dialogue.show([
    S('Shaira', '(Turning to you, beaming) Alright, partner! Before we go into the dark, scary hole where you found that cursed little treasure... how are you feeling? Scale of one to ten: One being "I want to go home to my bed," and ten being "I am ready to punch a God in the face!"')
  ], () => {
    Dialogue.showChoices([
      { text: '(30) "I\'m with you. Let\'s finish this." — Rally with Shaira.',        dc: 12, stat: 'CHA', action: () => cave_rally_shaira() },
      { text: '(40) "I\'m worried about the Tiefling\'s warning." — Side with Kiave.', dc: 13, stat: 'INT', action: () => cave_side_kiave() },
      { text: '(50) [Inspect the cave entrance for traps before entering.]',            dc: 14, stat: 'DEX', action: () => cave_inspect_traps() }
    ]);
  });
}

function cave_rally_shaira() {
  Dice.check('CHA', 12, 'Charisma — Rally With Shaira (DC 12)',
    () => {
      updateScore(30);
      GameState.player.flags.shairaBond = true;
      CS([L('Kiave'), R('Shaira', 'attack')]);
      Dialogue.show([
        S('Shaira', '(She punches your arm playfully) That\'s the spirit! If we die, I\'m making sure the bards know you went down swinging. Kiave, look! Our traveler has a backbone!'),
        S('Kiave', 'A backbone is useless without a plan, Shaira. But... it is preferable to cowardice.')
      ], () => act35_descent());
    },
    () => {
      CS([L('Kiave'), R('Shaira')]);
      Dialogue.show([
        S('Shaira', '(Pouting) Aw, you\'re getting the "Osovia Shakes," aren\'t you? Your knees are knocking louder than my dagger hits the stone!'),
        S('Kiave', 'It\'s understandable. This place is designed to invoke dread. Step behind me, traveler.')
      ], () => act35_descent());
    }
  );
}

function cave_side_kiave() {
  Dice.check('INT', 13, 'Insight — Heed the Tiefling\'s Warning (DC 13)',
    () => {
      updateScore(40);
      GameState.player.flags.kiaveBond = true;
      CS([L('Kiave'), R('Shaira')]);
      Dialogue.show([
        S('Kiave', '(Nods slowly) Wisdom. The Tiefling lost more than just her limbs — she lost her soul\'s tether. We must ensure the runic doesn\'t find a similar grip on us.'),
        S('Shaira', 'Boo! Don\'t listen to him. He\'s such a buzzkill. We\'ll just stay in the light!')
      ], () => act35_descent());
    },
    () => {
      CS([L('Kiave'), R('Shaira')]);
      Dialogue.show([
        S('Shaira', '(Pouting) Aw, you\'re getting the "Osovia Shakes."'),
        S('Kiave', 'It\'s understandable. Step behind me, traveler. Try not to trip over your own feet.')
      ], () => act35_descent());
    }
  );
}

function cave_inspect_traps() {
  Dice.check('DEX', 14, 'Perception — Inspect for Traps (DC 14)',
    () => {
      updateScore(50);
      GameState.player.flags.trapAware = true;
      CS([L('Kiave'), R('Shaira', 'attack')]);
      Dialogue.show([
        N('You notice faint glowing residue on the rocks — not magic, but slime. Something has been dragging heavy weight into this cave recently.'),
        S('Shaira', 'Oh! A tracker! (She claps) Kiave, they\'re actually useful! Maybe I won\'t have to carry you out after all!')
      ], () => act35_descent());
    },
    () => {
      CS([L('Kiave'), R('Shaira')]);
      Dialogue.show([
        S('Shaira', '(Pouting) Aw, you\'re getting the "Osovia Shakes."'),
        S('Kiave', 'It\'s understandable. This place is designed to invoke dread.')
      ], () => act35_descent());
    }
  );
}

/* ══════════════════════════════════════════════
   ACT 3.5 — THE DESCENT
   ══════════════════════════════════════════════ */
function act35_descent() {
  Scene.set('inside_cave');
  CS([L('Kiave'), R('Shaira')]);
  Dialogue.show([
    N('You enter the cave. The light of Shaira\'s torch flickers, casting long dancing shadows against the walls. As you reach the spot where you first found the runic, the stone begins to hum.'),
    S('Shaira', '(Whispering, but still sounding excited) Okay, look! The walls... they\'re covered in the same carvings as your little rock! It\'s like a giant stone puzzle!'),
    S('Kiave', '(Stopping dead in his tracks) This isn\'t a cave. It\'s a sarcophagus. And we just walked right into the throat of it.'),
    N('From the darkness ahead, you hear a sound. Not a growl. The sound of someone — or something — whispering your name in a voice like grinding stone.'),
    S('Shaira', '(Drawing her daggers with a wide, manic grin) Ooh! Guests! I hope they\'re friendly, but I\'m betting they\'re not! Kiave, lights? Traveler, get ready to show me what you\'ve got!')
  ], () => act35_combat_start());
}

function act35_combat_start() {
  Battle.start({
    background: 'inside_cave',
    allies: [
      { key: 'Kiave' },
      { key: 'Shaira' }
    ],
    enemies: [
      { key: 'Bullywug', count: 2 },
      { key: 'Beast',    count: 1 }
    ],
    intro: [
      N('COMBAT — THE HOLLOWED SENTINELS'),
      N('Bullywugs drop from the cave walls. A Beast crashes through the darkness behind them. Kiave\'s staff blazes with light — but there are too many.'),
      N('Make your call.')
    ],
    preBattle: [
      {
        text:   'Strike hard — use raw force to break their formation. (STR DC 13)',
        stat:   'STR', dc: 13,
        successLines: [ N('You smash through the first wave. Strength clears a path and Shaira follows in your wake.'), S('Shaira', 'Ha! You\'re actually good at this! Kiave, make a note!') ],
        failLines:    [ N('You overextend. A Bullywug drags you down before Shaira hauls you back to your feet.'), S('Shaira', 'Stay behind me! I\'ll clear the path!') ],
        successBuff:  { accuracyBonus: 15, staminaBonus: 10 },
        failBuff:     { hpPenalty: 12, accuracyBonus: -5 }
      },
      {
        text:   'Coordinate with Kiave\'s magic — hold the line tactically. (INT DC 12)',
        stat:   'INT', dc: 12,
        successLines: [ N('You call out flanking positions. Kiave\'s magic seals the rear. The Bullywugs are funneled into Shaira\'s blades. The Beast crashes blindly into a wall.'), S('Kiave', 'Well coordinated. Surprisingly.') ],
        failLines:    [ N('Your orders get tangled. Shaira\'s instincts hold the line while Kiave seals the rear.'), S('Shaira', 'Louder next time, yeah?') ],
        successBuff:  { damageMultBonus: 1.2, enemyHpMult: 0.85 },
        failBuff:     { hpPenalty: 8, staminaBonus: -5 }
      }
    ],
    onWin:  () => { updateScore(40); act4_whispers(); },
    onLose: () => { updateScore(-20); act4_whispers(); }
  });
}


/* ══════════════════════════════════════════════
   ACT 4 — THE ROOM OF WHISPERS
   ══════════════════════════════════════════════ */
function act4_whispers() {
  Scene.set('cultist_room');
  CS([L('Shaira')]);
  Dialogue.show([
    N('The chamber is lit by a sickly violet glow from braziers placed at the points of a massive etched pentagram. The air is thick with the metallic tang of old blood and the cloying scent of burnt sage.'),
    N('You follow the path upward — and as you round the final pillar into the ritual center, an unnatural cold snuffs out your torches.'),
    S('Shaira', '(Laughing nervously) Oh! Is it lights-out time already? Kiave, honey, give us a little spark, would you?'),
    N('Silence. Not even the sound of breathing comes from where the silver-haired Elf was standing just a second ago.'),
    S('Shaira', '(Her voice tightening) Kiave? This isn\'t a great time for your "stoic silence" bit!'),
    N('You reach out into the darkness. Your hand meets only empty, freezing air. Kiave is gone. No scuffle. No cry for help. Just a hollow space where he once stood.'),
    S('Shaira', '(Drawing her daggers — the click of the steel sounding frantic) Okay... okay! New plan! We find the grumpy one, we kill the cultists, and then we have a very long talk about personal space!')
  ], () => act4_kiave_gone());
}

function act4_kiave_gone() {
  Dialogue.showChoices([
    { text: '(30) "He\'s a powerful mage, Shaira. He might be hiding."',              dc: 12, stat: 'CHA', action: () => whispers_calm_shaira() },
    { text: '(40) "Look at the floor — his footsteps just... stop."',                 dc: 14, stat: 'DEX', action: () => whispers_find_clue() },
    { text: '(50) [Focus on the runic — it begins to burn through your bag.]',        action: () => whispers_runic_flare() }
  ]);
}

function whispers_calm_shaira() {
  Dice.check('CHA', 12, 'Charisma — Calm Shaira (DC 12)',
    () => {
      updateScore(30);
      GameState.player.flags.shairaBond = true;
      CS([L('Shaira')]);
      Dialogue.show([
        S('Shaira', '(She takes a shaky breath, grin returning but strained) Right. Right! He\'s probably just... invisible. Doing that smart-guy stuff. We just have to keep the party going until he decides to show up!')
      ], () => act4_party_reveal());
    },
    () => {
      CS([L('Shaira', 'attack')]);
      Dialogue.show([
        S('Shaira', '(Shaking her head) He\'s not hiding. Something took him. We move.')
      ], () => act4_party_reveal());
    }
  );
}

function whispers_find_clue() {
  Dice.check('DEX', 14, 'Perception — Find a Clue (DC 14)',
    () => {
      updateScore(40);
      CS([L('Shaira')]);
      Dialogue.show([
        N('You look where Kiave last stood. His footprints in the dust end abruptly at the edge of the ritual circle. There are no signs of a struggle — but a single silver spectacle lens lies on the stone. It\'s cracked.'),
        S('Shaira', '(Eyes widen) He didn\'t hide. He was taken.')
      ], () => act4_party_reveal());
    },
    () => {
      CS([L('Shaira', 'attack')]);
      Dialogue.show([
        N('The darkness gives up nothing. You find no trace of where Kiave went.'),
        S('Shaira', 'Move. We have to move.')
      ], () => act4_party_reveal());
    }
  );
}

function whispers_runic_flare() {
  updateScore(50);
  CS([L('Shaira', 'attack')]);
  Dialogue.show([
    N('The runic erupts with heat in your bag — scorching through the leather. You tear it free and grip it. It pulses in your hand like a second heartbeat.'),
    S('Shaira', '(Eyes wide) Is it... reacting to this place? To whatever took Kiave?'),
    N('The runic grows hotter. The violet braziers flicker in response.')
  ], () => act4_party_reveal());
}

function act4_party_reveal() {
  CS([L('Shaira', 'injured')]);
  Dialogue.show([
    N('As your eyes adjust to the violet brazier light, you see them. Pinned to the stone walls like macabre specimens are the remains of the Tiefling\'s party.'),
    S('Shaira', '(Stops dead — her manic energy flickering like a dying candle) Is that... Sully? (She walks toward a body missing its eyes and limbs) He was the fastest runner in Pacifica. He told me he\'d never get caught.'),
    Y('Shaira, we have to move.'),
    S('Shaira', '(She turns to you — for the first time, her "happy gal" mask completely shatters. Her eyes shimmer with tears even as she forces a wide, jagged smile.) They didn\'t just kill them, partner. They... they harvested them. Look at the carvings on their chests. It\'s the same as your runic.')
  ], () => act45_harvest());
}

/* ══════════════════════════════════════════════
   ACT 4.5 — THE HARVEST BEGINS
   ══════════════════════════════════════════════ */
function act45_harvest() {
  CS([L('Shaira', 'attack'), R('Barkling')]);
  Dialogue.show([
    N('From the high vaulted ceiling, the shadows begin to detach. Hooded figures in bone-stitched robes drift down like dead leaves.'),
    S('Cultist', '"One light has already been snuffed... the Silver Scholar is being \'refined.\' But the Marker has brought us two more vibrant souls. Such a lovely, happy one, too."'),
    S('Shaira', '(Her grip tightens on her daggers until her knuckles turn white) You heard the man, partner! They think I\'m \'vibrant\'!'),
    N('She spins toward the descending figures, her movements becoming a blur of desperate, high-speed violence.'),
    S('Shaira', '(Screaming with a manic laugh) HEY! If you wanted an invite to the party, all you had to do was ask! Who wants to be the first to lose their head?!')
  ], () => act45_combat());
}

function act45_combat() {
  Battle.start({
    background: 'cultist_room',
    allies: [
      { key: 'Shaira' }
    ],
    enemies: [
      { key: 'Barkling',  count: 2 },
      { key: 'Bullywug',  count: 1 }
    ],
    intro: [
      N('COMBAT — THE DESPERATE DUO'),
      N('Kiave is MISSING. You fight without Magic or Defense buffs. Shaira fights in FRENZY.'),
      N('Choose your approach.')
    ],
    preBattle: [
      {
        text:   'Guard Shaira\'s back — keep the cultists off her. (STR DC 13)',
        stat:   'STR', dc: 13,
        successLines: [ N('You plant yourself at Shaira\'s back. Cultists crash against you and bounce away. Shaira\'s blades flash without mercy.'), S('Shaira', '(Panting, eyes wild) You held. I didn\'t actually expect you to hold.') ],
        failLines:    [ N('A Barkling hits you hard. You stagger. Shaira pivots and pulls you behind her, taking a slash meant for you.'), S('Shaira', '(Hissing through her teeth) I\'m fine! Stay close!') ],
        successBuff:  { accuracyBonus: 12, staminaBonus: 15 },
        failBuff:     { hpPenalty: 15, accuracyBonus: -8 }
      },
      {
        text:   'Flank the cultists to divide their attention. (DEX DC 14)',
        stat:   'DEX', dc: 14,
        successLines: [ N('You dart around the ritual pillars. The cultists divide — and Shaira tears through the confused half like paper.'), N('The chamber falls silent momentarily.') ],
        failLines:    [ N('You lose your footing in the dark. A Beast pins you until Shaira drives a dagger into its shoulder.'), S('Shaira', 'Get UP! He\'s in the back alcove — I can feel it!') ],
        successBuff:  { enemyHpMult: 0.80, damageMultBonus: 1.15 },
        failBuff:     { hpPenalty: 18, staminaBonus: -10 }
      }
    ],
    onWin:  () => { updateScore(50); act5_unmasking(); },
    onLose: () => { updateScore(-20); act5_unmasking(); }
  });
}


/* ══════════════════════════════════════════════
   ACT 5 — THE UNMASKING OF ASHRAG
   ══════════════════════════════════════════════ */
function act5_unmasking() {
  Scene.set('cultist_room');
  CS([L('Shaira'), R('Ashrag')]);
  Dialogue.show([
    N('Shaira carves through the final cultist and rushes toward the dark alcove at the back of the chamber.'),
    S('Shaira', 'Kiave! We\'re here! Stop playing hide-and-seek and—'),
    N('She stops. A figure emerges from the deepest shadow. It wears Kiave\'s robes — but the movements are wrong. Twitchy. Elongated. Silent.'),
    N('As the figure steps into the brazier light, you see that the cracked lens wasn\'t dropped. It was pushed out of a face that is no longer Elven.'),
    S('Kiave (?)', '(Voice a dissonant chorus of a thousand whispers) The Scholar was such a brittle shell. He spent so much time cataloging the "Silent Death" that he forgot to check if the silence was listening back.'),
    S('Shaira', '(Her daggers tremble in her hands) Kiave? No... what did they do to you?'),
    S('Kiave / Ashrag', '(Skin pulling back, revealing runic carvings etched directly into bone; eyes dissolving into pools of oily black ink) Kiave is a record in a book that has been burned. I am Ashrag. I am the Echo of what you fear most.')
  ], () => act5_runic_snap());
}

function act5_runic_snap() {
  CS([L('Shaira', 'attack'), R('Ashrag', 'attack')]);
  Dialogue.show([
    N('The runic in your bag suddenly erupts in a blinding flash of white heat. It flies from your possession and snaps into place on Ashrag\'s chest — fitting perfectly into a hollow where a heart should be.'),
    N('Ashrag lunges. The greatsword — a jagged blackened slab of obsidian etched with pulsing red runes — whistles through the air with the sound of a falling guillotine.'),
    S('Ashrag', '"A scholar\'s mind was a cage. But this weight? This is reality."'),
    S('Shaira', '(Her daggers gone — replaced by the long elven blade kept sheathed on her back, knuckles white) "You\'re going to need a bigger sword than that to keep me down, you ink-stained freak!"')
  ], () => act5_boss_battle());
}

/* ── BOSS BATTLE ──────────────────────────────── */
function act5_boss_battle() {
  Battle.start({
    background: 'cultist_room',
    allies: [
      { key: 'Shaira' }
    ],
    enemies: [
      { key: 'Ashrag', count: 1 }
    ],
    // Kiave is absent — player gets compensation buffs (always applied, stack with preBattle outcome)
    baseBuffs: {
      accuracyBonus:   40,    // +8 to every d20 attack roll
      damageMultBonus: 1.2,   // +20% damage
      staminaBonus:    15     // +15 SP head-start
    },
    intro: [
      N('BOSS BATTLE — ASHRAG, THE ECHO'),
      N('Ashrag is not like the creatures before. He is the rune made flesh — the silence given a mouth. Every hit you land shatters a piece of what was once your companion.'),
      N('Kiave is gone — but the scholar\'s last lessons echo in your hands. You feel sharper. Steadier. Your strikes find purchase where they shouldn\'t.'),
      N('Shaira fights at your side. But you must decide how to open this fight.')
    ],
    preBattle: [
      {
        text:   '"Shaira, draw his fire! I\'ll strike when he overextends!" (INT DC 12)',
        stat:   'INT', dc: 12,
        successLines: [ S('Shaira', '(Begins a dizzying dance of steel) "Hey! Over here, you big slow shadow!"'), N('Ashrag roars and swings wildly. He misses — burying his greatsword in a stone pillar. A moment of vulnerability opens.'), S('Shaira', '"NOW! TAKE THE SHOT!"') ],
        failLines:    [ N('The timing is off. Ashrag ignores your call and swings at Shaira. She barely rolls beneath the blade.'), S('Shaira', '(Breathless) New plan — on the fly!') ],
        successBuff:  { accuracyBonus: 18, damageMultBonus: 1.2 },
        failBuff:     { hpPenalty: 20, accuracyBonus: -10 }
      },
      {
        text:   '[Parry the Greatsword with your own weapon.] — HIGH RISK (STR DC 16)',
        stat:   'STR', dc: 16,
        successLines: [ N('The impact vibrates through your very marrow. Your weapon groans under the weight of the obsidian greatsword — but you hold.'), S('Ashrag', '"Impressive... but brittle."'), S('Shaira', '(Sliding in from the side) "Focus on me, ugly!"') ],
        failLines:    [ N('The greatsword smashes through your guard. You are thrown back against the ritual altar, coughing blood.'), S('Shaira', '(Screaming) "NO!" (She throws herself into a reckless flurry to keep him away from you).') ],
        successBuff:  { accuracyBonus: 10, damageMultBonus: 1.35, staminaBonus: 20 },
        failBuff:     { hpPenalty: 30, accuracyBonus: -15 }
      },
      {
        text:   '"That sword is powered by the Runic on his chest! Aim for it!" (DEX DC 14)',
        stat:   'DEX', dc: 14,
        successLines: [ N('You shout the location of the Runic core to Shaira. Her eyes snap to it. Understanding floods her face.'), S('Shaira', '(Grinning fiercely) The heart! I see it! That\'s where you live, isn\'t it, you ugly shadow?') ],
        failLines:    [ N('Your voice is lost in the roar of combat. Ashrag\'s next swing nearly takes your head off.'), S('Shaira', '(Rolling away from the blade) Keep moving!') ],
        successBuff:  { enemyHpMult: 0.75, accuracyBonus: 12 },
        failBuff:     { hpPenalty: 15, staminaBonus: -15 }
      }
    ],
    onWin:  () => { updateScore(80); act5_final_blow(); },
    // Player death in the final battle is no longer narrative — it triggers
    // the Game Over modal instead of falling through to the assessment report.
    onLose: () => { updateScore(-40); GameOver.show(); }
  });
}


/* ── THE FINAL BLOW ───────────────────────────── */
function act5_final_blow() {
  CS([L('Shaira', 'attack'), R('Ashrag', 'attack')]);
  Dialogue.show([
    N('Ashrag raises his greatsword for a final overhead execution. The runes on the blade glow a blinding, murderous red. He isn\'t just trying to kill you — he\'s trying to erase you from existence.'),
    S('Ashrag', '"SILENCE FALLS FOR ALL!"'),
    S('Shaira', '(She doesn\'t dodge this time. She sprints straight at him, her sword pointed like a needle.) "NOT TODAY!"'),
    N('As Ashrag brings the heavy slab of obsidian down, Shaira slides across the blood-slicked floor, passing between his legs. In one fluid motion, she rises and drives her sword upward — through the gaps of his transformed armor and straight into the Runic core.'),
    S('Ashrag', '(A horrific, distorted scream — part Kiave, part monster) "The... winds... stop..."'),
    N('The obsidian greatsword shatters into a thousand shards of glass. Ashrag\'s form dissolves into thick black mist — sucked back into the earth — leaving nothing but a tattered silver-trimmed cloak and a broken pair of spectacles.')
  ], () => {
    CS([C('Shaira', 'injured')]);
    Dialogue.show([
      S('Shaira', '(Standing there, breathing hard, sword trembling as she lowers it) It\'s over. The forest... the forest is quiet again.')
    ], () => act_epilogue());
  });
}

/* ══════════════════════════════════════════════
   EPILOGUE — THE JOURNEY BACK TO JURNAHEIM
   ══════════════════════════════════════════════ */
function act_epilogue() {
  Scene.set('forest');
  CS([C('Shaira', 'injured')]);
  Dialogue.show([
    N('The walk back to Jurnaheim is nothing like the journey out.'),
    N('There are no jaunty tunes, no skipping over rotted logs, and the "You\'re-In-Trouble" Purple mushrooms have shriveled into gray ash.'),
    N('The forest of Osovia hasn\'t become friendly — it has simply become hollow.'),
    N('You carry the weight of your pack. But the heaviest thing you own is the silence walking beside you.')
  ], () => calculateEnding());
}

/* ══════════════════════════════════════════════
   ENDING CALCULATOR
   ══════════════════════════════════════════════ */
function calculateEnding() {
  CharSprite.hide();
  const s = GameState.player.score;
  let type, title, text, cls, scene;

  if (s >= 200) {
    type  = 'The Good Ending';
    title = 'A Legend Is Born';
    cls   = 'good';
    scene = 'endingGood';
    text  = `The spires of Jurnaheim watch as you walk away from Osovia. Behind you, Shaira carries a broken pair of spectacles and a tattered silver cloak — all that remains of Kiave. The Runic is gone. Ashrag is silence. You came to Jurnaheim as a traveler with a cursed stone. You leave as the thing the Gods held their breath for. Not a warning. A legend.`;
  } else if (s >= 120) {
    type  = 'The Partial Ending';
    title = 'The Price of Victory';
    cls   = 'partial';
    scene = 'forest';
    text  = `Ashrag is defeated. The Runic is dust. But the cost was not nothing — Kiave is gone, and Shaira is quieter than she has ever been. You accomplished what you came to do, more or less. Jurnaheim doesn't know your name yet. But Osovia does. And Osovia doesn't forget.`;
  } else if (s >= 50) {
    type  = 'The Bad Ending';
    title = 'Dust and Regret';
    cls   = 'bad';
    scene = 'inside_cave';
    text  = `Things went badly. Not catastrophically — but badly. You survived the Hollows by luck as much as skill. Ashrag was stopped, but the cost was steep. Shaira barely speaks on the walk back. The Tiefling's words echo in your memory: "Destroy it." You waited too long. Some things cannot be undone.`;
  } else {
    type  = 'The Worst Ending';
    title = 'The Warning';
    cls   = 'worst';
    scene = 'endingWorst';
    text  = `The Gods exhaled — not with admiration, but with resignation. You were the warning. Kiave became Ashrag, and Ashrag became legend — the wrong kind. Shaira did not return from the Hollows. The Runic's echo plays on. Somewhere in the darkness, it whispers your name. It always will.`;
  }

  Scene.set(scene);
  document.getElementById('ending-type').textContent  = type;
  document.getElementById('ending-title').textContent = title;
  document.getElementById('ending-title').className   = `ending-title ${cls}`;
  document.getElementById('ending-text').textContent  = text;
  document.getElementById('ending-score').textContent = `Final Score: ${s}  ·  ${GameState.player.class} ${GameState.player.species}`;

  renderEndingReport(cls, s);

  Screen.show('screen-ending');
}

/* ══════════════════════════════════════════════
   END-OF-GAME REPORT  ("The Wanderer's Record")
   Renders the full assessment: profile, stats,
   journey flowchart, bonds, combat, score tally,
   and a personalized assessment.
   ══════════════════════════════════════════════ */
function renderEndingReport(endingCls, finalScore) {
  const P = GameState.player;
  const F = P.flags || {};

  const cap = (s) => (s || '').charAt(0).toUpperCase() + (s || '').slice(1);
  const cell = (label, value, sub) => `
    <div class="ending-cell">
      <span class="ending-cell-label">${label}</span>
      <span class="ending-cell-value">${value}${sub ? `<span class="ending-cell-value-sub">${sub}</span>` : ''}</span>
    </div>`;

  /* ── Character profile ── */
  const profileEl = document.getElementById('ending-profile');
  profileEl.innerHTML =
    cell('Class',      P.class || '—') +
    cell('Species',    P.species || '—') +
    cell('Gender',     cap(F.gender || 'unknown')) +
    cell('Appearance', cap(F.skinTone || 'unknown'));

  /* ── Final attributes ── */
  const attrEl = document.getElementById('ending-attributes');
  const statMod = (v) => Math.floor(((v || 10) - 10) / 2);
  const modStr  = (m) => m >= 0 ? `+${m}` : `${m}`;
  const stats = P.stats || {};
  attrEl.innerHTML =
    cell('Strength',     stats.STR ?? '—', modStr(statMod(stats.STR))) +
    cell('Intelligence', stats.INT ?? '—', modStr(statMod(stats.INT))) +
    cell('Charisma',     stats.CHA ?? '—', modStr(statMod(stats.CHA))) +
    cell('Dexterity',    stats.DEX ?? '—', modStr(statMod(stats.DEX)));

  /* ── Journey map (flowchart of milestones) ──
     Derived from flags story.js already sets. Each milestone has a
     `reached` condition; missed ones still render but are dimmed,
     giving the player a flowchart of paths taken vs paths skipped. */
  const journey = [
    { stage: 'Arrival',            text: 'Stepped into the gates of Jurnaheim.',                     reached: true },
    { stage: 'The Tavern',         text: 'Heard the Tiefling Rogue\'s warning about the Runic.',     reached: !!F.tieflingWarned },
    { stage: 'The Guild',          text: 'Earned the trust of Kiave, scholar of the Runic.',         reached: !!F.kiaveBond },
    { stage: 'Osovia Forest',      text: 'Met Shaira, the fighter who would walk into the dark.',    reached: !!F.shairaBond },
    { stage: 'Cave Entrance',      text: 'Inspected the entrance for traps before descending.',      reached: !!F.trapAware },
    { stage: 'The Hollows',        text: 'Survived combat in the depths of Osovia.',                 reached: (P.battles?.won || 0) >= 1 },
    { stage: 'The Cultist Chamber',text: 'Faced Ashrag, the Echo of the Runic.',                     reached: (P.battles?.won || 0) >= 2 || endingCls === 'good' || endingCls === 'partial' || endingCls === 'bad' || endingCls === 'worst' }
  ];
  const journeyEl = document.getElementById('ending-journey');
  journeyEl.innerHTML = journey.map(j => `
    <li class="ending-journey-item${j.reached ? '' : ' skipped'}">
      <span class="ending-journey-stage">${j.stage}</span>
      ${j.text}
    </li>`).join('');

  /* ── Bonds forged ── */
  const bonds = [];
  if (F.tieflingWarned) bonds.push('Tiefling Rogue');
  if (F.kiaveBond)      bonds.push('Kiave');
  if (F.shairaBond)     bonds.push('Shaira');
  const bondsEl = document.getElementById('ending-bonds');
  bondsEl.innerHTML = bonds.length
    ? bonds.map(b => `<span class="ending-bond">◆ ${b}</span>`).join('')
    : '<span class="ending-bond ending-bond--none">No lasting bonds were forged.</span>';

  /* ── Combat record ── */
  const battles = P.battles || { won: 0, lost: 0 };
  const total = battles.won + battles.lost;
  const wr = total > 0 ? Math.round((battles.won / total) * 100) : 0;
  const combatEl = document.getElementById('ending-combat');
  combatEl.innerHTML =
    cell('Battles', String(total)) +
    cell('Victories', String(battles.won)) +
    cell('Win Rate', total > 0 ? `${wr}%` : '—');

  /* ── Score tally (full breakdown from scoreLog) ── */
  const tallyEl = document.getElementById('ending-tally');
  const log = Array.isArray(P.scoreLog) ? P.scoreLog : [];
  const rows = log.map(e => `
    <div class="ending-tally-row">
      <span>${e.label}</span>
      <span>${e.delta >= 0 ? '+' : ''}${e.delta}</span>
    </div>`).join('');
  tallyEl.innerHTML = (rows || '<div class="ending-tally-row"><span>No scored actions recorded.</span><span>—</span></div>') + `
    <div class="ending-tally-row ending-tally-row--total">
      <span>Final Score</span><span>${finalScore}</span>
    </div>`;

  /* ── Personalized assessment paragraph ── */
  document.getElementById('ending-assessment').textContent =
    buildAssessment(endingCls, P, F, battles, finalScore);
}

function buildAssessment(endingCls, P, F, battles, score) {
  const cls = P.class;
  const sp  = P.species;
  const bonds = [F.tieflingWarned, F.kiaveBond, F.shairaBond].filter(Boolean).length;

  // Class-flavored opener
  const classFlavor = {
    Wizard:    'Arcane intellect carried you through Osovia.',
    Cleric:    'Faith was your shield, and your blade.',
    Barbarian: 'You met every shadow with raw force and refused to bend.',
    Bard:      'Words and silver tongue cut deeper than steel for you.'
  }[cls] || 'Your path was your own.';

  // Bond commentary
  let bondLine;
  if (bonds === 3)      bondLine = `You walked beside the Tiefling's warning, Kiave's scholarship, and Shaira's loyalty — and used all three.`;
  else if (bonds === 2) bondLine = `Two companions stood with you when it mattered. The rest of Elmenstria, you walked alone.`;
  else if (bonds === 1) bondLine = `You leaned on one bond. The path was lonelier for it.`;
  else                  bondLine = `You walked the road of Jurnaheim alone, trusting no one. Few do — fewer still survive it.`;

  // Combat note
  const combatLine =
    battles.lost === 0
      ? `You did not fall once in combat — a record few wanderers can claim.`
      : `You fell ${battles.lost} time${battles.lost === 1 ? '' : 's'} in combat, but the story still found you on its other side.`;

  // Ending-type closer
  const closer = {
    good:    `History will remember you as a legend. The Gods exhaled in approval.`,
    partial: `You won the day, but Osovia takes its price. The Gods watch, undecided.`,
    bad:     `You survived. Barely. The Runic is silent, but so are those you walked with.`,
    worst:   `You were the warning, not the legend. Some echoes never fade.`
  }[endingCls] || '';

  return `${classFlavor} ${bondLine} ${combatLine} ${closer}`;
}
