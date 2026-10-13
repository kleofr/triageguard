import React, { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';

interface FaqItem {
  question: string;
  answer: string;
}

const FAQS: FaqItem[] = [
  {
    question: 'How does the fail-closed policy prevent accidental autonomous actions?',
    answer:
      'TriageGuard strictly follows Invariant #3: any execution branch with a routing confidence score below 0.70, an unhandled risk flag, or a sanitization alert immediately terminates in a human review queue. It is architecturally impossible for uncertain or risky tickets to trigger autonomous drafting or downstream automated workflows.',
  },
  {
    question: 'Where is customer text sanitized, and does raw PII ever reach telemetry logs?',
    answer:
      'Sanitization runs synchronously as Node 1 in the LangGraph state machine before any classification model is invoked. All credit card numbers, social security numbers, API tokens, email addresses, and phone numbers are redacted, and URLs/IPs are defanged. By Invariant #5, telemetry traces record only redacted snippets and deterministic ticket hashes—raw customer PII is never persisted to logs.',
  },
  {
    question: 'Why split the pipeline into System 1 (Laya) and System 2 (LLM)?',
    answer:
      'Feeding every incoming ticket directly into a generative Large Language Model is slow (~2,000ms), costly, and dangerous because generative models with tool access can be tricked via prompt injection. System 1 (Laya) is a non-autoregressive classifier running in ~32ms with zero tool access. System 2 is only invoked downstream on safe, verified routes where tools are strictly restricted.',
  },
  {
    question: 'Can TriageGuard be deployed on-premises or in an air-gapped private cloud?',
    answer:
      'Yes. TriageGuard is designed as a standalone FastAPI service with zero external API dependencies required for routing. Both the Laya router weights and the Meta Llama Prompt Guard 2-86M classifier are pinned by commit hash, verified with cryptographic checksums, and baked directly into container images (Invariant #6).',
  },
  {
    question: 'How does Meta Prompt Guard 2-86M prevent jailbreaks?',
    answer:
      'Prompt Guard 2 is a fine-tuned 86-million parameter DeBERTa-based classifier specifically trained on adversarial jailbreaks, instructional overrides, and indirect prompt injections. It evaluates the ticket and produces an injection probability score. If suspicious tokens or attack patterns are flagged, the ticket is instantly quarantined.',
  },
  {
    question: 'How does TriageGuard connect to existing help desks like Zendesk or Salesforce?',
    answer:
      'TriageGuard exposes standard REST endpoints (/api/v1/triage and /api/v1/sanitize) as well as streaming LangGraph state updates. You can trigger it via webhooks from Zendesk, Salesforce Service Cloud, Jira Service Management, or Intercom, returning rich routing metadata, sanitized bodies, and confidence scores.',
  },
];

export const FaqSection: React.FC = () => {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const toggle = (idx: number) => {
    setOpenIdx(openIdx === idx ? null : idx);
  };

  return (
    <section id="faq" className="section-container section-container-alt">
      <div className="page-wrapper" style={{ maxWidth: '840px' }}>
        <div className="section-header">
          <div className="section-tag" style={{ color: 'var(--purple-brand)' }}>
            <HelpCircle size={13} />
            <span>ENTERPRISE ASSURANCE & FAQ</span>
          </div>
          <h2 className="section-title">
            Frequently Asked Questions
          </h2>
          <p className="section-desc">
            Everything your engineering, compliance, and security teams need to know.
          </p>
        </div>

        <div className="space-y-3.5">
          {FAQS.map((faq, idx) => {
            const isOpen = openIdx === idx;
            return (
              <div
                key={idx}
                className="neo-card overflow-hidden bg-[#12141D] border-2 border-[#232736]"
              >
                <button
                  onClick={() => toggle(idx)}
                  className="w-full p-4.5 text-left flex items-center justify-between gap-4 font-heading text-sm font-bold text-white hover:text-[#CCFF00] transition-colors cursor-pointer"
                >
                  <span>{faq.question}</span>
                  <div className="p-1 rounded bg-[#0A0B10] border border-[#232736] text-zinc-400 shrink-0">
                    {isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </div>
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 pt-1 text-xs text-zinc-300 leading-relaxed font-sans border-t border-[#232736] animate-fadeIn">
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default FaqSection;
