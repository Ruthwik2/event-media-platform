'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Media, Comment, User, MediaTag } from '@/types';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/axios';
import {
  X, Heart, MessageCircle, Download, Bookmark, Share2,
  ChevronLeft, ChevronRight, Send, Trash2, MoreHorizontal,
  Tag, Search,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

const getFilenameFromDisposition = (disposition?: string, fallback?: string) => {
  if (!disposition) return fallback || 'download';
  const match = /filename\*=UTF-8''([^;]+)|filename="([^"]+)"|filename=([^;]+)/i.exec(disposition);
  const raw = match?.[1] || match?.[2] || match?.[3];
  if (!raw) return fallback || 'download';
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
};

const triggerDownload = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

interface Props {
  media: Media;
  allMedia: Media[];
  onClose: () => void;
  onNavigate: (media: Media) => void;
  // BUG FIX #2: callback so parent pages can remove the item from their local state
  // without needing a full page refresh.
  onDelete?: (id: string) => void;
}

export default function MediaLightbox({ media, allMedia, onClose, onNavigate, onDelete }: Props) {
  const { user } = useAuthStore();
  const [liked, setLiked] = useState(media.isLiked || false);
  const [likeCount, setLikeCount] = useState(media._count?.likes || 0);
  const [favourited, setFavourited] = useState(media.isFavourited || false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showTagModal, setShowTagModal] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [taggableUsers, setTaggableUsers] = useState<Partial<User>[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [taggingUserId, setTaggingUserId] = useState<string | null>(null);
  const [taggedUsers, setTaggedUsers] = useState<MediaTag[]>(media.taggedUsers || []);

  const currentIndex = allMedia.findIndex((m) => m.id === media.id);
  const canTag = !!user && (user.id === media.uploader?.id || user.role === 'ADMIN');

  // FIX: declare these with useCallback BEFORE the useEffect that depends on them
  const navigatePrev = useCallback(() => {
    if (currentIndex > 0) onNavigate(allMedia[currentIndex - 1]);
  }, [currentIndex, allMedia, onNavigate]);

  const navigateNext = useCallback(() => {
    if (currentIndex < allMedia.length - 1) onNavigate(allMedia[currentIndex + 1]);
  }, [currentIndex, allMedia, onNavigate]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') navigatePrev();
      if (e.key === 'ArrowRight') navigateNext();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [currentIndex, onClose, navigatePrev, navigateNext]);

  useEffect(() => {
    fetchComments();
    fetchTags();
    setLiked(media.isLiked || false);
    setLikeCount(media._count?.likes || 0);
    setFavourited(media.isFavourited || false);
  }, [media.id]);

  useEffect(() => {
    if (!showTagModal || !user) return;

    const timeout = setTimeout(() => {
      fetchTaggableUsers();
    }, 250);

    return () => clearTimeout(timeout);
  }, [showTagModal, userSearch, user]);

  const fetchComments = async () => {
    try {
      const res = await api.get(`/media/${media.id}/comments`);
      setComments(res.data.data || []);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchTags = async () => {
    try {
      const res = await api.get(`/media/${media.id}`);
      setTaggedUsers(res.data.data?.taggedUsers || []);
    } catch (error) {
      console.error(error);
    }
  };

  const handleLike = async () => {
    if (!user) { toast.error('Please login'); return; }
    try {
      const res = await api.post(`/media/${media.id}/like`);
      setLiked(res.data.liked);
      setLikeCount(res.data.count);
    } catch (error) {
      console.error(error);
    }
  };

  const handleFavourite = async () => {
    if (!user) { toast.error('Please login'); return; }
    try {
      const res = await api.post(`/media/${media.id}/favourite`);
      setFavourited(res.data.favourited);
      toast.success(res.data.favourited ? 'Added to favourites' : 'Removed from favourites');
    } catch (error) {
      console.error(error);
    }
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !user) return;
    try {
      const res = await api.post(`/media/${media.id}/comment`, { content: newComment });
      setComments([res.data.data, ...comments]);
      setNewComment('');
    } catch (error) {
      toast.error('Failed to post comment');
    }
  };

  const handleDownload = async () => {
    if (!user) { toast.error('Please login to download'); return; }
    try {
      const res = await api.get(`/media/${media.id}/download`, { responseType: 'blob' });
      const filename = getFilenameFromDisposition(
        res.headers['content-disposition'],
        media.originalName || 'download'
      );
      triggerDownload(res.data, filename);
      toast.success('Download started (watermarked)');
    } catch (error) {
      toast.error('Download failed');
    }
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/gallery?media=${media.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied to clipboard!');
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const fetchTaggableUsers = async () => {
    setLoadingUsers(true);
    try {
      const params = new URLSearchParams({ limit: '10' });
      if (userSearch.trim()) params.append('search', userSearch.trim());
      const res = await api.get(`/auth/users?${params.toString()}`);
      const users = (res.data.data || []).filter((candidate: Partial<User>) => candidate.id !== user?.id);
      setTaggableUsers(users);
    } catch (error) {
      toast.error('Failed to load users');
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleOpenTagModal = () => {
    if (!user) {
      toast.error('Please login to tag users');
      return;
    }
    setShowTagModal(true);
  };

  const handleTagUser = async (taggedUserId?: string) => {
    if (!taggedUserId) return;
    setTaggingUserId(taggedUserId);
    try {
      await api.post(`/media/${media.id}/tag`, { taggedUserId });
      toast.success('User tagged');
      setShowTagModal(false);
      setUserSearch('');
      fetchTags();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to tag user');
    } finally {
      setTaggingUserId(null);
    }
  };

  const handleUntag = async (taggedUserId: string) => {
    try {
      await api.delete(`/media/${media.id}/tag/${taggedUserId}`);
      toast.success('Tag removed');
      fetchTags();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to remove tag');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this media?')) return;
    try {
      await api.delete(`/media/${media.id}`);
      toast.success('Media deleted');
      // BUG FIX #2: notify parent to remove this item from its list so it
      // disappears immediately without needing a manual page refresh.
      onDelete?.(media.id);
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete');
    }
  };

  const canDelete = (user?.id === media.uploader?.id || user?.role === 'ADMIN') && user?.role !== 'CLUB_MEMBER';

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 flex" onClick={onClose}>
      <div className="flex w-full h-full" onClick={(e) => e.stopPropagation()}>
        {/* Main Image */}
        <div className="flex-1 relative flex items-center justify-center p-4">
          <button onClick={onClose} className="absolute top-4 right-4 z-10 p-2 bg-black/60 text-white rounded-full hover:bg-black/80 transition-colors">
            <X className="w-5 h-5" />
          </button>

          {currentIndex > 0 && (
            <button onClick={navigatePrev} className="absolute left-4 z-10 p-2 bg-black/60 text-white rounded-full hover:bg-black/80 transition-colors">
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
          {currentIndex < allMedia.length - 1 && (
            <button onClick={navigateNext} className="absolute right-4 z-10 p-2 bg-black/60 text-white rounded-full hover:bg-black/80 transition-colors">
              <ChevronRight className="w-6 h-6" />
            </button>
          )}

          {media.mediaType === 'VIDEO' ? (
            <video src={media.url} controls className="max-w-full max-h-full rounded-lg" />
          ) : (
            <img
              src={media.url}
              alt={media.originalName}
              className="max-w-full max-h-full object-contain rounded-lg"
            />
          )}
        </div>

        {/* Sidebar */}
        <motion.div
          initial={{ x: 300 }}
          animate={{ x: 0 }}
          className="w-80 bg-slate-900 border-l border-[#e7e3dd] flex flex-col h-full overflow-hidden"
        >
          <div className="p-4 border-b border-[#e7e3dd]">
            <Link href={media.uploader?.id ? `/users/${media.uploader.id}` : '#'} className="flex items-center gap-3 group">
              {media.uploader?.avatar ? (
                <img src={media.uploader.avatar} alt="" className="w-8 h-8 rounded-full" />
              ) : (
                <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-xs font-bold">
                  {media.uploader?.fullName?.[0] || '?'}
                </div>
              )}
              <div>
                <p className="text-sm font-medium group-hover:text-primary-400 transition-colors">{media.uploader?.fullName}</p>
                <p className="text-xs text-slate-500">
                  {formatDistanceToNow(new Date(media.createdAt), { addSuffix: true })}
                </p>
              </div>
            </Link>
            {media.caption && <p className="text-sm text-[#6b6560] mt-3">{media.caption}</p>}
            {media.tags && media.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {media.tags.map((tag) => (
                  <span key={tag} className="text-[10px] bg-[#f8f7f5] text-slate-400 px-1.5 py-0.5 rounded">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="p-3 border-b border-[#e7e3dd] flex items-center gap-1">
            <button
              onClick={handleLike}
              className={`p-2 rounded-lg transition-colors ${liked ? 'text-red-600 bg-red-50' : 'text-slate-400 hover:bg-[#f8f7f5]'}`}
            >
              <Heart className={`w-5 h-5 ${liked ? 'fill-current' : ''}`} />
            </button>
            <span className="text-xs text-slate-400 mr-2">{likeCount}</span>

            <button
              onClick={() => setShowComments(!showComments)}
              className="p-2 rounded-lg text-slate-400 hover:bg-[#f8f7f5] transition-colors"
            >
              <MessageCircle className="w-5 h-5" />
            </button>
            <span className="text-xs text-slate-400 mr-2">{comments.length}</span>

            <button
              onClick={handleFavourite}
              className={`p-2 rounded-lg transition-colors ${favourited ? 'text-amber-700 bg-amber-50' : 'text-slate-400 hover:bg-[#f8f7f5]'}`}
            >
              <Bookmark className={`w-5 h-5 ${favourited ? 'fill-current' : ''}`} />
            </button>

            <button onClick={handleShare} className="p-2 rounded-lg text-slate-400 hover:bg-[#f8f7f5] transition-colors">
              <Share2 className="w-5 h-5" />
            </button>

            <button onClick={handleDownload} className="p-2 rounded-lg text-slate-400 hover:bg-[#f8f7f5] transition-colors ml-auto">
              <Download className="w-5 h-5" />
            </button>

            {canDelete && (
              <div className="relative">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="p-2 rounded-lg text-slate-400 hover:bg-[#f8f7f5] transition-colors"
                >
                  <MoreHorizontal className="w-5 h-5" />
                </button>
                {showMenu && (
                  <div className="absolute right-0 top-10 card border border-[#e7e3dd] py-1 w-36 z-10">
                    <button
                      onClick={handleDelete}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-[#f8f7f5] w-full"
                    >
                      <Trash2 className="w-4 h-4" /> Delete
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {canTag && (
            <div className="p-3 border-b border-[#e7e3dd]">
              <button
                type="button"
                onClick={handleOpenTagModal}
                className="w-full flex items-center justify-center gap-2 rounded-lg border border-[#e7e3dd] px-3 py-2 text-sm text-[#6b6560] hover:bg-[#f8f7f5]"
              >
                <Tag className="w-4 h-4" />
                Tag People
              </button>
            </div>
          )}

          {/* Tagged people list */}
          {taggedUsers.length > 0 && (
            <div className="p-3 border-b border-[#e7e3dd]">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-2">
                <Tag className="w-3.5 h-3.5" /> Tagged
              </div>
              <div className="flex flex-wrap gap-1.5">
                {taggedUsers.map((mt) => {
                  const canRemove =
                    user?.role === 'ADMIN' ||
                    user?.id === media.uploader?.id ||
                    user?.id === mt.taggerUserId ||
                    user?.id === mt.taggedUserId;
                  return (
                    <span key={mt.id} className="inline-flex items-center gap-1.5 bg-[#f8f7f5] hover:bg-[#f0ede8] rounded-full pl-1 pr-2 py-0.5">
                      <Link href={`/users/${mt.taggedUser?.id}`} className="inline-flex items-center gap-1.5 group">
                        {mt.taggedUser?.avatar ? (
                          <img src={mt.taggedUser.avatar} alt="" className="w-5 h-5 rounded-full object-cover" />
                        ) : (
                          <span className="w-5 h-5 rounded-full bg-primary-600 text-white flex items-center justify-center text-[9px] font-bold">
                            {mt.taggedUser?.fullName?.[0] || mt.taggedUser?.username?.[0] || '?'}
                          </span>
                        )}
                        <span className="text-xs font-medium group-hover:text-primary-400 transition-colors">@{mt.taggedUser?.username}</span>
                      </Link>
                      {canRemove && (
                        <button onClick={() => handleUntag(mt.taggedUserId)} className="text-slate-400 hover:text-red-500 transition-colors" aria-label="Remove tag">
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Comments */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {comments.map((comment) => (
              <div key={comment.id} className="text-sm">
                <div className="flex items-start gap-2">
                  <Link href={comment.user?.id ? `/users/${comment.user.id}` : '#'} className="w-6 h-6 bg-[#f0ede8] rounded-full flex items-center justify-center text-[10px] flex-shrink-0">
                    {comment.user?.fullName?.[0]}
                  </Link>
                  <div>
                    <Link href={comment.user?.id ? `/users/${comment.user.id}` : '#'} className="font-medium text-xs hover:text-primary-400 transition-colors">{comment.user?.username}</Link>
                    <p className="text-[#6b6560] text-xs mt-0.5">{comment.content}</p>
                    <p className="text-[10px] text-slate-600 mt-1">
                      {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            {comments.length === 0 && (
              <p className="text-center text-slate-600 text-xs py-4">No comments yet</p>
            )}
          </div>

          {user && (
            <form onSubmit={handleComment} className="p-3 border-t border-[#e7e3dd]">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  className="input text-sm flex-1"
                />
                <button
                  type="submit"
                  disabled={!newComment.trim()}
                  className="p-2 text-primary-400 hover:bg-[#f8f7f5] rounded-lg disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}
        </motion.div>
      </div>

      {showTagModal && (
        <div className="absolute inset-0 z-[110] flex items-center justify-center bg-black/70 px-4">
          <div className="card w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold">Tag a person</h2>
                <p className="text-sm text-slate-400">Search for someone to tag in this photo</p>
              </div>
              <button
                type="button"
                onClick={() => setShowTagModal(false)}
                className="p-2 rounded-lg text-slate-400 hover:bg-[#f8f7f5]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative mb-4">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="input pl-10"
                placeholder="Search name or username"
                autoFocus
              />
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2">
              {loadingUsers ? (
                <div className="py-8 text-center text-sm text-slate-400">Loading users...</div>
              ) : taggableUsers.length > 0 ? (
                taggableUsers.map((candidate) => (
                  <button
                    key={candidate.id}
                    type="button"
                    onClick={() => handleTagUser(candidate.id)}
                    disabled={taggingUserId === candidate.id}
                    className="w-full flex items-center gap-3 rounded-lg border border-[#e7e3dd] p-3 text-left hover:bg-[#f8f7f5] disabled:opacity-60"
                  >
                    {candidate.avatar ? (
                      <img src={candidate.avatar} alt="" className="w-9 h-9 rounded-full" />
                    ) : (
                      <div className="w-9 h-9 bg-primary-600 rounded-full flex items-center justify-center text-sm font-bold">
                        {candidate.fullName?.[0] || candidate.username?.[0] || '?'}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{candidate.fullName || candidate.username}</p>
                      <p className="text-xs text-slate-500 truncate">@{candidate.username}</p>
                    </div>
                    <span className="text-xs text-primary-400">
                      {taggingUserId === candidate.id ? 'Tagging...' : 'Tag'}
                    </span>
                  </button>
                ))
              ) : (
                <div className="py-8 text-center text-sm text-slate-500">No users found</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
