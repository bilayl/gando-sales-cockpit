import "server-only";
import { createHash } from "node:crypto";
import { normalizeStageContent, type SD04Content } from "@/lib/sd-stage-content";

export type QuickDealInternalApproval = {
  required: boolean;
  approvedAt: string | null;
  approvedByEmail: string | null;
  approvedHash: string | null;
};

export const EMPTY_QUICK_APPROVAL: QuickDealInternalApproval = {
  required: false,
  approvedAt: null,
  approvedByEmail: null,
  approvedHash: null,
};

export function readQuickApproval(value: unknown): QuickDealInternalApproval {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const data = source.internalApproval && typeof source.internalApproval === "object"
    ? source.internalApproval as Record<string, unknown> : {};
  return {
    required: data.required === true,
    approvedAt: typeof data.approvedAt === "string" ? data.approvedAt : null,
    approvedByEmail: typeof data.approvedByEmail === "string" ? data.approvedByEmail : null,
    approvedHash: typeof data.approvedHash === "string" ? data.approvedHash : null,
  };
}

export function proposalFingerprint(value: unknown) {
  const normalized = normalizeStageContent("SD04", value) as SD04Content;
  // Normalize before hashing so clients cannot approve a representation different
  // from what is saved and later displayed to the customer.
  const { internalApproval: _internalApproval, metricsToConfirm: _clientMetrics, ...customerTerms } = normalized;
  // Customer metric confirmations must not invalidate approval of the commercial offer.
  void _internalApproval; void _clientMetrics;
  return createHash("sha256").update(JSON.stringify(customerTerms)).digest("hex");
}

export function approvalIsCurrent(content: unknown, requiredApproval: QuickDealInternalApproval) {
  return Boolean(requiredApproval.approvedAt && requiredApproval.approvedByEmail
    && requiredApproval.approvedHash === proposalFingerprint(content));
}

export function mayAcceptQuickProposal(content: unknown) {
  const approval = readQuickApproval(content);
  return !approval.required || approvalIsCurrent(content, approval);
}
