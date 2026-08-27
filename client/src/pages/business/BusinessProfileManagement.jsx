import { useState, useEffect, useCallback } from 'react';
import api from '../../lib/api';
import Card, { CardHeader, CardTitle } from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import EmptyState from '../../components/ui/EmptyState';
import {
  Building2, Save, Loader2, Clock, Package, FileText,
  Upload, Trash2, AlertTriangle, CheckCircle
} from 'lucide-react';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABELS = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
  thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
};

const statusConfig = {
  pending: { variant: 'warning', label: 'Pending Approval' },
  approved: { variant: 'success', label: 'Approved' },
  rejected: { variant: 'danger', label: 'Rejected' },
  suspended: { variant: 'danger', label: 'Suspended' },
};

export default function BusinessProfileManagement() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('details');
  const [business, setBusiness] = useState(null);
  const [success, setSuccess] = useState('');
  const [errors, setErrors] = useState({});

  // Details form
  const [form, setForm] = useState({
    name: '', description: '', category: '', address: '', city: '',
    province: '', latitude: '', longitude: '', phone: '', email: '',
    website: '', acceptsDropOffs: false, hasMarketplace: false,
  });

  // Hours
  const [hours, setHours] = useState(
    DAYS.map(day => ({ day, open_time: '08:00', close_time: '17:00', is_closed: day === 'sunday' }))
  );

  // Materials
  const [materials, setMaterials] = useState([]);

  // Documents
  const [documents, setDocuments] = useState([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // Delete modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const fetchBusiness = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/businesses/my');
      const biz = data.business;
      setBusiness(biz);
      setForm({
        name: biz.name || '',
        description: biz.description || '',
        category: biz.category || '',
        address: biz.address || '',
        city: biz.city || '',
        province: biz.province || '',
        latitude: biz.latitude || '',
        longitude: biz.longitude || '',
        phone: biz.phone || '',
        email: biz.email || '',
        website: biz.website || '',
        acceptsDropOffs: biz.accepts_drop_offs || false,
        hasMarketplace: biz.has_marketplace || false,
      });
      if (biz.hours && biz.hours.length > 0) {
        setHours(biz.hours);
      }
      if (biz.materials) {
        setMaterials(biz.materials);
      }
      if (biz.documents) {
        setDocuments(biz.documents);
      }
    } catch {
      // No business found
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBusiness();
  }, [fetchBusiness]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleHoursChange = (index, field, value) => {
    setHours(prev => prev.map((h, i) => i === index ? { ...h, [field]: value } : h));
  };

  const handleMaterialChange = (index, field, value) => {
    setMaterials(prev => prev.map((m, i) => i === index ? { ...m, [field]: value } : m));
  };

  const addMaterial = () => {
    setMaterials(prev => [...prev, {
      material_name: '', price_per_kg: '', unit: 'kg', description: '', is_accepted: true,
    }]);
  };

  const removeMaterial = (index) => {
    setMaterials(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveDetails = async () => {
    if (!form.name.trim()) {
      setErrors({ name: 'Business name is required' });
      return;
    }
    setSaving(true);
    setSuccess('');
    try {
      await api.put(`/businesses/${business.id}`, {
        ...form,
        latitude: form.latitude ? parseFloat(form.latitude) : null,
        longitude: form.longitude ? parseFloat(form.longitude) : null,
      });
      setSuccess('Business details updated');
      setTimeout(() => setSuccess(''), 3000);
      fetchBusiness();
    } catch (err) {
      setErrors({ submit: err.response?.data?.error || 'Failed to update' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveHours = async () => {
    setSaving(true);
    setSuccess('');
    try {
      await api.put(`/businesses/${business.id}/hours`, { hours });
      setSuccess('Operating hours updated');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setErrors({ hours: err.response?.data?.error || 'Failed to update hours' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveMaterials = async () => {
    setSaving(true);
    setSuccess('');
    try {
      const validMaterials = materials.filter(m => m.material_name.trim());
      await api.put(`/businesses/${business.id}/materials`, { materials: validMaterials });
      setSuccess('Materials updated');
      setTimeout(() => setSuccess(''), 3000);
      fetchBusiness();
    } catch (err) {
      setErrors({ materials: err.response?.data?.error || 'Failed to update materials' });
    } finally {
      setSaving(false);
    }
  };

  const handleDocumentUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setErrors({ document: 'File must be less than 10MB' });
      return;
    }
    setUploadingDoc(true);
    setErrors({ document: '' });
    try {
      const formData = new FormData();
      formData.append('document', file);
      formData.append('documentType', 'general');
      const { data } = await api.post(`/businesses/${business.id}/documents`, formData);
      setDocuments(prev => [data.document, ...prev]);
    } catch (err) {
      setErrors({ document: err.response?.data?.error || 'Upload failed' });
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleDeleteDocument = async (docId) => {
    try {
      await api.delete(`/businesses/${business.id}/documents/${docId}`);
      setDocuments(prev => prev.filter(d => d.id !== docId));
    } catch {
      // ignore
    }
  };

  const handleDeleteBusiness = async () => {
    if (deleteConfirmText !== 'DELETE') return;
    setDeleting(true);
    try {
      await api.delete(`/businesses/${business.id}`);
      window.location.href = '/dashboard';
    } catch (err) {
      setErrors({ delete: err.response?.data?.error || 'Failed to delete' });
      setDeleting(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading business profile...</div>;
  }

  if (!business) {
    return (
      <EmptyState
        icon={<Building2 className="w-8 h-8" />}
        title="No Business Registered"
        description="You haven't registered a business yet."
        action={<Button onClick={() => window.location.href = '/dashboard/register-business'}>Register Business</Button>}
      />
    );
  }

  const tabs = [
    { id: 'details', label: 'Details', icon: <Building2 className="w-4 h-4" /> },
    { id: 'hours', label: 'Hours', icon: <Clock className="w-4 h-4" /> },
    { id: 'materials', label: 'Materials', icon: <Package className="w-4 h-4" /> },
    { id: 'documents', label: 'Documents', icon: <FileText className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{business.name}</h1>
          <div className="flex items-center gap-3 mt-1">
            <Badge variant={statusConfig[business.status]?.variant || 'neutral'}>
              {statusConfig[business.status]?.label || business.status}
            </Badge>
            {business.status === 'rejected' && business.rejection_reason && (
              <p className="text-sm text-red-600">Reason: {business.rejection_reason}</p>
            )}
          </div>
        </div>
      </div>

      {success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          {success}
        </div>
      )}

      {errors.submit && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {errors.submit}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'details' && (
        <Card>
          <CardHeader>
            <CardTitle>Business Details</CardTitle>
          </CardHeader>
          <div className="space-y-4">
            <Input label="Business Name" name="name" value={form.name} onChange={handleChange} error={errors.name} required />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                name="description" rows={3} value={form.description} onChange={handleChange}
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 sm:text-sm resize-none"
              />
            </div>
            <Input label="Category" name="category" value={form.category} onChange={handleChange} />
            <Input label="Address" name="address" value={form.address} onChange={handleChange} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="City" name="city" value={form.city} onChange={handleChange} />
              <Input label="Province" name="province" value={form.province} onChange={handleChange} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Phone" name="phone" value={form.phone} onChange={handleChange} />
              <Input label="Email" name="email" type="email" value={form.email} onChange={handleChange} />
            </div>
            <Input label="Website" name="website" value={form.website} onChange={handleChange} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                <input type="checkbox" name="acceptsDropOffs" checked={form.acceptsDropOffs} onChange={handleChange}
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Accepts Drop-offs</p>
                  <p className="text-xs text-gray-500">Residents can schedule drop-offs</p>
                </div>
              </label>
              <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                <input type="checkbox" name="hasMarketplace" checked={form.hasMarketplace} onChange={handleChange}
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Has Marketplace</p>
                  <p className="text-xs text-gray-500">Sell products on marketplace</p>
                </div>
              </label>
            </div>
            <div className="flex justify-end pt-2">
              <Button onClick={handleSaveDetails} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Details
              </Button>
            </div>
          </div>
        </Card>
      )}

      {activeTab === 'hours' && (
        <Card>
          <CardHeader>
            <CardTitle>Operating Hours</CardTitle>
          </CardHeader>
          {errors.hours && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 mb-4">{errors.hours}</div>
          )}
          <div className="space-y-3">
            {hours.map((h, i) => (
              <div key={h.day} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                <div className="w-28">
                  <p className="text-sm font-medium text-gray-900">{DAY_LABELS[h.day]}</p>
                </div>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={h.is_closed}
                    onChange={(e) => handleHoursChange(i, 'is_closed', e.target.checked)}
                    className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500" />
                  <span className="text-sm text-gray-600">Closed</span>
                </label>
                {!h.is_closed && (
                  <div className="flex items-center gap-2 ml-auto">
                    <input type="time" value={h.open_time}
                      onChange={(e) => handleHoursChange(i, 'open_time', e.target.value)}
                      className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                    <span className="text-gray-400">to</span>
                    <input type="time" value={h.close_time}
                      onChange={(e) => handleHoursChange(i, 'close_time', e.target.value)}
                      className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-end pt-4">
            <Button onClick={handleSaveHours} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Hours
            </Button>
          </div>
        </Card>
      )}

      {activeTab === 'materials' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Accepted Materials</CardTitle>
              <Button variant="outline" size="sm" onClick={addMaterial}>+ Add</Button>
            </div>
          </CardHeader>
          {errors.materials && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 mb-4">{errors.materials}</div>
          )}
          <div className="space-y-3">
            {materials.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No materials added yet.</p>
            ) : (
              materials.map((m, i) => (
                <div key={i} className="p-4 border border-gray-200 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <Input label="Material Name" value={m.material_name}
                      onChange={(e) => handleMaterialChange(i, 'material_name', e.target.value)}
                      placeholder="e.g., Plastic Bottles" className="flex-1 mr-4" />
                    <button onClick={() => removeMaterial(i)}
                      className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors mt-6">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Input label="Price per kg (₱)" type="number" step="0.01" min="0"
                      value={m.price_per_kg}
                      onChange={(e) => handleMaterialChange(i, 'price_per_kg', e.target.value)} />
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                      <select value={m.unit}
                        onChange={(e) => handleMaterialChange(i, 'unit', e.target.value)}
                        className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 sm:text-sm">
                        <option value="kg">per kg</option>
                        <option value="piece">per piece</option>
                        <option value="liter">per liter</option>
                      </select>
                    </div>
                    <Input label="Notes" value={m.description}
                      onChange={(e) => handleMaterialChange(i, 'description', e.target.value)} placeholder="Optional" />
                  </div>
                </div>
              ))
            )}
          </div>
          {materials.length > 0 && (
            <div className="flex justify-end pt-4">
              <Button onClick={handleSaveMaterials} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Materials
              </Button>
            </div>
          )}
        </Card>
      )}

      {activeTab === 'documents' && (
        <Card>
          <CardHeader>
            <CardTitle>Verification Documents</CardTitle>
          </CardHeader>
          <div className="space-y-4">
            <div>
              <input ref={(el) => { if (el) el._inputRef = el; }} type="file" id="doc-upload"
                accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf" className="hidden"
                onChange={handleDocumentUpload} />
              <Button variant="outline" onClick={() => document.getElementById('doc-upload')?.click()} disabled={uploadingDoc}>
                {uploadingDoc ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {uploadingDoc ? 'Uploading...' : 'Upload Document'}
              </Button>
              {errors.document && <p className="text-xs text-red-600 mt-1">{errors.document}</p>}
              <p className="text-xs text-gray-400 mt-1">JPG, PNG, WebP, or PDF. Max 10MB.</p>
            </div>
            {documents.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No documents uploaded yet.</p>
            ) : (
              <div className="space-y-2">
                {documents.map(doc => (
                  <div key={doc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{doc.file_name}</p>
                        <p className="text-xs text-gray-500">
                          {doc.document_type} • {(doc.file_size / 1024).toFixed(1)} KB • {new Date(doc.uploaded_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <button onClick={() => handleDeleteDocument(doc.id)}
                      className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Danger Zone */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-red-600">Danger Zone</CardTitle>
        </CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Permanently delete this business and all associated data.</p>
          </div>
          <Button variant="danger" size="sm" onClick={() => { setShowDeleteModal(true); setDeleteConfirmText(''); }}>
            <Trash2 className="w-4 h-4" />
            Delete Business
          </Button>
        </div>
      </Card>

      <Modal open={showDeleteModal} onClose={() => setShowDeleteModal(false)} maxWidth="max-w-md">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Delete Business</h3>
              <p className="text-sm text-gray-500">{business.name}</p>
            </div>
          </div>
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">
              <strong>This cannot be undone.</strong> All listings, orders, and data will be permanently deleted.
            </p>
          </div>
          {errors.delete && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{errors.delete}</div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type <span className="font-bold">DELETE</span> to confirm
            </label>
            <input type="text" value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)} placeholder="Type DELETE"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
            <Button variant="danger" size="sm" onClick={handleDeleteBusiness}
              disabled={deleting || deleteConfirmText !== 'DELETE'}>
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {deleting ? 'Deleting...' : 'Delete Business'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
