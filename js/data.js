/* ═══════════════════════════════════════════════════════════
   RESONATIA — js/data.js
   All static game data: classes, species, quiz questions.
   Edit this file to tweak stats, add flavour text, or extend
   the roster without touching any engine logic.
   ═══════════════════════════════════════════════════════════ */

/* ─── CHARACTER CLASSES ─────────────────────────────────────
   stats: raw attribute values (10 = neutral, modifier = floor((val-10)/2))
   quiz_archetype: maps to the quiz scoring key
──────────────────────────────────────────────────────────── */
const CLASSES = {
  Wizard: {
    icon:           '🧙',
    stats:          { STR: 8, INT: 16, CHA: 10, DEX: 12 },
    flavor:         'You have studied the arcane arts for decades. Your mind is your greatest weapon, and your tongue is almost as sharp. Physically frail but devastatingly clever.',
    quiz_archetype: 'INT'
  },
  Cleric: {
    icon:           '⚜️',
    stats:          { STR: 10, INT: 12, CHA: 14, DEX: 10 },
    flavor:         'Devoted to your deity, you walk between the mortal world and the divine. Your faith grants persuasive power and healing grace.',
    quiz_archetype: 'CHA_INT'
  },
  Barbarian: {
    icon:           '⚔️',
    stats:          { STR: 16, INT: 8, CHA: 10, DEX: 12 },
    flavor:         'Rage is your religion. Where others deliberate, you act. Where others fear, you charge. Your raw strength commands respect — or terror.',
    quiz_archetype: 'STR'
  },
  Bard: {
    icon:           '🎭',
    stats:          { STR: 10, INT: 10, CHA: 16, DEX: 14 },
    flavor:         'Every tavern is your stage. Every stranger a potential ally — or mark. Your voice can charm the hardest soul, and your feet can carry you out before trouble starts.',
    quiz_archetype: 'CHA'
  }
};

/* ─── SPECIES ────────────────────────────────────────────────
   bonus: added on top of class base stats
──────────────────────────────────────────────────────────── */
const SPECIES = {
  Tiefling: {
    icon:       '😈',
    bonus:      { CHA: 2, INT: 1 },
    bonusText:  '+2 CHA, +1 INT',
    desc:       'Born of infernal pacts. Silver-tongued and sharp-eyed.'
  },
  Dwarf: {
    icon:       '⛏️',
    bonus:      { STR: 2, DEX: 1 },
    bonusText:  '+2 STR, +1 DEX',
    desc:       'Stubborn as stone. Strong as iron. Loyal as a mountain.'
  },
  Human: {
    icon:       '🧑',
    bonus:      { STR: 1, CHA: 1, INT: 1, DEX: 1 },
    bonusText:  '+1 to all stats',
    desc:       'Adaptable survivors with surprising versatility.'
  },
  Elf: {
    icon:       '🧝',
    bonus:      { DEX: 2, INT: 1 },
    bonusText:  '+2 DEX, +1 INT',
    desc:       'Ancient blood flows through ancient veins. Graceful and perceptive.'
  }
};

/* ─── STAT DISPLAY LABELS ───────────────────────────────── */
const STAT_LABELS = {
  STR: 'Strength',
  INT: 'Intelligence',
  CHA: 'Charisma',
  DEX: 'Dexterity'
};

/* ─── QUIZ QUESTIONS ────────────────────────────────────────
   Each option maps to a quiz_archetype key that increments
   that class's score. The class with the highest total wins.
──────────────────────────────────────────────────────────── */
const QUIZ = [
  {
    q: 'A scholar approaches you with a riddle you cannot solve. What do you do?',
    opts: [
      { text: 'Spend hours puzzling it out alone — knowledge yields to patience.',       val: 'INT'     },
      { text: 'Pray for divine insight and trust the answer will come.',                  val: 'CHA_INT' },
      { text: "Smash the scholar's table and demand the answer directly.",                val: 'STR'     },
      { text: 'Flatter the scholar into revealing the answer themselves.',               val: 'CHA'     }
    ]
  },
  {
    q: 'You are outnumbered in a dark alley. Your first instinct is to…',
    opts: [
      { text: 'Cast an illusion — let them chase shadows.',                               val: 'INT'     },
      { text: 'Call upon your god and stand firm with faith.',                            val: 'CHA_INT' },
      { text: 'Roar, charge, and make them regret choosing you.',                        val: 'STR'     },
      { text: 'Talk your way out — silver words cost nothing.',                          val: 'CHA'     }
    ]
  },
  {
    q: "Which treasure would you claim from a dragon's hoard?",
    opts: [
      { text: 'A tome of forbidden spells, bound in shadow-skin.',                       val: 'INT'     },
      { text: 'A divine relic that hums with holy light.',                               val: 'CHA_INT' },
      { text: 'A legendary war-axe that roars when swung.',                             val: 'STR'     },
      { text: 'A lute that plays itself — and compels audiences to tip.',               val: 'CHA'     }
    ]
  },
  {
    q: 'A noble offers you gold to spy on a city official. You…',
    opts: [
      { text: "Accept — and research the official's secrets first.",                      val: 'INT'     },
      { text: 'Consult your conscience and ask what truly serves justice.',               val: 'CHA_INT' },
      { text: 'Decline loudly, then challenge the noble to a fight.',                    val: 'STR'     },
      { text: 'Accept — and negotiate a cut from both sides.',                           val: 'CHA'     }
    ]
  },
  {
    q: 'How do you face the unknown?',
    opts: [
      { text: 'I analyse every variable before I step forward.',                         val: 'INT'     },
      { text: 'I trust in something greater than myself.',                               val: 'CHA_INT' },
      { text: 'I step forward and deal with what comes.',                                val: 'STR'     },
      { text: 'I convince someone else to step forward first.',                          val: 'CHA'     }
    ]
  }
];

/* ─── ENDINGS ───────────────────────────────────────────────
   Thresholds are checked top-to-bottom; first match wins.
──────────────────────────────────────────────────────────── */
const ENDINGS = [
  {
    minScore:  180,
    cssClass:  'good',
    type:      'The Good Ending',
    title:     'A Legend Is Born',
    text:      'The streets of Jurnaheim remember a traveler from Pacifica who came with a runic and left with a destiny. The Ashen Choir is scattered. The seal is resolved. Somewhere in the deep city, Oswald composes the first verse of an epic that will outlive you all. You became what the Gods had held their breath for — a legend, not a warning.'
  },
  {
    minScore:  100,
    cssClass:  'partial',
    type:      'The Partial Ending',
    title:     'The Bargain Kept',
    text:      'You accomplished what you came to do — more or less. The Choir did not win. The seal endures. But the city still carries its shadows, and certain questions about the runic\'s origin remain unanswered. You leave Jurnaheim with more scars than answers, and the unsettling sense that the story is not entirely over.'
  },
  {
    minScore:  30,
    cssClass:  'bad',
    type:      'The Bad Ending',
    title:     'Dust and Regret',
    text:      'Things went badly. Not catastrophically — but badly. The Choir gained ground. Oswald\'s archive burned. The runic passed through hands it shouldn\'t have. You survived, which is something. But survival in Jurnaheim means only that you lived long enough to see the consequences of your failures unfold.'
  },
  {
    minScore:  -Infinity,
    cssClass:  'worst',
    type:      'The Worst Ending',
    title:     'The Warning',
    text:      'The Gods exhaled — not with admiration, but resignation. You were the warning. The Ashen Choir broke the seal. The entity is free. Jurnaheim burns in a light that has no warmth. Somewhere in the darkness, the Tiefling Rogue\'s words echo: "Destroy it." You didn\'t. And now everyone pays the price you couldn\'t.'
  }
];
