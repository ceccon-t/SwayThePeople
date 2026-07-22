import { describe, expect, it } from 'vitest';
import { parseJobOutput, parseJsonLoose } from '@core/generation/outputs';

describe('parseJsonLoose', () => {
  it('parses plain JSON', () => {
    expect(parseJsonLoose('{"a":1}')).toEqual({ a: 1 });
  });

  it('strips markdown fences', () => {
    expect(parseJsonLoose('Here you go:\n```json\n{"a":1}\n```\nHope that helps!')).toEqual({
      a: 1,
    });
  });

  it('extracts the object from surrounding prose', () => {
    expect(parseJsonLoose('Sure! {"question":"Why?"} — as requested.')).toEqual({
      question: 'Why?',
    });
  });

  it('throws when no JSON is present', () => {
    expect(() => parseJsonLoose('no json here')).toThrow();
  });
});

describe('parseJobOutput', () => {
  it('accepts coerced numbers (models love strings)', () => {
    const parsed = parseJobOutput(
      'election.epilogue',
      '{"advancementScore":"62","justification":"j","epilogue":"e"}',
    ) as { advancementScore: number };
    expect(parsed.advancementScore).toBe(62);
  });

  it('rejects wrong shapes with a descriptive error', () => {
    expect(() => parseJobOutput('debate.rivalQuestion', '{"answer":"nope"}')).toThrow(
      /expected shape/,
    );
  });

  it('treats text jobs as raw prose', () => {
    expect(parseJobOutput('day.report', '  A fine day.  ')).toBe('A fine day.');
    expect(() => parseJobOutput('chat.reply', '   ')).toThrow(/Empty/);
  });
});
