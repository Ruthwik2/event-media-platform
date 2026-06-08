'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/axios';
import { useAuthStore } from '@/store/authStore';
import { Media, Comment, User } from '@/types';
import {
  ArrowLeft, Heart, MessageCircle, Download, Bookmark,
  Share2, Tag, MoreHorizontal, Trash2, Search, X,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { motion } from 'framer-motion';
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

export default function MediaDetailPage() {
  const { id } = useParams();
  const { user } = useAuthStore();
  const router = useRouter();
  const [media, setMedia] = useState<Media | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [favourited, setFavourited] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [showTagModal, setShowTagModal] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [taggableUsers, setTaggableUsers] = useState<Partial<User>[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [taggingUserId, setTaggingUserId] = useState<string | null>(null);

  useEffect(() => {
    fetchMedia();
    fetchComments();
  }, [id]);

  useEffect(() => {
    if (!showTagModal || !user) return;

    const timeout = setTimeout(() => {
      fetchTaggableUsers();
    }, 250);

    return () => clearTimeout(timeout);
  }, [showTagModal, userSearch, user]);

  const fetchMedia = async () => {
    try {
      const res = await api.get(`/media/${id}`);
      setMedia(res.data.data);
      setLiked(res.data.data.isLiked || false);
      setLikeCount(res.data.data._count?.likes || 0);
      setFavourited(res.data.data.isFavourited || false);
    } catch (error) {
      toast.error('Media not found');
      router.push('/gallery');
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    try {
      const res = await api.get(`/media/${id}/comments`);
      setComments(res.data.data || []);
    } catch (error) {
      console.error(error);
    }
  };

  const handleLike = async () => {
    if (!user) { toast.error('Please login'); return; }
    try {
      const res = await api.post(`/media/${id}/like`);
      setLiked(res.data.liked);
      setLikeCount(res.data.count);
    } catch (error) {
      console.error(error);
    }
  };

  const handleFavourite = async () => {
    if (!user) { toast.error('Please login'); return; }
    try {
      const res = await api.post(`/media/${id}/favourite`);
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
      const res = await api.post(`/media/${id}/comment`, { content: newComment });
      setComments([res.data.data, ...comments]);
      setNewComment('');
    } catch (error) {
      toast.error('Failed to post comment');
    }
  };

  const handleDownload = async () => {
    if (!user) { toast.error('Please login to download'); return; }
    try {
      const res = await api.get(`/media/${id}/download`, { responseType: 'blob' });
      const filename = getFilenameFromDisposition(
        res.headers['content-disposition'],
        media?.originalName || 'download'
      );
      triggerDownload(res.data, filename);
      toast.success('Download started');
    } catch (error) {
      toast.error('Download failed');
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
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
      await api.post(`/media/${id}/tag`, { taggedUserId });
      toast.success('User tagged');
      setShowTagModal(false);
      setUserSearch('');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to tag user');
    } finally {
      setTaggingUserId(null);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this media?')) return;
    try {
      await api.delete(`/media/${id}`);
      toast.success('Media deleted');
      router.push('/gallery');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete');
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="aspect-video bg-[#f8f7f5] rounded-xl animate-pulse" />
        <div className="h-8 w-1/3 bg-[#f8f7f5] rounded animate-pulse" />
      </div>
    );
  }

  if (!media) return null;

  const canDelete = (user?.id === media.uploader?.id || user?.role === 'ADMIN') && user?.role !== 'CLUB_MEMBER';

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Link href="/gallery" className="flex items-center gap-2 text-slate-400 hover:text-[#2a2724]">
        <ArrowLeft className="w-4 h-4" /> Back to Gallery
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Media Display */}
        <div className="lg:col-span-2">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="card overflow-hidden"
          >
            {media.mediaType === 'VIDEO' ? (
              <video src={media.url} controls className="w-full" />
            ) : (
              <img src={media.url} alt={media.originalName} className="w-full" />
            )}
          </motion.div>

          {/* Actions */}
          <div className="card p-4 mt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <button
                  onClick={handleLike}
                  className={`p-2 rounded-lg transition-colors ${
                    liked ? 'text-red-400 bg-red-900/20' : 'text-slate-400 hover:bg-[#f8f7f5]'
                  }`}
                >
                  <Heart className={`w-5 h-5 ${liked ? 'fill-current' : ''}`} />
                </button>
                <span className="text-sm text-slate-400">{likeCount}</span>

                <button
                  onClick={() => document.getElementById('comment-input')?.focus()}
                  className="p-2 rounded-lg text-slate-400 hover:bg-[#f8f7f5] ml-2"
                >
                  <MessageCircle className="w-5 h-5" />
                </button>
                <span className="text-sm text-slate-400">{comments.length}</span>

                <button
                  onClick={handleFavourite}
                  className={`p-2 rounded-lg transition-colors ml-2 ${
                    favourited ? 'text-yellow-400 bg-yellow-900/20' : 'text-slate-400 hover:bg-[#f8f7f5]'
                  }`}
                >
                  <Bookmark className={`w-5 h-5 ${favourited ? 'fill-current' : ''}`} />
                </button>
              </div>

              <div className="flex items-center gap-1">
                <button onClick={handleShare} className="p-2 rounded-lg text-slate-400 hover:bg-[#f8f7f5]">
                  <Share2 className="w-5 h-5" />
                </button>
                <button onClick={handleDownload} className="p-2 rounded-lg text-slate-400 hover:bg-[#f8f7f5]">
                  <Download className="w-5 h-5" />
                </button>
                <button
                  onClick={handleOpenTagModal}
                  className="flex items-center gap-2 rounded-lg border border-[#e7e3dd] px-3 py-2 text-sm text-[#6b6560] hover:bg-[#f8f7f5]"
                >
                  <Tag className="w-4 h-4" />
                  Tag User
                </button>
                {canDelete && (
                  <div className="relative">
                    <button
                      onClick={() => setShowMenu(!showMenu)}
                      className="p-2 rounded-lg text-slate-400 hover:bg-[#f8f7f5]"
                    >
                      <MoreHorizontal className="w-5 h-5" />
                    </button>
                    {showMenu && (
                      <div className="absolute right-0 top-10 card border border-[#e7e3dd] py-1 w-36 z-10">
                        <button
                          onClick={handleDelete}
                          className="flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-[#f8f7f5] w-full"
                        >
                          <Trash2 className="w-4 h-4" /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Info */}
          <div className="card p-4">
            <Link
              href={media.uploader?.id ? `/users/${media.uploader.id}` : '#'}
              className="flex items-center gap-3 mb-4 group"
            >
              {media.uploader?.avatar ? (
                <img src={media.uploader.avatar} alt="" className="w-10 h-10 rounded-full" />
              ) : (
                <div className="w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center font-bold">
                  {media.uploader?.fullName?.[0] || '?'}
                </div>
              )}
              <div>
                <p className="font-medium group-hover:text-primary-400 transition-colors">{media.uploader?.fullName}</p>
                <p className="text-xs text-slate-500">@{media.uploader?.username}</p>
              </div>
            </Link>

            {media.caption && (
              <p className="text-sm text-[#6b6560] mb-3">{media.caption}</p>
            )}

            {media.tags && media.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {media.tags.map((tag) => (
                  <Link
                    key={tag}
                    href={`/search?tags=${tag}`}
                    className="text-xs bg-[#f8f7f5] text-slate-400 px-2 py-1 rounded hover:bg-[#f0ede8]"
                  >
                    #{tag}
                  </Link>
                ))}
              </div>
            )}

            <div className="text-xs text-slate-500 space-y-1">
              <p>Uploaded {formatDistanceToNow(new Date(media.createdAt), { addSuffix: true })}</p>
              <p>{format(new Date(media.createdAt), 'PPP')}</p>
              {media.album && (
                <p>
                  Album:{' '}
                  <Link href={`/albums/${media.albumId}`} className="text-primary-400 hover:underline">
                    {media.album.name}
                  </Link>
                </p>
              )}
            </div>
          </div>

          {/* Comments */}
          <div className="card p-4">
            <h3 className="font-medium mb-3">Comments ({comments.length})</h3>

            {user && (
              <form onSubmit={handleComment} className="mb-4">
                <div className="flex gap-2">
                  <input
                    id="comment-input"
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Add a comment..."
                    className="input text-sm flex-1"
                  />
                  <button type="submit" disabled={!newComment.trim()} className="btn-primary text-sm">
                    Post
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {comments.map((comment) => (
                <div key={comment.id} className="text-sm">
                  <div className="flex items-start gap-2">
                    <Link href={comment.user?.id ? `/users/${comment.user.id}` : '#'} className="w-6 h-6 bg-[#f0ede8] rounded-full flex items-center justify-center text-[10px] flex-shrink-0">
                      {comment.user?.fullName?.[0]}
                    </Link>
                    <div>
                      <Link href={comment.user?.id ? `/users/${comment.user.id}` : '#'} className="font-medium text-xs hover:text-primary-400 transition-colors">{comment.user?.username}</Link>
                      <p className="text-[#6b6560] text-xs">{comment.content}</p>
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
          </div>
        </div>
      </div>

      {showTagModal && (
        <div className="modal-backdrop">
          <div className="glass-panel w-full max-w-md p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold">Tag User</h2>
                <p className="text-sm text-slate-400">Search for a user to tag in this media</p>
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
