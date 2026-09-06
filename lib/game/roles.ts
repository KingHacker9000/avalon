export const ROLES = {
  Merlin: {
    name: 'Merlin',
    side: 'good',
    art: 0,
    title: 'The keeper of secrets',
    line: 'Sees the darkness. Must stay hidden.',
    description:
      'You know the agents of evil, except Mordred. Guide your allies to three successful quests without letting the Assassin discover who you are.',
  },
  Percival: {
    name: 'Percival',
    side: 'good',
    art: 1,
    title: 'The watchful guardian',
    line: 'Protect the wizard. Find the truth.',
    description:
      'You see Merlin and Morgana as two possible Merlins, without knowing which is which. Protect the real Merlin and help your allies succeed.',
  },
  Servant: {
    name: 'Loyal Servant',
    side: 'good',
    art: 2,
    title: 'A light in the darkness',
    line: 'An honest heart in a court of secrets.',
    description:
      'You serve Arthur, but know no one else’s loyalty. Read the room, study the votes, and help complete three quests. You must play Success on quests.',
  },
  Assassin: {
    name: 'The Assassin',
    side: 'evil',
    art: 3,
    title: 'The final word',
    line: 'One final choice can change everything.',
    description:
      'You know your fellow agents of evil, except Oberon. Sabotage three quests, or identify and assassinate Merlin after good completes three quests.',
  },
  Morgana: {
    name: 'Morgana',
    side: 'evil',
    art: 4,
    title: 'The beautiful deception',
    line: 'A familiar face. A dangerous illusion.',
    description:
      'Percival sees you as a possible Merlin. Use this illusion to lead the loyal astray. You know the other agents of evil, except Oberon.',
  },
  Mordred: {
    name: 'Mordred',
    side: 'evil',
    art: 5,
    title: 'The unseen enemy',
    line: 'Even the wisest cannot see you.',
    description:
      'Your identity is hidden from Merlin. You know the other agents of evil, except Oberon. Win their trust, then choose your moment to betray it.',
  },
  Oberon: {
    name: 'Oberon',
    side: 'evil',
    art: 6,
    title: 'The solitary shadow',
    line: 'Alone in the dark. Against the light.',
    description:
      'You serve evil, but do not know your allies and they do not know you. Merlin can still see your evil loyalty. Work out whom to trust as you sabotage quests.',
  },
  Minion: {
    name: 'Minion of Mordred',
    side: 'evil',
    art: 7,
    title: 'An oath to darkness',
    line: 'Loyalty wears many disguises.',
    description:
      'You know your fellow agents of evil, except Oberon. You may play Success to earn trust or Fail to sabotage a quest.',
  },
} as const;
export type Role = keyof typeof ROLES;
export const OPTIONAL = ['Percival', 'Morgana', 'Mordred', 'Oberon'] as const;
export const TEAM_SIZES: Record<number, number[]> = {
  5: [2, 3, 2, 3, 3],
  6: [2, 3, 4, 3, 4],
  7: [2, 3, 3, 4, 4],
  8: [3, 4, 4, 5, 5],
  9: [3, 4, 4, 5, 5],
  10: [3, 4, 4, 5, 5],
};
export const EVIL_COUNT: Record<number, number> = {
  5: 2,
  6: 2,
  7: 3,
  8: 3,
  9: 3,
  10: 4,
};
export const QUEST_NAMES = [
  'The Whispering Woods',
  'The Broken Crossing',
  'The Forgotten Chapel',
  'The Shadowed Keep',
  'The Gates of Camelot',
];
