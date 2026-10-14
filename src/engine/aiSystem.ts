// src/engine/aiSystem.ts
// Tactical AI Enemy Manager (Marodyor Scavengers, Brigadir Bandits, Varta-73 Watchmen)
// 100% English localization with true wall-occluded raycasting, sound perception, cover seeking, and corpse loot.

import {
  AIArchetype,
  AIEnemy,
  InteractiveDoor,
  InventoryItemInstance,
  WorldBox,
  WorldLootContainer,
} from '../types/game';
import { WEAPON_STATS } from '../data/itemsAndWeapons';
import { hasLineOfSight } from './physicsAndPlayer';
import { createItemInstance, nextItemUid } from './worldBuilder';

const COMBAT_BARKS: Record<AIArchetype, { spot: string[]; combat: string[]; reload: string[]; search: string[] }> = {
  marodyor: {
    spot: [
      '"Halt! Who goes there?! Opening fire!"',
      '"Boys, we got a drifter carrying loot over here!"',
      '"Don\'t you flinch, stalker!"',
    ],
    combat: [
      '"Flank him around the concrete!"',
      '"Pin him down, don\'t let him aim!"',
      '"Catch lead, trespasser!"',
    ],
    reload: ['"Magazine dry! Changing mag!"'],
    search: ['"Where did he slip off to? Check the corners..."'],
  },
  brigadir: {
    spot: [
      '"Look what walked into our sector—a fat target!"',
      '"Drop the backpack the easy way!"',
    ],
    combat: [
      '"Push him hard, keep him behind cover!"',
      '"Cut off his retreat toward the rail siding!"',
    ],
    reload: ['"Cover me, reloading!"'],
    search: ['"Target broke line of sight—sweep the ruins!"'],
  },
  varta: {
    spot: [
      '"Command, perimeter breached! Hostile sighted in Sector 73!"',
      '"Varta-73 patrol: engaging unauthorized survivor!"',
    ],
    combat: [
      '"Laying suppressive fire on target position!"',
      '"Hostile behind cover—advancing by fire and maneuver!"',
    ],
    reload: ['"Reloading rifle, maintain sector watch!"'],
    search: ['"Visual contact lost. Sweeping last known coordinates."'],
  },
};

export function spawnZoneEnemies(): AIEnemy[] {
  const specs: {
    id: string;
    name: string;
    archetype: AIArchetype;
    factionLabel: string;
    weaponId: string;
    hp: number;
    armorClass: number;
    initialYaw: number;
    patrol: [number, number, number][];
  }[] = [
    {
      id: 'ai_scav_road',
      name: 'Kostya "Rusty" (Scavenger)',
      archetype: 'marodyor',
      factionLabel: 'Zone Scavenger',
      weaponId: 'wpn_pmm',
      hp: 85,
      armorClass: 1,
      initialYaw: 0,
      patrol: [
        [-2.2, 0.1, 24],
        [3.2, 0.1, 16],
        [-3.0, 0.1, 28],
      ],
    },
    {
      id: 'ai_scav_apt1f',
      name: 'Tolik "Chemist" (Scavenger)',
      archetype: 'marodyor',
      factionLabel: 'Zone Scavenger',
      weaponId: 'wpn_toz106',
      hp: 90,
      armorClass: 1,
      initialYaw: 1.57,
      patrol: [
        [-19, 0.2, 2],
        [-19, 0.2, -10],
        [-25, 0.2, 1],
      ],
    },
    {
      id: 'ai_scav_shrine',
      name: 'Old Man "Monk" (Scavenger)',
      archetype: 'marodyor',
      factionLabel: 'Zone Scavenger',
      weaponId: 'wpn_toz106',
      hp: 90,
      armorClass: 1,
      initialYaw: 0.8,
      patrol: [
        [-45, 0.1, 31],
        [-49, 0.1, 24],
        [-39, 0.1, 20],
      ],
    },
    {
      id: 'ai_bandit_courtyard',
      name: 'Grisha "Knuckles" (Brigadir)',
      archetype: 'brigadir',
      factionLabel: 'Brigadir Syndicate',
      weaponId: 'wpn_aks74u',
      hp: 110,
      armorClass: 2,
      initialYaw: -0.4,
      patrol: [
        [2, 0.1, 6],
        [-8, 0.1, 2],
        [6, 0.1, -8],
      ],
    },
    {
      id: 'ai_bandit_apt2f',
      name: 'Zhora "North" (Brigadir)',
      archetype: 'brigadir',
      factionLabel: 'Brigadir Syndicate',
      weaponId: 'wpn_aks74u',
      hp: 115,
      armorClass: 2,
      initialYaw: 0,
      patrol: [
        [-18, 3.9, -4],
        [-18, 3.9, 3],
        [-25, 3.9, -12],
      ],
    },
    {
      id: 'ai_varta_factory',
      name: 'Sgt. Belov (Varta-73)',
      archetype: 'varta',
      factionLabel: 'Varta-73 Containment',
      weaponId: 'wpn_aks74u',
      hp: 135,
      armorClass: 4,
      initialYaw: 1.57,
      patrol: [
        [21, 0.2, 2],
        [31, 0.2, -12],
        [31, 0.2, 12],
      ],
    },
    {
      id: 'ai_varta_catwalk',
      name: 'Lt. Gromov (Varta-73 Marksman)',
      archetype: 'varta',
      factionLabel: 'Varta-73 Containment',
      weaponId: 'wpn_svds',
      hp: 130,
      armorClass: 3,
      initialYaw: 1.57,
      patrol: [
        [42.0, 3.65, -8],
        [42.0, 3.65, 6],
        [42.0, 3.65, -15],
      ],
    },
    {
      id: 'ai_varta_rail',
      name: 'Cpl. Morozov (Varta-73)',
      archetype: 'varta',
      factionLabel: 'Varta-73 Containment',
      weaponId: 'wpn_aks74u',
      hp: 130,
      armorClass: 3,
      initialYaw: 3.14,
      patrol: [
        [10, 0.1, -42],
        [28, 0.1, -44],
        [-4, 0.1, -40],
      ],
    },
  ];

  return specs.map((s) => {
    const start = s.patrol[0];
    const wStats = WEAPON_STATS[s.weaponId];
    return {
      id: s.id,
      name: s.name,
      archetype: s.archetype,
      factionLabel: s.factionLabel,
      x: start[0],
      y: start[1],
      z: start[2],
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: s.initialYaw,
      targetYaw: s.initialYaw,
      hp: s.hp,
      maxHp: s.hp,
      armorClass: s.armorClass,
      weaponId: s.weaponId,
      ammoInMag: wStats ? wStats.magCapacity : 8,
      state: 'PATROL',
      stateTimer: 4.0,
      patrolPoints: s.patrol,
      currentPatrolIdx: 1,
      lastKnownPlayerPos: null,
      alertLevel: 0,
      fireCooldown: 0.8,
      reloadTimer: 0,
      burstRemaining: 0,
      strafeDir: 1,
      strafeTimer: 2.0,
      crouching: false,
      muzzleFlashTimer: 0,
      walkCycle: 0,
      barkCooldown: 0,
      lastBarkText: '',
      hasFlashlight: s.archetype === 'varta',
    };
  });
}

export function alertAIFromSound(
  enemies: AIEnemy[],
  soundX: number,
  soundY: number,
  soundZ: number,
  hearingRadius: number
): void {
  for (const ai of enemies) {
    if (ai.state === 'DEAD') continue;
    const dist = Math.hypot(ai.x - soundX, ai.y - soundY, ai.z - soundZ);
    if (dist <= hearingRadius && Math.abs(ai.y - soundY) < 6.5) {
      ai.lastKnownPlayerPos = [soundX, soundY, soundZ];
      ai.alertLevel = Math.min(100, ai.alertLevel + 55);
      if (ai.state === 'IDLE' || ai.state === 'PATROL' || ai.state === 'SEARCH') {
        ai.state = 'INVESTIGATE';
        ai.stateTimer = 11.0;
      }
    }
  }
}

export function updateAIEnemies(
  dt: number,
  enemies: AIEnemy[],
  player: {
    x: number;
    y: number;
    z: number;
    crouching: boolean;
    sprinting: boolean;
    flashlightOn: boolean;
  },
  boxes: WorldBox[],
  doors: InteractiveDoor[],
  onEnemyFire: (ai: AIEnemy, hitPlayer: boolean, damage: number, causeBleed: boolean, causeFracture: boolean) => void,
  onEnemyBark: (ai: AIEnemy, text: string) => void
): void {
  for (const ai of enemies) {
    if (ai.state === 'DEAD') {
      stepRagdollPhysics(dt, ai, boxes, doors);
      continue;
    }

    ai.muzzleFlashTimer = Math.max(0, ai.muzzleFlashTimer - dt);
    ai.flinchTimer = Math.max(0, (ai.flinchTimer || 0) - dt * 3.4);
    ai.fireCooldown = Math.max(0, ai.fireCooldown - dt);
    ai.barkCooldown = Math.max(0, ai.barkCooldown - dt);
    ai.stateTimer = Math.max(0, ai.stateTimer - dt);

    const wpn = WEAPON_STATS[ai.weaponId] || WEAPON_STATS.wpn_pmm;
    if (ai.reloadTimer > 0) {
      ai.reloadTimer -= dt;
      if (ai.reloadTimer <= 0) {
        ai.ammoInMag = wpn.magCapacity;
      }
    }

    const dx = player.x - ai.x;
    const dy = player.y + 1.2 - (ai.y + 1.5);
    const dz = player.z - ai.z;
    const distToPlayer = Math.hypot(dx, dy, dz);

    const fwdX = -Math.sin(ai.yaw);
    const fwdZ = -Math.cos(ai.yaw);
    const toPlayerHorizLen = Math.hypot(dx, dz) || 1;
    const dot = (fwdX * dx + fwdZ * dz) / toPlayerHorizLen;

    let sightRange = 36;
    if (player.crouching) sightRange *= 0.68;
    if (player.flashlightOn) sightRange *= 1.28;
    if (ai.archetype === 'varta') sightRange *= 1.18;

    const fovCos = ai.state === 'COMBAT' || ai.state === 'INVESTIGATE' ? -0.15 : 0.35;

    let canSeePlayer = false;
    if (distToPlayer <= sightRange && (dot >= fovCos || distToPlayer < 5.5)) {
      canSeePlayer = hasLineOfSight(
        ai.x,
        ai.y + 1.55,
        ai.z,
        player.x,
        player.y + (player.crouching ? 0.95 : 1.45),
        player.z,
        boxes,
        doors
      );
    }

    if (canSeePlayer) {
      const wasCalm = ai.state !== 'COMBAT' && ai.state !== 'SEEK_COVER';
      ai.lastKnownPlayerPos = [player.x, player.y, player.z];
      ai.alertLevel = 100;
      ai.state = ai.hp < ai.maxHp * 0.35 ? 'SEEK_COVER' : 'COMBAT';
      ai.stateTimer = 8.0;

      if (wasCalm && ai.barkCooldown <= 0) {
        const pool = COMBAT_BARKS[ai.archetype].spot;
        const msg = pool[Math.floor(Math.random() * pool.length)];
        ai.lastBarkText = msg;
        ai.barkCooldown = 7.5;
        onEnemyBark(ai, msg);
      }
    }

    let moveTarget: [number, number, number] | null = null;
    let moveSpeed = 2.2;

    if (ai.state === 'PATROL') {
      ai.crouching = false;
      const wp = ai.patrolPoints[ai.currentPatrolIdx];
      const dWp = Math.hypot(wp[0] - ai.x, wp[2] - ai.z);
      if (dWp < 1.2) {
        ai.state = 'IDLE';
        ai.stateTimer = 2.5 + Math.random() * 2.5;
        ai.currentPatrolIdx = (ai.currentPatrolIdx + 1) % ai.patrolPoints.length;
      } else {
        moveTarget = wp;
        moveSpeed = 1.85;
      }
    } else if (ai.state === 'IDLE') {
      ai.crouching = false;
      if (ai.stateTimer <= 0) {
        ai.state = 'PATROL';
      }
    } else if (ai.state === 'INVESTIGATE' || ai.state === 'SEARCH') {
      ai.crouching = false;
      if (ai.lastKnownPlayerPos) {
        const dLkp = Math.hypot(ai.lastKnownPlayerPos[0] - ai.x, ai.lastKnownPlayerPos[2] - ai.z);
        if (dLkp > 1.8) {
          moveTarget = ai.lastKnownPlayerPos;
          moveSpeed = 2.65;
        } else if (ai.stateTimer <= 0) {
          ai.state = 'PATROL';
          ai.lastKnownPlayerPos = null;
        }
      } else {
        ai.state = 'PATROL';
      }
    } else if (ai.state === 'COMBAT' || ai.state === 'SEEK_COVER') {
      ai.targetYaw = Math.atan2(-dx, -dz);
      ai.strafeTimer -= dt;
      if (ai.strafeTimer <= 0) {
        ai.strafeDir = Math.random() < 0.5 ? -1 : 1;
        ai.strafeTimer = 1.4 + Math.random() * 1.4;
        ai.crouching = ai.state === 'SEEK_COVER' || Math.random() < 0.35;
      }

      if (!canSeePlayer) {
        if (ai.stateTimer <= 0) {
          ai.state = 'SEARCH';
          ai.stateTimer = 7.0;
          if (ai.barkCooldown <= 0) {
            const msg = COMBAT_BARKS[ai.archetype].search[0];
            ai.barkCooldown = 8.0;
            onEnemyBark(ai, msg);
          }
        } else if (ai.lastKnownPlayerPos) {
          moveTarget = ai.lastKnownPlayerPos;
          moveSpeed = 2.8;
        }
      } else {
        const rightX = Math.cos(ai.yaw);
        const rightZ = -Math.sin(ai.yaw);
        let pushPull = 0;
        if (distToPlayer > 24 && ai.weaponId !== 'wpn_svds') pushPull = 1;
        else if (distToPlayer < 7 || ai.state === 'SEEK_COVER') pushPull = -1;

        moveTarget = [
          ai.x + rightX * ai.strafeDir * 2.5 + (dx / toPlayerHorizLen) * pushPull * 2.5,
          ai.y,
          ai.z + rightZ * ai.strafeDir * 2.5 + (dz / toPlayerHorizLen) * pushPull * 2.5,
        ];
        moveSpeed = ai.crouching ? 1.5 : 2.5;

        if (ai.reloadTimer <= 0 && ai.fireCooldown <= 0) {
          if (ai.ammoInMag <= 0) {
            ai.reloadTimer = wpn.reloadTimeSec;
            if (ai.barkCooldown <= 0) {
              const msg = COMBAT_BARKS[ai.archetype].reload[0];
              ai.barkCooldown = 6.0;
              onEnemyBark(ai, msg);
            }
          } else {
            ai.ammoInMag--;
            ai.muzzleFlashTimer = 0.07;
            if (ai.burstRemaining > 0) {
              ai.burstRemaining--;
              ai.fireCooldown = 60 / wpn.rpm + 0.06;
            } else {
              ai.burstRemaining = wpn.fireModes.includes('auto') ? 2 + Math.floor(Math.random() * 3) : 0;
              ai.fireCooldown = 0.65 + Math.random() * 0.65;
            }

            const baseAcc = ai.archetype === 'varta' ? 0.52 : ai.archetype === 'brigadir' ? 0.42 : 0.34;
            const distFactor = Math.max(0.12, 1.0 - distToPlayer / 68);
            const stanceFactor = player.crouching ? 0.72 : player.sprinting ? 0.82 : 1.0;
            const hitProb = baseAcc * distFactor * stanceFactor;

            const hitPlayer = Math.random() < hitProb;
            const rawDmg = wpn.damage * (wpn.pellets ? 2.2 : 0.52);
            const bleed = hitPlayer && Math.random() < 0.25;
            const frac = hitPlayer && Math.random() < 0.14;

            onEnemyFire(ai, hitPlayer, rawDmg, bleed, frac);
          }
        }
      }
    }

    if (moveTarget) {
      const mx = moveTarget[0] - ai.x;
      const mz = moveTarget[2] - ai.z;
      const mLen = Math.hypot(mx, mz);
      if (mLen > 0.2) {
        const dirX = mx / mLen;
        const dirZ = mz / mLen;
        if (ai.state !== 'COMBAT') {
          ai.targetYaw = Math.atan2(-dirX, -dirZ);
        }
        const nx = ai.x + dirX * moveSpeed * dt;
        const nz = ai.z + dirZ * moveSpeed * dt;
        if (hasLineOfSight(ai.x, ai.y + 0.9, ai.z, nx + dirX * 0.45, ai.y + 0.9, nz + dirZ * 0.45, boxes, doors)) {
          ai.x = nx;
          ai.z = nz;
          ai.walkCycle += moveSpeed * dt * 3.8;
        } else {
          ai.strafeDir *= -1;
        }
      }
    }

    let diffYaw = ai.targetYaw - ai.yaw;
    while (diffYaw > Math.PI) diffYaw -= Math.PI * 2;
    while (diffYaw < -Math.PI) diffYaw += Math.PI * 2;
    ai.yaw += diffYaw * Math.min(1.0, dt * 7.5);
  }
}

export function createCorpseLootContainer(
  ai: AIEnemy,
  killedByWeaponName: string
): WorldLootContainer {
  const items: InventoryItemInstance[] = [];

  const wpnInst = createItemInstance(ai.weaponId, 0, 0, 1, false);
  wpnInst.ammoInMag = ai.ammoInMag;
  items.push(wpnInst);

  const wpnStats = WEAPON_STATS[ai.weaponId];
  if (wpnStats) {
    items.push(createItemInstance(wpnStats.ammoItemId, 0, 2, 12 + Math.floor(Math.random() * 18)));
  }

  const dogtag = createItemInstance('dogtag_stalker', 1, 2, 1);
  dogtag.dogtagInfo = {
    victimName: ai.name,
    faction: ai.factionLabel,
    level: ai.archetype === 'varta' ? 14 : ai.archetype === 'brigadir' ? 8 : 3,
    killedByWeapon: killedByWeaponName,
    timestamp: new Date().toLocaleTimeString(),
  };
  items.push(dogtag);

  const bonusPool =
    ai.archetype === 'varta'
      ? ['med_salewa', 'val_circuit', 'med_antirad']
      : ai.archetype === 'brigadir'
      ? ['med_ai2', 'val_capacitor', 'food_tushonka']
      : ['med_bandage', 'med_esmarch', 'val_bolts'];
  const bonusId = bonusPool[Math.floor(Math.random() * bonusPool.length)];
  items.push(createItemInstance(bonusId, 2, 2, 1));

  return {
    id: `corpse_${ai.id}_${nextItemUid()}`,
    name: `${ai.name} (Fallen ${ai.factionLabel})`,
    cyrillicLabel: `CORPSE: ${ai.name.toUpperCase()}`,
    type: 'corpse',
    x: ai.x,
    y: ai.y,
    z: ai.z,
    rotY: ai.yaw,
    searched: false,
    isRagdollCorpse: true,
    grid: {
      id: `grid_corpse_${ai.id}`,
      name: `${ai.name}'s Gear & Pockets`,
      cols: 5,
      rows: 4,
      items,
    },
  };
}


export function triggerEnemyRagdoll(
  ai: AIEnemy,
  dirX: number,
  dirY: number,
  dirZ: number,
  isHeadshot: boolean,
  impulseScale = 1.0
): void {
  const horizLen = Math.hypot(dirX, dirZ) || 1;
  const nx = dirX / horizLen;
  const nz = dirZ / horizLen;
  const fallYaw = Math.atan2(-nx, -nz);
  const sinY = Math.sin(ai.yaw);
  const cosY = Math.cos(ai.yaw);
  const rightX = cosY;
  const rightZ = -sinY;

  const boost = (isHeadshot ? 1.45 : 1.0) * impulseScale;
  ai.ragdoll = {
    active: true,
    ageSec: 0,
    settled: false,
    groundY: ai.y,
    vx: nx * (2.6 + Math.random() * 0.9) * boost,
    vy: Math.max(0.85, dirY * 1.5 + (isHeadshot ? 1.55 : 0.95)),
    vz: nz * (2.6 + Math.random() * 0.9) * boost,
    fallYaw,
    bodyPitch: 0.08,
    vBodyPitch: (isHeadshot ? 5.2 : 3.8) * boost,
    bodyRoll: (Math.random() - 0.5) * 0.16,
    vBodyRoll: (Math.random() - 0.5) * 3.2,
    headPitch: isHeadshot ? -0.55 : 0.15,
    headYaw: (Math.random() - 0.5) * 0.5,
    vHeadPitch: isHeadshot ? -8.5 : 3.4,
    vHeadYaw: (Math.random() - 0.5) * 6.0,
    armLPitch: 0.7,
    armLRoll: -0.35,
    vArmLPitch: 4.5 + Math.random() * 3.0,
    vArmLRoll: -2.2 - Math.random() * 1.8,
    armRPitch: 0.6,
    armRRoll: 0.35,
    vArmRPitch: -3.8 - Math.random() * 3.0,
    vArmRRoll: 2.4 + Math.random() * 1.8,
    legLPitch: -0.2,
    legLRoll: -0.14,
    vLegLPitch: -3.2 - Math.random() * 2.0,
    vLegLRoll: -1.1 - Math.random() * 0.9,
    legRPitch: 0.25,
    legRRoll: 0.14,
    vLegRPitch: 2.8 + Math.random() * 2.0,
    vLegRRoll: 1.1 + Math.random() * 0.9,
    kneeL: 0.35 + Math.random() * 0.45,
    kneeR: 0.25 + Math.random() * 0.5,
    elbowL: 0.45 + Math.random() * 0.5,
    elbowR: 0.4 + Math.random() * 0.55,
    wpnX: ai.x - sinY * 0.42 + rightX * 0.18,
    wpnY: ai.y + 1.05,
    wpnZ: ai.z - cosY * 0.42 + rightZ * 0.18,
    wpnVx: nx * 2.2 + rightX * (0.9 + Math.random() * 0.8),
    wpnVy: 1.9 + Math.random() * 0.8,
    wpnVz: nz * 2.2 + rightZ * (0.9 + Math.random() * 0.8),
    wpnYaw: ai.yaw + 0.3,
    wpnPitch: 0.4,
    wpnRoll: 0.2,
    vWpnYaw: (Math.random() - 0.5) * 9.5,
    bloodPoolRadius: 0.12,
    maxBloodPoolRadius: isHeadshot ? 0.92 : 0.74,
  };
}

export function joltDeadRagdoll(ai: AIEnemy, dirX: number, dirY: number, dirZ: number): void {
  const r = ai.ragdoll;
  if (!r) return;
  r.settled = false;
  r.vx += dirX * 1.65;
  r.vy = Math.max(r.vy, 0.55 + Math.abs(dirY) * 0.6);
  r.vz += dirZ * 1.65;
  r.vBodyRoll += (Math.random() - 0.5) * 3.5;
  r.vArmLPitch += (Math.random() - 0.5) * 6.5;
  r.vArmRPitch += (Math.random() - 0.5) * 6.5;
  r.vLegLPitch += (Math.random() - 0.5) * 4.5;
  r.vLegRPitch += (Math.random() - 0.5) * 4.5;
  r.vHeadYaw += (Math.random() - 0.5) * 6.0;
  r.maxBloodPoolRadius = Math.min(1.25, r.maxBloodPoolRadius + 0.08);
}

function stepRagdollPhysics(dt: number, ai: AIEnemy, boxes: WorldBox[], doors: InteractiveDoor[]): void {
  const r = ai.ragdoll;
  if (!r) return;
  r.ageSec += dt;

  // Expand pool of blood beneath torso/head
  if (r.bloodPoolRadius < r.maxBloodPoolRadius) {
    r.bloodPoolRadius = Math.min(r.maxBloodPoolRadius, r.bloodPoolRadius + dt * 0.24);
  }

  // Update dropped weapon rigid-body physics
  if (r.wpnY > r.groundY + 0.05 || Math.hypot(r.wpnVx, r.wpnVz) > 0.05) {
    r.wpnVy -= 14.5 * dt;
    r.wpnX += r.wpnVx * dt;
    r.wpnY += r.wpnVy * dt;
    r.wpnZ += r.wpnVz * dt;
    r.wpnYaw += r.vWpnYaw * dt;
    r.wpnPitch += (1.57 - r.wpnPitch) * Math.min(1.0, dt * 6.0);
    if (r.wpnY <= r.groundY + 0.05) {
      r.wpnY = r.groundY + 0.05;
      if (Math.abs(r.wpnVy) > 0.6) {
        r.wpnVy = -r.wpnVy * 0.28;
      } else {
        r.wpnVy = 0;
      }
      const drag = Math.max(0, 1.0 - dt * 7.5);
      r.wpnVx *= drag;
      r.wpnVz *= drag;
      r.vWpnYaw *= drag;
    }
  }

  if (r.settled && Math.hypot(r.vx, r.vz) < 0.02 && Math.abs(r.vBodyPitch) < 0.02) {
    return;
  }

  // Root translation & wall collision check
  r.vy -= 14.8 * dt;
  const nx = ai.x + r.vx * dt;
  const nz = ai.z + r.vz * dt;
  if (hasLineOfSight(ai.x, r.groundY + 0.45, ai.z, nx, r.groundY + 0.45, nz, boxes, doors)) {
    ai.x = nx;
    ai.z = nz;
  } else {
    r.vx *= -0.35;
    r.vz *= -0.35;
  }

  ai.y += r.vy * dt;
  if (ai.y <= r.groundY) {
    ai.y = r.groundY;
    if (r.vy < -1.1) {
      r.vy = -r.vy * 0.22;
    } else {
      r.vy = 0;
    }
    const groundFriction = Math.max(0, 1.0 - dt * (r.bodyPitch > 1.25 ? 6.8 : 2.8));
    r.vx *= groundFriction;
    r.vz *= groundFriction;
  }

  // Gravity torque pulls bodyPitch toward 1.52 rad (~87 deg flat on ground)
  const sinPitch = Math.max(0.18, Math.sin(Math.min(1.52, r.bodyPitch)));
  if (r.bodyPitch < 1.51) {
    r.vBodyPitch += sinPitch * 13.5 * dt;
  }
  r.bodyPitch += r.vBodyPitch * dt;

  // Ground impact bounce & limb slap when torso hits ground
  if (r.bodyPitch >= 1.51) {
    r.bodyPitch = 1.51;
    if (r.vBodyPitch > 0.85) {
      r.vBodyPitch = -r.vBodyPitch * 0.26;
      r.vArmLPitch += (Math.random() - 0.5) * 4.2;
      r.vArmRPitch += (Math.random() - 0.5) * 4.2;
      r.vHeadPitch -= 2.8;
    } else {
      r.vBodyPitch = 0;
    }
  }

  // Body roll & limb spring-damper settling onto ground plane
  r.bodyRoll += r.vBodyRoll * dt;
  r.vBodyRoll *= Math.max(0, 1.0 - dt * 5.0);
  r.bodyRoll = Math.max(-0.48, Math.min(0.48, r.bodyRoll));

  const damp = Math.max(0, 1.0 - dt * (r.bodyPitch >= 1.45 ? 6.2 : 2.2));
  r.headPitch = Math.max(-0.75, Math.min(0.65, r.headPitch + r.vHeadPitch * dt));
  r.headYaw = Math.max(-0.85, Math.min(0.85, r.headYaw + r.vHeadYaw * dt));
  r.vHeadPitch = (r.vHeadPitch - r.headPitch * 9.0 * dt) * damp;
  r.vHeadYaw = (r.vHeadYaw - r.headYaw * 8.0 * dt) * damp;

  // Arms settle splayed onto the ground when body is horizontal
  const targetArmPitch = r.bodyPitch > 1.2 ? 0.12 : 0.65;
  r.armLPitch = Math.max(-1.35, Math.min(1.45, r.armLPitch + r.vArmLPitch * dt));
  r.armRPitch = Math.max(-1.35, Math.min(1.45, r.armRPitch + r.vArmRPitch * dt));
  r.vArmLPitch = (r.vArmLPitch + (targetArmPitch - r.armLPitch) * 10.0 * dt) * damp;
  r.vArmRPitch = (r.vArmRPitch + (-targetArmPitch - r.armRPitch) * 10.0 * dt) * damp;

  r.armLRoll = Math.max(-1.25, Math.min(-0.22, r.armLRoll + r.vArmLRoll * dt));
  r.armRRoll = Math.max(0.22, Math.min(1.25, r.armRRoll + r.vArmRRoll * dt));
  r.vArmLRoll *= damp;
  r.vArmRRoll *= damp;

  // Legs settle slightly splayed on ground
  r.legLPitch = Math.max(-0.85, Math.min(0.85, r.legLPitch + r.vLegLPitch * dt));
  r.legRPitch = Math.max(-0.85, Math.min(0.85, r.legRPitch + r.vLegRPitch * dt));
  r.vLegLPitch = (r.vLegLPitch + (-0.12 - r.legLPitch) * 9.0 * dt) * damp;
  r.vLegRPitch = (r.vLegRPitch + (0.14 - r.legRPitch) * 9.0 * dt) * damp;

  r.legLRoll = Math.max(-0.55, Math.min(-0.08, r.legLRoll + r.vLegLRoll * dt));
  r.legRRoll = Math.max(0.08, Math.min(0.55, r.legRRoll + r.vLegRRoll * dt));
  r.vLegLRoll *= damp;
  r.vLegRRoll *= damp;

  if (
    r.bodyPitch >= 1.5 &&
    Math.abs(r.vBodyPitch) < 0.05 &&
    Math.hypot(r.vx, r.vz) < 0.03 &&
    Math.abs(r.vArmLPitch) < 0.08
  ) {
    r.settled = true;
  }
}
