import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Zap,
  Lock,
  Link2,
  AlertTriangle,
  Copy,
  Check,
  Sparkles,
} from 'lucide-react';
import type { SanitizeResponse } from '../types';

interface SanitizerResultVisualProps {
  response: SanitizeResponse;
  rawText: string;
}

export const SanitizerResultVisual: React.FC<SanitizerResultVisualProps> = ({
  response,
  rawText,
}) => {
  const { customer_id, processing_time_ms, result } = response;
  const [copiedClean, setCopiedClean] = useState(false);
  const [activeTab, setActiveTab] = useState<'clean' | 'findings' | 'diff'>('clean');

  const handleCopyClean = () => {
    navigator.clipboard.writeText(result.clean_text);
    setCopiedClean(true);
    setTimeout(() => setCopiedClean(false), 2000);
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev.toLowerCase()) {
      case 'critical':
        return 'bg-red-950/80 text-red-300 border-red-700/60';
      case 'high':
        return 'bg-amber-950/80 text-amber-300 border-amber-700/60';
      case 'medium':
        return 'bg-yellow-950/80 text-yellow-300 border-yellow-700/60';
      default:
        return 'bg-blue-950/80 text-blue-300 border-blue-700/60';
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Top Status & Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Hard Stop / Safety Card */}
        <div
          className={`p-3.5 rounded-xl border flex items-center gap-3 ${
            result.is_hard_stop
              ? 'bg-red-950/30 border-red-900/60 text-red-200'
              : 'bg-zinc-900/80 border-zinc-800 text-zinc-200'
          }`}
        >
          <div
            className={`p-2 rounded-lg ${
              result.is_hard_stop ? 'bg-red-900/50 text-red-400' : 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40'
            }`}
          >
            {result.is_hard_stop ? <ShieldAlert size={20} /> : <ShieldCheck size={20} />}
          </div>
          <div>
            <div className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
              Triage Action
            </div>
            <div className="text-sm font-semibold">
              {result.is_hard_stop ? (
                <span className="text-red-400">HARD STOP BLOCKED</span>
              ) : (
                <span className="text-emerald-400">PASS (SAFE)</span>
              )}
            </div>
          </div>
        </div>

        {/* Latency Card */}
        <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-zinc-800 text-zinc-300 border border-zinc-700/50">
            <Zap size={20} />
          </div>
          <div>
            <div className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
              Execution Time
            </div>
            <div className="text-sm font-mono font-semibold text-zinc-100 flex items-center gap-1.5">
              <span>{processing_time_ms} ms</span>
              <span className="text-[10px] px-1.5 py-0.2 bg-zinc-800 rounded text-zinc-400 border border-zinc-700 font-sans">
                Zero-Latency
              </span>
            </div>
          </div>
        </div>

        {/* PII Redacted Card */}
        <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-zinc-800 text-zinc-300 border border-zinc-700/50">
            <Lock size={20} />
          </div>
          <div>
            <div className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
              PII Redacted
            </div>
            <div className="text-sm font-semibold text-zinc-100 font-mono">
              {result.redacted_pii_count}{' '}
              <span className="text-xs font-normal text-zinc-500 font-sans">
                {result.redacted_pii_count === 1 ? 'entity' : 'entities'}
              </span>
            </div>
          </div>
        </div>

        {/* URLs Defanged Card */}
        <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-zinc-800 text-zinc-300 border border-zinc-700/50">
            <Link2 size={20} />
          </div>
          <div>
            <div className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
              URLs Defanged
            </div>
            <div className="text-sm font-semibold text-zinc-100 font-mono">
              {result.defanged_urls_count}{' '}
              <span className="text-xs font-normal text-zinc-500 font-sans">
                {result.defanged_urls_count === 1 ? 'link' : 'links'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Hard stop warning banner if triggered */}
      {result.is_hard_stop && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-900/70 text-red-200 flex items-start gap-3 shadow-lg">
          <AlertTriangle className="text-red-400 shrink-0 mt-0.5" size={20} />
          <div className="text-xs space-y-1">
            <div className="font-semibold text-red-300 text-sm">
              Critical Security Warning: Prompt Injection / Guardrail Triggered
            </div>
            <p className="text-red-300/80 leading-relaxed">
              This request was marked as a <strong className="text-red-200">Hard Stop</strong>. In production, 
              this ticket will be isolated and escalated directly to security operations without forwarding to the downstream LLM.
            </p>
          </div>
        </div>
      )}

      {/* Tabs for Clean Text vs Findings vs Diff */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-xl">
        <div className="flex items-center justify-between px-4 py-2 bg-zinc-900/80 border-b border-zinc-800">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveTab('clean')}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${
                activeTab === 'clean'
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/60'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Sanitized Output
            </button>
            <button
              onClick={() => setActiveTab('findings')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-md font-medium transition-all ${
                activeTab === 'findings'
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/60'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <span>Threat Findings</span>
              {result.injection_findings.length > 0 && (
                <span className="px-1.5 py-0.2 text-[10px] bg-red-950 text-red-300 rounded-full border border-red-800">
                  {result.injection_findings.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('diff')}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${
                activeTab === 'diff'
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/60'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Comparison View
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-zinc-500 font-mono">
              CustomerID: <strong className="text-zinc-300">{customer_id}</strong>
            </span>
          </div>
        </div>

        {/* Tab 1: Sanitized Output */}
        {activeTab === 'clean' && (
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-400 font-medium">Cleaned Safe Text for Downstream LLMs:</span>
              <button
                onClick={handleCopyClean}
                className="flex items-center gap-1 px-2 py-1 text-xs text-zinc-300 bg-zinc-900 hover:bg-zinc-800 rounded border border-zinc-800 transition-colors"
              >
                {copiedClean ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                <span>{copiedClean ? 'Copied' : 'Copy Clean Text'}</span>
              </button>
            </div>
            <div className="p-3.5 bg-zinc-900/90 rounded-lg border border-zinc-800 font-mono text-xs text-zinc-200 whitespace-pre-wrap leading-relaxed select-text min-h-[140px]">
              {result.clean_text}
            </div>

            {/* Risk Flags */}
            {result.risk_flags.length > 0 && (
              <div className="pt-2">
                <div className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider mb-2">
                  Risk Flags Detected:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {result.risk_flags.map((flag, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 text-[11px] font-mono bg-zinc-900 border border-zinc-700 text-zinc-300 rounded-md"
                    >
                      🚩 {flag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Findings */}
        {activeTab === 'findings' && (
          <div className="p-4 space-y-3">
            {result.injection_findings.length === 0 ? (
              <div className="p-8 text-center text-zinc-500">
                <Sparkles className="mx-auto mb-2 text-zinc-600" size={24} />
                <p className="text-xs">No prompt injection or adversarial patterns detected.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {result.injection_findings.map((finding, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-zinc-900/90 rounded-lg border border-zinc-800/80 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-zinc-200">
                          {finding.rule_id}
                        </span>
                        <span
                          className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded border ${getSeverityBadge(
                            finding.severity
                          )}`}
                        >
                          {finding.severity}
                        </span>
                      </div>
                      <span className="text-[11px] text-zinc-500 font-mono">
                        {finding.category}
                      </span>
                    </div>

                    <p className="text-xs text-zinc-400">{finding.description}</p>

                    <div className="p-2 bg-zinc-950 rounded border border-zinc-800/90 font-mono text-xs text-amber-300 break-all">
                      <span className="text-zinc-600 text-[10px] select-none mr-2">MATCH:</span>
                      "{finding.matched_text}"
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Comparison View */}
        {activeTab === 'diff' && (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-zinc-400 flex items-center justify-between">
                <span>Original Raw Text</span>
                <span className="text-[11px] font-mono text-zinc-500">{rawText.length} chars</span>
              </div>
              <div className="p-3 bg-zinc-900/60 rounded-lg border border-zinc-800/80 font-mono text-xs text-zinc-400 whitespace-pre-wrap leading-relaxed h-[220px] overflow-y-auto custom-scrollbar select-text">
                {rawText}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-emerald-400 flex items-center justify-between">
                <span>Sanitized Safe Text</span>
                <span className="text-[11px] font-mono text-zinc-500">{result.clean_text.length} chars</span>
              </div>
              <div className="p-3 bg-zinc-900/90 rounded-lg border border-emerald-950/80 font-mono text-xs text-zinc-200 whitespace-pre-wrap leading-relaxed h-[220px] overflow-y-auto custom-scrollbar select-text">
                {result.clean_text}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
