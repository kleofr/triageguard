import React, { useState, useMemo } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Copy,
  Check,
  Download,
  Search,
  Maximize2,
  Minimize2,
  Code2,
  Layers,
  FileJson,
} from 'lucide-react';

interface JsonViewerProps {
  data: any;
  title?: string;
  defaultExpanded?: boolean;
}

interface TreeNodeProps {
  name?: string | number;
  value: any;
  depth: number;
  isLast?: boolean;
  searchTerm: string;
  expandedMap: Record<string, boolean>;
  toggleExpand: (path: string) => void;
  path: string;
}

function highlightMatch(text: string, search: string) {
  if (!search) return text;
  const parts = text.split(new RegExp(`(${search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === search.toLowerCase() ? (
          <mark key={i} className="bg-amber-400/30 text-amber-200 rounded px-0.5 font-medium">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}

const TreeNode: React.FC<TreeNodeProps> = ({
  name,
  value,
  depth,
  searchTerm,
  expandedMap,
  toggleExpand,
  path,
}) => {
  const [copiedVal, setCopiedVal] = useState(false);

  const isObject = value !== null && typeof value === 'object' && !Array.isArray(value);
  const isArray = Array.isArray(value);
  const isExpandable = isObject || isArray;

  const isExpanded = expandedMap[path] ?? (depth < 2);

  const handleCopyValue = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value));
    setCopiedVal(true);
    setTimeout(() => setCopiedVal(false), 1500);
  };

  const renderValue = (val: any) => {
    if (val === null) return <span className="text-zinc-500 italic">null</span>;
    if (val === undefined) return <span className="text-zinc-500 italic">undefined</span>;

    const type = typeof val;
    if (type === 'boolean') {
      return <span className="text-cyan-400 font-mono font-medium">{String(val)}</span>;
    }
    if (type === 'number') {
      return <span className="text-amber-300 font-mono">{val}</span>;
    }
    if (type === 'string') {
      const isUrl = val.startsWith('http://') || val.startsWith('https://') || val.startsWith('hxxp');
      const isRedacted = val.includes('[') && val.includes('REDACTED');
      return (
        <span
          className={`font-mono break-all ${
            isRedacted
              ? 'text-amber-400 bg-amber-950/40 px-1 py-0.5 rounded border border-amber-800/40'
              : isUrl
              ? 'text-indigo-300 underline decoration-dotted'
              : 'text-emerald-300'
          }`}
        >
          "{highlightMatch(val, searchTerm)}"
        </span>
      );
    }
    return <span className="text-zinc-300 font-mono">{String(val)}</span>;
  };

  if (isExpandable) {
    const keys = Object.keys(value);
    const count = keys.length;
    const bracketOpen = isArray ? '[' : '{';
    const bracketClose = isArray ? ']' : '}';

    return (
      <div className="text-xs leading-relaxed font-mono select-text">
        <div
          onClick={() => toggleExpand(path)}
          className="group flex items-center gap-1 py-0.5 px-1.5 rounded hover:bg-zinc-800/60 cursor-pointer transition-colors"
          style={{ paddingLeft: `${depth * 16 + 6}px` }}
        >
          <span className="text-zinc-500 hover:text-zinc-300 transition-colors">
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>

          {name !== undefined && (
            <span className="text-zinc-300 font-medium font-mono">
              {highlightMatch(String(name), searchTerm)}
              <span className="text-zinc-600 mr-1.5">:</span>
            </span>
          )}

          <span className="text-zinc-400 font-mono">{bracketOpen}</span>

          {!isExpanded && (
            <span className="text-zinc-500 text-[11px] px-1.5 py-0.2 bg-zinc-800/80 rounded border border-zinc-700/40 ml-1 font-sans">
              {count} {isArray ? (count === 1 ? 'item' : 'items') : count === 1 ? 'key' : 'keys'}
            </span>
          )}

          {!isExpanded && <span className="text-zinc-400 font-mono">{bracketClose}</span>}

          <button
            onClick={handleCopyValue}
            title="Copy subtree"
            className="opacity-0 group-hover:opacity-100 ml-auto text-zinc-500 hover:text-zinc-300 p-0.5 rounded transition-opacity"
          >
            {copiedVal ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
          </button>
        </div>

        {isExpanded && (
          <div>
            {keys.map((k, index) => {
              const childVal = value[k];
              const childPath = `${path}.${k}`;
              return (
                <TreeNode
                  key={k}
                  name={isArray ? undefined : k}
                  value={childVal}
                  depth={depth + 1}
                  isLast={index === keys.length - 1}
                  searchTerm={searchTerm}
                  expandedMap={expandedMap}
                  toggleExpand={toggleExpand}
                  path={childPath}
                />
              );
            })}
            <div
              className="text-zinc-400 font-mono py-0.5 px-1.5"
              style={{ paddingLeft: `${depth * 16 + 20}px` }}
            >
              {bracketClose}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="group flex items-start gap-1 py-0.5 px-1.5 rounded hover:bg-zinc-800/40 transition-colors text-xs font-mono select-text"
      style={{ paddingLeft: `${depth * 16 + 20}px` }}
    >
      {name !== undefined && (
        <span className="text-zinc-300 shrink-0 font-medium">
          {highlightMatch(String(name), searchTerm)}
          <span className="text-zinc-600 mr-1.5">:</span>
        </span>
      )}
      <div className="flex-1 overflow-hidden">{renderValue(value)}</div>
      <button
        onClick={handleCopyValue}
        title="Copy value"
        className="opacity-0 group-hover:opacity-100 ml-auto shrink-0 text-zinc-500 hover:text-zinc-300 p-0.5 rounded transition-opacity"
      >
        {copiedVal ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
      </button>
    </div>
  );
};

export const JsonViewer: React.FC<JsonViewerProps> = ({ data, title = 'Response Payload' }) => {
  const [viewMode, setViewMode] = useState<'tree' | 'raw'>('tree');
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedAll, setCopiedAll] = useState(false);
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});
  const [allExpanded, setAllExpanded] = useState(false);

  const formattedJson = useMemo(() => {
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  }, [data]);

  const toggleExpand = (path: string) => {
    setExpandedMap((prev) => ({
      ...prev,
      [path]: !(prev[path] ?? false),
    }));
  };

  const handleToggleExpandAll = () => {
    if (allExpanded) {
      setExpandedMap({});
      setAllExpanded(false);
    } else {
      const newMap: Record<string, boolean> = {};
      const traverse = (obj: any, currentPath: string) => {
        if (obj !== null && typeof obj === 'object') {
          newMap[currentPath] = true;
          Object.keys(obj).forEach((k) => traverse(obj[k], `${currentPath}.${k}`));
        }
      };
      traverse(data, 'root');
      setExpandedMap(newMap);
      setAllExpanded(true);
    }
  };

  const handleCopyAll = () => {
    navigator.clipboard.writeText(formattedJson);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([formattedJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `response-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl">
      {/* Top action bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-900/90 border-b border-zinc-800">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-zinc-800/80 rounded-md text-zinc-300">
            <FileJson size={16} />
          </div>
          <div>
            <span className="text-xs font-semibold tracking-wider text-zinc-200 uppercase font-sans">
              {title}
            </span>
          </div>
        </div>

        {/* View mode toggle & Actions */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center bg-zinc-950 p-0.5 rounded-lg border border-zinc-800 mr-2">
            <button
              onClick={() => setViewMode('tree')}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md transition-all ${
                viewMode === 'tree'
                  ? 'bg-zinc-800 text-zinc-100 font-medium shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Layers size={13} />
              <span>Tree View</span>
            </button>
            <button
              onClick={() => setViewMode('raw')}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md transition-all ${
                viewMode === 'raw'
                  ? 'bg-zinc-800 text-zinc-100 font-medium shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Code2 size={13} />
              <span>Raw JSON</span>
            </button>
          </div>

          {viewMode === 'tree' && (
            <button
              onClick={handleToggleExpandAll}
              title={allExpanded ? 'Collapse All' : 'Expand All'}
              className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-md transition-colors"
            >
              {allExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
          )}

          <button
            onClick={handleCopyAll}
            title="Copy Full JSON"
            className="flex items-center gap-1 px-2.5 py-1 text-xs text-zinc-300 bg-zinc-800/80 hover:bg-zinc-700/80 rounded-md border border-zinc-700/50 transition-colors"
          >
            {copiedAll ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            <span>{copiedAll ? 'Copied' : 'Copy'}</span>
          </button>

          <button
            onClick={handleDownload}
            title="Download JSON File"
            className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-md transition-colors"
          >
            <Download size={14} />
          </button>
        </div>
      </div>

      {/* Search Filter Bar (for Tree view) */}
      {viewMode === 'tree' && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900/40 border-b border-zinc-800/60">
          <Search size={13} className="text-zinc-500 shrink-0" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter keys or values..."
            className="bg-transparent text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none w-full font-mono"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="text-[10px] text-zinc-500 hover:text-zinc-300 px-1 bg-zinc-800 rounded"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto p-3 font-mono text-xs custom-scrollbar">
        {viewMode === 'tree' ? (
          <div className="py-1">
            <TreeNode
              value={data}
              depth={0}
              searchTerm={searchTerm}
              expandedMap={expandedMap}
              toggleExpand={toggleExpand}
              path="root"
            />
          </div>
        ) : (
          <pre className="text-zinc-300 text-xs font-mono leading-relaxed select-text p-2 whitespace-pre-wrap word-break">
            {formattedJson}
          </pre>
        )}
      </div>
    </div>
  );
};
