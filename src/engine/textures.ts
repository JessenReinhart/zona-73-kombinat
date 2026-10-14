// src/engine/textures.ts
// High-detail procedural PBR & Alpha-Cutout Texture Generator:
// Includes alpha-tested Wild Grass Cards (grass_alpha), Leafy Tree Branch Canopies (branch_alpha),
// Weathered Precast Concrete, Khrushchyovka Facades, Brick, Rusted Steel, Wet Asphalt, Ambulance, and Debris.

function seededHash(x: number, y: number, seed: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453123;
  return n - Math.floor(n);
}

function valueNoise(x: number, y: number, scale: number, seed: number): number {
  const sx = x / scale;
  const sy = y / scale;
  const ix = Math.floor(sx);
  const iy = Math.floor(sy);
  const fx = sx - ix;
  const fy = sy - iy;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = seededHash(ix, iy, seed);
  const b = seededHash(ix + 1, iy, seed);
  const c = seededHash(ix, iy + 1, seed);
  const d = seededHash(ix + 1, iy + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbm(x: number, y: number, scale: number, seed: number): number {
  return (
    0.55 * valueNoise(x, y, scale, seed) +
    0.3 * valueNoise(x, y, scale * 0.5, seed + 13) +
    0.15 * valueNoise(x, y, scale * 0.25, seed + 29)
  );
}

export function generateProceduralTextures(): Record<string, HTMLCanvasElement> {
  const textures: Record<string, HTMLCanvasElement> = {};

  const makeCanvas = (size = 256): [HTMLCanvasElement, CanvasRenderingContext2D] => {
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d')!;
    return [c, ctx];
  };

  // 1. Weathered Precast Concrete Panel (High-contrast brutalist concrete with form-tie holes, cracks & moss)
  {
    const [c, ctx] = makeCanvas(256);
    const img = ctx.createImageData(256, 256);
    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) {
        const n = fbm(x, y, 26, 1);
        const micro = (seededHash(x, y, 2) - 0.5) * 24;
        const drip = valueNoise(x, 0, 10, 9) * Math.max(0, 1 - (y % 128) / 90) * 38;
        const moss = y % 128 > 92 ? valueNoise(x, y, 9, 5) * 34 : 0;
        const base = 98 + n * 38 + micro - drip;
        let r = base - moss * 0.35;
        let g = base + moss * 0.45;
        let b = base - 5 - moss * 0.45;
        // Recessed panel bevel seams
        if (x < 3 || x > 253 || y % 128 < 3) {
          r *= 0.38;
          g *= 0.38;
          b *= 0.38;
        } else if (x === 4 || y % 128 === 4) {
          r *= 1.18;
          g *= 1.18;
          b *= 1.18;
        }
        const idx = (y * 256 + x) * 4;
        img.data[idx] = Math.max(16, Math.min(245, r));
        img.data[idx + 1] = Math.max(16, Math.min(245, g));
        img.data[idx + 2] = Math.max(16, Math.min(245, b));
        img.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    textures['concrete'] = c;
  }

  // 2. Khrushchyovka Apartment Facade (Detailed Recessed Casements, Sills, Cracked Glass & Weathering)
  {
    const [c, ctx] = makeCanvas(256);
    ctx.drawImage(textures['concrete'], 0, 0);
    for (let wy = 0; wy < 2; wy++) {
      for (let wx = 0; wx < 2; wx++) {
        const px = wx * 128 + 22;
        const py = wy * 128 + 18;
        const w = 84;
        const h = 88;
        // Deep concrete recess shadow
        ctx.fillStyle = '#242724';
        ctx.fillRect(px - 4, py - 4, w + 8, h + 8);
        // Concrete lintel & projecting sill with drip stains
        ctx.fillStyle = '#525650';
        ctx.fillRect(px - 8, py - 8, w + 16, 7);
        ctx.fillRect(px - 10, py + h + 2, w + 20, 9);
        // Dark interior room depth
        ctx.fillStyle = wy === 0 && wx === 1 ? '#261f14' : '#0b0f11';
        ctx.fillRect(px, py, w, h);
        // Curtains / interior blind remnants & broken glass shards
        ctx.fillStyle = 'rgba(150, 168, 175, 0.24)';
        ctx.beginPath();
        ctx.moveTo(px + 4, py + 4);
        ctx.lineTo(px + 34, py + 4);
        ctx.lineTo(px + 10, py + 42);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(px + w - 4, py + h - 4);
        ctx.lineTo(px + w - 28, py + h - 4);
        ctx.lineTo(px + w - 6, py + h - 36);
        ctx.fill();
        // Weathered double-casement wooden frame
        ctx.strokeStyle = '#6d5e4b';
        ctx.lineWidth = 4;
        ctx.strokeRect(px + 2, py + 2, w - 4, h - 4);
        ctx.beginPath();
        ctx.moveTo(px + w * 0.5, py + 2);
        ctx.lineTo(px + w * 0.5, py + h - 2);
        ctx.moveTo(px + 2, py + h * 0.34);
        ctx.lineTo(px + w - 2, py + h * 0.34);
        ctx.stroke();
      }
    }
    textures['facade'] = c;
  }

  // 3. Industrial Weathered Red/Brown Brick with Mortar Relief
  {
    const [c, ctx] = makeCanvas(256);
    ctx.fillStyle = '#4a4740';
    ctx.fillRect(0, 0, 256, 256);
    const rows = 16;
    const cols = 8;
    const bh = 256 / rows;
    const bw = 256 / cols;
    for (let r = 0; r < rows; r++) {
      const offset = (r % 2) * (bw * 0.5);
      for (let col = -1; col <= cols; col++) {
        const bx = col * bw + offset;
        const by = r * bh;
        const h = seededHash(col + 10, r, 33);
        const cr = Math.floor(108 + h * 46);
        const cg = Math.floor(50 + h * 26);
        const cb = Math.floor(40 + h * 18);
        ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
        ctx.fillRect(bx + 2, by + 2, bw - 3, bh - 3);
      }
    }
    const img = ctx.getImageData(0, 0, 256, 256);
    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) {
        const grime = fbm(x, y, 32, 77) * 0.5 + 0.58;
        const micro = (seededHash(x, y, 78) - 0.5) * 18;
        const idx = (y * 256 + x) * 4;
        img.data[idx] = Math.max(15, Math.min(255, img.data[idx] * grime + micro));
        img.data[idx + 1] = Math.max(15, Math.min(255, img.data[idx + 1] * grime + micro));
        img.data[idx + 2] = Math.max(15, Math.min(255, img.data[idx + 2] * grime + micro));
      }
    }
    ctx.putImageData(img, 0, 0);
    textures['brick'] = c;
  }

  // 4. Rusted Corrugated Steel
  {
    const [c, ctx] = makeCanvas(256);
    const img = ctx.createImageData(256, 256);
    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) {
        const wave = Math.sin((x / 256) * Math.PI * 16) * 0.5 + 0.5;
        const rustNoise = fbm(x, y, 20, 41);
        const fine = (seededHash(x, y, 42) - 0.5) * 16;
        const isRust = rustNoise > 0.45;
        const shade = 0.5 + wave * 0.5;
        const r = (isRust ? 128 + rustNoise * 48 : 72 + rustNoise * 26) + fine;
        const g = (isRust ? 58 + rustNoise * 22 : 78 + rustNoise * 26) + fine;
        const b = (isRust ? 35 + rustNoise * 14 : 82 + rustNoise * 26) + fine;
        const idx = (y * 256 + x) * 4;
        img.data[idx] = Math.max(15, Math.min(245, r * shade));
        img.data[idx + 1] = Math.max(15, Math.min(245, g * shade));
        img.data[idx + 2] = Math.max(15, Math.min(245, b * shade));
        img.data[idx + 3] = isRust ? 255 : 195;
      }
    }
    ctx.putImageData(img, 0, 0);
    textures['rust_metal'] = c;
  }

  // 5. Wet Cracked Asphalt with Reflective Puddles & Aggregate Grain
  {
    const [c, ctx] = makeCanvas(256);
    const img = ctx.createImageData(256, 256);
    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) {
        const puddle = fbm(x, y, 40, 108);
        const grain = (seededHash(x, y, 109) - 0.5) * 22;
        const isWet = puddle > 0.56;
        const base = isWet ? 28 + grain * 0.25 : 48 + puddle * 24 + grain;
        const idx = (y * 256 + x) * 4;
        img.data[idx] = Math.max(14, Math.min(180, base));
        img.data[idx + 1] = Math.max(14, Math.min(185, base + 2));
        img.data[idx + 2] = Math.max(16, Math.min(190, base + (isWet ? 10 : 3)));
        img.data[idx + 3] = isWet ? 120 : 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    textures['asphalt'] = c;
  }

  // 6. Rich Dark Forest Earth, Moss & Fallen Leaves Ground
  {
    const [c, ctx] = makeCanvas(256);
    const img = ctx.createImageData(256, 256);
    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) {
        const n = fbm(x, y, 24, 61);
        const mossPatch = fbm(x, y, 12, 62);
        const fine = (seededHash(x, y, 63) - 0.5) * 22;
        const isMoss = mossPatch > 0.42;
        const r = (isMoss ? 48 + mossPatch * 34 : 54 + n * 32) + fine;
        const g = (isMoss ? 66 + mossPatch * 44 : 48 + n * 26) + fine;
        const b = (isMoss ? 30 + mossPatch * 16 : 32 + n * 16) + fine;
        const idx = (y * 256 + x) * 4;
        img.data[idx] = Math.max(14, Math.min(200, r));
        img.data[idx + 1] = Math.max(18, Math.min(210, g));
        img.data[idx + 2] = Math.max(12, Math.min(170, b));
        img.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    textures['mud_grass'] = c;
  }

  // 7. Chipped Soviet Olive-Drab Metal & Gunmetal
  {
    const [c, ctx] = makeCanvas(256);
    const img = ctx.createImageData(256, 256);
    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) {
        const wear = fbm(x, y, 22, 88);
        const scratch = (seededHash(x, y, 89) - 0.5) * 14;
        const chipped = wear > 0.65;
        let r = (chipped ? 82 : 52 + wear * 24) + scratch;
        let g = (chipped ? 78 : 64 + wear * 28) + scratch;
        let b = (chipped ? 72 : 44 + wear * 18) + scratch;
        if (x < 5 || x > 251 || y < 5 || y > 251) {
          r *= 0.62;
          g *= 0.62;
          b *= 0.62;
        }
        const idx = (y * 256 + x) * 4;
        img.data[idx] = Math.max(12, Math.min(240, r));
        img.data[idx + 1] = Math.max(12, Math.min(240, g));
        img.data[idx + 2] = Math.max(12, Math.min(240, b));
        img.data[idx + 3] = chipped ? 175 : 220;
      }
    }
    ctx.putImageData(img, 0, 0);
    textures['olive_metal'] = c;
  }

  // 8. Weathered Wood Planks & Rough Bark
  {
    const [c, ctx] = makeCanvas(256);
    const img = ctx.createImageData(256, 256);
    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) {
        const grain = Math.sin(x * 0.28 + valueNoise(x, y, 16, 91) * 5.5) * 0.5 + 0.5;
        const fine = (seededHash(x, y, 92) - 0.5) * 14;
        const plankSeam = y % 64 < 3 ? 0.45 : 1.0;
        const r = (78 + grain * 36 + fine) * plankSeam;
        const g = (58 + grain * 28 + fine) * plankSeam;
        const b = (40 + grain * 18 + fine) * plankSeam;
        const idx = (y * 256 + x) * 4;
        img.data[idx] = Math.max(12, Math.min(230, r));
        img.data[idx + 1] = Math.max(12, Math.min(230, g));
        img.data[idx + 2] = Math.max(12, Math.min(230, b));
        img.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    textures['wood'] = c;
  }

  // 9. Dirty Interior Floor Tiles & Debris Grime
  {
    const [c, ctx] = makeCanvas(256);
    const img = ctx.createImageData(256, 256);
    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) {
        const grime = fbm(x, y, 26, 120);
        const tileCheck = ((Math.floor(x / 32) + Math.floor(y / 32)) % 2) === 0;
        const grout = x % 32 < 2 || y % 32 < 2 ? 0.48 : 1.0;
        const base = (tileCheck ? 104 : 68) * (0.6 + grime * 0.5) * grout;
        const idx = (y * 256 + x) * 4;
        img.data[idx] = base * 0.96;
        img.data[idx + 1] = base * 1.0;
        img.data[idx + 2] = base * 0.9;
        img.data[idx + 3] = 225;
      }
    }
    ctx.putImageData(img, 0, 0);
    textures['tile'] = c;
  }

  // 10. Propaganda Banner ("GLORY TO LABOR / SECTOR 73")
  {
    const [c, ctx] = makeCanvas(256);
    ctx.fillStyle = '#7a261e';
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = '#d4a853';
    ctx.lineWidth = 8;
    ctx.strokeRect(10, 10, 236, 236);
    ctx.fillStyle = '#d4a853';
    ctx.font = 'bold 26px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('KOMBINAT-73', 128, 74);
    ctx.font = 'bold 20px monospace';
    ctx.fillText('GLORY TO LABOR!', 128, 122);
    ctx.font = 'bold 15px monospace';
    ctx.fillStyle = '#e0cbb0';
    ctx.fillText('EXCLUSION SECTOR B-4', 128, 170);
    ctx.fillText('RESTRICTED PERIMETER', 128, 205);
    const img = ctx.getImageData(0, 0, 256, 256);
    for (let i = 0; i < img.data.length; i += 4) {
      const p = i / 4;
      const x = p % 256;
      const y = Math.floor(p / 256);
      const w = 0.55 + fbm(x, y, 25, 144) * 0.5;
      img.data[i] *= w;
      img.data[i + 1] *= w;
      img.data[i + 2] *= w;
    }
    ctx.putImageData(img, 0, 0);
    textures['poster_propaganda'] = c;
  }

  // 11. Caution / Hazard Signage ("DANGER! EXCLUSION ZONE")
  {
    const [c, ctx] = makeCanvas(256);
    ctx.fillStyle = '#b88f28';
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#1f1e1b';
    for (let i = -256; i < 512; i += 32) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 16, 0);
      ctx.lineTo(i - 16, 36);
      ctx.lineTo(i - 32, 36);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(i, 220);
      ctx.lineTo(i + 16, 220);
      ctx.lineTo(i - 16, 256);
      ctx.lineTo(i - 32, 256);
      ctx.fill();
    }
    ctx.fillStyle = '#781812';
    ctx.font = 'bold 26px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('DANGER! HALT!', 128, 86);
    ctx.fillStyle = '#1a1917';
    ctx.font = 'bold 20px monospace';
    ctx.fillText('EXCLUSION ZONE', 128, 128);
    ctx.font = 'bold 16px monospace';
    ctx.fillText('RADIATION / BIOHAZARD', 128, 168);
    ctx.fillText('AUTHORIZED ENTRY ONLY', 128, 200);
    textures['sign_hazard'] = c;
  }

  // 12. Rusted Ambulance Van Bodywork
  {
    const [c, ctx] = makeCanvas(256);
    ctx.fillStyle = '#c4bfb0';
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#9e2a22';
    ctx.fillRect(0, 108, 256, 42);
    ctx.fillStyle = '#dcd8cc';
    ctx.beginPath();
    ctx.arc(64, 70, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#a8241c';
    ctx.fillRect(58, 52, 12, 36);
    ctx.fillRect(46, 64, 36, 12);
    ctx.fillStyle = '#1b2224';
    ctx.fillRect(118, 34, 110, 58);
    const img = ctx.getImageData(0, 0, 256, 256);
    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) {
        const rust = fbm(x, y, 20, 201);
        const idx = (y * 256 + x) * 4;
        if (rust > 0.62 || y > 210) {
          img.data[idx] = 95 + rust * 30;
          img.data[idx + 1] = 52 + rust * 18;
          img.data[idx + 2] = 34 + rust * 10;
        } else {
          const g = 0.72 + rust * 0.35;
          img.data[idx] *= g;
          img.data[idx + 1] *= g;
          img.data[idx + 2] *= g;
        }
      }
    }
    ctx.putImageData(img, 0, 0);
    textures['ambulance'] = c;
  }

  // 13. Trash, Rubble & Scattered Debris Texture
  {
    const [c, ctx] = makeCanvas(256);
    const img = ctx.createImageData(256, 256);
    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) {
        const n = fbm(x, y, 10, 303);
        const fine = seededHash(x, y, 304);
        let r = 68 + n * 50;
        let g = 60 + n * 42;
        let b = 52 + n * 35;
        if (fine > 0.92) {
          r = 148;
          g = 54;
          b = 42;
        } else if (fine < 0.06) {
          r = 165;
          g = 158;
          b = 142;
        }
        const idx = (y * 256 + x) * 4;
        img.data[idx] = r;
        img.data[idx + 1] = g;
        img.data[idx + 2] = b;
        img.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    textures['trash_debris'] = c;
  }

  // 14. ALPHA-CUTOUT WILD GRASS & SEED-HEAD CARD (256x256 with 45 delicate curved grass stalks + wheat/seed plumes!)
  {
    const [c, ctx] = makeCanvas(256);
    ctx.clearRect(0, 0, 256, 256);
    for (let i = 0; i < 48; i++) {
      const r1 = seededHash(i, 1, 501);
      const r2 = seededHash(i, 2, 502);
      const r3 = seededHash(i, 3, 503);
      const startX = 14 + r1 * 228;
      const startY = 256;
      const tipX = startX + (r2 - 0.5) * 68;
      const tipY = 18 + r3 * 125;
      const ctrlX = (startX + tipX) * 0.5 + (r3 - 0.5) * 28;
      const ctrlY = (startY + tipY) * 0.5;

      const grad = ctx.createLinearGradient(startX, startY, tipX, tipY);
      if (i % 3 === 0) {
        // Golden dry autumn stalk
        grad.addColorStop(0, 'rgb(42, 46, 26)');
        grad.addColorStop(0.5, 'rgb(112, 118, 54)');
        grad.addColorStop(1, 'rgb(186, 172, 92)');
      } else {
        // Wild olive-green stalk
        grad.addColorStop(0, 'rgb(32, 44, 22)');
        grad.addColorStop(0.55, 'rgb(78, 108, 46)');
        grad.addColorStop(1, 'rgb(142, 164, 78)');
      }

      ctx.strokeStyle = grad;
      ctx.lineWidth = 2.6 + (1 - r3) * 2.4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.quadraticCurveTo(ctrlX, ctrlY, tipX, tipY);
      ctx.stroke();

      // Add seed-head plume at the tip of tall stalks (matching Ref Image 2!)
      if (i % 4 === 0 && tipY < 90) {
        ctx.fillStyle = 'rgb(194, 180, 106)';
        ctx.beginPath();
        ctx.ellipse(tipX, tipY, 3.2, 11.0, (tipX - startX) * 0.008, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    textures['grass_alpha'] = c;
  }

  // 15. ALPHA-CUTOUT TREE FOLIAGE & BRANCH CARD (256x256 with twigs and 140 organic serrated leaves!)
  {
    const [c, ctx] = makeCanvas(256);
    ctx.clearRect(0, 0, 256, 256);
    // Draw central wooden bough & radiating twigs
    ctx.strokeStyle = '#3d3328';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(128, 240);
    ctx.lineTo(128, 40);
    ctx.stroke();
    ctx.lineWidth = 3;
    for (let b = 0; b < 8; b++) {
      const by = 60 + b * 22;
      const dir = b % 2 === 0 ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(128, by);
      ctx.lineTo(128 + dir * (55 + (b % 3) * 20), by - 28);
      ctx.stroke();
    }
    // Draw 150 layered organic leaves
    for (let i = 0; i < 150; i++) {
      const rx = seededHash(i, 1, 601);
      const ry = seededHash(i, 2, 602);
      const rc = seededHash(i, 3, 603);
      // Keep leaves clustered inside an organic oval crown
      const angle = rx * Math.PI * 2;
      const rad = Math.sqrt(ry) * 108;
      const lx = 128 + Math.cos(angle) * rad;
      const ly = 124 + Math.sin(angle) * rad * 0.92;

      const r = Math.floor(62 + rc * 68);
      const g = Math.floor(84 + rc * 58);
      const b = Math.floor(34 + rc * 24);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.beginPath();
      ctx.ellipse(lx, ly, 11 + (i % 5) * 2, 6 + (i % 3) * 2, angle + rc, 0, Math.PI * 2);
      ctx.fill();
    }
    textures['branch_alpha'] = c;
  }


  // 16. Brushed Parkerized / Blued Soviet Gunmetal Texture (Fine Machined Steel Grain & Oiled Edge Wear)
  {
    const [c, ctx] = makeCanvas(256);
    const img = ctx.createImageData(256, 256);
    for (let y = 0; y < 256; y++) {
      const brush = seededHash(0, y, 701) * 14;
      for (let x = 0; x < 256; x++) {
        const n = fbm(x, y, 18, 702);
        const scratch = seededHash(x >> 2, y, 703) > 0.92 ? 18 : 0;
        const base = 46 + n * 28 + brush + scratch;
        const idx = (y * 256 + x) * 4;
        img.data[idx] = Math.min(255, base * 0.94);
        img.data[idx + 1] = Math.min(255, base * 0.98);
        img.data[idx + 2] = Math.min(255, base * 1.06);
        img.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    // Subtle stamped rivet / receiver seam lines
    ctx.strokeStyle = "rgba(18, 20, 22, 0.55)";
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, 240, 240);
    textures["gunmetal"] = c;
  }

  return textures;

}
