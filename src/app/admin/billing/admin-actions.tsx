'use client';

import { useState } from 'react';

interface AdminActionsProps {
  invoiceId: string;
  invoiceNumber: string;
  amountCents: number;
  amountPaidCents: number;
  status: string;
}

export function AdminActions({
  invoiceId,
  invoiceNumber,
  amountCents,
  amountPaidCents,
  status,
}: AdminActionsProps) {
  const [modalOpen, setModalOpen] = useState<'PAYMENT' | 'VOID' | 'REISSUE' | null>(null);
  const [loading, setLoading] = useState(false);
  const [paymentAmountDollars, setPaymentAmountDollars] = useState(
    ((amountCents - amountPaidCents) / 100).toFixed(2)
  );
  const [reference, setReference] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [voidReason, setVoidReason] = useState('');

  async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const cents = Math.round(parseFloat(paymentAmountDollars) * 100);
      const res = await fetch(`/api/admin/billing/invoices/${invoiceId}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountCents: cents,
          reference: reference || 'WIRE_TRANSFER',
          paymentDate,
          notes,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(`Error: ${data.error || 'Failed to record payment'}`);
        return;
      }

      window.location.reload();
    } catch (err) {
      alert('Network error recording payment');
    } finally {
      setLoading(false);
    }
  }

  async function handleVoid(e: React.FormEvent) {
    e.preventDefault();
    if (!confirm(`Are you sure you want to VOID invoice ${invoiceNumber}?`)) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/billing/invoices/${invoiceId}/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: voidReason || 'Voided by administrator' }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(`Error: ${data.error || 'Failed to void invoice'}`);
        return;
      }

      window.location.reload();
    } finally {
      setLoading(false);
    }
  }

  async function handleReissue() {
    if (!confirm(`Reissue invoice ${invoiceNumber}? This will void the current invoice and create a new one.`)) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/billing/invoices/${invoiceId}/reissue`, {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json();
        alert(`Error: ${data.error || 'Failed to reissue invoice'}`);
        return;
      }

      window.location.reload();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="inline-flex items-center gap-2">
      {status !== 'PAID' && status !== 'VOID' && (
        <button
          onClick={() => setModalOpen('PAYMENT')}
          className="text-xs font-semibold px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded transition-colors shadow-xs"
        >
          Mark Paid / Partial
        </button>
      )}

      {status !== 'PAID' && status !== 'VOID' && (
        <button
          onClick={() => setModalOpen('VOID')}
          className="text-xs font-semibold px-2 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded transition-colors"
        >
          Void
        </button>
      )}

      {status !== 'PAID' && (
        <button
          onClick={handleReissue}
          disabled={loading}
          className="text-xs font-semibold px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded transition-colors disabled:opacity-50"
        >
          Reissue
        </button>
      )}

      {/* Record Payment Modal */}
      {modalOpen === 'PAYMENT' && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl text-left border border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 mb-1">
              Record Bank Wire Payment
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Invoice <strong>{invoiceNumber}</strong> (Total: ${(amountCents / 100).toFixed(2)}, Paid: ${(amountPaidCents / 100).toFixed(2)})
            </p>

            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Payment Amount Received (USD)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={paymentAmountDollars}
                  onChange={(e) => setPaymentAmountDollars(e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Bank Reference / Wire Confirmation #
                </label>
                <input
                  type="text"
                  placeholder="e.g. WIRE-20261120-9481"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded-lg p-2"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Payment Date
                </label>
                <input
                  type="date"
                  required
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded-lg p-2"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Notes / Audit Details (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Notes recorded by admin"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded-lg p-2"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setModalOpen(null)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Confirm & Save Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Void Modal */}
      {modalOpen === 'VOID' && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl text-left border border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 mb-1">
              Void Invoice {invoiceNumber}
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Voiding cancels this invoice. This action is permanently audit-logged.
            </p>

            <form onSubmit={handleVoid} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Reason for Voiding
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Client requested plan adjustment prior to payment"
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded-lg p-2"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setModalOpen(null)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50"
                >
                  {loading ? 'Voiding...' : 'Confirm Void'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
