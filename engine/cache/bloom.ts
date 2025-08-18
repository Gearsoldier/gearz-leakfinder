// engine/cache/bloom.ts
import { ScalableBloomFilter } from "bloom-filters";

export class FingerprintBloom {
  private bloom: ScalableBloomFilter;
  constructor() {
    this.bloom = new ScalableBloomFilter(1000, 0.01);
  }
  has(fp: string) { return this.bloom.has(fp); }
  add(fp: string) { this.bloom.add(fp); }
}
