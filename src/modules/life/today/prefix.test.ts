import { describe, expect, it } from 'vitest';
import { prefixKind } from './RapidLog';

describe('rapid log bullets', () => {
  it('reads a hand-typed bullet as the line kind', () => {
    expect(prefixKind('• ذاكر باثولوجي')).toEqual({ kind: 'task', rest: 'ذاكر باثولوجي' });
    expect(prefixKind('○ عيادة 10 الصبح')).toEqual({ kind: 'event', rest: 'عيادة 10 الصبح' });
    expect(prefixKind('- فكرة بطاقات تشريح')).toEqual({ kind: 'note', rest: 'فكرة بطاقات تشريح' });
    expect(prefixKind('– ملاحظة')).toEqual({ kind: 'note', rest: 'ملاحظة' });
  });
  it('leaves plain text and negative numbers alone', () => {
    expect(prefixKind('قهوة 18')).toEqual({ kind: null, rest: 'قهوة 18' });
    expect(prefixKind('-5 درجات')).toEqual({ kind: null, rest: '-5 درجات' });
  });
});
