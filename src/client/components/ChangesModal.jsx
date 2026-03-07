import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { X, AlertTriangle, ExternalLink, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import Portal from './Portal';
import { SERVER_URL } from '../utils/constants';

const PAGE_SIZE = 8;

const ChangesModal = ({ isOpen, onClose, activeLines }) => {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Sort: changes whose lines match what's currently on screen go first
  const sortedItems = useMemo(() => {
    if (!activeLines?.size) return items;
    return [...items].sort((a, b) => {
      const aHit = a.lines?.some(l => activeLines.has(l.number)) ? 1 : 0;
      const bHit = b.lines?.some(l => activeLines.has(l.number)) ? 1 : 0;
      return bHit - aHit;
    });
  }, [items, activeLines]);

  const total = sortedItems.length;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const pageItems = sortedItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const fetchChanges = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${SERVER_URL}/api/transit-changes`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems(data.items || []);
      setPage(1);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && items.length === 0) {
      fetchChanges();
    }
  }, [isOpen, fetchChanges]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <Portal>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-[9998]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className="fixed inset-x-0 bottom-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-2xl z-[9999] bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[90vh] sm:max-h-[80vh]"
        role="dialog"
        aria-modal="true"
        aria-label="Transit Changes"
      >
        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Актуелне измене
            </h2>
            {total > 0 && (
              <span className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 px-2 py-0.5 rounded-full font-medium">
                {total}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchChanges}
              disabled={loading}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Refresh"
            >
              <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 px-4 py-3 space-y-3">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 text-primary-500 animate-spin" />
            </div>
          )}

          {error && (
            <div className="text-center py-8">
              <p className="text-sm text-red-500 mb-3">{error}</p>
              <button
                onClick={fetchChanges}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm"
              >
                Покушај поново
              </button>
            </div>
          )}

          {!loading && !error && pageItems.map((item, idx) => {
            const isActive = activeLines?.size && item.lines?.some(l => activeLines.has(l.number));
            return (
            <div
              key={idx}
              className={`border rounded-xl p-3 ${isActive
                ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700'
                : 'bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700'
              }`}
            >
              {/* Line badges */}
              {item.lines?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {item.lines.map((line, li) => (
                    <span
                      key={li}
                      className="inline-flex px-1.5 py-0.5 rounded text-white text-xs font-bold"
                      style={{ backgroundColor: line.color || '#2563eb' }}
                    >
                      {line.number}
                    </span>
                  ))}
                </div>
              )}

              {/* Description */}
              <p className="text-sm text-gray-800 dark:text-gray-200 leading-snug mb-2">
                {item.description}
              </p>

              {/* Meta row */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  {item.changeType && (
                    <span className="text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full">
                      {item.changeType}
                    </span>
                  )}
                  {item.dates && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {item.dates}
                    </span>
                  )}
                </div>
                {item.detailUrl && (
                  <a
                    href={item.detailUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:underline font-medium"
                  >
                    Опширније
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
            );
          })}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-700 flex-shrink-0">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Претходна
            </button>

            <span className="text-sm text-gray-500 dark:text-gray-400">
              {page} / {totalPages}
            </span>

            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Следећа
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </Portal>
  );
};

export default ChangesModal;
