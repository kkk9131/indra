import { css, svg } from "lit";
import type { ContentStatus } from "../types.js";

// Lucide icons for status
const pendingIcon = svg`<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>`;
const approvedIcon = svg`<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>`;
const rejectedIcon = svg`<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>`;
const postedIcon = svg`<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>`;
const scheduledIcon = svg`<rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>`;

export const STATUS_CONFIG: Record<
  ContentStatus,
  { label: string; icon: ReturnType<typeof svg>; color: string }
> = {
  pending: { label: "Pending", icon: pendingIcon, color: "#f59e0b" },
  approved: { label: "Approved", icon: approvedIcon, color: "#10b981" },
  rejected: { label: "Rejected", icon: rejectedIcon, color: "#ef4444" },
  posted: { label: "Posted", icon: postedIcon, color: "#3b82f6" },
  scheduled: { label: "Scheduled", icon: scheduledIcon, color: "#8b5cf6" },
};

export const hostStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    gap: 24px;
    font-family: var(--font-family, "Geist Mono", monospace);
    color: var(--text-primary, #2d3436);
  }
`;

export const pageHeaderStyles = css`
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .page-title {
    font-size: 28px;
    font-weight: 600;
    color: var(--text-primary, #2d3436);
  }
`;

export const buttonStyles = css`
  .btn {
    padding: 10px 20px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    font-family: var(--font-family, "Geist Mono", monospace);
    transition: all 0.15s ease;
  }

  .btn-primary {
    background: var(--primary, #2e7d32);
    color: white;
    border: none;
  }

  .btn-primary:hover {
    background: #1b5e20;
  }

  .btn-secondary {
    background: var(--bg-tertiary, #f5f5f5);
    color: var(--text-primary, #2d3436);
    border: 1px solid var(--border, #e0e0e0);
  }

  .btn-secondary:hover {
    background: var(--border, #e0e0e0);
  }

  .btn-danger {
    background: #ffebee;
    color: #c62828;
    border: 1px solid #ffcdd2;
  }

  .btn-danger:hover {
    background: #ffcdd2;
  }

  .btn-sm {
    padding: 6px 12px;
    font-size: 12px;
  }
`;

export const formStyles = css`
  .form-group {
    margin-bottom: 16px;
  }

  .form-group label {
    display: block;
    margin-bottom: 6px;
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary, #2d3436);
  }

  .form-group select,
  .form-group input {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid var(--border, #e0e0e0);
    border-radius: 8px;
    font-size: 14px;
    font-family: inherit;
    box-sizing: border-box;
  }

  .form-group select:focus,
  .form-group input:focus {
    outline: none;
    border-color: var(--primary, #2e7d32);
  }

  .modal-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
  }
`;

export const emptyStateStyles = css`
  .empty-state {
    text-align: center;
    padding: 60px 24px;
    background: white;
    border-radius: 12px;
    color: var(--text-secondary, #636e72);
  }

  .empty-state-icon {
    width: 48px;
    height: 48px;
    margin: 0 auto 16px;
  }

  .empty-state-icon svg {
    width: 100%;
    height: 100%;
    fill: none;
    stroke: var(--text-secondary, #636e72);
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .empty-state-text {
    font-size: 16px;
  }
`;

export const statusBadgeStyles = css`
  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
  }

  .status-badge svg {
    width: 14px;
    height: 14px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
`;
