import { beforeEach, describe, expect, it } from 'vitest';
import { useSessionStore } from './sessionStore';

const store = () => useSessionStore.getState();

beforeEach(() => {
  store().clear();
  store().setMode('letters');
});

describe('sessionStore', () => {
  it('removes a gloss by index', () => {
    store().addGloss('FS:RAKAN');
    store().addGloss('FS:ADI');
    store().removeGloss(0);
    expect(store().glosses).toEqual(['FS:ADI']);
  });

  it('finishing a sentence keeps the text and clears the chips', () => {
    store().addGloss('FS:RAKAN');
    store().setWordBuffer('AD');
    store().finishSentence('Rakan.');
    expect(store().sentence).toBe('Rakan.');
    expect(store().glosses).toEqual([]);
    expect(store().wordBuffer).toBe('');
  });

  it('clear() resets the session and stops it, but keeps the mode', () => {
    store().setMode('signs');
    store().start();
    store().addGloss('FS:RAKAN');
    store().setActive({ label: 'R', confidence: 0.9 });
    store().finishSentence('Rakan.');
    store().clear();
    expect(store()).toMatchObject({
      running: false,
      mode: 'signs',
      glosses: [],
      sentence: '',
      active: null,
    });
  });

  it('takeSentence speaks only the chips that are still there', () => {
    store().addGloss('FS:RAKAN');
    store().addGloss('FS:XQ');
    store().addGloss('FS:ADI');
    store().removeGloss(1);
    expect(store().takeSentence()).toBe('Rakan Adi.');
    expect(store().sentence).toBe('Rakan Adi.');
    expect(store().glosses).toEqual([]);
  });

  it('takeSentence returns an empty string when every chip was removed', () => {
    store().addGloss('FS:XQ');
    store().removeGloss(0);
    expect(store().takeSentence()).toBe('');
    expect(store().sentence).toBe('');
  });

  it('pause drops the half-spelled word but keeps the chips', () => {
    store().start();
    store().addGloss('FS:RAKAN');
    store().setWordBuffer('AD');
    store().pause();
    expect(store().wordBuffer).toBe('');
    expect(store().glosses).toEqual(['FS:RAKAN']);
  });

  it('start and pause toggle running', () => {
    store().start();
    expect(store().running).toBe(true);
    store().pause();
    expect(store().running).toBe(false);
  });
});
