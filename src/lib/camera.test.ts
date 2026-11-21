import { describe, expect, it, vi } from 'vitest';
import { CameraError, classifyCameraError, openCamera, stopStream } from './camera';

const domError = (name: string) => Object.assign(new Error(name), { name });

describe('classifyCameraError', () => {
  it.each([
    ['NotAllowedError', 'denied'],
    ['SecurityError', 'denied'],
    ['NotFoundError', 'not-found'],
    ['OverconstrainedError', 'not-found'],
    ['NotReadableError', 'in-use'],
    ['SomethingElse', 'unknown'],
  ])('maps %s to %s', (name, kind) => {
    expect(classifyCameraError(domError(name))).toBe(kind);
  });

  it('handles non-error values', () => {
    expect(classifyCameraError('boom')).toBe('unknown');
    expect(classifyCameraError(null)).toBe('unknown');
  });
});

describe('openCamera', () => {
  it('rejects in an insecure context', async () => {
    await expect(openCamera(undefined, { isSecureContext: false })).rejects.toMatchObject({
      kind: 'insecure',
    });
  });

  it('rejects when getUserMedia is missing', async () => {
    await expect(openCamera(undefined, { isSecureContext: true })).rejects.toMatchObject({
      kind: 'unsupported',
    });
  });

  it('requests the front camera without audio', async () => {
    const stream = {} as MediaStream;
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    const result = await openCamera(undefined, {
      isSecureContext: true,
      mediaDevices: { getUserMedia },
    });
    expect(result).toBe(stream);
    expect(getUserMedia).toHaveBeenCalledWith({
      audio: false,
      video: expect.objectContaining({ facingMode: 'user' }),
    });
  });

  it('wraps permission denial as CameraError("denied")', async () => {
    const getUserMedia = vi.fn().mockRejectedValue(domError('NotAllowedError'));
    const promise = openCamera(undefined, {
      isSecureContext: true,
      mediaDevices: { getUserMedia },
    });
    await expect(promise).rejects.toBeInstanceOf(CameraError);
    await expect(promise).rejects.toMatchObject({ kind: 'denied' });
  });
});

describe('stopStream', () => {
  it('stops every track and accepts null', () => {
    const stop = vi.fn();
    stopStream({ getTracks: () => [{ stop }, { stop }] } as unknown as MediaStream);
    expect(stop).toHaveBeenCalledTimes(2);
    expect(() => stopStream(null)).not.toThrow();
  });
});
