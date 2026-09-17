import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Printer, AlertTriangle } from 'lucide-react';
import api from '../lib/api';
import Button from '../components/ui/Button';

const statusLabels = {
  scheduled: 'Pending',
  in_transit: 'In Transit',
  received: 'Received',
  processed: 'Completed',
  cancelled: 'Cancelled',
};

const PRINT_STYLES = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #111827; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .receipt { max-width: 700px; margin: 0 auto; padding: 24px 32px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #e5e7eb; }
  .brand { display: flex; align-items: center; gap: 10px; }
  .logo { width: 32px; height: 32px; background: #16a34a; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 14px; }
  .brand-name { font-size: 16px; font-weight: 700; }
  .brand-sub { font-size: 10px; color: #9ca3af; }
  .title { font-size: 16px; font-weight: 700; letter-spacing: 0.05em; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #f3f4f6; }
  .info-label { font-size: 9px; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px; }
  .info-value { font-size: 12px; font-weight: 500; }
  .info-sub { font-size: 10px; color: #6b7280; margin-top: 1px; }
  .info-right { text-align: right; }
  .status-line { margin-top: 6px; }
  .status-label { font-size: 9px; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px; }
  .status-value { font-size: 12px; font-weight: 700; }
  .status-processed { color: #16a34a; }
  .status-received { color: #2563eb; }
  .status-scheduled { color: #d97706; }
  .status-cancelled { color: #dc2626; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  th { font-size: 9px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; text-align: left; padding: 4px 0; border-bottom: 1px solid #e5e7eb; }
  th:nth-child(2) { text-align: center; }
  th:nth-child(3), th:nth-child(4) { text-align: right; }
  td { font-size: 12px; padding: 5px 0; border-bottom: 1px solid #f9fafb; }
  td:nth-child(2) { text-align: center; }
  td:nth-child(3), td:nth-child(4) { text-align: right; }
  .totals { display: flex; justify-content: flex-end; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #f3f4f6; }
  .totals-box { width: 220px; }
  .totals-row { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 3px; }
  .totals-label { color: #6b7280; }
  .totals-divider { border-top: 1px solid #e5e7eb; margin: 4px 0; padding-top: 4px; }
  .totals-total { font-size: 14px; font-weight: 700; color: #16a34a; }
  .notes-box { margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #f3f4f6; }
  .section-title { font-size: 9px; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
  .notes-text { font-size: 12px; color: #374151; }
  .footer { text-align: center; padding-top: 12px; border-top: 1px solid #f3f4f6; }
  .footer p { font-size: 10px; color: #9ca3af; }
  .footer .sub { font-size: 9px; color: #d1d5db; margin-top: 2px; }
  @page { margin: 0.4in; size: A4; }
`;

export default function DropOffReceipt() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [dropOff, setDropOff] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDropOff = async () => {
      try {
        const { data } = await api.get(`/drop-offs/${id}`);
        setDropOff(data.dropOff);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load receipt');
      } finally {
        setLoading(false);
      }
    };
    fetchDropOff();
  }, [id]);

  const handlePrint = useCallback(() => {
    const printArea = document.querySelector('.print-area');
    if (!printArea || !dropOff) return;

    const fileName = `GreenPlace-DropOff-${dropOff.reference_number || 'Receipt'}`;

    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:none;';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`<!DOCTYPE html><html><head><title>${fileName}</title><style>${PRINT_STYLES}</style></head><body>${printArea.innerHTML}</body></html>`);
    doc.close();

    iframe.contentWindow.focus();
    iframe.contentWindow.print();

    setTimeout(() => { document.body.removeChild(iframe); }, 1500);
  }, [dropOff]);

  const formatCurrency = (amount) => {
    return parseFloat(amount || 0).toLocaleString('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-PH', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const statusLabel = statusLabels[dropOff?.status] || 'Pending';
  const residentName = dropOff?.resident
    ? `${dropOff.resident.first_name} ${dropOff.resident.last_name}`
    : dropOff?.guest_name || '—';
  const residentPhone = dropOff?.resident?.phone || dropOff?.guest_phone || null;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  if (error && !dropOff) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-4">
          <AlertTriangle className="w-12 h-12 text-red-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-500 mb-6">{error}</p>
          <Button onClick={() => navigate('/drop-offs')}>Back to Drop-offs</Button>
        </div>
      </div>
    );
  }

  if (!dropOff) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link to="/drop-offs" className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium">
            <ArrowLeft className="w-4 h-4" />
            Back to Drop-offs
          </Link>
          <Button onClick={handlePrint} size="sm">
            <Printer className="w-4 h-4" />
            Print Receipt
          </Button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="print-area bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="receipt">
            <div className="header">
              <div className="brand">
                <div className="logo">G</div>
                <div>
                  <div className="brand-name">GreenPlace</div>
                  <div className="brand-sub">Sustainable Living Platform</div>
                </div>
              </div>
              <div className="title">DROP-OFF RECEIPT</div>
            </div>

            <div className="info-grid">
              <div>
                <div className="info-label">Receipt No.</div>
                <div className="info-value" style={{ fontWeight: 700, fontFamily: 'monospace' }}>{dropOff.reference_number}</div>
              </div>
              <div className="info-right">
                <div className="info-label">Date</div>
                <div className="info-value">{formatDate(dropOff.created_at)}</div>
              </div>
            </div>

            <div className="status-line">
              <div className="status-label">Status</div>
              <div className={`status-value status-${dropOff.status}`}>{statusLabel}</div>
            </div>

            <div className="info-grid">
              <div>
                <div className="info-label">Submitted By</div>
                <div className="info-value">{residentName}</div>
                {residentPhone && <div className="info-sub">{residentPhone}</div>}
              </div>
              <div>
                <div className="info-label">Facility</div>
                <div className="info-value">{dropOff.business?.name}</div>
                {dropOff.business?.address && <div className="info-sub">{dropOff.business.address}</div>}
                {dropOff.business?.phone && <div className="info-sub">{dropOff.business.phone}</div>}
              </div>
            </div>

            <div className="section-title">Materials</div>
            <table>
              <thead>
                <tr>
                  <th>Material</th>
                  <th>Quantity</th>
                  <th>Est. Value</th>
                  <th>Actual Value</th>
                </tr>
              </thead>
              <tbody>
                {(dropOff.drop_off_items || []).map((item) => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 500 }}>{item.material_name}</td>
                    <td>{parseFloat(item.quantity).toFixed(1)} {item.unit}</td>
                    <td>₱{formatCurrency(item.estimated_value)}</td>
                    <td style={{ fontWeight: 500 }}>₱{formatCurrency(item.actual_value || item.estimated_value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="totals">
              <div className="totals-box">
                <div className="totals-row">
                  <span className="totals-label">Total Weight</span>
                  <span>{parseFloat(dropOff.total_weight_kg || 0).toFixed(1)} kg</span>
                </div>
                <div className="totals-row">
                  <span className="totals-label">Estimated Value</span>
                  <span>₱{formatCurrency(dropOff.estimated_value)}</span>
                </div>
                <div className="totals-divider totals-row">
                  <span style={{ fontWeight: 700 }}>Actual Payout</span>
                  <span className="totals-total">₱{formatCurrency(dropOff.actual_value || dropOff.estimated_value)}</span>
                </div>
              </div>
            </div>

            {dropOff.notes && (
              <div className="notes-box">
                <div className="section-title">Notes</div>
                <div className="notes-text">{dropOff.notes}</div>
              </div>
            )}

            {dropOff.business_notes && (
              <div className="notes-box">
                <div className="section-title">Facility Notes</div>
                <div className="notes-text">{dropOff.business_notes}</div>
              </div>
            )}

            <div className="footer">
              <p>Thank you for recycling and supporting sustainable living in Metro Cebu.</p>
              <p className="sub">GreenPlace — Connecting communities with eco-friendly waste management</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
