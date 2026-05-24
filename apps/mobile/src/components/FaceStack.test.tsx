import { renderWithProviders, screen } from '@/test/render';
import { FaceStack } from './FaceStack';

describe('FaceStack', () => {
  it('renders up to `max` faces and a +N overflow when the list is longer', () => {
    renderWithProviders(
      <FaceStack
        testID="fs"
        people={[
          { initials: 'TA' },
          { initials: 'KA' },
          { initials: 'DI' },
          { initials: 'AN' },
          { initials: 'PR' },
        ]}
        max={3}
      />,
    );
    // Three faces + overflow chip with the remaining count
    expect(screen.getByTestId('fs-overflow')).toBeTruthy();
    expect(screen.getByText('+2')).toBeTruthy();
  });

  it('renders no overflow chip when people <= max', () => {
    renderWithProviders(
      <FaceStack testID="fs" people={[{ initials: 'TA' }, { initials: 'KA' }]} max={3} />,
    );
    expect(screen.queryByTestId('fs-overflow')).toBeNull();
  });

  it('renders the empty state without crashing', () => {
    renderWithProviders(<FaceStack testID="fs" people={[]} />);
    expect(screen.getByTestId('fs')).toBeTruthy();
  });
});
