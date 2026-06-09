const {
  canAccessAlbum,
  canAccessMedia,
  mediaVisibilityWhere,
} = require('../src/utils/permissions');

const admin = { id: 'a1', role: 'ADMIN' };
const clubMember = { id: 'c1', role: 'CLUB_MEMBER' };
const photographer = { id: 'p1', role: 'PHOTOGRAPHER' };
const viewer = { id: 'v1', role: 'VIEWER' };

describe('canAccessAlbum', () => {
  const publicEvent = { visibility: 'PUBLIC', creatorId: 'p1' };
  const privateEvent = { visibility: 'PRIVATE', creatorId: 'p1' };

  test('public album in public event is visible to everyone, including anon', () => {
    const album = { visibility: 'PUBLIC', event: publicEvent };
    expect(canAccessAlbum(null, album)).toBe(true);
    expect(canAccessAlbum(viewer, album)).toBe(true);
    expect(canAccessAlbum(photographer, album)).toBe(true);
  });

  test('private album in public event hides from anon and viewers', () => {
    const album = { visibility: 'PRIVATE', event: publicEvent, collaborators: [] };
    expect(canAccessAlbum(null, album)).toBe(false);
    expect(canAccessAlbum(viewer, album)).toBe(false);
  });

  test('admins and club members always see private albums', () => {
    const album = { visibility: 'PRIVATE', event: privateEvent, collaborators: [] };
    expect(canAccessAlbum(admin, album)).toBe(true);
    expect(canAccessAlbum(clubMember, album)).toBe(true);
  });

  test('private event blocks viewers even when album is public', () => {
    const album = { visibility: 'PUBLIC', event: privateEvent, collaborators: [] };
    expect(canAccessAlbum(viewer, album)).toBe(false);
    expect(canAccessAlbum(null, album)).toBe(false);
  });

  test('photographer who created the private event can enter', () => {
    const album = { visibility: 'PUBLIC', event: privateEvent, collaborators: [] };
    expect(canAccessAlbum(photographer, album)).toBe(true);
  });

  test('photographer who is NOT creator/collaborator is blocked from private event', () => {
    const other = { id: 'p2', role: 'PHOTOGRAPHER' };
    const album = { visibility: 'PUBLIC', event: privateEvent, collaborators: [] };
    expect(canAccessAlbum(other, album)).toBe(false);
  });

  test('photographer approved for the private event can enter ALL albums inside (public or private)', () => {
    const other = { id: 'p2', role: 'PHOTOGRAPHER' };
    const publicAlbum = { visibility: 'PUBLIC', event: privateEvent, collaborators: [] };
    const privateAlbum = { visibility: 'PRIVATE', event: privateEvent, collaborators: [] };
    // hasEventAccess = true (admin approved their event request) → no per-album request
    expect(canAccessAlbum(other, publicAlbum, true)).toBe(true);
    expect(canAccessAlbum(other, privateAlbum, true)).toBe(true);
  });

  test('without event access, photographer is still blocked from a private event', () => {
    const other = { id: 'p2', role: 'PHOTOGRAPHER' };
    const publicAlbum = { visibility: 'PUBLIC', event: privateEvent, collaborators: [] };
    const privateAlbum = { visibility: 'PRIVATE', event: privateEvent, collaborators: [] };
    expect(canAccessAlbum(other, publicAlbum)).toBe(false);
    expect(canAccessAlbum(other, privateAlbum)).toBe(false);
  });

  test('photographer who is a collaborator can enter a private album', () => {
    const other = { id: 'p2', role: 'PHOTOGRAPHER' };
    const album = {
      visibility: 'PRIVATE',
      event: publicEvent,
      collaborators: [{ userId: 'p2' }],
    };
    expect(canAccessAlbum(other, album)).toBe(true);
  });

  test('collaborator matching works with nested user object shape', () => {
    const other = { id: 'p2', role: 'PHOTOGRAPHER' };
    const album = {
      visibility: 'PRIVATE',
      event: publicEvent,
      collaborators: [{ user: { id: 'p2' } }],
    };
    expect(canAccessAlbum(other, album)).toBe(true);
  });
});

describe('canAccessMedia', () => {
  const publicAlbum = { visibility: 'PUBLIC', event: { visibility: 'PUBLIC', creatorId: 'p1' } };

  test('public media in public album visible to anon', () => {
    const media = { visibility: 'PUBLIC', album: publicAlbum, uploaderId: 'p1' };
    expect(canAccessMedia(null, media)).toBe(true);
  });

  test('private media hidden from viewers and anon', () => {
    const media = { visibility: 'PRIVATE', album: publicAlbum, uploaderId: 'p1' };
    expect(canAccessMedia(null, media)).toBe(false);
    expect(canAccessMedia(viewer, media)).toBe(false);
  });

  test('photographer sees own private media but not others', () => {
    const own = { visibility: 'PRIVATE', album: publicAlbum, uploaderId: 'p1' };
    const others = { visibility: 'PRIVATE', album: publicAlbum, uploaderId: 'pX' };
    expect(canAccessMedia(photographer, own)).toBe(true);
    expect(canAccessMedia(photographer, others)).toBe(false);
  });

  test('admin and club member see all private media', () => {
    const media = { visibility: 'PRIVATE', album: publicAlbum, uploaderId: 'pX' };
    expect(canAccessMedia(admin, media)).toBe(true);
    expect(canAccessMedia(clubMember, media)).toBe(true);
  });

  test('media inside a private album is gated by album rules first', () => {
    const privateAlbum = { visibility: 'PRIVATE', event: { visibility: 'PUBLIC' }, collaborators: [] };
    const media = { visibility: 'PUBLIC', album: privateAlbum, uploaderId: 'p1' };
    // Public media but private album → viewers blocked
    expect(canAccessMedia(viewer, media)).toBe(false);
    // Admin still allowed
    expect(canAccessMedia(admin, media)).toBe(true);
  });
});

describe('mediaVisibilityWhere', () => {
  test('admin and club member get no filter (null)', () => {
    expect(mediaVisibilityWhere(admin)).toBeNull();
    expect(mediaVisibilityWhere(clubMember)).toBeNull();
  });

  test('anonymous and viewers are restricted to fully-public chain', () => {
    const expected = {
      visibility: 'PUBLIC',
      album: { visibility: 'PUBLIC', event: { visibility: 'PUBLIC' } },
    };
    expect(mediaVisibilityWhere(null)).toEqual(expected);
    expect(mediaVisibilityWhere(viewer)).toEqual(expected);
  });

  test('photographer filter includes own uploads and owned/collaborated content', () => {
    const where = mediaVisibilityWhere(photographer);
    expect(Array.isArray(where.OR)).toBe(true);
    expect(where.OR).toContainEqual({ uploaderId: 'p1' });
    expect(where.OR).toContainEqual({ album: { event: { creatorId: 'p1' } } });
  });
});
