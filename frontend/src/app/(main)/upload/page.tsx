'use client';
import { useState, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useDropzone } from 'react-dropzone';
import api from '@/lib/axios';
import { useAuthStore } from '@/store/authStore';
import { Upload, X, Image, Film, Check, AlertCircle, Plus, FolderOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

interface UploadFile {
  file: File;
  preview: string;
  progress: number;
  status: 'pending' | 'uploading' | 'done' | 'error';
}

export default function UploadPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [albumId, setAlbumId] = useState(searchParams.get('albumId') || '');
  const [albums, setAlbums] = useState<any[]>([]);
  const [caption, setCaption] = useState('');
  const [visibility, setVisibility] = useState('PUBLIC');
  const [uploading, setUploading] = useState(false);

  // Inline album creation state
  const [showCreateAlbum, setShowCreateAlbum] = useState(false);
  const [userEvents, setUserEvents] = useState<any[]>([]);
  const [newAlbumName, setNewAlbumName] = useState('');
  const [newAlbumEventId, setNewAlbumEventId] = useState('');
  const [newAlbumVisibility, setNewAlbumVisibility] = useState('PUBLIC');
  const [creatingAlbum, setCreatingAlbum] = useState(false);

  useEffect(() => {
    fetchAlbums();
  }, []);

  const fetchAlbums = async () => {
    try {
      const res = await api.get('/albums?limit=100&myAlbums=true');
      setAlbums(res.data.data || []);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchUserEvents = async () => {
    try {
      const res = await api.get('/events?myEvents=true&limit=50');
      setUserEvents(res.data.data || []);
    } catch (error) {
      console.error(error);
    }
  };

  const handleShowCreateAlbum = () => {
    setShowCreateAlbum(true);
    if (userEvents.length === 0) fetchUserEvents();
  };

  const handleCreateAlbum = async () => {
    if (!newAlbumName.trim()) {
      toast.error('Album name is required');
      return;
    }
    if (!newAlbumEventId) {
      toast.error('Please select an event');
      return;
    }
    setCreatingAlbum(true);
    try {
      const res = await api.post('/albums', {
        name: newAlbumName,
        visibility: newAlbumVisibility,
        eventId: newAlbumEventId,
      });
      toast.success('Album created!');
      const newAlbum = res.data.data;
      await fetchAlbums();
      setAlbumId(newAlbum.id);
      setShowCreateAlbum(false);
      setNewAlbumName('');
      setNewAlbumEventId('');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create album');
    } finally {
      setCreatingAlbum(false);
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map((file) => ({
      file,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : '',
      progress: 0,
      status: 'pending' as const,
    }));
    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp'],
      'video/*': ['.mp4', '.mpeg', '.mov', '.avi', '.webm'],
    },
    maxSize: 100 * 1024 * 1024,
    maxFiles: 20,
  });

  const removeFile = (index: number) => {
    setFiles((prev) => {
      const newFiles = [...prev];
      URL.revokeObjectURL(newFiles[index].preview);
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  const handleUpload = async () => {
    if (!albumId) {
      toast.error('Please select an album');
      return;
    }
    if (files.length === 0) {
      toast.error('Please add files to upload');
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('albumId', albumId);
      if (caption) formData.append('caption', caption);
      formData.append('visibility', visibility);

      files.forEach((f) => {
        formData.append('files', f.file);
      });

      setFiles((prev) => prev.map((f) => ({ ...f, status: 'uploading' as const })));

      const res = await api.post('/media/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const percent = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1));
          setFiles((prev) => prev.map((f) => ({ ...f, progress: percent })));
        },
      });

      setFiles((prev) => prev.map((f) => ({ ...f, status: 'done' as const, progress: 100 })));
      toast.success(`${res.data.data.length} file(s) uploaded successfully!`);

      setTimeout(() => {
        router.push(`/albums/${albumId}`);
      }, 1500);
    } catch (error: any) {
      setFiles((prev) => prev.map((f) => ({ ...f, status: 'error' as const })));
      toast.error(error.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  if (!user) {
    router.push('/login');
    return null;
  }

  if (user.role === 'CLUB_MEMBER' || user.role === 'VIEWER') {
    router.push('/');
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Upload Media</h1>
        <p className="text-slate-400 text-sm">Upload photos and videos to an album</p>
      </div>

      {/* Album Selection */}
      <div className="card p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="label">Album *</label>
            <div className="flex gap-2">
              <select
                value={albumId}
                onChange={(e) => setAlbumId(e.target.value)}
                className="input flex-1"
                required
              >
                <option value="">Select Album</option>
                {albums.map((album) => (
                  <option key={album.id} value={album.id}>
                    {album.name} ({album.event?.name})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleShowCreateAlbum}
                className="btn-secondary px-3 shrink-0"
                title="Create new album"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {albums.length === 0 && !showCreateAlbum && (
              <p className="text-xs text-amber-400 mt-2 flex items-center gap-1">
                <FolderOpen className="w-3 h-3 shrink-0" />
                No albums yet — click <strong className="mx-1">+</strong> to create one now.
              </p>
            )}
          </div>
          <div>
            <label className="label">Caption</label>
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="input"
              placeholder="Optional caption..."
            />
          </div>
          <div>
            <label className="label">Visibility</label>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value)}
              className="input"
            >
              <option value="PUBLIC">Public</option>
              <option value="PRIVATE">Private</option>
            </select>
          </div>
        </div>

        {/* Inline Create Album Panel */}
        <AnimatePresence>
          {showCreateAlbum && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-4 pt-4 border-t border-slate-700">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-slate-200">Create New Album</h3>
                  <button
                    onClick={() => setShowCreateAlbum(false)}
                    className="p-1 hover:bg-slate-700 rounded text-slate-400"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="label">Album Name *</label>
                    <input
                      type="text"
                      value={newAlbumName}
                      onChange={(e) => setNewAlbumName(e.target.value)}
                      className="input"
                      placeholder="e.g. Opening Ceremony"
                    />
                  </div>
                  <div>
                    <label className="label">Event *</label>
                    <select
                      value={newAlbumEventId}
                      onChange={(e) => setNewAlbumEventId(e.target.value)}
                      className="input"
                    >
                      <option value="">Select Event</option>
                      {userEvents.map((event) => (
                        <option key={event.id} value={event.id}>
                          {event.name}
                        </option>
                      ))}
                    </select>
                    {userEvents.length === 0 && (
                      <p className="text-xs text-slate-500 mt-1">
                        No events found.{' '}
                        <a href="/events/create" className="text-primary-400 underline">
                          Create an event first
                        </a>
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="label">Visibility</label>
                    <select
                      value={newAlbumVisibility}
                      onChange={(e) => setNewAlbumVisibility(e.target.value)}
                      className="input"
                    >
                      <option value="PUBLIC">Public</option>
                      <option value="PRIVATE">Private</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end mt-3">
                  <button
                    onClick={handleCreateAlbum}
                    disabled={creatingAlbum || !newAlbumName.trim() || !newAlbumEventId}
                    className="btn-primary text-sm"
                  >
                    {creatingAlbum ? 'Creating...' : 'Create Album'}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`card border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${
          isDragActive
            ? 'border-primary-500 bg-primary-500/5'
            : 'border-slate-700 hover:border-slate-600'
        }`}
      >
        <input {...getInputProps()} />
        <Upload className={`w-12 h-12 mx-auto mb-4 ${isDragActive ? 'text-primary-400' : 'text-slate-500'}`} />
        {isDragActive ? (
          <p className="text-primary-400 font-medium">Drop files here...</p>
        ) : (
          <>
            <p className="text-slate-300 font-medium">Drag & drop files here</p>
            <p className="text-sm text-slate-500 mt-1">or click to browse • Max 20 files, 100MB each</p>
            <p className="text-xs text-slate-600 mt-2">Supports: JPEG, PNG, GIF, WebP, MP4, MOV, AVI, WebM</p>
          </>
        )}
      </div>

      {/* File Previews */}
      {files.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">{files.length} file(s) selected</h3>
            <button
              onClick={() => { files.forEach((f) => URL.revokeObjectURL(f.preview)); setFiles([]); }}
              className="text-sm text-red-400 hover:text-red-300"
            >
              Clear All
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            <AnimatePresence>
              {files.map((f, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="relative group"
                >
                  <div className="aspect-square rounded-lg overflow-hidden bg-slate-800 border border-slate-700">
                    {f.file.type.startsWith('image/') ? (
                      <img src={f.preview} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Film className="w-8 h-8 text-slate-500" />
                      </div>
                    )}

                    {f.status === 'uploading' && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <div className="text-center">
                          <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" />
                          <p className="text-xs text-white mt-1">{f.progress}%</p>
                        </div>
                      </div>
                    )}
                    {f.status === 'done' && (
                      <div className="absolute inset-0 bg-green-900/60 flex items-center justify-center">
                        <Check className="w-8 h-8 text-green-400" />
                      </div>
                    )}
                    {f.status === 'error' && (
                      <div className="absolute inset-0 bg-red-900/60 flex items-center justify-center">
                        <AlertCircle className="w-8 h-8 text-red-400" />
                      </div>
                    )}
                  </div>

                  {f.status === 'pending' && (
                    <button
                      onClick={() => removeFile(i)}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}

                  <p className="text-[10px] text-slate-500 mt-1 truncate">{f.file.name}</p>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <button
            onClick={handleUpload}
            disabled={uploading || !albumId}
            className="btn-primary w-full justify-center py-3"
          >
            {uploading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-5 h-5" />
                Upload {files.length} File{files.length > 1 ? 's' : ''}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
