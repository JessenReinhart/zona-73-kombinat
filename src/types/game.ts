// src/types/game.ts
// Explicit TypeScript interfaces for ZONA-73: KOMBINAT

export type ItemCategory =
  | 'weapon'
  | 'ammo'
  | 'medical'
  | 'provision'
  | 'armor'
  | 'rig'
  | 'backpack'
  | 'key'
  | 'barter'
  | 'dogtag';

export type EquipSlotType =
  | 'primary1'
  | 'primary2'
  | 'sidearm'
  | 'armor'
  | 'rig'
  | 'backpack';

export type SurfaceMaterial =
  | 'concrete'
  | 'asphalt'
  | 'mud'
  | 'metal'
  | 'wood'
  | 'water'
  | 'tile'
  | 'brick';

export interface WeaponStats {
  id: string;
  caliber: string;
  ammoItemId: string;
  magCapacity: number;
  fireModes: ('semi' | 'auto' | 'bolt')[];
  rpm: number;
  damage: number;
  armorPenetration: number; // 1 - 60
  muzzleVelocity: number;
  effectiveRange: number;
  hipSpread: number;
  adsSpread: number;
  recoilVertical: number;
  recoilHorizontal: number;
  adsFovZoom: number;
  reloadTimeSec: number;
  pellets?: number;
  isScoped?: boolean;
  soundProfile: 'pistol' | 'rifle' | 'shotgun' | 'sniper';
}

export interface ItemTemplate {
  id: string;
  name: string;
  shortName: string;
  cyrillicName: string;
  category: ItemCategory;
  description: string;
  width: number; // Grid cells wide
  height: number; // Grid cells tall
  weightKg: number;
  baseValueRubles: number;
  maxStack: number;
  rarity: 'common' | 'uncommon' | 'rare' | 'military' | 'artifact';
  iconColor: string;
  iconAccent: string;
  iconSymbol: string;
  equipSlot?: 'weapon_long' | 'weapon_sidearm' | 'armor' | 'rig' | 'backpack';
  weaponStats?: WeaponStats;
  // Medical & survival effects
  healAmount?: number;
  stopsHeavyBleed?: boolean;
  stopsLightBleed?: boolean;
  curesFracture?: boolean;
  painkillerSec?: number;
  radReduce?: number;
  energyRestore?: number;
  hydrationRestore?: number;
  useTimeSec?: number;
  // Armor / container properties
  armorClass?: number; // 1 - 5
  maxDurability?: number;
  gridCols?: number;
  gridRows?: number;
}

export interface InventoryItemInstance {
  uid: string;
  templateId: string;
  x: number; // Column in container grid
  y: number; // Row in container grid
  rotated: boolean;
  count: number;
  // Weapon state
  ammoInMag?: number;
  fireMode?: 'semi' | 'auto' | 'bolt';
  // Armor state
  durability?: number;
  // Dogtag metadata
  dogtagInfo?: {
    victimName: string;
    faction: string;
    level: number;
    killedByWeapon: string;
    timestamp: string;
  };
}

export interface GridContainer {
  id: string;
  name: string;
  cols: number;
  rows: number;
  items: InventoryItemInstance[];
}

export interface PlayerEquipment {
  primary1: InventoryItemInstance | null;
  primary2: InventoryItemInstance | null;
  sidearm: InventoryItemInstance | null;
  armor: InventoryItemInstance | null;
  rig: InventoryItemInstance | null;
  backpack: InventoryItemInstance | null;
}

export interface WorldBox {
  id?: string;
  x: number;
  y: number; // bottom Y or center Y depending on builder helper
  z: number;
  w: number;
  h: number;
  d: number;
  rotY?: number;
  mat: string;
  surface: SurfaceMaterial;
  collide: boolean;
  uvScale?: [number, number];
  tint?: [number, number, number];
  isRamp?: boolean;
  hidden?: boolean; // If true, climbs from y to y+h along local +Z or -Z
  rampDir?: 'north' | 'south' | 'east' | 'west';
  castShadow?: boolean;
}

export interface InteractiveDoor {
  id: string;
  name: string;
  hingeX: number;
  hingeY: number;
  hingeZ: number;
  width: number;
  height: number;
  depth: number;
  closedYaw: number;
  openYaw: number;
  currentYaw: number;
  isOpen: boolean;
  lockedKeyId?: string;
  mat: string;
}

export interface WorldLootContainer {
  id: string;
  name: string;
  cyrillicLabel: string;
  type: 'military_crate' | 'med_locker' | 'filing_cabinet' | 'duffel_bag' | 'corpse' | 'jacket' | 'toolbox';
  x: number;
  y: number;
  z: number;
  rotY: number;
  searched: boolean;
  isRagdollCorpse?: boolean;
  grid: GridContainer;
}

export interface ExtractionPoint {
  id: string;
  name: string;
  codeName: string;
  description: string;
  x: number;
  y: number;
  z: number;
  radius: number;
  countdownSec: number;
  requirementType: 'none' | 'power_switch' | 'key_or_lightweight';
  requiredKeyId?: string;
  maxWeightKg?: number;
}

export interface RadiationZone {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  radius: number;
  radPerSec: number;
}

export type AIState = 'IDLE' | 'PATROL' | 'INVESTIGATE' | 'COMBAT' | 'SEEK_COVER' | 'SEARCH' | 'DEAD';

export type AIArchetype = 'marodyor' | 'brigadir' | 'varta';

export interface AIEnemy {
  id: string;
  name: string;
  archetype: AIArchetype;
  factionLabel: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  targetYaw: number;
  hp: number;
  maxHp: number;
  armorClass: number;
  weaponId: string;
  ammoInMag: number;
  state: AIState;
  stateTimer: number;
  patrolPoints: [number, number, number][];
  currentPatrolIdx: number;
  lastKnownPlayerPos: [number, number, number] | null;
  alertLevel: number; // 0 to 100
  fireCooldown: number;
  reloadTimer: number;
  burstRemaining: number;
  strafeDir: number;
  strafeTimer: number;
  crouching: boolean;
  muzzleFlashTimer: number;
  walkCycle: number;
  barkCooldown: number;
  lastBarkText: string;
  corpseContainerId?: string;
  hasFlashlight: boolean;
  flinchTimer?: number;
  flinchPitch?: number;
  flinchRoll?: number;
  lastHitZone?: 'head' | 'torso' | 'limb';
  ragdoll?: EnemyRagdollState;
}

export interface EnemyRagdollState {
  active: boolean;
  ageSec: number;
  settled: boolean;
  groundY: number;
  vx: number;
  vy: number;
  vz: number;
  fallYaw: number;
  bodyPitch: number;
  vBodyPitch: number;
  bodyRoll: number;
  vBodyRoll: number;
  headPitch: number;
  headYaw: number;
  vHeadPitch: number;
  vHeadYaw: number;
  armLPitch: number;
  armLRoll: number;
  vArmLPitch: number;
  vArmLRoll: number;
  armRPitch: number;
  armRRoll: number;
  vArmRPitch: number;
  vArmRRoll: number;
  legLPitch: number;
  legLRoll: number;
  vLegLPitch: number;
  vLegLRoll: number;
  legRPitch: number;
  legRRoll: number;
  vLegRPitch: number;
  vLegRRoll: number;
  kneeL: number;
  kneeR: number;
  elbowL: number;
  elbowR: number;
  wpnX: number;
  wpnY: number;
  wpnZ: number;
  wpnVx: number;
  wpnVy: number;
  wpnVz: number;
  wpnYaw: number;
  wpnPitch: number;
  wpnRoll: number;
  vWpnYaw: number;
  bloodPoolRadius: number;
  maxBloodPoolRadius: number;
}

export interface BloodDecal3D {
  x: number;
  y: number;
  z: number;
  radiusX: number;
  radiusZ: number;
  rotY: number;
  r: number;
  g: number;
  b: number;
}

export interface RaidRecord {
  id: string;
  timestamp: string;
  outcome: 'EXTRACTED' | 'KIA';
  extractionName?: string;
  durationSec: number;
  kills: number;
  lootValueRubles: number;
  xpEarned: number;
  causeOfDeath?: string;
}

export interface HideoutUpgrades {
  generatorLevel: number; // 0-3 (reduces trader prices & boosts bunker lighting)
  medstationLevel: number; // 0-3 (passive healing & med craft/bonus max HP)
  workbenchLevel: number; // 0-3 (unlocks higher tier ammo/weapons at Voronov)
}

export interface GraphicsSettings {
  preset: 'low' | 'medium' | 'high';
  resolutionScale: number; // 0.65 to 1.0
  fov: number; // 65 to 100
  mouseSensitivity: number; // 0.3 to 2.5
  fogDensity: number; // 0.008 to 0.022
  dynamicLights: boolean;
  particles: boolean;
  filmGrain: boolean;
  vignette: boolean;
  headBob: boolean;
  masterVolume: number; // 0.0 to 1.0
  ambientVolume: number; // 0.0 to 1.0
}

export interface PersistentSaveData {
  version: number;
  callsign: string;
  level: number;
  xp: number;
  rubles: number;
  raidsPlayed: number;
  raidsExtracted: number;
  totalKills: number;
  stash: GridContainer;
  secureContainer: GridContainer;
  rigGrid: GridContainer;
  backpackGrid: GridContainer;
  equipment: PlayerEquipment;
  hideout: HideoutUpgrades;
  raidHistory: RaidRecord[];
  settings: GraphicsSettings;
}
