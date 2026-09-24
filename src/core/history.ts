/**
 * Pile d'annulation générique : chaque coup joué y dépose un enregistrement
 * (sérialisable en JSON) qui suffit à l'annuler. Taille illimitée.
 */
export class History<R> {
  private readonly records: R[];

  constructor(records: readonly R[] = []) {
    this.records = [...records];
  }

  push(record: R): void {
    this.records.push(record);
  }

  pop(): R | undefined {
    return this.records.pop();
  }

  peek(): R | undefined {
    return this.records[this.records.length - 1];
  }

  get size(): number {
    return this.records.length;
  }

  get canUndo(): boolean {
    return this.records.length > 0;
  }

  clear(): void {
    this.records.length = 0;
  }

  toArray(): R[] {
    return [...this.records];
  }
}
