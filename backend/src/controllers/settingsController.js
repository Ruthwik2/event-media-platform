const prisma = require('../config/database');

/**
 * GET /api/settings/club
 * Public — anyone can read the club name (needed for the homepage banner
 * and for embedding in watermarks).
 */
const getClubSettings = async (req, res) => {
  try {
    const settings = await prisma.clubSettings.findUnique({
      where: { id: 'singleton' },
    });

    res.json({
      success: true,
      data: {
        clubName: settings?.clubName || null,
        isConfigured: !!settings?.clubName,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PUT /api/settings/club
 * Admin only — create or update the club name.
 */
const updateClubSettings = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const { clubName } = req.body;

    if (!clubName || typeof clubName !== 'string' || !clubName.trim()) {
      return res.status(400).json({ success: false, message: 'clubName is required' });
    }

    const settings = await prisma.clubSettings.upsert({
      where: { id: 'singleton' },
      update: { clubName: clubName.trim() },
      create: { id: 'singleton', clubName: clubName.trim() },
    });

    res.json({
      success: true,
      data: { clubName: settings.clubName },
      message: 'Club settings saved',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getClubSettings, updateClubSettings };