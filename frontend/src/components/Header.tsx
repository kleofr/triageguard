import React, { useState } from 'react';
import {
  Shield,
  Settings,
  RefreshCw,
  History,
  Play,
  ArrowRight,
} from 'lucide-react';
import type { HealthStatus } from '../services/api';

interface HeaderProps {
  currentView: 'website' | 'playground';
  onNavigateToWebsite: () => void;
  onNavigateToPlayground: (mode?: 'single' | 'batch') => void;
  backendUrl: string;
  onBackendUrlChange: (url: string) => void;
  healthStatus: HealthStatus | null;
  onRefreshHealth: () => void;
  isHealthChecking: boolean;
  historyCount: number;
  onToggleHistory: () => void;
  isHistoryOpen?: boolean;
  onScrollToSection: (sectionId: string) => void;
  playgroundMode?: 'single' | 'batch';
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onNavigateToWebsite,
  onNavigateToPlayground,
  backendUrl,
  onBackendUrlChange,
  healthStatus,
  onRefreshHealth,
  isHealthChecking,
  historyCount,
  onToggleHistory,
  onScrollToSection,
}) => {
  const [showConfig, setShowConfig] = useState(false);
  const [tempUrl, setTempUrl] = useState(backendUrl);

  const handleSaveUrl = (e: React.FormEvent) => {
    e.preventDefault();
    onBackendUrlChange(tempUrl);
    setShowConfig(false);
  };

  const handleNavClick = (sectionId: string) => {
    if (currentView === 'playground') {
      onNavigateToWebsite();
      setTimeout(() => {
        onScrollToSection(sectionId);
      }, 100);
    } else {
      onScrollToSection(sectionId);
    }
  };

  const isHealthy = Boolean(healthStatus?.online);

  return (
    <header className="site-header">
      <div className="header-inner">
        {/* Brand */}
        <div onClick={onNavigateToWebsite} className="brand-group">
          <div className="brand-icon-box">
            <Shield size={20} className="stroke-[2.5]" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="brand-title">TRIAGEGUARD</span>
              <span className="neo-badge neo-badge-volt" style={{ fontSize: '10px', padding: '1px 6px' }}>
                MLSecOps
              </span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Deterministic AI Support Gateway
            </div>
          </div>
        </div>

        {/* Center: The Two Primary Sections Switcher */}
        <div className="section-nav-switcher">
          <button
            onClick={onNavigateToWebsite}
            className={`nav-tab-btn ${currentView === 'website' ? 'active' : ''}`}
          >
            <span>Website</span>
          </button>

          <button
            onClick={() => onNavigateToPlayground()}
            className={`nav-tab-btn ${currentView === 'playground' ? 'active' : ''}`}
          >
            <Play size={12} className={currentView === 'playground' ? 'fill-black' : ''} />
            <span>Playground</span>
            <span
              style={{
                fontSize: '9px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 800,
                padding: '1px 5px',
                borderRadius: '3px',
                backgroundColor: currentView === 'playground' ? '#000' : 'rgba(255,255,255,0.08)',
                color: currentView === 'playground' ? 'var(--volt-primary)' : '#94A3B8',
              }}
            >
              LIVE
            </span>
          </button>
        </div>

        {/* Website Anchor Links (Subtle & clean text links) */}
        {currentView === 'website' && (
          <nav className="header-nav-links" style={{ alignItems: 'center', gap: '18px' }}>
            {[
              { id: 'interactive-flow', label: 'Interactive Flow' },
              { id: 'architecture', label: 'Architecture' },
              { id: 'langgraph-dag', label: 'LangGraph DAG' },
              { id: 'invariants', label: '7 Invariants' },
              { id: 'benchmarks', label: 'Benchmarks' },
            ].map((link) => (
              <button
                key={link.id}
                onClick={() => handleNavClick(link.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-heading)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: '4px 0',
                  transition: 'color 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#FFFFFF')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
              >
                {link.label}
              </button>
            ))}
          </nav>
        )}

        {/* Right Tools: Health, History, Playground Launch CTA */}
        <div className="header-right-tools">
          {/* Status Badge */}
          <div
            onClick={() => setShowConfig(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 10px',
              borderRadius: '6px',
              backgroundColor: 'var(--bg-surface)',
              border: '1.5px solid var(--border-hard)',
              cursor: 'pointer',
            }}
            title="Configure FastAPI Gateway URL"
          >
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '9999px',
                backgroundColor: isHealthy ? 'var(--emerald-safe)' : 'var(--amber-warning)',
                boxShadow: isHealthy ? '0 0 6px var(--emerald-safe)' : 'none',
              }}
            />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, color: '#E2E8F0' }}>
              {isHealthy ? 'ONLINE' : 'DEMO MODE'}
            </span>
            <Settings size={12} color="#64748B" />
          </div>

          {/* History Button */}
          <button
            onClick={onToggleHistory}
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '7px 10px',
              borderRadius: '6px',
              backgroundColor: 'var(--bg-surface)',
              border: '1.5px solid var(--border-hard)',
              color: '#CBD5E1',
              cursor: 'pointer',
            }}
            title="View Execution History"
          >
            <History size={14} />
            {historyCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '-5px',
                  right: '-5px',
                  padding: '0 4px',
                  minWidth: '14px',
                  height: '14px',
                  borderRadius: '9999px',
                  backgroundColor: 'var(--volt-primary)',
                  color: '#000',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '9px',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid #000',
                }}
              >
                {historyCount}
              </span>
            )}
          </button>

          {/* Direct CTA (When on website) */}
          {currentView === 'website' && (
            <button
              onClick={() => onNavigateToPlayground('single')}
              className="neo-btn-volt"
              style={{ padding: '7px 14px', fontSize: '12px' }}
            >
              <span>Workbench</span>
              <ArrowRight size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Backend API Configuration Modal */}
      {showConfig && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(6px)',
          }}
        >
          <div
            className="neo-card"
            style={{
              padding: '24px',
              width: '100%',
              maxWidth: '440px',
              boxShadow: '6px 6px 0px #000',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', paddingBottom: '12px', borderBottom: '2px solid var(--border-hard)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Settings size={18} color="var(--volt-primary)" />
                <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '16px', color: '#FFF' }}>
                  FastAPI Gateway Configuration
                </h3>
              </div>
              <button
                onClick={() => setShowConfig(false)}
                style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '16px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveUrl} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, color: '#94A3B8', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>
                  Backend Endpoint URL:
                </label>
                <input
                  type="text"
                  value={tempUrl}
                  onChange={(e) => setTempUrl(e.target.value)}
                  placeholder="http://localhost:8000"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--bg-input)',
                    border: '2px solid var(--border-hard)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    color: '#FFF',
                    outline: 'none',
                  }}
                />
              </div>

              <div
                style={{
                  padding: '12px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--bg-input)',
                  border: '1.5px solid var(--border-hard)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '9999px',
                      backgroundColor: isHealthy ? 'var(--emerald-safe)' : 'var(--coral-danger)',
                    }}
                  />
                  <span style={{ fontFamily: 'var(--font-mono)', color: '#CBD5E1' }}>
                    {isHealthy ? 'Connected & Healthy' : 'Offline / Standalone Simulator'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onRefreshHealth}
                  disabled={isHealthChecking}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: 'none',
                    border: 'none',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    color: '#94A3B8',
                    cursor: 'pointer',
                  }}
                >
                  <RefreshCw size={11} className={isHealthChecking ? 'animate-spin' : ''} />
                  <span>Test</span>
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', paddingTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowConfig(false)}
                  className="neo-btn-secondary"
                  style={{ padding: '6px 14px', fontSize: '12px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="neo-btn-volt"
                  style={{ padding: '6px 16px', fontSize: '12px' }}
                >
                  Save Gateway
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
