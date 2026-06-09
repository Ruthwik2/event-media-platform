// ── Media / album access-control helpers ──────────────────────────────────────
// Pure functions (no DB, no I/O) so they are trivially unit-testable and can be
// reused by any controller that needs to gate access consistently.

/**
 * Determines whether a requesting user may access a given album.
 *
 * Rules:
 *  ADMIN       – always allowed
 *  CLUB_MEMBER – always allowed (public and private albums)
 *  PHOTOGRAPHER – public albums always; private albums only if they are the
 *                 event creator OR a collaborator on the album
 *  VIEWER / unauthenticated – public albums only
 */
function canAccessAlbum(user, album) {
  // ── Step 1: check parent event visibility ──────────────────────────────────
  const eventIsPrivate = album.event && album.event.visibility === 'PRIVATE';
  if (eventIsPrivate) {
    if (!user) return false;
    if (user.role === 'ADMIN' || user.role === 'CLUB_MEMBER') return true;
    if (user.role === 'PHOTOGRAPHER') {
      const isEventCreator = album.event.creatorId === user.id;
      const collaborators = album.collaborators || [];
      const isCollaborator = collaborators.some(
        (c) => (c.userId || (c.user && c.user.id)) === user.id
      );
      return isEventCreator || isCollaborator;
    }
    return false; // VIEWER — blocked by private event
  }

  // ── Step 2: event is public (or event info unavailable) — check album level
  if (album.visibility === 'PUBLIC') return true;
  // album is PRIVATE from here
  if (!user) return false;
  if (user.role === 'ADMIN' || user.role === 'CLUB_MEMBER') return true;
  if (user.role === 'PHOTOGRAPHER') {
    const isEventCreator = album.event && album.event.creatorId === user.id;
    const collaborators = album.collaborators || [];
    const isCollaborator = collaborators.some(
      (c) => (c.userId || (c.user && c.user.id)) === user.id
    );
    return isEventCreator || isCollaborator;
  }
  return false; // VIEWER
}

/**
 * Determines whether a requesting user may access a given media item.
 *
 * Rules:
 *  ADMIN / CLUB_MEMBER – always allowed
 *  PHOTOGRAPHER        – always allowed for public media;
 *                        for private media only if they uploaded it;
 *                        media inside a private album follows album rules
 *  VIEWER / unauthenticated – public media only, and only in public albums
 */
function canAccessMedia(user, media) {
  const album = media.album || null;

  // If the parent album is private, apply album-level check first
  if (album && album.visibility === 'PRIVATE') {
    if (!canAccessAlbum(user, album)) return false;
  }

  // Now check media-level visibility
  if (media.visibility === 'PUBLIC') return true;
  // media is PRIVATE from here
  if (!user) return false;
  if (user.role === 'ADMIN' || user.role === 'CLUB_MEMBER') return true;
  if (user.role === 'PHOTOGRAPHER') return media.uploaderId === user.id;
  return false; // VIEWER
}

/**
 * Builds the Prisma `where` clause that restricts a media query to only the
 * items the given user is allowed to see. Returns `null` for ADMIN / CLUB_MEMBER
 * (they see everything → no filter), or an object suitable for spreading into a
 * Prisma `where`.
 */
function mediaVisibilityWhere(user) {
  if (!user || user.role === 'VIEWER') {
    return {
      visibility: 'PUBLIC',
      album: { visibility: 'PUBLIC', event: { visibility: 'PUBLIC' } },
    };
  }
  if (user.role === 'PHOTOGRAPHER') {
    return {
      OR: [
        { visibility: 'PUBLIC', album: { visibility: 'PUBLIC', event: { visibility: 'PUBLIC' } } },
        { album: { event: { creatorId: user.id } } },
        { album: { collaborators: { some: { userId: user.id } } } },
        { uploaderId: user.id },
      ],
    };
  }
  // ADMIN and CLUB_MEMBER: no restriction.
  return null;
}

module.exports = { canAccessAlbum, canAccessMedia, mediaVisibilityWhere };
