/**
 * Sons doux synthétisés en code (Web Audio). Les assets définitifs (CC0 ou
 * commandés) remplaceront ces recettes sans changer l'interface.
 */
export type SoundName =
  'slide' | 'place' | 'flip' | 'foundation' | 'deal' | 'win' | 'error' | 'click' | 'sail';

export interface AudioService {
  setEnabled(enabled: boolean): void;
  /** À appeler lors d'un geste utilisateur (politique d'autoplay des navigateurs). */
  unlock(): void;
  play(name: SoundName): void;
}

type Ctx = AudioContext;

function createSynthAudio(): AudioService {
  let ctx: Ctx | null = null;
  let master: GainNode | null = null;
  let noise: AudioBuffer | null = null;
  let enabled = true;

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

  const envelope = (
    c: Ctx,
    gain: GainNode,
    at: number,
    peak: number,
    attack: number,
    decay: number,
  ) => {
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(peak, at + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
    void c;
  };

  const tone = (
    freq: number,
    at: number,
    peak: number,
    decay: number,
    type: OscillatorType = 'sine',
  ) => {
    const c = ctx as Ctx;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    envelope(c, gain, at, peak, 0.005, decay);
    osc.connect(gain).connect(master as GainNode);
    osc.start(at);
    osc.stop(at + decay + 0.05);
  };

  const hiss = (
    at: number,
    peak: number,
    decay: number,
    filterType: BiquadFilterType,
    freq: number,
    q = 0.8,
  ) => {
    const c = ctx as Ctx;
    const src = c.createBufferSource();
    src.buffer = noise;
    const filter = c.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(freq, at);
    filter.Q.value = q;
    const gain = c.createGain();
    envelope(c, gain, at, peak, 0.004, decay);
    src
      .connect(filter)
      .connect(gain)
      .connect(master as GainNode);
    src.start(at, Math.random() * 0.3);
    src.stop(at + decay + 0.05);
  };

  const recipes: Record<SoundName, (t: number) => void> = {
    slide: (t) => hiss(t, 0.35, 0.09, 'bandpass', 1800, 0.7),
    place: (t) => {
      tone(190, t, 0.35, 0.06, 'sine');
      hiss(t, 0.12, 0.03, 'lowpass', 1200);
    },
    flip: (t) => hiss(t, 0.25, 0.035, 'highpass', 2800),
    foundation: (t) => {
      tone(784, t, 0.18, 0.28, 'sine');
      tone(1175, t + 0.03, 0.1, 0.3, 'sine');
    },
    deal: (t) => hiss(t, 0.2, 0.05, 'bandpass', 2200, 0.9),
    win: (t) => {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, t + i * 0.13, 0.2, 0.45, 'triangle'));
    },
    error: (t) => tone(130, t, 0.3, 0.09, 'sine'),
    click: (t) => hiss(t, 0.15, 0.02, 'highpass', 3500),
    sail: (t) => {
      hiss(t, 0.2, 0.6, 'lowpass', 600, 0.5);
      tone(392, t + 0.1, 0.12, 0.5, 'sine');
    },
  };

  return {
    setEnabled: (value) => {
      enabled = value;
    },
    unlock: () => {
      const c = ensure();
      if (c && c.state === 'suspended') void c.resume();
    },
    play: (name) => {
      if (!enabled) return;
      const c = ensure();
      if (!c || c.state !== 'running') return;
      recipes[name](c.currentTime + 0.005);
    },
  };
}

export const audio: AudioService = createSynthAudio();
