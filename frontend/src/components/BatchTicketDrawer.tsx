import React, { useState } from 'react';
import type { BatchTestResultItem } from '../types';
import {
  X,
  ShieldAlert,
  ShieldCheck,
  Zap,
  Tag,
  Clock,
  Building2,
  GitFork,
  FileText,
  AlertTriangle,
  Code2,
  Copy,
  Check,
  Cpu,
  User,
  Sparkles,
} from 'lucide-react';

interface BatchTicketDrawerProps {
  item: BatchTestResultItem | null;
  onClose: () => void;
}

export const BatchTicketDrawer: React.FC<BatchTicketDrawerProps> = ({ item, onClose }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'trace' | 'json'>('overview');
  const [copied, setCopied] = useState<boolean>(false);
  const [copiedDraft, setCopiedDraft] = useState<boolean>(false);

  if (!item) return null;

  const isHardStop =
    item.intent === 'bad' ||
    item.route === 'SECURITY_REVIEW' ||
    item.risk_flags?.includes('injection_suspected') ||
    item.risk_flags?.includes('SANITIZATION_ERROR');
  const isHumanQueue = item.route === 'HUMAN_QUEUE';
  const isAutoDraft =
    item.route === 'auto_draft' ||
    item.router?.category === 'technical_issue' ||
    item.router?.category === 'shipping_delivery';

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(item.rawResponse || item, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getCategoryBadgeClass = (category?: string) => {
    switch (category) {
      case 'abuse_security':
        return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
      case 'billing':
        return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
      case 'technical_issue':
        return 'bg-sky-500/15 text-sky-300 border-sky-500/30';
      case 'shipping_delivery':
        return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
      default:
        return 'bg-zinc-800 text-zinc-300 border-zinc-700';
    }
  };

  const getUrgencyBadgeClass = (urgency?: string) => {
    switch (urgency) {
      case 'critical':
        return 'bg-rose-500 text-white font-bold animate-pulse';
      case 'high':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'normal':
        return 'bg-sky-500/20 text-sky-300 border-sky-500/40';
      default:
        return 'bg-zinc-800 text-zinc-400 border-zinc-700';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-2xl bg-zinc-950 border-l border-zinc-800 flex flex-col h-full shadow-2xl overflow-hidden animate-in slide-in-from-right duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-zinc-800/90 flex items-center justify-between bg-zinc-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-zinc-800 text-teal-400 border border-zinc-700/60">
              <Cpu size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold text-zinc-100">
                  Ticket #{item.index} · {item.ticket_id || 'ID N/A'}
                </span>
                <span
                  className={`px-2 py-0.5 text-[10px] font-mono rounded border uppercase ${item.status === 'success'
                      ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                      : 'bg-rose-950/60 text-rose-300 border-rose-800'
                    }`}
                >
                  {item.status} ({item.latencyMs} ms)
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-zinc-400 mt-0.5">
                <User size={12} className="text-zinc-500" />
                <span className="font-mono text-zinc-300">{item.customer_id}</span>
                {item.subject && (
                  <>
                    <span className="text-zinc-600">·</span>
                    <span className="text-zinc-400 truncate max-w-xs">{item.subject}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyJson}
              title="Copy payload as JSON"
              className="p-1.5 text-zinc-400 hover:text-zinc-200 bg-zinc-800/80 hover:bg-zinc-700 rounded-lg border border-zinc-700 transition-colors"
            >
              {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-zinc-100 bg-zinc-800/80 hover:bg-zinc-700 rounded-lg border border-zinc-700 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-800/80 bg-zinc-950">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${activeTab === 'overview'
                ? 'bg-zinc-800 text-teal-300 border border-zinc-700'
                : 'text-zinc-400 hover:text-zinc-200'
              }`}
          >
            <FileText size={13} />
            <span>Inspection & Decision</span>
          </button>
          <button
            onClick={() => setActiveTab('trace')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${activeTab === 'trace'
                ? 'bg-zinc-800 text-teal-300 border border-zinc-700'
                : 'text-zinc-400 hover:text-zinc-200'
              }`}
          >
            <GitFork size={13} />
            <span>LangGraph Trace ({item.trace?.length || 0})</span>
          </button>
          <button
            onClick={() => setActiveTab('json')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${activeTab === 'json'
                ? 'bg-zinc-800 text-teal-300 border border-zinc-700'
                : 'text-zinc-400 hover:text-zinc-200'
              }`}
          >
            <Code2 size={13} />
            <span>Raw JSON</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs font-sans">
          {activeTab === 'overview' && (
            <>
              {/* Outcome Status Banner */}
              <div className="p-3.5 rounded-xl border flex items-center justify-between bg-zinc-900/70 border-zinc-800">
                <div className="flex items-center gap-2.5">
                  {isHardStop ? (
                    <ShieldAlert size={20} className="text-rose-400 shrink-0" />
                  ) : isHumanQueue ? (
                    <Building2 size={20} className="text-amber-400 shrink-0" />
                  ) : isAutoDraft ? (
                    <Zap size={20} className="text-emerald-400 shrink-0" />
                  ) : (
                    <Building2 size={20} className="text-sky-400 shrink-0" />
                  )}
                  <div>
                    <div className="font-semibold text-zinc-100 text-xs">
                      {isHardStop
                        ? 'Quarantined for Security Review'
                        : isHumanQueue
                          ? 'Ambiguous Risk: Escalated to Human Queue'
                          : isAutoDraft
                            ? 'Auto-Draft Response Generated'
                            : 'Escalated to Human Agent Queue'}
                    </div>
                    <div className="text-[11px] text-zinc-400">
                      {item.route_reason ||
                        (isHardStop
                          ? 'Prompt injection or critical policy violation blocked execution.'
                          : isHumanQueue
                            ? 'Classifier score in ambiguous middle zone.'
                            : 'Processed through Laya zero-shot routing pipeline.')}
                    </div>
                  </div>
                </div>

                <span
                  className={`px-2.5 py-1 text-[11px] font-mono font-bold rounded-lg border uppercase ${isHardStop
                      ? 'bg-rose-950 text-rose-300 border-rose-800'
                      : isHumanQueue
                        ? 'bg-amber-950 text-amber-300 border-amber-800'
                        : isAutoDraft
                          ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                          : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                    }`}
                >
                  {item.route || (isHardStop ? 'quarantine' : 'route')}
                </span>
              </div>

              {/* Laya Classification Grid */}
              {item.router && (
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-1.5">
                    <div className="text-[10px] uppercase font-mono text-zinc-500 flex items-center gap-1">
                      <Tag size={11} />
                      <span>Category</span>
                    </div>
                    <div className={`px-2 py-0.5 text-xs font-mono font-bold rounded border inline-block ${getCategoryBadgeClass(item.router.category)}`}>
                      {item.router.category}
                    </div>
                    <div className="text-[10px] font-mono text-zinc-400">
                      {(item.router.category_conf * 100).toFixed(1)}% conf
                    </div>
                  </div>

                  <div className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-1.5">
                    <div className="text-[10px] uppercase font-mono text-zinc-500 flex items-center gap-1">
                      <Clock size={11} />
                      <span>Urgency</span>
                    </div>
                    <div className={`px-2 py-0.5 text-xs font-mono font-bold rounded border inline-block ${getUrgencyBadgeClass(item.router.urgency)}`}>
                      {item.router.urgency}
                    </div>
                    <div className="text-[10px] font-mono text-zinc-400">
                      {(item.router.urgency_conf * 100).toFixed(1)}% conf
                    </div>
                  </div>

                  <div className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-1.5">
                    <div className="text-[10px] uppercase font-mono text-zinc-500 flex items-center gap-1">
                      <Building2 size={11} />
                      <span>Assigned Team</span>
                    </div>
                    <div className="px-2 py-0.5 text-xs font-mono font-bold rounded border bg-zinc-800 text-zinc-200 border-zinc-700 inline-block uppercase">
                      {item.router.team}
                    </div>
                    <div className="text-[10px] font-mono text-zinc-400">Deterministic map</div>
                  </div>
                </div>
              )}

              {/* Llama Prompt Guard ML Security Section */}
              {item.guard_result && (
                <div className={`p-3.5 rounded-xl border space-y-2 ${item.guard_result.passed === false
                    ? 'bg-rose-950/25 border-rose-800/70'
                    : 'bg-emerald-950/20 border-emerald-800/60'
                  }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {item.guard_result.passed === false ? (
                        <ShieldAlert size={16} className="text-rose-400" />
                      ) : (
                        <ShieldCheck size={16} className="text-emerald-400" />
                      )}
                      <span className="font-semibold text-xs text-zinc-100 font-mono">
                        Llama Prompt Guard 2-86M Evaluation
                      </span>
                    </div>
                    <span className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded border uppercase ${item.guard_result.passed === false
                        ? 'bg-rose-950 text-rose-300 border-rose-800'
                        : 'bg-emerald-950 text-emerald-300 border-emerald-800'
                      }`}>
                      {item.guard_result.classification || (item.guard_result.passed === false ? 'MALICIOUS' : 'BENIGN')}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-[11px]">
                    <div className="bg-zinc-900/80 p-2 rounded-lg border border-zinc-800">
                      <div className="text-zinc-500 text-[10px]">Malicious Score</div>
                      <div className={`font-bold ${item.guard_result.malicious_score >= (item.guard_result.threshold || 0.75) ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {item.guard_result.malicious_score !== undefined ? `${(item.guard_result.malicious_score * 100).toFixed(1)}%` : 'N/A'}
                      </div>
                    </div>
                    <div className="bg-zinc-900/80 p-2 rounded-lg border border-zinc-800">
                      <div className="text-zinc-500 text-[10px]">Decision Threshold</div>
                      <div className="font-bold text-zinc-300">
                        {item.guard_result.threshold !== undefined ? `${(item.guard_result.threshold * 100).toFixed(1)}%` : '75.0%'}
                      </div>
                    </div>
                    <div className="bg-zinc-900/80 p-2 rounded-lg border border-zinc-800">
                      <div className="text-zinc-500 text-[10px]">Ground Truth</div>
                      <div className="font-bold text-zinc-300">
                        {item.is_malicious === 1 ? (
                          <span className="text-rose-400">Malicious (1)</span>
                        ) : item.is_malicious === 0 ? (
                          <span className="text-emerald-400">Benign (0)</span>
                        ) : (
                          <span className="text-zinc-500">Unlabeled</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {item.guard_result.violations && item.guard_result.violations.length > 0 && (
                    <div className="text-[11px] font-mono text-rose-300 bg-rose-950/40 p-2 rounded border border-rose-900/50">
                      {item.guard_result.violations.join('; ')}
                    </div>
                  )}
                </div>
              )}

              {/* Intent Classification & Risk Status */}
              <div
                className={`p-3 rounded-xl space-y-2 border ${item.intent === 'bad'
                    ? 'bg-rose-950/20 border-rose-900/60'
                    : 'bg-emerald-950/20 border-emerald-900/60'
                  }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    {item.intent === 'bad' ? (
                      <>
                        <ShieldAlert size={14} className="text-rose-400" />
                        <span className="text-rose-400">Classified Intent: Bad (Infected)</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck size={14} className="text-emerald-400" />
                        <span className="text-emerald-400">Classified Intent: Good (Clean)</span>
                      </>
                    )}
                  </div>
                  <span
                    className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded uppercase ${item.intent === 'bad'
                        ? 'bg-rose-900/40 text-rose-300 border border-rose-700/50'
                        : 'bg-emerald-900/40 text-emerald-300 border border-emerald-700/50'
                      }`}
                  >
                    intent: {item.intent || 'good'}
                  </span>
                </div>
              </div>

              {/* Raw Input Text */}
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
                  <span>Raw Inbound Ticket Text</span>
                  <span className="text-[10px] font-mono text-zinc-500">
                    Length: {item.input_text.length} chars
                  </span>
                </div>
                <div className="p-3 bg-zinc-900/80 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-200 whitespace-pre-wrap leading-relaxed select-text">
                  {item.input_text}
                </div>
              </div>

              {/* Sanitized Text */}
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck size={13} className="text-emerald-400" />
                    Sanitized Payload (Redacted PII / Defanged)
                  </span>
                  <span className="text-[10px] font-mono text-zinc-500">
                    Length: {item.sanitized_text?.length || 0} chars
                  </span>
                </div>
                <div className="p-3 bg-zinc-900/80 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-300 whitespace-pre-wrap leading-relaxed select-text">
                  {item.sanitized_text || <span className="text-zinc-600 italic">No sanitized output available.</span>}
                </div>
              </div>

              {/* Draft Response if available */}
              {item.draft && (
                <div className="space-y-2 p-3.5 bg-teal-950/20 border border-teal-500/40 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold text-teal-300 flex items-center gap-1.5">
                      <Sparkles size={13} className="text-teal-400" />
                      <span>OpenRouter Autonomous Reply Draft</span>
                    </div>
                    <button
                      onClick={() => {
                        if (!item.draft) return;
                        navigator.clipboard.writeText(item.draft);
                        setCopiedDraft(true);
                        setTimeout(() => setCopiedDraft(false), 2000);
                      }}
                      className="px-2 py-1 text-[11px] font-mono bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 rounded flex items-center gap-1 transition-colors"
                      title="Copy response text"
                    >
                      {copiedDraft ? (
                        <>
                          <Check size={12} className="text-emerald-400" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy size={12} />
                          <span>Copy Draft</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="p-3 bg-zinc-950/80 border border-zinc-800/80 rounded-lg text-xs font-sans text-zinc-100 whitespace-pre-wrap leading-relaxed select-text">
                    {item.draft}
                  </div>
                  {item.citations && item.citations.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[10px] font-mono text-zinc-400">
                      <span className="text-zinc-500">Citations:</span>
                      {item.citations.map((c, i) => (
                        <span key={i} className="px-1.5 py-0.5 bg-zinc-900 border border-teal-500/30 text-teal-300 rounded">
                          {c}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Error details if failed */}
              {item.errorMessage && (
                <div className="p-3 bg-red-950/40 border border-red-900/60 rounded-xl space-y-1 text-red-300">
                  <div className="font-semibold text-xs flex items-center gap-1.5">
                    <AlertTriangle size={14} />
                    <span>Execution Error</span>
                  </div>
                  <pre className="text-[11px] font-mono whitespace-pre-wrap">{item.errorMessage}</pre>
                </div>
              )}
            </>
          )}

          {activeTab === 'trace' && (
            <div className="space-y-2.5">
              <div className="text-xs text-zinc-400 mb-2 font-mono">
                LangGraph Pipeline Trace · Total Duration: {item.latencyMs} ms
              </div>
              {item.trace && item.trace.length > 0 ? (
                item.trace.map((step, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-zinc-900/70 border border-zinc-800 rounded-lg space-y-1.5 text-xs font-mono"
                  >
                    <div className="flex items-center justify-between text-zinc-200">
                      <span className="font-bold text-teal-400">
                        #{idx + 1} {step.node}
                      </span>
                      <span className="text-zinc-400 text-[11px]">{step.duration_ms} ms</span>
                    </div>
                    <div className="text-[10px] text-zinc-500">Started at: {step.started_at}</div>
                    {step.error && <div className="text-rose-400 text-[11px]">Error: {step.error}</div>}
                    <div className="p-2 bg-zinc-950 rounded border border-zinc-800 text-[11px] text-zinc-400 overflow-x-auto">
                      <pre>{JSON.stringify(step.summary, null, 2)}</pre>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-zinc-500 text-xs">No trace steps captured.</div>
              )}
            </div>
          )}

          {activeTab === 'json' && (
            <div className="h-full">
              <pre className="p-3 bg-zinc-900/90 border border-zinc-800 rounded-lg text-[11px] font-mono text-zinc-300 overflow-x-auto whitespace-pre select-text max-h-[600px]">
                {JSON.stringify(item.rawResponse || item, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
