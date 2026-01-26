import { css } from "lit";
import type { ContentStatus } from "../types.js";

export const STATUS_CONFIG: Record<
  ContentStatus,
  { label: string; icon: string; color: string }
> = {
  pending: { label: "Pending", icon: "\u23F3", color: "#f59e0b" },
  approved: { label: "Approved", icon: "\u2705", color: "#10b981" },
  rejected: { label: "Rejected", icon: "\u274C", color: "#ef4444" },
  posted: { label: "Posted", icon: "\uD83D\uDCE4", color: "#3b82f6" },
  scheduled: { label: "Scheduled", icon: "\uD83D\uDCC5", color: "#8b5cf6" },
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
    font-size: 48px;
    margin-bottom: 16px;
  }

  .empty-state-text {
    font-size: 16px;
  }
`;
