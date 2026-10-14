// src/engine/physicsAndPlayer.ts
// 3D Collision, Raycasting, Ballistics, and First-Person Player Controller

import {
  AIEnemy,
  InteractiveDoor,
  SurfaceMaterial,
  WorldBox,
} from '../types/game';

export interface RayHit {
  hit: boolean;
  dist: number;
  point: [number, number, number];
  normal: [number, number, number];
  surface: SurfaceMaterial;
  enemy?: AIEnemy;
  isHeadshot?: boolean;
}

// Transform world point into box's local unrotated space (relative to box center X,Z and bottom Y)
function worldToBoxLocal(
  wx: number,
  wy: number,
  wz: number,
  box: WorldBox
): [number, number, number] {
  const dx = wx - box.x;
  const dz = wz - box.z;
  const rot = box.rotY || 0;
  if (rot === 0) {
    return [dx, wy - box.y, dz];
  }
  const c = Math.cos(-rot);
  const s = Math.sin(-rot);
  return [dx * c + dz * s, wy - box.y, -dx * s + dz * c];
}

// Ray vs Oriented Bounding Box intersection
export function rayIntersectBox(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  box: WorldBox,
  maxDist: number
): { dist: number; normal: [number, number, number] } | null {
  if (!box.collide || box.isRamp) return null;

  const rot = box.rotY || 0;
  const c = Math.cos(-rot);
  const s = Math.sin(-rot);

  // Ray origin & direction in box local space (where box spans [-w/2, w/2], [0, h], [-d/2, d/2])
  const relX = ox - box.x;
  const relY = oy - box.y;
  const relZ = oz - box.z;

  const lox = rot === 0 ? relX : relX * c + relZ * s;
  const loy = relY;
  const loz = rot === 0 ? relZ : -relX * s + relZ * c;

  const ldx = rot === 0 ? dx : dx * c + dz * s;
  const ldy = dy;
  const ldz = rot === 0 ? dz : -dx * s + dz * c;

  const hw = box.w * 0.5;
  const hd = box.d * 0.5;

  let tmin = -Infinity;
  let tmax = Infinity;
  let hitNormalLocal: [number, number, number] = [0, 1, 0];

  // X slab
  if (Math.abs(ldx) < 1e-6) {
    if (lox < -hw || lox > hw) return null;
  } else {
    let t1 = (-hw - lox) / ldx;
    let t2 = (hw - lox) / ldx;
    let n1: [number, number, number] = [-1, 0, 0];
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
      n1 = [1, 0, 0];
    }
    if (t1 > tmin) {
      tmin = t1;
      hitNormalLocal = n1;
    }
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return null;
  }

  // Y slab [0, box.h]
  if (Math.abs(ldy) < 1e-6) {
    if (loy < 0 || loy > box.h) return null;
  } else {
    let t1 = (0 - loy) / ldy;
    let t2 = (box.h - loy) / ldy;
    let n1: [number, number, number] = [0, -1, 0];
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
      n1 = [0, 1, 0];
    }
    if (t1 > tmin) {
      tmin = t1;
      hitNormalLocal = n1;
    }
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return null;
  }

  // Z slab
  if (Math.abs(ldz) < 1e-6) {
    if (loz < -hd || loz > hd) return null;
  } else {
    let t1 = (-hd - loz) / ldz;
    let t2 = (hd - loz) / ldz;
    let n1: [number, number, number] = [0, 0, -1];
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
      n1 = [0, 0, 1];
    }
    if (t1 > tmin) {
      tmin = t1;
      hitNormalLocal = n1;
    }
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return null;
  }

  if (tmin < 0 || tmin > maxDist) return null;

  // Rotate local normal back to world space
  const wc = Math.cos(rot);
  const ws = Math.sin(rot);
  const wnx = hitNormalLocal[0] * wc + hitNormalLocal[2] * ws;
  const wny = hitNormalLocal[1];
  const wnz = -hitNormalLocal[0] * ws + hitNormalLocal[2] * wc;

  return { dist: tmin, normal: [wnx, wny, wnz] };
}

// Check if line of sight between two 3D points is clear of walls and closed doors
export function hasLineOfSight(
  x1: number,
  y1: number,
  z1: number,
  x2: number,
  y2: number,
  z2: number,
  boxes: WorldBox[],
  doors: InteractiveDoor[]
): boolean {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dz = z2 - z1;
  const dist = Math.hypot(dx, dy, dz);
  if (dist < 0.05) return true;
  const ndx = dx / dist;
  const ndy = dy / dist;
  const ndz = dz / dist;

  for (const b of boxes) {
    if (!b.collide || b.h < 0.5) continue;
    // Quick bounding sphere pre-reject
    const cx = b.x - x1;
    const cz = b.z - z1;
    const rad = Math.max(b.w, b.d) * 0.75 + dist;
    if (cx * cx + cz * cz > rad * rad) continue;

    const hit = rayIntersectBox(x1, y1, z1, ndx, ndy, ndz, b, dist - 0.1);
    if (hit) return false;
  }

  for (const d of doors) {
    if (d.isOpen) continue;
    const c = Math.cos(d.currentYaw);
    const s = Math.sin(d.currentYaw);
    const doorBox: WorldBox = {
      x: d.hingeX + c * (d.width * 0.5),
      y: d.hingeY,
      z: d.hingeZ - s * (d.width * 0.5),
      w: d.width,
      h: d.height,
      d: d.depth,
      rotY: d.currentYaw,
      mat: d.mat,
      surface: 'wood',
      collide: true,
    };
    if (rayIntersectBox(x1, y1, z1, ndx, ndy, ndz, doorBox, dist - 0.1)) {
      return false;
    }
  }

  return true;
}

// Perform full ballistic raycast against world geometry, doors, and living AI enemies
export function castBallisticRay(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  maxDist: number,
  boxes: WorldBox[],
  doors: InteractiveDoor[],
  enemies: AIEnemy[]
): RayHit {
  let closestDist = maxDist;
  let hitNormal: [number, number, number] = [0, 1, 0];
  let hitSurface: SurfaceMaterial = 'concrete';
  let hitSomething = false;
  let hitEnemy: AIEnemy | undefined;
  let isHeadshot = false;

  for (const b of boxes) {
    if (!b.collide) continue;
    const res = rayIntersectBox(ox, oy, oz, dx, dy, dz, b, closestDist);
    if (res && res.dist < closestDist) {
      closestDist = res.dist;
      hitNormal = res.normal;
      hitSurface = b.surface;
      hitSomething = true;
    }
  }

  for (const d of doors) {
    const c = Math.cos(d.currentYaw);
    const s = Math.sin(d.currentYaw);
    const doorBox: WorldBox = {
      x: d.hingeX + c * (d.width * 0.5),
      y: d.hingeY,
      z: d.hingeZ - s * (d.width * 0.5),
      w: d.width,
      h: d.height,
      d: d.depth,
      rotY: d.currentYaw,
      mat: d.mat,
      surface: 'wood',
      collide: true,
    };
    const res = rayIntersectBox(ox, oy, oz, dx, dy, dz, doorBox, closestDist);
    if (res && res.dist < closestDist) {
      closestDist = res.dist;
      hitNormal = res.normal;
      hitSurface = 'wood';
      hitSomething = true;
    }
  }

  // Test AI Enemy hitboxes (Body box + Head box + Fallen Ragdoll box)
  for (const ai of enemies) {
    if (ai.state === 'DEAD') {
      if (!ai.ragdoll) continue;
      const ragBox: WorldBox = {
        x: ai.x,
        y: ai.y + 0.02,
        z: ai.z,
        w: 1.15,
        h: 0.46,
        d: 1.15,
        rotY: ai.ragdoll.fallYaw,
        mat: 'olive_metal',
        surface: 'mud',
        collide: true,
      };
      const ragRes = rayIntersectBox(ox, oy, oz, dx, dy, dz, ragBox, closestDist);
      if (ragRes && ragRes.dist < closestDist) {
        closestDist = ragRes.dist;
        hitNormal = ragRes.normal;
        hitEnemy = ai;
        isHeadshot = false;
        hitSomething = true;
      }
      continue;
    }
    const crouchOffset = ai.crouching ? -0.38 : 0;

    // Head hitbox
    const headBox: WorldBox = {
      x: ai.x,
      y: ai.y + 1.44 + crouchOffset,
      z: ai.z,
      w: 0.36,
      h: 0.38,
      d: 0.36,
      rotY: ai.yaw,
      mat: 'olive_metal',
      surface: 'mud',
      collide: true,
    };
    const headRes = rayIntersectBox(ox, oy, oz, dx, dy, dz, headBox, closestDist);
    if (headRes && headRes.dist < closestDist) {
      closestDist = headRes.dist;
      hitNormal = headRes.normal;
      hitEnemy = ai;
      isHeadshot = true;
      hitSomething = true;
    }

    // Torso/Limbs hitbox
    const bodyBox: WorldBox = {
      x: ai.x,
      y: ai.y + crouchOffset * 0.2,
      z: ai.z,
      w: 0.58,
      h: 1.44 + crouchOffset * 0.8,
      d: 0.44,
      rotY: ai.yaw,
      mat: 'olive_metal',
      surface: 'mud',
      collide: true,
    };
    const bodyRes = rayIntersectBox(ox, oy, oz, dx, dy, dz, bodyBox, closestDist);
    if (bodyRes && bodyRes.dist < closestDist) {
      closestDist = bodyRes.dist;
      hitNormal = bodyRes.normal;
      hitEnemy = ai;
      isHeadshot = false;
      hitSomething = true;
    }
  }

  return {
    hit: hitSomething,
    dist: closestDist,
    point: [ox + dx * closestDist, oy + dy * closestDist, oz + dz * closestDist],
    normal: hitNormal,
    surface: hitSurface,
    enemy: hitEnemy,
    isHeadshot,
  };
}

export class PlayerController {
  public x = 0;
  public y = 0.1;
  public z = 56;
  public vx = 0;
  public vy = 0;
  public vz = 0;
  public yaw = 0;
  public pitch = 0;
  public lean = 0; // -1 left, +1 right
  public grounded = true;
  public crouching = false;
  public sprinting = false;
  public aiming = false;
  public flashlightOn = false;

  // Survival & Health state
  public hp = 100;
  public maxHp = 100;
  public stamina = 100;
  public maxStamina = 100;
  public energy = 100;
  public hydration = 100;
  public radiation = 0; // 0 to 100 mSv
  public bleeding = false;
  public fractured = false;
  public painkillerTimer = 0;

  // Movement & Viewmodel animation state
  public currentSurface: SurfaceMaterial = 'asphalt';
  public stepDistanceAccum = 0;
  public bobPhase = 0;
  public adsProgress = 0;
  public recoilPitch = 0;
  public recoilBack = 0;
  public holdingBreath = false;
  public useBackupSights = false;

  public resetForRaid(spawn: [number, number, number, number], maxHpBonus = 0): void {
    this.x = spawn[0];
    this.y = spawn[1];
    this.z = spawn[2];
    this.yaw = spawn[3];
    this.pitch = 0;
    this.vx = 0;
    this.vy = 0;
    this.vz = 0;
    this.lean = 0;
    this.maxHp = 100 + maxHpBonus;
    this.hp = this.maxHp;
    this.stamina = 100;
    this.energy = 100;
    this.hydration = 100;
    this.radiation = 0;
    this.bleeding = false;
    this.fractured = false;
    this.painkillerTimer = 0;
    this.crouching = false;
    this.sprinting = false;
    this.aiming = false;
    this.flashlightOn = false;
    this.adsProgress = 0;
    this.recoilPitch = 0;
    this.recoilBack = 0;
  }

  public updatePhysics(
    dt: number,
    input: {
      forward: number;
      right: number;
      sprint: boolean;
      crouch: boolean;
      jump: boolean;
      leanDir: number;
    },
    weightKg: number,
    boxes: WorldBox[],
    doors: InteractiveDoor[],
    onFootstep: (surface: SurfaceMaterial, sprinting: boolean) => void
  ): void {
    this.crouching = input.crouch;
    const playerRadius = 0.38;
    const playerHeight = this.crouching ? 1.15 : 1.72;

    // Weight encumbrance factor (normal <= 22kg, heavy > 28kg)
    const encumbrance = Math.max(0.52, Math.min(1.0, 1.0 - Math.max(0, weightKg - 20) * 0.018));
    this.holdingBreath = Boolean(this.aiming && this.adsProgress > 0.55 && input.sprint && this.stamina > 6);
    const canSprint =
      input.sprint &&
      !this.crouching &&
      !this.aiming &&
      input.forward > 0.1 &&
      this.stamina > 8 &&
      (!this.fractured || this.painkillerTimer > 0);
    this.sprinting = canSprint;

    // Stamina drain / regen
    if (this.sprinting) {
      this.stamina = Math.max(0, this.stamina - dt * (11.5 / encumbrance));
    } else if (this.holdingBreath) {
      this.stamina = Math.max(0, this.stamina - dt * 6.5);
    } else {
      const regenRate = this.crouching ? 16.0 : 11.5;
      this.stamina = Math.min(this.maxStamina, this.stamina + dt * regenRate * encumbrance);
    }

    // Target speed
    let baseSpeed = 4.15 * encumbrance;
    if (this.sprinting) baseSpeed = 6.55 * encumbrance;
    else if (this.crouching) baseSpeed = 2.25 * encumbrance;
    else if (this.aiming) baseSpeed = 2.6 * encumbrance;

    if (this.fractured && this.painkillerTimer <= 0) {
      baseSpeed *= 0.62;
    }

    // Forward & Right vectors on XZ plane
    const fwdX = -Math.sin(this.yaw);
    const fwdZ = -Math.cos(this.yaw);
    const rightX = Math.cos(this.yaw);
    const rightZ = -Math.sin(this.yaw);

    let wishX = fwdX * input.forward + rightX * input.right;
    let wishZ = fwdZ * input.forward + rightZ * input.right;
    const wishLen = Math.hypot(wishX, wishZ);
    if (wishLen > 1.0) {
      wishX /= wishLen;
      wishZ /= wishLen;
    }

    const targetVx = wishX * baseSpeed;
    const targetVz = wishZ * baseSpeed;

    // Deliberate acceleration & deceleration damping (weighty Slavapunk movement)
    const accel = this.grounded ? 11.5 : 3.2;
    const blend = Math.min(1.0, dt * accel);
    this.vx += (targetVx - this.vx) * blend;
    this.vz += (targetVz - this.vz) * blend;

    // Jump
    if (input.jump && this.grounded && this.stamina >= 14) {
      this.vy = 5.4 * encumbrance;
      this.grounded = false;
      this.stamina = Math.max(0, this.stamina - 14);
    }

    // Gravity
    this.vy -= 14.8 * dt;

    // Smooth lean Q/E
    this.lean += (input.leanDir - this.lean) * Math.min(1.0, dt * 10.0);

    // Smooth ADS interpolation
    const targetAds = this.aiming && !this.sprinting ? 1.0 : 0.0;
    this.adsProgress += (targetAds - this.adsProgress) * Math.min(1.0, dt * 12.0);

    // Recoil spring recovery
    this.recoilPitch *= Math.max(0, 1.0 - dt * 10.5);
    this.recoilBack *= Math.max(0, 1.0 - dt * 14.0);

    // Resolve X, Z, and Y movement against world boxes & closed doors
    this.moveAndCollide(dt, playerRadius, playerHeight, boxes, doors);

    // Keep within exclusion zone perimeter
    this.x = Math.max(-74.5, Math.min(74.5, this.x));
    this.z = Math.max(-74.5, Math.min(74.5, this.z));

    // Footstep cadence & head-bob
    const horizSpeed = Math.hypot(this.vx, this.vz);
    if (this.grounded && horizSpeed > 0.4) {
      this.stepDistanceAccum += horizSpeed * dt;
      this.bobPhase += horizSpeed * dt * 3.1;
      const stepStride = this.sprinting ? 2.15 : this.crouching ? 1.35 : 1.75;
      if (this.stepDistanceAccum >= stepStride) {
        this.stepDistanceAccum = 0;
        onFootstep(this.currentSurface, this.sprinting);
      }
    } else {
      this.bobPhase += dt * 1.2;
    }
  }

  private moveAndCollide(
    dt: number,
    radius: number,
    height: number,
    boxes: WorldBox[],
    doors: InteractiveDoor[]
  ): void {
    // Try X movement, then Z movement, with automatic stair/ramp step-up
    const stepHeight = 0.42;

    const checkHorizontalCollision = (nx: number, ny: number, nz: number): boolean => {
      for (const b of boxes) {
        if (!b.collide || b.isRamp || b.h < 0.15) continue;
        // Vertical overlap check (ignore floors below stepHeight or ceilings above head)
        if (ny + height <= b.y + 0.05 || ny + stepHeight >= b.y + b.h) continue;

        const [lx, , lz] = worldToBoxLocal(nx, ny, nz, b);
        const hw = b.w * 0.5 + radius;
        const hd = b.d * 0.5 + radius;
        if (lx > -hw && lx < hw && lz > -hd && lz < hd) {
          return true;
        }
      }

      for (const d of doors) {
        if (d.isOpen) continue;
        const c = Math.cos(d.currentYaw);
        const s = Math.sin(d.currentYaw);
        const doorBox: WorldBox = {
          x: d.hingeX + c * (d.width * 0.5),
          y: d.hingeY,
          z: d.hingeZ - s * (d.width * 0.5),
          w: d.width,
          h: d.height,
          d: d.depth,
          rotY: d.currentYaw,
          mat: d.mat,
          surface: 'wood',
          collide: true,
        };
        if (ny + height <= doorBox.y + 0.05 || ny + stepHeight >= doorBox.y + doorBox.h) continue;
        const [lx, , lz] = worldToBoxLocal(nx, ny, nz, doorBox);
        if (
          lx > -(doorBox.w * 0.5 + radius) &&
          lx < doorBox.w * 0.5 + radius &&
          lz > -(doorBox.d * 0.5 + radius) &&
          lz < doorBox.d * 0.5 + radius
        ) {
          return true;
        }
      }
      return false;
    };

    const nextX = this.x + this.vx * dt;
    if (!checkHorizontalCollision(nextX, this.y, this.z)) {
      this.x = nextX;
    } else {
      this.vx = 0;
    }

    const nextZ = this.z + this.vz * dt;
    if (!checkHorizontalCollision(this.x, this.y, nextZ)) {
      this.z = nextZ;
    } else {
      this.vz = 0;
    }

    // Determine highest supporting floor or ramp under (this.x, this.z)
    let floorY = 0.0;
    let floorSurface: SurfaceMaterial = 'mud';

    for (const b of boxes) {
      if (!b.collide) continue;
      const [lx, , lz] = worldToBoxLocal(this.x, this.y, this.z, b);
      const hw = b.w * 0.5 + radius * 0.6;
      const hd = b.d * 0.5 + radius * 0.6;
      if (lx >= -hw && lx <= hw && lz >= -hd && lz <= hd) {
        let topY = b.y + b.h;
        if (b.isRamp) {
          // Calculate ramp height at local coordinate
          if (b.rampDir === 'north') {
            // climbs from +d/2 (y=0) to -d/2 (y=h)
            const t = Math.max(0, Math.min(1, (b.d * 0.5 - lz) / b.d));
            topY = b.y + t * b.h;
          } else if (b.rampDir === 'south') {
            const t = Math.max(0, Math.min(1, (lz + b.d * 0.5) / b.d));
            topY = b.y + t * b.h;
          }
        }
        // Only snap/support if topY is at or below player's feet + stepHeight
        if (topY <= this.y + stepHeight + 0.15 && topY >= floorY) {
          floorY = topY;
          floorSurface = b.surface;
        }
      }
    }

    this.y += this.vy * dt;
    if (this.y <= floorY) {
      this.y = floorY;
      this.vy = 0;
      this.grounded = true;
      this.currentSurface = floorSurface;
    } else if (this.grounded && this.vy <= 0 && this.y - floorY <= stepHeight) {
      // Stick to stairs/ramps smoothly when walking down
      this.y = floorY;
      this.vy = 0;
      this.currentSurface = floorSurface;
    } else {
      this.grounded = false;
    }
  }

  public getEyePosition(headBobEnabled: boolean): {
    eyeX: number;
    eyeY: number;
    eyeZ: number;
    roll: number;
    bobX: number;
    bobY: number;
  } {
    const baseHeight = this.crouching ? 1.02 : 1.62;
    const speed = Math.hypot(this.vx, this.vz);
    const adsSteady = this.holdingBreath ? 0.08 : 1.0 - this.adsProgress * 0.82;
    const bobScale = headBobEnabled && this.grounded ? Math.min(1.0, speed / 5.0) * adsSteady : 0;
    const breathSway = this.adsProgress > 0.2 && speed < 0.4 ? (this.holdingBreath ? 0.00025 : 0.0022) * this.adsProgress : 0;

    const bobX = Math.cos(this.bobPhase * 0.5) * 0.012 * bobScale + Math.cos(this.bobPhase * 1.1) * breathSway;
    const bobY = Math.sin(this.bobPhase) * 0.022 * bobScale + Math.sin(this.bobPhase * 1.6) * breathSway;

    // Lean offset along camera right vector
    const rightX = Math.cos(this.yaw);
    const rightZ = -Math.sin(this.yaw);
    const leanDist = this.lean * 0.34;

    return {
      eyeX: this.x + rightX * leanDist,
      eyeY: this.y + baseHeight + bobY,
      eyeZ: this.z + rightZ * leanDist,
      roll: -this.lean * 0.11,
      bobX,
      bobY,
    };
  }
}
