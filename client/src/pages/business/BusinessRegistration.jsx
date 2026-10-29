import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../lib/api';
import Card, { CardHeader, CardTitle } from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import LocationPicker from '../../components/ui/LocationPicker';
import DocumentUploadField from '../../components/business/DocumentUploadField';
import { formatStatus } from '../../lib/formatStatus';
import { REQUIRED_DOCUMENTS, validateDocumentFile, uploadRequiredDocument } from '../../lib/businessDocuments';
import {
  Building2, FileText, Package,
  Check, ChevronRight, ChevronLeft, Trash2,
  Loader2, AlertTriangle, ShieldCheck, Clock
} from 'lucide-react';

const STEPS = [
  { id: 1, label: 'Business Info', icon: <Building2 className="w-5 h-5" /> },
  { id: 2, label: 'Documents', icon: <FileText className="w-5 h-5" /> },
  { id: 3, label: 'Hours & Materials', icon: <Package className="w-5 h-5" /> },
];

const CATEGORIES = [
  { value: '', label: 'Select a category' },
  { value: 'Recycling Center', label: 'Recycling Center' },
  { value: 'Junk Shop', label: 'Junk Shop' },
  { value: 'Composting Facility', label: 'Composting Facility' },
  { value: 'Waste Collection', label: 'Waste Collection' },
  { value: 'Material Recovery Facility', label: 'Material Recovery Facility' },
  { value: 'Eco Store', label: 'Eco Store' },
  { value: 'Upcycling Workshop', label: 'Upcycling Workshop' },
  { value: 'Hazardous Waste', label: 'Hazardous Waste Disposal' },
  { value: 'Other', label: 'Other' },
];

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const DAY_LABELS = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
  thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
};

const DEFAULT_HOURS = DAYS.map((day) => ({
  day,
  open_time: '08:00',
  close_time: '17:00',
  is_closed: day === 'sunday',
}));

const DEFAULT_MATERIALS = [
  { material_name: 'Plastic (PET)', price_per_kg: '', unit: 'kg', description: '', is_accepted: true },
  { material_name: 'Cardboard', price_per_kg: '', unit: 'kg', description: '', is_accepted: true },
  { material_name: 'Aluminum Cans', price_per_kg: '', unit: 'kg', description: '', is_accepted: true },
  { material_name: 'Glass', price_per_kg: '', unit: 'kg', description: '', is_accepted: true },
  { material_name: 'Paper', price_per_kg: '', unit: 'kg', description: '', is_accepted: true },
];

export default function BusinessRegistration() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [existingBusiness, setExistingBusiness] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  // Step 1: Business info
  const [form, setForm] = useState({
    name: '',
    description: '',
    category: '',
    address: '',
    city: 'Cebu City',
    province: 'Cebu',
    latitude: null,
    longitude: null,
    phone: profile?.phone || '',
    email: '',
    website: '',
    acceptsDropOffs: false,
    hasMarketplace: false,
  });

  // Step 2: Documents
  const [businessId, setBusinessId] = useState(null);
  const [docFiles, setDocFiles] = useState({});
  const [lockedDocs, setLockedDocs] = useState({}); // types already on file that can't be replaced
  const [docsTouched, setDocsTouched] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  // Step 3: Hours & materials
  const [hours, setHours] = useState(DEFAULT_HOURS);
  const [materials, setMaterials] = useState(DEFAULT_MATERIALS);

  useEffect(() => {
    const checkExistingBusiness = async () => {
      try {
        const { data } = await api.get('/businesses/my');
        if (data.business) {
          setExistingBusiness(data.business);
        }
      } catch {
        // No business yet
      }
    };
    checkExistingBusiness();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleHoursChange = (index, field, value) => {
    setHours(prev => prev.map((h, i) =>
      i === index ? { ...h, [field]: value } : h
    ));
  };

  const handleMaterialChange = (index, field, value) => {
    setMaterials(prev => prev.map((m, i) =>
      i === index ? { ...m, [field]: value } : m
    ));
  };

  const addMaterial = () => {
    setMaterials(prev => [...prev, {
      material_name: '',
      price_per_kg: '',
      unit: 'kg',
      description: '',
      is_accepted: true,
    }]);
  };

  const removeMaterial = (index) => {
    setMaterials(prev => prev.filter((_, i) => i !== index));
  };

  // Documents already on file that can't be replaced (e.g. on reapply or resume) aren't asked for again
  const loadLockedDocs = async () => {
    try {
      const { data: docData } = await api.get('/business/documents');
      const locked = {};
      (docData.documents || []).forEach((d) => {
        if (d.status !== 'missing' && !d.canReplace) locked[d.type] = d.status;
      });
      setLockedDocs(locked);
    } catch {
      setLockedDocs({});
    }
  };

  // Resume an application that was created but never submitted for review
  const handleContinueApplication = async () => {
    setLoading(true);
    setBusinessId(existingBusiness.id);
    await loadLockedDocs();
    setExistingBusiness(null);
    setStep(2);
    setLoading(false);
  };

  // ============================================================
  // STEP 1: Create business record
  // ============================================================
  const handleCreateBusiness = async () => {
    const newErrors = {};
    if (!form.name.trim()) newErrors.name = 'Business name is required';
    if (!form.category) newErrors.category = 'Category is required';
    if (!form.address.trim()) newErrors.address = 'Address is required';
    if (!form.city.trim()) newErrors.city = 'City is required';
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setLoading(true);
    setErrors({});
    try {
      const { data } = await api.post('/businesses', form);
      setBusinessId(data.business.id);
      await loadLockedDocs();
      setStep(2);
    } catch (err) {
      setErrors({ submit: err.response?.data?.error || 'Failed to create business' });
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // STEP 2: Upload documents
  // ============================================================
  const pickDocument = (type, file) => {
    setDocFiles(prev => ({ ...prev, [type]: file }));
  };

  const docError = (type) => {
    if (lockedDocs[type]) return '';
    const file = docFiles[type];
    if (file) return validateDocumentFile(file);
    return docsTouched ? 'This document is required.' : '';
  };

  const hasDocument = (type) =>
    !!lockedDocs[type] || (docFiles[type] && !validateDocumentFile(docFiles[type]));

  const canProceedFromDocs = REQUIRED_DOCUMENTS.every(({ type }) => hasDocument(type));

  const handleSubmitDocuments = async () => {
    setDocsTouched(true);
    if (!canProceedFromDocs) return;

    setLoading(true);
    setErrors({});
    const failed = [];
    for (const { type, label } of REQUIRED_DOCUMENTS) {
      if (lockedDocs[type]) continue;
      setUploadProgress(`Uploading ${label}...`);
      try {
        await uploadRequiredDocument(api, type, docFiles[type]);
      } catch (err) {
        failed.push(`${label}: ${err.response?.data?.error || 'upload failed'}`);
      }
    }

    if (failed.length === 0) {
      setUploadProgress('Submitting for review...');
      try {
        await api.post('/business/submit-for-review');
        setLockedDocs(prev => {
          const next = { ...prev };
          REQUIRED_DOCUMENTS.forEach(({ type }) => { next[type] = next[type] || 'pending'; });
          return next;
        });
        setStep(3);
      } catch (err) {
        failed.push(err.response?.data?.error || 'Could not submit for review');
      }
    }

    if (failed.length > 0) setErrors({ submit: failed.join('. ') });
    setUploadProgress('');
    setLoading(false);
  };

  // ============================================================
  // STEP 3: Save hours & materials
  // ============================================================
  const handleSaveHoursAndMaterials = async () => {
    setLoading(true);
    setErrors({});
    try {
      const validMaterials = materials.filter(m => m.material_name.trim());

      await Promise.all([
        api.put(`/businesses/${businessId}/hours`, { hours }),
        api.put(`/businesses/${businessId}/materials`, {
          materials: validMaterials.map(m => ({
            material_name: m.material_name.trim(),
            price_per_kg: m.price_per_kg ? parseFloat(m.price_per_kg) : null,
            unit: m.unit,
            description: m.description?.trim() || null,
            is_accepted: m.is_accepted,
          })),
        }),
      ]);

      setSubmitted(true);
    } catch (err) {
      setErrors({ submit: err.response?.data?.error || 'Failed to save' });
    } finally {
      setLoading(false);
    }
  };

  const handleSkipToDashboard = () => {
    navigate('/dashboard');
  };

  // ============================================================
  // Reapply: prefill wizard from a rejected application
  // ============================================================
  const handleStartReapply = () => {
    if (existingBusiness) {
      setForm({
        name: existingBusiness.name || '',
        description: existingBusiness.description || '',
        category: existingBusiness.category || '',
        address: existingBusiness.address || '',
        city: existingBusiness.city || 'Cebu City',
        province: existingBusiness.province || 'Cebu',
        latitude: existingBusiness.latitude,
        longitude: existingBusiness.longitude,
        phone: existingBusiness.phone || profile?.phone || '',
        email: existingBusiness.email || '',
        website: existingBusiness.website || '',
        acceptsDropOffs: !!existingBusiness.accepts_drop_offs,
        hasMarketplace: !!existingBusiness.has_marketplace,
      });
      if (Array.isArray(existingBusiness.hours) && existingBusiness.hours.length > 0) {
        setHours(existingBusiness.hours.map(h => ({
          day: h.day,
          open_time: h.open_time,
          close_time: h.close_time,
          is_closed: !!h.is_closed,
        })));
      }
      if (Array.isArray(existingBusiness.materials) && existingBusiness.materials.length > 0) {
        setMaterials(existingBusiness.materials.map(m => ({
          material_name: m.material_name,
          price_per_kg: m.price_per_kg != null ? String(m.price_per_kg) : '',
          unit: m.unit || 'kg',
          description: m.description || '',
          is_accepted: m.is_accepted !== false,
        })));
      }
    }
    setExistingBusiness(null);
    setStep(1);
  };

  // ============================================================
  // Submitted confirmation
  // ============================================================
  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShieldCheck className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Application Submitted</h2>
            <p className="text-gray-500 mt-2">
              Your business application is now under review. We'll notify you once a moderator approves it.
            </p>
            <p className="text-sm text-gray-400 mt-1">
              You can keep using GreenPlace as a resident in the meantime.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Button onClick={() => navigate('/dashboard')}>Go to Dashboard</Button>
              <Button variant="ghost" onClick={() => navigate('/dashboard/profile')}>
                View Application
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // ============================================================
  // Existing business guard — status aware
  // ============================================================
  if (existingBusiness && existingBusiness.status === 'rejected') {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Application Needs Attention</h2>
            <p className="text-gray-500 mt-2">
              Your application for <strong>{existingBusiness.name}</strong> was not approved.
            </p>
            {existingBusiness.rejection_reason && (
              <p className="text-sm text-red-600 mt-2 bg-red-50 border border-red-100 rounded-lg px-4 py-2 inline-block">
                {existingBusiness.rejection_reason}
              </p>
            )}
            <div className="mt-6 flex justify-center gap-3">
              <Button onClick={handleStartReapply}>Reapply</Button>
              <Button variant="ghost" onClick={() => navigate('/dashboard')}>
                Back to Dashboard
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (existingBusiness && existingBusiness.status === 'pending' && !existingBusiness.submitted_for_review_at) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-amber-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Application Not Submitted</h2>
            <p className="text-gray-500 mt-2">
              Your application for <strong>{existingBusiness.name}</strong> is missing its verification documents.
              Upload all 3 to send it for review.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Button onClick={handleContinueApplication} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
                Continue Application
              </Button>
              <Button variant="ghost" onClick={() => navigate('/dashboard')}>
                Back to Dashboard
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (existingBusiness && existingBusiness.status === 'pending') {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-amber-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Application Under Review</h2>
            <p className="text-gray-500 mt-2">
              Your application for <strong>{existingBusiness.name}</strong> is awaiting moderator approval.
            </p>
            <p className="text-sm text-gray-400 mt-1">
              You can keep using GreenPlace as a resident in the meantime.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Button onClick={() => navigate('/dashboard/profile')}>
                View Business Profile
              </Button>
              <Button variant="ghost" onClick={() => navigate('/dashboard')}>
                Back to Dashboard
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (existingBusiness) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-amber-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Business Already Registered</h2>
            <p className="text-gray-500 mt-2">
              You already have a registered business: <strong>{existingBusiness.name}</strong>
            </p>
            <p className="text-sm text-gray-400 mt-1">
              Status: <span className="font-medium">{formatStatus(existingBusiness.status)}</span>
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Button onClick={() => navigate('/dashboard/profile')}>
                Go to Business Profile
              </Button>
              <Button variant="ghost" onClick={() => navigate('/dashboard')}>
                Back to Dashboard
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Register Your Business</h1>
        <p className="text-gray-500 mt-1">Complete the steps below to register your waste management establishment.</p>
      </div>

      {/* Step indicators */}
      <div className="flex items-center justify-between">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              step === s.id
                ? 'bg-primary-100 text-primary-700'
                : step > s.id
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-500'
            }`}>
              {step > s.id ? <Check className="w-4 h-4" /> : s.icon}
              <span className="hidden sm:inline">{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <ChevronRight className="w-4 h-4 text-gray-300 mx-1 hidden sm:block" />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <Card>
        {errors.submit && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 mb-4">
            {errors.submit}
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 1: Business Info */}
        {/* ============================================================ */}
        {step === 1 && (
          <div className="space-y-4">
            <CardHeader>
              <CardTitle>Business Information</CardTitle>
            </CardHeader>
            <Input
              label="Business Name"
              name="name"
              value={form.name}
              onChange={handleChange}
              error={errors.name}
              placeholder="e.g., Cebu Green Recycling Center"
              required
            />
            <Select
              label="Category"
              name="category"
              value={form.category}
              onChange={handleChange}
              options={CATEGORIES}
              error={errors.category}
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                name="description"
                rows={3}
                value={form.description}
                onChange={handleChange}
                placeholder="Describe your business, what you accept, and your mission..."
                className="block w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 sm:text-sm transition-colors resize-none"
              />
            </div>
            <Input
              label="Street Address"
              name="address"
              value={form.address}
              onChange={handleChange}
              error={errors.address}
              placeholder="e.g., 123 Recycling Ave, Cebu City"
              required
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="City" name="city" value={form.city} onChange={handleChange} error={errors.city} required />
              <Input label="Province" name="province" value={form.province} onChange={handleChange} />
            </div>
            <div className="border border-gray-200 rounded-xl p-4">
              <LocationPicker
                latitude={form.latitude}
                longitude={form.longitude}
                address={form.address ? `${form.address}, ${form.city}, ${form.province}` : ''}
                onChange={(lat, lng) => setForm(prev => ({ ...prev, latitude: lat, longitude: lng }))}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Phone" name="phone" value={form.phone} onChange={handleChange} placeholder="+63 9XX XXX XXXX" />
              <Input label="Email" name="email" type="email" value={form.email} onChange={handleChange} placeholder="business@example.com" />
            </div>
            <Input label="Website" name="website" value={form.website} onChange={handleChange} placeholder="https://..." />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50">
                <input type="checkbox" name="acceptsDropOffs" checked={form.acceptsDropOffs} onChange={handleChange}
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Accepts Drop-offs</p>
                  <p className="text-xs text-gray-500">Residents can schedule recycling drop-offs</p>
                </div>
              </label>
              <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50">
                <input type="checkbox" name="hasMarketplace" checked={form.hasMarketplace} onChange={handleChange}
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Has Marketplace</p>
                  <p className="text-xs text-gray-500">Sell products on the marketplace</p>
                </div>
              </label>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 2: Upload Documents */}
        {/* ============================================================ */}
        {step === 2 && (
          <div className="space-y-4">
            <CardHeader>
              <CardTitle>Verification Documents</CardTitle>
            </CardHeader>
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-800">Documents Required</p>
                  <p className="text-sm text-amber-700 mt-1">
                    All 3 documents are required before an admin can review your business:
                    DTI/SEC Registration, Mayor's/Business Permit and BIR Certificate of Registration.
                    PDF, JPG or PNG, max 5 MB each.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {REQUIRED_DOCUMENTS.map(({ type, label }) => (
                lockedDocs[type] ? (
                  <div key={type} className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl">
                    <FileText className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{label}</p>
                      <p className="text-xs text-gray-500">Already submitted ({lockedDocs[type]})</p>
                    </div>
                  </div>
                ) : (
                  <DocumentUploadField
                    key={type}
                    id={`doc-${type}`}
                    label={label}
                    file={docFiles[type] || null}
                    error={docError(type)}
                    onChange={(file) => pickDocument(type, file)}
                    onRemove={() => pickDocument(type, null)}
                  />
                )
              ))}
            </div>

            {uploadProgress && (
              <p className="text-sm text-gray-500 text-center">{uploadProgress}</p>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 3: Hours & Materials */}
        {/* ============================================================ */}
        {step === 3 && (
          <div className="space-y-6">
            <CardHeader>
              <CardTitle>Operating Hours</CardTitle>
            </CardHeader>
            {hours.map((h, i) => (
              <div key={h.day} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                <div className="w-24">
                  <p className="text-sm font-medium text-gray-900">{DAY_LABELS[h.day]}</p>
                </div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={h.is_closed}
                    onChange={(e) => handleHoursChange(i, 'is_closed', e.target.checked)}
                    className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-600">Closed</span>
                </label>
                {!h.is_closed && (
                  <div className="flex items-center gap-2 ml-auto">
                    <input
                      type="time"
                      value={h.open_time}
                      onChange={(e) => handleHoursChange(i, 'open_time', e.target.value)}
                      className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <span className="text-gray-400">to</span>
                    <input
                      type="time"
                      value={h.close_time}
                      onChange={(e) => handleHoursChange(i, 'close_time', e.target.value)}
                      className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                )}
              </div>
            ))}

            <div className="border-t border-gray-100 pt-6">
              <div className="flex items-center justify-between mb-4">
                <CardTitle>Accepted Materials</CardTitle>
                <Button variant="outline" size="sm" onClick={addMaterial}>+ Add</Button>
              </div>
              {materials.map((m, i) => (
                <div key={i} className="p-4 border border-gray-200 rounded-xl space-y-3 mb-3">
                  <div className="flex items-center justify-between">
                    <Input
                      label="Material Name"
                      value={m.material_name}
                      onChange={(e) => handleMaterialChange(i, 'material_name', e.target.value)}
                      placeholder="e.g., Plastic Bottles"
                      className="flex-1 mr-4"
                    />
                    <button
                      onClick={() => removeMaterial(i)}
                      className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors mt-6"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Input
                      label="Price per kg (₱)"
                      type="number"
                      step="0.01"
                      min="0"
                      value={m.price_per_kg}
                      onChange={(e) => handleMaterialChange(i, 'price_per_kg', e.target.value)}
                      placeholder="0.00"
                    />
                    <Select
                      label="Unit"
                      value={m.unit}
                      onChange={(e) => handleMaterialChange(i, 'unit', e.target.value)}
                      options={[
                        { value: 'kg', label: 'per kg' },
                        { value: 'piece', label: 'per piece' },
                        { value: 'liter', label: 'per liter' },
                      ]}
                    />
                    <Input
                      label="Notes"
                      value={m.description}
                      onChange={(e) => handleMaterialChange(i, 'description', e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* Navigation */}
        {/* ============================================================ */}
        <div className="flex justify-between mt-6 pt-4 border-t border-gray-100">
          {step <= 2 ? (
            <Button variant="ghost" onClick={() => navigate('/dashboard')}>
              {step === 1 ? 'Cancel' : 'Back to Dashboard'}
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => setStep(prev => prev - 1)}>
              <ChevronLeft className="w-4 h-4" />
              Back
            </Button>
          )}

          {step === 1 && (
            <Button onClick={handleCreateBusiness} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
              {loading ? 'Creating...' : 'Create & Continue'}
            </Button>
          )}

          {step === 2 && (
            <Button onClick={handleSubmitDocuments} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
              {loading ? 'Submitting...' : 'Submit documents & continue'}
            </Button>
          )}

          {step === 3 && (
            <div className="flex gap-2">
              <Button variant="ghost" onClick={handleSkipToDashboard}>
                Skip for now
              </Button>
              <Button onClick={handleSaveHoursAndMaterials} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {loading ? 'Saving...' : 'Save & Go to Dashboard'}
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
