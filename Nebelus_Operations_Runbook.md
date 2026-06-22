# Nebelus Operations Runbook
> **Scope:** the complete operations reference for creating orgs, provisioning customers, configuring RBAC, managing billing, building agents, cloning accounts, and diagnosing common issues — primarily via management commands and Django shell, with Django admin UI alternatives noted where they exist.
>
> **Audience:** Haydar (primary) + future Claude sessions assisting with operational tasks.
>
> **Companion docs:**
> - `Workflow-Agent-Building-Runbook.md` — deep-dive on workflow (multi-agent) agent construction
> - `Codebase_Analysis.md §8` — architectural facts and operational patterns
> - `Infrastructure.md` — infrastructure topology, security, compliance posture
>
> **Last updated:** 2026-06-22 (post SV Land EUR provisioning + T2 WhatsApp webhook loop fix)
> **Maintained by:** Nebelus engineering (Haydar Al-Saad)
---
## Part 0 — Setup & Conventions
### 0.1 kubectl + GCP access
```bash
export PATH="/opt/homebrew/share/google-cloud-sdk/bin:$PATH"
gcloud auth login
gcloud container clusters get-credentials nebelus-production-nl --region europe-west4 --project nebelus
kubectl get pods -n backend --no-headers | head -3
```
If kubectl times out: your IP needs to be added to `master-authorized-networks` via the `GKE_MASTER_AUTHORIZED_BASE_CIDRS` secret (overwrite-not-accumulate pattern). Issue #49 tracks a durable fix (IAP / Tailscale / bastion).
### 0.2 Pod shortcut + Django shell heredoc
The standard pattern used throughout this runbook:
```bash
POD=$(kubectl get pods -n backend -o name | grep app-deployment | head -1 | cut -d/ -f2)
cat <<'PROBE' | kubectl exec -i -n backend $POD -- python manage.py shell
# Python code here — note the quoted heredoc 'PROBE' prevents shell expansion
from nebelus.core.models import Organization
print(Organization.objects.count())
PROBE
```
**Critical detail:** `cat <<'PROBE'` (quoted) prevents the shell from interpreting `$variables` and `\` inside the Python block. Use this every time.

**Two backend deployments to be aware of:**
- `app-deployment` — Django app pods (HTTP, admin, management commands, shell)
- `agents-deployment` — Celery workers processing the `agents` queue (agent invocations, webhook tasks)

When you need to stop in-flight agent work, restart `agents-deployment`. Management shell ops go through `app-deployment`.

### 0.3 Investigation-first principle
Before any change to production, **probe first** to confirm current state. Every operation in this runbook has a probe (read-only) version and an apply version. Always run the probe, eyeball the result, then run the apply.
For multi-step changes (e.g. cascade preview before delete): `from django.contrib.admin.utils import NestedObjects` to see what would cascade.

### 0.4 `_base_manager` for sensitive operations
The `Organization` and `Agent` models use custom managers that filter the default queryset (`OrganizationManager` filters where `owner IS NULL`). For sensitive admin operations (hard delete, bulk update, cascade preview), always go through `_base_manager`:
```python
# ❌ Custom manager may filter rows mid-cascade
Organization.objects.filter(id=oid).delete()
# ✅ Use _base_manager for sensitive operations
Organization._base_manager.filter(id=oid).delete()
Agent._base_manager.filter(id=aid).delete()
File._base_manager.filter(id=fid)
```

### 0.5 Cache invalidation after edits
The platform aggressively caches per-org configuration. After any agent / module / permission edit, clear the cache:
```python
from django.core.cache import cache
cache.delete(f'agents_framework_{ORG_ID}')
```
Per-org cache keys (`agents_framework_{org_id}`) survive pod restarts (Redis-backed). Issue #50 tracks automated invalidation when LiteLLM catalog updates.

Note: `Agent.save()` automatically fires the cache-invalidation signal. Direct Django admin saves on Agent rows usually clear cache; direct ORM saves on other models (BillingPlan, Webhook, etc.) often do NOT and require an explicit `cache.delete()` call.

### 0.6 UUID vs str comparison gotcha
Django UUIDs are `uuid.UUID` objects, not strings. Direct `==` comparison against a string returns `False` even when the values look identical:
```python
plan.organization_id == '81e2293e-ddaa-4c0e-998c-a31e868be18f'  # ❌ False
str(plan.organization_id) == '81e2293e-ddaa-4c0e-998c-a31e868be18f'  # ✓ True
```
The ORM auto-coerces in queries (`filter(organization_id=ID_STR)` works) but Python-level comparison does NOT. Bit us during SV Land provisioning when a safety guard `plan.organization_id != SVL_ID` always returned True and refused the operation. Always `str()` the UUID side when comparing to a literal string.

---
## Part 1 — Finding IDs (Discovery)
### 1.1 Find an organization by name
```bash
POD=$(kubectl get pods -n backend -o name | grep app-deployment | head -1 | cut -d/ -f2)
cat <<'PROBE' | kubectl exec -i -n backend $POD -- python manage.py shell
from nebelus.core.models import Organization
# Fuzzy match
for o in Organization._base_manager.filter(name__icontains='Lochem').order_by('name'):
    print(f'  {o.id} | "{o.name}" | owner={o.owner_id}')
PROBE
```
### 1.2 Find an agent by name (within an org)
```bash
cat <<'PROBE' | kubectl exec -i -n backend $POD -- python manage.py shell
from nebelus.agents.models import Agent
ORG_ID = 'YOUR_ORG_ID'
for a in Agent.objects.filter(organization_id=ORG_ID, name__icontains='Casemanager'):
    vs_count = len(a.vector_stores or [])
    print(f'  {a.id} | "{a.name}" | pattern={a.pattern_type} | vs={vs_count}')
PROBE
```
To list ALL agents in an org:
```python
for a in Agent.objects.filter(organization_id=ORG_ID).order_by('name'):
    print(f'  {a.id} | "{a.name}" | {a.pattern_type}')
```
### 1.3 Find a vector store
```bash
cat <<'PROBE' | kubectl exec -i -n backend $POD -- python manage.py shell
from nebelus.vectorstore.client import VectorServiceClient
ORG_ID = 'YOUR_ORG_ID'
c = VectorServiceClient()
r = c.request('GET', '/v1/vector_stores', params={'org_id': ORG_ID})
if r.status_code == 200:
    data = r.json()
    for vs in data.get('data', data.get('vector_stores', [])):
        print(f'  {vs["id"]} | "{vs.get("name")}"')
PROBE
```
**Note:** vector-api DB is SEPARATE from the main app DB. Use `VectorServiceClient` to read VS metadata authoritatively.
### 1.4 Find a user by email
```python
from nebelus.core.models import User
u = User.objects.filter(email='haydar@nebelus.ai').first()
print(f'  {u.id} | {u.email}')
# Show user's org memberships — related name is `access`, NOT `organization_user_access`
for ua in u.access.all():
    print(f'  org: {ua.organization.name} | role: {ua.role.name if ua.role else "NONE"}')
```
The reverse relation from `User` to `OrganizationUserAccess` is `user.access`. From `Organization` to `OrganizationUserAccess` it's `org.users_access`. Don't confuse the two.

### 1.5 Find a role and its permissions
```python
from nebelus.core.models import Organization
org = Organization.objects.get(id='YOUR_ORG_ID')
for role in org.roles.all().order_by('name'):
    perms = sorted(role.permissions.values_list('codename', flat=True))
    print(f'{role.name} ({role.id}):')
    for p in perms:
        print(f'  - {p}')
```
### 1.6 Find a BillingPlan or BillableUnit
```python
from nebelus.control.models import BillingPlan, BillableUnit, BillableUnitTriggerRule
# Plans
for p in BillingPlan.objects.filter(organization_id='YOUR_ORG_ID', active=True):
    print(f'  Plan {p.id} | "{p.name}" | margin={p.margin_with_keys} | consumption_billing={p.consumption_billing_enabled}')
# Units
for u in BillableUnit.objects.filter(organization_id='YOUR_ORG_ID', active=True):
    print(f'  Unit {u.id} | code={u.code} | cost={u.unit_cost} {u.currency}')
# TriggerRules
for t in BillableUnitTriggerRule.objects.filter(organization_id='YOUR_ORG_ID', active=True):
    agent_name = t.agent.name if t.agent else 'org-wide'
    print(f'  Trigger {t.id} | event={t.event_type} | unit={t.billable_unit.code} | agent={agent_name}')
```

**Note on BillingPlan field names:**
- Margin fields are `margin_with_keys` (with platform keys) and `margin_byok` (BYOK), NOT `markup_rate`. Past versions of this runbook had `markup_rate` — that field doesn't exist on BillingPlan.

---
## Part 2 — New Customer Provisioning (The 8-Step Playbook)
Every customer onboarding follows this deterministic sequence. After step 8 passes, the customer is cleared for usage.

### 2.1 Pre-flight checks
- [ ] Customer org exists in the database (created via Django admin or signup flow)
- [ ] Owner user assigned (Org.owner_id set)
- [ ] Decision: customer currency (USD / EUR / SAR)
- [ ] Decision: initial funding amount + source documentation
- [ ] Decision: which Nebelus agents/VS will be cloned (if any)
- [ ] Decision: is this a **partner-sold** customer? If so, note the partner and confirm the partner's branding is set up (see 2.10) so branding cascades automatically

Verify org exists:
```bash
ORG_ID="<paste-uuid-here>"
POD=$(kubectl get pods -n backend -o name | grep app-deployment | head -1 | cut -d/ -f2)
cat <<PROBE | kubectl exec -i -n backend $POD -- python manage.py shell
from nebelus.core.models import Organization
from nebelus.agents.models import Agent
from nebelus.control.models import CreditBalance
o = Organization._base_manager.get(id='$ORG_ID')
print(f'Name: {o.name}')
print(f'Owner: {o.owner_id}')
print(f'Currency: {o.currency}')
print(f'Allowed regions: {o.allowed_regions}')
print(f'Agents: {Agent.objects.filter(organization=o).count()}')
print('Balances:')
for cb in CreditBalance.objects.filter(organization=o):
    print(f'  {cb.credit_type}: {cb.balance}')
PROBE
```

### 2.2 Apply default RBAC + feature flags
```bash
# Dry-run first (shows what would change)
kubectl exec -i -n backend $POD -- python manage.py apply_default_flags --org $ORG_ID --dry-run
# Apply
kubectl exec -i -n backend $POD -- python manage.py apply_default_flags --org $ORG_ID
```
Applies the `DEFAULT_NEW_ORG_FLAGS` template.

**Post-PR #145 (in flight as of 2026-06-22):** the template includes 20 flags — 9 RBAC enforce + billing + branding + custom domain + module visibility + quota + invoice + multi_currency_ledger + multi_currency_billing + unit_billing_enabled + invoice_generation. Once #145 deploys, this single command provisions a fully working EUR/SAR org.

**Pre-PR #145 workaround:** the template is missing four billing flags that EUR/SAR orgs need (`multi_currency_ledger`, `multi_currency_billing`, `unit_billing_enabled`, `invoice_generation`). Without them, non-USD orgs hit HTTP 402 "insufficient funds" because the credit-debit path falls back to hardcoded USD lookup. Manually add them:
```python
from nebelus.core.models import OrganizationFeatureFlag
for flag in ['multi_currency_ledger', 'multi_currency_billing', 'unit_billing_enabled', 'invoice_generation']:
    OrganizationFeatureFlag.objects.update_or_create(
        organization_id='YOUR_ORG_ID',
        flag=flag,
        defaults={'enabled': True},
    )
```

### 2.3 Set currency (for non-USD orgs)
This is a **two-step** operation. The `set_org_currency` command refuses to flip currency if the org has a non-empty USD balance. You must zero the USD pool first (the org gets a small USD residual from embedding calls during signup).

**Step 2.3a — Zero the legacy USD pool (if non-zero)**

```bash
cat <<'APPLY' | kubectl exec -i -n backend $POD -- python manage.py shell
from nebelus.control.models import CreditBalance, CreditTransaction
from decimal import Decimal
from django.db import transaction

ORG_ID = 'YOUR_ORG_ID'

with transaction.atomic():
    cb = CreditBalance.objects.filter(organization_id=ORG_ID, credit_type='usd').first()
    if cb and cb.balance > 0:
        old_balance = cb.balance
        # Audit transaction
        txn = CreditTransaction.objects.create(
            organization_id=ORG_ID,
            transaction_type='adjustment',
            amount=-old_balance,
            balance_after=Decimal('0'),
            credit_type='usd',
            currency_at_purchase='USD',
            fx_rate_at_purchase=Decimal('1.0'),
            description='Zero out legacy USD pool prior to non-USD currency switch',
        )
        cb.balance = Decimal('0')
        cb.save(update_fields=['balance', 'updated_at'])
        print(f'Zeroed ${old_balance} USD pool. Audit txn: {txn.id}')
    else:
        print('USD pool already zero or absent.')
APPLY
```

**Step 2.3b — Flip the currency**

```bash
# Dry-run
kubectl exec -i -n backend $POD -- python manage.py set_org_currency --org $ORG_ID --currency EUR --dry-run
# Apply
kubectl exec -i -n backend $POD -- python manage.py set_org_currency --org $ORG_ID --currency EUR
```

**Safety guard:** the command refuses if a non-empty CreditBalance exists for the org (hence step 2.3a). Use `--force` to override (rare — would only apply if migrating an existing balance).
Approved currencies: USD, EUR, SAR.

### 2.4 Seed FX rate (for non-USD orgs)
```bash
# Rate is "quote currency per 1 USD"
# Example: 1 USD = 0.92 EUR (live ~0.90 EUR as of 2026-06)
kubectl exec -i -n backend $POD -- python manage.py seed_fx_rate --quote EUR --rate 0.92
kubectl exec -i -n backend $POD -- python manage.py seed_fx_rate --quote SAR --rate 3.75
```
This populates the `CurrencyRate` table. The rate is snapshotted onto each `CreditTransaction` at settlement time, so future rate changes don't affect historical records.

### 2.5 Fund prepaid balance
```bash
kubectl exec -i -n backend $POD -- python manage.py grant_credits \
  --org $ORG_ID \
  --amount 54000 \
  --currency EUR \
  --reason "bank wire 2026-06-22"
```
- `--currency` defaults to org's currency (set in step 2.3)
- `--reason` lands in the CreditTransaction audit trail
- Creates a positive-balance entry in `CreditBalance(org, credit_type=eur)`

**⚠️ KNOWN BUG: `--dry-run` flag is NOT honored.** The command accepts the flag but still executes. Caused a duplicate €54k grant during SV Land EUR provisioning. PR pending to fix. For now: **do NOT use `--dry-run`** with `grant_credits`. Verify the org/amount/currency manually before running, and if you make a mistake, reverse with a direct ORM adjustment transaction (see "ORM-level reversal" below).

**ORM-level reversal of an accidental grant:**
```python
from nebelus.control.models import CreditBalance, CreditTransaction
from decimal import Decimal
from django.db import transaction

with transaction.atomic():
    cb = CreditBalance.objects.get(organization_id=ORG_ID, credit_type='eur')
    correction = Decimal('-54000.00')
    new_balance = cb.balance + correction
    txn = CreditTransaction.objects.create(
        organization_id=ORG_ID,
        transaction_type='adjustment',
        amount=correction,
        balance_after=new_balance,
        credit_type='eur',
        currency_at_purchase='EUR',
        fx_rate_at_purchase=Decimal('1.0'),
        description='Reverse accidental duplicate grant',
    )
    cb.balance = new_balance
    cb.save(update_fields=['balance', 'updated_at'])
```

**Django admin alternative:** Control → Credit Transaction → "Add credit transaction" (manual entry with action_type='grant'). The command is faster + safer for non-error cases.

### 2.6 Audit capabilities alignment
```bash
kubectl exec -i -n backend $POD -- python manage.py audit_org_capabilities --org $ORG_ID
```
Output verifies:
- Module Option (visible + activated) ↔ FeatureFlag alignment per capability (Branding, Custom Domain, Org Admin)
- Role module-permission alignment (Admin/Manager/Rep have expected codes)
- Default role count: 15/15 Admin, 12/12 Manager, 2/2 Rep

Expected: "All paired capabilities aligned" + "All default roles hold their expected module permissions".
If any mismatch shows up, fix the gap and re-run.

### 2.7 Audit RBAC state
```bash
# Single org
kubectl exec -i -n backend $POD -- python manage.py audit_rbac_flags --org $ORG_ID
# All orgs (operations overview)
kubectl exec -i -n backend $POD -- python manage.py audit_rbac_flags --all-orgs
# Only orgs with missing flags
kubectl exec -i -n backend $POD -- python manage.py audit_rbac_flags --missing-only
```
Expected: 9/9 RBAC enforce flags ON after step 2.2 ran.

### 2.8 Pre-launch validation walkthrough
For each role (Admin, Manager, Representative), log in as a test user and verify:

| Role | Sidebar | URL-hack `/billing-usage/billing` | Agent name click | Cost display |
|---|---|---|---|---|
| Admin | All modules | ✓ Sees all data | ✓ Full config | Org currency |
| Manager | Most except Org Admin Members/Custom Domain | ✓ Sees all data | ✓ Full config | Org currency |
| Rep | AI Studio + AI Chat + Usage Consumption only | ❌ Redirects to `/denied-access` | ❌ Plain text | Org currency |

After all rows pass, customer is cleared for usage.

### 2.9 Worked example — SV Land EUR provisioning (2026-06-22)
A concrete, end-to-end example of the playbook on a real customer:

| Step | What we did |
|---|---|
| 2.1 | Verified SV Land org exists (UUID `81e2293e-ddaa-4c0e-998c-a31e868be18f`), 4 users, 3 cloned agents, allowed_regions=['eu'] |
| 2.2 | Ran `apply_default_flags` → 16 flags applied; manually added 4 more billing flags (pre-PR #145 workaround) |
| 2.3a | Zeroed legacy $87.04 USD pool with audit transaction |
| 2.3b | Flipped currency USD → EUR |
| 2.4 | FX rate already seeded (0.90 EUR/USD) |
| 2.5 | Granted €54,000. Note: accidentally ran twice due to `--dry-run` bug; reversed via ORM adjustment |
| Modules | Surgically enabled `nebelus-billing-usage` + `nebelus-usage-units` only (per customer policy) |
| Agents | Mirrored B&B KansScan Integraal from NovaLink TEST CLONE (SI hash `1f28558c326741c4`, model opus-4-8, `report_unit` tool in needed_tools) |
| Billing | Created BillableUnit `nl_bb_scan` (€90); created "SV Land B&B KansScan Unit Plan" (`consumption_billing_enabled=False`); created "SV Land Demo (Free) Plan" attached to demo agents |
| Default plan | Converted "Pay-as-you-go USD" → "Pay-as-you-go EUR" (currency=EUR, credit_types=['eur'], is_default=True) so new agents auto-attach |
| User verification | All 4 SV Land users confirmed as Administrator |

Total time: ~90 minutes (mostly probing to confirm state before each apply).

### 2.10 Partner-sold customers — branding cascade (optional, white-label PR4)
When a customer is sold through a partner/reseller (e.g. T2), the customer org can
**inherit the partner's white-label branding automatically** — logo, colours,
portal title, and transactional-email branding (company name + support email) — so
the partner doesn't reconfigure branding per customer. Branding resolves
`own → partner.root_organization → Nebelus default`: the customer's own branding
wins if they configure it (visibility=global), otherwise the partner's branding
applies, otherwise Nebelus defaults.

**One-time partner setup (do once per partner):**
1. The partner has its **own** Organization (where the partner's admins log in).
   Configure its branding via the Branding admin/UI with **visibility = global**
   (and `custom_design_visibility = global` if using the Custom Design palette) —
   private branding is an admin preview and is **never** inherited by customers.
2. In Django admin → **Control → Partners → <the partner>**, set
   **Root organization** to that partner org (raw-id picker). This is the branding
   source for all the partner's customers.

**Per partner-sold customer:**
3. In Django admin → **Core → Organizations → <the customer>**, set **Partner** to
   the partner row. That's it — no branding config needed on the customer.

```python
# Equivalent via shell:
from nebelus.core.models import Organization
from nebelus.control.models import Partner
partner = Partner.objects.get(name="T2")
partner.root_organization = Organization._base_manager.get(id="<partner-org-uuid>")  # one-time
partner.save()
cust = Organization._base_manager.get(id="<customer-uuid>")
cust.partner = partner
cust.save()
```

**Verify the cascade resolved correctly** (logs `white-label cascade: …` at INFO
when a partner brand is inherited):
```bash
# Public pre-auth branding for the customer's verified custom domain → partner brand
curl -s "https://api.nebelus.ai/api/public/branding/?host=<customer-verified-host>"
```

> Notes / current limits (white-label PR4):
> - Branding cascade covers **transactional emails** and the **public pre-auth
>   branding endpoint** (login/reset pages on a custom domain). Authenticated
>   in-app branding for partner customers is a separate follow-up.
> - **Email sender domain inheritance** (sending from the partner's verified domain)
>   is a follow-up pending the per-tenant sender-domain feature (white-label PR2).
> - Partner self-service / control-center UI and partner-level RBAC are out of scope;
>   Nebelus admins provision partner customers via Django admin as above.

### 2.11 Custom Domain Provisioning (end-to-end, white-label PR5)

Let a customer serve the **portal** on their own domain (e.g. `app.customer.com`)
with an auto-provisioned TLS cert and their branding pre-auth.

**Architecture (how a custom domain is served):**
```
customer DNS A record  ──►  Caddy L4 LoadBalancer  34.12.84.213
   https://app.customer.com/login
        │  TLS handshake (unknown host)
        ▼
   Caddy on_demand_tls → ASK  https://api.nebelus.ai/api/edge/tls-allowed/?domain=app.customer.com
        │  CustomDomainTLSAllowedView returns 200 ONLY when an
        │  OrganizationCustomDomain row has status in {verified, active}
        ▼  (200 → Caddy obtains a Let's Encrypt cert on demand, cached in Redis db 1)
   Caddy catch-all  https:// {…}  →  reverse_proxy nebelus-portal-service.default:80
        ▼
   Portal SPA loads → resolves branding client-side via
   GET https://api.nebelus.ai/api/public/branding/?host=app.customer.com
```
Source of truth: `compose/cloud/caddy/Caddyfile.prod` (baked into the
`nebelus_caddy` image — NOT a ConfigMap). `CustomDomainTLSAllowedView` +
`PublicBrandingByHostView` in `server/nebelus/core/branding_views.py`.

**10-step provisioning playbook:**
1. **Enable the feature** — set `custom_domain_enabled` flag ON for the org (and the
   `nebelus-custom-domain` module visible/activated) so the portal tab + API appear.
2. **Customer enters their domain** in Portal → Settings → Custom Domain (admin only),
   or set `OrganizationCustomDomain.domain` via admin. This issues a TXT token.
3. **Customer adds the TXT record** shown on the page:
   `Host: _nebelus-verify.<domain>` · `Value: <expected_txt_record>`.
4. **Customer clicks "Verify DNS"** (or POST `/api/custom-domain/verify/`). On match the
   row flips `pending → verified`.
5. **Customer adds the A record** now shown on the page:
   `Host: <domain>` · `Value: 34.12.84.213` (the `NEBELUS_EDGE_IP`). The portal surfaces
   this via the serializer's `dns_records_needed` / `dns_target` — never hardcode it.
6. **Wait for DNS propagation** (A record → 34.12.84.213). Confirm with
   `dig +short app.customer.com` → `34.12.84.213`.
7. **Confirm the ask endpoint** returns 200:
   `curl 'https://api.nebelus.ai/api/edge/tls-allowed/?domain=app.customer.com'` → `{"allowed": true}`.
8. **Customer visits `https://app.customer.com/login`** from a clean browser. The FIRST
   visit triggers Caddy's on-demand ACME issuance (a few seconds of TLS handshake delay),
   then the page serves.
9. **Verify the cert** landed in Caddy storage:
   `kubectl exec -n backend deploy/redis-deployment -- redis-cli -a <pw> -n 1 --scan --pattern 'caddy*<domain>*'`
   (Caddy storage = Redis db 1, key_prefix `caddy`).
10. **Confirm branding** — the login page shows the customer's logo/colours pre-auth
    (served by `/api/public/branding/`). Done.

> **Status reality (premise correction, verified in code Jun 23):** a working custom
> domain stays `status=verified, ssl_status=none`. **Nothing in the code flips the row
> to `active` or updates `ssl_status`** — the catch-all, the TLS-allowed ask, and the
> public-branding endpoint all accept `verified` OR `active`, so `verified` is fully
> functional. The portal's "provisioning…/active" hints therefore never fire today.
> Do NOT wait for `active`; `verified` + a served HTTPS page is success. (Wiring the
> `verified→active` + `ssl_status` lifecycle is a filed follow-up — see Part 13.)

**Troubleshooting:**
- **TLS handshake fails / "internal error", zero ACME activity in Caddy logs** — the
  deployed `nebelus_caddy` image predates the on-demand-TLS Caddyfile. Rebuild + push
  the image and roll `caddy-deployment` (the `caddy-prod` workflow is `.disabled`; deploy
  is manual). Validate first: `caddy validate --config compose/cloud/caddy/Caddyfile.prod --adapter caddyfile`.
- **Cert never issues, Caddy logs show the ask returned non-2xx** — the domain isn't
  `verified`/`active` in the DB (ask returns 404), OR the ask URL is wrong. The ask MUST
  be `https://api.nebelus.ai/api/edge/tls-allowed/` (trailing slash — without it Django
  `APPEND_SLASH` returns 301, which blocks issuance).
- **Domain stuck in `pending`** — the TXT record hasn't propagated or is wrong. Check
  `dig +short TXT _nebelus-verify.<domain>` and re-verify. DNS can take minutes.
- **Page serves but shows Nebelus defaults** — `/api/public/branding/?host=<domain>`
  returned 404: branding `visibility` is `private` (not `global`), or `branding_settings_enabled`
  is off, or (for partner-sold orgs) the partner has no global branding. Note the public
  endpoint caches 60s.
- **Let's Encrypt rate limit** — LE allows **5 certs per exact domain per 168h (7 days)**.
  Only trigger issuance with real verified domains; don't loop a failing domain. If hit,
  wait out the window (no override).

**Revoking / removing a custom domain cleanly:**
1. Reset the DB row: Portal "Reset" button, or `DELETE /api/custom-domain/`, or in admin
   clear `OrganizationCustomDomain.domain` (status → pending, token cleared). The ask then
   returns 404 for that host, so Caddy won't re-issue.
2. Purge the cached cert from Caddy storage so Caddy stops serving it:
   `kubectl exec -n backend deploy/redis-deployment -- redis-cli -a <pw> -n 1 --scan --pattern 'caddy*<domain>*' | xargs redis-cli -a <pw> -n 1 del`
   (the existing cert is served from Redis until it's removed or expires).
3. Tell the customer to remove the A record (and TXT) from their DNS.

---
## Part 3 — Module & Feature Configuration

### 3.1 Module vs FeatureFlag — the dual-gate concept
Some capabilities (Branding, Custom Domain, On-Premise) require BOTH:
1. **Module Option** — `OrganizationModuleOption.is_visible=True` AND `is_activated=True`
2. **Feature Flag** — `OrganizationFeatureFlag(flag='custom_domain_enabled', enabled=True)`

Common gotcha: enabling the module without the feature flag → save fails with 404 on the API endpoint. Or vice versa.

Use `audit_org_capabilities` to detect misalignment proactively.

### 3.2 List modules for an org
```python
from nebelus.control.models import OrganizationModuleOption
from nebelus.core.models import Organization
org = Organization.objects.get(id='YOUR_ORG_ID')
for opt in OrganizationModuleOption.objects.filter(organization=org).select_related('module').order_by('module__reference_code'):
    print(f'  {opt.module.reference_code}: visible={opt.is_visible} activated={opt.is_activated}')
```
Common reference_codes and what they enable:

| Reference Code | What it enables |
|---|---|
| `nebelus-ai-studio` | AI Studio (agent builder) |
| `nebelus-agent-chat` | AI Chat module |
| `nebelus-billing-usage` | Billing & Usage parent |
| `nebelus-usage-consumption` | Consumption sub-tab |
| `nebelus-usage-units` | Units sub-tab |
| `nebelus-billing-overview` | Billing → Overview |
| `nebelus-billing-payment-methods` | Billing → Payment Methods |
| `nebelus-billing-credit-grants` | Billing → Credit Grants |
| `nebelus-audit-logs` | Audit & Logs parent |
| `nebelus-org-admin` | Org Admin module |
| `nebelus-branding` | Branding |
| `nebelus-custom-domain` | Custom Domain |
| `nebelus-deployments` | Deployments |
| `nebelus-governance` | Governance |
| `nebelus-orchestrator` | Playbooks/Orchestrator |
| `nebelus-vector-stores` | Vector Stores |
| `nebelus-monitor` | Monitor |
| `nebelus-integrations-tools` | Integrations & Tools |
| `nebelus-provider-google-anthropic-vertex` | Claude on Google Vertex (EU residency) |
| `nebelus-provider-google-vertexai` | Google Vertex AI (Gemini family) |
| `nebelus-feature-byok` | Bring-Your-Own-Keys |

### 3.3 Toggle modules visible / active
```python
from nebelus.control.models import OrganizationModuleOption
from nebelus.core.models import Organization
from django.core.cache import cache
ORG_ID = 'YOUR_ORG_ID'
org = Organization.objects.get(id=ORG_ID)
# Enable a set of modules
modules_to_enable = [
    'nebelus-ai-studio',
    'nebelus-agent-chat',
    'nebelus-billing-usage',
    'nebelus-usage-consumption',
    'nebelus-usage-units',
]
for code in modules_to_enable:
    try:
        opt = OrganizationModuleOption.objects.get(
            organization=org,
            module__reference_code=code
        )
        opt.is_visible = True
        opt.is_activated = True
        opt.save(update_fields=['is_visible', 'is_activated', 'updated_at'])
        print(f'  ✓ {code}: visible+activated')
    except OrganizationModuleOption.DoesNotExist:
        print(f'  ! {code}: not found')
cache.delete(f'agents_framework_{ORG_ID}')
```
**Django admin alternative:** Control → Organization Module Option → filter by org → toggle checkboxes per row. Works but slow for many modules.

### 3.4 Toggle feature flags
**⚠️ The model is `OrganizationFeatureFlag`, NOT `FeatureFlag`.** Fields: `flag` (name string) + `enabled` (bool) + optional `notes`. Past versions of this runbook used `FeatureFlag.objects.get_or_create(name=...)` — that's wrong on two counts.

```python
from nebelus.core.models import OrganizationFeatureFlag
ORG_ID = 'YOUR_ORG_ID'

flags_to_enable = [
    'branding_settings_enabled',
    'module_branding_enabled',
    'custom_domain_enabled',
]
for flag_name in flags_to_enable:
    f, created = OrganizationFeatureFlag.objects.update_or_create(
        organization_id=ORG_ID,
        flag=flag_name,
        defaults={'enabled': True},
    )
    action = 'created' if created else 'updated'
    print(f'  {action}: {flag_name} = enabled=True')
```

To check whether a flag is on (helper):
```python
from nebelus.core import feature_flags as ff
from nebelus.core.models import Organization
org = Organization._base_manager.get(id=ORG_ID)
print(ff.feature_enabled(org, ff.MULTI_CURRENCY_LEDGER))  # True / False
```

Known flag families (constants live in `nebelus.core.feature_flags`):

| Family | Flags |
|---|---|
| RBAC enforcement | `rbac_enforce_agent`, `rbac_enforce_deployment`, `rbac_enforce_deployment_domain`, `rbac_enforce_integration`, `rbac_enforce_vector_store`, `rbac_enforce_org_settings`, `rbac_enforce_governance`, `rbac_enforce_api_key`, `rbac_enforce_role_viewset` |
| Billing | `billing_engine_unified`, `unit_billing_enabled`, `multi_currency_ledger`, `multi_currency_billing`, `invoice_generation` |
| Modules/Branding | `branding_settings_enabled`, `module_branding_enabled`, `module_org_admin_enabled`, `custom_domain_enabled` |
| Other | `quota_enforcement`, `usage_dashboard_v2` |

### 3.5 Common gotchas
- **Branding save 404:** module visible+activated but `branding_settings_enabled` flag OFF. Enable the flag.
- **Custom Domain save 404:** same pattern. Enable `custom_domain_enabled`.
- **HTTP 402 on agent run after currency change:** `multi_currency_ledger` flag is OFF. Enable it (and `multi_currency_billing`). The credit-access-control code at `nebelus/control/credit_access_control.py:82-86` only takes the multi-currency path when the flag is on; otherwise it falls back to `CreditBalance.get_or_create_usd()` — hardcoded USD — even if `Organization.currency='EUR'`.
- **`apply_default_flags`** seeds ~16-20 flags but does NOT touch Module Options. Modules are seeded at org creation via a separate path.
- **Cache:** after every module/flag toggle, clear `agents_framework_{org_id}` and ask the customer to hard-refresh.

---
## Part 4 — Agent Operations
### 4.1 List agents in an org
```python
from nebelus.agents.models import Agent
for a in Agent.objects.filter(organization_id='YOUR_ORG_ID').order_by('name'):
    vs_count = len(a.vector_stores or [])
    print(f'  {a.id} | "{a.name}" | {a.pattern_type} | model={a.model_id} | vs={vs_count}')
```
### 4.2 Probe an agent's full config
```python
from nebelus.agents.models import Agent
import json
a = Agent.objects.get(id='AGENT_ID')
print(f'Name: {a.name}')
print(f'Pattern: {a.pattern_type}')
print(f'Model: {a.model_provider}/{a.model_id}')
print(f'Status: {a.status}')
print(f'Webhook key: {a.webhook_key}')
print(f'Files: {a.files}')
print(f'Vector stores: {a.vector_stores}')
print(f'Needed tools: {a.needed_tools}')
print()
print(f'System message (first 500 chars):')
print(a.system_message[:500] if a.system_message else '(empty)')
```
For workflow agents (`pattern_type='workflow'`), reference `Workflow-Agent-Building-Runbook.md` for the deep-dive on `pattern_config` / `workflow` JSON graph editing.

### 4.3 Edit single-agent system_message, model, or tools
```python
import copy
from nebelus.agents.models import Agent
from django.core.cache import cache
AID = 'AGENT_ID'
a = Agent.objects.get(id=AID)
# Edit fields
a.system_message = "NEW SYSTEM PROMPT"
a.model_provider = 'google_anthropic_vertex'  # for EU residency
a.model_id = 'claude-opus-4-8'
a.needed_tools = copy.deepcopy(a.needed_tools or {})
# needed_tools is a DICT for most agents, e.g. {'report_unit': {'instruction': '', 'available_in_python_repl': False}}
# (Some legacy agents have it as a list — confirm shape before mutating.)
a.save(update_fields=['system_message', 'model_provider', 'model_id', 'needed_tools', 'updated_at'])
cache.delete(f'agents_framework_{a.organization_id}')
print('Saved + cache cleared')
```
**Always `copy.deepcopy()` JSON fields before mutating** — Django doesn't reliably detect in-place mutations on JSONField.

### 4.4 Workflow agents
For workflow agents (router → specialist → synthesis, or linear state pipelines), the `pattern_config` and `workflow` JSONFields hold the node graph. Both must be mirrored on every edit.
**See `Workflow-Agent-Building-Runbook.md`** — comprehensive 830-line reference covering:
- Building from scratch (linear + router patterns)
- Surgical edits (model swap, system prompt, tools, VS, files)
- State node + list-reducer mechanism
- The two file id-spaces (chat-upload vs node-attached)
- Sandbox limits (network_mode=none, no LibreOffice, render envelope)
- 13 production-tested pitfalls

### 4.5 Generate a new webhook key
```python
import secrets
import string
new_key = ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(8))
# webhook_key is CharField(max_length=8), uppercase alphanumeric
```
### 4.6 Hard-delete an agent
```python
from nebelus.agents.models import Agent
from django.contrib.admin.utils import NestedObjects
a = Agent._base_manager.get(id='AGENT_ID')
# Preview cascade
n = NestedObjects(using='default')
n.collect([a])
print('Will cascade:', n.nested())
# Confirm, then delete
a.delete()
```
**Use `_base_manager`** — the default manager filters and can cause `DoesNotExist` mid-cascade.

### 4.7 Pause / kill a runaway agent
If an agent is in an unexpected loop (see Part 12 for the T2 WhatsApp loop case study):

```bash
POD=$(kubectl get pods -n backend -o name | grep app-deployment | head -1 | cut -d/ -f2)

# 1. Restart agents-deployment to kill in-flight Celery tasks
kubectl rollout restart deployment/agents-deployment -n backend

# 2. Flip the agent(s) to draft so new tasks don't enqueue
cat <<'STOP' | kubectl exec -i -n backend $POD -- python manage.py shell
from nebelus.agents.models import Agent
from django.db import transaction
AGENT_IDS = ['...']
ORG_ID = '...'
with transaction.atomic():
    for aid in AGENT_IDS:
        a = Agent.objects.get(id=aid)
        a.status = 'draft'
        a.save(update_fields=['status', 'updated_at'])
        print(f'  draft: {a.name}')
from django.core.cache import cache
cache.delete(f'agents_framework_{ORG_ID}')
STOP

# 3. Purge any pending Celery agents-queue tasks
AGENT_POD=$(kubectl get pods -n backend -o name | grep agents-deployment | head -1 | cut -d/ -f2)
kubectl exec -n backend $AGENT_POD -- celery -A nebelus purge -Q agents -f
```

After diagnosis is complete and the bug is fixed, flip status back to `active` and clear cache.

---
## Part 5 — Vector Store Operations
### 5.1 List VS for an org
```python
from nebelus.vectorstore.client import VectorServiceClient
c = VectorServiceClient()
r = c.request('GET', '/v1/vector_stores', params={'org_id': 'YOUR_ORG_ID'})
if r.status_code == 200:
    data = r.json()
    vs_list = data.get('data', data.get('vector_stores', []))
    for vs in vs_list:
        print(f'  {vs["id"]} | "{vs.get("name")}" | files={vs.get("file_count", "?")}')
```
### 5.2 Clone a single vector store
```python
from nebelus.vectorstore.client import VectorServiceClient
SRC_ORG_ID = 'source-org-uuid'
DST_ORG_ID = 'dest-org-uuid'
SRC_VS_ID = 'source-vs-uuid'
NEW_NAME = 'My VS Name'
c = VectorServiceClient()
r = c.request(
    'POST',
    f'/v1/vector_stores/{SRC_VS_ID}/clone',
    json={
        'org_id': SRC_ORG_ID,
        'target_org_id': DST_ORG_ID,
        'name': NEW_NAME,
    },
)
print(f'Status: {r.status_code}')
if r.status_code in (200, 201, 202):
    data = r.json()
    print(f'New VS ID: {data.get("id")}')
```
**Important:** HTTP 202 = accepted async. The clone completes server-side regardless of timeout. Verify completion via `GET /v1/vector_stores/{id}/files` once async work finishes (usually 1-2 minutes for large VS).

### 5.3 Bulk clone (typical pattern for new tenant)
```python
import time
from nebelus.vectorstore.client import VectorServiceClient
SRC_ORG_ID = 'novalink-org-id'
DST_ORG_ID = 'new-customer-org-id'
vs_to_clone = [
    ('source-vs-uuid-1', 'Triage Knowledge Base'),
    ('source-vs-uuid-2', 'Example Reports'),
    # ... etc
]
vs_map = {}
client = VectorServiceClient()
for src_vs_id, name in vs_to_clone:
    print(f'Cloning "{name}"...')
    r = client.request(
        'POST',
        f'/v1/vector_stores/{src_vs_id}/clone',
        json={'org_id': SRC_ORG_ID, 'target_org_id': DST_ORG_ID, 'name': name},
    )
    if r.status_code in (200, 201, 202):
        dst_vs_id = r.json().get('id')
        vs_map[src_vs_id] = dst_vs_id
        print(f'  -> {dst_vs_id}')
    time.sleep(1)  # breathing room between async clones
import json
print(json.dumps(vs_map, indent=2))
```
Save the `vs_map` — you'll need it in the agent clone step (Part 6).

### 5.4 Verify VS file count
```python
c = VectorServiceClient()
for vs_id in [...your dst vs ids...]:
    r = c.request('GET', f'/v1/vector_stores/{vs_id}/files', params={'org_id': DST_ORG_ID})
    if r.status_code == 200:
        data = r.json()
        file_count = len(data.get('data', data.get('files', [])))
        print(f'  {vs_id}: files={file_count}')
```
**Note:** the `vector_stores.file_counts` DB column is unreliable; the `/files` API is the source of truth.

### 5.5 Dedupe vector stores
VS-service DB has historically allowed duplicate rows with the same `id` (UNIQUE constraint missing). To clean up:
```sql
-- Connect to vector-api Postgres directly (not the main app DB)
DELETE FROM vector_stores
WHERE ctid IN (
  SELECT ctid FROM (
    SELECT ctid, ROW_NUMBER() OVER (PARTITION BY id ORDER BY created_at) AS rn
    FROM vector_stores
  ) t WHERE rn > 1
);
```
Filed as P1: add the `UNIQUE` constraint on `vector_stores.id` once all orgs are clean.

### 5.6 Hard-delete a vector store
```python
c = VectorServiceClient()
r = c.request('DELETE', f'/v1/vector_stores/{vs_id}', params={'org_id': ORG_ID})
print(f'Status: {r.status_code}')
```
**Important:** Qdrant collection is independent of vector-api DB. Deleting via the API removes both. Manual DB deletes leave Qdrant orphans.

---
## Part 6 — Account Cloning Playbook (4-Phase)
The standard pattern for spinning up a new customer based on a template org (typically NovaLink for healthcare customers).

### 6.1 Phase 1 — Portfolios (theme + logo per user)
```python
from nebelus.core.models import Portfolio, User
DST_ORG_ID = 'new-org-uuid'
THEME_SLUG = 'sunlit-citrus'  # or 'clementine', 'blue-purple', etc.
LOGO_URL = 'https://nebelus-public-nl.storage.googleapis.com/organizations/<DST_ID>/logos/logo.png'
# For each user that should have the branded portfolio
for user_email in ['user1@customer.com', 'user2@customer.com']:
    u = User.objects.get(email=user_email)
    p, created = Portfolio.objects.get_or_create(
        user=u,
        organization_id=DST_ORG_ID,
        defaults={'ui_options': {'theme': THEME_SLUG, 'logo': LOGO_URL}}
    )
    if not created:
        p.ui_options = {**p.ui_options, 'theme': THEME_SLUG, 'logo': LOGO_URL}
        p.save()
```

### 6.2 Phase 2 — Org-level logo
```bash
# Copy from source org's logo path to destination
gcloud storage cp \
    gs://nebelus-public-nl/organizations/<SRC_ID>/logos/logo.png \
    gs://nebelus-public-nl/organizations/<DST_ID>/logos/logo.png
# Then set Organization.logo in the model
```
```python
from nebelus.core.models import Organization
org = Organization._base_manager.get(id='DST_ORG_ID')
org.logo = 'organizations/<DST_ID>/logos/logo.png'
org.save(update_fields=['logo'])
```

### 6.3 Phase 3 — Vector Stores (see Part 5.3)
Build `vs_map = {src_vs_id: dst_vs_id}` via bulk clone.

### 6.4 Phase 4 — Agents with vs_map applied
```python
import secrets
import string
import copy
from nebelus.core.models import Organization
from nebelus.agents.models import Agent
from django.core.cache import cache
SRC_ORG_ID = 'source-org-uuid'
DST_ORG_ID = 'dest-org-uuid'
dst_org = Organization.objects.get(id=DST_ORG_ID)
vs_map = {
    # paste from Phase 3 output
    'src-vs-uuid-1': 'dst-vs-uuid-1',
    'src-vs-uuid-2': 'dst-vs-uuid-2',
}
agent_ids_to_clone = [
    'src-agent-uuid-1',
    'src-agent-uuid-2',
]
# Fields to exclude from copy
EXCLUDE_FIELDS = {
    'id', 'pk', '_state',
    'organization', 'organization_id',
    'webhook_key',
    'created_at', 'updated_at',
    'user', 'user_id',
    'updated_by', 'updated_by_id',
}
for aid in agent_ids_to_clone:
    src_agent = Agent.objects.get(id=aid)
    
    field_kwargs = {}
    for field in src_agent._meta.fields:
        if field.name in EXCLUDE_FIELDS:
            continue
        if field.name.endswith('_id') and field.name[:-3] in EXCLUDE_FIELDS:
            continue
        value = getattr(src_agent, field.name)
        if isinstance(value, (dict, list)):
            value = copy.deepcopy(value)
        field_kwargs[field.name] = value
    
    # Set destination org
    field_kwargs['organization'] = dst_org
    
    # Reset chat-state fields
    field_kwargs['files'] = []
    field_kwargs['used_triggers'] = []
    
    # Apply vs_map to vector_stores
    src_vs = src_agent.vector_stores or []
    field_kwargs['vector_stores'] = [vs_map.get(vid, vid) for vid in src_vs]
    
    # Generate new webhook key
    field_kwargs['webhook_key'] = ''.join(
        secrets.choice(string.ascii_uppercase + string.digits)
        for _ in range(8)
    )
    
    new_agent = Agent.objects.create(**field_kwargs)
    print(f'  Created {new_agent.id} | "{new_agent.name}"')
# Clear destination org cache
cache.delete(f'agents_framework_{DST_ORG_ID}')
```
**For workflow agents:** also need to remap VS references INSIDE `pattern_config.nodes[].config.vector_stores` AND `workflow.nodes[].config.vector_stores`. See `Workflow-Agent-Building-Runbook.md` for the workflow-specific clone pattern.

### 6.5 What's NOT carried over
| Type | Why |
|---|---|
| `governance_policies` (M2M) | Org-scoped policies; set up separately |
| `mcp_servers` (M2M) | Org-scoped |
| `api_endpoints` (M2M) | Org-scoped |
| `ai_tools` (M2M) | Org-scoped |
| `files` (chat-attached) | Thread/chat-state, not agent definition |
| `used_triggers` | Chat-state |
| `id` | New UUID generated |
| `webhook_key` | New 8-char key generated |

### 6.6 Post-clone verification
```python
# Verify
for a in Agent.objects.filter(organization=dst_org).order_by('name'):
    print(f'  {a.id} | "{a.name}" | vs={len(a.vector_stores or [])}')
# Verify VS clones finished (async)
# See Part 5.4
```

---
## Part 7 — Billing & Pricing
### 7.1 Entity model
```
Organization (currency: USD/EUR/SAR)
  ├─ CreditBalance (per credit_type)
  ├─ BillingPlan (margin_with_keys/byok, applies_to_agents, consumption_billing_enabled)
  │   └─ applies_to: Agent[s]
  ├─ BillableUnit (code, unit_cost, currency)
  └─ BillableUnitTriggerRule (event_type, billable_unit, agent)
```

### 7.2 BillingPlan field reference
Real field names on `nebelus.control.models.BillingPlan` (per probe 2026-06-22):

| Field | Type | Notes |
|---|---|---|
| `name` | CharField | Display name |
| `plan_type` | CharField | `usage_metered` / `subscription` / etc. |
| `billing_mode` | CharField | `stripe_topup` / `offline_invoice` / `partner_invoice` / etc. |
| `credit_types` | JSONField | List like `['eur']` |
| `margin_with_keys` | DecimalField | Margin when platform supplies LLM keys (default 0.20) |
| `margin_byok` | DecimalField | Margin when customer brings own keys (default 0.10) |
| `flat_amount` | DecimalField | For subscription plans |
| `recurrence` | CharField | `none` / `monthly` etc. |
| `currency` | CharField | `USD` / `EUR` / `SAR` |
| `active` | BooleanField | |
| `consumption_billing_enabled` | BooleanField | Whether LLM-token consumption also charges this plan (set False for unit-only plans) |
| `is_default` | BooleanField | DB constraint: exactly one (active=True, is_default=True) plan per org |
| `partner_ref` | ForeignKey | For partner-invoiced plans |
| `applies_to_agents` | M2M | Which agents this plan applies to |

### 7.3 Create a unit billing plan
```python
from decimal import Decimal
from nebelus.control.models import BillingPlan
from nebelus.agents.models import Agent
ORG_ID = 'YOUR_ORG_ID'
plan = BillingPlan.objects.create(
    organization_id=ORG_ID,
    name='Casemanager Unit Plan',
    plan_type='usage_metered',
    billing_mode='offline_invoice',
    credit_types=['eur'],
    margin_with_keys=Decimal('0.20'),
    margin_byok=Decimal('0.10'),
    recurrence='none',
    currency='EUR',
    consumption_billing_enabled=False,  # ← unit-only, no double-charging
    active=True,
    is_default=False,
)
# Assign to specific agents (M2M)
casemanager = Agent.objects.get(id='AGENT_ID')
plan.applies_to_agents.add(casemanager)
print(f'Plan created: {plan.id}')
```
**Critical:** for unit-only plans, set `consumption_billing_enabled=False`. Otherwise the LLM consumption will ALSO be charged (the CL-9 Defect 1 fix).

### 7.4 Create a billable unit
```python
from decimal import Decimal
from nebelus.control.models import BillableUnit
unit = BillableUnit.objects.create(
    organization_id=ORG_ID,
    code='nl_casemanager_thread',  # unique within org
    name='Casemanager Thread Completed',
    unit_cost=Decimal('9.50'),
    currency='EUR',
    active=True,
)
print(f'Unit created: {unit.id}')
```

**BillableUnit.code naming convention — region prefix:**
| Prefix | Meaning |
|---|---|
| `nl_` | Netherlands (was previously misused as "NovaLink"; now repurposed as country prefix — shared across all NL-based tenants) |
| `sa_` | Saudi Arabia (T2 / KSA tenants) |
| `eu_` | Multi-country EU agents not tied to a specific country |

Code pattern: `<region>_<agent>_<event>` — e.g., `nl_bb_scan`, `nl_casemanager_thread`, `sa_<agent>_<event>`.

**Why this matters:** the agent's system instructions reference the unit code verbatim when calling `report_unit(unit_code="nl_bb_scan")`. If you clone an agent from one NL tenant to another, the SI works unchanged as long as both tenants use the same code. If you used `<tenantname>_bb_scan`, the SI would need patching per tenant.

### 7.5 Create a TriggerRule
Two event types are supported:

**Counter-based** (every N runs in a thread fires 1 unit):
```python
from nebelus.control.models import BillableUnitTriggerRule
rule = BillableUnitTriggerRule.objects.create(
    organization_id=ORG_ID,
    billable_unit=unit,
    agent=casemanager,
    event_type='thread_runs_count',
    units_per_event=Decimal('1'),
    runs_per_thread_unit=5,  # every 5 runs = 1 unit
    active=True,
)
```

**Tool-call-based** (agent calls `report_unit(unit_code=...)`):
For this pattern, you DON'T need a TriggerRule — the `report_unit` tool dispatches directly. Just:
1. Ensure `report_unit` is in the agent's `needed_tools` (as a dict: `{'report_unit': {'instruction': '', 'available_in_python_repl': False}}`)
2. SI instructs the agent to call `report_unit(unit_code="nl_bb_scan")` when appropriate (the canonical SI is the NovaLink "B&B KansScan Integraal (TEST CLONE)" with a `CRITICAL` section block describing the report_unit usage rules)
3. BillableUnit `nl_bb_scan` exists in the org

The historical `report_unit` TriggerRule pattern (with `event_type='report_unit'`) is INERT — `report_unit` is a direct tool, not a dispatch event. Delete any existing rules of that type.

### 7.6 Default plan policy
Each org MUST have exactly one `(active=True, is_default=True)` BillingPlan — enforced by DB constraint `billingplan_one_active_default_per_org`. New agents created in the org auto-attach to this default plan for their LLM consumption billing.

When converting an org from USD to EUR (or other currency), the existing default `Pay-as-you-go USD` plan can either:
- Be **converted in place** (preferred — preserves plan id, no orphans): change `name='Pay-as-you-go EUR'`, `currency='EUR'`, `credit_types=['eur']`. Keep `is_default=True`, `active=True`, `consumption_billing_enabled=True`.
- Or **replaced** by creating a new EUR plan and flipping the old to `active=False, is_default=False`. More disruptive to audit trail.

The NovaLink "Pay-as-you-go EUR" plan is the canonical template:
```
plan_type=usage_metered
billing_mode=stripe_topup
credit_types=['eur']
margin_with_keys=0.20
margin_byok=0.10
currency=EUR
active=True
consumption_billing_enabled=True
is_default=True
applies_to_agents=[]   # catch-all; doesn't list specific agents
```

### 7.7 Custom margin override
```python
plan = BillingPlan.objects.get(id='PLAN_ID')
plan.margin_with_keys = Decimal('0.50')  # 50% margin override
plan.save(update_fields=['margin_with_keys', 'updated_at'])
```
The plan's margin overrides the default org-level margin.

### 7.8 Fund via grant_credits or Django admin
See Part 2.5. Alternative paths:
```python
# Direct API (NOT recommended — bypasses audit)
from decimal import Decimal
from nebelus.control.models import CreditBalance
cb, _ = CreditBalance.objects.get_or_create(
    organization_id=ORG_ID,
    credit_type='eur',
    defaults={'balance': Decimal('0')}
)
cb.balance += Decimal('1000')
cb.save()
```
Always prefer `grant_credits` management command — it writes an audit-tracked CreditTransaction. (Remember `--dry-run` bug — see Part 2.5.)

### 7.9 Inspect billing state for an org
```python
from nebelus.control.models import CreditBalance, CreditTransaction, BillingPlan
ORG_ID = 'YOUR_ORG_ID'
# Balances
print('=== Balances ===')
for cb in CreditBalance.objects.filter(organization_id=ORG_ID):
    print(f'  {cb.credit_type}: {cb.balance}')
# Recent transactions
print()
print('=== Recent transactions ===')
for t in CreditTransaction.objects.filter(organization_id=ORG_ID).order_by('-created_at')[:10]:
    is_unit = bool(t.billable_unit)
    type_label = f'UNIT ({t.billable_unit.code})' if is_unit else f'CONSUMPTION ({t.ai_model})'
    print(f'  {t.created_at} | {type_label} | {t.amount} {t.credit_type}')
# Active plans
print()
print('=== Active plans ===')
for p in BillingPlan.objects.filter(organization_id=ORG_ID, active=True):
    print(f'  "{p.name}" | margin={p.margin_with_keys} | consumption_enabled={p.consumption_billing_enabled} | is_default={p.is_default}')
```

---
## Part 8 — RBAC Operations
### 8.1 Three-layer gating recap
```
Layer 1: ORG-LEVEL          → Module catalog + OrganizationModuleOption
Layer 2: PERMISSION-LEVEL   → Role.permissions M2M + permission codes
Layer 3: ROUTE-LEVEL        → canAccess() FE guard + URL redirect
```
Denial cascades down. Default-open for unset gates.

### 8.2 List roles and their permissions
```python
from nebelus.core.models import Organization
org = Organization.objects.get(id='YOUR_ORG_ID')
for role in org.roles.all().order_by('name'):
    perms = sorted(role.permissions.values_list('codename', flat=True))
    print(f'=== {role.name} ({role.id}) ===')
    print(f'  Total perms: {len(perms)}')
    # Group by prefix
    grouped = {}
    for p in perms:
        prefix = p.split('.')[0]
        grouped.setdefault(prefix, []).append(p)
    for prefix in sorted(grouped):
        print(f'  [{prefix}]')
        for p in grouped[prefix]:
            print(f'    - {p}')
    print()
```

### 8.3 Check specific permission per role
```python
from nebelus.core.models import Organization
org = Organization.objects.get(id='YOUR_ORG_ID')
perms_to_check = ['usage.read', 'usage.read_org', 'agent.read_config', 'module.org_admin.view']
for role_name in ['Administrator', 'Manager', 'Representative']:
    role = org.roles.filter(name=role_name).first()
    if not role:
        continue
    role_perms = set(role.permissions.values_list('codename', flat=True))
    print(f'=== {role_name} ===')
    for p in perms_to_check:
        print(f'  {p}: {p in role_perms}')
    print()
```

### 8.4 Modify Role.permissions
```python
from nebelus.core.models import Organization, Permission
org = Organization.objects.get(id='YOUR_ORG_ID')
manager = org.roles.get(name='Manager')
# Strip permission from role
api_keys_view = Permission.objects.get(codename='module.api_keys.view')
manager.permissions.remove(api_keys_view)
# Add permission to role
some_perm = Permission.objects.get(codename='module.x.view')
manager.permissions.add(some_perm)
print(f'Manager now has {manager.permissions.count()} permissions')
```
**Note:** changes apply to that specific org's role. To change the default role template platform-wide, edit `core/permissions_registry.py` and create a migration.

### 8.5 The 9 RBAC enforce flags
| Flag | Gates which endpoint |
|---|---|
| `rbac_enforce_agent` | Agent CRUD viewset |
| `rbac_enforce_deployment` | Deployment CRUD |
| `rbac_enforce_deployment_domain` | DeploymentDomain CRUD |
| `rbac_enforce_integration` | Integration CRUD |
| `rbac_enforce_vector_store` | VectorStore CRUD |
| `rbac_enforce_org_settings` | OrgSettings CRUD |
| `rbac_enforce_governance` | Governance (legacy; superseded by always-on CL-8 gate) |
| `rbac_enforce_api_key` | ApiKey CRUD |
| `rbac_enforce_role_viewset` | Role management |
Always-on gates (CL-8/CL-9/CL-10) do not need flags — they're applied to every org immediately.

### 8.6 Cross-tenant isolation verification
```python
from rest_framework.test import APIRequestFactory
from rest_framework.request import Request
from nebelus.core.models import Organization, User
from nebelus.agents.models import Agent
from nebelus.control.credit_views import AgentCostCalculatorViewSet
# Test: Nebelus admin tries to access NovaLink agent
nebelus = Organization.objects.get(id='nebelus-id')
haydar = User.objects.get(email='haydar@nebelus.ai')
novalink_agent = Agent.objects.filter(organization_id='novalink-id').first()
factory = APIRequestFactory()
django_req = factory.get(f'/api/credits/cost-calculator/agent/{novalink_agent.id}/')
django_req.user = haydar
drf_req = Request(django_req)
drf_req.organization = nebelus
drf_req.user = haydar
view = AgentCostCalculatorViewSet()
view.request = drf_req
view.kwargs = {}
view.format_kwarg = None
try:
    response = view.agent_costs(drf_req, agent_id=str(novalink_agent.id))
    print(f'Status: {response.status_code}')  # Expected: 404 (cross-org rejected)
except Exception as e:
    print(f'Exception (expected): {e}')
```

---
## Part 9 — Audit & Diagnostics
### 9.1 LoginEvent queries
```python
from nebelus.core.models import LoginEvent
# Recent login events for a user
for evt in LoginEvent.objects.filter(user_email='haydar@nebelus.ai').order_by('-created_at')[:10]:
    print(f'  {evt.created_at} | {evt.event_type} | {evt.outcome} | IP={evt.client_ip}')
# Failed logins last 24h
from django.utils import timezone
from datetime import timedelta
yesterday = timezone.now() - timedelta(days=1)
for evt in LoginEvent.objects.filter(
    outcome='failure',
    created_at__gte=yesterday
).order_by('-created_at')[:50]:
    print(f'  {evt.created_at} | {evt.user_email or "anon"} | reason={evt.failure_reason}')
```

### 9.2 CreditTransaction queries
```python
from nebelus.control.models import CreditTransaction
# Per-agent breakdown last 30 days
from django.utils import timezone
from datetime import timedelta
since = timezone.now() - timedelta(days=30)
from django.db.models import Sum, Count
qs = CreditTransaction.objects.filter(
    organization_id='YOUR_ORG_ID',
    created_at__gte=since,
).values('agent_id', 'agent__name').annotate(
    total=Sum('amount'),
    count=Count('id'),
).order_by('total')
for row in qs:
    print(f'  {row["agent__name"]}: {row["count"]} txns, total {row["total"]}')
```

### 9.3 UnitConsumption queries
```python
from nebelus.control.models import UnitConsumption
# Recent unit consumption events
for uc in UnitConsumption.objects.filter(
    organization_id='YOUR_ORG_ID'
).order_by('-created_at')[:20]:
    print(f'  {uc.created_at} | unit={uc.billable_unit.code} | event={uc.event_type} | run_key={uc.run_key} | units={uc.units}')
```

### 9.4 WebhookEvent queries
For diagnosing webhook ingestion issues (see Part 12 for T2 case study):
```python
from nebelus.agents.models import WebhookEvent
from django.db.models import Count

# Distinct errors across all webhook processing
errors = WebhookEvent.objects.exclude(processing_error='').values('processing_error').annotate(n=Count('id')).order_by('-n')[:10]
for row in errors:
    print(f'  [{row["n"]}x] {row["processing_error"][:200]}')

# By status
for row in WebhookEvent.objects.values('status').annotate(n=Count('id')).order_by('-n'):
    print(f'  {row["status"]}: {row["n"]}')

# Recent events on a specific webhook
from nebelus.agents.models import Webhook
wh = Webhook.objects.filter(agent_id='AGENT_ID').first()
for ev in WebhookEvent.objects.filter(webhook=wh).order_by('-created_at')[:10]:
    print(f'  {ev.created_at} | status={ev.status} | src_ip={ev.source_ip} | err={ev.processing_error[:60]}')
```

### 9.5 Cascade preview before hard-delete
```python
from django.contrib.admin.utils import NestedObjects
obj = Organization._base_manager.get(id='ORG_ID')
n = NestedObjects(using='default')
n.collect([obj])
print('Will delete cascade:')
print(n.nested())  # Pretty-prints the cascade tree
```

### 9.6 Cache state
```python
from django.core.cache import cache
# Check if per-org cache exists
key = 'agents_framework_YOUR_ORG_ID'
value = cache.get(key)
print(f'Cache key exists: {value is not None}')
# Clear it
cache.delete(key)
```

### 9.7 Audit org alignment
```bash
kubectl exec -i -n backend $POD -- python manage.py audit_org_capabilities --org $ORG_ID
```
See Part 2.6.

### 9.8 audit_rbac_flags
```bash
# Find all orgs missing flags
kubectl exec -i -n backend $POD -- python manage.py audit_rbac_flags --missing-only
```

---
## Part 10 — Common Recovery Patterns
### 10.1 Hard-delete an organization
Django admin bulk-delete is broken (issue #48 — custom manager interacts badly with bulk action). Use shell:
```python
from nebelus.core.models import Organization
from django.contrib.admin.utils import NestedObjects
ORG_ID = 'TO_DELETE'
org = Organization._base_manager.get(id=ORG_ID)
# Preview
n = NestedObjects(using='default')
n.collect([org])
print('Cascade preview:')
print(n.nested())
# Confirm, then delete
org.delete()
print('Deleted')
```
For GDPR Article 17 (customer-initiated deletion), the proper path is `background.tasks.delete_organization` task which performs the full cascade (PostgreSQL → Qdrant → GCS → Redis → verification) with per-step audit. See `Engineering-Summary-2026-04-to-06-v5.md` PR #60.

### 10.2 Stale per-org cache
Symptoms: agent edits don't take effect; model picker shows old options; permissions don't update after role change.
```python
from django.core.cache import cache
ORG_ID = 'YOUR_ORG_ID'
cache.delete(f'agents_framework_{ORG_ID}')
# Aggressive: clear all per-org agent caches platform-wide
client = cache.client.get_client(write=True)
for key in client.keys(':1:agents_framework_*'):
    client.delete(key)
```

### 10.3 Migration not applied (rare since Jun 15)
`migrate --noinput` is now a pre-rollout step in the deploy pipeline. If you suspect a migration is missing:
```bash
kubectl exec -i -n backend $POD -- python manage.py showmigrations | grep -v "[X]" | grep -v "^$"
# Lists unapplied migrations
```
Manual apply if needed:
```bash
kubectl exec -i -n backend $POD -- python manage.py migrate --noinput
```

### 10.4 Workflow agent state silently empty
If a workflow agent's downstream node reports "no data":
1. Verify writers wrap values in lists: `set_state('field', [value])` (list-reducer requirement)
2. Verify both `workflow` and `pattern_config` are mirrored (runtime reads `pattern_config`)
3. See `Workflow-Agent-Building-Runbook.md` §5.1 + §1.6

### 10.5 Branding / Custom Domain 404 on save
1. Run `audit_org_capabilities --org $ORG_ID` to see Module ↔ FeatureFlag mismatch
2. Enable both Module Option (visible+activated) AND FeatureFlag
3. Hard-refresh portal

### 10.6 HTTP 402 "insufficient funds" on non-USD org agent run
1. Verify `Organization.currency` is correctly set
2. Verify `CreditBalance(credit_type='<currency-lower>')` exists and has positive balance
3. Verify `multi_currency_ledger` AND `multi_currency_billing` feature flags are enabled (see Part 3.4)
4. If any of these are missing, the credit-access-control falls back to `CreditBalance.get_or_create_usd()` hardcoded path

### 10.7 Vertex AI region routing error
If LLM calls 404 with region issue:
1. Verify `Organization.allowed_regions = ['eu']`
2. Verify `VERTEXAI_LOCATION=europe-west4` in configmap (Gemini)
3. For Anthropic 4.6: must use `vertex_location=europe-west1`
4. For Anthropic 4.7/4.8: must use `aiplatform.eu.rep.googleapis.com` endpoint

### 10.8 Agent loop / runaway responses
See Part 12 — full case study + emergency kill playbook.

---
## Part 11 — Django Admin Access
The Django admin UI is available at `https://api.nebelus.ai/admin/` (Admin-only).

| Operation | Admin Path | Notes |
|---|---|---|
| List/edit Organizations | Core → Organizations | Use shell `_base_manager` for cascade ops |
| Toggle Module Options | Control → Organization Module Option | Slow for many; use shell |
| Toggle Feature Flags | Core → Organization Feature Flag | Per-org filter available; model name is `OrganizationFeatureFlag` |
| Create BillingPlan | Control → Billing Plan | Margin override field exposed |
| Create BillableUnit | Control → Billable Unit | Unit cost + currency |
| Create TriggerRule | Control → Billable Unit Trigger Rule | Event type dropdown |
| List Roles | Core → Role | Per-org filter |
| View LoginEvent | Core → Login Event | Read-only |
| View CreditTransaction | Control → Credit Transaction | Read-only; audit trail |
| Edit Permission registry | (not exposed) | Edit `permissions_registry.py` + migration |
| Add Modules to catalog | (rare) | Edit migrations only |

**Custom OrganizationManager note:** the default queryset filters orgs where `owner IS NULL`. Use shell `_base_manager` for system-org operations.

---
## Part 12 — External Webhook Providers
This section documents external webhook integrations and their diagnostic playbooks.

### 12.1 T2 / WhatsApp Cloud API webhook architecture
Inbound user message flow for T2-hosted WhatsApp agents:
```
User WhatsApp message
  → Meta delivers to T2's WA Business endpoint (gray double-check)
  → T2 forwards to Nebelus webhook URL: https://api.nebelus.ai/w/<webhook_key>?X-Webhook-Token=<token>
  → WebhookIngressService.ingest() filters (echo/status detection), creates WebhookEvent (status='received')
  → Celery agents.tasks.webhook_received picks up the event
  → WebhookExecutor.execute() → Agent.execute_from_webhook_conversation()
  → Webhook.extract_conversation_data() resolves fields per Webhook.conversation_mapping JSON
  → resolve_deployment_conversation creates/finds DeploymentUser + DeploymentThread + Thread
  → Agent runs with the message
  → Agent calls send_whatsapp_message tool to reply (blue checks appear on user's WA)
```

### 12.2 T2 webhook payload format (post-2026-06-09)
T2 standardized to the official WhatsApp Cloud API format ~June 9, 2026. Previous format was Facebook Messenger-style `entry[].messaging[]`. Current format is `entry[].changes[].value.*`.

**Real-message payload (agent should process):**
```json
{
  "entry": [{
    "id": "<WABA_id>",
    "changes": [{
      "field": "messages",
      "value": {
        "contacts": [{"wa_id": "<user_phone>", "profile": {"name": "..."}}],
        "messages": [{
          "id": "wamid....",
          "from": "<user_phone>",
          "text": {"body": "user text"},
          "type": "text",
          "timestamp": "..."
        }],
        "metadata": {"phone_number_id": "<business_phone_id>", "display_phone_number": "..."},
        "messaging_product": "whatsapp"
      }
    }]
  }],
  "object": "whatsapp_business_account"
}
```

**Status callback payload (agent should NOT process — skipped by `WebhookIngressService._should_skip_event`):**
```json
{
  "entry": [{
    "id": "<WABA_id>",
    "changes": [{
      "field": "messages",
      "value": {
        "contacts": [{"wa_id": "...", "user_id": "..."}],
        "metadata": {...},
        "statuses": [{
          "id": "wamid....",
          "status": "delivered",   // or "read", "sent", "failed"
          "recipient_id": "..."
        }],
        "messaging_product": "whatsapp"
      }
    }]
  }],
  "object": "whatsapp_business_account"
}
```

Note: `entry[0].id` is the **WhatsApp Business Account ID**, NOT the phone_number_id. The phone_number_id (used for `T2WebhookManager.identify()` deployment lookup) lives at `value.metadata.phone_number_id`.

### 12.3 Canonical T2 conversation_mapping
The DEFAULT_T2_CONVERSATION_MAPPING constant in `nebelus/agents/models.py` is the source of truth for new T2 webhook deployments (post-PR #147). Existing T2 webhooks created before #147 have been manually ORM-patched in production.

```python
DEFAULT_T2_CONVERSATION_MAPPING = {
    "external_user_id": {"source": "payload", "path": "entry[0].changes[0].value.contacts[0].wa_id"},
    "message_text": {"source": "payload", "path": "entry[0].changes[0].value.messages[0].text.body"},
    "message_id": {"source": "payload", "path": "entry[0].changes[0].value.messages[0].id"},
    "conversation_id": {"source": "payload", "path": "entry[0].id"},
    "context_fields": [
        {"label": "User WhatsApp", "source": "payload", "path": "entry[0].changes[0].value.contacts[0].wa_id"},
        {"label": "Business WhatsApp", "source": "deployment_config", "path": "from_number"},
        {"label": "Conversation ID", "source": "payload", "path": "entry[0].id"},
        {"label": "Ticket ID", "source": "payload", "path": "entry[0].id"},
        {"label": "Message ID", "source": "payload", "path": "entry[0].changes[0].value.messages[0].id"},
        {"label": "Default Human Agent ID", "source": "deployment_config", "path": "t2_default_agent_id"},
    ],
}
```

### 12.4 Status-callback filtering
`WebhookIngressService._should_skip_event()` (in `nebelus/agents/services/webhooks.py`) drops the following before the Celery task is enqueued:
- WhatsApp Cloud delivery / read / sent status callbacks (presence of `entry[].changes[].value.statuses` without `messages`)
- Echo events where the message's `from` equals the business `phone_number_id`
- Legacy Facebook page-style status events (`entry[].messaging[].type == "message_status"`)
- Empty-content messages without quick_reply or attachments

If status events ARE invoking the agent (per pod logs), the filter has a gap — see Part 12.5 for diagnosis.

### 12.5 Case study — June 22, 2026 T2 WhatsApp loop
Symptoms: first WhatsApp test message to a T2 agent produced a flood of replies — 76 webhook events on Student Support Assistant, 154 on Patient Engagement Assistant in ~30 minutes; threads ballooned to 152 and 308 messages respectively.

Root cause: chain of 4 bugs.
1. T2 changed webhook payload format June 9 (Facebook Messenger-style → WhatsApp Cloud API standard).
2. All four T2 agents had `Webhook.conversation_mapping` pointing at old paths.
3. `Webhook.extract_conversation_data` raised `ValidationError({field: msg, ...})` (dict-of-dict shape) which crashed in Django 5.2 with `AttributeError: 'ValidationError' object has no attribute 'error_list'`, masking the real "missing required field" error.
4. `WebhookIngressService._should_skip_event` only knew the old `entry[].messaging[]` format — it didn't recognize new-format status callbacks. Every reply the agent sent produced 2 status callbacks (delivered + read), which came back as "fresh inbound", invoked the agent again with empty content, and looped geometrically.

Fix (server PR #147, merged 2026-06-22):
1. Add `entry[].changes[]` detection to `_should_skip_event` for status callbacks + business-phone-id echoes.
2. Update `DEFAULT_T2_CONVERSATION_MAPPING` to new paths.
3. Fix `ValidationError` construction to dict-of-list shape.
4. Update `T2WebhookManager.normalize_events()` (bypass path) to translate new format.

Live ORM patches (applied before #147 shipped, still in place):
- Updated `Webhook.conversation_mapping` on all 4 T2 agents (Student Support, Patient Engagement, Digital Banking, Citizen Digital) to new paths.
- Soft-deleted (`is_removed=True`, title prefix `[QUARANTINED ...]`) the two polluted threads.

### 12.6 Emergency playbook — runaway WhatsApp agent
If a T2 (or any) WhatsApp agent enters a loop:

```bash
# 1. Restart agents-deployment to kill in-flight Celery workers (this stops the loop immediately)
kubectl rollout restart deployment/agents-deployment -n backend

# 2. Flip the relevant agent(s) to draft so new events can't trigger them
POD=$(kubectl get pods -n backend -o name | grep app-deployment | head -1 | cut -d/ -f2)
cat <<'STOP' | kubectl exec -i -n backend $POD -- python manage.py shell
from nebelus.agents.models import Agent
from django.db import transaction

AGENT_IDS = [
    'ea12ad52-6775-4a3d-812d-c6c53e14b312',  # Student Support
    '8c9adf30-59d8-40c0-aeab-d8f160f3b88d',  # Patient Engagement
]
ORG_ID = '6c09b035-bf01-4468-8aa9-355a20266bcd'  # T2

with transaction.atomic():
    for aid in AGENT_IDS:
        a = Agent.objects.get(id=aid)
        a.status = 'draft'
        a.save(update_fields=['status', 'updated_at'])
        print(f'  draft: {a.name}')

from django.core.cache import cache
cache.delete(f'agents_framework_{ORG_ID}')
print('  cache cleared')
STOP

# 3. Purge any pending Celery agents-queue tasks
AGENT_POD=$(kubectl get pods -n backend -o name | grep agents-deployment | head -1 | cut -d/ -f2)
kubectl exec -n backend $AGENT_POD -- celery -A nebelus purge -Q agents -f

# 4. Quarantine the polluted threads (soft-delete, not hard-delete — preserve audit trail)
cat <<'QUARANTINE' | kubectl exec -i -n backend $POD -- python manage.py shell
from nebelus.agents.models import Thread, Message
from django.utils import timezone
from datetime import timedelta

since = timezone.now() - timedelta(hours=12)
AGENT_IDS = ['ea12ad52-...', '8c9adf30-...']

for aid in AGENT_IDS:
    threads = Thread.objects.filter(agent_id=aid, created_at__gte=since)
    for t in threads:
        msg_count = Message.objects.filter(thread=t).count()
        # Mark only the giant looped threads
        if msg_count > 50:
            t.title = f'[QUARANTINED {timezone.now():%Y-%m-%d}] {t.title}'
            t.is_removed = True
            t.save(update_fields=['title', 'is_removed', 'updated_at'])
            print(f'  quarantined: {t.id} ({msg_count} messages)')
QUARANTINE
```

Then diagnose: check `WebhookEvent.processing_error` for the failing events, look for status-callback payloads, find the gap in `_should_skip_event` if any. After the bug is fixed and deployed, flip the agents back to `status='active'` and clear cache.

### 12.7 Operational notes on T2
- T2 retries unacknowledged webhooks. Webhook endpoint MUST return 200 within ~5 seconds even on processing failure (we do — the Celery handoff guarantees fast response).
- `T2ConversationHandler` already has a dedup layer via `_t2_dedup_key()` cached in Redis for 300 seconds, protecting against T2-side retries.
- The agent loop on 2026-06-22 was NOT caused by T2 retries — it was caused by status callbacks being treated as fresh inbound. Different bug class.
- Worth confirming with T2 if you see repeated formats changes — they may roll out further changes.

---
## Part 13 — References & Standing Issues
### Key documentation
- **`Infrastructure.md`** — full infrastructure topology, security posture, compliance
- **`Codebase_Analysis.md`** — engineering audit, §8 operational patterns
- **`Engineering-Summary-2026-04-to-06-v5.md`** — full PR history Apr-Jun 2026
- **`Session_Continuation_Summary_updated.md`** — quick-resume context
- **`Workflow-Agent-Building-Runbook.md`** — workflow agent deep-dive
- **`HANDOVER_Nebelus_updated.md`** — full handover doc

### Standing P1 issues
| # | Item |
|---|---|
| #41 | `ai_tool_adapter` LLM calls bypass module gate + async-unsafe ORM |
| #47 | `test-core.yml` explicit allow-list (new tests silently skipped) |
| #48 | Django admin bulk-delete of Organization 500s |
| #49 | GKE master-authorized-networks travel access toil (need IAP/bastion) |
| #50 | agents-framework cache not invalidated on LiteLLM catalog update |
| #80 | Automate sandbox image rebuild on `Dockerfile.sandbox` changes |
| #81 | LHM `report_builder_agent` picks irrelevant `agents.File` id every run |
| #82 | `pattern_config` ↔ `Agent.workflow` JSONField dual-write hazard |
| #85 | Custom domain `OrganizationCustomDomain` lifecycle is **unwired**: nothing flips `status: verified→active` or updates `ssl_status` after Caddy issues a cert. Functionally fine (`verified` is served everywhere), but the portal's "provisioning/active" hints never fire and ops can't read cert state from the DB — needs a Caddy cert-event hook or a reconcile job |
| #86 | `caddy-prod` deploy workflow is `.disabled` — edge/Caddyfile changes ship only via a manual `nebelus_caddy` image rebuild + `caddy-deployment` rollout. Re-enable or document a one-command deploy |

### Recent PR landmarks (2026-06)
| PR | Description |
|---|---|
| #71 | Per-org data retention policy + Celery beat purge |
| #79 | P0 pydantic field hotfix for PythonAstREPLTool |
| #83 | Phase 0 RBAC hotfixes (in progress) |
| #144 | CI deploy kubectl retry (self-heal worker restart loop) |
| #145 | `apply_default_flags` includes 4 billing flags + admin "Defer activation" + `send_activation_email` action |
| #147 | T2 WhatsApp webhook fix (status callback filter + new payload mapping + ValidationError construction + bypass path) |
| #148 | White-label PR1 — branded transactional emails (`_branding_email_context` sweep; guest-invite str-id bug) |
| #149 / portal #65 | White-label PR3 — public branding-by-host endpoint + portal pre-auth branding |
| #150 | White-label PR4 — partner cascade (`Partner.root_organization`; own→partner→default waterfall) |
| #151 | White-label PR2 — per-tenant Mailgun sender domain (premium, flag-gated) |
| #152 / portal #66 | White-label cleanup — DDF empty-message P0 + filed backlog (sender inheritance, host-aware reset, public-branding cache) |
| #153 / portal #67 | White-label PR5 — custom-domain edge (Caddy on-demand TLS → portal; DNS-records UX). See §2.11 |

### Permission codes glossary (key codes)
| Code | Roles holding it |
|---|---|
| `agent.read` | Admin, Manager, Rep |
| `agent.read_config` | Admin, Manager (CL-10) |
| `agent.create`/`update`/`delete` | Admin, Manager |
| `billing.update_payment_method` | Admin only |
| `member.invite` | Admin, Manager |
| `governance.manage` | Admin only |
| `usage.read` | Admin, Manager, Rep (own data) |
| `usage.read_org` | Admin, Manager (cross-user) |
| `role.manage` | Admin only |
| `module.org_admin.view` | Admin only |
| `module.billing.view` | Admin, Manager |
| `module.usage_consumption.view` | Admin, Manager, Rep |
| `module.usage_units.view` | Admin, Manager |
| `module.api_keys.view` | Admin (per CL-11b fix) |
| `module.integrations.view` | Admin (per CL-11b fix) |
| `module.custom_domain.view` | Admin only |
| `module.branding.view` | Admin only |

### Key org IDs (production)
| Org | UUID |
|---|---|
| Nebelus internal | `3702a9ef-5fda-4bd8-a126-83d0c4ed007f` |
| NovaLink | `37c30a46-9d7c-4296-aeff-9d350f7daf71` |
| CR Health | `9b8dd7e5-8b09-4389-9b65-df691100227f` |
| LHM | `19b9b614-6033-47bc-8757-df2af0257f59` |
| Gemeente Lochem | `1d43f416-3ffd-464a-935b-562cc84982ec` |
| Prospectief | `<see Session_Continuation_Summary>` |
| SV Land | `81e2293e-ddaa-4c0e-998c-a31e868be18f` |
| T2 | `6c09b035-bf01-4468-8aa9-355a20266bcd` |

### Quick command cheat sheet
```bash
POD=$(kubectl get pods -n backend -o name | grep app-deployment | head -1 | cut -d/ -f2)
AGENT_POD=$(kubectl get pods -n backend -o name | grep agents-deployment | head -1 | cut -d/ -f2)

# Provisioning
kubectl exec -i -n backend $POD -- python manage.py apply_default_flags --org $ORG_ID
kubectl exec -i -n backend $POD -- python manage.py set_org_currency --org $ORG_ID --currency EUR
kubectl exec -i -n backend $POD -- python manage.py seed_fx_rate --quote EUR --rate 0.92
kubectl exec -i -n backend $POD -- python manage.py grant_credits --org $ORG_ID --amount 50000 --reason "wire"  # do NOT use --dry-run, it's broken
kubectl exec -i -n backend $POD -- python manage.py audit_org_capabilities --org $ORG_ID
kubectl exec -i -n backend $POD -- python manage.py audit_rbac_flags --org $ORG_ID

# Audit ops
kubectl exec -i -n backend $POD -- python manage.py audit_rbac_flags --all-orgs
kubectl exec -i -n backend $POD -- python manage.py audit_rbac_flags --missing-only
kubectl exec -i -n backend $POD -- python manage.py showmigrations | grep -v "\[X\]"

# Manual migrate (rare since Jun 15)
kubectl exec -i -n backend $POD -- python manage.py migrate --noinput

# Sandbox image rebuild (manual until #80)
gcloud builds submit --config=cloudbuild-sandbox.yaml --project=nebelus .
kubectl rollout restart deployment/docker-dind-deployment -n backend

# Emergency: kill runaway agent
kubectl rollout restart deployment/agents-deployment -n backend
kubectl exec -n backend $AGENT_POD -- celery -A nebelus purge -Q agents -f
```

---
**End of Operations Runbook.**
This document is the operational reference for everyday Nebelus platform tasks. For deep-dive on a specific subsystem, see the linked companion documents. For new operations that emerge in future sprints, add a new sub-section here with: probe pattern, apply pattern, gotchas, and any Django admin alternative.
