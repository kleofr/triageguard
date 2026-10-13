import React, { useState } from 'react';
import { RequestEditor } from './RequestEditor';
import { JsonViewer } from './JsonViewer';
import { SanitizerResultVisual } from './SanitizerResultVisual';
import { TriageResultVisual } from './TriageResultVisual';
import { BatchTestingView } from './BatchTestingView';
import type {
  SanitizerConfig,
  SanitizeResponse,
  TriageResponse,
  TestPreset,
  ApiRoute,
} from '../types';
import type { HealthStatus } from '../services/api';
import {
  ArrowLeft,
  FileSpreadsheet,
  PlayCircle,
  Layers,
  FileJson,
  AlertCircle,
  Terminal,
} from 'lucide-react';

interface SocPlaygroundViewProps {
  onBackToOverview: () => void;
  backendUrl: string;
  healthStatus: HealthStatus | null;
  routes: ApiRoute[];
  selectedRouteId: string;
  onRouteChange: (routeId: string) => void;
  customerId: string;
  onCustomerIdChange: (id: string) => void;
  text: string;
  onTextChange: (txt: string) => void;
  config: SanitizerConfig;
  onConfigChange: (cfg: SanitizerConfig) => void;
  onSubmit: () => void;
  isLoading: boolean;
  onLoadPreset: (preset: TestPreset) => void;
  response: SanitizeResponse | TriageResponse | null;
  rawError: string | null;
  lastExecutedText: string;
  initialMode?: 'single' | 'batch';
}

export const SocPlaygroundView: React.FC<SocPlaygroundViewProps> = ({
  onBackToOverview,
  backendUrl,
  healthStatus,
  routes,
  selectedRouteId,
  onRouteChange,
  customerId,
  onCustomerIdChange,
  text,
  onTextChange,
  config,
  onConfigChange,
  onSubmit,
  isLoading,
  onLoadPreset,
  response,
  rawError,
  lastExecutedText,
  initialMode = 'single',
}) => {
  const [socSubTab, setSocSubTab] = useState<'single' | 'batch'>(initialMode);
  const [responseTab, setResponseTab] = useState<'visual' | 'json'>('visual');

  const activeRoute = routes.find((r) => r.id === selectedRouteId) || routes[0];

  const getResponseLatency = () => {
    if (!response) return 0;
    if ('processing_time_ms' in response) return response.processing_time_ms;
    if ('trace' in response && Array.isArray(response.trace)) {
      return response.trace.reduce((acc: number, t: any) => acc + (t.duration_ms || 0), 0).toFixed(1);
    }
    return 0;
  };

  return (
    <div className="w-full flex flex-col gap-6 max-w-7xl mx-auto p-4 md:p-6 animate-fadeIn">
      {/* Top SOC Playground Header Banner */}
      <div className="neo-card p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <button
            onClick={onBackToOverview}
            className="neo-btn-secondary text-xs px-3 py-1.5"
            title="Return to Website Overview"
          >
            <ArrowLeft size={13} />
            <span>Website</span>
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-heading font-extrabold text-lg text-white tracking-tight">
                Playground Workbench
              </h2>
              <span className="neo-badge neo-badge-volt text-[10px]">
                {healthStatus?.online ? 'GATEWAY: ONLINE' : 'GATEWAY: DEMO'}
              </span>
            </div>
            <p className="font-sans text-xs text-zinc-400 mt-0.5">
              Live inspection terminal: Evaluate individual customer tickets or benchmark multi-ticket batch streams.
            </p>
          </div>
        </div>

        {/* Two-Mode Switcher: Single Ticket vs Batch Tickets */}
        <div className="flex items-center p-1 rounded-lg bg-[#0A0B10] border-2 border-[#232736] shadow-[2px_2px_0px_#000]">
          <button
            onClick={() => setSocSubTab('single')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md font-heading text-xs font-bold transition-all cursor-pointer ${
              socSubTab === 'single'
                ? 'bg-[#CCFF00] text-black shadow-[2px_2px_0px_#000]'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <PlayCircle size={14} className={socSubTab === 'single' ? 'text-black' : 'text-zinc-400'} />
            <span>Single Ticket Mode</span>
          </button>

          <button
            onClick={() => setSocSubTab('batch')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md font-heading text-xs font-bold transition-all cursor-pointer ${
              socSubTab === 'batch'
                ? 'bg-[#CCFF00] text-black shadow-[2px_2px_0px_#000]'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <FileSpreadsheet size={14} className={socSubTab === 'batch' ? 'text-black' : 'text-zinc-400'} />
            <span>Batch Tickets Mode</span>
          </button>
        </div>
      </div>

      {/* Mode 1: Single Ticket Mode */}
      {socSubTab === 'single' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Request & Safety Policy Configuration Editor */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <RequestEditor
              routes={routes}
              selectedRouteId={selectedRouteId}
              onRouteChange={onRouteChange}
              customerId={customerId}
              onCustomerIdChange={onCustomerIdChange}
              text={text}
              onTextChange={onTextChange}
              config={config}
              onConfigChange={onConfigChange}
              onSubmit={onSubmit}
              isLoading={isLoading}
              onLoadPreset={onLoadPreset}
            />
          </div>

          {/* Right Column: Live Safety Verification & Execution Results */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            {/* Results Header Card with Route & Latency Metrics */}
            <div className="neo-card p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded bg-[#0A0B10] border border-[#232736]">
                  <Terminal size={15} className="text-[#CCFF00]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-heading font-bold text-sm text-white">
                      Pipeline Response & Safety Verification
                    </span>
                    {response && (
                      <span className="neo-badge neo-badge-volt text-[10px]">
                        {getResponseLatency()} ms
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-[11px] text-zinc-400">
                    Endpoint: {activeRoute.path} ({activeRoute.name})
                  </span>
                </div>
              </div>

              {/* Visual Diff vs JSON Payload Switcher */}
              <div className="flex items-center p-0.5 rounded bg-[#0A0B10] border border-[#232736]">
                <button
                  onClick={() => setResponseTab('visual')}
                  className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded font-heading font-semibold transition-all cursor-pointer ${
                    responseTab === 'visual'
                      ? 'bg-[#CCFF00] text-black'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Layers size={12} />
                  <span>Visual Verification</span>
                </button>
                <button
                  onClick={() => setResponseTab('json')}
                  className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded font-heading font-semibold transition-all cursor-pointer ${
                    responseTab === 'json'
                      ? 'bg-[#CCFF00] text-black'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <FileJson size={12} />
                  <span>Raw JSON Trace</span>
                </button>
              </div>
            </div>

            {/* Error Banner */}
            {rawError && (
              <div className="neo-card-coral p-4 bg-[#1F1214] flex items-start gap-3">
                <AlertCircle size={18} className="text-[#FF4949] shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-heading font-bold text-sm text-[#FF4949]">
                    Pipeline Execution Error
                  </h4>
                  <p className="font-sans text-xs text-zinc-300 mt-1 leading-relaxed">
                    {rawError}
                  </p>
                  <p className="font-mono text-[11px] text-zinc-500 mt-2">
                    Tip: Verify your backend is running on {backendUrl} or review CORS and model checkpoints.
                  </p>
                </div>
              </div>
            )}

            {/* Response Payload Viewer */}
            {response ? (
              responseTab === 'visual' ? (
                selectedRouteId === 'triage' ? (
                  <TriageResultVisual
                    response={response as TriageResponse}
                    rawText={lastExecutedText}
                  />
                ) : (
                  <SanitizerResultVisual
                    response={response as SanitizeResponse}
                    rawText={lastExecutedText}
                  />
                )
              ) : (
                <div className="neo-card p-4">
                  <JsonViewer data={response} title="API Execution Output" />
                </div>
              )
            ) : !isLoading && !rawError ? (
              <div className="neo-card p-12 text-center flex flex-col items-center justify-center min-h-[380px]">
                <div className="w-14 h-14 rounded-xl bg-[#0A0B10] border-2 border-[#232736] flex items-center justify-center text-[#CCFF00] mb-4 shadow-[3px_3px_0px_#000]">
                  <Terminal size={24} />
                </div>
                <h3 className="font-heading font-bold text-lg text-white mb-2">
                  Awaiting Ticket Submission
                </h3>
                <p className="font-sans text-xs text-zinc-400 max-w-md leading-relaxed mb-6">
                  Select a preset on the left (e.g. Prompt Injection, PII Refund, System Override)
                  and click <strong className="text-zinc-200">"Execute Triage Pipeline"</strong> to inspect
                  the sanitization diff, Laya classification, and fail-closed LangGraph routing trace.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <span className="neo-badge neo-badge-dark text-[10px]">
                    Sub-5ms Defanging
                  </span>
                  <span className="neo-badge neo-badge-dark text-[10px]">
                    Prompt Guard 2
                  </span>
                  <span className="neo-badge neo-badge-dark text-[10px]">
                    LangGraph State DAG
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        /* Mode 2: Batch Tickets Suite */
        <div className="w-full">
          <BatchTestingView backendUrl={backendUrl} />
        </div>
      )}
    </div>
  );
};

export default SocPlaygroundView;
