/**
 * Argus Vault - Cinematic Procedural Web Audio Synthesizer
 * Uses Web Audio API without needing external sound files.
 */

class SoundFX {
  private ctx: AudioContext | null = null;
  public isMuted: boolean = false;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined' || this.isMuted) return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  // Dial mechanical ratchet tick with realistic random pitch variation
  tick() {
    if (this.isMuted) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(500 + Math.random() * 300, ctx.currentTime);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.035);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.035);
    } catch (e) {}
  }

  // Access Granted / Green Confirmation Chimes
  accessGranted() {
    if (this.isMuted) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const notes = [440, 554.37, 659.25, 880, 1108.73]; // A major arpeggio
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.07);
        gain.gain.setValueAtTime(0, ctx.currentTime + idx * 0.07);
        gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + idx * 0.07 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.07 + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.07);
        osc.stop(ctx.currentTime + idx * 0.07 + 0.4);
      });
    } catch (e) {}
  }

  // Access Denied / Warning buzzer
  accessDenied() {
    if (this.isMuted) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      [0, 0.12, 0.24].forEach((delay) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, ctx.currentTime + delay);
        gain.gain.setValueAtTime(0.2, ctx.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + delay + 0.09);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + 0.09);
      });
    } catch (e) {}
  }

  // Heavy mechanical bolt sliding / latch release
  mechanicalUnlock() {
    if (this.isMuted) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(70, ctx.currentTime + 0.5);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    } catch (e) {}
  }

  // CINEMATIC CATASTROPHIC VAULT BLAST:
  // Pre-detonation high-pitch charge whine, massive sub-bass 24Hz thump, explosive noise layers,
  // shearing metal shriek, secondary delayed explosions, and rising emergency air-raid siren klaxon.
  selfDestruct() {
    if (this.isMuted) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const now = ctx.currentTime;

      // 1. Pre-detonation pressure suck / reverse swell & high-pitch charging whine
      const preOsc = ctx.createOscillator();
      const preGain = ctx.createGain();
      preOsc.type = 'sawtooth';
      preOsc.frequency.setValueAtTime(150, now);
      preOsc.frequency.exponentialRampToValueAtTime(2200, now + 0.18);
      preGain.gain.setValueAtTime(0.08, now);
      preGain.gain.linearRampToValueAtTime(0.4, now + 0.18);
      preGain.gain.setValueAtTime(0, now + 0.19);
      preOsc.connect(preGain);
      preGain.connect(ctx.destination);
      preOsc.start(now);
      preOsc.stop(now + 0.19);

      // 2. Heavy concussive sub-bass explosion thump (24Hz infrasonic drop)
      const subOsc = ctx.createOscillator();
      const subGain = ctx.createGain();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(180, now + 0.18);
      subOsc.frequency.exponentialRampToValueAtTime(24, now + 1.4);
      subGain.gain.setValueAtTime(1.0, now + 0.18);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 2.4);
      subOsc.connect(subGain);
      subGain.connect(ctx.destination);
      subOsc.start(now + 0.18);
      subOsc.stop(now + 2.4);

      // 3. Dense shockwave blast noise (wideband explosive crunch)
      const bufferSize = Math.floor(ctx.sampleRate * 2.8);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.9));
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(3200, now + 0.18);
      filter.frequency.exponentialRampToValueAtTime(45, now + 2.2);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.9, now + 0.18);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 2.5);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      noise.start(now + 0.18);

      // 4. Metal screech / shearing titanium high-frequency distortion
      const metalOsc = ctx.createOscillator();
      const metalGain = ctx.createGain();
      metalOsc.type = 'sawtooth';
      metalOsc.frequency.setValueAtTime(1400, now + 0.2);
      metalOsc.frequency.exponentialRampToValueAtTime(280, now + 0.7);
      metalGain.gain.setValueAtTime(0.35, now + 0.2);
      metalGain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
      metalOsc.connect(metalGain);
      metalGain.connect(ctx.destination);
      metalOsc.start(now + 0.2);
      metalOsc.stop(now + 0.9);

      // 5. Secondary micro-detonations (internal hydraulic bursts at +350ms and +750ms)
      [0.35, 0.75].forEach((offset, idx) => {
        const secOsc = ctx.createOscillator();
        const secGain = ctx.createGain();
        secOsc.type = 'triangle';
        secOsc.frequency.setValueAtTime(110 - idx * 25, now + offset);
        secOsc.frequency.exponentialRampToValueAtTime(35, now + offset + 0.5);
        secGain.gain.setValueAtTime(0.45, now + offset);
        secGain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.6);
        secOsc.connect(secGain);
        secGain.connect(ctx.destination);
        secOsc.start(now + offset);
        secOsc.stop(now + offset + 0.6);
      });

      // 6. Emergency warning siren klaxon (repeating 5 cycles)
      for (let i = 0; i < 5; i++) {
        const sirenTime = now + 0.65 + i * 0.7;
        const siren = ctx.createOscillator();
        const sirenGain = ctx.createGain();
        siren.type = 'sawtooth';
        siren.frequency.setValueAtTime(580, sirenTime);
        siren.frequency.linearRampToValueAtTime(1020, sirenTime + 0.35);
        siren.frequency.linearRampToValueAtTime(580, sirenTime + 0.7);

        sirenGain.gain.setValueAtTime(0, sirenTime);
        sirenGain.gain.linearRampToValueAtTime(0.22, sirenTime + 0.05);
        sirenGain.gain.setValueAtTime(0.22, sirenTime + 0.6);
        sirenGain.gain.exponentialRampToValueAtTime(0.001, sirenTime + 0.7);

        siren.connect(sirenGain);
        sirenGain.connect(ctx.destination);
        siren.start(sirenTime);
        siren.stop(sirenTime + 0.7);
      }
    } catch (e) {}
  }

  // Futuristic Security Override & Nano-Repair Sound Sequence
  repairSequence() {
    if (this.isMuted) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const now = ctx.currentTime;

      // 1. High-tech charging hum
      const chargeOsc = ctx.createOscillator();
      const chargeGain = ctx.createGain();
      chargeOsc.type = 'sine';
      chargeOsc.frequency.setValueAtTime(120, now);
      chargeOsc.frequency.exponentialRampToValueAtTime(680, now + 0.6);
      chargeGain.gain.setValueAtTime(0.05, now);
      chargeGain.gain.linearRampToValueAtTime(0.2, now + 0.5);
      chargeGain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
      chargeOsc.connect(chargeGain);
      chargeGain.connect(ctx.destination);
      chargeOsc.start(now);
      chargeOsc.stop(now + 0.65);

      // 2. Pneumatic hydraulic hiss
      const bufferSize = Math.floor(ctx.sampleRate * 0.5);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2400, now + 0.4);
      filter.Q.setValueAtTime(3.0, now + 0.4);
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.18, now + 0.4);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      noise.start(now + 0.4);

      // 3. Heavy metallic "CLANG-LOCK" confirming physical integrity
      const clankOsc = ctx.createOscillator();
      const clankGain = ctx.createGain();
      clankOsc.type = 'triangle';
      clankOsc.frequency.setValueAtTime(260, now + 0.7);
      clankOsc.frequency.exponentialRampToValueAtTime(55, now + 1.1);
      clankGain.gain.setValueAtTime(0.35, now + 0.7);
      clankGain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
      clankOsc.connect(clankGain);
      clankGain.connect(ctx.destination);
      clankOsc.start(now + 0.7);
      clankOsc.stop(now + 1.2);

      // 4. Clean system reboot chime chord
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
        const chordOsc = ctx.createOscillator();
        const chordGain = ctx.createGain();
        chordOsc.type = 'sine';
        chordOsc.frequency.setValueAtTime(freq, now + 0.85 + idx * 0.05);
        chordGain.gain.setValueAtTime(0, now + 0.85 + idx * 0.05);
        chordGain.gain.linearRampToValueAtTime(0.12, now + 0.87 + idx * 0.05);
        chordGain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
        chordOsc.connect(chordGain);
        chordGain.connect(ctx.destination);
        chordOsc.start(now + 0.85 + idx * 0.05);
        chordOsc.stop(now + 1.4);
      });
    } catch (e) {}
  }
}

export const soundFX = new SoundFX();
