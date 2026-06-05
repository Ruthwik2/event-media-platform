export type Role = 'ADMIN' | 'PHOTOGRAPHER' | 'CLUB_MEMBER' | 'VIEWER';
export type MediaType = 'PHOTO' | 'VIDEO';
export type Visibility = 'PUBLIC' | 'PRIVATE';
export type AccessRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type AccessRequestType = 'EVENT' | 'ALBUM';
export interface User {
id: string;
email?: string | null;
username: string;
fullName: string;
role: Role;
isApproved?: boolean;
/** Admin-only: true when this Viewer has a pending Club Member upgrade request */
pendingClubRequest?: boolean;
avatar?: string;
bio?: string;
referenceSelfie?: string;
faceId?: string;
showEmail?: boolean;
allowTagging?: boolean;
publicProfile?: boolean;
createdAt: string;
_count?: { mediaUploads: number; events: number };
}
export interface Event {
id: string;
name: string;
description?: string;
category: string;
coverImage?: string;
startDate: string;
endDate?: string;
location?: string;
visibility: Visibility;
creator: Partial<User>;
createdAt: string;
_count?: { albums: number };
}
export interface Album {
id: string;
name: string;
description?: string;
coverImage?: string;
visibility: Visibility;
eventId: string;
event?: Partial<Event>;
qrCode?: string;
createdAt: string;
_count?: { media: number };
}
export interface Media {
id: string;
filename: string;
originalName: string;
mimeType: string;
size: number;
url: string;
thumbnailUrl?: string;
mediaType: MediaType;
width?: number;
height?: number;
visibility: Visibility;
caption?: string;
aiCaption?: string;
tags: string[];
albumId: string;
album?: Partial<Album>;
uploader: Partial<User>;
createdAt: string;
isLiked?: boolean;
isFavourited?: boolean;
_count?: { likes: number; comments: number; downloads: number };
}
export interface Comment {
id: string;
content: string;
user: Partial<User>;
mediaId: string;
parentId?: string;
replies?: Comment[];
createdAt: string;
}
export interface Notification {
id: string;
type: string;
message: string;
isRead: boolean;
recipientId: string;
sender?: Partial<User>;
mediaId?: string;
eventId?: string;
createdAt: string;
}
export interface AccessRequest {
id: string;
userId: string;
targetId: string;
type: AccessRequestType;
status: AccessRequestStatus;
createdAt: string;
updatedAt: string;
user?: Partial<User>;
/** Enriched on the server: the event or album object */
target?: {
id: string;
name: string;
event?: { id: string; name: string };
} | null;
targetType?: AccessRequestType;
}
export interface PaginatedResponse<T> {
success: boolean;
data: T[];
pagination: {
total: number;
page: number;
limit: number;
totalPages?: number;
};
}
export interface ApiResponse<T> {
success: boolean;
message?: string;
data: T;
}
