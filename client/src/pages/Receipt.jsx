import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Printer, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import api from '../lib/api';
import Button from '../components/ui/Button';

const paymentStatusConfig = {
  pending: { label: 'Pending', icon: Clock, color: 'text-yellow-600' },
  paid: { label: 'Paid', icon: CheckCircle, color: 'text-green-600' },
  failed: { label: 'Failed', icon: AlertTriangle, color: 'text-red-600' },
  refunded: { label: 'Refunded', icon: AlertTriangle, color: 'text-red-600' },
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
  .banner { background: #fffbeb; border: 1px solid #fcd34d; border-radius: 6px; padding: 8px 12px; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
  .banner-title { font-size: 12px; font-weight: 700; color: #92400e; }
  .banner-text { font-size: 10px; color: #a16207; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #f3f4f6; }
  .info-label { font-size: 9px; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px; }
  .info-value { font-size: 12px; font-weight: 500; }
  .info-sub { font-size: 10px; color: #6b7280; margin-top: 1px; }
  .info-right { text-align: right; }
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
  .payment-row { display: flex; justify-content: space-between; align-items: center; font-size: 12px; margin-bottom: 3px; }
  .payment-label { color: #6b7280; }
  .payment-value { font-weight: 500; }
  .payment-ref { font-size: 10px; font-family: monospace; background: #f9fafb; padding: 2px 6px; border-radius: 3px; }
  .section-title { font-size: 9px; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
  .footer { text-align: center; padding-top: 12px; border-top: 1px solid #f3f4f6; }
  .footer p { font-size: 10px; color: #9ca3af; }
  .footer .sub { font-size: 9px; color: #d1d5db; margin-top: 2px; }
  @page { margin: 0.4in; size: A4; }
`;

export default function Receipt() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const { data } = await api.get(`/orders/${id}`);
        setOrder(data.order);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load receipt');
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [id]);

  const handlePrint = useCallback(() => {
    const printArea = document.querySelector('.print-area');
    if (!printArea || !order) return;

    const fileName = `GreenPlace-Receipt-${order.order_number || 'Receipt'}`;

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
  }, [order]);

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

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isPayMongo = order?.payment_method?.startsWith('paymongo_');
  const paymentLabel = order?.payment_method?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || '—';
  const latestPayment = order?.payments?.[0];
  const transactionRef = latestPayment?.paymongo_payment_id || null;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  if (error && !order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-4">
          <AlertTriangle className="w-12 h-12 text-red-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-500 mb-6">{error}</p>
          <Button onClick={() => navigate('/orders')}>Back to Orders</Button>
        </div>
      </div>
    );
  }

  if (!order) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link to={`/orders/${order.id}`} className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium">
            <ArrowLeft className="w-4 h-4" />
            Back to Order
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
              <div className="title">RECEIPT</div>
            </div>

            {isPayMongo && (
              <div className="banner">
                <div>
                  <div className="banner-title">TEST MODE</div>
                  <div className="banner-text">This is a test transaction — no real payment was processed.</div>
                </div>
              </div>
            )}

            <div className="info-grid">
              <div>
                <div className="info-label">Receipt No.</div>
                <div className="info-value" style={{ fontWeight: 700 }}>{order.order_number}</div>
              </div>
              <div className="info-right">
                <div className="info-label">Date</div>
                <div className="info-value">{formatDate(order.created_at)}</div>
              </div>
            </div>

            <div className="info-grid">
              <div>
                <div className="info-label">Bill To</div>
                <div className="info-value">{order.buyer?.first_name} {order.buyer?.last_name}</div>
                {order.buyer?.email && <div className="info-sub">{order.buyer.email}</div>}
                {order.buyer?.phone && <div className="info-sub">{order.buyer.phone}</div>}
              </div>
              <div>
                <div className="info-label">Sold By</div>
                <div className="info-value">{order.business?.name}</div>
                {order.business?.address && <div className="info-sub">{order.business.address}</div>}
                {order.business?.phone && <div className="info-sub">{order.business.phone}</div>}
              </div>
            </div>

            <div className="section-title">Items</div>
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Price</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {order.items?.map((item) => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 500 }}>{item.title}</td>
                    <td>{item.quantity}</td>
                    <td>₱{formatCurrency(item.price)}</td>
                    <td style={{ fontWeight: 500 }}>₱{formatCurrency(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="totals">
              <div className="totals-box">
                <div className="totals-row">
                  <span className="totals-label">Subtotal</span>
                  <span>₱{formatCurrency(order.subtotal)}</span>
                </div>
                <div className="totals-row">
                  <span className="totals-label">Shipping</span>
                  <span style={{ color: '#16a34a', fontWeight: 500 }}>Free</span>
                </div>
                <div className="totals-divider totals-row">
                  <span style={{ fontWeight: 700 }}>Total</span>
                  <span className="totals-total">₱{formatCurrency(order.total)}</span>
                </div>
              </div>
            </div>

            <div className="section-title">Payment Details</div>
            <div className="payment-row">
              <span className="payment-label">Method</span>
              <span className="payment-value">{paymentLabel}</span>
            </div>
            <div className="payment-row">
              <span className="payment-label">Status</span>
              <span className="payment-value">{paymentStatusConfig[order.payment_status]?.label || order.payment_status}</span>
            </div>
            {isPayMongo && transactionRef && (
              <div className="payment-row">
                <span className="payment-label">Transaction Reference</span>
                <span className="payment-ref">{transactionRef}</span>
              </div>
            )}
            {latestPayment?.paid_at && (
              <div className="payment-row">
                <span className="payment-label">Paid At</span>
                <span>{formatDateTime(latestPayment.paid_at)}</span>
              </div>
            )}

            <div className="footer">
              <p>Thank you for supporting sustainable living in Metro Cebu.</p>
              <p className="sub">GreenPlace — Connecting communities with eco-friendly waste management</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
