import { useState, useEffect, useCallback } from 'react';
import { Plus, Package, Edit2, Trash2, Eye, Upload, Loader2, Search, Image as ImageIcon } from 'lucide-react';
import api from '../../lib/api';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Modal from '../../components/ui/Modal';
import EmptyState from '../../components/ui/EmptyState';

const STATUS_LABELS = {
  draft: { label: 'Draft', variant: 'neutral' },
  active: { label: 'Active', variant: 'success' },
  sold: { label: 'Sold', variant: 'info' },
  archived: { label: 'Archived', variant: 'warning' },
};

export default function ListingManagement() {
  const [listings, setListings] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedListing, setSelectedListing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);

  const fetchListings = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20, ...(statusFilter && { status: statusFilter }) };
      const { data } = await api.get('/marketplace/my-listings', { params });
      setListings(data.listings || []);
      setTotalPages(data.pagination?.pages || 1);
      setTotal(data.pagination?.total || 0);
    } catch (err) {
      console.error('Failed to fetch listings:', err);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => { fetchListings(); }, [fetchListings]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const { data } = await api.get('/marketplace/categories');
        setCategories(data.categories || []);
      } catch {}
    };
    fetchCategories();
  }, []);

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this listing?')) return;
    try {
      await api.delete(`/marketplace/listings/${id}`);
      fetchListings();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete listing');
    }
  };

  const handlePublish = async (id) => {
    try {
      await api.patch(`/marketplace/listings/${id}/publish`);
      fetchListings();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to publish listing');
    }
  };

  const filteredListings = listings.filter(l =>
    !search || l.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Listings</h1>
          <p className="text-gray-500">{total} total listings</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4" />
          New Listing
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search listings..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
        >
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="sold">Sold</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {/* Listings */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border p-4 animate-pulse">
              <div className="flex gap-4">
                <div className="w-24 h-24 bg-gray-200 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/2" />
                  <div className="h-3 bg-gray-200 rounded w-1/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredListings.length === 0 ? (
        <EmptyState
          icon={<Package className="w-8 h-8" />}
          title="No listings found"
          description={statusFilter ? 'Try changing the status filter.' : 'Create your first listing to start selling.'}
          action={
            !statusFilter ? (
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className="w-4 h-4" /> Create Listing
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="space-y-3">
          {filteredListings.map((listing) => (
            <ListingRow
              key={listing.id}
              listing={listing}
              onEdit={() => { setSelectedListing(listing); setShowEditModal(true); }}
              onImages={() => { setSelectedListing(listing); setShowImageModal(true); }}
              onDelete={() => handleDelete(listing.id)}
              onPublish={() => handlePublish(listing.id)}
            />
          ))}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
              >
                Previous
              </button>
              <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {/* Create Modal */}
      <ListingFormModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        categories={categories}
        onSubmit={async (formData) => {
          setCreating(true);
          try {
            await api.post('/marketplace/listings', formData);
            setShowCreateModal(false);
            fetchListings();
          } catch (err) {
            throw new Error(err.response?.data?.error || 'Failed to create listing');
          } finally {
            setCreating(false);
          }
        }}
        submitting={creating}
      />

      {/* Edit Modal */}
      {selectedListing && (
        <ListingFormModal
          open={showEditModal}
          onClose={() => { setShowEditModal(false); setSelectedListing(null); }}
          categories={categories}
          listing={selectedListing}
          onSubmit={async (formData) => {
            setUpdating(true);
            try {
              await api.put(`/marketplace/listings/${selectedListing.id}`, formData);
              setShowEditModal(false);
              setSelectedListing(null);
              fetchListings();
            } catch (err) {
              throw new Error(err.response?.data?.error || 'Failed to update listing');
            } finally {
              setUpdating(false);
            }
          }}
          submitting={updating}
        />
      )}

      {/* Image Management Modal */}
      {selectedListing && (
        <ImageManagementModal
          open={showImageModal}
          onClose={() => { setShowImageModal(false); setSelectedListing(null); }}
          listing={selectedListing}
          onUpdate={fetchListings}
        />
      )}
    </div>
  );
}

function ListingRow({ listing, onEdit, onImages, onDelete, onPublish }) {
  const statusInfo = STATUS_LABELS[listing.status] || STATUS_LABELS.draft;

  return (
    <Card className="p-4">
      <div className="flex gap-4">
        <div className="w-24 h-24 sm:w-32 sm:h-32 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
          {listing.primary_image ? (
            <img src={listing.primary_image} alt={listing.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="w-8 h-8 text-gray-300" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-semibold text-gray-900 truncate">{listing.title}</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                ₱{parseFloat(listing.price).toLocaleString('en-PH')} / {listing.unit || 'piece'}
              </p>
            </div>
            <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
          </div>

          <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
            {listing.category && <span>{listing.category.name}</span>}
            <span>{listing.quantity_available} in stock</span>
            <span>{listing.view_count || 0} views</span>
            <span>{listing.sold_count || 0} sold</span>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onEdit}>
              <Edit2 className="w-3.5 h-3.5" /> Edit
            </Button>
            <Button variant="ghost" size="sm" onClick={onImages}>
              <ImageIcon className="w-3.5 h-3.5" /> Images
            </Button>
            {listing.status === 'draft' && (
              <Button variant="ghost" size="sm" onClick={onPublish}>
                <Eye className="w-3.5 h-3.5" /> Publish
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onDelete} className="text-red-600 hover:text-red-700 hover:bg-red-50">
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function ListingFormModal({ open, onClose, categories, listing, onSubmit, submitting }) {
  const isEdit = !!listing;
  const [form, setForm] = useState({
    title: '',
    description: '',
    price: '',
    originalPrice: '',
    unit: 'piece',
    quantityAvailable: '1',
    condition: 'new',
    materialType: '',
    weightKg: '',
    categoryId: '',
    city: '',
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (listing) {
      setForm({
        title: listing.title || '',
        description: listing.description || '',
        price: listing.price?.toString() || '',
        originalPrice: listing.original_price?.toString() || '',
        unit: listing.unit || 'piece',
        quantityAvailable: listing.quantity_available?.toString() || '1',
        condition: listing.condition || 'new',
        materialType: listing.material_type || '',
        weightKg: listing.weight_kg?.toString() || '',
        categoryId: listing.category_id || '',
        city: listing.city || '',
      });
    } else {
      setForm({
        title: '', description: '', price: '', originalPrice: '',
        unit: 'piece', quantityAvailable: '1', condition: 'new',
        materialType: '', weightKg: '', categoryId: '', city: '',
      });
    }
    setError('');
  }, [listing, open]);

  const handleChange = (field, value) => {
    setForm(f => ({ ...f, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.title || !form.description || !form.price || !form.categoryId) {
      setError('Title, description, price, and category are required');
      return;
    }
    try {
      await onSubmit({
        ...form,
        price: parseFloat(form.price),
        originalPrice: form.originalPrice ? parseFloat(form.originalPrice) : null,
        quantityAvailable: parseInt(form.quantityAvailable) || 1,
        weightKg: form.weightKg ? parseFloat(form.weightKg) : null,
      });
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Listing' : 'Create Listing'} maxWidth="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>
        )}
        <Input
          label="Title"
          value={form.title}
          onChange={(e) => handleChange('title', e.target.value)}
          placeholder="e.g., Recycled Plastic Bottles (500ml)"
          required
        />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => handleChange('description', e.target.value)}
            rows={3}
            className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
            placeholder="Describe your product..."
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Price (PHP)"
            type="number"
            value={form.price}
            onChange={(e) => handleChange('price', e.target.value)}
            placeholder="0.00"
            min="0"
            step="0.01"
            required
          />
          <Input
            label="Original Price (PHP)"
            type="number"
            value={form.originalPrice}
            onChange={(e) => handleChange('originalPrice', e.target.value)}
            placeholder="Optional"
            min="0"
            step="0.01"
          />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Select
            label="Unit"
            value={form.unit}
            onChange={(e) => handleChange('unit', e.target.value)}
            options={[
              { value: 'piece', label: 'Piece' },
              { value: 'kg', label: 'Kilogram' },
              { value: 'liter', label: 'Liter' },
              { value: 'set', label: 'Set' },
              { value: 'pack', label: 'Pack' },
            ]}
          />
          <Input
            label="Quantity"
            type="number"
            value={form.quantityAvailable}
            onChange={(e) => handleChange('quantityAvailable', e.target.value)}
            min="1"
            required
          />
          <Select
            label="Condition"
            value={form.condition}
            onChange={(e) => handleChange('condition', e.target.value)}
            options={[
              { value: 'new', label: 'New' },
              { value: 'like_new', label: 'Like New' },
              { value: 'good', label: 'Good' },
              { value: 'fair', label: 'Fair' },
              { value: 'used', label: 'Used' },
            ]}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Category"
            value={form.categoryId}
            onChange={(e) => handleChange('categoryId', e.target.value)}
            options={[
              { value: '', label: 'Select category' },
              ...categories.map(c => ({ value: c.id, label: c.name })),
            ]}
            required
          />
          <Input
            label="Material Type"
            value={form.materialType}
            onChange={(e) => handleChange('materialType', e.target.value)}
            placeholder="e.g., PET Plastic"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Weight (kg)"
            type="number"
            value={form.weightKg}
            onChange={(e) => handleChange('weightKg', e.target.value)}
            placeholder="Optional"
            min="0"
            step="0.01"
          />
          <Input
            label="City"
            value={form.city}
            onChange={(e) => handleChange('city', e.target.value)}
            placeholder="e.g., Cebu City"
          />
        </div>
        <div className="flex gap-3 justify-end pt-4 border-t">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEdit ? 'Update Listing' : 'Create Listing'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ImageManagementModal({ open, onClose, listing, onUpdate }) {
  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    if (open && listing) {
      const fetchImages = async () => {
        try {
          const { data } = await api.get(`/marketplace/listings/${listing.id}`);
          setImages(data.listing?.listing_images || []);
        } catch {}
      };
      fetchImages();
    }
  }, [open, listing]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      await api.post(`/marketplace/listings/${listing.id}/images`, formData);
      const { data } = await api.get(`/marketplace/listings/${listing.id}`);
      setImages(data.listing?.listing_images || []);
      onUpdate();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to upload image');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async (imageId) => {
    setDeletingId(imageId);
    try {
      await api.delete(`/marketplace/listings/${listing.id}/images/${imageId}`);
      setImages(imgs => imgs.filter(img => img.id !== imageId));
      onUpdate();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete image');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Images - ${listing?.title}`} maxWidth="max-w-2xl">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">{images.length} image(s)</p>
          <label className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors bg-gray-100 text-gray-700 hover:bg-gray-200 cursor-pointer ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
            <input type="file" accept="image/*" onChange={handleUpload} className="hidden" disabled={uploading} />
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Upload Image
          </label>
        </div>

        {images.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <ImageIcon className="w-12 h-12 mx-auto mb-2" />
            <p className="text-sm">No images yet. Upload one to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {images.sort((a, b) => a.sort_order - b.sort_order).map((img) => (
              <div key={img.id} className="relative group">
                <img src={img.image_url} alt="" className="w-full aspect-square object-cover rounded-lg" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                  {img.is_primary && (
                    <Badge variant="success" className="absolute top-2 left-2">Primary</Badge>
                  )}
                  <button
                    onClick={() => handleDelete(img.id)}
                    disabled={deletingId === img.id}
                    className="w-8 h-8 bg-white rounded-full flex items-center justify-center hover:bg-red-50 transition-colors"
                  >
                    {deletingId === img.id ? (
                      <Loader2 className="w-4 h-4 animate-spin text-red-600" />
                    ) : (
                      <Trash2 className="w-4 h-4 text-red-600" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
