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
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #111827; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .receipt { max-width: 700px; margin: 0 auto; padding: 24px 32px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; padding-bottom: 14px; border-bottom: 1px solid #e5e7eb; }
  .brand { display: flex; align-items: center; gap: 10px; }
  .logo { width: 32px; height: 32px; background: #16a34a; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 14px; }
  .brand-name { font-size: 16px; font-weight: 700; color: #111827; }
  .brand-sub { font-size: 10px; color: #9ca3af; }
  .title { font-size: 16px; font-weight: 700; letter-spacing: 0.05em; color: #111827; }
  .banner { background: #fffbeb; border: 1px solid #fcd34d; border-radius: 6px; padding: 8px 12px; margin-bottom: 14px; }
  .banner-title { font-size: 12px; font-weight: 700; color: #92400e; }
  .banner-text { font-size: 10px; color: #a16207; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .mb-section { margin-bottom: 14px; padding-bottom: 14px; border-bottom: 1px solid #f3f4f6; }
  .label { font-size: 9px; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 3px; }
  .value { font-size: 12px; font-weight: 500; color: #111827; }
  .value-bold { font-size: 12px; font-weight: 700; color: #111827; }
  .sub { font-size: 10px; color: #6b7280; margin-top: 1px; }
  .text-right { text-align: right; }
  .section-title { font-size: 9px; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
  th { font-size: 9px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; text-align: left; padding: 5px 0; border-bottom: 1px solid #e5e7eb; }
  th.c { text-align: center; } th.r { text-align: right; }
  td { font-size: 12px; padding: 6px 0; border-bottom: 1px solid #f9fafb; color: #111827; }
  td.c { text-align: center; } td.r { text-align: right; }
  td.bold { font-weight: 500; }
  .totals { display: flex; justify-content: flex-end; margin-bottom: 14px; padding-bottom: 14px; border-bottom: 1px solid #f3f4f6; }
  .totals-box { width: 220px; }
  .totals-row { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 3px; color: #111827; }
  .totals-muted { color: #6b7280; }
  .totals-divider { border-top: 1px solid #e5e7eb; margin: 5px 0; padding-top: 5px; }
  .totals-total { font-size: 14px; font-weight: 700; color: #16a34a; }
  .pay-row { display: flex; justify-content: space-between; align-items: center; font-size: 12px; margin-bottom: 3px; }
  .pay-label { color: #6b7280; }
  .pay-value { font-weight: 500; color: #111827; }
  .pay-ref { font-size: 10px; font-family: monospace; background: #f9fafb; padding: 2px 6px; border-radius: 3px; color: #374151; }
  .footer { text-align: center; padding-top: 14px; border-top: 1px solid #f3f4f6; }
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

  const fmt = (amount) => parseFloat(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '—';
  const fmtDateTime = (d) => d ? new Date(d).toLocaleString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

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
      {/* Screen header */}
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

      {/* Receipt — Tailwind for screen, iframe uses PRINT_STYLES for print */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="print-area bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden p-8">

          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-gray-200 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">G</span>
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900">GreenPlace</p>
                <p className="text-xs text-gray-400">Sustainable Living Platform</p>
              </div>
            </div>
            <h2 className="text-lg font-bold text-gray-900 tracking-wide">RECEIPT</h2>
          </div>

          {/* TEST MODE */}
          {isPayMongo && (
            <div className="bg-amber-50 border border-amber-300 rounded-lg px-4 py-2 mb-4">
              <p className="text-sm font-bold text-amber-800">TEST MODE</p>
              <p className="text-xs text-amber-700">This is a test transaction — no real payment was processed.</p>
            </div>
          )}

          {/* Receipt No + Date */}
          <div className="grid grid-cols-2 gap-4 pb-4 border-b border-gray-100 mb-4">
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Receipt No.</p>
              <p className="text-sm font-bold text-gray-900">{order.order_number}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Date</p>
              <p className="text-sm text-gray-700">{fmtDate(order.created_at)}</p>
            </div>
          </div>

          {/* Bill To + Sold By */}
          <div className="grid grid-cols-2 gap-4 pb-4 border-b border-gray-100 mb-4">
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Bill To</p>
              <p className="text-sm font-medium text-gray-900">{order.buyer?.first_name} {order.buyer?.last_name}</p>
              {order.buyer?.email && <p className="text-xs text-gray-500 mt-0.5">{order.buyer.email}</p>}
              {order.buyer?.phone && <p className="text-xs text-gray-500">{order.buyer.phone}</p>}
            </div>
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Sold By</p>
              <p className="text-sm font-medium text-gray-900">{order.business?.name}</p>
              {order.business?.address && <p className="text-xs text-gray-500 mt-0.5">{order.business.address}</p>}
              {order.business?.phone && <p className="text-xs text-gray-500">{order.business.phone}</p>}
            </div>
          </div>

          {/* Items */}
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Items</p>
          <table className="w-full mb-4">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left text-[10px] font-semibold text-gray-500 uppercase pb-1.5">Item</th>
                <th className="text-center text-[10px] font-semibold text-gray-500 uppercase pb-1.5 w-14">Qty</th>
                <th className="text-right text-[10px] font-semibold text-gray-500 uppercase pb-1.5 w-24">Price</th>
                <th className="text-right text-[10px] font-semibold text-gray-500 uppercase pb-1.5 w-24">Total</th>
              </tr>
            </thead>
            <tbody>
              {order.items?.map((item) => (
                <tr key={item.id} className="border-b border-gray-50">
                  <td className="py-2 text-sm font-medium text-gray-900">{item.title}</td>
                  <td className="py-2 text-sm text-gray-600 text-center">{item.quantity}</td>
                  <td className="py-2 text-sm text-gray-600 text-right">₱{fmt(item.price)}</td>
                  <td className="py-2 text-sm font-medium text-gray-900 text-right">₱{fmt(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="flex justify-end mb-4 pb-4 border-b border-gray-100">
            <div className="w-52 space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Subtotal</span>
                <span className="text-gray-700">₱{fmt(order.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Shipping</span>
                <span className="text-green-600 font-medium">Free</span>
              </div>
              <div className="border-t border-gray-200 pt-2 flex justify-between">
                <span className="text-sm font-bold text-gray-900">Total</span>
                <span className="text-base font-bold text-primary-600">₱{fmt(order.total)}</span>
              </div>
            </div>
          </div>

          {/* Payment Details */}
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Payment Details</p>
          <div className="space-y-1.5 mb-4 pb-4 border-b border-gray-100">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Method</span>
              <span className="font-medium text-gray-900">{paymentLabel}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Status</span>
              <span className={`font-medium ${paymentStatusConfig[order.payment_status]?.color || 'text-gray-600'}`}>
                {paymentStatusConfig[order.payment_status]?.label || order.payment_status}
              </span>
            </div>
            {isPayMongo && transactionRef && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Transaction Reference</span>
                <span className="text-xs font-mono text-gray-700 bg-gray-50 px-2 py-0.5 rounded">{transactionRef}</span>
              </div>
            )}
            {latestPayment?.paid_at && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Paid At</span>
                <span className="text-gray-700">{fmtDateTime(latestPayment.paid_at)}</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="text-center pt-2">
            <p className="text-xs text-gray-400">Thank you for supporting sustainable living in Metro Cebu.</p>
            <p className="text-[10px] text-gray-300 mt-0.5">GreenPlace — Connecting communities with eco-friendly waste management</p>
          </div>
        </div>
      </div>
    </div>
  );
}
