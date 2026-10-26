import { messages, type BookCardData } from '@boikonika/shared';
import { fireEvent, screen } from '@testing-library/react-native';
import { BookCard } from '@/components/books';
import { Markdown } from '@/components/markdown';
import { ErrorState } from '@/components/ui';
import { renderWithApp } from '@/test-utils/render';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));
const { router } = jest.requireMock('expo-router') as { router: { push: jest.Mock } };

const book: BookCardData = {
  id: 'b1',
  slug: 'chokher-bali',
  title: 'চোখের বালি',
  language: 'bn',
  coverUrl: null,
  authors: [{ name: 'রবীন্দ্রনাথ ঠাকুর', slug: 'rabindranath' }],
  minPrice: '120.00',
  compareAtPrice: '150.00',
  offerCount: 1,
  inStock: true,
  hasUsed: false,
  isFree: false,
  ratingAvg: 4.5,
  ratingCount: 12,
};

describe('components', () => {
  it('shows a book with Bangla digits and opens it as one link', async () => {
    await renderWithApp(<BookCard book={book} />);
    expect(screen.getByText('৳১২০')).toBeTruthy();
    const link = screen.getByRole('link');
    expect(link.props.accessibilityLabel).toContain('চোখের বালি');
    await fireEvent.press(link);
    expect(router.push).toHaveBeenCalledWith('/books/chokher-bali');
  });

  it('renders Markdown as text, with links that open in the app', async () => {
    await renderWithApp(<Markdown source={'## অর্ডার\n\nদেখুন [আমার অর্ডার](/account/orders) **এখনই**।\n\n- এক\n- দুই'} />);
    expect(screen.getByRole('header')).toBeTruthy();
    await fireEvent.press(screen.getByText('আমার অর্ডার'));
    expect(router.push).toHaveBeenCalledWith('/account/orders');
    expect(screen.getByText('দুই')).toBeTruthy();
  });

  it('says when the phone is offline and offers to try again', async () => {
    const retry = jest.fn();
    await renderWithApp(<ErrorState offline onRetry={retry} />);
    expect(screen.getByText(messages.bn.common.offlineTitle)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: messages.bn.common.retry }));
    expect(retry).toHaveBeenCalled();
  });
});
