'use client';

import { useState } from 'react';
import Link from 'next/link';

interface ReviewClientProps {
  policyCheck: {
    id: string;
    title: string;
    status: string;
  };
  expiringDoc: {
    id: string;
    originalFilename: string;
    pageCount: number | null;
  } | null;
  renewalDoc: {
    id: string;
    originalFilename: string;
    pageCount: number | null;
  } | null;
  diffItems: any[];
  textBlocks: any[];
}

export function ReviewClient({
  policyCheck,
  expiringDoc,
  renewalDoc,
  diffItems: initialDiffItems,
  textBlocks,
}: ReviewClientProps) {
  const [diffItems, setDiffItems] = useState(initialDiffItems);
  const [selectedItem, setSelectedItem] = useState<any>(initialDiffItems[0] || null);
  const [activeDocRole, setActiveDocRole] = useState<'EXPIRING' | 'RENEWAL'>('RENEWAL');
  const [activePage, setActivePage] = useState<number>(1);
  const [filterSeverity, setFilterSeverity] = useState<string>('ALL');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState<string>('');

  // Handle row click: jump to page and active document
  function handleSelectRow(item: any) {
    setSelectedItem(item);
    if (item.newCitation && item.newCitation.page) {
      setActiveDocRole('RENEWAL');
      setActivePage(item.newCitation.page);
    } else if (item.oldCitation && item.oldCitation.page) {
      setActiveDocRole('EXPIRING');
      setActivePage(item.oldCitation.page);
    }
  }

  // Update Review Status (Accept / Flag)
  async function handleUpdateStatus(itemId: string, status: 'ACCEPTED' | 'FLAGGED', note?: string) {
    try {
      const res = await fetch(`/api/checks/${policyCheck.id}/diff-items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewStatus: status, reviewNote: note }),
      });

      if (res.ok) {
        setDiffItems((prev) =>
          prev.map((i) =>
            i.id === itemId
              ? { ...i, reviewStatus: status, reviewNote: note !== undefined ? note : i.reviewNote }
              : i
          )
        );
        if (selectedItem?.id === itemId) {
          setSelectedItem((prev: any) => ({
            ...prev,
            reviewStatus: status,
            reviewNote: note !== undefined ? note : prev.reviewNote,
          }));
        }
      }
    } catch (e) {
      alert('Failed to save review status');
    }
  }

  // Filter items
  const filteredItems = diffItems.filter((i) => {
    if (filterSeverity === 'ALL') return true;
    return i.severity === filterSeverity;
  });

  const criticalItems = diffItems.filter((i) => i.severity === 'CRITICAL');
  const allCriticalReviewed = criticalItems.every((i) => i.reviewStatus !== 'PENDING');

  const activeDoc = activeDocRole === 'RENEWAL' ? renewalDoc : expiringDoc;
  const currentDocBlocks = textBlocks.filter(
    (b) => b.documentId === activeDoc?.id && b.page === activePage
  );

  return (
    <div className="flex flex-col h-screen bg-gray-100 overflow-hidden">
      {/* Top Navigation Bar */}
      <header className="bg-slate-900 text-white px-6 py-3.5 flex items-center justify-between border-b border-slate-800 flex-shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-xs text-slate-400 hover:text-white">
            &larr; Dashboard
          </Link>
          <div className="h-4 w-px bg-slate-700" />
          <h1 className="text-base font-bold truncate max-w-md">{policyCheck.title}</h1>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-semibold border border-blue-500/30">
            {policyCheck.status}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-xs text-slate-400 hidden sm:block">
            {diffItems.filter((i) => i.reviewStatus === 'ACCEPTED').length} Accepted /{' '}
            {diffItems.filter((i) => i.reviewStatus === 'FLAGGED').length} Flagged /{' '}
            {criticalItems.filter((i) => i.reviewStatus === 'PENDING').length} Critical Unreviewed
          </div>

          <Link
            href={`/checks/${policyCheck.id}/signoff`}
            className={`text-xs font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm ${
              allCriticalReviewed
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-amber-600 hover:bg-amber-700 text-white'
            }`}
          >
            {allCriticalReviewed ? 'Ready for Human Sign-Off &rarr;' : 'Review Critical Items First'}
          </Link>
        </div>
      </header>

      {/* Two-Pane Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* ── LEFT PANE: DETERMINISTIC DIFF TABLE (55%) ── */}
        <div className="w-7/12 border-r border-gray-300 flex flex-col bg-white overflow-hidden">
          {/* Filter Pills */}
          <div className="p-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFilterSeverity('ALL')}
                className={`text-xs px-2.5 py-1 rounded-md font-semibold ${
                  filterSeverity === 'ALL'
                    ? 'bg-slate-900 text-white'
                    : 'bg-white text-gray-700 border border-gray-300'
                }`}
              >
                All ({diffItems.length})
              </button>
              <button
                onClick={() => setFilterSeverity('CRITICAL')}
                className={`text-xs px-2.5 py-1 rounded-md font-semibold ${
                  filterSeverity === 'CRITICAL'
                    ? 'bg-red-600 text-white'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}
              >
                Critical ({criticalItems.length})
              </button>
              <button
                onClick={() => setFilterSeverity('WARNING')}
                className={`text-xs px-2.5 py-1 rounded-md font-semibold ${
                  filterSeverity === 'WARNING'
                    ? 'bg-amber-600 text-white'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}
              >
                Warning ({diffItems.filter((i) => i.severity === 'WARNING').length})
              </button>
              <button
                onClick={() => setFilterSeverity('INFO')}
                className={`text-xs px-2.5 py-1 rounded-md font-semibold ${
                  filterSeverity === 'INFO'
                    ? 'bg-blue-600 text-white'
                    : 'bg-blue-50 text-blue-700 border border-blue-200'
                }`}
              >
                Info ({diffItems.filter((i) => i.severity === 'INFO').length})
              </button>
            </div>
            <span className="text-xs text-gray-500">Sorted by Severity</span>
          </div>

          {/* Diff Items List */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-200">
            {filteredItems.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500">
                No changes matching the selected filter.
              </div>
            ) : (
              filteredItems.map((item) => {
                const isSelected = selectedItem?.id === item.id;
                const isLowConfidence = item.confidence && item.confidence < 0.85;

                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelectRow(item)}
                    className={`p-4 transition-colors cursor-pointer text-left ${
                      isSelected ? 'bg-blue-50/70 ring-2 ring-inset ring-blue-500' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        {/* Severity Badge */}
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            item.severity === 'CRITICAL'
                              ? 'bg-red-100 text-red-800 border border-red-200'
                              : item.severity === 'WARNING'
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-blue-100 text-blue-800 border border-blue-200'
                          }`}
                        >
                          {item.severity}
                        </span>
                        <span className="text-xs font-semibold text-gray-600">{item.category}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Low Confidence Flag */}
                        {isLowConfidence && (
                          <span className="text-xs font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded flex items-center gap-1 border border-amber-300">
                            ⚠️ Low Confidence
                          </span>
                        )}

                        {/* Review Status Pill */}
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded ${
                            item.reviewStatus === 'ACCEPTED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : item.reviewStatus === 'FLAGGED'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-200 text-gray-700'
                          }`}
                        >
                          {item.reviewStatus}
                        </span>
                      </div>
                    </div>

                    {/* Change Details */}
                    <div className="grid grid-cols-2 gap-3 my-2 text-xs">
                      <div className="bg-red-50/60 p-2 rounded-lg border border-red-100">
                        <span className="text-gray-500 font-medium block mb-0.5">
                          Expiring Policy:
                        </span>
                        <span className="font-semibold text-red-900 block truncate">
                          {item.oldValue || 'None / Not Present'}
                        </span>
                        {item.oldCitation && (
                          <span className="text-xs text-blue-600 underline mt-1 inline-block">
                            Cited Page {item.oldCitation.page}
                          </span>
                        )}
                      </div>

                      <div className="bg-emerald-50/60 p-2 rounded-lg border border-emerald-100">
                        <span className="text-gray-500 font-medium block mb-0.5">
                          Renewal Policy:
                        </span>
                        <span className="font-semibold text-emerald-900 block truncate">
                          {item.newValue || 'Removed / Absent'}
                        </span>
                        {item.newCitation && (
                          <span className="text-xs text-blue-600 underline mt-1 inline-block">
                            Cited Page {item.newCitation.page}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Plain-English Summary */}
                    {item.summary && (
                      <p className="text-xs text-slate-700 mt-1 italic bg-slate-50 p-2 rounded border border-slate-200">
                        &ldquo;{item.summary}&rdquo;
                      </p>
                    )}

                    {/* Review Note Display */}
                    {item.reviewNote && (
                      <p className="text-xs text-amber-800 bg-amber-50/70 p-1.5 rounded mt-1.5 border border-amber-200">
                        <strong>Review Note:</strong> {item.reviewNote}
                      </p>
                    )}

                    {/* Human Action Controls */}
                    <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleUpdateStatus(item.id, 'ACCEPTED')}
                          className={`text-xs font-semibold px-2.5 py-1 rounded transition-colors ${
                            item.reviewStatus === 'ACCEPTED'
                              ? 'bg-emerald-700 text-white'
                              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                          }`}
                        >
                          &#10003; Accept
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(item.id, 'FLAGGED')}
                          className={`text-xs font-semibold px-2.5 py-1 rounded transition-colors ${
                            item.reviewStatus === 'FLAGGED'
                              ? 'bg-red-700 text-white'
                              : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                          }`}
                        >
                          &#9873; Flag
                        </button>
                        <button
                          onClick={() => {
                            setEditingNoteId(item.id);
                            setNoteText(item.reviewNote || '');
                          }}
                          className="text-xs text-gray-600 hover:text-gray-900 px-2 py-1 rounded bg-gray-100 hover:bg-gray-200"
                        >
                          + Note
                        </button>
                      </div>

                      {item.reviewedBy && (
                        <span className="text-xs text-gray-400">
                          Reviewed by {item.reviewedBy.split('@')[0]}
                        </span>
                      )}
                    </div>

                    {/* Expandable Add Note Input */}
                    {editingNoteId === item.id && (
                      <div className="mt-2 p-2 bg-gray-50 rounded-lg border border-gray-300" onClick={(e) => e.stopPropagation()}>
                        <textarea
                          rows={2}
                          value={noteText}
                          placeholder="Add reason for flag or underwriter note..."
                          onChange={(e) => setNoteText(e.target.value)}
                          className="w-full text-xs p-1.5 border rounded focus:ring-1 focus:ring-blue-500"
                        />
                        <div className="mt-1 flex justify-end gap-2">
                          <button
                            onClick={() => setEditingNoteId(null)}
                            className="text-xs text-gray-500 hover:text-gray-700 px-2 py-0.5"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => {
                              handleUpdateStatus(item.id, item.reviewStatus, noteText);
                              setEditingNoteId(null);
                            }}
                            className="text-xs font-semibold bg-blue-600 text-white px-3 py-0.5 rounded"
                          >
                            Save Note
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── RIGHT PANE: SYNCHRONIZED PDF & CITATION VIEWER (45%) ── */}
        <div className="w-5/12 flex flex-col bg-slate-900 text-slate-100 overflow-hidden">
          {/* Document & Page Selector Toolbar */}
          <div className="p-3 bg-slate-800 border-b border-slate-700 flex items-center justify-between flex-shrink-0">
            {/* Document Role Switcher */}
            <div className="flex rounded-lg bg-slate-900 p-0.5 border border-slate-700">
              <button
                onClick={() => {
                  setActiveDocRole('EXPIRING');
                  setActivePage(selectedItem?.oldCitation?.page || 1);
                }}
                className={`text-xs font-semibold px-3 py-1 rounded-md transition-colors ${
                  activeDocRole === 'EXPIRING'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Expiring Policy
              </button>
              <button
                onClick={() => {
                  setActiveDocRole('RENEWAL');
                  setActivePage(selectedItem?.newCitation?.page || 1);
                }}
                className={`text-xs font-semibold px-3 py-1 rounded-md transition-colors ${
                  activeDocRole === 'RENEWAL'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Renewal Policy
              </button>
            </div>

            {/* Page Pagination Controls */}
            <div className="flex items-center gap-2 text-xs">
              <button
                disabled={activePage <= 1}
                onClick={() => setActivePage((p) => Math.max(1, p - 1))}
                className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-40"
              >
                &larr;
              </button>
              <span>
                Page {activePage} of {activeDoc?.pageCount || 1}
              </span>
              <button
                disabled={activePage >= (activeDoc?.pageCount || 1)}
                onClick={() => setActivePage((p) => Math.min(activeDoc?.pageCount || 1, p + 1))}
                className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-40"
              >
                &rarr;
              </button>
            </div>
          </div>

          {/* Active Citation Notification Banner */}
          {selectedItem && (
            <div className="p-2.5 bg-blue-950/80 border-b border-blue-800/60 text-xs text-blue-200 flex items-center justify-between flex-shrink-0">
              <div>
                Targeting: <strong>{selectedItem.canonicalKey}</strong>
              </div>
              <div className="font-mono text-blue-300">
                {activeDocRole === 'RENEWAL'
                  ? selectedItem.newCitation?.page
                    ? `Page ${selectedItem.newCitation.page}`
                    : 'Not in renewal'
                  : selectedItem.oldCitation?.page
                  ? `Page ${selectedItem.oldCitation.page}`
                  : 'Not in expiring'}
              </div>
            </div>
          )}

          {/* PDF Page Simulation with Synchronized Bounding-Box Overlay */}
          <div className="flex-1 overflow-y-auto p-6 bg-slate-950 flex justify-center">
            <div className="w-full max-w-lg bg-white text-gray-900 rounded-lg shadow-xl p-8 min-h-[700px] relative font-sans text-xs space-y-3 border border-slate-300">
              <div className="text-center border-b pb-2 text-gray-500 font-bold tracking-wider text-xs">
                {activeDoc?.originalFilename} — PAGE {activePage}
              </div>

              {currentDocBlocks.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  No text blocks extracted on page {activePage}.
                </div>
              ) : (
                currentDocBlocks.map((block) => {
                  // Determine if this block is cited by the currently selected diff item
                  const isCited =
                    (activeDocRole === 'RENEWAL' &&
                      selectedItem?.newCitation?.blockIds?.includes(block.id)) ||
                    (activeDocRole === 'EXPIRING' &&
                      selectedItem?.oldCitation?.blockIds?.includes(block.id)) ||
                    (selectedItem?.newCitation?.textSnippet &&
                      block.text.includes(selectedItem.newCitation.textSnippet.slice(0, 15)));

                  return (
                    <div
                      key={block.id}
                      className={`p-1.5 rounded transition-all duration-300 ${
                        isCited
                          ? 'bg-yellow-200 border-2 border-yellow-500 ring-4 ring-yellow-400/30 font-semibold'
                          : 'hover:bg-gray-100 text-gray-800'
                      }`}
                    >
                      {block.text}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
