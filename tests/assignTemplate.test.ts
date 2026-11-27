import { afterEach, describe, expect, it } from 'vitest';
import { assignTemplate } from '../src/core/assignTemplate';

describe('assignTemplate: quote (Req 3.2, 3.8)', () => {
  it('detects English straight quotes', () => {
    expect(assignTemplate('She said "keep it simple" to everyone.')).toEqual({
      template: 'quote',
      data: { quote: 'keep it simple' },
    });
  });

  it('detects curly quotes', () => {
    expect(assignTemplate('He wrote “ship it today” on the board.')).toEqual({
      template: 'quote',
      data: { quote: 'ship it today' },
    });
  });

  it('detects 「…」 corner brackets', () => {
    expect(assignTemplate('他说「少即是多」。')).toEqual({
      template: 'quote',
      data: { quote: '少即是多' },
    });
  });

  it('detects 『…』 double corner brackets', () => {
    expect(assignTemplate('书里写着『慢慢来』。')).toEqual({
      template: 'quote',
      data: { quote: '慢慢来' },
    });
  });

  it('takes precedence over timeline and big-number', () => {
    expect(assignTemplate('他在2025年说「增长了45%」。').template).toBe('quote');
  });

  it('ignores empty quotes', () => {
    expect(assignTemplate('An empty "" quote here.').template).not.toBe('quote');
  });
});

describe('assignTemplate: timeline (Req 3.3, 3.9)', () => {
  it('detects 2025年', () => {
    expect(assignTemplate('2025年我们开始了这个项目。')).toEqual({
      template: 'timeline',
      data: { label: '2025年' },
    });
  });

  it('detects 首先', () => {
    expect(assignTemplate('首先打开编辑器。')).toEqual({
      template: 'timeline',
      data: { label: '首先' },
    });
  });

  it('detects an English four-digit year', () => {
    expect(assignTemplate('In 2019 we launched the show.')).toEqual({
      template: 'timeline',
      data: { label: '2019' },
    });
  });

  it('detects an English sequence marker', () => {
    expect(assignTemplate('First, paste the transcript.')).toEqual({
      template: 'timeline',
      data: { label: 'First' },
    });
  });

  it('detects an English month-name date', () => {
    expect(assignTemplate('We met on March 5, 2025 downtown.')).toEqual({
      template: 'timeline',
      data: { label: 'March 5, 2025' },
    });
  });

  it('takes precedence over big-number', () => {
    expect(assignTemplate('Revenue grew 45% in 2025.')).toEqual({
      template: 'timeline',
      data: { label: '2025' },
    });
  });
});

describe('assignTemplate: big-number (Req 3.4, 3.6)', () => {
  it('detects 45%', () => {
    expect(assignTemplate('Engagement rose 45% this quarter.')).toEqual({
      template: 'big-number',
      data: { value: '45%' },
    });
  });

  it('detects 3倍', () => {
    expect(assignTemplate('效率提升了3倍。')).toEqual({
      template: 'big-number',
      data: { value: '3倍' },
    });
  });

  it('detects a Chinese numeral followed by a unit', () => {
    expect(assignTemplate('用户超过三万。')).toEqual({
      template: 'big-number',
      data: { value: '三万' },
    });
  });

  it('detects a currency amount', () => {
    expect(assignTemplate('Costs fell by $3.5 million.')).toEqual({
      template: 'big-number',
      data: { value: '$3.5 million' },
    });
  });

  it('records the first numeric value', () => {
    expect(assignTemplate('We tested 12 ideas and kept 3.')).toEqual({
      template: 'big-number',
      data: { value: '12' },
    });
  });
});

describe('assignTemplate: keyword-highlight (Req 3.5, 3.7)', () => {
  const originalSegmenter = Intl.Segmenter;

  afterEach(() => {
    (Intl as { Segmenter: unknown }).Segmenter = originalSegmenter;
  });

  it('picks the longest English keywords, skipping stopwords and short words', () => {
    expect(assignTemplate('Storytelling matters for creators.')).toEqual({
      template: 'keyword-highlight',
      data: { keywords: ['Storytelling', 'creators', 'matters'] },
    });
  });

  it('returns 1 to 3 Chinese keywords that occur in the sentence', () => {
    const sentence = '人工智能正在改变内容创作的方式。';
    const result = assignTemplate(sentence);
    expect(result.template).toBe('keyword-highlight');
    if (result.template !== 'keyword-highlight') return;
    expect(result.data.keywords.length).toBeGreaterThanOrEqual(1);
    expect(result.data.keywords.length).toBeLessThanOrEqual(3);
    for (const k of result.data.keywords) expect(sentence).toContain(k);
  });

  it('falls back to 2-character chunks when Intl.Segmenter is missing', () => {
    (Intl as { Segmenter: unknown }).Segmenter = undefined;
    expect(assignTemplate('人工智能改变内容创作')).toEqual({
      template: 'keyword-highlight',
      data: { keywords: ['人工', '智能', '改变'] },
    });
  });

  it('falls back to the first token when no keyword qualifies', () => {
    expect(assignTemplate('Ok so.')).toEqual({
      template: 'keyword-highlight',
      data: { keywords: ['Ok'] },
    });
  });
});
