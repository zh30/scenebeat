import { describe, expect, it } from 'vitest';
import { parseLaunchParams, stripLaunchParams } from '../src/core/launchParams';

describe('parseLaunchParams', () => {
  it('maps ?action=new to new-transcript', () => {
    expect(parseLaunchParams('?action=new')).toEqual({ kind: 'new-transcript' });
  });

  it('maps ?action=sample to load-sample', () => {
    expect(parseLaunchParams('?action=sample')).toEqual({ kind: 'load-sample' });
  });

  it('maps an unknown action or no parameters to none', () => {
    expect(parseLaunchParams('?action=other')).toEqual({ kind: 'none' });
    expect(parseLaunchParams('')).toEqual({ kind: 'none' });
  });

  it('builds a share intent from text and title', () => {
    expect(parseLaunchParams('?text=Hello%20world.&title=Note')).toEqual({
      kind: 'share',
      transcript: 'Note\nHello world.',
    });
  });

  it('lets share parameters win over action', () => {
    expect(parseLaunchParams('?action=new&text=Shared.')).toEqual({
      kind: 'share',
      transcript: 'Shared.',
    });
    expect(parseLaunchParams('?action=sample&url=https%3A%2F%2Fa.test')).toEqual({
      kind: 'share',
      transcript: 'https://a.test',
    });
  });

  it('returns none for empty share values, even with an action', () => {
    expect(parseLaunchParams('?title=&text=%20&url=')).toEqual({ kind: 'none' });
    expect(parseLaunchParams('?action=new&text=')).toEqual({ kind: 'none' });
  });
});

describe('stripLaunchParams', () => {
  it('removes launch parameters and keeps others in order', () => {
    expect(stripLaunchParams('?utm=a&action=new&x=1&text=Hi&y=2&title=T&url=u')).toBe(
      '?utm=a&x=1&y=2',
    );
  });

  it('returns an empty string when only launch parameters were present', () => {
    expect(stripLaunchParams('?action=sample')).toBe('');
    expect(stripLaunchParams('')).toBe('');
  });

  it('keeps unrelated parameters with their raw encoding', () => {
    expect(stripLaunchParams('?q=a%20b&text=x&z')).toBe('?q=a%20b&z');
  });
});
