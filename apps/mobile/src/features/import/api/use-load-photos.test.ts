import type { ProposedTrip } from '../lib/cluster';
import { reverseGeocodeCentroid, sampleClusterPoints } from './use-load-photos';

const mockGetAssetInfoAsync = jest.fn();
const mockReverseGeocodeAsync = jest.fn();

jest.mock('expo-media-library', () => ({
  getAssetInfoAsync: (...args: unknown[]) => mockGetAssetInfoAsync(...args),
  requestPermissionsAsync: jest.fn(),
  getAssetsAsync: jest.fn(),
}));

jest.mock('expo-location', () => ({
  reverseGeocodeAsync: (...args: unknown[]) => mockReverseGeocodeAsync(...args),
}));

const cluster: ProposedTrip = {
  id: 'c1',
  startMs: 0,
  endMs: 0,
  durationDays: 1,
  suggestedTitle: '1 Jan – 2 Jan 2026',
  photos: [
    { id: 'p1', uri: 'p1', creationTime: 1 },
    { id: 'p2', uri: 'p2', creationTime: 2 },
    { id: 'p3', uri: 'p3', creationTime: 3 },
  ],
};

beforeEach(() => {
  mockGetAssetInfoAsync.mockReset();
  mockReverseGeocodeAsync.mockReset();
});

describe('sampleClusterPoints', () => {
  it('returns the sampled photos GPS coords', async () => {
    mockGetAssetInfoAsync.mockResolvedValue({ location: { latitude: 15.3, longitude: 73.9 } });
    const points = await sampleClusterPoints(cluster);
    expect(points).toEqual([
      { latitude: 15.3, longitude: 73.9 },
      { latitude: 15.3, longitude: 73.9 },
      { latitude: 15.3, longitude: 73.9 },
    ]);
  });

  it('returns nulls when sampled photos have no GPS', async () => {
    mockGetAssetInfoAsync.mockResolvedValue({ location: null });
    const points = await sampleClusterPoints(cluster);
    expect(points).toEqual([null, null, null]);
  });

  it('swallows getAssetInfoAsync rejections and returns nulls in their place', async () => {
    mockGetAssetInfoAsync.mockRejectedValue(new Error('denied'));
    const points = await sampleClusterPoints(cluster);
    expect(points).toEqual([null, null, null]);
  });
});

describe('reverseGeocodeCentroid', () => {
  it('returns city + ISO country code on a successful geocode', async () => {
    mockReverseGeocodeAsync.mockResolvedValue([
      { city: 'Goa', subregion: null, region: 'Goa', isoCountryCode: 'IN' },
    ]);
    const result = await reverseGeocodeCentroid({ latitude: 15.3, longitude: 73.9 });
    expect(result).toEqual({ city: 'Goa', countryCode: 'IN' });
  });

  it('falls back through subregion → region for the city label', async () => {
    mockReverseGeocodeAsync.mockResolvedValue([
      { city: null, subregion: 'Darjeeling', region: 'West Bengal', isoCountryCode: 'IN' },
    ]);
    const result = await reverseGeocodeCentroid({ latitude: 27.0, longitude: 88.0 });
    expect(result).toEqual({ city: 'Darjeeling', countryCode: 'IN' });
  });

  it('returns empty object when the geocoder yields no results', async () => {
    mockReverseGeocodeAsync.mockResolvedValue([]);
    const result = await reverseGeocodeCentroid({ latitude: 0, longitude: 0 });
    expect(result).toEqual({});
  });

  it('returns empty object when the geocoder throws', async () => {
    mockReverseGeocodeAsync.mockRejectedValue(new Error('offline'));
    const result = await reverseGeocodeCentroid({ latitude: 0, longitude: 0 });
    expect(result).toEqual({});
  });
});
