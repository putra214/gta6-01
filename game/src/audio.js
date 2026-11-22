// Sunset Keys — procedural audio with WebAudio only, zero audio files.
// Engine hum is a sawtooth through a lowpass whose pitch follows speed;
// the siren is a triangle wave with an LFO between two tones; pickups are
// short square blips. The AudioContext is created on the first user gesture
// (autoplay policy) and every call is guarded.
export class GameAudio {
  constructor() {
    this.ctx = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenLfo = null;
    this.muted = false;
  }

  /** Create the context and start the engine hum. Call from a user gesture. */
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      return; // no audio available: the game plays silent
    }
    // Engine: sawtooth -> lowpass -> gain.
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 500;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0.05;
    this.engineOsc.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.ctx.destination);
    this.engineOsc.start();
    // Siren: triangle with an LFO sweeping 700 <-> 1100 Hz, silent until wanted.
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'triangle';
    this.sirenOsc.frequency.value = 900;
    this.sirenLfo = this.ctx.createOscillator();
    this.sirenLfo.type = 'sine';
    this.sirenLfo.frequency.value = 0.8;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 200;
    this.sirenLfo.connect(lfoGain);
    lfoGain.connect(this.sirenOsc.frequency);
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.ctx.destination);
    this.sirenOsc.start();
    this.sirenLfo.start();
  }

  /** Engine pitch follows speed (0..1 of top speed). */
  setEngine(speedNorm, driving) {
    if (!this.ctx || this.muted) return;
    const target = driving ? 0.05 + speedNorm * 0.06 : 0.02;
    this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1);
    this.engineOsc.frequency.setTargetAtTime(55 + speedNorm * 160, this.ctx.currentTime, 0.1);
  }

  /** Siren on while wanted, off otherwise. */
  setSiren(on) {
    if (!this.ctx) return;
    this.sirenGain.gain.setTargetAtTime(on && !this.muted ? 0.04 : 0, this.ctx.currentTime, 0.2);
  }

  /** A short pickup blip (mission complete, cash). */
  blip() {
    if (!this.ctx || this.muted) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = 880;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.3);
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.ctx) {
      if (this.engineGain) this.engineGain.gain.value = this.muted ? 0 : 0.05;
      if (this.sirenGain) this.sirenGain.gain.value = 0;
    }
    return this.muted;
  }
}
