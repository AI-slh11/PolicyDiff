'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NewCheckPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [expiringFile, setExpiringFile] = useState<File | null>(null);
  const [renewalFile, setRenewalFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!expiringFile || !renewalFile) {
      setErrorMessage('Please select both the expiring and renewal policy PDF files.');
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);

    const formData = new FormData();
    formData.append('title', title || 'Commercial Policy Comparison');
    formData.append('expiringPolicy', expiringFile);
    formData.append('renewalPolicy', renewalFile);

    try {
      const res = await fetch('/api/checks', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Failed to upload and ingest policy documents.');
        setIsUploading(false);
        return;
      }

      // Automatically trigger extraction & diff, then redirect to review
      router.push(`/checks/${data.policyCheckId}`);
    } catch (err: any) {
      setErrorMessage('Network error during upload. Please try again.');
      setIsUploading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="text-sm font-medium text-blue-600 hover:text-blue-800"
          >
            &larr; Back to Dashboard
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-8 border-b border-gray-200 bg-slate-900 text-white">
            <h1 className="text-2xl font-bold">New Policy Comparison</h1>
            <p className="mt-1 text-sm text-slate-300">
              Upload two PDFs (expiring vs. renewal, or quote vs. binder). The engine extracts coverage data with citations and computes a deterministic diff.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-6">
            {errorMessage && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
                {errorMessage}
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Comparison Title / Client Name
              </label>
              <input
                type="text"
                placeholder="e.g. Acme Hardware - 2026 Commercial Package Renewal"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Expiring Policy File */}
              <div className="border-2 border-dashed border-gray-300 rounded-2xl p-6 text-center hover:border-blue-500 transition-colors bg-gray-50/50">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full">
                  1. Expiring Policy (Old)
                </span>
                <p className="mt-3 text-xs text-gray-500">
                  Prior term policy or quote (PDF up to 50MB)
                </p>
                <input
                  type="file"
                  accept="application/pdf"
                  required
                  onChange={(e) => setExpiringFile(e.target.files?.[0] || null)}
                  className="mt-4 text-xs text-gray-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
                />
                {expiringFile && (
                  <p className="mt-2 text-xs font-semibold text-emerald-600 truncate">
                    &#10003; {expiringFile.name} ({(expiringFile.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                )}
              </div>

              {/* Renewal Policy File */}
              <div className="border-2 border-dashed border-gray-300 rounded-2xl p-6 text-center hover:border-purple-500 transition-colors bg-gray-50/50">
                <span className="text-xs font-bold uppercase tracking-wider text-purple-700 bg-purple-50 px-2.5 py-1 rounded-full">
                  2. Renewal Policy (New)
                </span>
                <p className="mt-3 text-xs text-gray-500">
                  New term policy or binder (PDF up to 50MB)
                </p>
                <input
                  type="file"
                  accept="application/pdf"
                  required
                  onChange={(e) => setRenewalFile(e.target.files?.[0] || null)}
                  className="mt-4 text-xs text-gray-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-700 cursor-pointer"
                />
                {renewalFile && (
                  <p className="mt-2 text-xs font-semibold text-emerald-600 truncate">
                    &#10003; {renewalFile.name} ({(renewalFile.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                )}
              </div>
            </div>

            {/* Privacy & Security Note */}
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-xs text-slate-600 space-y-1">
              <p className="font-semibold text-slate-800">
                Security &amp; Data Handling Principles:
              </p>
              <p>&bull; Encrypted at rest using AES-256 server-side encryption.</p>
              <p>&bull; Auto-deleted according to your agency retention settings.</p>
              <p>&bull; Never used for AI training; contents are never logged.</p>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={isUploading}
                className="w-full sm:w-auto px-8 py-3 rounded-xl font-semibold text-sm bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isUploading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Uploading &amp; Ingesting Text Layers...
                  </>
                ) : (
                  'Upload & Start Comparison'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
