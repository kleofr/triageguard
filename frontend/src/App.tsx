import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { LandingHero } from './components/LandingHero';
import { InteractivePipelineDiagram } from './components/InteractivePipelineDiagram';
import { SystemComparisonSection } from './components/SystemComparisonSection';
import { LangGraphDagDiagram } from './components/LangGraphDagDiagram';
import { InvariantsSection } from './components/InvariantsSection';
import { FeaturesGrid } from './components/FeaturesGrid';
import { BenchmarkSection } from './components/BenchmarkSection';
import { FaqSection } from './components/FaqSection';
import { Footer } from './components/Footer';
import { SocPlaygroundView } from './components/SocPlaygroundView';
import { HistoryDrawer } from './components/HistoryDrawer';
import { AVAILABLE_ROUTES } from './lib/presets';
import type {
  SanitizerConfig,
  SanitizeResponse,
  TriageResponse,
  HistoryItem,
  TestPreset,
} from './types';

import {
  DEFAULT_API_URL,
  checkBackendHealth,
  callSanitizeApi,
  callTriageApi,
} from './services/api';
import type { HealthStatus } from './services/api';
import { GitBranch, Zap, Play, ArrowRight } from 'lucide-react';

const LOCAL_STORAGE_HISTORY_KEY = 'triageguard_request_history';
const LOCAL_STORAGE_API_URL_KEY = 'triageguard_api_url';

export const App: React.FC = () => {
  // Navigation Section: 'website' (Explains project + interactive diagram) or 'playground' (Working testbed: single/batch)
  const [currentView, setCurrentView] = useState<'website' | 'playground'>('website');
  const [playgroundInitialMode, setPlaygroundInitialMode] = useState<'single' | 'batch'>('single');

  // Route selection (default to LangGraph Triage Pipeline)
  const [selectedRouteId, setSelectedRouteId] = useState<string>('triage');

  // Backend connection state
  const [backendUrl, setBackendUrl] = useState<string>(() => {
    return localStorage.getItem(LOCAL_STORAGE_API_URL_KEY) || DEFAULT_API_URL;
  });
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [isHealthChecking, setIsHealthChecking] = useState<boolean>(false);

  // Request form state for Playground
  const [customerId, setCustomerId] = useState<string>('cust_enterprise_802');
  const [text, setText] = useState<string>(
    'Hi, we were billed twice for March on invoice #INV-98211. Please refund the duplicate $49.00 charge to card ending in 4112 immediately or we will cancel our plan.'
  );
  const [config, setConfig] = useState<SanitizerConfig>({
    defang_urls: true,
    defang_ips: true,
    redact_emails: true,
    redact_phones: true,
    redact_credit_cards: true,
    redact_ssn: true,
    redact_secrets: true,
    scan_prompt_injections: true,
    strip_zero_width_chars: true,
  });

  // Response state
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [response, setResponse] = useState<SanitizeResponse | TriageResponse | null>(null);
  const [rawError, setRawError] = useState<string | null>(null);
  const [lastExecutedText, setLastExecutedText] = useState<string>('');

  // History state
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_HISTORY_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);

  // Health check polling
  const runHealthCheck = useCallback(async (urlToTest?: string) => {
    setIsHealthChecking(true);
    const target = urlToTest || backendUrl;
    const status = await checkBackendHealth(target);
    setHealthStatus(status);
    setIsHealthChecking(false);
  }, [backendUrl]);

  useEffect(() => {
    runHealthCheck();
    const interval = setInterval(() => {
      runHealthCheck();
    }, 15000);
    return () => clearInterval(interval);
  }, [runHealthCheck]);

  const handleBackendUrlChange = (newUrl: string) => {
    setBackendUrl(newUrl);
    localStorage.setItem(LOCAL_STORAGE_API_URL_KEY, newUrl);
    runHealthCheck(newUrl);
  };

  const handleLoadPreset = (preset: TestPreset) => {
    setCustomerId(preset.customerId);
    setText(preset.text);
  };

  const handleScrollToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async () => {
    if (!text.trim() || !customerId.trim()) return;

    setIsLoading(true);
    setRawError(null);
    const start = performance.now();
    const currentInputText = text;

    try {
      if (selectedRouteId === 'triage') {
        const result = await callTriageApi(backendUrl, customerId, text);
        const elapsed = Math.round(performance.now() - start);
        setResponse(result);
        setLastExecutedText(currentInputText);

        const newHistoryItem: HistoryItem = {
          id: `hist_${Date.now()}`,
          timestamp: Date.now(),
          routeId: selectedRouteId,
          customerId,
          inputText: currentInputText,
          status: 'success',
          latencyMs: elapsed,
          responsePayload: result,
        };

        const updatedHistory = [newHistoryItem, ...history.slice(0, 49)];
        setHistory(updatedHistory);
        localStorage.setItem(LOCAL_STORAGE_HISTORY_KEY, JSON.stringify(updatedHistory));
      } else if (selectedRouteId === 'sanitize') {
        const result = await callSanitizeApi(backendUrl, customerId, text, config);
        const elapsed = Math.round(performance.now() - start);
        setResponse(result);
        setLastExecutedText(currentInputText);

        const newHistoryItem: HistoryItem = {
          id: `hist_${Date.now()}`,
          timestamp: Date.now(),
          routeId: selectedRouteId,
          customerId,
          inputText: currentInputText,
          status: 'success',
          latencyMs: elapsed,
          responsePayload: result,
        };

        const updatedHistory = [newHistoryItem, ...history.slice(0, 49)];
        setHistory(updatedHistory);
        localStorage.setItem(LOCAL_STORAGE_HISTORY_KEY, JSON.stringify(updatedHistory));
      } else {
        throw new Error(`Route "${selectedRouteId}" is currently in development.`);
      }
    } catch (err: any) {
      const elapsed = Math.round(performance.now() - start);
      const errMsg = err.message || 'Unknown network or API error';
      setRawError(errMsg);
      setResponse(null);

      const errorItem: HistoryItem = {
        id: `hist_${Date.now()}`,
        timestamp: Date.now(),
        routeId: selectedRouteId,
        customerId,
        inputText: currentInputText,
        status: 'error',
        latencyMs: elapsed,
        errorMessage: errMsg,
      };

      const updatedHistory = [errorItem, ...history.slice(0, 49)];
      setHistory(updatedHistory);
      localStorage.setItem(LOCAL_STORAGE_HISTORY_KEY, JSON.stringify(updatedHistory));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectHistoryItem = (item: HistoryItem) => {
    setCustomerId(item.customerId);
    setText(item.inputText);
    if (item.responsePayload) {
      setResponse(item.responsePayload);
      setLastExecutedText(item.inputText);
      setRawError(null);
    } else if (item.errorMessage) {
      setRawError(item.errorMessage);
      setResponse(null);
    }
  };

  const handleClearHistory = () => {
    setHistory([]);
    localStorage.removeItem(LOCAL_STORAGE_HISTORY_KEY);
  };

  return (
    <div id="root" className="min-h-screen bg-[#0A0B10] text-[#F8FAFC] flex flex-col font-sans selection:bg-[#CCFF00] selection:text-black">
      {/* Sticky Top Header Navigation */}
      <Header
        currentView={currentView}
        onNavigateToWebsite={() => {
          setCurrentView('website');
          scrollToTop();
        }}
        onNavigateToPlayground={(mode) => {
          if (mode) setPlaygroundInitialMode(mode);
          setCurrentView('playground');
          scrollToTop();
        }}
        backendUrl={backendUrl}
        onBackendUrlChange={handleBackendUrlChange}
        healthStatus={healthStatus}
        onRefreshHealth={() => runHealthCheck()}
        isHealthChecking={isHealthChecking}
        historyCount={history.length}
        onToggleHistory={() => setIsHistoryOpen(true)}
        isHistoryOpen={isHistoryOpen}
        onScrollToSection={handleScrollToSection}
        playgroundMode={playgroundInitialMode}
      />

      {/* Main View: Website vs Dedicated Playground Workbench */}
      {currentView === 'playground' ? (
        <main className="flex-1 w-full">
          <SocPlaygroundView
            onBackToOverview={() => {
              setCurrentView('website');
              scrollToTop();
            }}
            backendUrl={backendUrl}
            healthStatus={healthStatus}
            routes={AVAILABLE_ROUTES}
            selectedRouteId={selectedRouteId}
            onRouteChange={setSelectedRouteId}
            customerId={customerId}
            onCustomerIdChange={setCustomerId}
            text={text}
            onTextChange={setText}
            config={config}
            onConfigChange={setConfig}
            onSubmit={handleSubmit}
            isLoading={isLoading}
            onLoadPreset={handleLoadPreset}
            response={response}
            rawError={rawError}
            lastExecutedText={lastExecutedText}
            initialMode={playgroundInitialMode}
          />
        </main>
      ) : (
        /* Section 1: The Explanatory B2B SaaS Product Website with Interactive Diagrams */
        <main className="flex-1 w-full flex flex-col">
          {/* Hero Section */}
          <LandingHero
            onNavigateToSoc={() => {
              setCurrentView('playground');
              scrollToTop();
            }}
            onScrollToInteractiveFlow={() => handleScrollToSection('interactive-flow')}
            onScrollToArchitecture={() => handleScrollToSection('architecture')}
            healthStatus={healthStatus}
          />

          {/* Section 1: Interactive Pipeline React Flow Diagram */}
          <section id="interactive-flow" className="section-container section-container-alt">
            <div className="page-wrapper">
              <div className="section-header">
                <div className="section-tag" style={{ color: 'var(--volt-primary)' }}>
                  <Zap size={13} />
                  <span>INTERACTIVE XYFLOW ARCHITECTURE</span>
                </div>
                <h2 className="section-title">
                  How TriageGuard Disarms Customer Tickets
                </h2>
                <p className="section-desc">
                  Interactive packet simulator powered by React Flow. Select any adversarial scenario
                  below to follow the ticket's journey through deterministic sanitization, Laya routing, and fail-closed policy enforcement.
                </p>
              </div>

              {/* Interactive Pipeline Diagram Component */}
              <InteractivePipelineDiagram />
            </div>
          </section>

          {/* Section 2: Two-Layer Architecture (System 1 vs System 2) */}
          <SystemComparisonSection />

          {/* Section 3: Interactive LangGraph Stateful DAG */}
          <section id="langgraph-dag" className="section-container section-container-dark">
            <div className="page-wrapper">
              <div className="section-header">
                <div className="section-tag" style={{ color: 'var(--purple-brand)' }}>
                  <GitBranch size={13} />
                  <span>STATEFUL ORCHESTRATION</span>
                </div>
                <h2 className="section-title">
                  The LangGraph State DAG
                </h2>
                <p className="section-desc">
                  Inspect the explicit node graph. Every ticket mutates an immutable state schema,
                  guaranteeing full auditability and preventing unconstrained execution paths.
                </p>
              </div>

              {/* LangGraph DAG Diagram */}
              <LangGraphDagDiagram />
            </div>
          </section>

          {/* Section 4: The 7 Strict MLSecOps Invariants */}
          <InvariantsSection />

          {/* Section 5: Enterprise Features Grid */}
          <FeaturesGrid />

          {/* Section 6: Benchmarks & Latency Comparison */}
          <BenchmarkSection />

          {/* Section 7: Enterprise FAQ */}
          <FaqSection />

          {/* Bottom Call To Action to Launch Playground Workbench */}
          <section className="section-container" style={{ backgroundColor: 'var(--bg-surface)', textAlign: 'center' }}>
            <div className="page-wrapper" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div className="section-tag" style={{ color: 'var(--volt-primary)' }}>
                <Play size={12} className="fill-[#CCFF00] text-[#CCFF00]" />
                <span>READY TO TEST CUSTOM TICKETS?</span>
              </div>
              <h2 className="section-title">
                Experience the Playground Workbench
              </h2>
              <p className="section-desc" style={{ maxWidth: '640px', marginBottom: '32px' }}>
                Run custom support tickets against our FastAPI gateway, inspect raw LangGraph
                node traces, test PII defanging rules, or benchmark thousands of CSV tickets in batch mode.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <button
                  onClick={() => {
                    setPlaygroundInitialMode('single');
                    setCurrentView('playground');
                    scrollToTop();
                  }}
                  className="neo-btn-volt text-sm px-6 py-3.5 shadow-[4px_4px_0px_#000]"
                >
                  <Play size={15} className="fill-black text-black" />
                  <span>Open Single Ticket Mode</span>
                  <ArrowRight size={15} />
                </button>
                <button
                  onClick={() => {
                    setPlaygroundInitialMode('batch');
                    setCurrentView('playground');
                    scrollToTop();
                  }}
                  className="neo-btn-secondary text-sm px-6 py-3.5 shadow-[4px_4px_0px_#000]"
                >
                  <span>Open Batch Tickets Suite (CSV)</span>
                  <ArrowRight size={15} />
                </button>
              </div>
            </div>
          </section>

          {/* Clean Enterprise Footer */}
          <Footer healthStatus={healthStatus} onScrollToTop={scrollToTop} />
        </main>
      )}

      {/* History Drawer Modal */}
      <HistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        history={history}
        onSelectHistoryItem={handleSelectHistoryItem}
        onClearHistory={handleClearHistory}
      />
    </div>
  );
};

export default App;
