const prisma = require('../config/database');
const { sendNotification } = require('../config/socket');

const createNotification = async ({ type, message, recipientId, senderId, mediaId, eventId }) => {
  try {
    if (recipientId === senderId) return; // Don't notify yourself

    const notification = await prisma.notification.create({
      data: {
        type,
        message,
        recipientId,
        senderId,
        mediaId,
        eventId,
      },
      include: {
        sender: {
          select: { id: true, username: true, fullName: true, avatar: true },
        },
      },
    });

    // Send real-time notification
    sendNotification(recipientId, notification);

    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
  }
};

const notifyLike = async (senderId, mediaId, mediaOwnerId) => {
  const sender = await prisma.user.findUnique({
    where: { id: senderId },
    select: { fullName: true, username: true },
  });

  await createNotification({
    type: 'LIKE',
    message: `${sender.fullName} liked your photo`,
    recipientId: mediaOwnerId,
    senderId,
    mediaId,
  });
};

const notifyComment = async (senderId, mediaId, mediaOwnerId, commentPreview) => {
  const sender = await prisma.user.findUnique({
    where: { id: senderId },
    select: { fullName: true, username: true },
  });

  await createNotification({
    type: 'COMMENT',
    message: `${sender.fullName} commented: "${commentPreview.substring(0, 50)}"`,
    recipientId: mediaOwnerId,
    senderId,
    mediaId,
  });
};

const notifyTag = async (senderId, mediaId, taggedUserId) => {
  const sender = await prisma.user.findUnique({
    where: { id: senderId },
    select: { fullName: true, username: true },
  });

  await createNotification({
    type: 'TAG',
    message: `${sender.fullName} tagged you in a photo`,
    recipientId: taggedUserId,
    senderId,
    mediaId,
  });
};

module.exports = { createNotification, notifyLike, notifyComment, notifyTag };