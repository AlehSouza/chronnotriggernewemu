import type { Ability, ActionKind, CharacterDef, CharacterId, Element } from './types';

function parry(name: string, element: Element): Ability {
  return {
    kind: 'parry',
    name,
    description:
      'Postura defensiva. Contra ataque normal: devolve 60% do dano. Contra habilidade: bloqueia tudo. ' +
      'Contra ultimate: bloqueia metade. Não pode ser usado dois turnos seguidos.',
    power: 0,
    scaling: 'atk',
    element,
    mpCost: 0,
  };
}

export const CHARACTERS: Record<CharacterId, CharacterDef> = {
  crono: {
    id: 'crono',
    name: 'Crono',
    title: 'O Espadachim Silencioso',
    era: '1000 d.C.',
    element: 'raio',
    bio: 'Jovem de Truce que atravessa o tempo com sua katana. Equilibrado em ataque e magia.',
    stats: { maxHp: 370, maxMp: 60, atk: 23, mag: 19, def: 18 },
    palette: { hair: 0xd8302a, skin: 0xf2c79a, outfit: 0x2f5fb3, accent: 0xe8e8f0 },
    abilities: {
      attack: { kind: 'attack', name: 'Corte de Katana', description: 'Golpe rápido de espada.', power: 30, scaling: 'atk', element: 'fisico', mpCost: 0 },
      parry: parry('Contra-golpe', 'fisico'),
      skill: { kind: 'skill', name: 'Cyclone', description: 'Giro cortante com a katana.', power: 50, scaling: 'atk', element: 'fisico', mpCost: 20, hits: 2 },
      ultimate: { kind: 'ultimate', name: 'Luminaire', description: 'Explosão de luz sagrada que atinge com força total.', power: 135, scaling: 'mag', element: 'raio', mpCost: 0 },
    },
  },
  marle: {
    id: 'marle',
    name: 'Marle',
    title: 'A Princesa Arqueira',
    era: '1000 d.C.',
    element: 'agua',
    bio: 'Princesa de Guardia. Suporte com cura e gelo devastador.',
    stats: { maxHp: 310, maxMp: 90, atk: 17, mag: 22, def: 15 },
    palette: { hair: 0xf5d04a, skin: 0xf6d2ae, outfit: 0xf2f2f2, accent: 0x6fb7e8 },
    abilities: {
      attack: { kind: 'attack', name: 'Flecha', description: 'Disparo de besta.', power: 28, scaling: 'atk', element: 'fisico', mpCost: 0 },
      parry: parry('Esquiva Real', 'agua'),
      skill: { kind: 'skill', name: 'Aura', description: 'Cura 22% do HP e aplica Regeneração por 3 turnos.', power: 0, scaling: 'mag', element: 'agua', mpCost: 25, healPct: 0.22, applyToSelf: [{ id: 'regen', turns: 3 }] },
      ultimate: { kind: 'ultimate', name: 'Ice 2', description: 'Prisão de gelo que reduz a defesa do alvo por 3 turnos.', power: 120, scaling: 'mag', element: 'agua', mpCost: 0, applyToTarget: [{ id: 'defDown', turns: 3 }] },
    },
  },
  lucca: {
    id: 'lucca',
    name: 'Lucca',
    title: 'A Inventora',
    era: '1000 d.C.',
    element: 'fogo',
    bio: 'Gênio da ciência. Frágil, mas com o maior dano mágico do grupo.',
    stats: { maxHp: 330, maxMp: 90, atk: 16, mag: 26, def: 16 },
    palette: { hair: 0x7a4bb5, skin: 0xf2c79a, outfit: 0x3e8a4a, accent: 0xf0a030 },
    abilities: {
      attack: { kind: 'attack', name: 'Pistola Aérea', description: 'Tiro da arma caseira.', power: 27, scaling: 'atk', element: 'fisico', mpCost: 0 },
      parry: parry('Escudo Portátil', 'fogo'),
      skill: { kind: 'skill', name: 'Napalm', description: 'Bomba incendiária. Aplica Queimadura por 3 turnos.', power: 44, scaling: 'mag', element: 'fogo', mpCost: 20, applyToTarget: [{ id: 'burn', turns: 3 }] },
      ultimate: { kind: 'ultimate', name: 'Flare', description: 'A chama mais poderosa da ciência e da magia.', power: 140, scaling: 'mag', element: 'fogo', mpCost: 0 },
    },
  },
  frog: {
    id: 'frog',
    name: 'Frog',
    title: 'O Cavaleiro Amaldiçoado',
    era: '600 d.C.',
    element: 'agua',
    bio: 'Cavaleiro de Guardia transformado em sapo. Fica mais perigoso quanto mais ferido.',
    stats: { maxHp: 360, maxMp: 60, atk: 21, mag: 17, def: 18 },
    palette: { hair: 0x4f9a3a, skin: 0x6cc04a, outfit: 0x8a6a3a, accent: 0xc8d0e0 },
    abilities: {
      attack: { kind: 'attack', name: 'Masamune', description: 'Golpe com a lendária espada.', power: 30, scaling: 'atk', element: 'fisico', mpCost: 0 },
      parry: parry('Guarda do Cavaleiro', 'fisico'),
      skill: { kind: 'skill', name: 'Leap Slash', description: 'Salta e corta de cima.', power: 52, scaling: 'atk', element: 'fisico', mpCost: 22 },
      ultimate: { kind: 'ultimate', name: 'Frog Squash', description: 'Esmaga o inimigo. Até +150% de poder conforme o HP perdido de Frog.', power: 85, scaling: 'atk', element: 'fisico', mpCost: 0, missingHpBonus: 1.5 },
    },
  },
  robo: {
    id: 'robo',
    name: 'Robo',
    title: 'O Androide Leal',
    era: '2300 d.C.',
    element: 'sombra',
    bio: 'Robô R-66Y reconstruído por Lucca. Muito HP e defesa, pouca magia.',
    stats: { maxHp: 390, maxMp: 50, atk: 21, mag: 12, def: 20 },
    palette: { hair: 0xc9a227, skin: 0xd9b840, outfit: 0x8a7a50, accent: 0xe05050 },
    abilities: {
      attack: { kind: 'attack', name: 'Rocket Punch', description: 'Soco foguete.', power: 30, scaling: 'atk', element: 'fisico', mpCost: 0 },
      parry: parry('Blindagem', 'fisico'),
      skill: { kind: 'skill', name: 'Uzzi Punch', description: 'Sequência de socos.', power: 46, scaling: 'atk', element: 'fisico', mpCost: 20, hits: 3 },
      ultimate: { kind: 'ultimate', name: 'Shock', description: 'Descarga elétrica total. Reduz a defesa do alvo.', power: 120, scaling: 'atk', element: 'sombra', mpCost: 0, applyToTarget: [{ id: 'defDown', turns: 2 }] },
    },
  },
  ayla: {
    id: 'ayla',
    name: 'Ayla',
    title: 'A Chefe de Ioka',
    era: '65.000.000 a.C.',
    element: 'fisico',
    bio: 'Guerreira pré-histórica. O maior ataque físico, sem magia.',
    stats: { maxHp: 350, maxMp: 50, atk: 26, mag: 10, def: 16 },
    palette: { hair: 0xf0d050, skin: 0xe8b88a, outfit: 0xb08040, accent: 0x6a4a2a },
    abilities: {
      attack: { kind: 'attack', name: 'Soco', description: 'Soco de punhos nus.', power: 32, scaling: 'atk', element: 'fisico', mpCost: 0 },
      parry: parry('Instinto', 'fisico'),
      skill: { kind: 'skill', name: 'Kiss', description: 'Cura 15% do HP e aumenta o ataque por 3 turnos.', power: 0, scaling: 'atk', element: 'fisico', mpCost: 18, healPct: 0.15, applyToSelf: [{ id: 'atkUp', turns: 3 }] },
      ultimate: { kind: 'ultimate', name: 'Triple Kick', description: 'Três chutes giratórios.', power: 125, scaling: 'atk', element: 'fisico', mpCost: 0, hits: 3 },
    },
  },
  magus: {
    id: 'magus',
    name: 'Magus',
    title: 'O Mago Sombrio',
    era: '600 d.C.',
    element: 'sombra',
    bio: 'Feiticeiro temido de Zeal. Mestre da magia das sombras.',
    stats: { maxHp: 340, maxMp: 100, atk: 19, mag: 26, def: 17 },
    palette: { hair: 0x8fb0e8, skin: 0xd8c0c8, outfit: 0x2a2440, accent: 0x9a2a3a },
    abilities: {
      attack: { kind: 'attack', name: 'Foice', description: 'Corte com a foice.', power: 28, scaling: 'atk', element: 'fisico', mpCost: 0 },
      parry: parry('Barreira', 'sombra'),
      skill: { kind: 'skill', name: 'Dark Bomb', description: 'Esfera sombria. Reduz a defesa do alvo por 3 turnos.', power: 44, scaling: 'mag', element: 'sombra', mpCost: 24, applyToTarget: [{ id: 'defDown', turns: 3 }] },
      ultimate: { kind: 'ultimate', name: 'Dark Matter', description: 'A magia mais poderosa das sombras.', power: 145, scaling: 'mag', element: 'sombra', mpCost: 0 },
    },
  },
};

/** Ordem de exibição na tela de seleção. */
export const ROSTER: CharacterId[] = ['crono', 'marle', 'lucca', 'frog', 'robo', 'ayla', 'magus'];

export const ACTION_ORDER: ActionKind[] = ['attack', 'parry', 'skill', 'ultimate'];

export const ACTION_LABEL: Record<ActionKind, string> = {
  attack: 'Ataque',
  parry: 'Parry',
  skill: 'Habilidade',
  ultimate: 'Ultimate',
};

export const ELEMENT_LABEL: Record<Element, string> = {
  raio: 'Raio',
  agua: 'Água',
  fogo: 'Fogo',
  sombra: 'Sombra',
  fisico: 'Físico',
};
