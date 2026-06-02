import { Notification, User } from '@/types';

export const getNotificationHref = (
  notification: Notification,
  user?: Partial<User> | null
) => {
  if (notification.mediaId) {
    return `/media/${notification.mediaId}`;
  }

  if (notification.type === 'ACCESS_REQUEST' && user?.role === 'ADMIN') {
    return '/admin/access-requests';
  }

  if (
    (notification.type === 'ACCESS_APPROVED' ||
      notification.type === 'ACCESS_REJECTED') &&
    notification.eventId
  ) {
    return `/events/${notification.eventId}`;
  }

  return null;
};
