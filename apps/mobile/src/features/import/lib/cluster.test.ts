import {
  type ProposedTrip,
  centroid,
  classifyCluster,
  clusterPhotos,
  haversineKm,
  sampleSpread,
  splitClusterByLocationJumps,
} from './cluster';

const day = 24 * 60 * 60 * 1000;

describe('clusterPhotos', () => {
  it('groups consecutive photos into one cluster when gap < 36h', () => {
    const photos = [
      { id: 'a', uri: 'a', creationTime: 1000 },
      { id: 'b', uri: 'b', creationTime: 1000 + day },
      { id: 'c', uri: 'c', creationTime: 1000 + 2 * day },
    ];
    const proposed = clusterPhotos(photos);
    expect(proposed).toHaveLength(1);
    expect(proposed[0]?.photos).toHaveLength(3);
  });

  it('splits clusters when gap > 36h', () => {
    const photos = [
      { id: 'a', uri: 'a', creationTime: 1000 },
      { id: 'b', uri: 'b', creationTime: 1000 + 4 * day },
      { id: 'c', uri: 'c', creationTime: 1000 + 5 * day },
      { id: 'd', uri: 'd', creationTime: 1000 + 6 * day },
    ];
    // First photo is alone (filtered out by min-3 rule); cluster 2 is b/c/d.
    const proposed = clusterPhotos(photos);
    expect(proposed).toHaveLength(1);
    expect(proposed[0]?.photos.map((p) => p.id)).toEqual(['b', 'c', 'd']);
  });

  it('leaves suggestedPlace undefined when no location data is provided', () => {
    const photos = [
      { id: 'a', uri: 'a', creationTime: 1000 },
      { id: 'b', uri: 'b', creationTime: 1000 + day },
      { id: 'c', uri: 'c', creationTime: 1000 + 2 * day },
    ];
    const [trip] = clusterPhotos(photos);
    expect(trip?.suggestedPlace).toBeUndefined();
  });
});

describe('centroid', () => {
  it('averages a list of {lat, lng} points', () => {
    const c = centroid([
      { latitude: 0, longitude: 0 },
      { latitude: 2, longitude: 4 },
    ]);
    expect(c).toEqual({ latitude: 1, longitude: 2 });
  });

  it('returns null when the input is empty', () => {
    expect(centroid([])).toBeNull();
  });

  it('skips null entries', () => {
    const c = centroid([{ latitude: 10, longitude: 20 }, null, { latitude: 20, longitude: 40 }]);
    expect(c).toEqual({ latitude: 15, longitude: 30 });
  });
});

describe('haversineKm', () => {
  it('returns roughly 437km for Mumbai → Goa', () => {
    const mumbai = { latitude: 19.076, longitude: 72.8777 };
    const goa = { latitude: 15.2993, longitude: 74.124 };
    const d = haversineKm(mumbai, goa);
    expect(d).toBeGreaterThan(420);
    expect(d).toBeLessThan(460);
  });

  it('returns 0 for identical points', () => {
    expect(haversineKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 0 })).toBe(0);
  });
});

describe('sampleSpread', () => {
  it('returns first, middle, last for n=3 on a 10-item array', () => {
    const items = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    expect(sampleSpread(items, 3)).toEqual([0, 5, 9]);
  });

  it('returns the array unchanged when n ≥ length', () => {
    expect(sampleSpread([1, 2, 3], 5)).toEqual([1, 2, 3]);
  });

  it('returns empty for empty input', () => {
    expect(sampleSpread([], 3)).toEqual([]);
  });
});

const home = { lat: 19.076, lng: 72.8777, countryCode: 'IN' };
const baseCluster = {
  durationDays: 3,
  photos: Array.from({ length: 6 }, (_, i) => ({
    id: `p${i}`,
    uri: `p${i}`,
    creationTime: i,
  })),
};

describe('classifyCluster', () => {
  it('returns unknown when centroid is missing', () => {
    expect(classifyCluster({ cluster: baseCluster, home, centroid: null, countryCode: null })).toBe(
      'unknown',
    );
  });

  it('returns trip for foreign-country clusters even when geographically close', () => {
    expect(
      classifyCluster({
        cluster: baseCluster,
        home,
        centroid: { latitude: 19.5, longitude: 73.0 },
        countryCode: 'TH',
      }),
    ).toBe('trip');
  });

  it('returns trip when centroid is > 200km from home', () => {
    expect(
      classifyCluster({
        cluster: baseCluster,
        home,
        centroid: { latitude: 15.2993, longitude: 74.124 }, // Goa
        countryCode: 'IN',
      }),
    ).toBe('trip');
  });

  it('returns trip for 50–200km if multi-day or many photos', () => {
    // ~80km from Mumbai (Lonavla-ish)
    expect(
      classifyCluster({
        cluster: { ...baseCluster, durationDays: 2 },
        home,
        centroid: { latitude: 18.7546, longitude: 73.4062 },
        countryCode: 'IN',
      }),
    ).toBe('trip');
  });

  it('drops 50–200km single-day clusters with few photos', () => {
    expect(
      classifyCluster({
        cluster: { durationDays: 1, photos: baseCluster.photos.slice(0, 4) },
        home,
        centroid: { latitude: 18.7546, longitude: 73.4062 },
        countryCode: 'IN',
      }),
    ).toBe('drop');
  });

  it('drops sub-50km clusters (day-out at home)', () => {
    expect(
      classifyCluster({
        cluster: baseCluster,
        home,
        centroid: { latitude: 19.08, longitude: 72.9 },
        countryCode: 'IN',
      }),
    ).toBe('drop');
  });

  it('falls back to trip when no home is configured', () => {
    expect(
      classifyCluster({
        cluster: baseCluster,
        home: null,
        centroid: { latitude: 19.08, longitude: 72.9 },
        countryCode: null,
      }),
    ).toBe('trip');
  });
});

describe('splitClusterByLocationJumps', () => {
  it('splits a cluster when adjacent days are > 200km apart', () => {
    const day = 24 * 60 * 60 * 1000;
    const t0 = new Date('2025-11-15T10:00:00Z').getTime();
    const cluster: ProposedTrip = {
      id: 'c1',
      photos: [
        // Day 1: Mumbai
        { id: 'a', uri: 'a', creationTime: t0, location: { latitude: 19.076, longitude: 72.877 } },
        {
          id: 'b',
          uri: 'b',
          creationTime: t0 + 3600_000,
          location: { latitude: 19.08, longitude: 72.88 },
        },
        // Day 2: Goa
        {
          id: 'c',
          uri: 'c',
          creationTime: t0 + day,
          location: { latitude: 15.299, longitude: 74.124 },
        },
        {
          id: 'd',
          uri: 'd',
          creationTime: t0 + day + 3600_000,
          location: { latitude: 15.3, longitude: 74.13 },
        },
      ],
      startMs: t0,
      endMs: t0 + day + 3600_000,
      durationDays: 2,
      suggestedTitle: '15 Nov – 16 Nov 2025',
    };
    const split = splitClusterByLocationJumps(cluster);
    expect(split).toHaveLength(2);
    expect(split[0]?.photos.map((p) => p.id)).toEqual(['a', 'b']);
    expect(split[1]?.photos.map((p) => p.id)).toEqual(['c', 'd']);
  });

  it('returns the cluster unchanged when no day jump exceeds the threshold', () => {
    const day = 24 * 60 * 60 * 1000;
    const t0 = 0;
    const cluster: ProposedTrip = {
      id: 'c1',
      photos: [
        { id: 'a', uri: 'a', creationTime: t0, location: { latitude: 15.299, longitude: 74.124 } },
        {
          id: 'b',
          uri: 'b',
          creationTime: t0 + day,
          location: { latitude: 15.3, longitude: 74.13 },
        },
      ],
      startMs: t0,
      endMs: t0 + day,
      durationDays: 2,
      suggestedTitle: '1 Jan – 2 Jan 1970',
    };
    expect(splitClusterByLocationJumps(cluster)).toHaveLength(1);
  });
});
