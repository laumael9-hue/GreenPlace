import { useState } from 'react';
import { CheckCircle, XCircle, Loader2, FileText } from 'lucide-react';
import api from '../../lib/api';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import { formatStatus } from '../../lib/formatStatus';

const statusVariant = { approved: 'success', rejected: 'danger' };

// Lists a business's uploaded documents and lets an admin verify or reject each one.
// onUpdated(docId, patch) lets the parent keep its copy of the business in sync.
export default function BusinessDocumentsReview({ documents = [], onUpdated }) {
  const [busyId, setBusyId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  if (documents.length === 0) return null;

  const verify = async (doc, status, noteText = '') => {
    setBusyId(doc.id);
    setError('');
    try {
      await api.patch(`/businesses/admin/documents/${doc.id}/verify`, { status, notes: noteText });
      onUpdated?.(doc.id, { verification_status: status, verification_notes: noteText || null });
      setRejectingId(null);
      setNotes('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update document.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="p-3 bg-gray-50 rounded-lg">
      <p className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-1.5">
        <FileText className="w-4 h-4" />
        Documents ({documents.length})
      </p>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      <div className="space-y-3 text-sm">
        {documents.map((doc) => {
          const status = doc.verification_status || 'pending';
          return (
            <div key={doc.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-gray-700 truncate">{doc.file_name}</p>
                  {doc.document_type && <p className="text-xs text-gray-400">{formatStatus(doc.document_type)}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={statusVariant[status] || 'warning'}>{formatStatus(status)}</Badge>
                  <a href={doc.file_url} target="_blank" rel="noreferrer" className="text-primary-600 hover:underline">View</a>
                </div>
              </div>

              {status === 'pending' && rejectingId !== doc.id && (
                <div className="flex justify-end gap-2 mt-1.5">
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => { setRejectingId(doc.id); setNotes(''); }}
                    disabled={busyId === doc.id}
                  >
                    <XCircle className="w-4 h-4" />
                    Reject
                  </Button>
                  <Button size="sm" onClick={() => verify(doc, 'approved')} disabled={busyId === doc.id}>
                    {busyId === doc.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    Verify
                  </Button>
                </div>
              )}

              {rejectingId === doc.id && (
                <div className="mt-2 space-y-2">
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Why is this document rejected? (the owner is notified)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setRejectingId(null)}>Cancel</Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => verify(doc, 'rejected', notes.trim())}
                      disabled={busyId === doc.id || !notes.trim()}
                    >
                      {busyId === doc.id ? 'Rejecting...' : 'Reject document'}
                    </Button>
                  </div>
                </div>
              )}

              {doc.verification_notes && status === 'rejected' && (
                <p className="mt-1 text-xs text-gray-500">Note: {doc.verification_notes}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
