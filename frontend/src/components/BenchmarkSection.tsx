import React from 'react';
import { DollarSign, Check, X, BarChart3, Clock } from 'lucide-react';

export const BenchmarkSection: React.FC = () => {
  return (
    <section id="benchmarks" className="section-container section-container-dark">
      <div className="page-wrapper">
        <div className="section-header">
          <div className="section-tag" style={{ color: 'var(--emerald-safe)' }}>
            <BarChart3 size={13} />
            <span>EMPIRICAL BENCHMARKS & LATENCY</span>
          </div>
          <h2 className="section-title">
            Traditional LLM Triage vs TriageGuard
          </h2>
          <p className="section-desc">
            Comparing a standard monolithic generative triage pipeline against TriageGuard's
            two-layer MLSecOps architecture across speed, cost, and security invariants.
          </p>
        </div>

        {/* Comparison Cards / Meters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {/* Latency Comparison Card */}
          <div className="neo-card p-6 bg-[#12141D]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Clock className="text-[#CCFF00]" size={18} />
                <h3 className="font-heading font-extrabold text-base text-white">
                  Decision Latency Comparison
                </h3>
              </div>
              <span className="neo-badge neo-badge-volt text-xs">
                98% FASTER
              </span>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs mb-1.5 font-sans">
                  <span className="text-zinc-400">Traditional Generative LLM Triage</span>
                  <span className="font-mono text-zinc-300 font-bold">1,850 ms</span>
                </div>
                <div className="w-full h-3 rounded bg-[#0A0B10] overflow-hidden border-2 border-[#232736]">
                  <div className="h-full bg-[#FF4949]" style={{ width: '100%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1.5 font-sans">
                  <span className="text-[#CCFF00] font-bold">TriageGuard (System 1 Laya)</span>
                  <span className="font-mono text-[#CCFF00] font-bold">~38 ms</span>
                </div>
                <div className="w-full h-3 rounded bg-[#0A0B10] overflow-hidden border-2 border-[#232736]">
                  <div
                    className="h-full bg-[#CCFF00]"
                    style={{ width: '4%' }}
                  />
                </div>
              </div>
            </div>

            <p className="font-sans text-xs text-zinc-400 mt-4 leading-relaxed">
              Laya avoids autoregressive token loops entirely. Decisions are calculated in a single forward pass,
              guaranteeing instant customer dispatch and strict SLA compliance.
            </p>
          </div>

          {/* Operational Cost Card */}
          <div className="neo-card p-6 bg-[#12141D]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <DollarSign className="text-[#00F5A0]" size={18} />
                <h3 className="font-heading font-extrabold text-base text-white">
                  Estimated Cost Per 100k Tickets
                </h3>
              </div>
              <span className="neo-badge neo-badge-emerald text-xs">
                98% SAVINGS
              </span>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs mb-1.5 font-sans">
                  <span className="text-zinc-400">Generative Model (GPT-4o / Claude 3.5)</span>
                  <span className="font-mono text-zinc-300 font-bold">~$480.00</span>
                </div>
                <div className="w-full h-3 rounded bg-[#0A0B10] overflow-hidden border-2 border-[#232736]">
                  <div className="h-full bg-[#FF4949]" style={{ width: '100%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1.5 font-sans">
                  <span className="text-[#00F5A0] font-bold">TriageGuard Fast Gateway</span>
                  <span className="font-mono text-[#00F5A0] font-bold">~$8.50</span>
                </div>
                <div className="w-full h-3 rounded bg-[#0A0B10] overflow-hidden border-2 border-[#232736]">
                  <div
                    className="h-full bg-[#00F5A0]"
                    style={{ width: '3%' }}
                  />
                </div>
              </div>
            </div>

            <p className="font-sans text-xs text-zinc-400 mt-4 leading-relaxed">
              TriageGuard runs lightweight, optimized classifiers on commodity CPU/GPU compute,
              eliminating the multi-million dollar annual LLM token overhead of simple ticket routing.
            </p>
          </div>
        </div>

        {/* Enterprise Comparison Table */}
        <div className="neo-card overflow-hidden bg-[#12141D]">
          <div className="p-4 bg-[#0A0B10] border-b-2 border-[#232736] flex items-center justify-between">
            <h3 className="font-heading font-extrabold text-base text-white">
              Feature & Security Matrix
            </h3>
            <span className="neo-badge neo-badge-dark text-[10px]">
              ARCHITECTURE MATRIX
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-[#0E1017] border-b-2 border-[#232736] font-mono text-zinc-400 uppercase text-[11px]">
                <tr>
                  <th className="py-3 px-4">Evaluation Dimension</th>
                  <th className="py-3 px-4 text-zinc-400">Direct Generative LLM</th>
                  <th className="py-3 px-4 text-[#CCFF00] font-bold">TriageGuard MLSecOps Gateway</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#232736] text-zinc-300">
                <tr className="hover:bg-[#181B26] transition-colors">
                  <td className="py-3 px-4 font-bold text-white">Prompt Injection Immunity</td>
                  <td className="py-3 px-4 text-[#FF4949] flex items-center gap-1.5">
                    <X size={14} /> Vulnerable to instruction overrides
                  </td>
                  <td className="py-3 px-4 text-[#CCFF00] font-bold">
                    <Check size={14} className="inline mr-1" /> Meta Prompt Guard 2 + Zero Router Tools
                  </td>
                </tr>
                <tr className="hover:bg-[#181B26] transition-colors">
                  <td className="py-3 px-4 font-bold text-white">Deterministic PII Redaction</td>
                  <td className="py-3 px-4 text-zinc-400">
                    Probabilistic (LLMs miss regex patterns)
                  </td>
                  <td className="py-3 px-4 text-[#CCFF00] font-bold">
                    <Check size={14} className="inline mr-1" /> 100% Deterministic Regex Masking
                  </td>
                </tr>
                <tr className="hover:bg-[#181B26] transition-colors">
                  <td className="py-3 px-4 font-bold text-white">Stateful Failure Mode</td>
                  <td className="py-3 px-4 text-[#FF4949]">
                    Fails Open (Unbounded hallucination)
                  </td>
                  <td className="py-3 px-4 text-[#CCFF00] font-bold">
                    <Check size={14} className="inline mr-1" /> Fail-Closed LangGraph Policy Gate
                  </td>
                </tr>
                <tr className="hover:bg-[#181B26] transition-colors">
                  <td className="py-3 px-4 font-bold text-white">Auditability & Tracing</td>
                  <td className="py-3 px-4 text-zinc-400">
                    Opaque LLM rationale logs
                  </td>
                  <td className="py-3 px-4 text-[#CCFF00] font-bold">
                    <Check size={14} className="inline mr-1" /> Immutable Node-by-Node State Traces
                  </td>
                </tr>
                <tr className="hover:bg-[#181B26] transition-colors">
                  <td className="py-3 px-4 font-bold text-white">Average Processing Latency</td>
                  <td className="py-3 px-4 text-zinc-400">
                    1,200 ms - 3,500 ms
                  </td>
                  <td className="py-3 px-4 text-[#CCFF00] font-bold">
                    <Check size={14} className="inline mr-1" /> &lt; 38 ms (System 1)
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
};

export default BenchmarkSection;
