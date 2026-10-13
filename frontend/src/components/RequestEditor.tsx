import React, { useState } from 'react';
import {
  Play,
  Sliders,
  ChevronDown,
  ChevronUp,
  UserCheck,
  FileText,
  Dice5,
  Trash2,
  Route,
} from 'lucide-react';
import type { SanitizerConfig, TestPreset, ApiRoute } from '../types';
import { TEST_PRESETS } from '../lib/presets';

interface RequestEditorProps {
  routes?: ApiRoute[];
  selectedRouteId?: string;
  onRouteChange?: (id: string) => void;
  customerId: string;
  onCustomerIdChange: (id: string) => void;
  text: string;
  onTextChange: (text: string) => void;
  config: SanitizerConfig;
  onConfigChange: (config: SanitizerConfig) => void;
  onSubmit: () => void;
  isLoading: boolean;
  onLoadPreset: (preset: TestPreset) => void;
  selectedRouteName?: string;
}

export const RequestEditor: React.FC<RequestEditorProps> = ({
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
  selectedRouteName,
}) => {
  const [showConfig, setShowConfig] = useState(false);

  const handleRandomCustomerId = () => {
    const randomId = `cust_${Math.floor(10000 + Math.random() * 90000)}`;
    onCustomerIdChange(randomId);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (!isLoading && text.trim() && customerId.trim()) {
        onSubmit();
      }
    }
  };

  const lineCount = text ? text.split('\n').length : 1;
  const charCount = text.length;

  const toggleConfigOption = (key: keyof SanitizerConfig) => {
    onConfigChange({
      ...config,
      [key]: !config[key],
    });
  };

  const activeRoute = routes?.find((r) => r.id === selectedRouteId) || routes?.[0];
  const targetLabel = selectedRouteName || activeRoute?.name || 'Triage Pipeline';

  return (
    <div className="flex flex-col h-full neo-card bg-[#12141D] border-2 border-[#232736] shadow-[5px_5px_0px_#000] overflow-hidden">
      {/* Editor Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#0E1017] border-b-2 border-[#232736]">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-[#0A0B10] border border-[#232736] rounded text-[#CCFF00]">
            <FileText size={16} />
          </div>
          <div>
            <span className="font-heading font-extrabold text-xs text-white uppercase tracking-wider block">
              Ticket Input & Policy
            </span>
            <span className="font-mono text-[11px] text-zinc-400">
              Pipeline: {targetLabel}
            </span>
          </div>
        </div>

        {/* Clear and Config Rules */}
        <div className="flex items-center gap-2">
          {text && (
            <button
              onClick={() => onTextChange('')}
              title="Clear input text"
              className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors"
            >
              <Trash2 size={13} />
            </button>
          )}
          <button
            onClick={() => setShowConfig(!showConfig)}
            className={`neo-btn-secondary text-xs px-2.5 py-1 ${
              showConfig ? 'border-[#CCFF00] text-[#CCFF00]' : ''
            }`}
          >
            <Sliders size={12} />
            <span>Rules</span>
            {showConfig ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>
        </div>
      </div>

      {/* Route Switcher (if routes provided) */}
      {routes && onRouteChange && (
        <div className="px-3 py-2 bg-[#0A0B10] border-b-2 border-[#232736] flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Route size={13} className="text-[#00F0FF]" />
            <span className="font-mono text-[11px] font-bold text-zinc-400 uppercase">
              Route:
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {routes.map((r) => (
              <button
                key={r.id}
                onClick={() => onRouteChange(r.id)}
                className={`px-2.5 py-1 rounded text-[11px] font-heading font-bold transition-all cursor-pointer ${
                  selectedRouteId === r.id
                    ? 'bg-[#CCFF00] text-black shadow-[2px_2px_0px_#000]'
                    : 'bg-[#181B26] text-zinc-400 hover:text-white border border-[#232736]'
                }`}
              >
                {r.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Preset Quick-Pills */}
      <div className="px-3 py-2.5 bg-[#0E1017] border-b-2 border-[#232736] overflow-x-auto custom-scrollbar flex items-center gap-2">
        <span className="font-mono text-[10px] uppercase font-bold text-zinc-400 shrink-0">
          Presets:
        </span>
        {TEST_PRESETS.map((preset) => (
          <button
            key={preset.id}
            onClick={() => onLoadPreset(preset)}
            className="shrink-0 px-2 py-0.5 text-xs bg-[#181B26] hover:bg-[#212534] text-zinc-200 hover:text-white rounded border border-[#232736] hover:border-[#CCFF00] transition-all font-mono font-bold"
            title={preset.description}
          >
            {preset.title}
          </button>
        ))}
      </div>

      {/* Main Form Fields */}
      <div className="p-4 flex-1 flex flex-col gap-3.5 overflow-y-auto custom-scrollbar">
        {/* Customer ID Input */}
        <div>
          <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1.5 font-mono flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <UserCheck size={13} className="text-[#CCFF00]" />
              CustomerID / Tenant Identifier
            </span>
            <button
              onClick={handleRandomCustomerId}
              type="button"
              className="text-[10px] text-zinc-400 hover:text-[#CCFF00] flex items-center gap-1 transition-colors font-mono"
            >
              <Dice5 size={11} />
              <span>Generate Random</span>
            </button>
          </label>
          <input
            type="text"
            value={customerId}
            onChange={(e) => onCustomerIdChange(e.target.value)}
            placeholder="e.g. cust_88301, tenant_prod_01"
            className="w-full bg-[#0A0B10] border-2 border-[#232736] focus:border-[#CCFF00] rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-zinc-600 focus:outline-none transition-colors shadow-inner"
          />
        </div>

        {/* Config Options Panel (Collapsible) */}
        {showConfig && (
          <div className="p-3 bg-[#0A0B10] rounded-lg border-2 border-[#232736] space-y-2.5 animate-fadeIn">
            <div className="text-[11px] font-bold font-mono text-zinc-300 uppercase tracking-wider">
              Sanitizer Rule Flags
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { key: 'defang_urls', label: 'Defang URLs' },
                { key: 'defang_ips', label: 'Defang IPs' },
                { key: 'redact_emails', label: 'Redact Emails' },
                { key: 'redact_phones', label: 'Redact Phones' },
                { key: 'redact_credit_cards', label: 'Redact Credit Cards' },
                { key: 'redact_ssn', label: 'Redact SSN' },
                { key: 'redact_secrets', label: 'Redact API Secrets' },
                { key: 'scan_prompt_injections', label: 'Scan Injections' },
                { key: 'strip_zero_width_chars', label: 'Strip Zero-Width' },
              ].map((opt) => {
                const isChecked = Boolean(config[opt.key as keyof SanitizerConfig] ?? true);
                return (
                  <label
                    key={opt.key}
                    className={`flex items-center gap-2 p-1.5 rounded cursor-pointer text-xs border-2 transition-all select-none ${
                      isChecked
                        ? 'bg-[#181B26] border-[#CCFF00] text-white'
                        : 'bg-[#0E1017] border-[#232736] text-zinc-500'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleConfigOption(opt.key as keyof SanitizerConfig)}
                      className="rounded bg-black border-[#232736] text-[#CCFF00] focus:ring-0"
                    />
                    <span className="font-mono text-[10px] font-bold">{opt.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* Text Input Area */}
        <div className="flex-1 flex flex-col min-h-[220px]">
          <label className="text-[11px] font-bold font-mono text-zinc-400 uppercase tracking-wider block mb-1.5 flex items-center justify-between">
            <span>Input Text / Raw Customer Message</span>
            <span className="text-[10px] font-mono text-zinc-500">
              {lineCount} lines · {charCount} chars
            </span>
          </label>
          <textarea
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter raw ticket, prompt injection attempt, or customer request here... (Ctrl+Enter to run)"
            className="flex-1 w-full bg-[#0A0B10] border-2 border-[#232736] focus:border-[#CCFF00] rounded-lg p-3 text-xs font-mono text-white placeholder-zinc-600 focus:outline-none transition-colors resize-none custom-scrollbar leading-relaxed shadow-inner"
          />
        </div>
      </div>

      {/* Action Footer */}
      <div className="px-4 py-3 bg-[#0E1017] border-t-2 border-[#232736] flex items-center justify-between">
        <span className="text-[11px] text-zinc-400 font-mono hidden sm:inline">
          Shortcut: <kbd className="px-1.5 py-0.5 bg-[#0A0B10] border border-[#232736] rounded text-zinc-300">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 bg-[#0A0B10] border border-[#232736] rounded text-zinc-300">Enter</kbd>
        </span>

        <button
          onClick={onSubmit}
          disabled={isLoading || !text.trim() || !customerId.trim()}
          className={`neo-btn-volt text-xs px-5 py-2.5 shadow-[3px_3px_0px_#000] ${
            isLoading || !text.trim() || !customerId.trim()
              ? 'opacity-50 cursor-not-allowed'
              : ''
          }`}
        >
          {isLoading ? (
            <>
              <div className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin" />
              <span>Executing Pipeline...</span>
            </>
          ) : (
            <>
              <Play size={13} className="fill-black text-black" />
              <span>Execute Triage Pipeline</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default RequestEditor;
