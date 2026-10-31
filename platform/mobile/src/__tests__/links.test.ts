import { appPath } from '@/lib/links';

describe('appPath', () => {
  it('opens website pages the app has in the app, dropping the English prefix', () => {
    expect(appPath('/books/chokher-bali')).toBe('/books/chokher-bali');
    expect(appPath('/en/books/chokher-bali')).toBe('/books/chokher-bali');
    expect(appPath('https://boikonika.com/account/orders/BK1?placed=1')).toBe('/account/orders/BK1?placed=1');
    expect(appPath('/categories/fiction/novels')).toBe('/categories/fiction/novels');
    expect(appPath('/en')).toBe('/');
  });

  it('leaves pages only the website has, and other sites, to the browser', () => {
    expect(appPath('/authors/rabindranath')).toBeNull();
    expect(appPath('/seller/listings')).toBeNull();
    expect(appPath('https://example.com/books/x')).toBeNull();
    expect(appPath('/english-books')).toBeNull();
  });
});
