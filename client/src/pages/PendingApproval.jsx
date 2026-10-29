import { useState, useEffect, useCallback, useRef } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertCircle, CheckCircle, Clock, FileText, Loader2, LogOut, RefreshCw, Upload, XCircle,
} from 'lucide-react';
import api from '../lib/api';
import { validateDocumentFile, uploadRequiredDocument, DOCUMENT_ACCEPT, formatFileSize } from '../lib/businessDocuments';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/ui/Logo';
import { skipPendingApproval } from '../lib/pendingApproval';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';

const SLOT_STATUS = {
  missing: { label: 'Not uploaded', variant: 'neutral', icon: FileText },
  pending: { label: 'Pending review', variant: 'warning', icon: Clock },
  approved: { label: 'Approved', variant: 'success', icon: CheckCircle },
  rejected: { label: 'Rejected', variant: 'danger', icon: XCircle },
};

// The only screen a business sees until an admin verifies it.
export default function PendingApproval() {
  const { isAuthenticated, loading: authLoading, needsBusinessVerification, fetchProfile, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputs = useRef({});

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [slotErrors, setSlotErrors] = useState({});
  const [busyType, setBusyType] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const notice = location.state?.notice || '';

  const load = useCallback(async () => {
    setError('');
    try {
      const { data: res } = await api.get('/business/documents');
      if (res.business.verification_status === 'Verified') {
        // Approved: refresh the profile so the new role applies, then go to the dashboard
        await fetchProfile();
        navigate('/dashboard', { replace: true });
        return;
      }
      setData(res);
    } catch (err) {
      if (err.response?.data?.code === 'NO_BUSINESS') {
        navigate('/', { replace: true });
        return;
      }
      setError(err.response?.data?.error || 'Failed to load your application status.');
    } finally {
      setLoading(false);
    }
  }, [fetchProfile, navigate]);

  useEffect(() => {
    if (isAuthenticated) load();
  }, [isAuthenticated, load]);

  const handleFile = async (type, e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const invalid = validateDocumentFile(file);
    setSlotErrors((prev) => ({ ...prev, [type]: invalid }));
    if (invalid) return;

    setBusyType(type);
    try {
      await uploadRequiredDocument(api, type, file);
      await load();
    } catch (err) {
      setSlotErrors((prev) => ({ ...prev, [type]: err.response?.data?.error || 'Upload failed. Please try again.' }));
    } finally {
      setBusyType(null);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      await api.post('/business/submit-for-review');
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit for review.');
    } finally {
      setSubmitting(false);
    }
  };

  // Let the owner use GreenPlace as a resident while the application is unfinished or under review
  const handleContinueAsResident = () => {
    skipPendingApproval();
    navigate('/dashboard');
  };

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      navigate('/login', { replace: true });
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  // Nothing to wait on (resident without a business, or already verified)
  if (!needsBusinessVerification && !data) return <Navigate to="/dashboard" replace />;

  const business = data?.business;
  const status = business?.verification_status;
  const isSubmitted = !!business?.submitted_for_review_at;
  const isRejected = status === 'Rejected';

  const heading = isRejected
    ? 'Your application needs changes'
    : isSubmitted
      ? 'Pending approval'
      : 'Finish your application';
  const subheading = isRejected
    ? 'Replace the rejected documents below, then resubmit for review.'
    : isSubmitted
      ? 'Our team is reviewing your documents. You will be notified once a decision is made.'
      : 'Upload all 3 required documents, then submit your business for review.';

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Logo size="lg" />
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handleContinueAsResident}
              className="text-sm font-medium text-primary-600 hover:text-primary-700"
            >
              Go to dashboard
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        {loading ? (
          <div className="py-16 text-center text-gray-500">Loading your application...</div>
        ) : !data ? (
          <div className="space-y-4">
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error || 'Failed to load your application status.'}
            </div>
            <Button variant="outline" size="sm" onClick={load}>Try again</Button>
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight text-gray-900">{heading}</h1>
                <Badge variant={isRejected ? 'danger' : 'warning'}>{isRejected ? 'Rejected' : isSubmitted ? 'In review' : 'Draft'}</Badge>
              </div>
              <p className="mt-1 text-gray-500">{business.name}</p>
              <p className="mt-3 text-sm text-gray-600">{subheading}</p>
            </div>

            {notice && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">{notice}</div>
            )}

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            {isRejected && business.rejection_reason && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800">
                <p className="font-medium">Reason from our team</p>
                <p className="mt-1">{business.rejection_reason}</p>
              </div>
            )}

            <ul className="bg-white border border-gray-200 rounded-2xl divide-y divide-gray-100">
              {data.documents.map((doc) => {
                const meta = SLOT_STATUS[doc.status] || SLOT_STATUS.missing;
                const Icon = meta.icon;
                const busy = busyType === doc.type;
                return (
                  <li key={doc.type} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${
                          doc.status === 'approved' ? 'text-green-600'
                            : doc.status === 'rejected' ? 'text-red-600'
                              : doc.status === 'pending' ? 'text-amber-600' : 'text-gray-400'
                        }`}
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900">{doc.label}</p>
                          {doc.file_name && (
                            <p className="text-xs text-gray-500 truncate">
                              {doc.file_name}{doc.file_size ? ` · ${formatFileSize(doc.file_size)}` : ''}
                            </p>
                          )}
                          {doc.status === 'rejected' && (
                            <p className="mt-1 text-xs text-red-600">
                              {doc.notes ? `Rejected: ${doc.notes}` : 'Rejected. Please upload a corrected copy.'}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <Badge variant={meta.variant}>{meta.label}</Badge>
                        {doc.canReplace && (
                          <>
                            <input
                              ref={(el) => { fileInputs.current[doc.type] = el; }}
                              type="file"
                              accept={DOCUMENT_ACCEPT}
                              className="sr-only"
                              aria-label={`Upload ${doc.label}`}
                              onChange={(e) => handleFile(doc.type, e)}
                            />
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => fileInputs.current[doc.type]?.click()}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-primary-700 border border-primary-200 hover:bg-primary-50 rounded-md transition-colors disabled:opacity-50"
                            >
                              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                              {doc.status === 'missing' ? 'Upload' : 'Replace'}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    {slotErrors[doc.type] && (
                      <p className="mt-2 text-xs text-red-600">{slotErrors[doc.type]}</p>
                    )}
                  </li>
                );
              })}
            </ul>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button variant="ghost" size="sm" onClick={() => { setLoading(true); load(); }}>
                <RefreshCw className="w-4 h-4" />
                Refresh status
              </Button>
              {data.canSubmit && (
                <Button onClick={handleSubmit} disabled={submitting}>
                  {submitting ? 'Submitting...' : isRejected ? 'Resubmit for review' : 'Submit for review'}
                </Button>
              )}
            </div>

            {!data.canSubmit && !isSubmitted && data.missing.length > 0 && (
              <p className="text-xs text-gray-500">
                {data.missing.length} of 3 documents still need to be uploaded before you can submit.
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
