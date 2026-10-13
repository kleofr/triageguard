import React from 'react';
import { Shield, ExternalLink, Terminal, CheckCircle2 } from 'lucide-react';
import type { HealthStatus } from '../services/api';

interface FooterProps {
  healthStatus: HealthStatus | null;
  onScrollToTop: () => void;
}

export const Footer: React.FC<FooterProps> = ({ healthStatus, onScrollToTop }) => {
  return (
    <footer className="bg-[#0A0B10] border-t-2 border-[#232736] pt-14 pb-10">
      <div className="page-wrapper">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* Brand Info */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-md bg-[#CCFF00] text-black font-extrabold border-2 border-black shadow-[2px_2px_0px_#000]">
                <Shield size={18} className="stroke-[2.5]" />
              </div>
              <span className="font-heading font-extrabold text-base tracking-tight text-white">
                TRIAGEGUARD
              </span>
              <span className="neo-badge neo-badge-volt text-[10px]">
                MLSecOps GATEWAY
              </span>
            </div>
            <p className="font-sans text-xs text-zinc-400 leading-relaxed max-w-sm">
              Deterministic customer support triage and prompt injection defense gateway built
              with LangGraph and Meta Prompt Guard 2. Secure, auditable, and fail-closed by default.
            </p>
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-400 pt-1">
              <span
                className={`w-2 h-2 rounded-full ${
                  healthStatus?.online ? 'bg-[#00F5A0] shadow-[0_0_8px_#00F5A0]' : 'bg-[#FFBE1A]'
                }`}
              />
              <span>
                System Gateway Status:{' '}
                <strong className="text-white">
                  {healthStatus?.online ? 'FastAPI Pipelines Operational' : 'Offline / Standalone Simulator'}
                </strong>
              </span>
            </div>
          </div>

          {/* Core Resources */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300 mb-3 font-mono">
              Architecture & Docs
            </h4>
            <ul className="space-y-2 text-xs text-zinc-400 font-sans">
              <li>
                <a
                  href="/docs"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-[#CCFF00] transition-colors flex items-center gap-1.5"
                >
                  <Terminal size={12} />
                  <span>FastAPI OpenAPI Spec</span>
                  <ExternalLink size={10} className="text-zinc-600" />
                </a>
              </li>
              <li>
                <a
                  href="#architecture"
                  className="hover:text-[#CCFF00] transition-colors"
                >
                  LangGraph DAG Design
                </a>
              </li>
              <li>
                <a
                  href="#benchmarks"
                  className="hover:text-[#CCFF00] transition-colors"
                >
                  System 1 vs System 2 Benchmark
                </a>
              </li>
              <li>
                <a
                  href="#interactive-flow"
                  className="hover:text-[#CCFF00] transition-colors"
                >
                  Interactive Simulator
                </a>
              </li>
            </ul>
          </div>

          {/* MLSecOps Invariants */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300 mb-3 font-mono">
              MLSecOps Standards
            </h4>
            <ul className="space-y-2 text-xs text-zinc-300 font-sans">
              <li className="flex items-center gap-1.5">
                <CheckCircle2 size={12} className="text-[#CCFF00]" />
                <span>Fail-Closed Decision Policy</span>
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 size={12} className="text-[#CCFF00]" />
                <span>Zero Router Tool Privileges</span>
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 size={12} className="text-[#CCFF00]" />
                <span>Zero PII or Secrets in Logs</span>
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 size={12} className="text-[#CCFF00]" />
                <span>Cryptographic Weight Pinning</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-6 border-t-2 border-[#232736] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-zinc-500">
          <div>
            © 2026 TriageGuard MLSecOps Gateway. Open source enterprise MIT License.
          </div>
          <button
            onClick={onScrollToTop}
            className="hover:text-[#CCFF00] transition-colors cursor-pointer"
          >
            ↑ Back to Top
          </button>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
