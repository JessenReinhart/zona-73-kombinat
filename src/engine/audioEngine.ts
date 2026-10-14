// src/engine/audioEngine.ts
// Web Audio API Procedural & Positional Sound Engine for ZONA-73: KOMBINAT
// Synthesizes footsteps by surface, distance-filtered 3D gunshots, mechanical weapon reloads,
// Geiger counter clicks, door creaks, loot sounds, AI Slavic radio barks, and cold wind ambience.

import { SurfaceMaterial } from '../types/game';

export class SpatialAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private ambientStarted = false;
  public masterVolume = 0.8;
  public ambientVolume = 0.65;

  public init(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return;
    }
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    this.ctx = new AudioCtx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.masterVolume;
    this.masterGain.connect(this.ctx.destination);

    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.value = this.ambientVolume;
    this.ambientGain.connect(this.masterGain);

    // Pre-generate 2 seconds of white/pink noise for gunshots, wind, footsteps & clicks
    const sr = this.ctx.sampleRate;
    this.noiseBuffer = this.ctx.createBuffer(1, sr * 2, sr);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  }

  public setVolumes(master: number, ambient: number): void {
    this.masterVolume = master;
    this.ambientVolume = ambient;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(master, this.ctx.currentTime, 0.05);
    }
    if (this.ambientGain && this.ctx) {
      this.ambientGain.gain.setTargetAtTime(ambient, this.ctx.currentTime, 0.05);
    }
  }

  public updateListener(x: number, y: number, z: number, yaw: number, pitch: number): void {
    if (!this.ctx) return;
    const l = this.ctx.listener;
    const fx = -Math.sin(yaw) * Math.cos(pitch);
    const fy = Math.sin(pitch);
    const fz = -Math.cos(yaw) * Math.cos(pitch);
    try {
      if (l.positionX) {
        l.positionX.value = x;
        l.positionY.value = y;
        l.positionZ.value = z;
        l.forwardX.value = fx;
        l.forwardY.value = fy;
        l.forwardZ.value = fz;
        l.upX.value = 0;
        l.upY.value = 1;
        l.upZ.value = 0;
      } else if (l.setPosition) {
        l.setPosition(x, y, z);
        l.setOrientation(fx, fy, fz, 0, 1, 0);
      }
    } catch {
      // Ignore listener update issues on headless audio contexts
    }
  }

  public startZoneAmbience(): void {
    this.init();
    if (!this.ctx || !this.noiseBuffer || !this.ambientGain || this.ambientStarted) return;
    this.ambientStarted = true;

    // 1. Cold Desolate Wind Loop (bandpass-filtered noise modulated by slow LFO)
    const windSrc = this.ctx.createBufferSource();
    windSrc.buffer = this.noiseBuffer;
    windSrc.loop = true;

    const windFilter = this.ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 280;
    windFilter.Q.value = 3.2;

    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.14;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 140;
    lfo.connect(windFilter.frequency);
    lfo.start();

    const windGain = this.ctx.createGain();
    windGain.gain.value = 0.12;
    windSrc.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(this.ambientGain);
    windSrc.start();

    // 2. Distant Industrial Substation Hum (low 55Hz sub-drone)
    const hum = this.ctx.createOscillator();
    hum.type = 'sawtooth';
    hum.frequency.value = 54;
    const humFilter = this.ctx.createBiquadFilter();
    humFilter.type = 'lowpass';
    humFilter.frequency.value = 110;
    const humGain = this.ctx.createGain();
    humGain.gain.value = 0.035;
    hum.connect(humFilter);
    humFilter.connect(humGain);
    humGain.connect(this.ambientGain);
    hum.start();
  }

  public playFootstep(surface: SurfaceMaterial, sprinting: boolean, weightKg: number): void {
    this.init();
    if (!this.ctx || !this.noiseBuffer || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    let freq = 600;
    let q = 1.5;
    let dur = 0.085;
    if (surface === 'metal') {
      freq = 1350;
      q = 4.0;
      dur = 0.11;
    } else if (surface === 'mud') {
      freq = 340;
      q = 1.1;
      dur = 0.12;
    } else if (surface === 'water') {
      freq = 1600;
      q = 1.0;
      dur = 0.14;
    } else if (surface === 'wood') {
      freq = 480;
      q = 2.6;
      dur = 0.09;
    } else if (surface === 'tile' || surface === 'concrete') {
      freq = 880;
      q = 1.8;
      dur = 0.075;
    }

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(freq * (0.92 + Math.random() * 0.16), now);
    filter.Q.value = q;

    const vol = (sprinting ? 0.24 : 0.13) * Math.min(1.5, 0.85 + weightKg * 0.018);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    src.start(now);
    src.stop(now + dur + 0.02);

    // Metallic clank for metal catwalks
    if (surface === 'metal') {
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320 + Math.random() * 60, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.08);
      const og = this.ctx.createGain();
      og.gain.setValueAtTime(vol * 0.5, now);
      og.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      osc.connect(og);
      og.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.09);
    }
  }

  public playGunshot(
    profile: 'pistol' | 'rifle' | 'shotgun' | 'sniper',
    pos3D?: [number, number, number],
    listenerPos?: [number, number, number]
  ): void {
    this.init();
    if (!this.ctx || !this.noiseBuffer || !this.masterGain) return;
    const now = this.ctx.currentTime;

    let dist = 0;
    if (pos3D && listenerPos) {
      dist = Math.hypot(pos3D[0] - listenerPos[0], pos3D[1] - listenerPos[1], pos3D[2] - listenerPos[2]);
    }

    // Distance low-pass muffling
    const cutoff = Math.max(380, 4800 - dist * 48);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(cutoff, now);

    let destNode: AudioNode = this.masterGain;
    if (pos3D && this.ctx.createPanner) {
      const panner = this.ctx.createPanner();
      panner.panningModel = 'equalpower';
      panner.distanceModel = 'inverse';
      panner.refDistance = 4.0;
      panner.maxDistance = 140.0;
      panner.rolloffFactor = 1.1;
      panner.setPosition(pos3D[0], pos3D[1], pos3D[2]);
      lp.connect(panner);
      panner.connect(this.masterGain);
      destNode = lp;
    } else {
      lp.connect(this.masterGain);
      destNode = lp;
    }

    // Blast noise burst + tail echo
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const gain = this.ctx.createGain();
    const dur = profile === 'sniper' ? 0.58 : profile === 'shotgun' ? 0.48 : profile === 'rifle' ? 0.36 : 0.25;
    const peak = profile === 'sniper' ? 0.72 : profile === 'shotgun' ? 0.65 : profile === 'rifle' ? 0.52 : 0.42;

    gain.gain.setValueAtTime(peak, now);
    gain.gain.exponentialRampToValueAtTime(0.002, now + dur);

    src.connect(gain);
    gain.connect(destNode);
    src.start(now);
    src.stop(now + dur + 0.02);

    // Sub-bass punch
    const punch = this.ctx.createOscillator();
    punch.type = 'sawtooth';
    const startFreq = profile === 'pistol' ? 220 : profile === 'rifle' ? 175 : 135;
    punch.frequency.setValueAtTime(startFreq, now);
    punch.frequency.exponentialRampToValueAtTime(36, now + 0.14);

    const pGain = this.ctx.createGain();
    pGain.gain.setValueAtTime(peak * 0.7, now);
    pGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    punch.connect(pGain);
    pGain.connect(destNode);
    punch.start(now);
    punch.stop(now + 0.16);
  }

  public playReloadSound(stage: 'mag_out' | 'mag_in' | 'bolt_rack' | 'dry_fire'): void {
    this.init();
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    if (stage === 'dry_fire') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(1100, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.03);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.04);
    } else if (stage === 'mag_out') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(210, now + 0.09);
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.11);
    } else if (stage === 'mag_in') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(240, now);
      osc.frequency.exponentialRampToValueAtTime(680, now + 0.08);
      gain.gain.setValueAtTime(0.26, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.1);
    } else if (stage === 'bolt_rack') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(740, now);
      osc.frequency.setValueAtTime(920, now + 0.06);
      gain.gain.setValueAtTime(0.24, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.15);
    }
  }

  public playInteractionSound(type: 'door' | 'loot' | 'heal' | 'switch' | 'geiger' | 'ui_click'): void {
    this.init();
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    if (type === 'geiger') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(2400 + Math.random() * 800, now);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.012);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.015);
    } else if (type === 'door') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.linearRampToValueAtTime(230, now + 0.25);
      gain.gain.setValueAtTime(0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.3);
    } else if (type === 'switch') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.setValueAtTime(420, now + 0.08);
      gain.gain.setValueAtTime(0.32, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.26);
    } else if (type === 'heal') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(660, now + 0.18);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.22);
    } else {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(type === 'ui_click' ? 780 : 380, now);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.05);
    }
  }

  public playHitImpactSound(isHeadshot: boolean, isKill: boolean): void {
    this.init();
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;

    // 1. Visceral wet flesh thud (low-passed noise + sub-thump)
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(isHeadshot ? 950 : 480, now);
    filter.Q.value = 1.6;
    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(isHeadshot ? 0.36 : 0.25, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    src.connect(filter);
    filter.connect(nGain);
    nGain.connect(this.masterGain);
    src.start(now);
    src.stop(now + 0.1);

    const thump = this.ctx.createOscillator();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(160, now);
    thump.frequency.exponentialRampToValueAtTime(48, now + 0.085);
    const tGain = this.ctx.createGain();
    tGain.gain.setValueAtTime(0.32, now);
    tGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    thump.connect(tGain);
    tGain.connect(this.masterGain);
    thump.start(now);
    thump.stop(now + 0.095);

    // 2. Crisp metallic helmet-ping / bone-crack on Headshot or Kill
    if (isHeadshot || isKill) {
      const ping = this.ctx.createOscillator();
      ping.type = isHeadshot ? 'triangle' : 'sine';
      ping.frequency.setValueAtTime(isHeadshot ? 1920 : 880, now);
      ping.frequency.exponentialRampToValueAtTime(isHeadshot ? 1180 : 420, now + 0.14);
      const pGain = this.ctx.createGain();
      pGain.gain.setValueAtTime(isHeadshot ? 0.28 : 0.18, now);
      pGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      ping.connect(pGain);
      pGain.connect(this.masterGain);
      ping.start(now);
      ping.stop(now + 0.16);
    }
  }
}
