'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/axios';
import { useAuthStore } from '@/store/authStore';
import { Media } from '@/types';
import { Camera, Image, UserCircle, Info, AlertTriangle, CheckCircle } from 'lucide-react';
import MediaCard from '@/components/media/MediaCard';
import MediaLightbox from '@/components/media/MediaLightbox';
import toast from 'react-hot-toast';

export default function MyPhotosPage() {
  const { user, updateUser } = useAuthStore();
  const [media, setMedia] = useState<Media[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [uploading, setUploading] = useState(false);
  const [faceRecognitionEnabled, setFaceRecognitionEnabled] = useState(false);
  const [hasSelfie, setHasSelfie] = useState(false);

  useEffect(() => {
    fetchMyPhotos();
  }, []);

  const fetchMyPhotos = async () => {
    setLoading(true);
    try {
      const res = await api.get('/media/my-photos');
      setMedia(res.data.data || []);
      setFaceRecognitionEnabled(res.data.faceRecognitionEnabled || false);
      setHasSelfie(res.data.hasSelfie || false);
    } catch (error: any) {
      if (error.response?.status !== 400) {
        console.error(error);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSelfieUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so the same file can be re-selected (useful on retry)
    e.target.value = '';

    setUploading(true);
    const formData = new FormData();
    formData.append('selfie', file);

    try {
      const res = await api.post('/auth/selfie', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const { referenceSelfie, faceId } = res.data?.data || {};

      // Update auth store with both selfie URL and faceId
      if (referenceSelfie || faceId) {
        updateUser({
          ...(referenceSelfie && { referenceSelfie }),
          ...(faceId !== undefined && { faceId }),
        });
      }

      if (faceId) {
        toast.success('Selfie uploaded! Scanning your photos in the background…');
        // Refresh after a short delay so background scan has time to run
        setTimeout(() => fetchMyPhotos(), 3000);
      } else {
        toast.error(
          res.data?.message ||
            'No face detected. Please upload a clear, front-facing photo with good lighting.'
        );
        fetchMyPhotos();
      }
    } catch (error: any) {
      // Surface the real AWS/backend error message (e.g. Rekognition permissions)
      const msg =
        error.response?.data?.message ||
        error.message ||
        'Upload failed. Please try again.';
      toast.error(msg, { duration: 8000 }); // longer duration so user can read it
      fetchMyPhotos(); // still refresh to update hasSelfie state
    } finally {
      setUploading(false);
    }
  };

  // ── Banner logic ────────────────────────────────────────────────────────────
  // Three distinct states:
  //  1. faceRecognitionEnabled = true  → active, all good
  //  2. hasSelfie = true, faceId null  → selfie uploaded but face not detected
  //  3. hasSelfie = false              → no selfie yet
  const renderBanner = () => {
    if (faceRecognitionEnabled) {
      return (
        <div className="card p-4 bg-green-900/20 border-green-700/40 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-green-300 font-medium">Face recognition is active</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Photos containing your face are shown below. Upload a new selfie anytime to re-index.
            </p>
          </div>
        </div>
      );
    }

    if (hasSelfie) {
      // Selfie saved but Rekognition couldn't detect a face (or AWS error)
      return (
        <div className="card p-4 bg-yellow-900/20 border-yellow-700/40 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-yellow-300 font-medium">Face recognition not active</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Your selfie was saved but face indexing failed. This usually means either no face
              was detected, or an AWS Rekognition permission issue. Check your backend logs
              (<code className="bg-slate-700 px-1 rounded">docker logs eventmedia-backend</code>)
              for the exact error, then tap <strong>Retry Selfie</strong> with a clear
              front-facing photo.
            </p>
          </div>
        </div>
      );
    }

    // No selfie at all
    return (
      <div className="card p-4 bg-slate-800/50 border-slate-700 flex items-start gap-3">
        <Info className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-slate-300 font-medium">Enable face recognition</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Upload a clear selfie to automatically find photos of you across all events.
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Camera className="w-6 h-6 text-primary-400" /> My Photos
          </h1>
          <p className="text-slate-400 text-sm">Photos you uploaded or were tagged in</p>
        </div>
        <label className={`btn-primary text-sm cursor-pointer flex items-center gap-2 ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
          <UserCircle className="w-4 h-4" />
          {uploading ? 'Uploading…' : hasSelfie && !faceRecognitionEnabled ? 'Retry Selfie' : 'Upload Selfie'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleSelfieUpload}
            className="hidden"
            disabled={uploading}
          />
        </label>
      </div>

      {/* Status banner */}
      {renderBanner()}

      {/* Media grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-square bg-slate-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : media.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
          {media.map((item) => (
            <div key={item.id} onClick={() => setSelectedMedia(item)} className="cursor-pointer">
              <MediaCard media={item} />
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 card">
          <Image className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No photos found</h3>
          <p className="text-slate-400 text-sm">
            {faceRecognitionEnabled
              ? 'No photos with your face have been found yet. More will appear as events are uploaded.'
              : 'Upload a selfie above to find photos of you across all events.'}
          </p>
        </div>
      )}

      {selectedMedia && (
        <MediaLightbox
          media={selectedMedia}
          allMedia={media}
          onClose={() => setSelectedMedia(null)}
          onNavigate={(m) => setSelectedMedia(m)}
          onDelete={(id) => {
            setMedia((prev) => prev.filter((m) => m.id !== id));
            setSelectedMedia(null);
          }}
        />
      )}
    </div>
  );
}
