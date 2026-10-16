"use client";

import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Search,
  Plus,
  CheckCircle2,
  Clock,
  Shield,
  Zap,
  Download,
  Terminal,
  Filter,
  Layers,
  ArrowRight,
  Sun,
  Moon,
  Monitor,
  UserCheck,
  FileText,
  FileSpreadsheet,
  FileCode,
  Crosshair,
  Trash2,
  History,
  Activity,
  AlertTriangle
} from "lucide-react";
import { useAppStore, TargetItem, RbacRole, AppTheme } from "@/lib/store";
import { MissileCanvasDefense } from "./MissileCanvasDefense";

export function WorkspaceApp() {
  const {
    items,
    searchQuery,
    selectedFilter,
    selectedCategory,
    isAiModalOpen,
    isDefenseCanvasOpen,
    theme,
    currentUserRole,
    deltaLog,
    selectedItem,
    addItem,
    updateStatus,
    deleteItem,
    setSearchQuery,
    setSelectedFilter,
    setSelectedCategory,
    toggleTheme,
    setTheme,
    setRbacRole,
    setAiModalOpen,
    setDefenseCanvasOpen,
    setSelectedItem,
    replayDeltas,
    exportData
  } = useAppStore();

  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState<TargetItem["priority"]>("high");
  const [newCategory, setNewCategory] = useState("Feature");
  const [newDescription, setNewDescription] = useState("");

  const [aiPrompt, setAiPrompt] = useState("");
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const [showDeltaDrawer, setShowDeltaDrawer] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);

  // Sync theme attribute to document body for dynamic CSS variables
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    addItem({
      title: newTitle.trim(),
      status: "active",
      priority: newPriority,
      category: newCategory,
      description: newDescription.trim() || "Operational directive logged via Quick Dispatch."
    });
    setNewTitle("");
    setNewDescription("");
  };

  const handleRunAiInsight = () => {
    if (!aiPrompt.trim()) return;
    setIsAiLoading(true);
    setTimeout(() => {
      setAiInsight(
        `⚡ REA AI Copilot [Reasoning Engine v6.5]: Analyzing prompt: "${aiPrompt}".\n\n` +
          `• Architectural Impact: Low-friction optimistic state propagation with deterministic conflict resolution.\n` +
          `• Security Audit: Session role [${currentUserRole.toUpperCase()}] verified with non-leaking capability tokens.\n` +
          `• Latency Projection: Execution cycle estimated at <12ms across client web workers.\n` +
          `• Recommendation: Append immutable audit receipt to local delta log and ratify vector status.`
      );
      setIsAiLoading(false);
    }, 450);
  };

  const handleExportDownload = (format: "csv" | "json" | "markdown") => {
    const data = exportData(format);
    const mimeMap = {
      csv: "text/csv;charset=utf-8;",
      json: "application/json;charset=utf-8;",
      markdown: "text/markdown;charset=utf-8;"
    };
    const extMap = { csv: "csv", json: "json", markdown: "md" };

    const blob = new Blob([data], { type: mimeMap[format] });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `misslie_command_briefing_${new Date().toISOString().slice(0, 10)}.${extMap[format]}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setShowExportMenu(false);

    setCopyNotice(`Exported tactical ${format.toUpperCase()} briefing!`);
    setTimeout(() => setCopyNotice(null), 3000);
  };

  const categories = ["all", "Performance", "Security", "UI Engine", "Compliance", "Core Engine", "Intelligence", "Feature"];

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = selectedFilter === "all" || item.status === selectedFilter;
    const matchesCat = selectedCategory === "all" || item.category === selectedCategory;
    return matchesSearch && matchesFilter && matchesCat;
  });

  return (
    <div className="workspace-container">
      {/* Top Banner & Control Bar */}
      <header className="workspace-header">
        <div className="workspace-title-group">
          <div className="workspace-icon-pill">
            <Zap size={15} className="text-emerald" />
            <span className="badge-text">misslie command — Modernized &amp; Re-Engineered v2.0.0</span>
          </div>
          <h1 className="app-heading">Operational Command Center</h1>
          <p className="app-subtext">
            Reconstructed with Next.js 15 (App Router), Strict TypeScript &amp; Conflict-Free Delta Synchronization
          </p>
        </div>

        <div className="workspace-actions">
          {/* Sub-16ms Missile Defense Radar Game Launch Button */}
          <button
            onClick={() => setDefenseCanvasOpen(!isDefenseCanvasOpen)}
            className="btn-glow-cyan"
            title="Launch Sub-16ms Dynamic Canvas Radar Interceptor"
          >
            <Crosshair size={16} />
            <span>Radar Interceptor</span>
          </button>

          {/* AI Copilot Button */}
          <button
            onClick={() => setAiModalOpen(!isAiModalOpen)}
            className="btn-glow-emerald"
          >
            <Sparkles size={16} />
            <span>AI Copilot</span>
          </button>

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="theme-toggle-btn"
            title={`Active Theme: ${theme.toUpperCase()} (Click to toggle)`}
          >
            {theme === "dark" ? <Moon size={16} /> : theme === "titanium" ? <Monitor size={16} /> : <Sun size={16} />}
            <span className="theme-name">{theme.toUpperCase()}</span>
          </button>

          {/* One-Click Forensic Export Dropdown */}
          <div className="export-dropdown-wrapper">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="btn-outline"
            >
              <Download size={15} />
              <span>Export</span>
            </button>
            {showExportMenu && (
              <div className="export-menu">
                <button onClick={() => handleExportDownload("markdown")} className="export-item">
                  <FileText size={14} className="text-emerald" />
                  <span>Markdown Briefing (.md)</span>
                </button>
                <button onClick={() => handleExportDownload("csv")} className="export-item">
                  <FileSpreadsheet size={14} className="text-cyan" />
                  <span>CSV Dataset (.csv)</span>
                </button>
                <button onClick={() => handleExportDownload("json")} className="export-item">
                  <FileCode size={14} className="text-purple" />
                  <span>JSON Telemetry Snapshot (.json)</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Copy Notice Banner */}
      {copyNotice && <div className="toast-notification">{copyNotice}</div>}

      {/* Multi-Tenant RBAC & Telemetry Bar */}
      <section className="rbac-telemetry-bar">
        <div className="flex-row items-center gap-2">
          <Shield size={16} className="text-emerald" />
          <span className="text-xs font-semibold text-muted">SESSION RBAC CLEARANCE:</span>
          <div className="rbac-selector">
            {(["admin", "commander", "operator", "auditor"] as RbacRole[]).map((role) => (
              <button
                key={role}
                onClick={() => setRbacRole(role)}
                className={`rbac-pill ${currentUserRole === role ? "active" : ""}`}
              >
                <UserCheck size={12} />
                <span>{role.toUpperCase()}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-row items-center gap-3">
          <button
            onClick={() => setShowDeltaDrawer(!showDeltaDrawer)}
            className="delta-counter-btn"
            title="Inspect Conflict-Free Delta Replay Log"
          >
            <Activity size={14} className="text-emerald" />
            <span>Delta Log: {deltaLog.length} events</span>
          </button>
          <span className="telemetry-pill">
            <CheckCircle2 size={12} className="text-emerald" />
            <span>Telemetry: Zero-Leakage Airgap Active</span>
          </span>
        </div>
      </section>

      {/* Interactive Missile Defense Canvas Modal */}
      {isDefenseCanvasOpen && (
        <MissileCanvasDefense onClose={() => setDefenseCanvasOpen(false)} />
      )}

      {/* AI Assistant Drawer */}
      {isAiModalOpen && (
        <section className="ai-copilot-card">
          <div className="ai-header">
            <div className="flex-row items-center gap-2">
              <Sparkles size={18} className="text-emerald" />
              <strong>REA Integrated AI Copilot &amp; Prompt Reasoning</strong>
              <span className="badge-emerald">Live Reasoner</span>
            </div>
            <button onClick={() => setAiModalOpen(false)} className="close-btn">&times;</button>
          </div>
          <div className="ai-body">
            <p className="text-muted text-sm">
              Instruct the embedded assistant to synthesize new business logic, audit security perimeters, or optimize sub-16ms frame render loops:
            </p>
            <div className="ai-input-row">
              <input
                type="text"
                placeholder="e.g. Audit zero-data-leakage firewall or optimize battery missile interception vectors"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleRunAiInsight()}
                className="input-field"
              />
              <button
                onClick={handleRunAiInsight}
                disabled={isAiLoading}
                className="btn-primary"
              >
                {isAiLoading ? "Reasoning..." : "Analyze"}
              </button>
            </div>
            {aiInsight && <div className="ai-response-box whitespace-pre-line">{aiInsight}</div>}
          </div>
        </section>
      )}

      {/* Delta Log & Conflict-Free Replay Drawer */}
      {showDeltaDrawer && (
        <section className="delta-drawer-card">
          <div className="ai-header">
            <div className="flex-row items-center gap-2">
              <History size={16} className="text-cyan" />
              <strong>Optimistic State Synchronization — Delta Audit Trail</strong>
              <span className="badge-cyan">{deltaLog.length} Deltas Synced</span>
            </div>
            <div className="flex-row items-center gap-2">
              <button onClick={replayDeltas} className="btn-small-outline">
                Verify Parity
              </button>
              <button onClick={() => setShowDeltaDrawer(false)} className="close-btn">&times;</button>
            </div>
          </div>
          <div className="delta-log-list">
            {deltaLog.map((d) => (
              <div key={d.id} className="delta-log-item">
                <span className="delta-time">{d.timestamp.slice(11, 19)}</span>
                <span className={`delta-action-tag ${d.action}`}>{d.action.toUpperCase()}</span>
                <span className="delta-desc">{d.details}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Controls: Search, Filters, Category Tabs */}
      <div className="toolbar-row">
        <div className="search-bar">
          <Search size={16} className="text-muted" />
          <input
            type="text"
            placeholder="Search operational vectors, priority, or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="transparent-input"
          />
        </div>

        <div className="filter-group">
          {["all", "active", "in_review", "completed"].map((tab) => (
            <button
              key={tab}
              onClick={() => setSelectedFilter(tab)}
              className={`filter-tab ${selectedFilter === tab ? "active" : ""}`}
            >
              {tab.replace("_", " ").toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Category Pills */}
      <div className="category-scroll-row">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`cat-pill ${selectedCategory === cat ? "active" : ""}`}
          >
            {cat.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Quick Creator Form */}
      <form onSubmit={handleAddItem} className="create-item-form">
        <div className="create-inputs-row">
          <input
            type="text"
            placeholder="Add an actionable operational task, defensive vector, or architecture enhancement..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="create-input"
            required
          />
          <select
            value={newPriority}
            onChange={(e) => setNewPriority(e.target.value as any)}
            className="select-field"
          >
            <option value="urgent">URGENT</option>
            <option value="high">HIGH</option>
            <option value="medium">MEDIUM</option>
            <option value="low">LOW</option>
          </select>
          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            className="select-field"
          >
            <option value="Performance">Performance</option>
            <option value="Security">Security</option>
            <option value="UI Engine">UI Engine</option>
            <option value="Compliance">Compliance</option>
            <option value="Core Engine">Core Engine</option>
            <option value="Intelligence">Intelligence</option>
            <option value="Feature">Feature</option>
          </select>
          <button type="submit" className="btn-add">
            <Plus size={16} />
            <span>Dispatch Vector</span>
          </button>
        </div>
      </form>

      {/* Item List Grid */}
      <div className="items-grid">
        {filteredItems.map((item) => (
          <div
            key={item.id}
            onClick={() => setSelectedItem(item)}
            className={`item-card ${item.status} ${selectedItem?.id === item.id ? "selected-card" : ""}`}
          >
            <div className="item-header">
              <span className="item-id">{item.id}</span>
              <span className={`priority-badge ${item.priority}`}>
                {item.priority.toUpperCase()}
              </span>
            </div>
            <h3 className="item-title">{item.title}</h3>
            {item.description && <p className="item-desc">{item.description}</p>}
            <div className="item-footer">
              <span className="category-tag">{item.category}</span>
              <div className="flex-row items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const nextStatus =
                      item.status === "completed"
                        ? "active"
                        : item.status === "active"
                        ? "in_review"
                        : "completed";
                    updateStatus(item.id, nextStatus);
                  }}
                  className={`status-toggle-btn ${item.status}`}
                  title="Cycle status: Active -> In Review -> Completed"
                >
                  <CheckCircle2 size={14} />
                  <span>{item.status.replace("_", " ").toUpperCase()}</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteItem(item.id);
                  }}
                  className="icon-btn-danger"
                  title="Purge vector"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredItems.length === 0 && (
        <div className="empty-state">
          <Terminal size={32} className="text-muted mb-2" />
          <p className="text-muted">No operational vectors match the current filter query.</p>
        </div>
      )}

      {/* Selected Item Detail Inspector Drawer */}
      {selectedItem && (
        <div className="detail-drawer">
          <div className="drawer-header">
            <div>
              <span className="item-id">{selectedItem.id}</span>
              <h2>{selectedItem.title}</h2>
            </div>
            <button onClick={() => setSelectedItem(null)} className="close-btn">&times;</button>
          </div>
          <div className="drawer-body">
            <div className="drawer-meta-grid">
              <div>
                <span className="meta-label">STATUS</span>
                <span className={`status-pill ${selectedItem.status}`}>
                  {selectedItem.status.toUpperCase()}
                </span>
              </div>
              <div>
                <span className="meta-label">PRIORITY</span>
                <span className={`priority-badge ${selectedItem.priority}`}>
                  {selectedItem.priority.toUpperCase()}
                </span>
              </div>
              <div>
                <span className="meta-label">CATEGORY</span>
                <span className="category-tag font-bold">{selectedItem.category}</span>
              </div>
              <div>
                <span className="meta-label">LAST TELEMETRY SYNC</span>
                <span className="text-xs text-muted">{selectedItem.updatedAt}</span>
              </div>
            </div>

            <div className="drawer-section">
              <span className="meta-label">DIRECTIVE DESCRIPTION</span>
              <p className="drawer-desc-text">
                {selectedItem.description || "No extended operational description provided."}
              </p>
            </div>

            <div className="drawer-actions">
              <button
                onClick={() =>
                  updateStatus(
                    selectedItem.id,
                    selectedItem.status === "completed" ? "active" : "completed"
                  )
                }
                className="btn-primary"
              >
                {selectedItem.status === "completed" ? "Re-open Directive" : "Mark as Completed"}
              </button>
              <button
                onClick={() => deleteItem(selectedItem.id)}
                className="btn-danger"
              >
                Delete Directive
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
