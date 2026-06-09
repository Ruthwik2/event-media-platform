// ── Access-request lookups (DB-backed) ────────────────────────────────────────
// Kept separate from utils/permissions.js so that file stays pure/unit-testable.
const prisma = require('../config/database');

/**
 * Returns true when a PHOTOGRAPHER has an APPROVED access request for the given
 * event. Used so that once an admin approves a photographer for a private event,
 * the PUBLIC albums inside it open up automatically — they only need a fresh
 * request for the PRIVATE albums. Other roles never rely on this (admins/club
 * members are allowed earlier; viewers are never granted event access), so we
 * short-circuit to avoid a needless query.
 */
async function hasApprovedEventAccess(user, eventId) {
  if (!user || user.role !== 'PHOTOGRAPHER' || !eventId) return false;
  const request = await prisma.accessRequest.findUnique({
    where: {
      userId_targetId_type: { userId: user.id, targetId: eventId, type: 'EVENT' },
    },
    select: { status: true },
  });
  return request?.status === 'APPROVED';
}

module.exports = { hasApprovedEventAccess };
