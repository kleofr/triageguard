import React from 'react';
import { History, X, Trash2, ArrowUpRight, CheckCircle2, XCircle, Clock } from 'lucide-react';
import type { HistoryItem } from '../types';

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  history: HistoryItem[];
  onSelectHistoryItem: (item: HistoryItem) => void;
  onClearHistory: () => void;
}

export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({
  isOpen,
  onClose,
  history,
  onSelectHistoryItem,
  onClearHistory,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md bg-zinc-950 border-l border-zinc-800 h-full flex flex-col shadow-2xl animate-slideLeft">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-zinc-900 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <History size={16} className="text-zinc-400" />
            <span className="text-xs font-semibold text-zinc-200 uppercase tracking-wider">
              Request Execution Log
            </span>
            <span className="text-[11px] font-mono text-zinc-500">({history.length})</span>
          </div>

          <div className="flex items-center gap-2">
            {history.length > 0 && (
              <button
                onClick={onClearHistory}
                title="Clear history"
                className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded transition-colors"
              >
                <Trash2 size={14} />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
          {history.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-500 space-y-2">
              <Clock size={28} className="text-zinc-700" />
              <p className="text-xs">No request history yet.</p>
              <p className="text-[11px] text-zinc-600">
                Execute a sanitization or guardrail test to track execution runs here.
              </p>
            </div>
          ) : (
            history.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  onSelectHistoryItem(item);
                  onClose();
                }}
                className="group p-3 bg-zinc-900/70 hover:bg-zinc-900 rounded-lg border border-zinc-800/80 hover:border-zinc-700 cursor-pointer transition-all space-y-2"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    {item.status === 'success' ? (
                      <CheckCircle2 size={13} className="text-emerald-400" />
                    ) : (
                      <XCircle size={13} className="text-red-400" />
                    )}
                    <span className="font-mono font-medium text-zinc-300">{item.customerId}</span>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-500">
                    {item.latencyMs !== undefined && <span>{item.latencyMs}ms</span>}
                    <span>{new Date(item.timestamp).toLocaleTimeString()}</span>
                    <ArrowUpRight
                      size={13}
                      className="opacity-0 group-hover:opacity-100 text-zinc-400 transition-opacity"
                    />
                  </div>
                </div>

                <p className="text-xs text-zinc-400 line-clamp-2 font-mono bg-zinc-950/60 p-2 rounded border border-zinc-900">
                  {item.inputText}
                </p>

                {item.responsePayload?.result?.is_hard_stop && (
                  <div className="text-[10px] uppercase font-mono font-bold text-red-400 bg-red-950/60 border border-red-800/50 px-2 py-0.5 rounded w-fit">
                    Hard Stop Triggered
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
