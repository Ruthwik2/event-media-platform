'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import api from '@/lib/axios';
import { Media, Comment } from '@/types';
import { useAuthStore } from '@/store/authStore';
import {
  Search, X, Heart, MessageCircle, Bookmark,
  Send, Play, Film, Camera, Download, Tag,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import InfiniteScroll from 'react-infinite-scroll-component';
import toast from 'react-hot-toast';

const LIMIT = 12;

/* ─── Skeleton post ─────────────────────────────────────── */
function SkeletonPost() {
  return (
    <div className="bg-slate-900 border border-[#e7e3dd] rounded-xl overflow-hidden animate-pulse">
      {/* header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="w-9 h-9 rounded-full bg-[#f8f7f5]" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3 bg-[#f8f7f5] rounded w-28" />
          <div className="h-2.5 bg-[#f8f7f5] rounded w-16" />
        </div>
      </div>
      {/* image */}
      <div className="aspect-square bg-[#f8f7f5]" />
      {/* actions */}
      <div className="px-4 py-3 space-y-2">
        <div className="flex gap-3">
          <div className="w-6 h-6 bg-[#f8f7f5] rounded" />
          <div className="w-6 h-6 bg-[#f8f7f5] rounded" />
          <div className="w-6 h-6 bg-[#f8f7f5] rounded" />
        </div>
        <div className="h-3 bg-[#f8f7f5] rounded w-20" />
        <div className="h-3 bg-[#f8f7f5] rounded w-48" />
      </div>
    </div>
  );
}

/* ─── Avatar helper ─────────────────────────────────────── */
function Avatar({ src, name, size = 'md' }: { src?: string; name?: string; size?: 'sm' | 'md' }) {
  const [err, setErr] = useState(false);
  const cls = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm';
  const initials = (name || '?').charAt(0).toUpperCase();
  return err || !src ? (
    <div className={`${cls} rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white font-semibold flex-shrink-0`}>
      {initials}
    </div>
  ) : (
    <img src={src} alt={name} className={`${cls} rounded-full object-cover flex-shrink-0`} onError={() => setErr(true)} />
  );
}

/* ─── Single Post ───────────────────────────────────────── */
interface PostProps {
  media: Media;
  onDelete: (id: string) => void;
}

function InstagramPost({ media, onDelete }: PostProps) {
  const { user } = useAuthStore();
  const isVideo = media.mediaType === 'VIDEO';
  const [imgError, setImgError] = useState(false);
  const [liked, setLiked] = useState(media.isLiked || false);
  const [likeCount, setLikeCount] = useState(media._count?.likes || 0);
  const [saved, setSaved] = useState(media.isFavourited || false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [heartAnim, setHeartAnim] = useState(false);
  const commentInputRef = useRef<HTMLInputElement>(null);

  const src = media.thumbnailUrl || media.url;
  const uploaderName = media.uploader?.fullName || media.uploader?.username || 'Unknown';
  const uploaderUsername = media.uploader?.username || 'unknown';
  const timeAgo = formatDistanceToNow(new Date(media.createdAt), { addSuffix: true });
  const caption = media.caption || media.aiCaption || '';
  const captionLong = caption.length > 100;

  // Load comments lazily
  const loadComments = useCallback(async () => {
    if (commentsLoaded) return;
    try {
      const res = await api.get(`/media/${media.id}/comments`);
      setComments(res.data.data || []);
      setCommentsLoaded(true);
    } catch { /* silent */ }
  }, [media.id, commentsLoaded]);

  const toggleComments = () => {
    if (!showComments) loadComments();
    setShowComments((v) => !v);
  };

  const handleLike = async () => {
    if (!user) { toast.error('Please login to like'); return; }
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikeCount((c) => c + (wasLiked ? -1 : 1));
    if (!wasLiked) { setHeartAnim(true); setTimeout(() => setHeartAnim(false), 700); }
    try {
      await api.post(`/media/${media.id}/like`);
    } catch {
      setLiked(wasLiked);
      setLikeCount((c) => c + (wasLiked ? 1 : -1));
    }
  };

  const handleDoubleTap = () => {
    if (!liked) handleLike();
  };

  const handleSave = async () => {
    if (!user) { toast.error('Please login to save'); return; }
    const wasSaved = saved;
    setSaved(!wasSaved);
    try {
      await api.post(`/media/${media.id}/favourite`);
      toast.success(wasSaved ? 'Removed from favourites' : 'Added to favourites');
    } catch {
      setSaved(wasSaved);
      toast.error('Failed to update favourites');
    }
  };

  const handleComment = async () => {
    if (!user) { toast.error('Please login to comment'); return; }
    if (!newComment.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await api.post(`/media/${media.id}/comment`, { content: newComment.trim() });
      setComments((prev) => [res.data.data, ...prev]);
      setCommentsLoaded(true);
      if (!showComments) setShowComments(true);
      setNewComment('');
    } catch {
      toast.error('Failed to post comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownload = async () => {
    if (!user) { toast.error('Please login to download'); return; }
    try {
      const res = await api.get(`/media/${media.id}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = media.originalName || 'download';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Download failed');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-slate-900 border border-[#e7e3dd] rounded-xl overflow-hidden"
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3">
        <Link
          href={media.uploader?.id ? `/users/${media.uploader.id}` : '#'}
          className="flex items-center gap-3 group"
        >
          <Avatar src={media.uploader?.avatar} name={uploaderName} />
          <div>
            <p className="text-sm font-semibold leading-none group-hover:text-primary-400 transition-colors">{uploaderUsername}</p>
            <p className="text-xs text-slate-500 mt-0.5">{timeAgo}</p>
          </div>
        </Link>
      </div>

      {/* ── Media ── */}
      <div
        className="relative bg-slate-950 select-none"
        onDoubleClick={handleDoubleTap}
      >
        {!imgError && src ? (
          isVideo ? (
            <video
              src={media.url}
              poster={media.thumbnailUrl}
              className="w-full max-h-[600px] object-contain"
              controls
              playsInline
            />
          ) : (
            <img
              src={src}
              alt={media.caption || media.originalName}
              className="w-full object-contain max-h-[600px]"
              loading="lazy"
              onError={() => setImgError(true)}
            />
          )
        ) : (
          <div className="aspect-square flex items-center justify-center bg-[#f8f7f5]">
            {isVideo ? <Film className="w-12 h-12 text-slate-600" /> : <Camera className="w-12 h-12 text-slate-600" />}
          </div>
        )}

        {/* Double-tap heart animation */}
        <AnimatePresence>
          {heartAnim && (
            <motion.div
              key="heart-anim"
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: 1, scale: 1.2 }}
              exit={{ opacity: 0, scale: 1.6 }}
              transition={{ duration: 0.5 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
              <Heart className="w-24 h-24 text-rose-500 fill-rose-500 drop-shadow-2xl" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Video badge */}
        {isVideo && !imgError && (
          <div className="absolute top-3 right-3 pointer-events-none">
            <div className="bg-black/60 backdrop-blur-sm rounded-full p-1.5">
              <Play className="w-3.5 h-3.5 text-white fill-white" />
            </div>
          </div>
        )}
      </div>

      {/* ── Actions ── */}
      <div className="px-4 pt-3 pb-1">
        <div className="flex items-center justify-between">
          {/* Left: like, comment, share */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleLike}
              className="p-2 -ml-2 rounded-full transition-transform active:scale-90"
              aria-label="Like"
            >
              <Heart
                className={`w-6 h-6 transition-all duration-200 ${
                  liked ? 'fill-rose-500 text-rose-500 scale-110' : 'text-[#6b6560] hover:text-[#2a2724]'
                }`}
              />
            </button>
            <button
              onClick={() => {
                toggleComments();
                setTimeout(() => commentInputRef.current?.focus(), 200);
              }}
              className="p-2 rounded-full transition-colors"
              aria-label="Comment"
            >
              <MessageCircle className="w-6 h-6 text-[#6b6560] hover:text-[#2a2724]" />
            </button>
            <button
              onClick={handleDownload}
              className="p-2 rounded-full transition-colors"
              aria-label="Download"
            >
              <Download className="w-6 h-6 text-[#6b6560] hover:text-[#2a2724]" />
            </button>
          </div>
          {/* Right: save */}
          <button
            onClick={handleSave}
            className="p-2 -mr-2 rounded-full transition-transform active:scale-90"
            aria-label="Save"
          >
            <Bookmark
              className={`w-6 h-6 transition-all duration-200 ${
                saved ? 'fill-primary-600 text-primary-600 scale-110' : 'text-[#6b6560] hover:text-[#2a2724]'
              }`}
            />
          </button>
        </div>

        {/* Like count */}
        {likeCount > 0 && (
          <p className="text-sm font-semibold mt-1">
            {likeCount.toLocaleString()} {likeCount === 1 ? 'like' : 'likes'}
          </p>
        )}

        {/* Caption */}
        {caption && (
          <p className="text-sm mt-1.5 leading-snug">
            <span className="font-semibold mr-1.5">{uploaderUsername}</span>
            {captionLong && !captionExpanded ? (
              <>
                {caption.slice(0, 100)}
                <button
                  onClick={() => setCaptionExpanded(true)}
                  className="text-slate-400 hover:text-[#2a2724] ml-1"
                >
                  more
                </button>
              </>
            ) : caption}
          </p>
        )}

        {/* Tags */}
        {media.tags && media.tags.length > 0 && (
          <p className="text-sm text-primary-400 mt-1">
            {media.tags.map((t) => `#${t}`).join(' ')}
          </p>
        )}

        {/* Tagged people */}
        {media.taggedUsers && media.taggedUsers.length > 0 && (
          <div className="mt-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1.5">
              <Tag className="w-3.5 h-3.5" /> Tagged
            </div>
            <div className="flex flex-wrap gap-1.5">
              {media.taggedUsers.map((mt) => (
                <Link
                  key={mt.id}
                  href={`/users/${mt.taggedUser?.id}`}
                  className="inline-flex items-center gap-1.5 bg-[#f8f7f5] hover:bg-[#f0ede8] rounded-full pl-1 pr-2 py-0.5 group"
                >
                  {mt.taggedUser?.avatar ? (
                    <img src={mt.taggedUser.avatar} alt="" className="w-5 h-5 rounded-full object-cover" />
                  ) : (
                    <span className="w-5 h-5 rounded-full bg-primary-600 text-white flex items-center justify-center text-[9px] font-bold">
                      {mt.taggedUser?.fullName?.[0] || mt.taggedUser?.username?.[0] || '?'}
                    </span>
                  )}
                  <span className="text-xs font-medium group-hover:text-primary-400 transition-colors">@{mt.taggedUser?.username}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Comments toggle */}
        {(media._count?.comments ?? 0) > 0 && (
          <button
            onClick={toggleComments}
            className="text-sm text-slate-400 hover:text-[#2a2724] mt-1.5 transition-colors"
          >
            {showComments ? 'Hide comments' : `View all ${media._count?.comments} comments`}
          </button>
        )}

        {/* Comments list */}
        <AnimatePresence>
          {showComments && commentsLoaded && comments.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-2 space-y-2 max-h-48 overflow-y-auto pr-1">
                {comments.map((c) => (
                  <div key={c.id} className="flex items-start gap-2">
                    <Avatar src={c.user?.avatar} name={c.user?.username} size="sm" />
                    <div className="text-sm flex-1 min-w-0">
                      <span className="font-semibold mr-1.5">{c.user?.username}</span>
                      <span className="text-[#6b6560] break-words">{c.content}</span>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Add comment */}
        <div className="flex items-center gap-2 mt-3 pb-3 border-t border-[#e7e3dd] pt-3">
          <Avatar src={user?.avatar} name={user?.username || 'You'} size="sm" />
          <div className="flex-1 flex items-center gap-2">
            <input
              ref={commentInputRef}
              type="text"
              placeholder="Add a comment…"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleComment()}
              className="flex-1 bg-transparent text-sm placeholder-slate-600 outline-none text-[#4a4540]"
            />
            {newComment.trim() && (
              <button
                onClick={handleComment}
                disabled={submitting}
                className="text-primary-400 hover:text-primary-300 font-semibold text-sm disabled:opacity-50 transition-colors"
              >
                Post
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Gallery Page ──────────────────────────────────────── */
export default function GalleryPage() {
  const [media, setMedia] = useState<Media[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [mediaType, setMediaType] = useState('');

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => setDebouncedSearch(search), 400);
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
  }, [search]);

  useEffect(() => {
    setMedia([]);
    setPage(1);
    setHasMore(true);
    setLoading(true);
    fetchMedia(1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, mediaType]);

  const fetchMedia = useCallback(async (pageNum: number, reset = false) => {
    try {
      const params = new URLSearchParams();
      params.append('page', pageNum.toString());
      params.append('limit', LIMIT.toString());
      if (debouncedSearch) params.append('search', debouncedSearch);
      if (mediaType) params.append('mediaType', mediaType);
      const res = await api.get(`/media?${params.toString()}`);
      const newMedia: Media[] = res.data.data || [];
      const pagination = res.data.pagination;
      if (reset) setMedia(newMedia);
      else setMedia((prev) => [...prev, ...newMedia]);
      setHasMore(pageNum < (pagination?.totalPages ?? 1));
      setTotal(pagination?.total ?? 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, mediaType]);

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchMedia(next);
  };

  const hasActiveFilters = search || mediaType;

  return (
    <div className="max-w-[470px] mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gallery</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {total > 0 ? `${total.toLocaleString()} public photos & videos` : 'Browse all public media'}
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9 pr-8 w-full"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-[#4a4540]">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex gap-1.5">
          {(['', 'PHOTO', 'VIDEO'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setMediaType(type)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                mediaType === type
                  ? 'bg-primary-600 text-white'
                  : 'bg-[#f8f7f5] text-slate-400 hover:text-[#2a2724] hover:bg-[#f0ede8]'
              }`}
            >
              {type === '' ? 'All' : type === 'PHOTO' ? 'Photos' : 'Videos'}
            </button>
          ))}
        </div>

        <AnimatePresence>
          {hasActiveFilters && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              onClick={() => { setSearch(''); setMediaType(''); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-slate-400 hover:text-[#2a2724] bg-[#f8f7f5] hover:bg-[#f0ede8] transition-all"
            >
              <X className="w-3.5 h-3.5" /> Clear
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Feed */}
      {loading && media.length === 0 ? (
        <div className="space-y-5">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonPost key={i} />)}
        </div>
      ) : media.length > 0 ? (
        <InfiniteScroll
          dataLength={media.length}
          next={loadMore}
          hasMore={hasMore}
          loader={
            <div className="space-y-5 mt-5">
              {Array.from({ length: 2 }).map((_, i) => <SkeletonPost key={i} />)}
            </div>
          }
          endMessage={
            <p className="text-center text-slate-500 py-10 text-sm">
              {total > 0 ? `All ${total.toLocaleString()} posts loaded` : "You've seen it all!"}
            </p>
          }
          scrollThreshold={0.85}
        >
          <div className="space-y-5">
            {media.map((item) => (
              <InstagramPost
                key={item.id}
                media={item}
                onDelete={(id) => {
                  setMedia((prev) => prev.filter((m) => m.id !== id));
                  setTotal((t) => t - 1);
                }}
              />
            ))}
          </div>
        </InfiniteScroll>
      ) : (
        <div className="text-center py-20 bg-slate-900 border border-[#e7e3dd] rounded-xl">
          <Camera className="w-14 h-14 text-slate-700 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No media found</h3>
          <p className="text-slate-400 text-sm max-w-xs mx-auto">
            {hasActiveFilters
              ? 'No results match your filters. Try broadening your search.'
              : 'No public media has been uploaded yet.'}
          </p>
          {hasActiveFilters && (
            <button onClick={() => { setSearch(''); setMediaType(''); }} className="btn-secondary mt-4 text-sm">
              Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
