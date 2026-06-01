const prisma = require('../config/database');
const { sendNotification } = require('../config/socket');
const createNotification = async ({
type,
message,
recipientId,
senderId,
mediaId,
eventId,
}) => {
try {
if (recipientId === senderId) return;
const notification = await prisma.notification.create({
data: { type, message, recipientId, senderId, mediaId, eventId },
include: {
sender: {
select: { id: true, username: true, fullName: true, avatar: true },
},
},
});
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
/**
* Notify all admin users when a photographer requests access to a private
* event or album.
*/
const notifyAccessRequest = async (requesterId, targetId, targetType, targetName) => {
try {
const requester = await prisma.user.findUnique({
where: { id: requesterId },
select: { fullName: true, username: true },
});
if (!requester) return;
const admins = await prisma.user.findMany({
where: { role: 'ADMIN' },
select: { id: true },
});
const typeName = targetType === 'ALBUM' ? 'album' : 'event';
const message = `${requester.fullName} requested access to private ${typeName}: "${targetName}"`;
for (const admin of admins) {
await createNotification({
type: 'ACCESS_REQUEST',
message,
recipientId: admin.id,
senderId: requesterId,
eventId: targetType === 'EVENT' ? targetId : undefined,
});
}
} catch (error) {
console.error('Error notifying access request:', error);
}
};
/**
* Notify the photographer when their access request is approved or rejected.
*/
const notifyAccessResponse = async (
adminId,
photographerId,
targetId,
targetType,
status
) => {
try {
const typeName = targetType === 'ALBUM' ? 'album' : 'event';
const statusText = status === 'APPROVED' ? 'approved' : 'rejected';
const message = `Your access request for the private ${typeName} has been ${statusText}`;
await createNotification({
type: status === 'APPROVED' ? 'ACCESS_APPROVED' : 'ACCESS_REJECTED',
message,
recipientId: photographerId,
senderId: adminId,
eventId: targetType === 'EVENT' ? targetId : undefined,
});
} catch (error) {
console.error('Error notifying access response:', error);
}
};
module.exports = {
createNotification,
notifyLike,
notifyComment,
notifyTag,
notifyAccessRequest,
notifyAccessResponse,
};