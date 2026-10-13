import React, { useState } from 'react';
import { GitBranch, ArrowDown } from 'lucide-react';

interface DagNodeInfo {
  id: string;
  name: string;
  role: string;
  engine: string;
  mutatesState: string[];
  description: string;
  stateSnapshot: Record<string, any>;
}

const DAG_NODES: Record<string, DagNodeInfo> = {
  sanitize_input: {
    id: 'sanitize_input',
    name: 'sanitize_input',
    role: 'Deterministic Sanitizer & Defanger',
    engine: 'Regex Defanger + Meta Prompt Guard 2 (86M)',
    mutatesState: ['sanitized_text', 'risk_flags', 'trace'],
    description:
      'Removes zero-width characters, defangs IPv4/URLs, masks credit cards and SSNs, and executes Meta Prompt Guard 2 classifier. Raw ticket text is converted to safe tokens.',
    stateSnapshot: {
      ticket_id: 'tkt_8029a1b',
      sanitized_text: 'Refund duplicate $49 charge on card ending in [REDACTED_CC]',
      risk_flags: [],
      trace: [{ node: 'sanitize_input', duration_ms: 8.4 }],
    },
  },
  route_classifier: {
    id: 'route_classifier',
    name: 'route_classifier',
    role: 'System 1 Fast Router',
    engine: 'Laya Non-Autoregressive Classifier (~32ms)',
    mutatesState: ['router.category', 'router.urgency', 'router.team', 'confidence', 'trace'],
    description:
      'Predicts category, urgency, owning department, and calibrated confidence score. Does not run LLM generation loops and cannot invoke external tools.',
    stateSnapshot: {
      router: {
        category: 'billing',
        category_conf: 0.94,
        urgency: 'high',
        team: 'finance_billing',
      },
      trace: [
        { node: 'sanitize_input', duration_ms: 8.4 },
        { node: 'route_classifier', duration_ms: 31.8 },
      ],
    },
  },
  policy_gate: {
    id: 'policy_gate',
    name: 'policy_gate',
    role: 'Deterministic Policy Enforcement Gate',
    engine: 'Fail-Closed LangGraph Conditional Router',
    mutatesState: ['route', 'route_reason', 'disposition', 'trace'],
    description:
      'Evaluates strict invariants: If risk_flags contains injection ➔ quarantine. If confidence < 0.70 ➔ human_review. If category requires financial dual-control ➔ human_review.',
    stateSnapshot: {
      route: 'human_review',
      route_reason: 'Refund amount > $0 requires dual-approval per financial compliance',
      disposition: 'HUMAN_REVIEW',
      trace: [
        { node: 'sanitize_input', duration_ms: 8.4 },
        { node: 'route_classifier', duration_ms: 31.8 },
        { node: 'policy_gate', duration_ms: 1.2 },
      ],
    },
  },
  quarantine: {
    id: 'quarantine',
    name: 'quarantine',
    role: 'Adversarial Threat Containment',
    engine: 'Isolated Security Sandbox (Zero LLM)',
    mutatesState: ['disposition: QUARANTINE', 'intent: bad'],
    description:
      'Permanently isolates injection attacks and malicious exploit payloads. Prevents downstream agents from reading poisoned tokens.',
    stateSnapshot: {
      intent: 'bad',
      disposition: 'QUARANTINE',
      status: 'BLOCKED',
    },
  },
  human_review: {
    id: 'human_review',
    name: 'human_review',
    role: 'Enterprise Human-in-the-Loop Queue',
    engine: 'Help Desk Dispatch (Zendesk / Jira)',
    mutatesState: ['disposition: HUMAN_REVIEW', 'assigned_team: finance_billing'],
    description:
      'Safely forwards low-confidence, complex, or sensitive financial tickets to human support specialists with clean audit traces.',
    stateSnapshot: {
      intent: 'good',
      disposition: 'HUMAN_REVIEW',
      status: 'QUEUED_FOR_AGENT',
    },
  },
  auto_draft: {
    id: 'auto_draft',
    name: 'auto_draft',
    role: 'System 2 Scoped LLM Drafting Agent',
    engine: 'Generative LLM + RAG Grounding',
    mutatesState: ['draft_response', 'retrieved_context'],
    description:
      'Drafts a high-empathy customer response grounded exclusively in verified knowledge base documents with strictly route-scoped tools.',
    stateSnapshot: {
      intent: 'good',
      disposition: 'AUTO_DRAFT',
      draft: 'Hi there, your order has shipped and tracking indicates delivery tomorrow by 3 PM.',
    },
  },
};

export const LangGraphDagDiagram: React.FC = () => {
  const [selectedNodeId, setSelectedNodeId] = useState<string>('policy_gate');

  const selectedNode = DAG_NODES[selectedNodeId] || DAG_NODES.policy_gate;

  return (
    <div className="w-full neo-card p-6 sm:p-8 bg-[#12141D] border-2 border-[#232736] shadow-[6px_6px_0px_#000]">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-6 border-b-2 border-[#232736] mb-8">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-[#A78BFA] mb-1">
            <GitBranch size={14} />
            <span>LANGGRAPH STATE MACHINE SPECIFICATION</span>
          </div>
          <h3 className="font-heading font-extrabold text-xl text-white">
            Stateful DAG Graph with Conditional Branching
          </h3>
          <p className="font-sans text-xs text-zinc-400 max-w-xl mt-1">
            TriageGuard models support triage as an explicit state graph. Tickets never bypass nodes
            and state mutations are immutably appended to the event trace.
          </p>
        </div>

        <div className="text-xs font-mono text-zinc-300 bg-[#0A0B10] px-3 py-1.5 rounded-md border-2 border-[#232736] shadow-[2px_2px_0px_#000]">
          State Schema: <span className="text-[#CCFF00] font-bold">TriageGraphState</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Interactive Visual DAG Tree */}
        <div className="lg:col-span-7 flex flex-col items-center gap-3">
          {/* Start node */}
          <div className="px-3.5 py-1 rounded bg-[#0A0B10] border-2 border-[#232736] text-[11px] font-mono text-zinc-400 font-bold">
            __start__ (Customer Request)
          </div>

          <div className="w-0.5 h-6 bg-[#CCFF00] relative">
            <ArrowDown size={12} className="absolute -bottom-3 -left-[5px] text-[#CCFF00]" />
          </div>

          {/* Node 1: sanitize_input */}
          <div
            onClick={() => setSelectedNodeId('sanitize_input')}
            className={`w-full max-w-md p-4 rounded-lg border-2 cursor-pointer transition-all ${
              selectedNodeId === 'sanitize_input'
                ? 'bg-[#181B26] border-[#CCFF00] shadow-[4px_4px_0px_#CCFF00]'
                : 'bg-[#0A0B10] border-[#232736] shadow-[3px_3px_0px_#000] hover:border-zinc-500'
            }`}
          >
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-mono font-bold text-[#CCFF00]">sanitize_input</span>
              <span className="text-[10px] font-mono text-zinc-400 font-bold">Node 1 · ~8.4 ms</span>
            </div>
            <p className="font-sans text-[11px] text-zinc-400">
              Defangs URLs/IPs, strips zero-width chars, masks CC/SSN, runs Meta Prompt Guard 2.
            </p>
          </div>

          <div className="w-0.5 h-6 bg-[#CCFF00] relative">
            <ArrowDown size={12} className="absolute -bottom-3 -left-[5px] text-[#CCFF00]" />
          </div>

          {/* Node 2: route_classifier */}
          <div
            onClick={() => setSelectedNodeId('route_classifier')}
            className={`w-full max-w-md p-4 rounded-lg border-2 cursor-pointer transition-all ${
              selectedNodeId === 'route_classifier'
                ? 'bg-[#181B26] border-[#CCFF00] shadow-[4px_4px_0px_#CCFF00]'
                : 'bg-[#0A0B10] border-[#232736] shadow-[3px_3px_0px_#000] hover:border-zinc-500'
            }`}
          >
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-mono font-bold text-[#00F0FF]">route_classifier</span>
              <span className="text-[10px] font-mono text-zinc-400 font-bold">Node 2 · ~32.0 ms</span>
            </div>
            <p className="font-sans text-[11px] text-zinc-400">
              Laya fast classifier predicts Category, Urgency, Team, and Confidence. Zero tools.
            </p>
          </div>

          <div className="w-0.5 h-6 bg-[#A78BFA] relative">
            <ArrowDown size={12} className="absolute -bottom-3 -left-[5px] text-[#A78BFA]" />
          </div>

          {/* Node 3: policy_gate */}
          <div
            onClick={() => setSelectedNodeId('policy_gate')}
            className={`w-full max-w-md p-4 rounded-lg border-2 cursor-pointer transition-all ${
              selectedNodeId === 'policy_gate'
                ? 'bg-[#181B26] border-[#A78BFA] shadow-[4px_4px_0px_#A78BFA]'
                : 'bg-[#0A0B10] border-[#232736] shadow-[3px_3px_0px_#000] hover:border-zinc-500'
            }`}
          >
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-mono font-bold text-[#A78BFA]">policy_gate</span>
              <span className="text-[10px] font-mono text-zinc-400 font-bold">Conditional Edge Gate</span>
            </div>
            <p className="font-sans text-[11px] text-zinc-400">
              Evaluates confidence threshold (&gt;= 0.70), risk flags, and corporate dual-control rules.
            </p>
          </div>

          {/* Conditional Branching indicator */}
          <div className="text-[10px] font-mono text-zinc-400 my-1 font-bold uppercase tracking-wider">
            Conditional Branching (Fail-Closed Decision)
          </div>

          {/* Terminal Target Branching Row */}
          <div className="grid grid-cols-3 gap-2.5 w-full max-w-lg">
            {/* Quarantine */}
            <div
              onClick={() => setSelectedNodeId('quarantine')}
              className={`p-3 rounded-lg border-2 transition-all cursor-pointer text-center ${
                selectedNodeId === 'quarantine'
                  ? 'bg-[#1F1214] border-[#FF4949] shadow-[3px_3px_0px_#FF4949]'
                  : 'bg-[#0A0B10] border-[#232736] shadow-[2px_2px_0px_#000] hover:border-zinc-500'
              }`}
            >
              <div className="text-[#FF4949] font-bold text-xs font-mono mb-1">QUARANTINE</div>
              <div className="text-[10px] text-zinc-400 font-sans">Attack / Injection</div>
            </div>

            {/* Human Review */}
            <div
              onClick={() => setSelectedNodeId('human_review')}
              className={`p-3 rounded-lg border-2 transition-all cursor-pointer text-center ${
                selectedNodeId === 'human_review'
                  ? 'bg-[#1C160E] border-[#FFBE1A] shadow-[3px_3px_0px_#FFBE1A]'
                  : 'bg-[#0A0B10] border-[#232736] shadow-[2px_2px_0px_#000] hover:border-zinc-500'
              }`}
            >
              <div className="text-[#FFBE1A] font-bold text-xs font-mono mb-1">HUMAN_REVIEW</div>
              <div className="text-[10px] text-zinc-400 font-sans">Conf &lt; 0.70 / Dual-Control</div>
            </div>

            {/* Auto Draft */}
            <div
              onClick={() => setSelectedNodeId('auto_draft')}
              className={`p-3 rounded-lg border-2 transition-all cursor-pointer text-center ${
                selectedNodeId === 'auto_draft'
                  ? 'bg-[#0E1B15] border-[#00F5A0] shadow-[3px_3px_0px_#00F5A0]'
                  : 'bg-[#0A0B10] border-[#232736] shadow-[2px_2px_0px_#000] hover:border-zinc-500'
              }`}
            >
              <div className="text-[#00F5A0] font-bold text-xs font-mono mb-1">AUTO_DRAFT</div>
              <div className="text-[10px] text-zinc-400 font-sans">Scoped LLM (System 2)</div>
            </div>
          </div>
        </div>

        {/* Right: Selected Node Detail & State Inspector */}
        <div className="lg:col-span-5 neo-card p-5 bg-[#0A0B10] border-2 border-[#232736] shadow-[4px_4px_0px_#000]">
          <div className="flex items-center justify-between pb-3 border-b-2 border-[#232736] mb-4">
            <div>
              <span className="font-mono text-xs font-bold text-zinc-400 uppercase">
                Node Specification
              </span>
              <h4 className="font-heading font-extrabold text-base text-white mt-0.5">
                {selectedNode.name}
              </h4>
            </div>
            <span className="neo-badge neo-badge-volt text-[10px]">
              INSPECTED
            </span>
          </div>

          <div className="space-y-4">
            <div>
              <div className="font-mono text-[11px] text-zinc-400 uppercase font-bold mb-1">
                Role & Execution Engine
              </div>
              <div className="text-xs text-zinc-200 font-sans leading-relaxed">
                {selectedNode.role}
              </div>
              <div className="font-mono text-[11px] text-[#00F0FF] mt-1">
                Engine: {selectedNode.engine}
              </div>
            </div>

            <div>
              <div className="font-mono text-[11px] text-zinc-400 uppercase font-bold mb-1">
                State Fields Mutated
              </div>
              <div className="flex flex-wrap gap-1.5">
                {selectedNode.mutatesState.map((field) => (
                  <span
                    key={field}
                    className="font-mono text-[10px] bg-[#12141D] text-white px-2 py-0.5 rounded border border-[#232736]"
                  >
                    +{field}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <div className="font-mono text-[11px] text-zinc-400 uppercase font-bold mb-1">
                Operational Description
              </div>
              <p className="font-sans text-xs text-zinc-300 leading-relaxed">
                {selectedNode.description}
              </p>
            </div>

            <div>
              <div className="font-mono text-[11px] text-zinc-400 uppercase font-bold mb-1 flex items-center justify-between">
                <span>State Payload Snapshot</span>
                <span className="text-[10px] text-zinc-500">JSON</span>
              </div>
              <pre className="p-3 rounded bg-[#07080B] border border-[#232736] font-mono text-[11px] text-[#00F5A0] overflow-x-auto leading-relaxed max-h-48 custom-scrollbar">
                {JSON.stringify(selectedNode.stateSnapshot, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LangGraphDagDiagram;
