import { describe, expect, it } from 'vitest';
import { deriveData, leadingLabel } from '../src/core/deriveData';

describe('deriveData: one example per derivation-table row', () => {
  it('quote: uses the matched quotation', () => {
    expect(deriveData('quote', 'She said "ship it today" loudly.')).toEqual({ quote: 'ship it today' });
  });

  it('quote: falls back to the trimmed text', () => {
    expect(deriveData('quote', '  No quotation here.  ')).toEqual({ quote: 'No quotation here.' });
  });

  it('timeline: uses the matched year, date, or marker', () => {
    expect(deriveData('timeline', 'Revenue grew in 2025.')).toEqual({ label: '2025' });
    expect(deriveData('timeline', '首先我们看数据。')).toEqual({ label: '首先' });
  });

  it('timeline: falls back to the Leading_Label', () => {
    expect(deriveData('timeline', '  "Hello," world.  ')).toEqual({ label: 'Hello' });
  });

  it('big-number: uses the matched number', () => {
    expect(deriveData('big-number', 'Costs fell by 45% this year.')).toEqual({ value: '45%' });
    expect(deriveData('big-number', '用户增长了三倍。')).toEqual({ value: '三倍' });
  });

  it('big-number: falls back to the Leading_Label', () => {
    expect(deriveData('big-number', 'Growth, finally!')).toEqual({ value: 'Growth' });
  });

  it('keyword-highlight: uses the extracted keywords', () => {
    expect(deriveData('keyword-highlight', 'Storyboards make editing easier.')).toEqual({
      keywords: ['Storyboards', 'editing', 'easier'],
    });
  });

  it('keyword-highlight: falls back to the first token, else the trimmed text', () => {
    expect(deriveData('keyword-highlight', 'a b c')).toEqual({ keywords: ['a'] });
    expect(deriveData('keyword-highlight', '  !!!  ')).toEqual({ keywords: ['!!!'] });
  });
});

describe('leadingLabel', () => {
  it('strips edge punctuation and symbols from the first token', () => {
    expect(leadingLabel('  “Hello,” she said.')).toBe('Hello');
    expect(leadingLabel('$$$Wow!!! nice')).toBe('Wow');
  });

  it('falls back to the trimmed text when the token is punctuation only', () => {
    expect(leadingLabel('  !!!  ')).toBe('!!!');
    expect(leadingLabel('... ok')).toBe('... ok');
  });

  it('keeps only the first 12 code points of long tokens', () => {
    expect(leadingLabel('Supercalifragilistic is long')).toBe('Supercalifra');
    expect(leadingLabel('一二三四五六七八九十百千万亿')).toBe('一二三四五六七八九十百千');
    expect(leadingLabel('?? ' + '…'.repeat(20))).toBe('?? ' + '…'.repeat(9));
  });

  it('counts astral characters as one code point each', () => {
    const label = leadingLabel('𠀀'.repeat(15));
    expect([...label]).toHaveLength(12);
    expect(label).toBe('𠀀'.repeat(12));
  });
});
