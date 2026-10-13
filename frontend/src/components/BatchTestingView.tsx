import React, { useState, useEffect, useMemo, useRef } from 'react';
import type {
  BatchTicketItem,
  BatchTestResultItem,
  BatchReportSummary,
} from '../types';
import {
  fetchBatchDataset,
  uploadBatchCsv,
  callTriageApi,
  callSanitizeApi,
  parseCsvString,
} from '../services/api';
import { BUNDLED_BENCHMARK_DATASET } from '../lib/presets';
import { BatchTicketDrawer } from './BatchTicketDrawer';
import {
  Play,
  Square,
  Shuffle,
  RefreshCw,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Zap,
  Tag,
  ShieldCheck,
  Search,
  Download,
  Cpu,
  Layers,
  Target,
  Activity,
} from 'lucide-react';

interface BatchTestingViewProps {
  backendUrl: string;
}

export const BatchTestingView: React.FC<BatchTestingViewProps> = ({ backendUrl }) => {
  // Dataset state
  const [allTickets, setAllTickets] = useState<BatchTicketItem[]>([]);
  const [datasetSource, setDatasetSource] = useState<string>('backend/tests/test_ticket_data.csv');
  const [isDatasetLoading, setIsDatasetLoading] = useState<boolean>(false);
  const [datasetError, setDatasetError] = useState<string | null>(null);

  // Sampling options: '10' | '20' | 'all'
  const [sampleMode, setSampleMode] = useState<'10' | '20' | 'all'>('10');
  const [selectedTickets, setSelectedTickets] = useState<BatchTicketItem[]>([]);
  const [targetEndpoint, setTargetEndpoint] = useState<'triage' | 'sanitize'>('triage');

  // Execution state
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [progressIndex, setProgressIndex] = useState<number>(0);
  const [results, setResults] = useState<BatchTestResultItem[]>([]);
  const [selectedResultItem, setSelectedResultItem] = useState<BatchTestResultItem | null>(null);
  const abortControllerRef = useRef<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Table filtering & search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'error'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [urgencyFilter, setUrgencyFilter] = useState<string>('all');
  const [riskFilter, setRiskFilter] = useState<'all' | 'flagged' | 'clean'>('all');


  // Load dataset from backend on mount or refresh
  const loadDatasetFromBackend = async () => {
    setIsDatasetLoading(true);
    setDatasetError(null);
    try {
      const resp = await fetchBatchDataset(backendUrl);
      if (resp.tickets && resp.tickets.length > 0) {
        setAllTickets(resp.tickets);
        setDatasetSource(resp.file_path || 'backend/tests/test_ticket_data.csv');
      } else {
        setAllTickets(BUNDLED_BENCHMARK_DATASET);
        setDatasetSource('Bundled Benchmark Dataset (25 Tickets)');
      }
    } catch {
      setAllTickets(BUNDLED_BENCHMARK_DATASET);
      setDatasetSource('Bundled Benchmark Dataset (25 Tickets)');
      setDatasetError(null);
    } finally {
      setIsDatasetLoading(false);
    }
  };

  useEffect(() => {
    loadDatasetFromBackend();
  }, [backendUrl]);

  // Re-sample tickets whenever allTickets or sampleMode changes
  const pickSample = (tickets: BatchTicketItem[], mode: '10' | '20' | 'all') => {
    if (tickets.length === 0) return [];
    if (mode === 'all') {
      return [...tickets];
    }
    const count = mode === '10' ? 10 : 20;
    const shuffled = [...tickets].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, Math.min(count, tickets.length));
  };

  useEffect(() => {
    if (allTickets.length > 0) {
      setSelectedTickets(pickSample(allTickets, sampleMode));
    }
  }, [allTickets, sampleMode]);

  const handleReshuffle = () => {
    if (allTickets.length > 0) {
      setSelectedTickets(pickSample(allTickets, sampleMode));
    }
  };


  // Upload Custom CSV handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsDatasetLoading(true);
      const textContent = await file.text();
      const parsed = parseCsvString(textContent);
      if (parsed.length > 0) {
        setAllTickets(parsed);
        setDatasetSource(`Uploaded: ${file.name}`);
        setDatasetError(null);
      } else {
        // Fallback to server endpoint
        const serverResp = await uploadBatchCsv(backendUrl, file);
        if (serverResp.tickets && serverResp.tickets.length > 0) {
          setAllTickets(serverResp.tickets);
          setDatasetSource(`Uploaded: ${file.name}`);
          setDatasetError(null);
        }
      }
    } catch (err: any) {
      setDatasetError(`Failed to parse CSV: ${err.message}`);
    } finally {
      setIsDatasetLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Start Batch Execution
  const handleRunBatch = async () => {
    if (selectedTickets.length === 0 || isRunning) return;

    setIsRunning(true);
    abortControllerRef.current = false;
    setProgressIndex(0);
    setResults([]);

    const currentResults: BatchTestResultItem[] = [];


    for (let i = 0; i < selectedTickets.length; i++) {
      if (abortControllerRef.current) {
        break;
      }

      const ticket = selectedTickets[i];
      setProgressIndex(i + 1);
      const ticketStart = performance.now();

      try {
        if (targetEndpoint === 'triage') {
          const resp = await callTriageApi(
            backendUrl,
            ticket.customer_id,
            ticket.input_text,
            'web',
            ticket.subject
          );
          const elapsed = Math.round(performance.now() - ticketStart);

          const resultItem: BatchTestResultItem = {
            index: i + 1,
            customer_id: ticket.customer_id,
            input_text: ticket.input_text,
            subject: ticket.subject,
            status: 'success',
            latencyMs: elapsed,
            ticket_id: resp.ticket_id,
            sanitized_text: resp.sanitized_text,
            intent: resp.intent,
            risk_flags: resp.risk_flags || [],
            router: resp.router,
            route: resp.route,
            route_reason: resp.route_reason,
            draft: resp.draft,
            citations: resp.citations,
            guard_result: resp.guard_result,
            trace: resp.trace || [],
            rawResponse: resp,
            is_malicious: ticket.is_malicious,
          };
          currentResults.push(resultItem);
          setResults([...currentResults]);
        } else {
          // Sanitize only endpoint
          const resp = await callSanitizeApi(backendUrl, ticket.customer_id, ticket.input_text);
          const elapsed = Math.round(performance.now() - ticketStart);

          const resultItem: BatchTestResultItem = {
            index: i + 1,
            customer_id: ticket.customer_id,
            input_text: ticket.input_text,
            subject: ticket.subject,
            status: 'success',
            latencyMs: elapsed,
            sanitized_text: resp.result?.clean_text,
            risk_flags: resp.result?.risk_flags || [],
            rawResponse: resp,
            is_malicious: ticket.is_malicious,
          };
          currentResults.push(resultItem);
          setResults([...currentResults]);
        }
      } catch (err: any) {
        const elapsed = Math.round(performance.now() - ticketStart);
        const resultItem: BatchTestResultItem = {
          index: i + 1,
          customer_id: ticket.customer_id,
          input_text: ticket.input_text,
          subject: ticket.subject,
          status: 'error',
          latencyMs: elapsed,
          errorMessage: err.message || 'Request failed',
          is_malicious: ticket.is_malicious,
        };
        currentResults.push(resultItem);
        setResults([...currentResults]);
      }
    }

    setIsRunning(false);
  };

  const handleCancelBatch = () => {
    abortControllerRef.current = true;
    setIsRunning(false);
  };

  // Compute Summary Statistics
  const summary: BatchReportSummary | null = useMemo(() => {
    if (results.length === 0) return null;

    const successful = results.filter((r) => r.status === 'success');
    const failed = results.filter((r) => r.status === 'error');
    const latencies = results.map((r) => r.latencyMs).sort((a, b) => a - b);
    const totalLatency = latencies.reduce((a, b) => a + b, 0);

    const categoryCounts: Record<string, number> = {};
    const urgencyCounts: Record<string, number> = {};
    const teamCounts: Record<string, number> = {};
    const riskFlagCounts: Record<string, number> = {};
    let quarantinedCount = 0;
    let autoDraftCount = 0;
    let escalationCount = 0;
    let cleanCount = 0;

    // Evaluation metrics for labeled data
    let totalLabeled = 0;
    let tp = 0;
    let fp = 0;
    let tn = 0;
    let fn = 0;

    for (const r of successful) {
      if (r.router?.category) {
        categoryCounts[r.router.category] = (categoryCounts[r.router.category] || 0) + 1;
      }
      if (r.router?.urgency) {
        urgencyCounts[r.router.urgency] = (urgencyCounts[r.router.urgency] || 0) + 1;
      }
      if (r.router?.team) {
        teamCounts[r.router.team] = (teamCounts[r.router.team] || 0) + 1;
      }

      if (r.risk_flags && r.risk_flags.length > 0) {
        for (const flag of r.risk_flags) {
          riskFlagCounts[flag] = (riskFlagCounts[flag] || 0) + 1;
        }
      } else {
        cleanCount++;
      }

      const isQuarantined =
        r.route === 'SECURITY_REVIEW' ||
        r.risk_flags?.includes('PROMPT_GUARD_MALICIOUS') ||
        r.risk_flags?.includes('injection_suspected') ||
        r.risk_flags?.includes('SANITIZATION_ERROR');

      if (isQuarantined) {
        quarantinedCount++;
      } else if (
        r.route?.toLowerCase() === 'auto_draft' ||
        r.router?.category === 'technical_issue' ||
        r.router?.category === 'shipping_delivery'
      ) {
        autoDraftCount++;
      } else {
        escalationCount++;
      }

      // Check evaluation metrics if labeled
      if (r.is_malicious !== undefined) {
        totalLabeled++;
        const actualMalicious = r.is_malicious === 1;
        const predictedMalicious = Boolean(
          r.route === 'SECURITY_REVIEW' ||
          r.route === 'HUMAN_QUEUE' ||
          r.guard_result?.passed === false ||
          r.risk_flags?.includes('PROMPT_GUARD_MALICIOUS') ||
          r.risk_flags?.includes('PROMPT_GUARD_AMBIGUOUS') ||
          r.risk_flags?.includes('injection_suspected') ||
          r.risk_flags?.some((f) => f.startsWith('PROMPT_INJECTION_'))
        );

        if (actualMalicious && predictedMalicious) {
          tp++;
        } else if (!actualMalicious && predictedMalicious) {
          fp++;
        } else if (!actualMalicious && !predictedMalicious) {
          tn++;
        } else if (actualMalicious && !predictedMalicious) {
          fn++;
        }
      }
    }

    const p95Idx = Math.floor(latencies.length * 0.95);

    let evaluation = null;
    if (totalLabeled > 0) {
      const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
      const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
      const f1Score =
        precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
      const accuracy = totalLabeled > 0 ? (tp + tn) / totalLabeled : 0;
      evaluation = {
        totalLabeled,
        tp,
        fp,
        tn,
        fn,
        precision,
        recall,
        f1Score,
        accuracy,
      };
    }

    return {
      total: results.length,
      successful: successful.length,
      failed: failed.length,
      avgLatencyMs: Math.round(totalLatency / (results.length || 1)),
      minLatencyMs: latencies[0] || 0,
      maxLatencyMs: latencies[latencies.length - 1] || 0,
      p95LatencyMs: latencies[p95Idx] || 0,
      categoryCounts,
      urgencyCounts,
      teamCounts,
      riskFlagCounts,
      quarantinedCount,
      autoDraftCount,
      escalationCount,
      cleanCount,
      totalDurationMs: totalLatency,
      evaluation,
    };
  }, [results]);

  // Filtered results list for the detailed table
  const filteredResults = useMemo(() => {
    return results.filter((r) => {
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchCust = r.customer_id.toLowerCase().includes(q);
        const matchText = r.input_text.toLowerCase().includes(q);
        const matchCategory = r.router?.category.toLowerCase().includes(q);
        if (!matchCust && !matchText && !matchCategory) return false;
      }

      // Status filter
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;

      // Category filter
      if (categoryFilter !== 'all' && r.router?.category !== categoryFilter) return false;

      // Urgency filter
      if (urgencyFilter !== 'all' && r.router?.urgency !== urgencyFilter) return false;

      // Risk filter
      if (riskFilter === 'flagged' && (!r.risk_flags || r.risk_flags.length === 0)) return false;
      if (riskFilter === 'clean' && r.risk_flags && r.risk_flags.length > 0) return false;

      return true;
    });
  }, [results, searchQuery, statusFilter, categoryFilter, urgencyFilter, riskFilter]);

  // Export JSON / CSV
  const handleExportJson = () => {
    const dataStr = JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        summary,
        results,
      },
      null,
      2
    );
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `triageguard_batch_report_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = () => {
    const hasLabeled = results.some((r) => r.is_malicious !== undefined);
    const headers = [
      'index',
      'customer_id',
      'status',
      'latency_ms',
      'category',
      'category_conf',
      'urgency',
      'urgency_conf',
      'team',
      'route',
      'risk_flags',
      ...(hasLabeled ? ['is_malicious', 'predicted_malicious', 'guard_score', 'guard_passed'] : []),
      'input_text',
      'sanitized_text',
    ];

    const rows = results.map((r) => {
      const predictedMalicious = Boolean(
        r.route === 'SECURITY_REVIEW' ||
        r.route === 'HUMAN_QUEUE' ||
        r.guard_result?.passed === false ||
        r.risk_flags?.includes('PROMPT_GUARD_MALICIOUS') ||
        r.risk_flags?.includes('PROMPT_GUARD_AMBIGUOUS') ||
        r.risk_flags?.includes('injection_suspected') ||
        r.risk_flags?.some((f) => f.startsWith('PROMPT_INJECTION_'))
      );

      return [
        r.index,
        `"${r.customer_id}"`,
        r.status,
        r.latencyMs,
        r.router?.category || '',
        r.router?.category_conf || '',
        r.router?.urgency || '',
        r.router?.urgency_conf || '',
        r.router?.team || '',
        r.route || '',
        `"${(r.risk_flags || []).join(';')}"`,
        ...(hasLabeled
          ? [
            r.is_malicious !== undefined ? r.is_malicious : '',
            predictedMalicious ? 1 : 0,
            r.guard_result?.malicious_score !== undefined ? r.guard_result.malicious_score : '',
            r.guard_result?.passed !== undefined ? r.guard_result.passed : '',
          ]
          : []),
        `"${r.input_text.replace(/"/g, '""')}"`,
        `"${(r.sanitized_text || '').replace(/"/g, '""')}"`,
      ];
    });

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `triageguard_batch_results_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getCategoryBadgeClass = (category?: string) => {
    switch (category) {
      case 'abuse_security':
        return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
      case 'billing':
        return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
      case 'technical_issue':
        return 'bg-sky-500/15 text-sky-300 border-sky-500/30';
      case 'shipping_delivery':
        return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
      default:
        return 'bg-zinc-800 text-zinc-400 border-zinc-700';
    }
  };

  const getUrgencyBadgeClass = (urgency?: string) => {
    switch (urgency) {
      case 'critical':
        return 'bg-rose-500 text-white font-bold animate-pulse';
      case 'high':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'normal':
        return 'bg-sky-500/20 text-sky-300 border-sky-500/40';
      default:
        return 'bg-zinc-800 text-zinc-400 border-zinc-700';
    }
  };

  const hasLabeledData = results.some((r) => r.is_malicious !== undefined);

  return (
    <div className="flex flex-col gap-6 max-w-7xl w-full mx-auto pb-12">
      {/* Configuration & Control Panel */}
      <div className="bg-zinc-900/70 border border-zinc-800/90 rounded-2xl p-5 shadow-xl backdrop-blur-md space-y-5">
        {/* Top bar: Dataset Source & Reload */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-zinc-800/80">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-400">
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-zinc-100 font-sans">
                  Batch Evaluation & Benchmark Suite
                </span>
                <span className="px-2 py-0.5 text-[11px] font-mono bg-zinc-800 text-teal-300 rounded border border-zinc-700">
                  {allTickets.length} tickets loaded
                </span>
              </div>
              <p className="text-xs text-zinc-400 font-mono mt-0.5">
                Source: <span className="text-zinc-300 font-semibold">{datasetSource}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors font-medium"
            >
              <Upload size={13} />
              <span>Upload Custom CSV</span>
            </button>
            <button
              onClick={loadDatasetFromBackend}
              disabled={isDatasetLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors font-medium disabled:opacity-50"
            >
              <RefreshCw size={13} className={isDatasetLoading ? 'animate-spin' : ''} />
              <span>Reload CSV</span>
            </button>
          </div>
        </div>

        {datasetError && (
          <div className="p-3 bg-amber-950/40 border border-amber-900/60 rounded-xl flex items-center justify-between text-amber-300 text-xs">
            <div className="flex items-center gap-2">
              <AlertTriangle size={15} className="shrink-0" />
              <span>{datasetError}</span>
            </div>
          </div>
        )}

        {/* Sampling Options & Target API */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          {/* Sample Size Radio Buttons */}
          <div className="md:col-span-6 space-y-2">
            <label className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
              <span>Select Sample Size for Test Run</span>
              <span className="text-[11px] font-mono text-teal-400">
                Active: {selectedTickets.length} tickets
              </span>
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {(['10', '20', 'all'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  disabled={isRunning}
                  onClick={() => setSampleMode(mode)}
                  className={`px-3.5 py-2 text-xs font-medium rounded-xl border transition-all ${sampleMode === mode
                      ? 'bg-teal-500 text-zinc-950 font-bold border-teal-400 shadow-md shadow-teal-500/20'
                      : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-zinc-700'
                    }`}
                >
                  {mode === 'all' ? `All (${allTickets.length})` : `Random ${mode} Tickets`}
                </button>
              ))}

              <button
                type="button"
                disabled={isRunning || allTickets.length === 0}
                onClick={handleReshuffle}
                title="Reshuffle random sample"
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition-colors"
              >
                <Shuffle size={13} className="text-teal-400" />
                <span>Reshuffle Sample</span>
              </button>
            </div>
          </div>

          {/* Target Pipeline & CTA */}
          <div className="md:col-span-6 flex flex-col sm:flex-row items-end sm:items-center justify-end gap-3 pt-2 sm:pt-0">
            <div className="w-full sm:w-auto">
              <label className="text-[11px] uppercase font-mono text-zinc-400 block mb-1">
                Target Pipeline
              </label>
              <select
                value={targetEndpoint}
                disabled={isRunning}
                onChange={(e) => setTargetEndpoint(e.target.value as 'triage' | 'sanitize')}
                className="w-full sm:w-auto bg-zinc-900 border border-zinc-700 text-zinc-200 text-xs rounded-xl px-3 py-2 font-mono focus:outline-none focus:border-teal-500"
              >
                <option value="triage">POST /api/v1/triage (LangGraph + Laya)</option>
                <option value="sanitize">POST /api/v1/sanitize (Guardrail only)</option>
              </select>
            </div>

            <div className="w-full sm:w-auto self-end">
              {isRunning ? (
                <button
                  onClick={handleCancelBatch}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-600/30 transition-all"
                >
                  <Square size={14} className="fill-current" />
                  <span>Stop Evaluation ({progressIndex}/{selectedTickets.length})</span>
                </button>
              ) : (
                <button
                  onClick={handleRunBatch}
                  disabled={selectedTickets.length === 0 || allTickets.length === 0}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-teal-500 hover:bg-teal-400 text-zinc-950 text-xs font-bold rounded-xl shadow-lg shadow-teal-500/25 transition-all disabled:opacity-50"
                >
                  <Play size={14} className="fill-current" />
                  <span>Start Test Run ({selectedTickets.length} Tickets)</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Live Progress Bar during active run */}
        {isRunning && (
          <div className="p-4 bg-zinc-950/80 border border-teal-500/40 rounded-xl space-y-2.5 animate-pulse">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-teal-300 font-semibold flex items-center gap-2">
                <Cpu size={14} className="animate-spin" />
                Processing Ticket {progressIndex} of {selectedTickets.length}...
              </span>
              <span className="text-zinc-400">
                {Math.round((progressIndex / selectedTickets.length) * 100)}% Complete
              </span>
            </div>
            <div className="h-2 w-full bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
              <div
                className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 rounded-full transition-all duration-300"
                style={{ width: `${(progressIndex / selectedTickets.length) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Summary Statistics Dashboard Cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in duration-300">
          {/* Card 1: Processed & Success */}
          <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-2xl flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span className="font-semibold uppercase tracking-wider font-mono text-[10px]">
                Processed Tickets
              </span>
              <CheckCircle2 size={16} className="text-emerald-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-zinc-100">
              {summary.successful} / {summary.total}
            </div>
            <div className="text-[11px] text-zinc-500 font-mono">
              Success Rate: <span className="text-emerald-400 font-semibold">{Math.round((summary.successful / summary.total) * 100)}%</span>
            </div>
          </div>

          {/* Card 2: Latency Benchmark */}
          <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-2xl flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span className="font-semibold uppercase tracking-wider font-mono text-[10px]">
                Latency Profile
              </span>
              <Clock size={16} className="text-teal-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-zinc-100">
              {summary.avgLatencyMs} <span className="text-xs text-zinc-400 font-normal">ms avg</span>
            </div>
            <div className="text-[11px] text-zinc-500 font-mono flex items-center justify-between">
              <span>P95: <strong className="text-zinc-300">{summary.p95LatencyMs}ms</strong></span>
              <span>Min/Max: <strong className="text-zinc-300">{summary.minLatencyMs}/{summary.maxLatencyMs}ms</strong></span>
            </div>
          </div>

          {/* Card 3: Security & Guardrails */}
          <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-2xl flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span className="font-semibold uppercase tracking-wider font-mono text-[10px]">
                MLSecOps Safety
              </span>
              <ShieldCheck size={16} className="text-amber-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-zinc-100">
              {summary.quarantinedCount} <span className="text-xs text-rose-400 font-normal">quarantined</span>
            </div>
            <div className="text-[11px] text-zinc-500 font-mono">
              Clean: <span className="text-emerald-400 font-semibold">{summary.cleanCount}</span> · Risk Flags: <span className="text-amber-400 font-semibold">{Object.keys(summary.riskFlagCounts).length} types</span>
            </div>
          </div>

          {/* Card 4: Routing Decisions */}
          <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-2xl flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span className="font-semibold uppercase tracking-wider font-mono text-[10px]">
                Routing Outcomes
              </span>
              <Zap size={16} className="text-sky-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-zinc-100">
              {summary.autoDraftCount} <span className="text-xs text-emerald-400 font-normal">auto-draft</span>
            </div>
            <div className="text-[11px] text-zinc-500 font-mono">
              Human Escalated: <span className="text-amber-400 font-semibold">{summary.escalationCount}</span>
            </div>
          </div>
        </div>
      )}

      {/* Category & Urgency Distribution Pills if available */}
      {summary && Object.keys(summary.categoryCounts).length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-4">
          <div className="space-y-2">
            <span className="text-[11px] uppercase font-mono text-zinc-400 font-semibold flex items-center gap-1.5">
              <Tag size={12} />
              Predicted Categories Breakdown
            </span>
            <div className="flex flex-wrap gap-2">
              {Object.entries(summary.categoryCounts).map(([cat, count]) => (
                <span
                  key={cat}
                  className={`px-2.5 py-1 text-xs font-mono font-bold rounded-lg border uppercase ${getCategoryBadgeClass(
                    cat
                  )}`}
                >
                  {cat}: {count} ({Math.round((count / summary.successful) * 100)}%)
                </span>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-[11px] uppercase font-mono text-zinc-400 font-semibold flex items-center gap-1.5">
              <Clock size={12} />
              Urgency Classification Breakdown
            </span>
            <div className="flex flex-wrap gap-2">
              {Object.entries(summary.urgencyCounts).map(([urgency, count]) => (
                <span
                  key={urgency}
                  className={`px-2.5 py-1 text-xs font-mono font-bold rounded-lg border uppercase ${getUrgencyBadgeClass(
                    urgency
                  )}`}
                >
                  {urgency}: {count} ({Math.round((count / summary.successful) * 100)}%)
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ML Security Classifier Evaluation & Confusion Matrix Panel */}
      {summary?.evaluation && (
        <div className="bg-zinc-900/70 border border-teal-500/30 rounded-2xl p-5 shadow-2xl backdrop-blur-md space-y-5 animate-in fade-in duration-300">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-zinc-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-400">
                <Target size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-zinc-100 font-sans">
                    Llama Prompt Guard 2-86M Evaluation
                  </h3>
                  <span className="px-2 py-0.5 text-[10px] font-mono bg-teal-950/80 text-teal-300 rounded border border-teal-800/80 font-bold uppercase">
                    Threshold: 0.75
                  </span>
                  <span className="px-2 py-0.5 text-[10px] font-mono bg-zinc-800 text-zinc-300 rounded border border-zinc-700">
                    {summary.evaluation.totalLabeled} Labeled Samples
                  </span>
                </div>
                <p className="text-xs text-zinc-400 font-mono mt-0.5">
                  Binary Security Classification Benchmark (Prompt Injection & Jailbreak Defense)
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                Benign Tickets (0)
              </span>
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800">
                <span className="w-2 h-2 rounded-full bg-rose-400" />
                Malicious Attacks (1)
              </span>
            </div>
          </div>

          {/* 4 Metric Cards: Precision, Recall, F1-Score, Accuracy */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Precision Card */}
            <div className="p-4 bg-zinc-950/70 border border-zinc-800/90 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span className="font-semibold uppercase tracking-wider font-mono text-[10px]">
                  Precision
                </span>
                <span className="text-[10px] font-mono text-zinc-500">TP / (TP + FP)</span>
              </div>
              <div className="text-2xl font-bold font-mono text-teal-300">
                {(summary.evaluation.precision * 100).toFixed(1)}%
              </div>
              <div className="text-[11px] text-zinc-400 font-mono">
                Flagged Attacks Real: <strong className="text-zinc-200">{summary.evaluation.tp} / {summary.evaluation.tp + summary.evaluation.fp}</strong>
              </div>
              <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-teal-400 rounded-full"
                  style={{ width: `${Math.min(100, Math.max(0, summary.evaluation.precision * 100))}%` }}
                />
              </div>
            </div>

            {/* Recall Card */}
            <div className="p-4 bg-zinc-950/70 border border-zinc-800/90 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span className="font-semibold uppercase tracking-wider font-mono text-[10px]">
                  Recall (Coverage)
                </span>
                <span className="text-[10px] font-mono text-zinc-500">TP / (TP + FN)</span>
              </div>
              <div className="text-2xl font-bold font-mono text-emerald-300">
                {(summary.evaluation.recall * 100).toFixed(1)}%
              </div>
              <div className="text-[11px] text-zinc-400 font-mono">
                Attacks Intercepted: <strong className="text-zinc-200">{summary.evaluation.tp} / {summary.evaluation.tp + summary.evaluation.fn}</strong>
              </div>
              <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-400 rounded-full"
                  style={{ width: `${Math.min(100, Math.max(0, summary.evaluation.recall * 100))}%` }}
                />
              </div>
            </div>

            {/* F1-Score Card */}
            <div className="p-4 bg-zinc-950/70 border border-zinc-800/90 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span className="font-semibold uppercase tracking-wider font-mono text-[10px]">
                  F1-Score
                </span>
                <span className="text-[10px] font-mono text-zinc-500">Harmonic Mean</span>
              </div>
              <div className="text-2xl font-bold font-mono text-sky-300">
                {(summary.evaluation.f1Score * 100).toFixed(1)}%
              </div>
              <div className="text-[11px] text-zinc-400 font-mono">
                Sweet-Spot Balance: <strong className="text-zinc-200">{summary.evaluation.f1Score >= 0.8 ? 'Optimal' : 'Tuned'}</strong>
              </div>
              <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-sky-400 rounded-full"
                  style={{ width: `${Math.min(100, Math.max(0, summary.evaluation.f1Score * 100))}%` }}
                />
              </div>
            </div>

            {/* Accuracy Card */}
            <div className="p-4 bg-zinc-950/70 border border-zinc-800/90 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span className="font-semibold uppercase tracking-wider font-mono text-[10px]">
                  Overall Accuracy
                </span>
                <span className="text-[10px] font-mono text-zinc-500">(TP + TN) / N</span>
              </div>
              <div className="text-2xl font-bold font-mono text-indigo-300">
                {(summary.evaluation.accuracy * 100).toFixed(1)}%
              </div>
              <div className="text-[11px] text-zinc-400 font-mono">
                Correct Decisions: <strong className="text-zinc-200">{summary.evaluation.tp + summary.evaluation.tn} / {summary.evaluation.totalLabeled}</strong>
              </div>
              <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-400 rounded-full"
                  style={{ width: `${Math.min(100, Math.max(0, summary.evaluation.accuracy * 100))}%` }}
                />
              </div>
            </div>
          </div>

          {/* 2x2 Confusion Matrix Visualizer */}
          <div className="p-4 bg-zinc-950/90 border border-zinc-800/90 rounded-xl space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono text-zinc-300 font-semibold uppercase text-[11px] flex items-center gap-1.5">
                <Activity size={13} className="text-teal-400" />
                Confusion Matrix Grid
              </span>
              <span className="text-[10px] font-mono text-zinc-500">
                Evaluated against ground truth labels in dataset
              </span>
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-[500px] grid grid-cols-3 gap-2 text-center text-xs font-mono">
                {/* Header row */}
                <div className="p-2 text-zinc-500 font-semibold"></div>
                <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 font-semibold">
                  Predicted Malicious (1)
                </div>
                <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 font-semibold">
                  Predicted Benign (0)
                </div>

                {/* Actual Malicious Row */}
                <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center font-semibold text-rose-300">
                  Actual Malicious (1)
                </div>
                {/* True Positive */}
                <div className="p-3.5 rounded-xl bg-teal-950/40 border border-teal-700/60 flex flex-col justify-center items-center space-y-1">
                  <div className="text-xl font-bold text-teal-300">{summary.evaluation.tp}</div>
                  <div className="text-[10px] text-teal-400 font-semibold uppercase">
                    True Positive (TP)
                  </div>
                  <div className="text-[10px] text-zinc-400">Attacks Quarantined</div>
                </div>
                {/* False Negative */}
                <div className={`p-3.5 rounded-xl flex flex-col justify-center items-center space-y-1 ${summary.evaluation.fn > 0
                    ? 'bg-rose-950/40 border border-rose-700/70'
                    : 'bg-zinc-900/40 border border-zinc-800/80'
                  }`}>
                  <div className={`text-xl font-bold ${summary.evaluation.fn > 0 ? 'text-rose-300' : 'text-zinc-500'}`}>
                    {summary.evaluation.fn}
                  </div>
                  <div className={`text-[10px] font-semibold uppercase ${summary.evaluation.fn > 0 ? 'text-rose-400' : 'text-zinc-500'}`}>
                    False Negative (FN)
                  </div>
                  <div className="text-[10px] text-zinc-400">Missed Attacks (Leakage)</div>
                </div>

                {/* Actual Benign Row */}
                <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center font-semibold text-emerald-300">
                  Actual Benign (0)
                </div>
                {/* False Positive */}
                <div className={`p-3.5 rounded-xl flex flex-col justify-center items-center space-y-1 ${summary.evaluation.fp > 0
                    ? 'bg-amber-950/40 border border-amber-700/70'
                    : 'bg-zinc-900/40 border border-zinc-800/80'
                  }`}>
                  <div className={`text-xl font-bold ${summary.evaluation.fp > 0 ? 'text-amber-300' : 'text-zinc-500'}`}>
                    {summary.evaluation.fp}
                  </div>
                  <div className={`text-[10px] font-semibold uppercase ${summary.evaluation.fp > 0 ? 'text-amber-400' : 'text-zinc-500'}`}>
                    False Positive (FP)
                  </div>
                  <div className="text-[10px] text-zinc-400">False Alarms</div>
                </div>
                {/* True Negative */}
                <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-700/60 flex flex-col justify-center items-center space-y-1">
                  <div className="text-xl font-bold text-emerald-300">{summary.evaluation.tn}</div>
                  <div className="text-[10px] text-emerald-400 font-semibold uppercase">
                    True Negative (TN)
                  </div>
                  <div className="text-[10px] text-zinc-400">Clean Tickets Passed</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Processed Tickets Table */}
      <div className="bg-zinc-900/70 border border-zinc-800/90 rounded-2xl p-5 shadow-2xl backdrop-blur-md space-y-4">
        {/* Table Toolbar: Search, Filters, and Export */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-zinc-800">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
              />
              <input
                type="text"
                placeholder="Search ticket text or customer ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-3 py-1.5 bg-zinc-950 border border-zinc-700/80 rounded-xl text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-teal-500 w-64 font-sans"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-zinc-950 border border-zinc-700/80 text-zinc-200 text-xs rounded-xl px-2.5 py-1.5 font-mono focus:outline-none focus:border-teal-500"
            >
              <option value="all">All Outcomes</option>
              <option value="success">Success</option>
              <option value="error">Error</option>
            </select>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-zinc-950 border border-zinc-700/80 text-zinc-200 text-xs rounded-xl px-2.5 py-1.5 font-mono focus:outline-none focus:border-teal-500"
            >
              <option value="all">All Categories</option>
              <option value="billing">billing</option>
              <option value="technical_issue">technical_issue</option>
              <option value="abuse_security">abuse_security</option>
              <option value="shipping_delivery">shipping_delivery</option>
            </select>


            {/* Urgency Filter */}
            <select
              value={urgencyFilter}
              onChange={(e) => setUrgencyFilter(e.target.value)}
              className="bg-zinc-950 border border-zinc-700/80 text-zinc-200 text-xs rounded-xl px-2.5 py-1.5 font-mono focus:outline-none focus:border-teal-500"
            >
              <option value="all">All Urgencies</option>
              <option value="critical">critical</option>
              <option value="high">high</option>
              <option value="normal">normal</option>
            </select>

            {/* Risk Filter */}
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value as any)}
              className="bg-zinc-950 border border-zinc-700/80 text-zinc-200 text-xs rounded-xl px-2.5 py-1.5 font-mono focus:outline-none focus:border-teal-500"
            >
              <option value="all">All Safety Status</option>
              <option value="flagged">Risk Flags Detected</option>
              <option value="clean">Clean / Sanitized</option>
            </select>
          </div>

          {/* Export Actions */}
          {results.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportCsv}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors"
              >
                <Download size={13} />
                <span>Export CSV</span>
              </button>
              <button
                onClick={handleExportJson}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors"
              >
                <Download size={13} />
                <span>Export JSON</span>
              </button>
            </div>
          )}
        </div>

        {/* Results Data Table */}
        {results.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <div className="w-12 h-12 rounded-full bg-zinc-800/80 border border-zinc-700 flex items-center justify-center mx-auto text-zinc-400">
              <Layers size={22} />
            </div>
            <div className="text-sm font-semibold text-zinc-300 font-sans">
              No Evaluation Results Yet
            </div>
            <p className="text-xs text-zinc-500 max-w-md mx-auto leading-relaxed">
              Select 10, 20 or All tickets from the panel above and click{' '}
              <strong className="text-teal-400">Start Test Run</strong> to process the tickets through
              the LangGraph pipeline and generate a detailed report.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-950/80 text-zinc-400 uppercase font-mono text-[10px] tracking-wider border-b border-zinc-800">
                <tr>
                  <th className="py-3 px-3">#</th>
                  <th className="py-3 px-3">Customer ID</th>
                  <th className="py-3 px-4 min-w-[280px]">Inbound Ticket Text</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3">Urgency</th>
                  <th className="py-3 px-3">Safety & Risk</th>
                  {hasLabeledData && <th className="py-3 px-3">Ground Truth</th>}
                  <th className="py-3 px-3">Route Action</th>
                  <th className="py-3 px-3">Latency</th>
                  <th className="py-3 px-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 font-sans bg-zinc-950/40">
                {filteredResults.map((item) => {
                  const isHardStop =
                    item.route === 'SECURITY_REVIEW' ||
                    item.risk_flags?.includes('injection_suspected') ||
                    item.risk_flags?.includes('SANITIZATION_ERROR');
                  const isHumanQueue = item.route === 'HUMAN_QUEUE';
                  const isAutoDraft =
                    item.route === 'auto_draft' ||
                    item.router?.category === 'technical_issue' ||
                    item.router?.category === 'shipping_delivery';

                  return (
                    <tr
                      key={item.index}
                      onClick={() => setSelectedResultItem(item)}
                      className="hover:bg-zinc-800/50 cursor-pointer transition-colors group"
                    >
                      <td className="py-3 px-3 font-mono text-zinc-500">{item.index}</td>
                      <td className="py-3 px-3 font-mono font-semibold text-zinc-300 whitespace-nowrap">
                        {item.customer_id}
                      </td>
                      <td className="py-3 px-4 text-zinc-300">
                        <div className="line-clamp-2 max-w-md leading-relaxed">
                          {item.input_text}
                        </div>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        {item.router ? (
                          <div className="space-y-1">
                            <span
                              className={`px-2 py-0.5 text-[11px] font-mono font-bold rounded border uppercase ${getCategoryBadgeClass(
                                item.router.category
                              )}`}
                            >
                              {item.router.category}
                            </span>
                            <div className="text-[10px] font-mono text-zinc-500">
                              {(item.router.category_conf * 100).toFixed(0)}% conf
                            </div>
                          </div>
                        ) : (
                          <span className="text-zinc-600 font-mono text-[11px]">-</span>
                        )}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        {item.router ? (
                          <span
                            className={`px-2 py-0.5 text-[11px] font-mono font-bold rounded border uppercase ${getUrgencyBadgeClass(
                              item.router.urgency
                            )}`}
                          >
                            {item.router.urgency}
                          </span>
                        ) : (
                          <span className="text-zinc-600 font-mono text-[11px]">-</span>
                        )}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        {item.intent === 'bad' ? (
                          <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-rose-950/80 text-rose-300 border border-rose-800 rounded">
                            Bad (Infected)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-emerald-950/60 text-emerald-300 border border-emerald-800 rounded">
                            Good (Clean)
                          </span>
                        )}
                      </td>
                      {hasLabeledData && (
                        <td className="py-3 px-3 whitespace-nowrap">
                          {item.is_malicious !== undefined ? (
                            <div className="flex items-center gap-1.5 font-mono text-[11px]">
                              {item.is_malicious === 1 ? (
                                <span className="px-1.5 py-0.5 rounded bg-rose-950/80 text-rose-300 border border-rose-800 text-[10px] font-bold">
                                  ATTACK (1)
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800 text-[10px] font-bold">
                                  BENIGN (0)
                                </span>
                              )}
                              {(() => {
                                const predictedMalicious = Boolean(
                                  item.route === 'SECURITY_REVIEW' ||
                                  item.route === 'HUMAN_QUEUE' ||
                                  item.guard_result?.passed === false ||
                                  item.risk_flags?.includes('PROMPT_GUARD_MALICIOUS') ||
                                  item.risk_flags?.includes('PROMPT_GUARD_AMBIGUOUS') ||
                                  item.risk_flags?.includes('injection_suspected') ||
                                  item.risk_flags?.some((f) => f.startsWith('PROMPT_INJECTION_'))
                                );
                                const actualMalicious = item.is_malicious === 1;
                                const isCorrect = predictedMalicious === actualMalicious;
                                return isCorrect ? (
                                  <span className="text-emerald-400 font-bold" title="Correct Classification">✓</span>
                                ) : (
                                  <span className="text-amber-400 font-bold" title={actualMalicious ? 'Missed Attack (FN)' : 'False Alarm (FP)'}>⚠</span>
                                );
                              })()}
                            </div>
                          ) : (
                            <span className="text-zinc-600 font-mono text-[10px]">-</span>
                          )}
                        </td>
                      )}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {item.status === 'error' ? (
                          <span className="px-2 py-0.5 text-[10px] font-mono bg-red-950 text-red-300 border border-red-800 rounded uppercase font-semibold">
                            Error
                          </span>
                        ) : isHardStop ? (
                          <span className="px-2 py-0.5 text-[10px] font-mono bg-rose-950 text-rose-300 border border-rose-800 rounded uppercase font-semibold">
                            Quarantine
                          </span>
                        ) : isHumanQueue ? (
                          <span className="px-2 py-0.5 text-[10px] font-mono bg-amber-950 text-amber-300 border border-amber-800 rounded uppercase font-semibold">
                            Human Queue
                          </span>
                        ) : isAutoDraft ? (
                          <span className="px-2 py-0.5 text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-800 rounded uppercase font-semibold">
                            Auto Draft
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-[10px] font-mono bg-blue-950 text-blue-300 border border-blue-800 rounded uppercase font-semibold">
                            Escalate
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono text-zinc-400 whitespace-nowrap">
                        {item.latencyMs} ms
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedResultItem(item);
                          }}
                          className="px-2.5 py-1 text-[11px] font-medium bg-zinc-800 group-hover:bg-teal-500 group-hover:text-zinc-950 text-zinc-300 rounded-lg border border-zinc-700 transition-colors"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Ticket Deep-Dive Drawer */}
      <BatchTicketDrawer
        item={selectedResultItem}
        onClose={() => setSelectedResultItem(null)}
      />
    </div>
  );
};
