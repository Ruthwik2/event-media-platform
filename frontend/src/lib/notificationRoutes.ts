import { Notification, User } from '@/types';

export const getNotificationHref = (
  notification: Notification,
  user?: Partial<User> | null
) => {
  if (notification.mediaId) {
    return `/media/${notification.mediaId}`;
  }

  if (notification.type === 'ACCESS_REQUEST' && user?.role === 'ADMIN') {
    return '/admin/access-requests?tab=media';
  }

  if (
    (notification.type === 'ACCESS_APPROVED' ||
      notification.type === 'ACCESS_REJECTED') &&
    notification.eventId
  ) {
    return `/events/${notification.eventId}`;
  }

  // Membership request: admin clicks → goes to access requests to approve
  if (notification.type === 'MEMBERSHIP_REQUEST' && user?.role === 'ADMIN') {
    return '/admin/access-requests';
  }

  // Membership approved/rejected: member clicks → goes to their profile
  if (
    notification.type === 'MEMBERSHIP_APPROVED' ||
    notification.type === 'MEMBERSHIP_REJECTED'
  ) {
    return '/profile';
  }

  return null;
};
