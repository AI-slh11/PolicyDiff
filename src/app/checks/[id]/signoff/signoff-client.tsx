'use client';

import { useState } from 'react';
import Link from 'next/link';

interface SignoffClientProps {
  policyCheck: {
    id: string;
    title: string;
    status: string;
  };
  reviewerName: string;
  allCriticalReviewed: boolean;
  unreviewedCriticalCount: number;
  totalDiffItemsCount: number;
  existingSignoff: any | null;
}

export function SignoffClient({
  policyCheck,
  reviewerName,
  allCriticalReviewed,
  unreviewedCriticalCount,
  totalDiffItemsCount,
  existingSignoff: initialSignoff,
}: SignoffClientProps) {
  const [signoff, setSignoff] = useState(initialSignoff);
  const [status, setStatus] = useState<'APPROVED' | 'FLAGGED'>('APPROVED');
  const [notes, setNotes] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSignoff(e: React.FormEvent) {
    e.preventDefault();
    if (!confirmed) {
      setErrorMessage('You must confirm that you have reviewed the highlighted differences.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/checks/${policyCheck.id}/signoff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, notes }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Failed to complete sign-off.');
        setLoading(false);
        return;
      }

      setSignoff(data.signoff);
    } catch (err) {
      setErrorMessage('Network error during sign-off.');
    } finally {
      setLoading(false);
    }
  }

  const isSignedOff = !!signoff;

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <Link
            href={`/checks/${policyCheck.id}`}
            className="text-sm font-medium text-blue-600 hover:text-blue-800"
          >
            &larr; Back to Diff Review Screen
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-8 bg-slate-900 text-white">
            <h1 className="text-2xl font-bold">Human Professional Sign-Off &amp; Exports</h1>
            <p className="mt-1 text-sm text-slate-300">{policyCheck.title}</p>
          </div>

          <div className="p-8 space-y-6">
            {/* Non-negotiable principle callout */}
            <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 space-y-1">
              <strong className="block text-sm">NON-NEGOTIABLE PRINCIPLE 4</strong>
              <p>
                PolicyDiff assists human review; it never replaces it. A licensed insurance professional must sign off on the comparison before exports are generated.
              </p>
            </div>

            {/* Critical items review validation gate */}
            {!allCriticalReviewed && !isSignedOff && (
              <div className="p-5 rounded-xl bg-red-50 border border-red-200">
                <h3 className="text-sm font-bold text-red-900">Sign-Off Gate Blocked</h3>
                <p className="mt-1 text-xs text-red-700">
                  There are <strong>{unreviewedCriticalCount} critical diff item(s)</strong> still marked as &ldquo;Pending&rdquo;. Every critical difference (limit reductions, new exclusions, removed coverages) must be explicitly <strong>Accepted</strong> or <strong>Flagged</strong> before sign-off.
                </p>
                <div className="mt-3">
                  <Link
                    href={`/checks/${policyCheck.id}`}
                    className="inline-block text-xs font-semibold bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg"
                  >
                    Return to Review Table &rarr;
                  </Link>
                </div>
              </div>
            )}

            {errorMessage && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
                {errorMessage}
              </div>
            )}

            {/* Completed Sign-off State */}
            {isSignedOff ? (
              <div className="space-y-6">
                <div className="p-5 rounded-xl bg-emerald-50 border border-emerald-200 text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-600 font-bold text-lg">&#10003;</span>
                    <h3 className="text-sm font-bold text-emerald-900">
                      Sign-Off Completed &amp; Audit Logged
                    </h3>
                  </div>
                  <div className="mt-2 text-xs text-emerald-800 space-y-1">
                    <p>
                      <strong>Reviewer:</strong> {reviewerName}
                    </p>
                    <p>
                      <strong>Timestamp:</strong> {new Date(signoff.signedOffAt).toLocaleString()}
                    </p>
                    <p>
                      <strong>Audit Status:</strong> {signoff.status}
                    </p>
                    {signoff.notes && (
                      <p>
                        <strong>Notes:</strong> {signoff.notes}
                      </p>
                    )}
                  </div>
                </div>

                {/* PDF Export Download Buttons */}
                <div className="border border-gray-200 rounded-xl p-5 bg-gray-50/50 space-y-4">
                  <h3 className="text-sm font-bold text-gray-900">Download Official PolicyDiff Exports</h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* (a) E&O Audit Checklist */}
                    <a
                      href={`/api/checks/${policyCheck.id}/export/eo-checklist`}
                      className="p-4 rounded-xl bg-white border border-slate-300 hover:border-blue-500 shadow-xs flex flex-col justify-between transition-colors text-left"
                    >
                      <div>
                        <span className="text-xs font-bold text-blue-700 uppercase tracking-wider block">
                          Document (a)
                        </span>
                        <h4 className="text-sm font-bold text-gray-900 mt-1">E&amp;O Audit Checklist PDF</h4>
                        <p className="text-xs text-gray-500 mt-1">
                          Timestamped with reviewer signature and verified page citations for agency errors &amp; omissions defense.
                        </p>
                      </div>
                      <span className="mt-4 text-xs font-semibold text-blue-600 hover:underline">
                        Download E&amp;O PDF &darr;
                      </span>
                    </a>

                    {/* (b) Client Renewal Comparison */}
                    <a
                      href={`/api/checks/${policyCheck.id}/export/client-summary`}
                      className="p-4 rounded-xl bg-white border border-slate-300 hover:border-purple-500 shadow-xs flex flex-col justify-between transition-colors text-left"
                    >
                      <div>
                        <span className="text-xs font-bold text-purple-700 uppercase tracking-wider block">
                          Document (b)
                        </span>
                        <h4 className="text-sm font-bold text-gray-900 mt-1">Renewal Comparison PDF</h4>
                        <p className="text-xs text-gray-500 mt-1">
                          Client-friendly executive comparison with agency branding and plain-English change explanations.
                        </p>
                      </div>
                      <span className="mt-4 text-xs font-semibold text-purple-600 hover:underline">
                        Download Client PDF &darr;
                      </span>
                    </a>
                  </div>
                </div>
              </div>
            ) : (
              /* Sign-off Form */
              allCriticalReviewed && (
                <form onSubmit={handleSignoff} className="space-y-5 text-left">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Sign-Off Status
                    </label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input
                          type="radio"
                          name="status"
                          value="APPROVED"
                          checked={status === 'APPROVED'}
                          onChange={() => setStatus('APPROVED')}
                          className="text-emerald-600 focus:ring-emerald-500"
                        />
                        <span>Approved — Renewal terms acceptable</span>
                      </label>
                      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input
                          type="radio"
                          name="status"
                          value="FLAGGED"
                          checked={status === 'FLAGGED'}
                          onChange={() => setStatus('FLAGGED')}
                          className="text-amber-600 focus:ring-amber-500"
                        />
                        <span>Flagged — Requires underwriter discussion</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Professional Review Notes / Sign-Off Comments
                    </label>
                    <textarea
                      rows={3}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="e.g. Reviewed all GL and Property changes. Endorsement CG 21 49 flagged for discussion with carrier underwriter regarding pollution carveback."
                      className="w-full text-xs p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="flex items-start gap-2 pt-2">
                    <input
                      type="checkbox"
                      id="confirmReview"
                      required
                      checked={confirmed}
                      onChange={(e) => setConfirmed(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <label htmlFor="confirmReview" className="text-xs text-gray-700 cursor-pointer">
                      I, <strong>{reviewerName}</strong>, hereby confirm that I have personally reviewed all {totalDiffItemsCount} highlighted differences, inspected the cited source PDF regions, and assume professional responsibility for this policy comparison.
                    </label>
                  </div>

                  <div className="pt-4 border-t flex justify-end">
                    <button
                      type="submit"
                      disabled={loading || !confirmed}
                      className="px-8 py-3 rounded-xl font-semibold text-sm bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-sm disabled:opacity-50"
                    >
                      {loading ? 'Recording Sign-Off...' : 'Execute Professional Sign-Off & Unlock Exports'}
                    </button>
                  </div>
                </form>
              )
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
