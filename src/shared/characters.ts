import type { Ability, CharacterDef, CharacterId, Element, Slot } from './types';

function parry(name: string, element: Element): Ability {
  return {
    slot: 'parry',
    kind: 'parry',
    name,
    description:
      'Janela curta de defesa. Golpe normal: devolve 60% do dano e atordoa. Habilidade: bloqueia tudo. ' +
      'Projétil: rebate de volta. Ultimate: bloqueia só metade. Errar deixa você exposto.',
    power: 0,
    scaling: 'atk',
    element,
    mpCost: 0,
    cooldown: 1.2,
    startup: 2,
    active: 14,
    recovery: 18,
    range: 0,
    depth: 0,
    color: 0x8fe0ff,
  };
}

export const CHARACTERS: Record<CharacterId, CharacterDef> = {
  crono: {
    id: 'crono',
    name: 'Crono',
    title: 'O Espadachim Silencioso',
    era: '1000 d.C.',
    element: 'raio',
    bio: 'Jovem de Truce que atravessa o tempo com sua katana. Equilibrado, bom de perto.',
    stats: { maxHp: 630, maxMp: 60, atk: 22, mag: 19, def: 18, speed: 3.0 },
    palette: { hair: 0xd8302a, skin: 0xf2c79a, outfit: 0x2f5fb3, accent: 0xe8e8f0 },
    abilities: {
      attack: { slot: 'attack', kind: 'melee', name: 'Corte de Katana', description: 'Corte rápido à frente.', power: 14, scaling: 'atk', element: 'fisico', mpCost: 0, cooldown: 0, startup: 6, active: 4, recovery: 14, range: 78, depth: 26, knockback: 6, color: 0xffffff },
      parry: parry('Contra-golpe', 'fisico'),
      skill: { slot: 'skill', kind: 'aoeSelf', name: 'Cyclone', description: 'Giro com a katana que acerta tudo em volta.', power: 32, scaling: 'atk', element: 'fisico', mpCost: 20, cooldown: 3, startup: 10, active: 16, recovery: 16, range: 95, depth: 40, hits: 2, knockback: 12, color: 0xd0e8ff },
      ultimate: { slot: 'ultimate', kind: 'aoeSelf', name: 'Luminaire', description: 'Explosão de luz enorme em volta de Crono. Carrega antes: fuja para longe.', power: 115, scaling: 'mag', element: 'raio', mpCost: 0, cooldown: 0, startup: 40, active: 6, recovery: 24, range: 260, depth: 120, knockback: 30, color: 0xfff2a0 },
    },
  },
  marle: {
    id: 'marle',
    name: 'Marle',
    title: 'A Princesa Arqueira',
    era: '1000 d.C.',
    element: 'agua',
    bio: 'Princesa de Guardia. Ataca de longe com a besta e se cura.',
    stats: { maxHp: 570, maxMp: 90, atk: 17, mag: 22, def: 15, speed: 3.0 },
    palette: { hair: 0xf5d04a, skin: 0xf6d2ae, outfit: 0xf2f2f2, accent: 0x6fb7e8 },
    abilities: {
      attack: { slot: 'attack', kind: 'projectile', name: 'Flecha', description: 'Dispara uma flecha em linha reta.', power: 18, scaling: 'atk', element: 'fisico', mpCost: 0, cooldown: 0, startup: 8, active: 1, recovery: 16, range: 520, depth: 18, speed: 9, knockback: 4, color: 0xe8e0c0 },
      parry: parry('Esquiva Real', 'agua'),
      skill: { slot: 'skill', kind: 'buff', name: 'Aura', description: 'Cura 18% do HP e regenera por 4s.', power: 0, scaling: 'mag', element: 'agua', mpCost: 25, cooldown: 6, startup: 14, active: 1, recovery: 14, range: 0, depth: 0, healPct: 0.18, applyToSelf: [{ id: 'regen', seconds: 4 }], color: 0x7affb0 },
      ultimate: { slot: 'ultimate', kind: 'aoeTarget', name: 'Ice 2', description: 'Marca o chão onde o alvo está e congela a área. Reduz a defesa.', power: 105, scaling: 'mag', element: 'agua', mpCost: 0, cooldown: 0, startup: 45, active: 1, recovery: 20, range: 95, depth: 0, knockback: 20, applyToTarget: [{ id: 'defDown', seconds: 5 }], color: 0x9ae0ff },
    },
  },
  lucca: {
    id: 'lucca',
    name: 'Lucca',
    title: 'A Inventora',
    era: '1000 d.C.',
    element: 'fogo',
    bio: 'Gênio da ciência. Frágil de perto, perigosa de longe.',
    stats: { maxHp: 560, maxMp: 90, atk: 16, mag: 26, def: 15, speed: 2.8 },
    palette: { hair: 0x7a4bb5, skin: 0xf2c79a, outfit: 0x3e8a4a, accent: 0xf0a030 },
    abilities: {
      attack: { slot: 'attack', kind: 'projectile', name: 'Pistola Aérea', description: 'Tiro rápido em linha reta.', power: 15, scaling: 'atk', element: 'fisico', mpCost: 0, cooldown: 0, startup: 6, active: 1, recovery: 16, range: 560, depth: 16, speed: 11, knockback: 3, color: 0xffe080 },
      parry: parry('Escudo Portátil', 'fogo'),
      skill: { slot: 'skill', kind: 'projectile', name: 'Napalm', description: 'Bomba lenta que queima por 4s.', power: 28, scaling: 'mag', element: 'fogo', mpCost: 20, cooldown: 3, startup: 12, active: 1, recovery: 18, range: 480, depth: 26, speed: 6, knockback: 10, applyToTarget: [{ id: 'burn', seconds: 4 }], color: 0xff7a2a },
      ultimate: { slot: 'ultimate', kind: 'aoeTarget', name: 'Flare', description: 'Chama gigante no lugar do alvo. Demora para cair: dá para escapar.', power: 125, scaling: 'mag', element: 'fogo', mpCost: 0, cooldown: 0, startup: 50, active: 1, recovery: 20, range: 115, depth: 0, knockback: 28, color: 0xff5a1a },
    },
  },
  frog: {
    id: 'frog',
    name: 'Frog',
    title: 'O Cavaleiro Amaldiçoado',
    era: '600 d.C.',
    element: 'agua',
    bio: 'Cavaleiro transformado em sapo. Ágil, e mais perigoso quanto mais ferido.',
    stats: { maxHp: 610, maxMp: 60, atk: 21, mag: 17, def: 18, speed: 3.2 },
    palette: { hair: 0x4f9a3a, skin: 0x6cc04a, outfit: 0x8a6a3a, accent: 0xc8d0e0 },
    abilities: {
      attack: { slot: 'attack', kind: 'melee', name: 'Masamune', description: 'Golpe de espada à frente.', power: 14, scaling: 'atk', element: 'fisico', mpCost: 0, cooldown: 0, startup: 6, active: 4, recovery: 14, range: 80, depth: 26, knockback: 6, color: 0xc8d0e0 },
      parry: parry('Guarda do Cavaleiro', 'fisico'),
      skill: { slot: 'skill', kind: 'dash', name: 'Leap Slash', description: 'Salta para frente cortando quem estiver no caminho.', power: 34, scaling: 'atk', element: 'fisico', mpCost: 20, cooldown: 3, startup: 8, active: 14, recovery: 16, range: 210, depth: 30, knockback: 14, color: 0xa0ffa0 },
      ultimate: { slot: 'ultimate', kind: 'aoeTarget', name: 'Frog Squash', description: 'Salta e esmaga o local do alvo. Até +150% de dano com pouco HP.', power: 85, scaling: 'atk', element: 'fisico', mpCost: 0, cooldown: 0, startup: 36, active: 1, recovery: 22, range: 90, depth: 0, knockback: 26, missingHpBonus: 1.5, leapToTarget: true, color: 0x6cc04a },
    },
  },
  robo: {
    id: 'robo',
    name: 'Robo',
    title: 'O Androide Leal',
    era: '2300 d.C.',
    element: 'sombra',
    bio: 'Robô R-66Y. Lento, resistente, bate em sequência.',
    stats: { maxHp: 680, maxMp: 50, atk: 21, mag: 14, def: 20, speed: 2.4 },
    palette: { hair: 0xc9a227, skin: 0xd9b840, outfit: 0x8a7a50, accent: 0xe05050 },
    abilities: {
      attack: { slot: 'attack', kind: 'melee', name: 'Rocket Punch', description: 'Soco foguete de longo alcance.', power: 15, scaling: 'atk', element: 'fisico', mpCost: 0, cooldown: 0, startup: 8, active: 4, recovery: 16, range: 96, depth: 24, knockback: 10, color: 0xffd060 },
      parry: parry('Blindagem', 'fisico'),
      skill: { slot: 'skill', kind: 'melee', name: 'Uzzi Punch', description: 'Rajada de quatro socos à frente.', power: 38, scaling: 'atk', element: 'fisico', mpCost: 20, cooldown: 3, startup: 8, active: 24, recovery: 16, range: 80, depth: 28, hits: 4, knockback: 4, color: 0xffa040 },
      ultimate: { slot: 'ultimate', kind: 'aoeSelf', name: 'Shock', description: 'Descarga elétrica em volta de Robo. Reduz a defesa.', power: 105, scaling: 'atk', element: 'sombra', mpCost: 0, cooldown: 0, startup: 32, active: 6, recovery: 24, range: 210, depth: 100, knockback: 26, applyToTarget: [{ id: 'defDown', seconds: 4 }], color: 0xa0c0ff },
    },
  },
  ayla: {
    id: 'ayla',
    name: 'Ayla',
    title: 'A Chefe de Ioka',
    era: '65.000.000 a.C.',
    element: 'fisico',
    bio: 'Guerreira pré-histórica. A mais rápida e a que bate mais forte de perto.',
    stats: { maxHp: 590, maxMp: 50, atk: 23, mag: 10, def: 16, speed: 3.3 },
    palette: { hair: 0xf0d050, skin: 0xe8b88a, outfit: 0xb08040, accent: 0x6a4a2a },
    abilities: {
      attack: { slot: 'attack', kind: 'melee', name: 'Soco', description: 'Soco curto e muito rápido.', power: 14, scaling: 'atk', element: 'fisico', mpCost: 0, cooldown: 0, startup: 4, active: 4, recovery: 12, range: 62, depth: 24, knockback: 5, color: 0xffffff },
      parry: parry('Instinto', 'fisico'),
      skill: { slot: 'skill', kind: 'buff', name: 'Kiss', description: 'Cura 12% do HP e aumenta o ataque por 5s.', power: 0, scaling: 'atk', element: 'fisico', mpCost: 18, cooldown: 6, startup: 12, active: 1, recovery: 12, range: 0, depth: 0, healPct: 0.12, applyToSelf: [{ id: 'atkUp', seconds: 5 }], color: 0xff8ac0 },
      ultimate: { slot: 'ultimate', kind: 'dash', name: 'Triple Kick', description: 'Avança com três chutes giratórios.', power: 110, scaling: 'atk', element: 'fisico', mpCost: 0, cooldown: 0, startup: 16, active: 24, recovery: 20, range: 280, depth: 36, hits: 3, knockback: 18, color: 0xffe060 },
    },
  },
  magus: {
    id: 'magus',
    name: 'Magus',
    title: 'O Mago Sombrio',
    era: '600 d.C.',
    element: 'sombra',
    bio: 'Feiticeiro de Zeal. Controla o espaço com magias marcadas no chão.',
    stats: { maxHp: 580, maxMp: 100, atk: 19, mag: 26, def: 17, speed: 2.8 },
    palette: { hair: 0x8fb0e8, skin: 0xd8c0c8, outfit: 0x2a2440, accent: 0x9a2a3a },
    abilities: {
      attack: { slot: 'attack', kind: 'melee', name: 'Foice', description: 'Corte largo com a foice.', power: 13, scaling: 'atk', element: 'fisico', mpCost: 0, cooldown: 0, startup: 7, active: 5, recovery: 15, range: 88, depth: 32, knockback: 6, color: 0xc080ff },
      parry: parry('Barreira', 'sombra'),
      skill: { slot: 'skill', kind: 'aoeTarget', name: 'Dark Bomb', description: 'Esfera sombria no local do alvo. Reduz a defesa por 4s.', power: 30, scaling: 'mag', element: 'sombra', mpCost: 22, cooldown: 3.5, startup: 30, active: 1, recovery: 14, range: 70, depth: 0, knockback: 12, applyToTarget: [{ id: 'defDown', seconds: 4 }], color: 0x9a4aff },
      ultimate: { slot: 'ultimate', kind: 'aoeTarget', name: 'Dark Matter', description: 'Vórtice gigante de trevas no local do alvo.', power: 115, scaling: 'mag', element: 'sombra', mpCost: 0, cooldown: 0, startup: 55, active: 1, recovery: 20, range: 155, depth: 0, knockback: 30, color: 0x6a2aaa },
    },
  },
};

/** Ordem de exibição na tela de seleção. */
export const ROSTER: CharacterId[] = ['crono', 'marle', 'lucca', 'frog', 'robo', 'ayla', 'magus'];

export const SLOT_ORDER: Slot[] = ['attack', 'parry', 'skill', 'ultimate'];

export const SLOT_LABEL: Record<Slot, string> = {
  attack: 'Ataque',
  parry: 'Parry',
  skill: 'Habilidade',
  ultimate: 'Ultimate',
};

export const KIND_LABEL: Record<Ability['kind'], string> = {
  melee: 'Corpo a corpo',
  projectile: 'Projétil',
  aoeSelf: 'Área em volta',
  aoeTarget: 'Área no alvo',
  dash: 'Avanço',
  buff: 'Suporte',
  parry: 'Defesa',
};

export const ELEMENT_LABEL: Record<Element, string> = {
  raio: 'Raio',
  agua: 'Água',
  fogo: 'Fogo',
  sombra: 'Sombra',
  fisico: 'Físico',
};
