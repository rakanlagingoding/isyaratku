import { describe, expect, it } from 'vitest';
import { FpsMeter } from './fps';

describe('FpsMeter', () => {
  it('reports frames in the last second', () => {
    const meter = new FpsMeter();
    let fps = 0;
    for (let t = 0; t <= 2000; t += 50) fps = meter.tick(t); // 20 FPS
    expect(fps).toBe(20);
  });

  it('drops old frames after a pause', () => {
    const meter = new FpsMeter();
    for (let t = 0; t < 1000; t += 10) meter.tick(t);
    expect(meter.tick(5000)).toBe(1);
  });

  it('reset clears history', () => {
    const meter = new FpsMeter();
    meter.tick(0);
    meter.tick(10);
    meter.reset();
    expect(meter.tick(20)).toBe(1);
  });
});
