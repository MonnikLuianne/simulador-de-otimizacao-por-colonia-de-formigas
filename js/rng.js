/**
 * rng.js — Gerador pseudoaleatório com semente (Mulberry32)
 * Garante reprodutibilidade quando a mesma semente é usada.
 */
class SeededRNG {
  constructor(seed = 42) {
    this.seed = seed >>> 0;
    this._state = this.seed;
  }

  reset() {
    this._state = this.seed;
  }

  setSeed(seed) {
    this.seed = seed >>> 0;
    this._state = this.seed;
  }

  /** Retorna float em [0, 1) */
  next() {
    let t = (this._state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Sorteia índice por roleta proporcional a weights[].
   * @param {number[]} weights
   * @returns {number} índice sorteado
   */
  rouletteSelect(weights) {
    const total = weights.reduce((a, b) => a + b, 0);
    let r = this.next() * total;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r <= 0) return i;
    }
    return weights.length - 1;
  }
}