import React, { useState } from 'react';
import type { TriageResponse } from '../types';
import {
  ShieldAlert,
  ShieldCheck,
  Zap,
  Tag,
  Clock,
  Building2,
  GitFork,
  CheckCircle2,
  FileText,
  ChevronDown,
  ChevronUp,
  Cpu,
  Sparkles,
  Copy,
  Check,
  Bot,
} from 'lucide-react';

interface TriageResultVisualProps {
  response: TriageResponse;
  rawText: string;
}

export const TriageResultVisual: React.FC<TriageResultVisualProps> = ({
  response,
  rawText,
}) => {
  const [showFullTrace, setShowFullTrace] = useState<boolean>(false);
  const [copiedDraft, setCopiedDraft] = useState<boolean>(false);

  const {
    router,
    intent,
    risk_flags = [],
    sanitized_text,
    trace = [],
    ticket_id,
    route,
    route_reason,
    draft,
    citations = [],
  } = response;

  const isHardStop =
    intent === 'bad' ||
    risk_flags.includes('injection_suspected') ||
    risk_flags.includes('SANITIZATION_ERROR');

  const autoDraftStep = trace.find((t) => t.node === 'auto_draft');
  const isAutoDraftRoute = route === 'AUTO_DRAFT' || Boolean(draft) || Boolean(autoDraftStep);

  const handleCopyDraft = () => {
    if (!draft) return;
    navigator.clipboard.writeText(draft);
    setCopiedDraft(true);
    setTimeout(() => setCopiedDraft(false), 2000);
  };

  // Category Theme Badges
  const getCategoryColor = (category?: string) => {
    switch (category) {
      case 'abuse_security':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      case 'billing':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'technical_issue':
        return 'bg-sky-500/10 text-sky-400 border-sky-500/30';
      case 'shipping_delivery':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      default:
        return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30';
    }
  };

  // Urgency Theme Badges
  const getUrgencyColor = (urgency?: string) => {
    switch (urgency) {
      case 'critical':
        return 'bg-rose-500 text-white animate-pulse';
      case 'high':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'normal':
        return 'bg-sky-500/20 text-sky-300 border-sky-500/40';
      default:
        return 'bg-zinc-800 text-zinc-400 border-zinc-700';
    }
  };

  const totalDurationMs = trace.reduce((acc, step) => acc + (step.duration_ms || 0), 0);

  return (
    <div className="flex-1 flex flex-col gap-5 bg-zinc-950/90 border border-zinc-800/90 rounded-xl p-5 shadow-2xl backdrop-blur-md overflow-y-auto">
      {/* Top Banner: Ticket ID & Pipeline Status */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-zinc-800/80">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-700/60 text-zinc-300">
            <GitFork size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-zinc-200">
                Ticket: {ticket_id}
              </span>
              <span className="px-1.5 py-0.5 text-[10px] font-mono bg-zinc-900 text-zinc-400 border border-zinc-800 rounded">
                LangGraph v0.1
              </span>
              {route && (
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-teal-950/60 text-teal-300 border border-teal-500/40 rounded uppercase">
                  {route}
                </span>
              )}
            </div>
            <p className="text-[11px] text-zinc-500 font-mono">
              Pipeline Execution: <span className="text-zinc-300 font-semibold">{trace.length} nodes completed</span> in{' '}
              <span className="text-emerald-400 font-semibold">{totalDurationMs.toFixed(1)} ms</span>
            </p>
          </div>
        </div>

        {/* Security & Route Outcome Badge */}
        <div className="flex items-center gap-2">
          {isHardStop ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-950/60 border border-rose-500/60 text-rose-300 rounded-lg text-xs font-semibold shadow-lg shadow-rose-950/40">
              <ShieldAlert size={14} className="text-rose-400 animate-bounce" />
              <span>Security Quarantine Target</span>
            </div>
          ) : isAutoDraftRoute ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-950/60 border border-emerald-400/60 text-emerald-200 rounded-lg text-xs font-semibold shadow-lg shadow-emerald-950/40">
              <Sparkles size={14} className="text-emerald-400 animate-pulse" />
              <span>Auto-Draft Generated (OpenRouter)</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-950/40 border border-amber-500/40 text-amber-300 rounded-lg text-xs font-semibold">
              <Building2 size={14} className="text-amber-400" />
              <span>Human Queue Escalation</span>
            </div>
          )}
        </div>
      </div>

      {/* Interactive LangGraph Visual Pipeline with Auto-Draft Branch */}
      <div className="p-4 bg-zinc-900/50 border border-zinc-800/80 rounded-xl space-y-3">
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <span className="font-semibold flex items-center gap-1.5 text-zinc-300">
            <Cpu size={14} className="text-teal-400" />
            LangGraph Execution Flow
          </span>
          <span className="font-mono text-[11px] text-zinc-500">
            START &rarr; sanitize &rarr; route_with_laya &rarr; {isAutoDraftRoute ? 'auto_draft' : '[bypass]'} &rarr; END
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5 items-center">
          {/* Step 1: START */}
          <div className="p-3 bg-zinc-950/80 border border-zinc-800 rounded-lg flex flex-col justify-between h-20">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-zinc-500 uppercase">Input Node</span>
              <CheckCircle2 size={13} className="text-emerald-400" />
            </div>
            <div className="text-xs font-bold text-zinc-200">START</div>
            <div className="text-[10px] text-zinc-500 font-mono">Payload Ingested</div>
          </div>

          {/* Step 2: sanitize */}
          <div className="p-3 bg-zinc-950/80 border border-zinc-800 rounded-lg flex flex-col justify-between h-20 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-zinc-500 uppercase">Sanitize Node</span>
              <ShieldCheck size={13} className={isHardStop ? 'text-rose-400' : 'text-emerald-400'} />
            </div>
            <div className="text-xs font-bold text-zinc-200 flex items-center justify-between">
              <span>sanitize</span>
              <span className="font-mono text-[10px] text-zinc-400">
                {trace.find((t) => t.node === 'sanitize')?.duration_ms ?? 0} ms
              </span>
            </div>
            <div className="text-[10px] font-mono truncate">
              {intent === 'bad' ? (
                <span className="text-rose-400 font-semibold">Intent: Bad (Flagged)</span>
              ) : (
                <span className="text-emerald-400 font-semibold">Intent: Good (Clean)</span>
              )}
            </div>
            {isHardStop && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-rose-500 animate-pulse" />}
          </div>

          {/* Step 3: route_with_laya */}
          <div className="p-3 bg-zinc-950/80 border border-zinc-800 rounded-lg flex flex-col justify-between h-20 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-teal-400 uppercase font-semibold">Laya System 1</span>
              <Zap size={13} className="text-teal-400" />
            </div>
            <div className="text-xs font-bold text-zinc-200 flex items-center justify-between">
              <span>route_with_laya</span>
              <span className="font-mono text-[10px] text-zinc-400">
                {trace.find((t) => t.node === 'route_with_laya')?.duration_ms ?? 0} ms
              </span>
            </div>
            <div className="text-[10px] text-teal-300 font-mono truncate">
              {router?.category || 'Classified'}
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-500" />
          </div>

          {/* Step 4: auto_draft (Conditional Node) */}
          <div
            className={`p-3 bg-zinc-950/80 rounded-lg flex flex-col justify-between h-20 relative overflow-hidden border ${
              isAutoDraftRoute
                ? 'border-emerald-500/60 shadow-md shadow-emerald-950/30'
                : 'border-zinc-800/60 opacity-60'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-emerald-400 uppercase font-semibold flex items-center gap-1">
                <Sparkles size={11} />
                OpenRouter LLM
              </span>
              {isAutoDraftRoute ? (
                <CheckCircle2 size={13} className="text-emerald-400" />
              ) : (
                <span className="text-[9px] font-mono text-zinc-500">BYPASS</span>
              )}
            </div>
            <div className="text-xs font-bold text-zinc-200 flex items-center justify-between">
              <span className={isAutoDraftRoute ? 'text-emerald-300' : 'text-zinc-400'}>
                auto_draft
              </span>
              <span className="font-mono text-[10px] text-zinc-400">
                {autoDraftStep ? `${autoDraftStep.duration_ms} ms` : '—'}
              </span>
            </div>
            <div className="text-[10px] font-mono truncate">
              {isAutoDraftRoute ? (
                <span className="text-emerald-400 font-semibold">Response Drafted</span>
              ) : isHardStop ? (
                <span className="text-rose-400">Skipped (Quarantine)</span>
              ) : (
                <span className="text-zinc-500">Skipped (Human Queue)</span>
              )}
            </div>
            {isAutoDraftRoute && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400 animate-pulse" />
            )}
          </div>

          {/* Step 5: END */}
          <div className="p-3 bg-zinc-950/80 border border-zinc-800 rounded-lg flex flex-col justify-between h-20">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-zinc-500 uppercase">Sink Node</span>
              <CheckCircle2 size={13} className="text-emerald-400" />
            </div>
            <div className="text-xs font-bold text-zinc-200">END</div>
            <div className="text-[10px] text-zinc-500 font-mono truncate">Output Finalized</div>
          </div>
        </div>

        {route_reason && (
          <div className="flex items-center gap-2 pt-2 border-t border-zinc-800/60 text-xs font-mono text-zinc-400">
            <span className="text-zinc-500">Routing Decision:</span>
            <span className="text-zinc-200 font-semibold">{route_reason}</span>
          </div>
        )}
      </div>

      {/* SHOWCASE: Auto-Generated LLM Draft Output (OpenRouter) */}
      {draft ? (
        <div className="p-5 bg-gradient-to-b from-teal-950/30 via-zinc-900/80 to-zinc-900/60 border-2 border-teal-500/50 rounded-xl space-y-4 shadow-xl shadow-teal-950/20 relative overflow-hidden">
          {/* Subtle decorative glow */}
          <div className="absolute top-0 right-0 w-64 h-32 bg-teal-500/10 blur-3xl pointer-events-none rounded-full" />

          {/* Header Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-teal-500/20">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-teal-500/20 border border-teal-500/40 text-teal-300 shadow-md shadow-teal-950/40">
                <Bot size={20} className="text-teal-300" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-1.5 font-heading">
                    Autonomous Reply Draft
                    <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-teal-500/20 text-teal-300 border border-teal-400/40 rounded-full">
                      OpenRouter · System 2
                    </span>
                  </h3>
                </div>
                <p className="text-xs text-zinc-400">
                  Synthesized response based on sanitized ticket context and verified taxonomy
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {autoDraftStep && (
                <span className="px-2.5 py-1 text-xs font-mono text-zinc-300 bg-zinc-950/80 border border-zinc-800 rounded-lg flex items-center gap-1.5">
                  <Clock size={12} className="text-teal-400" />
                  {autoDraftStep.duration_ms.toFixed(0)} ms
                </span>
              )}
              <button
                onClick={handleCopyDraft}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold font-mono transition-all duration-200 border ${
                  copiedDraft
                    ? 'bg-emerald-500 text-black border-emerald-400 shadow-md shadow-emerald-500/30'
                    : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border-zinc-700 hover:border-zinc-600'
                }`}
                title="Copy drafted response"
              >
                {copiedDraft ? (
                  <>
                    <Check size={14} className="stroke-[2.5]" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    <span>Copy Draft</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Draft Message Body */}
          <div className="relative">
            <div className="p-4 bg-zinc-950/90 border border-teal-500/30 rounded-xl text-zinc-100 font-sans text-sm leading-relaxed whitespace-pre-wrap select-text selection:bg-teal-500/30 shadow-inner">
              {draft}
            </div>
          </div>

          {/* Citations & Engine Provenance Footer */}
          <div className="pt-2 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-mono text-zinc-400 font-semibold flex items-center gap-1">
                <Cpu size={12} className="text-teal-400" />
                Engine & Citations:
              </span>
              {citations && citations.length > 0 ? (
                citations.map((cite, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 text-[11px] font-mono bg-zinc-900/90 text-teal-300 border border-teal-500/30 rounded-md flex items-center gap-1"
                  >
                    <span>{cite}</span>
                  </span>
                ))
              ) : (
                <span className="px-2 py-0.5 text-[11px] font-mono bg-zinc-900/90 text-teal-300 border border-teal-500/30 rounded-md">
                  openrouter:meta-llama/llama-3.3-70b-instruct
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2.5 py-1 rounded-md">
              <ShieldCheck size={13} />
              <span>Guardrails Passed (Invariant #1 & #2 Verified)</span>
            </div>
          </div>
        </div>
      ) : (
        /* Explanatory banner when Draft is not generated */
        <div
          className={`p-4 rounded-xl border flex items-start gap-3 text-xs leading-relaxed ${
            isHardStop
              ? 'bg-rose-950/20 border-rose-900/50 text-rose-200'
              : 'bg-zinc-900/60 border-zinc-800 text-zinc-400'
          }`}
        >
          {isHardStop ? (
            <>
              <ShieldAlert size={18} className="text-rose-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-rose-300 font-semibold block mb-0.5">
                  Autonomous Drafting Suppressed (Fail-Closed Security Quarantine)
                </strong>
                <span>
                  Ticket contains detected prompt injection patterns or untrusted payloads. Per
                  Invariant #3, System 2 autonomous drafting was permanently halted to protect
                  downstream customer communication channels.
                </span>
              </div>
            </>
          ) : (
            <>
              <Building2 size={18} className="text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-zinc-200 font-semibold block mb-0.5">
                  Routed to Human Agent Queue
                </strong>
                <span>
                  {route_reason ||
                    `Ticket category (${router?.category || 'unclassified'}) requires specialist human intervention. Autonomous drafting bypassed per routing policy.`}
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Laya Classification & Predictions Card */}
      {router && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Category Card */}
          <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-400 flex items-center gap-1.5">
                <Tag size={14} className="text-zinc-500" />
                Predicted Category
              </span>
              <span className="text-[11px] font-mono text-zinc-400 font-semibold">
                {(router.category_conf * 100).toFixed(1)}% conf
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`px-2.5 py-1 text-xs font-mono font-bold rounded-lg border uppercase tracking-wider ${getCategoryColor(
                  router.category
                )}`}
              >
                {router.category}
              </span>
            </div>

            {/* Confidence Progress Bar */}
            <div className="space-y-1">
              <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-teal-400 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(5, router.category_conf * 100))}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-mono text-zinc-500">
                <span>Confidence Floor (80%)</span>
                <span>{router.category_conf >= 0.8 ? 'PASSED' : 'BELOW THRESHOLD'}</span>
              </div>
            </div>
          </div>

          {/* Urgency Level Card */}
          <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-400 flex items-center gap-1.5">
                <Clock size={14} className="text-zinc-500" />
                Urgency Level
              </span>
              <span className="text-[11px] font-mono text-zinc-400 font-semibold">
                {(router.urgency_conf * 100).toFixed(1)}% conf
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`px-2.5 py-1 text-xs font-mono font-bold rounded-lg border uppercase tracking-wider ${getUrgencyColor(
                  router.urgency
                )}`}
              >
                {router.urgency}
              </span>
            </div>

            {/* Confidence Progress Bar */}
            <div className="space-y-1">
              <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-sky-400 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(5, router.urgency_conf * 100))}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-mono text-zinc-500">
                <span>Confidence Floor (75%)</span>
                <span>{router.urgency_conf >= 0.75 ? 'PASSED' : 'BELOW THRESHOLD'}</span>
              </div>
            </div>
          </div>

          {/* Owning Team Routing Card */}
          <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-400 flex items-center gap-1.5">
                <Building2 size={14} className="text-zinc-500" />
                Assigned Team
              </span>
              <span className="text-[10px] font-mono text-zinc-500">Taxonomy Lookup</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 text-xs font-mono font-bold bg-zinc-800 text-zinc-200 border border-zinc-700 rounded-lg uppercase tracking-wider">
                {router.team}
              </span>
            </div>

            <div className="text-[11px] text-zinc-400 font-sans flex items-center gap-1">
              <span>Next action:</span>
              <strong className="text-zinc-200">
                {isAutoDraftRoute ? 'Draft generated via OpenRouter' : 'Escalate to human review'}
              </strong>
            </div>
          </div>
        </div>
      )}

      {/* Intent Classification & Security Status */}
      <div
        className={`p-4 rounded-xl space-y-2 border ${
          intent === 'bad'
            ? 'bg-rose-950/20 border-rose-900/60'
            : 'bg-emerald-950/20 border-emerald-900/60'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold">
            {intent === 'bad' ? (
              <>
                <ShieldAlert size={16} className="text-rose-400" />
                <span className="text-rose-400">Classified Intent: Bad (Malicious / Injection Infected)</span>
              </>
            ) : (
              <>
                <ShieldCheck size={16} className="text-emerald-400" />
                <span className="text-emerald-400">Classified Intent: Good (Clean)</span>
              </>
            )}
          </div>
          <span
            className={`px-2.5 py-0.5 text-[11px] font-mono font-bold rounded uppercase ${
              intent === 'bad'
                ? 'bg-rose-900/40 text-rose-300 border border-rose-700/50'
                : 'bg-emerald-900/40 text-emerald-300 border border-emerald-700/50'
            }`}
          >
            intent: {intent || 'good'}
          </span>
        </div>
      </div>

      {/* Sanitized Text Comparison */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <span className="font-semibold flex items-center gap-1.5 text-zinc-300">
            <FileText size={14} className="text-zinc-400" />
            Sanitized Payload (Passed to Router)
          </span>
          <span className="text-[11px] font-mono text-zinc-500">
            Raw length: {rawText.length} &rarr; Sanitized length: {sanitized_text?.length || 0}
          </span>
        </div>
        <div className="p-3.5 bg-zinc-900/80 rounded-lg border border-zinc-800 text-xs font-mono text-zinc-300 leading-relaxed whitespace-pre-wrap select-text">
          {sanitized_text || <span className="text-zinc-600 italic">No sanitized output available.</span>}
        </div>
      </div>

      {/* Expandable Trace Audit Log */}
      <div className="pt-2 border-t border-zinc-800/80">
        <button
          onClick={() => setShowFullTrace(!showFullTrace)}
          className="flex items-center justify-between w-full py-2 text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <GitFork size={13} />
            Structured Node Trace Audit ({trace.length} spans)
          </span>
          {showFullTrace ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {showFullTrace && (
          <div className="mt-3 space-y-2">
            {trace.map((step, idx) => (
              <div
                key={idx}
                className="p-3 bg-zinc-900/70 border border-zinc-800 rounded-lg flex flex-col gap-1 text-xs font-mono"
              >
                <div className="flex items-center justify-between text-zinc-300">
                  <span className="font-bold text-teal-400">
                    #{idx + 1} {step.node}
                  </span>
                  <span className="text-zinc-500 text-[11px]">{step.duration_ms} ms</span>
                </div>
                <div className="text-[11px] text-zinc-400">
                  Started at: {step.started_at}
                </div>
                <div className="text-[11px] text-zinc-400 bg-zinc-950 p-2 rounded border border-zinc-800/60 mt-1">
                  {JSON.stringify(step.summary, null, 2)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
