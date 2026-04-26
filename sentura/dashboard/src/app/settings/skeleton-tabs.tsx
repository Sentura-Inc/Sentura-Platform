"use client";

/**
 * Pure-skeleton tabs for /settings — Scopes, SSO, Audit retention. All
 * three are blocked end-to-end on other-team backends; today they just
 * mount <SkeletonBlock> with the right blocking signal. Lightweight
 * single-file home so we don't sprout 3 tiny modules.
 */

import { SkeletonBlock } from "@/components/skeleton-block";

export function ScopesTab() {
  return (
    <SkeletonBlock
      blockingOwner="Person A"
      blockingDeliverable="multi-tenancy namespace convention + tenant/department metadata schema"
      targetWeek="Week 5"
      willInclude={[
        "SME hierarchy editor — add/rename departments, set parent SME tenant",
        "Per-department employee assignment — drag agents into departments to scope manager visibility",
        "Cross-tenant data boundary settings — choose which data tiers (T0–T4) cross dept boundaries",
        "Default department for self-provisioned end users — covers channel-originated users with no explicit assignment",
      ]}
    />
  );
}

export function SsoTab() {
  return (
    <SkeletonBlock
      blockingOwner="Person A"
      blockingDeliverable="SAML/OIDC backend + trusted-proxy auth integration (per docs/HOSTING.md)"
      targetWeek="Week 5"
      willInclude={[
        "Identity provider configuration — SAML metadata URL or OIDC discovery endpoint, client ID + secret",
        "Attribute mapping — which IdP claim maps to Sentura role + department scope",
        "Just-in-time provisioning — auto-create local user record on first SSO login (with default viewer role)",
        "Test login button — dry-run an SSO flow to surface configuration issues before rollout",
      ]}
    />
  );
}

export function AuditRetentionTab() {
  return (
    <SkeletonBlock
      blockingOwner="Person D"
      blockingDeliverable="audit event schema + retention policy RPC"
      targetWeek="Week 5"
      willInclude={[
        "Per-event-type retention windows — chat messages, tool calls, config changes, approvals each independently configurable",
        "Compliance presets — SOC 2, HIPAA, PCI-DSS profiles that prefill retention defaults",
        "Export schedule — configure scheduled audit log dumps to cold storage / SIEM",
        "Deletion governance — `auditor` and `platform_admin` only; every deletion is itself audited",
      ]}
    />
  );
}
