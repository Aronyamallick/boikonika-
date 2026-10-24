import { flattenMessages, messages } from './index';

describe('i18n messages', () => {
  const bn = flattenMessages(messages.bn);
  const en = flattenMessages(messages.en);

  it('Bangla and English define exactly the same keys', () => {
    const missingInBn = Object.keys(en).filter((k) => !(k in bn));
    const missingInEn = Object.keys(bn).filter((k) => !(k in en));
    expect(missingInBn).toEqual([]);
    expect(missingInEn).toEqual([]);
  });

  it('keeps ICU placeholders consistent between languages', () => {
    // ICU arguments look like {name} or {name, plural, …}; plural branch text such as {No results} is not an argument.
    const placeholders = (text: string) => [...text.matchAll(/\{\s*(\w+)\s*[,}]/g)].map((m) => m[1] as string).sort();
    const mismatched = Object.keys(en).filter((k) => {
      const a = new Set(placeholders(en[k] as string));
      const b = new Set(placeholders(bn[k] as string));
      return [...a].some((p) => !b.has(p)) || [...b].some((p) => !a.has(p));
    });
    expect(mismatched).toEqual([]);
  });

  it('has no empty translations', () => {
    expect(Object.entries(bn).filter(([, v]) => !v.trim()).map(([k]) => k)).toEqual([]);
    expect(Object.entries(en).filter(([, v]) => !v.trim()).map(([k]) => k)).toEqual([]);
  });
});
