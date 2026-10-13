import React from 'react';
import {
  ShieldCheck,
  Zap,
  ArrowRight,
  Play,
  Lock,
  Cpu,
  Layers,
} from 'lucide-react';
import type { HealthStatus } from '../services/api';

interface LandingHeroProps {
  onNavigateToSoc: () => void;
  onScrollToInteractiveFlow: () => void;
  onScrollToArchitecture: () => void;
  healthStatus: HealthStatus | null;
}

export const LandingHero: React.FC<LandingHeroProps> = ({
  onNavigateToSoc,
  onScrollToInteractiveFlow,
  onScrollToArchitecture,
  healthStatus,
}) => {
  return (
    <section className="hero-wrap">
      {/* Background Grid Pattern */}
      <div className="bg-grid-pattern" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.15 }} />

      <div className="hero-content">
        {/* Top Announcement Tag */}
        <div className="section-tag" style={{ margin: '0 auto 18px auto' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '9999px', backgroundColor: 'var(--volt-primary)', boxShadow: '0 0 6px var(--volt-primary)' }} />
          <span>MLSecOps PLATFORM · ZERO-TRUST SUPPORT GATEWAY</span>
          <span className="neo-badge neo-badge-volt" style={{ fontSize: '9px', padding: '1px 5px', marginLeft: '4px' }}>
            v2.4
          </span>
        </div>

        {/* Hero Headline with Space Grotesk */}
        <h1 className="hero-heading">
          The <span className="hero-highlight-volt">MLSecOps Gateway</span> for Autonomous AI Support
        </h1>

        {/* Hero Description */}
        <p className="hero-paragraph">
          Never expose autonomous, tool-calling Large Language Models to untrusted raw customer text.
          TriageGuard enforces <strong style={{ color: '#FFFFFF' }}>deterministic heuristic sanitization</strong>,{' '}
          <strong style={{ color: '#FFFFFF' }}>sub-38ms intent routing</strong>, and{' '}
          <strong style={{ color: 'var(--volt-primary)' }}>fail-closed LangGraph guardrails</strong> before text ever reaches an LLM execution context.
        </p>

        {/* Action Buttons */}
        <div className="hero-buttons-row">
          <button onClick={onNavigateToSoc} className="neo-btn-volt">
            <Play size={14} className="fill-black" />
            <span>Launch Playground Workbench</span>
            <ArrowRight size={14} />
          </button>

          <button onClick={onScrollToInteractiveFlow} className="neo-btn-secondary">
            <Zap size={14} color="var(--volt-primary)" />
            <span>Interactive Flow Simulator</span>
          </button>

          <button onClick={onScrollToArchitecture} className="neo-btn-secondary">
            <Layers size={14} color="var(--cyan-accent)" />
            <span>Two-Layer Architecture</span>
          </button>
        </div>

        {/* Telemetry Metric Cards */}
        <div className="hero-metrics-grid">
          <div className="metric-tile">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--volt-primary)', marginBottom: '4px' }}>
              <Zap size={16} />
              <span className="metric-tile-val">&lt; 38 ms</span>
            </div>
            <div className="metric-tile-title">Routing Latency</div>
            <div className="metric-tile-sub">Laya Non-Autoregressive Engine</div>
          </div>

          <div className="metric-tile">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--cyan-accent)', marginBottom: '4px' }}>
              <ShieldCheck size={16} />
              <span className="metric-tile-val">0 Tools</span>
            </div>
            <div className="metric-tile-title">Router Tool Privileges</div>
            <div className="metric-tile-sub">Invariant #2: Zero Attack Surface</div>
          </div>

          <div className="metric-tile">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--amber-warning)', marginBottom: '4px' }}>
              <Lock size={16} />
              <span className="metric-tile-val">100%</span>
            </div>
            <div className="metric-tile-title">Fail-Closed Guarantee</div>
            <div className="metric-tile-sub">Confidence &lt; 0.70 ➔ Human Review</div>
          </div>

          <div className="metric-tile">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--purple-brand)', marginBottom: '4px' }}>
              <Cpu size={16} />
              <span className="metric-tile-val">92%</span>
            </div>
            <div className="metric-tile-title">Token Cost Offloaded</div>
            <div className="metric-tile-sub">Commodity CPU Model Compute</div>
          </div>
        </div>

        {/* Status Footnote */}
        <div style={{ marginTop: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '9999px', backgroundColor: healthStatus?.online ? 'var(--emerald-safe)' : 'var(--amber-warning)' }} />
          <span>
            FastAPI Gateway:{' '}
            <strong style={{ color: '#CBD5E1' }}>
              {healthStatus?.online ? 'Online (FastAPI 8000)' : 'Standalone Simulation Mode'}
            </strong>
          </span>
          <span>·</span>
          <span>
            Injection Guard:{' '}
            <strong style={{ color: 'var(--volt-primary)' }}>
              Meta Prompt Guard 2 (86M)
            </strong>
          </span>
        </div>
      </div>
    </section>
  );
};

export default LandingHero;
