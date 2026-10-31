import { headingId, markdownToText, parseInline, parseMarkdown, safeHref } from './markdown';

describe('parseMarkdown', () => {
  it('reads headings, paragraphs and lists', () => {
    const blocks = parseMarkdown('Intro line one\nline two\n\n## What you can do\n- Buy **new** books\n- Sell used ones\n\n1. First\n2. Second\n\n### Small print');
    expect(blocks.map((b) => b.type)).toEqual(['paragraph', 'heading', 'list', 'list', 'heading']);
    expect(blocks[0]).toEqual({ type: 'paragraph', children: [{ type: 'text', text: 'Intro line one line two' }] });
    expect(blocks[1]).toMatchObject({ type: 'heading', level: 2, id: 'what-you-can-do' });
    expect(blocks[2]).toEqual({
      type: 'list',
      ordered: false,
      start: 1,
      items: [[{ type: 'text', text: 'Buy ' }, { type: 'strong', children: [{ type: 'text', text: 'new' }] }, { type: 'text', text: ' books' }], [{ type: 'text', text: 'Sell used ones' }]],
    });
    expect(blocks[3]).toMatchObject({ type: 'list', ordered: true, start: 1 });
    expect(blocks[4]).toMatchObject({ type: 'heading', level: 3 });
  });

  it('keeps Bangla text and anchors intact', () => {
    const [h] = parseMarkdown('## লঙ্ঘনের অভিযোগ');
    expect(h).toMatchObject({ type: 'heading', id: 'লঙ্ঘনের-অভিযোগ' });
    expect(headingId('১. আপনার অ্যাকাউন্ট!')).toBe('১-আপনার-অ্যাকাউন্ট');
  });

  it('reads quotes, rules and list continuation lines', () => {
    const blocks = parseMarkdown('> Books are\n> a uniquely portable magic.\n\n---\n- one\n  continues\n- two');
    expect(blocks[0]).toEqual({ type: 'quote', children: [{ type: 'paragraph', children: [{ type: 'text', text: 'Books are a uniquely portable magic.' }] }] });
    expect(blocks[1]).toEqual({ type: 'rule' });
    expect(blocks[2]).toMatchObject({ items: [[{ type: 'text', text: 'one continues' }], [{ type: 'text', text: 'two' }]] });
  });

  it('never produces markup from the text', () => {
    const blocks = parseMarkdown('<script>alert(1)</script> and <b>bold</b>');
    expect(blocks).toEqual([{ type: 'paragraph', children: [{ type: 'text', text: '<script>alert(1)</script> and <b>bold</b>' }] }]);
  });

  it('handles empty input', () => {
    expect(parseMarkdown('')).toEqual([]);
    expect(parseMarkdown(null)).toEqual([]);
  });
});

describe('parseInline', () => {
  it('reads emphasis, code and links', () => {
    expect(parseInline('a *b* `c*d` [e](/books)')).toEqual([
      { type: 'text', text: 'a ' },
      { type: 'em', children: [{ type: 'text', text: 'b' }] },
      { type: 'text', text: ' ' },
      { type: 'code', text: 'c*d' },
      { type: 'text', text: ' ' },
      { type: 'link', href: '/books', children: [{ type: 'text', text: 'e' }] },
    ]);
  });

  it('drops unsafe link targets but keeps the words', () => {
    expect(parseInline('[click](javascript:alert(1))')).toEqual([{ type: 'text', text: 'click' }]);
    expect(parseInline('[x](//evil.example)')).toEqual([{ type: 'text', text: 'x' }]);
    expect(parseInline('[mail](mailto:help@boikonika.com)')).toEqual([{ type: 'link', href: 'mailto:help@boikonika.com', children: [{ type: 'text', text: 'mail' }] }]);
  });

  it('leaves lone markers and snake_case alone', () => {
    expect(parseInline('2 * 3 = 6 and file_name_here')).toEqual([{ type: 'text', text: '2 * 3 = 6 and file_name_here' }]);
    expect(parseInline('\\*not italic\\*')).toEqual([{ type: 'text', text: '*not italic*' }]);
  });
});

describe('safeHref and markdownToText', () => {
  it('allows site paths, anchors, web and mail addresses only', () => {
    expect(safeHref('/pages/terms')).toBe('/pages/terms');
    expect(safeHref('#refunds')).toBe('#refunds');
    expect(safeHref('https://example.com/a')).toBe('https://example.com/a');
    expect(safeHref('data:text/html,hi')).toBeNull();
    expect(safeHref('/\\evil.example')).toBeNull();
  });

  it('turns a document into a short plain excerpt', () => {
    expect(markdownToText('## Title\nSome **bold** words and a [link](/x).', 200)).toBe('Title Some bold words and a link.');
    expect(markdownToText('one two three four five', 12)).toBe('one two…');
  });
});
