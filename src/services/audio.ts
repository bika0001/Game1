/**
 * Sons doux synthétisés en code (Web Audio). Les assets définitifs (CC0 ou
 * commandés) remplaceront ces recettes sans changer l'interface.
 */
export type SoundName =
  | 'slide'
  | 'place'
  | 'flip'
  | 'foundation'
  | 'deal'
  | 'win'
  | 'error'
  | 'click'
  | 'sail'
  | 'whoosh'
  | 'splash'
  | 'sparkle'
  | 'pop'
  | 'bubble';

export interface PlayOptions {
  /** Multiplicateur de hauteur (1 = normal ; 2 = une octave au-dessus). */
  readonly pitch?: number;
  /** Multiplicateur de volume. */
  readonly volume?: number;
}

export interface AudioService {
  setEnabled(enabled: boolean): void;
  /** À appeler lors d'un geste utilisateur (politique d'autoplay des navigateurs). */
  unlock(): void;
  play(name: SoundName, opts?: PlayOptions): void;
}

type Ctx = AudioContext;

function createSynthAudio(): AudioService {
  let ctx: Ctx | null = null;
  let master: GainNode | null = null;
  let noise: AudioBuffer | null = null;
  let enabled = true;
  /** Évite l'empilement d'un même son joué plusieurs fois dans la même fraction de seconde. */
  const lastPlayed = new Map<SoundName, number>();

  const ensure = (): Ctx | null => {
    if (ctx) return ctx;
    const Ctor =
      globalThis.AudioContext ??
      (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = 0.32;
      master.connect(ctx.destination);
      noise = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    } catch {
      ctx = null;
    }
    return ctx;
  };

  const envelope = (gain: GainNode, at: number, peak: number, attack: number, decay: number) => {
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), at + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
  };

  /** Note simple ; `to` fait glisser la fréquence pendant la note. */
  const tone = (
    freq: number,
    at: number,
    peak: number,
    decay: number,
    type: OscillatorType = 'sine',
    to?: number,
    attack = 0.005,
  ) => {
    const c = ctx as Ctx;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, at + attack + decay);
    envelope(gain, at, peak, attack, decay);
    osc.connect(gain).connect(master as GainNode);
    osc.start(at);
    osc.stop(at + attack + decay + 0.05);
  };

  /** Souffle filtré ; `to` fait glisser la fréquence du filtre. */
  const hiss = (
    at: number,
    peak: number,
    decay: number,
    filterType: BiquadFilterType,
    freq: number,
    q = 0.8,
    to?: number,
    attack = 0.004,
  ) => {
    const c = ctx as Ctx;
    const src = c.createBufferSource();
    src.buffer = noise;
    const filter = c.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(freq, at);
    if (to) filter.frequency.exponentialRampToValueAtTime(to, at + attack + decay);
    filter.Q.value = q;
    const gain = c.createGain();
    envelope(gain, at, peak, attack, decay);
    src
      .connect(filter)
      .connect(gain)
      .connect(master as GainNode);
    src.start(at, Math.random() * 0.3);
    src.stop(at + attack + decay + 0.05);
  };

  const recipes: Record<SoundName, (t: number, p: number, v: number) => void> = {
    slide: (t, p, v) => hiss(t, 0.3 * v, 0.1, 'bandpass', 1700 * p, 0.7, 2600 * p),
    place: (t, p, v) => {
      tone(210 * p, t, 0.32 * v, 0.07, 'sine', 150 * p);
      hiss(t, 0.1 * v, 0.03, 'lowpass', 1400);
    },
    flip: (t, p, v) => hiss(t, 0.22 * v, 0.04, 'highpass', 2600 * p, 0.8, 4200 * p),
    foundation: (t, p, v) => {
      tone(784 * p, t, 0.17 * v, 0.32, 'sine');
      tone(1175 * p, t + 0.035, 0.1 * v, 0.34, 'sine');
      tone(1568 * p, t + 0.07, 0.05 * v, 0.3, 'triangle');
    },
    deal: (t, p, v) => hiss(t, 0.16 * v, 0.045, 'bandpass', 2300 * p, 0.9),
    win: (t, _p, v) => {
      [523, 659, 784, 1047, 1319].forEach((f, i) =>
        tone(f, t + i * 0.11, 0.18 * v, 0.5, 'triangle'),
      );
      [1047, 1319, 1568].forEach((f) => tone(f, t + 0.62, 0.09 * v, 1.1, 'sine'));
      [2093, 2637, 3136, 2349].forEach((f, i) =>
        tone(f, t + 0.7 + i * 0.09, 0.035 * v, 0.25, 'sine'),
      );
    },
    error: (t, _p, v) => {
      tone(150, t, 0.26 * v, 0.1, 'sine', 110);
      tone(118, t + 0.07, 0.2 * v, 0.12, 'sine', 92);
    },
    click: (t, p, v) => {
      tone(620 * p, t, 0.08 * v, 0.05, 'sine', 900 * p);
      hiss(t, 0.08 * v, 0.02, 'highpass', 3500);
    },
    sail: (t, _p, v) => {
      hiss(t, 0.2 * v, 0.6, 'lowpass', 600, 0.5);
      tone(392, t + 0.1, 0.12 * v, 0.5, 'sine');
    },
    whoosh: (t, p, v) => hiss(t, 0.14 * v, 0.16, 'bandpass', 500 * p, 1.4, 2400 * p, 0.05),
    splash: (t, p, v) => {
      hiss(t, 0.12 * v, 0.18, 'lowpass', 2200 * p, 0.6, 500 * p);
      tone(950 * p, t, 0.09 * v, 0.07, 'sine', 330 * p);
    },
    sparkle: (t, p, v) => {
      [1568, 2093, 2637].forEach((f, i) => tone(f * p, t + i * 0.045, 0.06 * v, 0.22, 'sine'));
    },
    pop: (t, p, v) => tone(480 * p, t, 0.16 * v, 0.08, 'sine', 980 * p),
    bubble: (t, p, v) => tone(300 * p, t, 0.1 * v, 0.09, 'sine', 1150 * p),
  };

  return {
    setEnabled: (value) => {
      enabled = value;
    },
    unlock: () => {
      const c = ensure();
      if (c && c.state === 'suspended') void c.resume();
    },
    play: (name, opts) => {
      if (!enabled) return;
      const c = ensure();
      if (!c || c.state !== 'running') return;
      const now = c.currentTime;
      const last = lastPlayed.get(name) ?? -1;
      if (now - last < 0.025) return;
      lastPlayed.set(name, now);
      recipes[name](now + 0.005, opts?.pitch ?? 1, opts?.volume ?? 1);
    },
  };
}

export const audio: AudioService = createSynthAudio();
