'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import api from '@/lib/axios';
import { Media, Comment } from '@/types';
import { useAuthStore } from '@/store/authStore';
import {
  Search, X, Heart, MessageCircle, Bookmark,
  Send, Play, Film, Camera, Download, Tag, ArrowUp,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import InfiniteScroll from 'react-infinite-scroll-component';
import toast from 'react-hot-toast';

const LIMIT = 12;

/* ─── Skeleton post ─────────────────────────────────────── */
function SkeletonPost() {
  return (
    <div className="bg-white border border-[#e7e3dd] rounded-xl overflow-hidden animate-pulse">
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
      className="bg-white border border-[#e7e3dd] rounded-xl overflow-hidden"
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3">
        <Link
          href={media.uploader?.id ? `/users/${media.uploader.id}` : '#'}
          onClick={markGalleryReturn}
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
        className="relative bg-[#f0ede8] select-none"
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

        {/* Tags — click to find similar photos via search */}
        {media.tags && media.tags.length > 0 && (
          <p className="text-sm mt-1 flex flex-wrap gap-x-1.5 gap-y-0.5">
            {media.tags.map((t) => (
              <Link
                key={t}
                href={`/search?tags=${encodeURIComponent(t)}`}
                onClick={markGalleryReturn}
                className="text-primary-400 hover:text-primary-600 hover:underline"
              >
                #{t}
              </Link>
            ))}
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
                  onClick={markGalleryReturn}
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

/* sessionStorage key for preserving the feed across navigation so that
   returning from a post/profile lands on the same image, not a re-fetched one. */
const FEED_CACHE_KEY = 'gallery-feed-cache';

/* Marker set the moment the user follows a link OUT of the gallery (to a
   profile, tag search, etc.). Scroll position is only restored when this marker
   is present on the next mount — i.e. the user is returning. A fresh entry
   (navbar / logo click) has no marker, so the gallery opens at the top. */
const RETURN_MARKER_KEY = 'gallery-return';

/** Call right before navigating away from the gallery so a later return restores scroll. */
function markGalleryReturn() {
  try { sessionStorage.setItem(RETURN_MARKER_KEY, '1'); } catch { /* ignore */ }
}

interface FeedCache {
  media: Media[];
  page: number;
  hasMore: boolean;
  total: number;
  search: string;
  mediaType: string;
  scrollY: number;
  // Id of the post nearest the top of the viewport, plus how far it was
  // scrolled past its own top. Anchoring to a post element is immune to the
  // feed's total height changing as lazy images load — pixel scrollY is not.
  anchorId: string | null;
  anchorOffset: number;
}

function readFeedCache(): FeedCache | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(FEED_CACHE_KEY);
    return raw ? (JSON.parse(raw) as FeedCache) : null;
  } catch {
    return null;
  }
}

/* ─── Gallery Page ──────────────────────────────────────── */
export default function GalleryPage() {
  // Restore from cache synchronously on first render so the same posts are
  // already mounted before the browser tries to restore scroll position.
  const cacheRef = useRef<FeedCache | null>(readFeedCache());
  const cached = cacheRef.current;

  const [media, setMedia] = useState<Media[]>(cached?.media ?? []);
  const [loading, setLoading] = useState(!cached);
  const [page, setPage] = useState(cached?.page ?? 1);
  const [hasMore, setHasMore] = useState(cached?.hasMore ?? true);
  const [total, setTotal] = useState(cached?.total ?? 0);
  const [search, setSearch] = useState(cached?.search ?? '');
  const [mediaType, setMediaType] = useState(cached?.mediaType ?? '');

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState(cached?.search ?? '');
  const [showScrollTop, setShowScrollTop] = useState(false);

  // True only for the very first render that hydrated from cache — used to
  // skip the reset-and-refetch effect once so we keep the restored feed.
  const restoredFromCache = useRef(!!cached);

  // Scroll container for this feed: the layout may scroll on <main> rather
  // than the window, so detect which element actually scrolls.
  const getScroller = useCallback((): HTMLElement | null => {
    if (typeof document === 'undefined') return null;
    const main = document.querySelector('main') as HTMLElement | null;
    if (main && main.scrollHeight > main.clientHeight + 4) return main;
    return (document.scrollingElement as HTMLElement) || document.documentElement;
  }, []);

  useEffect(() => {
    const scroller = getScroller();
    const target: HTMLElement | Window = scroller && scroller !== document.documentElement ? scroller : window;
    const onScroll = () => {
      const y = target === window ? window.scrollY : (target as HTMLElement).scrollTop;
      setShowScrollTop(y > 600);
    };
    target.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => target.removeEventListener('scroll', onScroll);
  }, [getScroller]);

  const scrollToTop = () => {
    const scroller = getScroller();
    if (scroller && scroller !== document.documentElement) scroller.scrollTo({ top: 0, behavior: 'smooth' });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Find the post currently nearest the top of the viewport + how far we've
  // scrolled past its top. This anchor survives the feed height changing as
  // lazy images load, which a raw pixel offset does not.
  const computeAnchor = useCallback((): { anchorId: string | null; anchorOffset: number } => {
    if (typeof document === 'undefined') return { anchorId: null, anchorOffset: 0 };
    const posts = Array.from(document.querySelectorAll<HTMLElement>('[data-media-id]'));
    for (const el of posts) {
      const rect = el.getBoundingClientRect();
      // First post whose bottom is still below the top edge = the one we're on.
      if (rect.bottom > 80) {
        return { anchorId: el.dataset.mediaId ?? null, anchorOffset: Math.max(0, -rect.top) };
      }
    }
    return { anchorId: null, anchorOffset: 0 };
  }, []);

  // Keep the latest feed state in a ref so we can persist it on unmount/navigation.
  const stateRef = useRef<FeedCache>({
    media, page, hasMore, total, search, mediaType, scrollY: 0, anchorId: null, anchorOffset: 0,
  });
  stateRef.current = {
    media, page, hasMore, total, search, mediaType,
    scrollY: 0, anchorId: null, anchorOffset: 0,
  };

  const persistFeed = useCallback(() => {
    try {
      const scroller = getScroller();
      const scrollY = scroller && scroller !== document.documentElement && scroller !== document.scrollingElement
        ? scroller.scrollTop
        : window.scrollY;
      const { anchorId, anchorOffset } = computeAnchor();
      sessionStorage.setItem(
        FEED_CACHE_KEY,
        JSON.stringify({ ...stateRef.current, scrollY, anchorId, anchorOffset }),
      );
    } catch { /* quota / serialization — ignore */ }
  }, [getScroller, computeAnchor]);

  // Restore by scrolling the anchor post back to where it was. Retries across
  // frames because the post element may not exist yet and its images grow the
  // layout after mount; each frame re-aligns the anchor until it's stable.
  const restoreAnchor = useCallback((anchorId: string | null, anchorOffset: number, fallbackY: number) => {
    let raf = 0;
    let tries = 0;
    let aborted = false;
    const maxTries = 120; // ~2s at 60fps — enough for images to settle

    const onUserScroll = (e: Event) => { if (e.isTrusted) aborted = true; };
    window.addEventListener('wheel', onUserScroll, { passive: true });
    window.addEventListener('touchmove', onUserScroll, { passive: true });
    window.addEventListener('keydown', onUserScroll);
    const cleanup = () => {
      window.removeEventListener('wheel', onUserScroll);
      window.removeEventListener('touchmove', onUserScroll);
      window.removeEventListener('keydown', onUserScroll);
    };

    const scrollTo = (y: number) => {
      const scroller = getScroller();
      const top = Math.max(0, y);
      if (scroller && scroller !== document.documentElement && scroller !== document.scrollingElement) {
        scroller.scrollTop = top;
      } else {
        window.scrollTo(0, top);
      }
    };
    const currentTop = () => {
      const scroller = getScroller();
      if (scroller && scroller !== document.documentElement && scroller !== document.scrollingElement) {
        return scroller.scrollTop;
      }
      return window.scrollY;
    };

    let stableFrames = 0;
    const attempt = () => {
      if (aborted) { cleanup(); return; }

      const el = anchorId
        ? document.querySelector<HTMLElement>(`[data-media-id="${anchorId}"]`)
        : null;

      let aligned = false;
      if (el) {
        // Move so the anchor post's top sits `anchorOffset` px below the
        // viewport top — getBoundingClientRect().top is viewport-relative,
        // which is exactly what we want regardless of which element scrolls.
        const delta = el.getBoundingClientRect().top - anchorOffset;
        if (Math.abs(delta) <= 1) aligned = true;
        else scrollTo(currentTop() + delta);
      } else if (fallbackY > 0) {
        scrollTo(fallbackY);
      }

      // Stop once the anchor has held its position for a few frames (layout
      // settled), instead of fighting the user for the full window.
      stableFrames = aligned ? stableFrames + 1 : 0;
      tries += 1;
      if (stableFrames < 5 && tries < maxTries) {
        raf = requestAnimationFrame(attempt);
      } else {
        cleanup();
      }
    };
    raf = requestAnimationFrame(attempt);
    return () => { aborted = true; cancelAnimationFrame(raf); cleanup(); };
  }, [getScroller]);

  // Persist on scroll (throttled) and on unmount/navigation.
  useEffect(() => {
    const scroller = getScroller();
    // Document-level scrolling dispatches on window, not on the scrollingElement.
    const target: HTMLElement | Window =
      scroller && scroller !== document.documentElement && scroller !== document.scrollingElement
        ? scroller
        : window;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { persistFeed(); ticking = false; });
    };
    target.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pagehide', persistFeed);
    return () => {
      target.removeEventListener('scroll', onScroll);
      window.removeEventListener('pagehide', persistFeed);
      persistFeed();
    };
  }, [persistFeed, getScroller]);

  // Restore the prior scroll position ONLY when the user is returning from a
  // gallery sub-page (profile / tag search). A fresh entry — navbar or logo
  // click — has no return marker, so the gallery opens at the top (post 1).
  useEffect(() => {
    let isReturn = false;
    try {
      isReturn = sessionStorage.getItem(RETURN_MARKER_KEY) === '1';
      sessionStorage.removeItem(RETURN_MARKER_KEY); // consume — one restore per return
    } catch { /* ignore */ }

    if (isReturn && cached && (cached.anchorId || (cached.scrollY ?? 0) > 0)) {
      return restoreAnchor(cached.anchorId ?? null, cached.anchorOffset ?? 0, cached.scrollY ?? 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => setDebouncedSearch(search), 400);
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
  }, [search]);

  useEffect(() => {
    // Skip the reset+refetch on the first render after restoring from cache —
    // the cached feed is already shown. Subsequent filter changes refetch.
    if (restoredFromCache.current) {
      restoredFromCache.current = false;
      return;
    }
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
            placeholder="Search by tags, events, people…"
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
              <div key={item.id} data-media-id={item.id}>
                <InstagramPost
                  media={item}
                  onDelete={(id) => {
                    setMedia((prev) => prev.filter((m) => m.id !== id));
                    setTotal((t) => t - 1);
                  }}
                />
              </div>
            ))}
          </div>
        </InfiniteScroll>
      ) : (
        <div className="text-center py-20 bg-white border border-[#e7e3dd] rounded-xl">
          <Camera className="w-14 h-14 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2 text-[#2a2724]">No media found</h3>
          <p className="text-slate-500 text-sm max-w-xs mx-auto">
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

      {/* Scroll-to-top */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={scrollToTop}
            aria-label="Scroll to top"
            className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-primary-600 hover:bg-primary-700 text-white shadow-lg flex items-center justify-center transition-colors active:scale-90"
          >
            <ArrowUp className="w-5 h-5" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
