/**
 * BEEMAX Zero-Copy Binary Memory Buffer Manager
 * Pre-Tier Index: IDX-PRETIER-001
 */
export class ZeroCopyMemoryPool {
  private buffer: ArrayBuffer;
  private view: Uint8Array;
  private offset = 0;

  constructor(byteLength = 65536) {
    this.buffer = new ArrayBuffer(byteLength);
    this.view = new Uint8Array(this.buffer);
  }

  allocate(payload: ArrayBuffer): { offset: number; length: number } {
    if (this.offset + payload.byteLength > this.buffer.byteLength) {
      // Ring-buffer wrap around for deterministic bounded isolate memory (<128MB)
      this.offset = 0;
    }
    const start = this.offset;
    this.view.set(new Uint8Array(payload), start);
    this.offset += payload.byteLength;
    return { offset: start, length: payload.byteLength };
  }

  readSlice(offset: number, length: number): Uint8Array {
    return this.view.subarray(offset, offset + length);
  }

  stats() {
    return {
      capacityBytes: this.buffer.byteLength,
      allocatedOffset: this.offset,
      utilizationPct: Number(((this.offset / this.buffer.byteLength) * 100).toFixed(2)),
    };
  }
}
