import { Cpu, XCircle, CheckCircle2 } from 'lucide-react';

export const SystemComparisonSection: React.FC = () => {
  return (
    <section id="architecture" className="section-container section-container-dark">
      <div className="page-wrapper">
        <div className="section-header">
          <div className="section-tag" style={{ color: 'var(--cyan-accent)' }}>
            <Cpu size={13} />
            <span>TWO-LAYER SYSTEM PARADIGM</span>
          </div>
          <h2 className="section-title">
            Why Enterprise AI Demands a{' '}
            <span style={{ backgroundColor: 'var(--cyan-accent)', color: '#000', padding: '2px 8px', borderRadius: '4px', display: 'inline-block' }}>
              Two-Layer Architecture
            </span>
          </h2>
          <p className="section-desc">
            Exposing tool-capable Large Language Models directly to untrusted customer messages is
            an acute security vulnerability. TriageGuard enforces a strict architectural split between fast heuristics and stateful guardrails.
          </p>
        </div>

        {/* Side-by-side Architectural Comparison Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
          {/* Traditional Monolithic Architecture (The Risk) */}
          <div className="neo-card p-6 sm:p-8 border-2 border-[#FF4949]/60 shadow-[6px_6px_0px_#000] flex flex-col justify-between relative bg-[#130E10]">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="neo-badge neo-badge-coral text-[11px]">
                  VULNERABLE PATTERN
                </span>
                <span className="font-mono text-xs text-[#FF4949] font-bold flex items-center gap-1">
                  <XCircle size={14} /> High Attack Surface
                </span>
              </div>

              <h3 className="font-heading font-extrabold text-xl text-white mb-2">
                Monolithic LLM-First Triage
              </h3>
              <p className="font-sans text-xs text-zinc-400 leading-relaxed mb-6">
                Routing raw, uninspected customer emails and chats directly into a tool-equipped
                generative model (GPT-4o / Claude / Gemini) to handle both categorization and execution.
              </p>

              <div className="space-y-3 font-sans text-xs">
                <div className="p-3.5 rounded-lg bg-[#0A0B10] border border-[#FF4949]/30 flex items-start gap-3">
                  <XCircle size={16} className="text-[#FF4949] shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white font-bold">Exposed Tool APIs:</strong> If the model has
                    access to CRM databases or refund APIs, an adversary with prompt injection can
                    trick it into unauthorized tool execution.
                  </div>
                </div>

                <div className="p-3.5 rounded-lg bg-[#0A0B10] border border-[#FF4949]/30 flex items-start gap-3">
                  <XCircle size={16} className="text-[#FF4949] shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white font-bold">High Latency & Token Burn:</strong> Running
                    2,000ms autoregressive generation loops on simple password resets or return
                    inquiries wastes enterprise compute budgets.
                  </div>
                </div>

                <div className="p-3.5 rounded-lg bg-[#0A0B10] border border-[#FF4949]/30 flex items-start gap-3">
                  <XCircle size={16} className="text-[#FF4949] shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white font-bold">Uncontrolled PII Exposure:</strong> Unsanitized
                    credit cards, SSNs, and API keys are streamed directly into commercial model
                    providers, risking compliance violations.
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-4 border-t-2 border-[#232736] text-[11px] font-mono text-[#FF4949] font-bold flex items-center justify-between">
              <span>Failure Mode: Fails Open</span>
              <span className="text-zinc-500 font-normal">Unbounded Hallucination Surface</span>
            </div>
          </div>

          {/* TriageGuard Two-Layer Architecture (The Solution) */}
          <div className="neo-card p-6 sm:p-8 border-2 border-[#CCFF00] shadow-[6px_6px_0px_#CCFF00] flex flex-col justify-between relative bg-[#0E120A]">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="neo-badge neo-badge-volt text-[11px]">
                  TRIAGEGUARD ARCHITECTURE
                </span>
                <span className="font-mono text-xs text-[#CCFF00] font-bold flex items-center gap-1">
                  <CheckCircle2 size={14} /> Zero Router Tools
                </span>
              </div>

              <h3 className="font-heading font-extrabold text-xl text-white mb-2">
                Decoupled System 1 + System 2
              </h3>
              <p className="font-sans text-xs text-zinc-300 leading-relaxed mb-6">
                Untrusted text is first disarmed deterministically in sub-5ms before being classified
                by Laya without tool access. High-impact operations route through a fail-closed LangGraph DAG.
              </p>

              <div className="space-y-3 font-sans text-xs">
                <div className="p-3.5 rounded-lg bg-[#0A0B10] border border-[#CCFF00]/40 flex items-start gap-3">
                  <CheckCircle2 size={16} className="text-[#CCFF00] shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white font-bold">System 1 Fast Routing (&lt; 38ms):</strong> Uses a
                    non-autoregressive classifier. Cannot hallucinate tools or execute external system commands.
                  </div>
                </div>

                <div className="p-3.5 rounded-lg bg-[#0A0B10] border border-[#CCFF00]/40 flex items-start gap-3">
                  <CheckCircle2 size={16} className="text-[#CCFF00] shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white font-bold">Deterministic PII Defanging:</strong> Regex defanging
                    and regex masking scrub credit cards, emails, and credentials locally before any model evaluation.
                  </div>
                </div>

                <div className="p-3.5 rounded-lg bg-[#0A0B10] border border-[#CCFF00]/40 flex items-start gap-3">
                  <CheckCircle2 size={16} className="text-[#CCFF00] shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white font-bold">Fail-Closed LangGraph DAG:</strong> If Prompt Guard 2
                    flags an adversarial injection or confidence drops below 0.70, ticket is quarantined or escalated.
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-4 border-t-2 border-[#232736] text-[11px] font-mono text-[#CCFF00] font-bold flex items-center justify-between">
              <span>Failure Mode: Fails Closed</span>
              <span className="text-zinc-300 font-normal">Immutable State Audit Trail</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default SystemComparisonSection;
