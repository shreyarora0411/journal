import { fireEvent, renderWithProviders, screen } from '@/test/render';
import { Nav } from './Nav';

describe('Nav', () => {
  it('renders all five slots', () => {
    renderWithProviders(<Nav active="feed" onPress={() => undefined} />);
    expect(screen.getByLabelText('Feed')).toBeTruthy();
    expect(screen.getByLabelText('Search')).toBeTruthy();
    expect(screen.getByLabelText('Add')).toBeTruthy();
    expect(screen.getByLabelText('Inbox')).toBeTruthy();
    expect(screen.getByLabelText('You')).toBeTruthy();
  });

  it('shows the coral dot only under the active slot', () => {
    renderWithProviders(<Nav active="search" onPress={() => undefined} />);
    expect(screen.getByTestId('nav-search-dot')).toBeTruthy();
    expect(screen.queryByTestId('nav-feed-dot')).toBeNull();
  });

  it('calls onPress with the tapped slot', () => {
    const onPress = jest.fn();
    renderWithProviders(<Nav active="feed" onPress={onPress} />);
    fireEvent.press(screen.getByLabelText('Inbox'));
    expect(onPress).toHaveBeenCalledWith('inbox');
  });

  it('does not render a label under the central + slot', () => {
    renderWithProviders(<Nav active="feed" onPress={() => undefined} />);
    // The other four show their labels; Add has no label below the glyph.
    expect(screen.queryByText('Add')).toBeNull();
    expect(screen.queryByText('ADD')).toBeNull();
  });
});
