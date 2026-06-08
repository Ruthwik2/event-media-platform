'use client';
import { useState } from 'react';
import api from '@/lib/axios';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import { CATEGORIES } from '@/lib/categories';
import { Album } from '@/types';

interface Props {
  eventId: string;
  // When provided the modal acts as an editor for this album; otherwise it
  // creates a new album under `eventId`.
  album?: Album;
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateAlbumModal({ eventId, album, onClose, onCreated }: Props) {
  const isEdit = !!album;
  const [name, setName] = useState(album?.name || '');
  const [description, setDescription] = useState(album?.description || '');
  const [category, setCategory] = useState(album?.category || '');
  const [visibility, setVisibility] = useState<string>(album?.visibility || 'PUBLIC');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isEdit) {
        await api.put(`/albums/${album!.id}`, {
          name,
          description,
          category: category || null,
          visibility,
        });
        toast.success('Album updated');
      } else {
        await api.post('/albums', {
          name,
          description,
          category: category || undefined,
          visibility,
          eventId,
        });
        toast.success('Album created!');
      }
      onCreated();
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || `Failed to ${isEdit ? 'update' : 'create'} album`
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="glass-panel p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">{isEdit ? 'Edit Album' : 'Create Album'}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-[#f0ede8] rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Album Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
              placeholder="Opening Ceremony"
              required
            />
          </div>

          <div>
            <label className="label">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input min-h-[80px] resize-y"
              placeholder="Optional description..."
            />
          </div>

          <div>
            <label className="label">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="input"
            >
              <option value="">No category</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
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

          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">
              {loading
                ? isEdit ? 'Saving...' : 'Creating...'
                : isEdit ? 'Save Changes' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
