import React from 'react';
import {
  ShieldAlert,
  Lock,
  Zap,
  Activity,
  FileSpreadsheet,
  Workflow,
  Sparkles,
} from 'lucide-react';

const FEATURES = [
  {
    icon: Lock,
    title: 'Deterministic Sanitization & Defanging',
    badge: 'ZERO-REGEX ESCAPES',
    badgeClass: 'neo-badge-volt',
    description:
      'Defangs active URLs and raw IPv4/IPv6 addresses, strips invisible zero-width unicode characters, and redacts credit cards, SSNs, phone numbers, and API tokens with deterministic precision.',
    iconColor: 'text-[#CCFF00]',
  },
  {
    icon: ShieldAlert,
    title: 'Meta Prompt Guard 2 Threat Scanner',
    badge: '86M ML MODEL',
    badgeClass: 'neo-badge-coral',
    description:
      'Inline classification using Meta Llama Prompt Guard 2-86M to detect adversarial jailbreaks, system prompt overrides, and indirect injection payloads before they can poison agent context.',
    iconColor: 'text-[#FF4949]',
  },
  {
    icon: Zap,
    title: 'Sub-50ms Non-Autoregressive Routing',
    badge: 'SYSTEM 1 SPEED',
    badgeClass: 'neo-badge-amber',
    description:
      'Laya classifies category, urgency, and destination department in ~32ms without autoregressive token generation, saving over 90% of model compute costs compared to monolithic LLMs.',
    iconColor: 'text-[#FFBE1A]',
  },
  {
    icon: Workflow,
    title: 'LangGraph Stateful State Machine',
    badge: 'FAIL-CLOSED POLICY',
    badgeClass: 'neo-badge-purple',
    description:
      'Orchestrates multi-stage guardrails with conditional edges. If router confidence drops below 0.70 or security flags are triggered, tickets immediately fail closed into a human queue.',
    iconColor: 'text-[#A78BFA]',
  },
  {
    icon: Activity,
    title: 'Immutable Node-by-Node Audit Traces',
    badge: 'SOC2 & HIPAA READY',
    badgeClass: 'neo-badge-cyan',
    description:
      'Every single execution step logs millisecond durations, state diffs, and decision rationale into structured audit traces. Eliminates silent failures and enables full compliance forensics.',
    iconColor: 'text-[#00F0FF]',
  },
  {
    icon: FileSpreadsheet,
    title: 'Enterprise Batch Benchmarking',
    badge: 'FULL TEST SUITE',
    badgeClass: 'neo-badge-emerald',
    description:
      'Upload enterprise CSV datasets to stress-test your support taxonomy. Generates instant confusion matrices, per-category accuracy, and p50/p95/p99 latency percentiles.',
    iconColor: 'text-[#00F5A0]',
  },
];

export const FeaturesGrid: React.FC = () => {
  return (
    <section id="features" className="section-container section-container-alt">
      <div className="page-wrapper">
        <div className="section-header">
          <div className="section-tag" style={{ color: 'var(--volt-primary)' }}>
            <Sparkles size={13} />
            <span>ENTERPRISE MLSECOPS CAPABILITIES</span>
          </div>
          <h2 className="section-title">
            Built for High-Stakes Customer Operations
          </h2>
          <p className="section-desc">
            Engineered from first principles to give enterprise security and operations teams complete
            confidence in autonomous customer support workflows.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((feature, idx) => {
            const Icon = feature.icon;
            return (
              <div
                key={idx}
                className="neo-card-interactive p-6 flex flex-col justify-between bg-[#12141D] group"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className={`p-2.5 rounded-lg bg-[#0A0B10] border-2 border-[#232736] ${feature.iconColor} shadow-[2px_2px_0px_#000]`}>
                      <Icon size={20} />
                    </div>
                    <span className={`neo-badge ${feature.badgeClass} text-[10px]`}>
                      {feature.badge}
                    </span>
                  </div>

                  <h3 className="font-heading font-extrabold text-base text-white mb-2 group-hover:text-[#CCFF00] transition-colors">
                    {feature.title}
                  </h3>
                  <p className="font-sans text-xs text-zinc-400 leading-relaxed">
                    {feature.description}
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

export default FeaturesGrid;
