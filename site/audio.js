// Original synthesized combat cues: no external audio or downloaded assets.
const melodies = {
  warden: [
    [180, 65, 0.11, "triangle"],
    [490, 220, 0.06, "sine"],
  ],
  mage: [
    [580, 1050, 0.18, "sine"],
    [870, 1300, 0.13, "sine"],
  ],
  ranger: [[1250, 260, 0.09, "triangle"]],
  herbalist: [
    [420, 630, 0.16, "sine"],
    [650, 870, 0.12, "sine"],
  ],
  hit: [[230, 85, 0.065, "triangle"]],
  critical: [
    [650, 130, 0.13, "triangle"],
    [980, 480, 0.08, "sine"],
  ],
  guard: [[340, 220, 0.13, "triangle"]],
  hurt: [[130, 60, 0.11, "triangle"]],
  dodge: [[860, 240, 0.09, "sine"]],
  enemy: [[170, 80, 0.09, "triangle"]],
  slam: [
    [95, 35, 0.23, "triangle"],
    [160, 55, 0.16, "sine"],
  ],
  warning: [
    [440, 460, 0.08, "sine", 0],
    [440, 520, 0.08, "sine", 0.16],
  ],
  phase: [
    [220, 330, 0.18, "triangle", 0],
    [330, 440, 0.18, "triangle", 0.15],
  ],
  heal: [
    [520, 660, 0.12, "sine"],
    [780, 880, 0.18, "sine", 0.08],
  ],
  level: [
    [660, 660, 0.14, "sine"],
    [880, 880, 0.14, "sine", 0.12],
    [1320, 1320, 0.23, "sine", 0.24],
  ],
  discovery: [
    [440, 550, 0.15, "sine"],
    [660, 880, 0.2, "sine", 0.1],
  ],
  treasure: [
    [660, 660, 0.14, "sine"],
    [990, 990, 0.14, "sine", 0.12],
    [1320, 1480, 0.25, "sine", 0.23],
  ],
};
export class CombatAudio {
  unlock() {
    try {
      this.context ??= new AudioContext();
      this.context.resume();
      return true;
    } catch {
      return false;
    }
  }
  play(cue) {
    const notes = melodies[cue];
    if (!notes || !this.unlock()) return false;
    const context = this.context;
    for (const [from, to, duration, type, delay = 0] of notes) {
      const at = context.currentTime + delay,
        osc = context.createOscillator(),
        gain = context.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(from, at);
      osc.frequency.exponentialRampToValueAtTime(to, at + duration);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.026, at + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
      osc.connect(gain);
      gain.connect(context.destination);
      osc.start(at);
      osc.stop(at + duration + 0.01);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
    }
    return true;
  }
}
