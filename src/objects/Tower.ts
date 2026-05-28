import type { Block } from './Block';

export class Tower {
  private readonly blocks: Block[] = [];

  public push(block: Block): void {
    this.blocks.push(block);
  }

  public top(): Block | undefined {
    return this.blocks[this.blocks.length - 1];
  }

  public size(): number {
    return this.blocks.length;
  }

  public clear(): void {
    for (const b of this.blocks) b.destroy();
    this.blocks.length = 0;
  }
}
