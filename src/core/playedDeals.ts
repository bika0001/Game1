/**
 * Ensemble des donnes déjà jouées d'une banque (un bit par donne), sérialisable
 * en base64 pour la sauvegarde : 10 000 donnes tiennent en 1,7 Ko.
 */
export class PlayedDeals {
  private readonly bits: Uint8Array;
  private played = 0;

  constructor(
    readonly size: number,
    serialized?: string,
  ) {
    this.bits = new Uint8Array(Math.ceil(size / 8));
    if (serialized) {
      try {
        const raw = atob(serialized);
        for (let i = 0; i < Math.min(raw.length, this.bits.length); i++) {
          this.bits[i] = raw.charCodeAt(i);
        }
      } catch {
        // Donnée corrompue : on repart d'un ensemble vide plutôt que de bloquer le jeu.
      }
      // Ignore les bits au-delà de la taille (banque réduite entre deux versions).
      for (let i = size; i < this.bits.length * 8; i++) this.clearBit(i);
      for (let i = 0; i < size; i++) if (this.has(i)) this.played++;
    }
  }

  private clearBit(index: number): void {
    const byte = index >> 3;
    this.bits[byte] = (this.bits[byte] as number) & ~(1 << (index & 7));
  }

  has(index: number): boolean {
    if (index < 0 || index >= this.size) return false;
    return (((this.bits[index >> 3] as number) >> (index & 7)) & 1) === 1;
  }

  add(index: number): void {
    if (index < 0 || index >= this.size || this.has(index)) return;
    const byte = index >> 3;
    this.bits[byte] = (this.bits[byte] as number) | (1 << (index & 7));
    this.played++;
  }

  get count(): number {
    return this.played;
  }

  clear(): void {
    this.bits.fill(0);
    this.played = 0;
  }

  serialize(): string {
    let raw = '';
    for (const b of this.bits) raw += String.fromCharCode(b);
    return btoa(raw);
  }
}
