/**
 * Onboarding page: shown when a user signs in but doesn't belong to an agency yet.
 * They can create a new agency or be invited to an existing one.
 */
'use client';

import { useState } from 'react';

export default function OnboardingPage() {
  const [agencyName, setAgencyName] = useState('');
  const [creating, setCreating] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch('/api/agencies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: agencyName }),
      });
      if (res.ok) {
        window.location.href = '/dashboard';
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8">
        <h1 className="text-2xl font-bold mb-2">Welcome to PolicyDiff</h1>
        <p className="text-gray-600 mb-6">
          Create your agency to get started.
        </p>
        <form onSubmit={handleCreate}>
          <label htmlFor="agencyName" className="block text-sm font-medium mb-1">
            Agency Name
          </label>
          <input
            id="agencyName"
            type="text"
            required
            value={agencyName}
            onChange={(e) => setAgencyName(e.target.value)}
            className="w-full border rounded-lg px-4 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Acme Insurance Agency"
          />
          <button
            type="submit"
            disabled={creating}
            className="w-full bg-blue-600 text-white rounded-lg px-4 py-2 font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {creating ? 'Creating...' : 'Create Agency'}
          </button>
        </form>
      </div>
    </main>
  );
}
