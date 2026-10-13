import React from 'react';
import { Shield, CheckCircle2, Lock, FileText, Cpu, Server, AlertCircle } from 'lucide-react';

const INVARIANTS = [
  {
    num: '01',
    rule: 'Sanitize Before Any Model',
    short: 'Raw ticket text never reaches any model before the sanitizer has run.',
    detail:
      'Zero-width characters are stripped, active URLs/IPs are defanged, and sensitive customer PII (credit cards, SSNs, phone numbers) are masked before Laya or LLMs ingest text.',
    icon: Lock,
    accent: 'border-l-[#CCFF00]',
    badge: 'neo-badge-volt',
  },
  {
    num: '02',
    rule: 'Router Has Zero Tools',
    short: 'The Laya router has no tool access and its output is labels plus confidence scores only.',
    detail:
      'Laya cannot call database queries, CRM APIs, or write files. Even if an attacker injects shell commands or instruction overrides, the router has zero execution capability.',
    icon: Cpu,
    accent: 'border-l-[#00F0FF]',
    badge: 'neo-badge-cyan',
  },
  {
    num: '03',
    rule: 'Fail-Closed Security Default',
    short: 'Any path with low confidence, a risk flag, or a failed guard ends in a human queue.',
    detail:
      'If classification confidence drops below 0.70, or if Meta Prompt Guard 2 detects a potential jailbreak, the LangGraph policy gate halts automation and routes to a human agent.',
    icon: AlertCircle,
    accent: 'border-l-[#FF4949]',
    badge: 'neo-badge-coral',
  },
  {
    num: '04',
    rule: 'Structured Trace Auditability',
    short: 'Every graph node writes a structured trace record. No silent steps.',
    detail:
      'Each state transition in the LangGraph DAG appends start timestamps, duration in milliseconds, node identity, and output diffs for compliance forensics and SOC2 audits.',
    icon: FileText,
    accent: 'border-l-[#FFBE1A]',
    badge: 'neo-badge-amber',
  },
  {
    num: '05',
    rule: 'Zero Secrets or PII in Logs',
    short: 'No secrets, PII, or full ticket bodies are written to logs.',
    detail:
      'Log drains record deterministic ticket hashes, masked snippets, and routing telemetry. Raw unredacted customer data is never leaked to log analyzers or third-party APMs.',
    icon: Shield,
    accent: 'border-l-[#A78BFA]',
    badge: 'neo-badge-purple',
  },
  {
    num: '06',
    rule: 'Pinned & Verified Weights',
    short: 'Model weights are never downloaded dynamically at runtime in production images.',
    detail:
      'Model checkpoints for Meta Prompt Guard 2-86M and Laya are pinned by commit hash, verified with cryptographic checksums, and containerized for air-gapped supply chain integrity.',
    icon: Server,
    accent: 'border-l-[#00F5A0]',
    badge: 'neo-badge-emerald',
  },
  {
    num: '07',
    rule: 'Gateway Isolation Principle',
    short: 'Frontends communicate solely with the FastAPI gateway, never to models directly.',
    detail:
      'Client applications never access raw model inference ports. All requests pass through FastAPI rate limits, authentication, and the LangGraph orchestration runtime.',
    icon: CheckCircle2,
    accent: 'border-l-[#CCFF00]',
    badge: 'neo-badge-volt',
  },
];

export const InvariantsSection: React.FC = () => {
  return (
    <section id="invariants" className="section-container section-container-dark">
      <div className="page-wrapper">
        <div className="section-header">
          <div className="section-tag" style={{ color: 'var(--volt-primary)' }}>
            <Shield size={13} />
            <span>MLSECOPS GUARANTEES</span>
          </div>
          <h2 className="section-title">
            The 7 Strict System Invariants
          </h2>
          <p className="section-desc">
            Invariants are non-negotiable architectural constraints. Any violation is treated as a critical
            system vulnerability rather than an acceptable edge case.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {INVARIANTS.map((inv) => {
            const Icon = inv.icon;
            return (
              <div
                key={inv.num}
                className={`neo-card-interactive p-5 flex flex-col justify-between border-l-4 ${inv.accent} bg-[#12141D]`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className={`neo-badge ${inv.badge} text-[10px]`}>
                      INVARIANT #{inv.num}
                    </span>
                    <Icon size={16} className="text-zinc-400" />
                  </div>

                  <h3 className="font-heading font-extrabold text-base text-white mb-1.5">
                    {inv.rule}
                  </h3>
                  <div className="font-mono text-xs text-[#CCFF00] mb-2 leading-snug font-bold">
                    {inv.short}
                  </div>
                  <p className="font-sans text-xs text-zinc-300 leading-relaxed">
                    {inv.detail}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default InvariantsSection;
