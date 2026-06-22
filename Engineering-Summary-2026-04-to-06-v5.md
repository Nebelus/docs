# Nebelus Engineering — ~2.5-Month Summary

**10 April – 21 June 2026 — All Sessions Combined**

> Engineering run solo by Haydar Al-Saad since the CTO transition. This covers the
> 72-day window following the 15–22 May infrastructure-lockout and P0/P1 cleanup
> sprint, the 10–11 June EU-only migration and DPO audit-readiness push for the
> first medical-data enterprise prospect (ABN AMRO via SV Land / Charlotte), the
> 12–13 June LLM EU-residency migration + new-tenant provisioning sprint (NovaLink
> + CR Health migrated to Vertex EU; Prospectief + SV Land provisioned end-to-end),
> the 14–15 June per-org retention + workflow-tooling sprint (data-retention
> policy live, sandbox docx/html→PDF renderer shipped, LHM Bloedwaarderapport
> workflow operational end-to-end, two new tenants provisioned), and the **18–21 June
> CL-6 → CL-11 cleanup sprint arc** (5 bugfixes, native multi-currency ledger,
> comprehensive RBAC enforcement, unit-billing correctness, customer provisioning
> toolkit, FE gating consistency).
>
> Source data: ~100 merged PRs, 30+ issues, and full commit history across `server/` + `portal/`.

---

| **100+** | **15** | **30+** | **6** | **0** |
|:------:|:------:|:------:|:-----:|:-----:|
| PRs Merged | Incidents Resolved | Issues Filed | Tenants Live | P0/P1 Left |

**Volume:** 420+ commits (server + portal) · audit logging + GDPR cascade complete · EU-only infra · full LLM EU-residency migration · 6 tenants live (NovaLink, CR Health, Prospectief, SV Land, Laura, Ranstad) · per-org data retention live · sandbox PDF renderer live · **native multi-currency ledger live · comprehensive RBAC enforcement live · customer provisioning toolkit complete**

**Agents:** Rio live in Zahar · Nova production-stable · 30 NovaLink + CR Health agents migrated to Vertex EU · 22 agents cloned to Prospectief/SV Land · 4 additional agents cloned to Laura + Ranstad · LHM Bloedwaarderapport workflow operational with template-to-PDF rendering · **NovaLink agents migrated to multi-currency EUR billing with per-plan margin overrides**

**Posture:** CI gated on every PR · audit trail + IP/geo allow-list shipped · EU-only Vertex + storage + KMS · per-org region pinning live · `ModelDeployment` registry actively probe-managed · GDPR Article 17 fully implemented · NEN 7513 audit logging complete · secrets clean · migration discipline automated · per-org configurable data retention live · **ISO 27001 + 9001 + GDPR certified · cross-tenant data isolation verified at server + serializer + viewset + query level · three-layer gating model (org / permission / route) formalized · investigation-first PR discipline standardized**

---

## Infrastructure & Compliance (May 21 – Jun 11)

| Item |
|------|
| ■ Persistent login-event audit trail — `core.LoginEvent`, every interactive auth recorded (NEN 7513 / EEA), 7-year retention (PR #31) |
| ■ Per-org IP allow-list — `core.OrganizationAccessPolicy`, report-only by default, `enforce` mode rejects out-of-range logins (PR #31) |
| ■ Per-org **geo** allow-list — country dimension added to access policy + owner anti-lockout guard (PR #38, core migration 0005) |
| ■ GeoLite2 refresh workflow — scheduled GeoIP database update so geo enforcement stays current (`geolite2-refresh.yml`) |
| ■ LoginEvent → Cloud Logging — dedicated `nebelus.audit` logger + 7-year log-sink runbook for tamper-evident retention (PR #36) |
| ■ Per-org provider / voice / BYOK module gating — 28 modules, dual-gate (org flag + provider check) (PR #40, control migration 0023) |
| ■ L7 GCLB migration for `api.nebelus.ai` — global HTTP(S) LB injects real `X-Forwarded-For`; manifests + cutover/rollback runbook (PR #33) |
| ■ Caddy XFF preservation + configmap pod-CIDR trust ranges — real client IPs reach `get_client_ip()` after L7 cutover (PR #34) |
| ■ Hardened client-IP extractor — `core.utils.request_ip.get_client_ip`, spoof-resistant XFF walk, never returns private IP from header |
| ■ **EU-only storage cleanup (Jun 10)** — 10 US/Asia GCS buckets deleted, 5 source/upload buckets cleaned; production data fully consolidated in europe-west4 |
| ■ **Cloud SQL upgrade** — `nebelus-prod-db-nl` patched to REGIONAL multi-zone HA, PITR enabled, EU backup location, 7-day rolling retention |
| ■ **Cloud KMS keyring** — `nebelus-prod-eu` created in europe-west4 with HSM-backed key (FIPS 140-2 Level 3) for CMEK-capable tenancy |
| ■ **VERTEXAI_LOCATION pinned to europe-west4** in production configmap; all LLM inference now EU-region |
| ■ **Cloud Run / Functions migration** — `alert-mailer` (asia-east1 → europe-west4), `cdn-service` and `nebelus-csp-reporter` (us-central1 → europe-west4); 5 test APIs deleted; orphaned source/upload buckets cleaned |
| ■ **Default bucket names → EU** — `settings.py` defaults and template defaults all switched to `-nl` suffix (PR #52, #53) |
| ■ **Hardcoded GCS credentials removed** — `GCP_ACCESS_KEY_ID` / `GCP_SECRET_ACCESS_KEY` literals stripped from `settings.py`; values rotated upstream (PR #53) |
| ■ **alert-mailer hardening** — `ALERT_TO` moved from personal Gmail to `alerts@nebelus.ai`; alert template updated to reference real EU cluster (`nebelus-production-nl`, `confidential-pool-nl`, `europe-west4`) |

## Production Debugging & Hotfixes (May 22 – Jun 11)

| Item |
|------|
| ■ `x_forwarded_for` NameError — undefined var in request-info dict caused a 500 in widget chat; defined + guarded (PR #45) |
| ■ Async/sync gate in streaming path — module-gate factory calls not wrapped, P0 crash; `sync_to_async` wrapped (PR #46) |
| ■ Anthropic `top_p` strip — Opus 4.8 rejects `top_p`; stripped via deprecated-params registry (PR #26, #51) |
| ■ Vertex AI EU region fallback — region routing hardened so Vertex calls stay in-region/EU on fallback (PR #51) |
| ■ CustomAPIEndpoint save corruption — admin save silently corrupted records via tool dedup; root-caused + fixed (PR #28) |
| ■ Exponential messages-channel doubling — production-critical state blowup in workflow runs; doubling stopped (PR #19, #20) |
| ■ Checkpointer init — `AsyncPostgresSaver` initialized lazily as a singleton to stop per-call connection churn (PR #14) |
| ■ Sandbox file staging — staged files routed through Django cache instead of pod-local disk (lost on pod hop) (PR #11) |
| ■ Subagent `as_tool` — return final answer, not raw graph state, on tool-wrapped agent calls (PR #12) |
| ■ **Logo URLs site-wide broken (Jun 11)** — model picker / tool browser images 404'd against deleted `nebelus-public` US bucket; root-caused across portal + server (hardcoded URLs across `model_factory.py`, `tools/*/__init__.py`, `mcp_servers.py`, `models_source.py`); fixed via PR #28 (portal) + PR #61 (server) repointing 80+ URLs to `nebelus-public-nl` |
| ■ **alert-mailer 401 on EU Eventarc push** — `gcloud functions deploy` didn't carry over `run.invoker` IAM bindings; compute SA + Pub/Sub service agent re-granted, end-to-end verified |

## Agent Operations — Workflow / Multi-Agent Runtime (May 24 – Jun 04)

| Item |
|------|
| ■ Nova — production-stable; multi-agent workflow runtime hardened across the fixes below; async streaming fix landed (PR #46) |
| ■ Rio — live in Zahar (no longer paused mid-discovery); built on the same workflow runtime |
| ■ Router resiliency — preserve `routing_targets` when the router agent emits no text; route to END when no targets selected (PR #13, #16) |
| ■ Specialist state propagation — `set_state` writes propagate to outer state; inner-agent schema for custom fields (specialist→synthesis) (PR #17, #18) |
| ■ Per-node AgentFactory built lazily on first execution — removes cold-start cost for unused nodes (PR #15) |
| ■ Lean `get_state` output — trims synthesis-node payload to cut token cost (PR #21) |
| ■ Per-node tool override — `needed_tools_override` on `BuiltinToolManager` for workflow-node integration tools (PR #29) |
| ■ Workflow-save fidelity — preserve `enable_routing_tool` + other backend-managed node config on save (portal PR #19) |
| ■ `stage_file_to_sandbox` — on-demand file-staging platform tool (PR #10) |
| ■ `reset_demo_thread` platform tool — hard-delete (was soft-delete) for clean demo resets (PR #22, #23) |
| ■ Warm-turn latency instrumentation for workflow agents — measure-before-optimize baseline (PR #30) |

## GDPR & NEN 7513 Audit Logging Push (Jun 10 – Jun 11)

| Item |
|------|
| ■ **Audit-log verification round** — 6 customer-facing audit-log claims verified against code; found 4 gaps, 1 different-structure, 1 confirmed; all six addressed in PR #57 + PR #60 |
| ■ **GDPR Article 17 deletion cascade (PR #60)** — `background.tasks.delete_organization` task was *referenced but did not exist*; customer deletion was a soft-delete flag with a silently-dropped task. Implemented hard cascade: PostgreSQL (with `_base_manager`) → Qdrant namespace purge → GCS object delete (both EU buckets) → Redis invalidation → verification; per-step audit log entries; idempotent, safe-retry (`acks_late`, 3600s limit); control migration 0025 |
| ■ **Retention exceptions** — `CreditTransaction.organization` and `GovernanceAuditLog.organization` switched to `SET_NULL` so tax-law-required billing records and Art. 5(2) accountability evidence survive org deletion with org link nulled |
| ■ **User deletion semantics** — org-only users hard-deleted (Article 17); multi-org users keep account, only membership row severed; LoginEvent records of deleted users preserved with FK nulled |
| ■ **NEN 7513 audit log fields (PR #57)** — `denial_reason` / `failure_reason` on blocked access; `policy_decisions` per-policy array on governance validation; SHA-256 `output_hash` on every delivered output (new `nebelus/agents/output_audit.py`); `model@region` in `CreditTransaction` (control migration 0024); `output.review` audit on human-in-loop approve/edit/reject |
| ■ **Audit content-never-logged contract test** — added to `test-core` gate to guarantee no prompt content, response content, or special-category data ever appears in audit log emissions |

## Customer & DPO Documentation (Jun 10 – Jun 11)

| Item |
|------|
| ■ **EU-Only Processing Attestation** — verified-evidence document covering project region (europe-west4), Vertex AI configmap, Cloud SQL HA + PITR + EU backups, locked 7-year audit bucket, Cloud KMS HSM keyring, GKE Confidential Nodes (AMD SEV), with redacted Cloud Audit Log sample of operator activity |
| ■ **Scope of Certification Statement v2** — corrected (region: europe-west4 not asia-east1; address: I-SH/R 10 Saih Shuaib 2; signer: Haydar not the former CTO); NovaLink B.V. added as contracting party for EEA customers |
| ■ **Statement of Applicability v3** — full Annex A controls with implementation evidence; removed stale references; corrected ISO 9001 versioning; honest disclosure of CRO independence limitations (Control 5.35) |
| ■ **Data Processing Agreement v3** — repositioned as standalone Nebelus global instrument with NovaLink as parallel EEA option; per-tenant IP/geo allow-list contractually committed (§5(e), §8); breach notification 48h standard / 24h for Critical (§10) |
| ■ **Sample Deletion Confirmation Report** — template covering 6-phase lifecycle, hard-cascade table, Cloud Audit Log entry references, retention-exception disclosure for CreditTransaction + GovernanceAuditLog |
| ■ **NEN 7513 Audit Log Sample** — metadata-only structure documenting fields captured (and explicitly excluded), 7 sample event types including blocked-access enforcement and customer-initiated deletion cascade |
| ■ **Procedural Summaries** — breach (Article 33, 48h/24h-Critical SLA), DSAR (Article 15 + 20, 5-business-day SLA), deletion (Article 17, 5-business-day SLA with hard-cascade scope and transparent retention exceptions) |
| ■ **Charlotte 10-question response strategy** — categorized into easy-wins (7), tonight's work (3), and decision-needed (1: external pentest) with Cobalt.io as recommended provider |
| ■ **NovaLink suite review** — verdict on existing DPIA v2.0, Verwerkersovereenkomst Prospektief, Subverwerkersovereenkomst, AI Systeemkaart: leave as-is, EU-DPO-grade |
| ■ **Compliance master reference** — single source of truth for document conventions, NovaLink-vs-Nebelus structural rules, forward-looking version histories, signature defaults |
| ■ **Final 11-document package** assembled for Ulla → Charlotte → ABN AMRO submission |

## Features Shipped (May 22 – Jun 06)

| Item |
|------|
| ■ Settings module flags — Usage / Security / On-Prem Deploy modules with visibility controls (PR #7) |
| ■ Multi-provider reasoning capability registry — per-model capability flags, fixes Opus 4.8 handling (PR #25) |
| ■ 1-hour prompt-cache TTL for all Anthropic agents — cuts cold sub-agent latency (PR #27) |
| ■ Module-visibility frontend — hide Usage/Security/On-Prem sidebar tabs when `is_visible=false` (portal PR #10) |
| ■ Settings gating — Teams, API Keys, Billing, Integrations gated by module visibility across all menus (portal PR #14, #15) |
| ■ Provider filter in agent builder — model picker filtered by org's allowed providers (portal PR #23) |
| ■ Change-password section in profile settings (BE PR #7 flags + portal PR #9) |
| ■ `.md` uploads allowed in agent knowledge manager (portal PR #18) |
| ■ Allow Expanded Chat — widget expand button (portal PR #20) |
| ■ Audio tools popover — single-click + restore `/` slash-command popup in chat (portal PR #21) |

## CI/CD & Engineering Process (May 21 – Jun 11)

| Item |
|------|
| ■ Prod-deploy gate — `deploy-prod.yml` (`deploy-app`) gates on ruff lint + Trivy container scan before build/push/GKE deploy (PR #2, #4) |
| ■ `test-core.yml` — first real pytest-in-CI gate; checks missing migrations, applies them, runs core auth/IP/module/streaming tests on every PR |
| ■ `login-audit-drift.yml` — fails CI if a new auth path calls `login()` without going through `capture_login_event` (drift guard) |
| ■ Agents-deployment restart on prod deploy — workers pick up new image, not just the web tier (PR #24) |
| ■ Portal production deploy workflow — Cloud Build + BuildKit, submitted async with status polling, versioned image tags (portal PR #11, #13) |
| ■ Portal CI runner bump — moved lint/test runners off retired `ubuntu-20.04` image (portal PR #24) |
| ■ Migration discipline — filed playbook + pipeline-check issues so post-deploy `migrate` is never skipped (issues #43, #44 — **closed Jun 15**, see below) |
| ■ **test-core allow-list extended (Jun 11)** — `test_org_deletion.py` (9 cases) + 3 new audit-log test files added to explicit allow-list so PR #57 / #60 don't silently exit the gate |

## Security & Compliance Audit (May 21 – Jun 11)

| Item |
|------|
| ■ P0 security hardening — Cloud SQL client certs purged, hardcoded secrets removed, CI gates added (PR #1, #5, #6) |
| ■ `langchain` / `langchain-anthropic` / `litellm` now pinned (1.1.0 / 1.2.0 / 1.80.5) — prompt-cache patch no longer silently breakable |
| ■ Explicit serializer fields — replaced `fields="__all__"` allow-leak sites; relocated root-level test scripts into the suite (PR #9) |
| ■ Portal `innerHTML` sanitized with DOMPurify + portal root cleanup (portal PR #17) |
| ■ Portal SECURITY_NOTES.md — Google client-secret + CSP findings documented (portal PR #8) |
| ■ Configmap GCP-credential exposure remediated — credentials stripped from code defaults, rotated upstream (PR #53) |
| ■ **GDPR Article 17 gap closed** — deletion cascade verified to actually run end-to-end with per-step audit (PR #60) |
| ■ **NEN 7513 audit logging completeness** — all customer-facing claims verified true in code (PR #57) |

## Two-Day LLM EU-Residency & New-Tenant Sprint (Jun 12 – Jun 13)

| Item |
|------|
| ■ **PR #67 (server) — Per-org region priority override** — `Organization.allowed_regions` + `region_priority` enforced at model dispatch (`get_model_id` reads org region tags first); migration `core.0007` |
| ■ **PR #68 (server) — Vertex AI registry sync job** — recurring task reconciles `ModelDeployment` entries with what Google Vertex actually publishes; surfaces deprecations early |
| ■ **PR #70 (server) — Gemini chat routes via Vertex EU** — control migration `0028`; `region=europe-west4` now appears in every `CreditTransaction` for Gemini paths (verified post-deploy) |
| ■ **Portal PR #30 — Blue Purple default theme** — refreshed default portfolio theme |
| ■ **NovaLink LLM migration (20 agents)** — every active NovaLink agent moved off direct-API providers onto Vertex EU residency; Opus 4.6 / 4.5 / Sonnet 4.5/4.6 / Haiku 4.5 via `vertex_ai` in `europe-west1`; Gemini paths via `vertex_ai` in `europe-west4` |
| ■ **CR Health LLM migration (10 agents)** — same migration applied; 13 active agents end-state (after dedup) all on Vertex EU |
| ■ **9 Anthropic Vertex marketplace agreements completed** — haiku-4-5, opus-4-5, opus-4-6, opus-4-7, opus-4-8, sonnet-4-5, sonnet-4-6, plus 2 region-replicas |
| ■ **8 Vertex quota requests submitted** — `online_prediction_input_tokens_per_minute_per_base_model` raised for opus-4-7 and opus-4-8 in `europe-west1` |
| ■ **Anthropic Fable disabled by Anthropic** — legal/access block applied platform-wide by Anthropic; Fable entries marked unavailable in `ModelDeployment` |
| ■ **Discovery: Vertex Anthropic 4.6 only in `europe-west1`** — `locations/eu` multi-region does NOT work for Anthropic 4.6 on the Nebelus project, only `europe-west1`. Gemini stays on `europe-west4`. **Opus 4.7/4.8 use EU multi-region `aiplatform.eu.rep.googleapis.com` endpoint** (`.rep.` partner-models pattern) |
| ■ **CR Health cleanup — 6 duplicate agents hard-deleted** — `Agent._base_manager` cascade removed: 4 endpoint assignments, 70 Files, 70 FileAgentAccess, 98 Messages, 47 Runs, 46 Threads |
| ■ **CR Health DB dedup — 14 byte-identical rows** removed from `vector_stores` table via `ctid` ROW_NUMBER (no UNIQUE constraint on `id`) |
| ■ **CR Health VS consolidation** — Bezwaar repointed from 5 private clones to 5 shared mains; 6 orphan / clone VS deleted; WAJONG renamed to canonical via direct SQL |
| ■ **Prospectief tenant provisioned end-to-end** — Clementine theme + Novalink logo embedded in 3 user portfolios; org-level logo copied to dedicated GCS path; 14 VS cloned from NovaLink; 20 agents cloned with vs_map applied |
| ■ **SV Land tenant provisioned end-to-end** — Sunlit Citrus theme + sv_land_logo.png embedded in 5 user portfolios; 5 VS cloned from NovaLink; 2 agents cloned |
| ■ **`Organization.allowed_regions = ['eu']`** set on both new tenants from creation |
| ■ **`ModelDeployment` full registry health probe (Jun 13)** — all 70 entries across 15 providers tested with minimal `litellm.completion`; 33 PASS, 14 auto-disabled, 20 logged-only; registry state changed from 66 available / 4 unavailable → 52 available / 18 unavailable |

## Two-Day Per-Org Retention + LHM Workflow Sprint (Jun 14 – Jun 15)

| Item |
|------|
| ■ **PR #71 (server) — Per-org data retention policy** — new models `OrganizationDataRetentionPolicy` + `DataRetentionPurgeAudit` in core app; Celery beat task daily 03:00 Europe/Amsterdam; 6 categories (threads / runs / chat_files / generated_outputs / caches / webhooks); default OFF for all orgs; `TokenUsage.run` FK changed to SET NULL to preserve usage counts; `DeploymentFile` GCS blobs explicitly cleaned (Django CASCADE leaves blobs orphaned); per-step audit. **Live in production for SV Land and Prospectief contracts.** |
| ■ **PR #71 follow-ups (3 merges)** — (1) `CheckConstraint.check` → `condition` rename for Django 6.0 deprecation cleanup; (2) `DeploymentAnalytics` (PII: IPs, user_agents) included in retention purge via category rename `webhooks → event_logs` (control migration 0009); (3) Migration discipline closed (#43 / #44) — `migrate --noinput` now runs as a pre-rollout step in deploy pipeline + `makemigrations --check --dry-run` runs on every PR. End of "deploy then forget to migrate" footgun |
| ■ **PR #32 (portal) + PR #75 (server) — Inline-node file attach fix** — root cause was Vue `NodeEditorModal` watching the source node with `deep: true` while editing a detached clone buffer; any incidental source mutation rebuilt the buffer from uncommitted source, wiping just-attached files. Fix: key re-init watch on (open-state, node id), not deep content. Server side adds a WARNING log when a node's `config.files` id doesn't resolve via `VectorServiceClient`. The investigation revealed a critical architectural fact (see Architecture Findings below) |
| ■ **PR #76 (server) + PR #33 (portal) — HTML file support** — HTML was already ~80% supported (server had `WEB_EXTENSIONS`, BeautifulSoup extractor, generic chunker; portal had html in canonical vectorstore types). Closed the gaps: portal KnowledgeManager.vue accept attribute extended to `.html/.htm`, `.htm` added to SUPPORTED_EXTENSIONS, HTML file-type icon added; server-side extraction swapped to `trafilatura` (structure-aware) with BeautifulSoup fallback |
| ■ **PR #77 (server) + PR #79 hotfix — Sandbox template→PDF renderer** — new `nebelus.sandbox.render` module with `docx_to_pdf` (LibreOffice `soffice` headless) and `html_to_pdf` (WeasyPrint, pure-Python, offline). Sandbox image (`Dockerfile.sandbox`) rebuilt with LibreOffice + WeasyPrint deps + DejaVu/Liberation fonts; total 1.71GB (~440MB delta). Render-only resource envelope: default sandbox 3s/256MB unchanged for DoS protection, code referencing the renderers gets 60s/512MB. WeasyPrint chosen over Playwright (~450MB lighter, already a dep, fits sandbox `network_mode=none`). **PR #79 hotfix** caught a P0 bug before any customer impact: `PythonAstREPLTool.__init__` assigned three undeclared pydantic fields, causing `ValueError` on instantiation. Fixed by declaring them as proper pydantic fields; instantiation tests added to close the gap |
| ■ **LHM Bloedwaarderapport workflow operational end-to-end** — workflow agent (`anthropic/claude-opus-4-8`) in LHM org turns a base lab-results PDF into a patient-friendly Dutch PDF report. Graph: `__start__ → interpreter_agent → report_builder_agent → __end__` + `workflow_state` node. Interpreter reads PDF, captures all 5 results verbatim, computes status + range-bar geometry, writes state. Report builder stages the .docx template, fills patient table + summary + per-analyte blocks, converts to PDF via LibreOffice. **Verified live with real demo lab PDF: 59,106-byte PDF output with template logo + styling preserved.** POC for Cheyenne Seerden at LHM Diagnostiek |
| ■ **Workflow Agent Building Runbook (830 lines)** — comprehensive markdown reference for building workflow agents (Rio-style multi-agent) via Django shell: probe-first approach, full DRY RUN → APPLY → verify → publish sequence, surgical edit patterns (model swap, system prompt, VS, tools, add/remove node), 13 production-tested pitfalls each linked to the PR that fixed it, cloning workflow into another org pattern, cheat sheet one-liners |
| ■ **New tenants Laura + Ranstad provisioned** — both orgs provisioned end-to-end with RIV Check + Casemanager agent cloned from NovaLink. Same 6-VS bundle (Triage Knowledge Base, Triage Supporting Documents, Triage Non-medical, Basisinformatie CBBS, Occupational Assessment Function Descriptions, Example Reports) cloned to each org. Additional VS "Triage Medical Agent - Examples" cloned to DDF + Laura + Ranstad |
| ■ **Issue #78 — Post-merge runbook for LHM rollout** — 10-step checklist (deploy B, smoke-test HTML upload, deploy C, sandbox image rebuild + size verification, render smoke test, LHM E2E with real lab-results PDF, migrate LHM template docx → HTML). Steps 1-9 complete; step 10 (HTML template migration) deferred to next session |

## Four-Day CL Cleanup Sprint Arc (Jun 18 – Jun 21) — NEW

The ~6-week production-hardening arc landed in this 4-day window. Eleven sequential cleanup sprints (CL-6 through CL-11) cleared the substantive P0/P1 backlog: comprehensive RBAC enforcement, native multi-currency ledger, cross-tenant data isolation, unit-billing correctness, and a complete customer-provisioning toolkit.

### CL-6 — Bugfixes + Usage Split (Jun 18)

| Item |
|------|
| ■ **server PR #130 + portal PR #55** — 5 bugfixes + Usage page split. **Branding + Custom Domain Django admin gating** fixed: Module rows seeded with proper visibility/activation. **Org Admin Members & Teams unification**: folded Teams into Org Admin Members & Teams sub-tab; fixed `users_access` typo; manager objects vs UUIDs. **Custom Domain duplicate-domain validation**: partial unique constraint + clean 400 on duplicates. **Transaction History display**: backend cleanup of raw → margined cost leak; FE strips legacy rows. **Spend Limit agent dropdown empty**: backend endpoint + FE rendering fix. **Usage Consumption + Units split**: `/api/credits/usage-units/` endpoint; sub-tabs gated by module perm |
| ■ **server PR #131 + portal PR #56 — Deploy CIDR cap fix** — GKE master-authorized-networks overwrite-not-accumulate via secret. Prevents drift from accumulating runner IPs over time |

### CL-7 — Multi-Currency Billing Arc (Jun 19) — Three sub-PRs

| Item |
|------|
| ■ **CL-7a — server PR #132 — Consumption margin override** — per-org `billing_engine_unified` graduated; default margin 1.2x (20%); RIV Check plan override at 1.5x (50%). Per-plan margin override mechanism in `BillingPlan.margin_with_keys` |
| ■ **CL-7b — server PR #133 + portal PR #57 — Native multi-currency ledger** — approved-currency whitelist (USD/EUR/SAR); single-currency-per-org policy; `credit_type` IS the currency code; FX-at-snapshot via `seed_fx_rate` table; decimal precision widened to 18 digits (from 10) for high-value transactions like €54K SV Land deposit; per-currency CreditBalance pools |
| ■ **CL-7c — server PR #134 — Per-run dedup** — `run_id` plumbed into `RunnableConfig.configurable`; prevents silent drops of legitimate distinct events in same thread. Critical for SV Land high-volume scan use case (multiple Casemanager threads per Rep per day). Per-run UnitConsumption rows now keyed on distinct `run_id` instead of being silently collapsed |

### CL-8 — RBAC, Permissions & Module Visibility (Jun 20)

| Item |
|------|
| ■ **server PR #136 — Always-on gates for ungated endpoints** — multiple HIGH-severity security defects closed. Previously ungated endpoints now gated:<br/>• Payment methods (Admin-only)<br/>• Audit content (Manager+Admin)<br/>• Governance policy CRUD (gate moved to correct viewset; Admin-only)<br/>• Member invite (Manager+Admin)<br/>• Playbook management (Manager+Admin)<br/>• CustomAPIEndpoint CRUD (Admin-only)<br/>• Credit purchase + auto-recharge (Admin-only).<br/>**All always-on (no flag-gating) — closes defects on every org immediately.** |
| ■ **server PR #136 + portal PR #58 — 14 module.\*.view permission codes seeded** — sidebar gating becomes permission-driven (not role-name); `usePermission.js` JSDoc fixed (was incorrectly marked as stub); orphaned Roles & Permissions dead component removed; `core/0029_seed_cl8_permissions` migration ships role templates |

### CL-9 — Unit Billing Correctness + Ops Polish (Jun 21)

| Item |
|------|
| ■ **server PR #138 — CL-9 Defect 1 (P0): Unit-billed plans charging consumption (double billing)** — root cause: no "unit-only" concept existed; `track_usage` charged LLM consumption regardless of plan. Fix: added `BillingPlan.consumption_billing_enabled` flag (control/0050); `track_usage` resolves agent's plan and records zero-charge usage rows for unit-only plans (per-customer decision to keep LLM usage visible in Transaction History for analytics, no double-deduction). Customers' Casemanager + B&B unit plans correctly flagged unit-only (control/0051) |
| ■ **server PR #138 — CL-9 Defect 2 (P0): `report_unit` tool fires 0 UnitConsumption rows** — root cause: `_mk_cfg` returned flat caller config unwrapped, so the trigger/Celery path never landed `org_id` in `configurable` → the tool no-op'd (streaming worked). Fixed at single point. Also lands CL-7c's `run_id` on the trigger path. **The customer's "report_unit TriggerRule" is inert — `report_unit` is a direct tool, not a dispatch event.** Customers' agent SI updated to call `report_unit(unit_code="nl_bb_scan")` with the unit_code argument |
| ■ **server PR #138 + portal PR #59 — Custom Domain UX** — DELETE endpoint added; Reset button on portal; differentiated error UX (DNS not configured vs domain already in use vs server error). Improves customer-onboarding correction loop |
| ■ **server PR #138 — Operational tooling (6 management commands)** — complete customer-provisioning toolkit:<br/>• `apply_default_flags --org <id>` — applies baseline RBAC + feature flags (16 flags)<br/>• `audit_org_capabilities --org <id>` — reports Module Option ↔ FeatureFlag alignment<br/>• `audit_rbac_flags --all-orgs` — reports RBAC enforcement state across all orgs<br/>• `set_org_currency --org <id> --currency EUR` — non-empty-balance safety guard<br/>• `seed_fx_rate --quote EUR --rate 0.90` — FX conversion rate seeding<br/>• `grant_credits --org <id> --amount 54000 --currency EUR --reason "wire <date>"` — audited credit grant for wire-deposit funding |

### CL-10 — Final RBAC Hardening + Display Polish (Jun 21)

| Item |
|------|
| ■ **server PR #139 — CL-10 A1 (P0): `CreditViewSetMixin` open `permission_classes`** — Mixin default tightened from `[IsAuthenticated]` to `[IsAuthenticated, IsOrganizationMember, HasOrgPermission]`. Protects ~7+ inheriting viewsets. Usage endpoints auto-scope to caller via Option A (no `?user_id=` parameter required from FE); cross-user `?user_id=` override requires `usage.read_org` (Manager+Admin); Unit usage endpoints Manager+Admin only. Closes "Rep URL-hack to `/billing-usage/billing` could see all org users' data" |
| ■ **server PR #139 + portal PR #60 — CL-10 A2: Agent config disclosure via name-link** — new `agent.read_config` permission (Admin+Manager only; Rep blocked). `AgentSerializer.to_representation` suppresses system_message, needed_tools, pattern_config, model_config, etc. for users without it — covers list AND detail in one place. Rep can still chat with agents (basic metadata visible); cannot see configuration |
| ■ **server PR #139 — CL-10 A4 (CRITICAL): `AgentCostCalculatorViewSet` cross-ORG leak** — worse than briefed. Calculator did `Agent.objects.all()` with NO org filter; any authenticated user could read any tenant's agent costs + cross-org "all agents" leaderboard. Scoped to `request.organization` at calculator method level + gate with `usage.read_org`. **Verified: cross-org lookup → 404; same-org lookup → 200; all-agents → caller's org only** |
| ■ **server PR #139 — C-backend additions for portal currency** — chat cost SSE payload now carries `currency` + `unit_billed` indicator; `UnitConsumption` exposes `credit_transaction_id`. Eliminates FE inference hacks and need for FE to read `provider_cost_usd` (it never did, just lacked currency context) |
| ■ **portal PR #60 — Sidebar gates every restricted module** — Rep correctly sees AI Studio + AI Chat + Usage Consumption only (was: full sidebar minus a few items). Settings menu Branding/Custom-Domain/On-Premise gated. Manager keeps appropriate visibility. **Critical insight from validation:** sidebar gating must use same `canAccess()` logic as route guards |
| ■ **portal PR #60 — Customer-facing currency in AI Chat + Transaction History** — "Unit billed" label for zero-cost runs (was: `$0.00e+0`); duplicate unit row removed from Transaction History (was: ledger row in €9.50 + duplicate row in $9.50); transaction history uses row currency consistently |

### CL-11 — Final UX Consistency + Dashboard Currency Sweep (Jun 21 — IN FLIGHT)

| Item |
|------|
| ■ **Three-layer gating model formalized** — `canAccess(routePath)` resolver consolidates two existing FE-side hardcoded maps (`MainContainer.MODULE_PERMS` + `useSettingsNavigation.required_permission`) into single source of truth. Path → permission codes map; longest-prefix cascade; `canAny` semantics; fail-open during cold permission load |
| ■ **Route guards** — `router.beforeEach` permission check; denied paths redirect to existing `PermissionRequiredPage` at `/denied-access` (no new page created per investigation finding) |
| ■ **Settings menu sweep** — Integrations entry gated by existing `module.integrations.view` perm (no new code added — verified per investigation premise). On-Premise stays under `module.org_admin.view`; Themes + Security stay open (per-user / appearance concerns); Branding/Custom Domain gates from CL-10 confirmed |
| ■ **Agent name click** — gated on `agent.read_config`; consistent with Edit button gating. Visually disabled when user lacks perm; redirects to `/denied-access` on direct URL navigation |
| ■ **Dashboard currency sweep** — UsageMonitoring + CreditBalance dashboards switched from hardcoded `$` to org-currency fallback (`store.state.organization.currency`). Per investigation: UsageUnits.vue + BillingOverview.vue already correctly use `localMoney`/`approxLocal`; CreditPurchase + CreditDetailedTable intentionally keep $ (sales currency / provider analytics) |
| ■ **Tiny server PR — `audit_org_capabilities` extension** — flags Module reference_codes that lack matching registry `module.*.view` codes (operational tool for customer-rollout campaign Part G) |

### CL-11 Investigation premise corrections (Jun 21)

| Item |
|------|
| ■ **No new permission codes needed** — `role.manage`, `agent.read_config`, all 14 `module.*.view` codes (including `module.integrations.view`) already exist and are assigned correctly. Granular sub-tab codes (billing.overview/payment_methods/spend_limits) intentionally NOT added to avoid registry bloat + role template churn; sub-tabs sit under one top-level code + action-level perms already gate data |
| ■ **`PermissionRequiredPage` already exists** at `/denied-access` route — reuse it, don't create a new one |
| ■ **Portal never reads `provider_cost_usd`** — original brief assumed FE inference bugs; investigation confirmed `cost.cost` is already the customer charge (`abs(transaction.amount)`). The only gap is missing `currency` field on the SSE payload, which CL-10 C-backend already provides |
| ■ **`canAccess()` lives FE-side** — route paths are FE-shaped data (URL strings the FE router renders); backend doesn't know about them. Putting the map server-side would create inverted dependency + sync burden over time |

## White-Label Completion Initiative (Jun 22–23 — COMPLETE)

Closes the white-label gap end-to-end: branded transactional emails, per-tenant
sender domains, pre-auth page branding on custom domains, partner-cascade branding
inheritance, and the Caddy edge that makes customer custom domains actually serve.
Shipped as 5 feature PRs (server #148/#149/#150/#151/#153 + portal #65/#67) plus a
2-PR defensive cleanup (server #152 + portal #66). All CI-green and merged. Each PR
was investigation-first; the premise corrections caught along the way are recorded
per-section below.

### WL-1 — Email Branding Completeness Sweep (Jun 22)

| Item |
|------|
| ■ **server PR #148 — branding now fires on transactional emails** — `_branding_email_context` extended with `brand_support_email` (Organization.support_email), `brand_button_bg` (custom_design.button_color), `brand_accent_color`, `brand_portal_title`; `email_base.html` footer support-email + link colour + document title variabilized (Nebelus defaults preserved); hardcoded "Los Angeles, CA" footer line dropped |
| ■ **Latent prod bug fixed (guest invites silently dropped)** — `send_templated_mail` async branch did `context['organization'].id` with no type guard; guest/workspace/share invite call sites passed a bare str id → `AttributeError` swallowed by callers' `try/except` → those emails never sent. Coercion now accepts instance-or-str (warns with stack so missed sites are greppable) and the three sites pass the Organization instance |
| ■ **Call-site sweep** — `PasswordResetForm` derives + passes the user's org; `# TODO` left at the two genuinely org-less paths (raw welcome email at user creation, pre-auth email_verification). New `send_branded_mail()` wrapper (org required positional) added for future call sites |
| ■ **Admin QA aid** — `preview_email_branding` action renders `user_invitation` with an org's configured branding to an HTML response (flag-independent), to be used as the QA tool for the per-child-template colour sweep follow-up |
| ■ **`scripts/test.sh`** — local pytest with CI-equivalent env (wraps the test-core.yml env around `uv run pytest`, passes through args) |

### WL-1 Investigation premise corrections (Jun 22)

| Item |
|------|
| ■ **Spec premise "only credit_notifications passes organization" was stale** — ~9 sites already passed it (billing_alerts ×4, credit_notifications, send_join_request, admin invite, accept-invite, team-member invite). Real remaining work was just password_reset + the 3 guest sites |
| ■ **`control/tasks.py` send is `notify_nebelus_admins`** (internal-to-Nebelus), not the "monthly invoice" the spec described → no branding, skipped. `control/models.py` Feedback notification is likewise internal → skipped |
| ■ **`core/tasks.py` async forwarder needs no change** — it already carries `organization` through context to the worker, which re-injects branding |

### WL-3a — Public branding-by-host endpoint (Jun 22, server #149)

| Item |
|------|
| ■ **Unauthenticated `GET /api/public/branding/?host=`** — resolves a hostname → verified/active `OrganizationCustomDomain` → org → branding; returns ONLY public fields (logo, favicon, primary/accent colour, portal title, custom_design when published). 404 for the default host / unverified / flag-off → portal renders Nebelus defaults; 60s `Cache-Control`. AllowAny, mirrors the existing `CustomDomainTLSAllowedView` pattern |
| ■ **Decision — gate both visibility axes on `global`** (stricter than spec, which only gated custom_design): an anonymous visitor never sees a private/in-progress brand on a public login page. Mirrors the portal's `brandingAppliesForUser` with no user |

### WL-3b — Pre-auth page branding (Jun 22, portal #65)

| Item |
|------|
| ■ **Pre-auth pages brand by host** — at boot, a no-active-org visitor on a non-localhost host fetches `/api/public/branding/` (raw fetch, like the shared-thread endpoint) and applies logo/colours/favicon/title. Anti-flash via a **host-keyed localStorage cache** applied synchronously (no SSR — pure Vite SPA) |
| ■ **`Login.vue` hardcoded "Nebelus"** (not `LogoText`) — fixed; the other pre-auth pages already consumed `LogoText`. No FE known-default-hosts list — the server is authoritative (default host 404s) |

### WL-4 — Partner cascade (Jun 22, server #150)

| Item |
|------|
| ■ **`Partner.root_organization` FK** (control/0054) + `resolve_branding_settings(org)` waterfall: own → `partner.root_organization` → Nebelus default. Partner-sold customer orgs inherit the partner's branding automatically. Wired into both the email context and the public endpoint; INFO log when a partner brand is inherited |
| ■ **Decision — email keeps PR1 own-rule (no visibility gate)** so direct customers are strictly unchanged; the `visibility=global` gate applies to the partner step (both surfaces) and to own branding only on the public endpoint. A partner's PRIVATE branding is never inherited (tested: email → {}, public → 404) |

### WL-2 — Per-tenant sender domain (Jun 22, server #151)

| Item |
|------|
| ■ **Premium per-tenant Mailgun sender** — orgs send from their own verified domain (`invites@customer.com`). 5 new `OrganizationBrandingSettings` fields (core/0033) + `email_domain_service.py` (Mailgun v4 create/verify/delete) + admin-only `/api/branding/email-domain/` (set/verify/delete), 404-invisible behind `email_sender_domain_enabled` (default OFF). `send_templated_mail` sends from the verified address; set-but-unverified warns + falls back |
| ■ **Decision — server gate = flag + `IsOrganizationAdmin`** (matches the existing branding/custom-domain views), not the spec's `module.*.view`; the module/permission codes are seeded for the portal nav (no server consumer yet). Branched after #150 so `control/0055` follows `0054` cleanly |

### WL-5 — Custom domain end-to-end edge (Jun 23, server #153 + portal #67)

| Item |
|------|
| ■ **Caddy on-demand TLS → portal** (`Caddyfile.prod`) — the catch-all now reverse-proxies custom domains to `nebelus-portal-service.default` (was Django/app-service), and the `on_demand_tls` ask points at `https://api.nebelus.ai/api/edge/tls-allowed/`. A customer visiting `https://app.customer.com/login` now gets the branded portal with an auto-provisioned Let's Encrypt cert |
| ■ **Portal DNS UX** — Custom Domain page shows the full record set (TXT to verify, then the A record → edge IP from the new `dns_target`/`dns_records_needed` serializer fields) with copy buttons + status-driven guidance (pending → verified+ssl → active). Edge IP from `NEBELUS_EDGE_IP`, never hardcoded in the portal |

### WL-5 Investigation premise corrections (Jun 23)

| Item |
|------|
| ■ **on_demand_tls + the catch-all already existed** in `Caddyfile.prod` (P3-D, #115) but were NEVER DEPLOYED — the `caddy-prod` workflow is `.disabled` and the running image predates P3-D. The Caddyfile is **baked into the `nebelus_caddy` image** (not a ConfigMap), so the edge change ships only via a manual image rebuild + `caddy-deployment` rollout |
| ■ **Two real bugs in the un-deployed config** — the catch-all routed to **Django**, not the portal (so a customer login page would hit the API); and the `ask` URL (`http://app-service…/api/edge/tls-allowed`, no trailing slash) returned Django `APPEND_SLASH` 301 / `ALLOWED_HOSTS` 400 — non-2xx, which silently blocks cert issuance. Both fixed |

### WL-Cleanup — Defensive fixes + filed backlog (Jun 22, server #152 + portal #66)

| Item |
|------|
| ■ **DDF P0 — empty attachment-only message** — `Message.as_langchain_message` returned an empty `HumanMessage` for attachment-only sends (content='' + files in metadata) → Anthropic 400 on every later turn (20 messages live-patched across 7 orgs on Jun 22). Now synthesises `[User uploaded files for analysis: …]`. FE companion: `has_files` was read from the cleared `selected_files` queue (lied); now counts `uploaded_file_metadata`, and empty-textarea sends get placeholder text |
| ■ **Backlog drained** — partner sender-domain inheritance (own→partner→default); host-aware password-reset branding (brand by request host, not arbitrary first-org); public-branding `Cache-Control` was stripped by the `AddNoCacheControlCacheHeader` middleware → added an `X-Allow-Public-Cache` opt-out marker; pre-auth Tailwind buttons now consume `--brand-*` CSS vars |
| ■ **Premise correction — host-branding colour clobber** — the portal host flow called `applyBranding` then `applyCustomDesign(null)`, each clearing the other's `--brand-*` var, so pre-auth brand colours never survived; `applyHostBranding()` now folds top-level + custom_design colours into one palette applied last |

## Architecture Findings (Jun 14 – Jun 21)

| Item |
|------|
| ■ **Two file id-spaces in Nebelus** (critical architectural fact, easily conflated): (1) Django `agents.File` — chat-upload subsystem only, has `scope/thread/FileAgentAccess` and a post_save grant; (2) vector-api service files — agent-file / node-attached subsystem, no scope/thread concept, separate Postgres + Qdrant. `Agent.files` and `pattern_config.nodes[].config.files` hold vector-api ids. The two stores can hold files with the SAME filename but DIFFERENT ids. Runtime (`stage_file_to_sandbox` / `load_agent_file` / `dataframe_query`) goes through `VectorServiceClient` exclusively, NEVER touches `agents.File`. Resolver is `GET /v1/files/{id}?org_id=...`, not `File.objects.get(id=...)` |
| ■ **`pattern_config` is canonical for runtime; `Agent.workflow` is editor-only state.** Workflow agents store the same node graph in both `Agent.pattern_config` (read at runtime) and `Agent.workflow` (read by the portal node editor). Both reference the same nodes today, but they are separate JSONFields — any code path that updates one without the other will silently diverge. Filed as follow-up |
| ■ **Sandbox container architecture confirmed** — separate from app image (`Dockerfile.sandbox` at `nebelus/agents/builder/toolkit/tools/platform/Dockerfile.sandbox`); python:3.11-slim base, network_mode=none, 256MB memory cap, 3s per-exec timeout default, non-root, no SYS_ADMIN. Runs as a child of docker-dind. Render module baked in at `/opt/sandbox-libs/nebelus/sandbox/render.py` with `PYTHONPATH=/opt/sandbox-libs` so agent code can `from nebelus.sandbox.render import docx_to_pdf, html_to_pdf` |
| ■ **No automated sandbox image rebuild on Dockerfile.sandbox changes** — historical builds were manual; PR #77 added LibreOffice + WeasyPrint to the Dockerfile but no CI rebuilt the image. Surfaced during post-merge verification, manually triggered Cloud Build (`gcloud builds submit --config=cloudbuild-sandbox.yaml .`). Same fix class as the migration-discipline gap closed by #43/#44 |
| ■ **NEW (Jun 21) — Three-layer gating model formalized** — Layer 1: org-level (Module catalog + OrganizationModuleOption); Layer 2: permission-level (Role.permissions M2M + permission codes; denial cascades down, openness doesn't); Layer 3: route-level (FE `canAccess()` + URL guard). Always-on enforcement applied to security-defect endpoints; per-org opt-in flags only for graduated rollout. See Codebase Analysis §8.13 |
| ■ **NEW (Jun 21) — Multi-currency ledger architecture** — single-currency-per-org as operational policy (schema multi-pool-capable); `Organization.currency` is settlement currency; `BillingPlan.currency` is pricing reference; FX conversion at settlement via `seed_fx_rate` table; `consumption_billing_enabled` plan flag prevents double-charging on unit-only plans. See Codebase Analysis §8.14 |
| ■ **NEW (Jun 21) — Investigation-first PR discipline pays off** — across CL-7 → CL-11, investigation surfaced ~25 premise corrections. Examples:<br/>• CL-7b: credit_type can BE the currency code (single-pool model)<br/>• CL-9: report_unit failure root cause was `_mk_cfg`, not the TriggerRule<br/>• CL-10: AgentCostCalculator was cross-ORG leaking (worse than briefed)<br/>• CL-11: 14 module.*.view codes already exist; `PermissionRequiredPage` already exists.<br/>Each correction would have caused weeks of rework or a wrong fix shipping if discovered post-merge. The discipline pays back its cost on every PR |

## Production Incidents Resolved

| Date | Incident — Resolution |
|------|------------------------|
| 2026-05-24 | Sandbox file lost on pod hop — staged files re-routed through Django cache (PR #11) |
| 2026-05-28 | Messages-channel exponential doubling — doubling stopped across all node returns (PR #19, #20) |
| 2026-06-04 | Opus 4.8 `top_p` rejection — stripped via deprecated-params registry (PR #26) |
| 2026-06-04 | CustomAPIEndpoint save corrupting records — dedup root cause fixed (PR #28) |
| 2026-06-06 | Widget chat 500 — `x_forwarded_for` NameError defined + guarded (PR #45) |
| 2026-06-06 | Module-gate streaming crash (P0) — async factory calls wrapped in `sync_to_async` (PR #46) |
| 2026-06-06 | Real client IP lost after L7 cutover — Caddy XFF preservation + pod-CIDR trust ranges (PR #34) |
| 2026-06-10 | Vertex AI region routing + residual Opus 4.8 `top_p` — EU fallback hardened (PR #51) |
| 2026-06-11 | alert-mailer 401 on EU Eventarc — `run.invoker` IAM bindings re-granted |
| 2026-06-11 | Logo URLs broken site-wide after US bucket deletion — 145+ refs repointed to `nebelus-public-nl` (PR #28 portal, PR #61 server) |
| 2026-06-12 | NovaLink + CR Health LLMs still on direct providers — 30 agents migrated to Vertex EU |
| 2026-06-13 | Self-inflicted access-policy lockout — multi-org operator + NL-only enforce blocked global login |
| 2026-06-15 | **Inline-node file-attach drop on workflow agents** — Vue NodeEditorModal deep-watch clobber on detached buffer; caught and fixed before customer impact (PR #32 portal, PR #75 server) |
| 2026-06-15 | **PR #77 sandbox renderer P0 instantiation bug** — `PythonAstREPLTool` assigned three undeclared pydantic fields causing ValueError on every instantiation; caught during post-merge smoke test before any traffic hit it; hotfixed within ~30min as PR #79 with unmocked-instantiation tests added |
| 2026-06-20 | **CL-9 unit-billed agents double-charging consumption** — Casemanager + B&B plans were configured for unit billing but also charging LLM consumption (double-deduct). Added `consumption_billing_enabled` flag (default True for backward-compat); flagged customer's unit plans as False. Verified via E2E test: 5 Casemanager runs → 1 unit charge €9.50 + 0 consumption deductions ✓ |
| 2026-06-20 | **CL-9 report_unit tool firing 0 UnitConsumption rows** — `_mk_cfg` unwrap bug meant `org_id` never landed in `configurable`; tool no-op'd silently. Fixed; verified via E2E: 2 B&B Clone scans in distinct threads → 2 UnitConsumption rows at €90 each ✓ |
| 2026-06-21 | **CL-10 cross-user data leak on `/billing-usage/billing`** — Rep URL-hack could see all org users' usage including admin's. Root cause: `CreditViewSetMixin.permission_classes = [IsAuthenticated]` only. Tightened to full enforcement chain + Option A query auto-scoping; cross-user override requires `usage.read_org` ✓ |
| 2026-06-21 | **CL-10 cross-ORG leak in AgentCostCalculator** — any authenticated user could read any tenant's agent costs + cross-org leaderboard. Fixed at calculator method level + viewset gate; verified 404 cross-org / 200 same-org ✓ |
| 2026-06-21 | **CL-10 agent config disclosure via name-link** — Rep could click agent name and see full system instructions, tools, model. Suppressed via `agent.read_config` perm + `AgentSerializer.to_representation` field stripping ✓ |

## Documentation & Process

| Item |
|------|
| ■ Edge runbooks — L7 GCLB cutover/rollback (`kube/production/edge/RUNBOOK.md`) + H1–H5 investigation README (PR #33) |
| ■ 7-year audit log-sink runbook — Cloud Logging retention for `nebelus.audit` (PR #36) |
| ■ server/CLAUDE.md expanded — audit-logging, IP allow-list, edge architecture, configmap-vs-defaults sections |
| ■ Engineering Summary 2026-04-to-06 v4 (this document) — adds Jun 14-15 sprint |
| ■ Engineering Summary v5 (this revision) — adds Jun 18-21 CL-6 → CL-11 cleanup sprint arc |
| ■ **Workflow Agent Building Runbook (Jun 15)** — 830-line markdown reference for building workflow agents via Django shell with probe-first approach and 13 production-tested pitfalls |
| ■ **Codebase Analysis v4 → v5 (Jun 21)** — adds CL-6 → CL-11 work; §8 expanded with five new subsections: §8.13 RBAC three-layer gating model, §8.14 Multi-currency ledger architecture, §8.15 Customer provisioning toolkit, §8.16 Investigation-first PR discipline, §8.17 Standing PR sequencing convention |
| ■ **Infrastructure.md v1.2 → v1.3 (Jun 21)** — comprehensive RBAC section, multi-currency ledger section, customer provisioning toolkit section; ISO 27001 + 9001 + GDPR certification confirmed; Vertex AI EU multi-region endpoint for Anthropic Opus 4.7/4.8; KSA region (`me-central2`) provisioning detail; decimal precision 18 digits; GKE Master Authorized Networks overwrite-pattern; per-run config plumbing; sandbox image rebuild CI gate |
| ■ Backlog formalized as GitHub issues across server + portal repos |

---

**P0/P1: cleared and held — 0 outstanding from CL cleanup arc.**

GDPR Article 17 deletion cascade and NEN 7513 audit-logging completeness shipped and verified. LLM EU-residency migration complete for active tenants (including Claude 4.7/4.8 on the EU multi-region `aiplatform.eu.rep.googleapis.com` endpoint). Per-org `allowed_regions` enforced at dispatch. `ModelDeployment` registry actively probe-managed. **Per-org configurable data retention live** (PR #71); first contracts pending. **Sandbox PDF rendering operational** for both docx (LibreOffice) and html (WeasyPrint) paths. **First medical-data workflow agent (LHM Bloedwaarderapport) operational end-to-end with template fidelity preserved.**

**CL-6 → CL-11 cleanup sprint arc complete (~6 weeks compressed into 4 days of focused validation + investigation-first PR discipline):**

- ✅ **Native multi-currency ledger** — USD/EUR/SAR whitelist; FX-at-snapshot; per-plan margin override
- ✅ **Comprehensive RBAC enforcement** — always-on gates closing 8+ HIGH-severity defects; per-user query auto-scoping; agent-config field suppression; cross-tenant data isolation verified
- ✅ **Unit-billing correctness** — `consumption_billing_enabled` plan flag prevents double-charging; per-run dedup via `run_id` plumbing
- ✅ **Customer provisioning toolkit** — 6 deterministic management commands (apply_default_flags, audit_org_capabilities, audit_rbac_flags, set_org_currency, seed_fx_rate, grant_credits)
- ✅ **Three-layer gating model formalized** — org-level / permission-level / route-level; consistent cascade semantics; FE `canAccess()` resolver
- ✅ **Customer-facing currency display** — Transaction History + AI Chat + dashboards all render org currency

Open backlog is P2/P3 hygiene plus specific items uncovered in the Jun 14–21 sprints: automate sandbox image rebuild on Dockerfile.sandbox changes (filed); pattern_config ↔ workflow column dual-write hazard (filed); LHM LLM picks wrong file id on every run, self-corrects but wastes a turn (filed); registry-probe operational follow-ups (XAI creds, Azure config, Falcon/Qwen provider mapping, Vertex quota tracking — portal issue #31); custom roles UX (architecture in place, just UX work).

Platform: all systems operational · **6 tenants live** (NovaLink, CR Health, Prospectief, SV Land, Laura, Ranstad) · CI gated on every PR · audit trail + IP/geo allow-list live · EU-only Vertex + Cloud SQL + KMS + storage · GDPR Article 17 end-to-end verified · per-org data retention live · sandbox PDF renderer live · **native multi-currency ledger live · comprehensive RBAC enforcement live · customer provisioning toolkit complete** · ISO 27001 + 9001 + GDPR certified · secrets clean.

**SV Land go-live unblocked pending final CL-11 portal merge + pre-launch validation matrix walkthrough. Production customer rollout campaign cleared to begin.**
