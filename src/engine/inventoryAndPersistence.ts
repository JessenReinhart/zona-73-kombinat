// src/engine/inventoryAndPersistence.ts
// Spatial 2D Grid Inventory Engine, Loadout Validation, Death/Extraction Rules, and IndexedDB + localStorage Persistence

import {
  GridContainer,
  InventoryItemInstance,
  PersistentSaveData,
  PlayerEquipment,
} from '../types/game';
import { ITEM_TEMPLATES } from '../data/itemsAndWeapons';
import { createItemInstance, nextItemUid } from './worldBuilder';

const STORAGE_KEY = 'zona73_save_v2_en';
const DB_NAME = 'Zona73DatabaseV2';
const STORE_NAME = 'saves';

export function getItemDimensions(item: InventoryItemInstance): [number, number] {
  const tpl = ITEM_TEMPLATES[item.templateId];
  if (!tpl) return [1, 1];
  return item.rotated ? [tpl.height, tpl.width] : [tpl.width, tpl.height];
}

export function canPlaceItemInGrid(
  grid: GridContainer,
  item: InventoryItemInstance,
  targetX: number,
  targetY: number,
  rotated = item.rotated,
  ignoreUid?: string
): boolean {
  const tpl = ITEM_TEMPLATES[item.templateId];
  if (!tpl) return false;
  const w = rotated ? tpl.height : tpl.width;
  const h = rotated ? tpl.width : tpl.height;

  if (targetX < 0 || targetY < 0 || targetX + w > grid.cols || targetY + h > grid.rows) {
    return false;
  }

  for (const other of grid.items) {
    if (other.uid === item.uid || other.uid === ignoreUid) continue;
    const [ow, oh] = getItemDimensions(other);
    const overlapX = targetX < other.x + ow && targetX + w > other.x;
    const overlapY = targetY < other.y + oh && targetY + h > other.y;
    if (overlapX && overlapY) {
      return false;
    }
  }
  return true;
}

export function findFreeSlotInGrid(
  grid: GridContainer,
  item: InventoryItemInstance
): { x: number; y: number; rotated: boolean } | null {
  const tpl = ITEM_TEMPLATES[item.templateId];
  if (!tpl) return null;

  for (const rot of [item.rotated, !item.rotated]) {
    for (let y = 0; y < grid.rows; y++) {
      for (let x = 0; x < grid.cols; x++) {
        if (canPlaceItemInGrid(grid, item, x, y, rot)) {
          return { x, y, rotated: rot };
        }
      }
    }
  }
  return null;
}

export function transferItemBetweenGrids(
  sourceGrid: GridContainer,
  destGrid: GridContainer,
  itemUid: string,
  destX?: number,
  destY?: number,
  destRotated?: boolean
): boolean {
  const idx = sourceGrid.items.findIndex((i) => i.uid === itemUid);
  if (idx === -1) return false;
  const item = sourceGrid.items[idx];
  const tpl = ITEM_TEMPLATES[item.templateId];
  if (!tpl) return false;

  if (tpl.maxStack > 1 && destX === undefined) {
    for (const existing of destGrid.items) {
      if (existing.templateId === item.templateId && existing.uid !== item.uid && existing.count < tpl.maxStack) {
        const space = tpl.maxStack - existing.count;
        const moveCount = Math.min(space, item.count);
        existing.count += moveCount;
        item.count -= moveCount;
        if (item.count <= 0) {
          sourceGrid.items.splice(idx, 1);
          return true;
        }
      }
    }
  }

  if (destX !== undefined && destY !== undefined) {
    const rot = destRotated !== undefined ? destRotated : item.rotated;
    if (canPlaceItemInGrid(destGrid, item, destX, destY, rot, item.uid)) {
      sourceGrid.items.splice(idx, 1);
      item.x = destX;
      item.y = destY;
      item.rotated = rot;
      destGrid.items.push(item);
      return true;
    }
    return false;
  }

  const slot = findFreeSlotInGrid(destGrid, item);
  if (!slot) return false;

  sourceGrid.items.splice(idx, 1);
  item.x = slot.x;
  item.y = slot.y;
  item.rotated = slot.rotated;
  destGrid.items.push(item);
  return true;
}

export function countAvailableAmmo(
  ammoTemplateId: string,
  rig: GridContainer,
  backpack: GridContainer,
  secure: GridContainer
): number {
  let total = 0;
  for (const g of [rig, backpack, secure]) {
    for (const i of g.items) {
      if (i.templateId === ammoTemplateId) total += i.count;
    }
  }
  return total;
}

export function consumeAmmoFromLoadout(
  ammoTemplateId: string,
  needed: number,
  rig: GridContainer,
  backpack: GridContainer,
  secure: GridContainer
): number {
  let taken = 0;
  for (const g of [rig, backpack, secure]) {
    for (let idx = g.items.length - 1; idx >= 0; idx--) {
      const itm = g.items[idx];
      if (itm.templateId === ammoTemplateId) {
        const use = Math.min(needed - taken, itm.count);
        itm.count -= use;
        taken += use;
        if (itm.count <= 0) {
          g.items.splice(idx, 1);
        }
        if (taken >= needed) return taken;
      }
    }
  }
  return taken;
}

export function hasKeyInLoadout(
  keyId: string,
  rig: GridContainer,
  backpack: GridContainer,
  secure: GridContainer
): boolean {
  for (const g of [rig, backpack, secure]) {
    if (g.items.some((i) => i.templateId === keyId)) return true;
  }
  return false;
}

export function calculateLoadoutWeightKg(
  equip: PlayerEquipment,
  rig: GridContainer,
  backpack: GridContainer,
  secure: GridContainer
): number {
  let weight = 0.8;
  const slots: (InventoryItemInstance | null)[] = [
    equip.primary1,
    equip.primary2,
    equip.sidearm,
    equip.armor,
    equip.rig,
    equip.backpack,
  ];
  for (const s of slots) {
    if (s && ITEM_TEMPLATES[s.templateId]) {
      weight += ITEM_TEMPLATES[s.templateId].weightKg;
    }
  }
  for (const g of [rig, backpack, secure]) {
    for (const itm of g.items) {
      const tpl = ITEM_TEMPLATES[itm.templateId];
      if (tpl) {
        weight += tpl.weightKg * itm.count;
      }
    }
  }
  return Math.round(weight * 10) / 10;
}

export function createDefaultSaveData(): PersistentSaveData {
  const stash: GridContainer = {
    id: 'stash',
    name: 'BUNKER STASH',
    cols: 10,
    rows: 14,
    items: [
      createItemInstance('wpn_toz106', 0, 0),
      createItemInstance('ammo_20ga', 3, 0, 20),
      createItemInstance('ammo_545', 4, 0, 60),
      createItemInstance('ammo_9x18', 5, 0, 40),
      createItemInstance('med_ai2', 6, 0),
      createItemInstance('med_bandage', 7, 0),
      createItemInstance('med_splint', 8, 0),
      createItemInstance('food_tushonka', 6, 1),
      createItemInstance('food_water', 9, 0),
      createItemInstance('val_bolts', 0, 2),
      createItemInstance('val_wires', 1, 2),
    ],
  };

  const secureContainer: GridContainer = {
    id: 'secure',
    name: 'KOVCHEG-2 SECURE CASE (2x2 - KEPT ON DEATH)',
    cols: 2,
    rows: 2,
    items: [
      createItemInstance('med_ai2', 0, 0),
      createItemInstance('med_antirad', 1, 0),
    ],
  };

  const rigGrid: GridContainer = {
    id: 'rig',
    name: 'TACTICAL RIG POCKETS',
    cols: 4,
    rows: 2,
    items: [
      createItemInstance('ammo_545', 0, 0, 60),
      createItemInstance('ammo_9x18', 1, 0, 32),
      createItemInstance('med_bandage', 2, 0),
      createItemInstance('med_esmarch', 3, 0),
    ],
  };

  const backpackGrid: GridContainer = {
    id: 'backpack',
    name: 'BACKPACK COMPARTMENT',
    cols: 4,
    rows: 4,
    items: [],
  };

  const equipment: PlayerEquipment = {
    primary1: createItemInstance('wpn_aks74u', 0, 0),
    primary2: null,
    sidearm: createItemInstance('wpn_pmm', 0, 0),
    armor: createItemInstance('armor_6b2', 0, 0),
    rig: createItemInstance('rig_lifchik', 0, 0),
    backpack: createItemInstance('bp_veshmeshok', 0, 0),
  };

  return {
    version: 2,
    callsign: 'RAVEN-73',
    level: 1,
    xp: 0,
    rubles: 28500,
    raidsPlayed: 0,
    raidsExtracted: 0,
    totalKills: 0,
    stash,
    secureContainer,
    rigGrid,
    backpackGrid,
    equipment,
    hideout: {
      generatorLevel: 1,
      medstationLevel: 1,
      workbenchLevel: 1,
    },
    raidHistory: [],
    settings: {
      preset: 'high',
      resolutionScale: 1.0,
      fov: 78,
      mouseSensitivity: 1.0,
      fogDensity: 0.012,
      dynamicLights: true,
      particles: true,
      filmGrain: true,
      vignette: true,
      headBob: true,
      masterVolume: 0.8,
      ambientVolume: 0.65,
    },
  };
}

export function sanitizeSaveData(raw: unknown): PersistentSaveData {
  const def = createDefaultSaveData();
  if (!raw || typeof raw !== 'object') return def;
  const obj = raw as Partial<PersistentSaveData>;
  if (obj.version !== 2 || !obj.stash || !obj.equipment || !obj.secureContainer) {
    return def;
  }
  return {
    ...def,
    ...obj,
    settings: { ...def.settings, ...(obj.settings || {}) },
    hideout: { ...def.hideout, ...(obj.hideout || {}) },
  };
}

export function loadSaveDataSync(): PersistentSaveData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return sanitizeSaveData(JSON.parse(raw));
    }
  } catch {
    // Fallback to default
  }
  return createDefaultSaveData();
}

export function saveGameData(data: PersistentSaveData): void {
  try {
    const serialized = JSON.stringify(data);
    localStorage.setItem(STORAGE_KEY, serialized);
  } catch {
    // Ignore quota errors
  }

  try {
    if (typeof indexedDB !== 'undefined') {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(data, 'profile_main');
      };
    }
  } catch {
    // Ignore IndexedDB errors
  }
}

export function loadSaveFromIndexedDB(onLoaded: (data: PersistentSaveData) => void): void {
  try {
    if (typeof indexedDB === 'undefined') return;
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction(STORE_NAME, 'readonly');
      const getReq = tx.objectStore(STORE_NAME).get('profile_main');
      getReq.onsuccess = () => {
        if (getReq.result) {
          onLoaded(sanitizeSaveData(getReq.result));
        }
      };
    };
  } catch {
    // Fallback already handled by localStorage
  }
}

export function grantEmergencyWelfareKitIfNeeded(save: PersistentSaveData): boolean {
  const hasAnyWeapon =
    Boolean(save.equipment.primary1) ||
    Boolean(save.equipment.primary2) ||
    Boolean(save.equipment.sidearm) ||
    save.stash.items.some((i) => ITEM_TEMPLATES[i.templateId]?.category === 'weapon');

  if (!hasAnyWeapon && save.rubles < 7500) {
    if (!save.equipment.sidearm) {
      save.equipment.sidearm = createItemInstance('wpn_pmm', 0, 0);
    }
    if (!save.equipment.rig) {
      save.equipment.rig = createItemInstance('rig_lifchik', 0, 0);
    }
    const ammo = createItemInstance('ammo_9x18', 0, 0, 32);
    const med = createItemInstance('med_bandage', 1, 0, 1);
    transferItemBetweenGrids({ id: 'tmp', name: 'tmp', cols: 4, rows: 4, items: [ammo, med] }, save.rigGrid, ammo.uid);
    transferItemBetweenGrids({ id: 'tmp', name: 'tmp', cols: 4, rows: 4, items: [med] }, save.rigGrid, med.uid);
    return true;
  }
  return false;
}

export { nextItemUid };
