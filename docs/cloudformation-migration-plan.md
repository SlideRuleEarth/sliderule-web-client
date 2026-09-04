# Terraform → CloudFormation migration plan (web client deployment)

| | |
|---|---|
| **Status** | DRAFT — plan only, no template or Makefile code yet |
| **Branch** | `cloudformation-migration-plan` |
| **Tracking issue** | none yet (open one and rename the branch `issue-NNNN-cloudformation-migration` if you want the repo's usual convention) |
| **Owner** | Carlos E. Ugarte |
| **Authored by** | Claude Code (Fable 5.1), 2026-09-03, from the repo contents and the local Terraform state |
| **Review** | Reviewed before commit; rounds from the plan PR onward are logged in the [Review log](#review-log) |
| **Last updated** | 2026-09-04 |

This document is the single source of truth for the migration. It is meant to
be handed off: anyone (or any agent) picking it up should be able to see what
was decided, what is done, what is next, and what still needs checking.

---

## 0. How to use this document

- **Progress lives in the checkboxes** in [§8 Phase plan](#8-phase-plan). Tick
  them as work lands. Do not delete finished items; the history is the point.
- **Givens** ([§1.3](#13-givens)) are inputs the owner has fixed. They are not
  up for review; the plan is built on them. **[§1.5](#15-prerequisites)** is
  the separate question of what must already be true of the machine and the
  account — read it before starting anything.
- **Decisions** ([§6](#6-design-decisions)) are choices the plan makes and
  that review can still change. Each has a status (`proposed` / `accepted` /
  `rejected`). Change the status; do not rewrite the alternatives.
- **Anything uncertain is tagged `VERIFY`** and collected in
  [§10](#10-things-to-verify). Resolve them there and reference the source.
- **Reviews before the first commit are folded into the text**, not logged as
  a trail — the [Review log](#review-log) records only that they happened.
  From the plan PR onward, **each review round** (Codex, human, another Claude
  session) appends a row with what changed as a result, and the
  [Decision log](#decision-log) records status changes to §6 items.
- **Who runs what.** Everything that touches AWS is run by the repo owner.
  Claude Code in this repo is blocked from `aws` and `terraform` by
  `~/.claude/settings.json` (deny rules plus neutered `AWS_*` env). Agents
  author templates, Makefile changes, docs and offline lint (`cfn-lint`); the
  owner runs `aws cloudformation ...`, `terraform ...`, and the `make`
  deploy/destroy targets. Steps below are labelled **[agent]** or **[owner]**.

---

## 1. Goals, non-goals, givens

### 1.1 Goals

1. Replace `terraform/` with a CloudFormation template that describes the same
   two environments (test and production) and produces the same public
   behaviour at the same URLs.
2. Migrate each environment by **destroying the Terraform-managed resources
   and recreating them from the template** (G1, G2).
3. Keep the Makefile as the canonical interface. `make deploy-client-to-*`,
   `make live-update-*` and `make destroy-client-*` keep their names and their
   meaning; only the implementation changes.
4. Retire Terraform completely: no `terraform/` directory, no S3 state, no
   provider lockfile, no Terraform references in docs, `CLAUDE.md` or memory.
5. Align with how the rest of SlideRule deploys infrastructure (plain YAML
   templates driven by `aws cloudformation` from a Makefile — see
   [§4.6](#46-existing-cloudformation-conventions-in-the-organisation)).
6. Because the stack is created fresh, adopt the current CloudFront
   primitives (Origin Access Control, a cache policy, AAAA records, a tighter
   method list) at creation rather than as follow-ups (D1).

### 1.2 Non-goals

- Zero-downtime cutover. A near-zero-downtime variant exists (pre-create the
  stack without aliases, move the aliases, import the DNS records) but every
  step of it adds a template condition or a resource import. G1 makes it
  unnecessary. See [§2.1](#21-alternatives-considered).
- CDK, SAM, Rain, StackSets, nested stacks. One template, one stack per
  environment, driven by the AWS CLI.
- Changing the release workflow (`src-tag-and-push`, release notes, GitHub
  releases). Untouched.
- Changing what the site serves: headers, CSP, SPA fallback, apex behaviour
  and `robots.txt` handling are reproduced exactly (§5.3).

### 1.3 Givens

Fixed by the owner. The plan is built on these and does not revisit them.

| # | Given |
|---|---|
| **G1** | **An outage of roughly an hour per environment is acceptable.** The site is a static SPA with no server-side state; everything in the bucket is rebuilt from git by `make live-update`. |
| **G2** | **Only domains and URLs must be preserved.** Distribution IDs, `*.cloudfront.net` names, bucket names and certificate ARNs may all change, and nothing is allowed to depend on them. |
| **G3** | **The client host is always `client.<apex>`.** Serving the client at the apex itself was supported once and is retired. Neither the template nor the Makefile handles `DomainName == DomainApex`. |
| **G4** | **`DOMAIN_APEX` becomes the Makefile's single environment input**, with `DOMAIN` derived as `client.$(DOMAIN_APEX)`. This ships as its own small PR before any template code (§5.4). |
| **G5** | **PR order:** this plan alone → the G4 Makefile PR → Phase 1 (template, stack targets, CI). Decisions in §6 are settled through the plan PR's review, not before. |
| **G6** | **`terraform destroy` is trusted.** The owner runs it routinely and it is reliable. The plan builds no leftover detection or extra confirmation around it; Terraform's own plan-and-confirm prompt is the gate. |
| **G7** | **Both environments start from a working Terraform deployment.** `terraform apply` is clean in each workspace and the live resources match `terraform/`. The plan neither verifies this nor carries recovery paths for a stale or partial starting state. |

### 1.4 Constraints

- `sliderule.slideruleearth.io` stays hardcoded in the client (see
  `CLAUDE.md`). Infrastructure parameters are the *client* hosts only.
- The apex hosts nothing: `/` 301s to `<client>/landing`, everything else 404s
  at the edge. The CloudFront function that implements this must survive the
  migration byte-for-byte in behaviour (`CLAUDE.md`, "The apex, the client,
  and crawlers").
- `robots.txt` publishing rules (`upload-robots`, `PROD_DOMAIN`) are
  unaffected and must stay that way.
- The stack **must live in `us-east-1`**: CloudFront only accepts ACM
  certificates from that region, the Terraform provider already targets it,
  and both buckets are there. This is a constraint, not a setting, so
  `STACK_REGION` is `override`-assigned and every **ACM and CloudFormation**
  call passes `--region $(STACK_REGION)` explicitly (§5.4) — the calls where a
  wrong region silently produces an unusable certificate or acts on a
  same-named stack elsewhere. `sts` and `route53` are global services and take
  no region; S3 takes one at bucket creation.
- Both environments live in one AWS account (`742127912612` per the test
  state; V5 confirms production). Every stack-mutating target checks the
  caller's account against it before doing anything.
- No new npm dependencies, and no installed Python tool either: `cfn-lint` is
  run by `uv` straight from `cloudformation/requirements-lint.txt` (§5.5). The
  only new prerequisite is `uv`.

### 1.5 Prerequisites

What must already be true of the machine and the account. The *assumptions*
the plan rests on are §1.3; the *tasks* are §8 Phase 0. This section is what to
check before starting either, and it is the one place a second operator should
be handed.

**On the machine**

| Tool | Needed for | Note |
|---|---|---|
| `aws` | every AWS step, all owner-run | `2.36.39` (upgraded 2026-09-04, in Phase 0 and so before the Phase 2 rehearsal). It supports `delete-stack --deletion-mode FORCE_DELETE_STACK`, the last resort in §7.3 (V8). **Do not upgrade it again between the rehearsal and a cutover** — the rehearsal's value is that it exercises the toolchain the window will use |
| `terraform` | the cutover only — `plan`, `state pull`, `state rm`, `destroy`, `workspace delete`. Gone after Phase 5 | `1.14.9` (V9), current enough for every command the runbook uses. The provider is pinned at `hashicorp/aws` 5.31.0 by `.terraform.lock.hcl` |
| `uv` | `make lint-cfn`, which runs `cfn-lint` from the pinned requirements file (§5.5) | **The only new prerequisite this migration adds.** `cfn-lint` itself is deliberately not installed (§3.6) |
| `make`, `git`, Node, npm | the existing build and deploy path, unchanged | Node and npm are version-pinned; see `CLAUDE.md` |

**In the account**

- **Credentials resolving to account `742127912612`** (§1.4; V5 confirms
  production is the same account). Every stack-mutating target runs
  `check-account` first, so an expired session fails immediately and changes
  nothing — including mid-cutover, where re-authenticating and re-running the
  target is the entire recovery.
- **Write access to** CloudFront (distributions, origin access control, cache
  policy, response-headers policy, functions, invalidations), ACM (request,
  describe and delete certificates **in `us-east-1`**), Route 53 (change record
  sets in the apex's public zone; list zones), S3 (create and configure the
  permanent bucket, put its policy, upload and delete objects) and
  CloudFormation (change sets, stacks, termination protection). Read on STS for
  the account guard. The template creates **no IAM resources**, which is why
  `aws cloudformation deploy` needs no `--capabilities` (§5.4).
- **Until Phase 5, read/write on the Terraform state** under
  `s3://sliderule/tf-states/…` and `s3://sliderule/tf-workspaces/…`. Two things
  about that bucket are easy to trip over: it is in **`us-west-2`**, unlike
  everything else in this plan, and the backend declares **no DynamoDB lock
  table**, so nothing stops two concurrent `terraform` runs from racing on the
  same state. One operator at a time, and never a `terraform` command from a
  second machine during a cutover.
- **The apex's public hosted zone exists and is the only zone with that name.**
  The lookup filters out private zones and `check-stack-vars` insists on
  exactly one match (R8).

**Not required:** `rain`, `sam`, `cfn-guard`, `taskcat`, `cdk`, an installed
`cfn-lint`, or any new npm dependency.

---

## 2. Executive summary

- Author **one CloudFormation template**, `cloudformation/web-client.yaml`,
  with four parameters: `DomainName`, `DomainApex`, `S3BucketName`,
  `HostedZoneId`. No conditions. Resource names derive from `AWS::StackName`.
  The bucket is **not a stack resource**: it is created once per environment,
  outside the stack, and never deleted (D8) — the org's docs-site pattern.
- Run **one stack per environment** in `us-east-1`, named after the Terraform
  workspace it replaces (`client-testsliderule-org-web-client`,
  `client-slideruleearth-io-web-client`). The permanent bucket is
  `STACK_BUCKET`, whose name defaults to the stack's, and it outlives any
  number of stack creates and deletes (D8);
  `stack-destroy` empties it and verifies it is empty, nothing more.
- Before any template code, a small stand-alone PR makes `DOMAIN_APEX` the
  Makefile's single environment input and derives `DOMAIN` from it (G4).
- From Phase 1 on the Makefile speaks CloudFormation: the generic
  `deploy`/`destroy` names move to the `stack-*` targets, and Terraform
  survives only as `terraform-destroy`. Between the Phase 1 merge and its
  cutover an environment is under an **infrastructure freeze** (content
  deploys via `live-update` continue as normal); each environment's wrappers
  switch buckets only after that environment's cutover.
- **Cut over each environment with one runbook** (§7.2): retain the ACM
  validation CNAME, `terraform-destroy`, `deploy-client-to-<env>` (stack create + build + upload + invalidation),
  verify, retire the Terraform workspace. A scratch-hostname rehearsal
  proves the template creates a working environment before any live host is
  touched (D9); test goes first, timed; production follows in an announced
  window sized from that measurement.
- Rollback is fix-forward, with explicit recovery paths for every failed
  stack state (§7.3).
- Then delete `terraform/`, fix the docs, add `cfn-lint` to CI.

### 2.1 Alternatives considered

**Resource import** (bring the live resources under a CloudFormation stack
with an `IMPORT` change set). Keeps IDs and needs no outage, but brings an
identifier file per environment, a drift-cleanup loop, `DeletionPolicy:
Retain` on everything, and — the real cost — exact name and property parity
with what Terraform created, which forbids adopting OAC or cache policies
until afterwards and leaves open questions about how several resource types
behave on import. G1 and G2 remove every reason to pay that.

**Near-zero-downtime recreate** (create the stack without aliases, move the
aliases with `associate-alias`, import the two DNS records, then destroy
Terraform's resources). Shortens the outage to a few minutes at the price of a
template condition, a one-off import, and a multi-step manual handoff. Not
worth it under G1.

---

## 3. Current state (as-is)

### 3.1 Source files

| Path | Role |
|---|---|
| `terraform/backend.tf` | S3 backend: bucket `sliderule`, key `tf-states/web-client.tfstate`, `workspace_key_prefix = tf-workspaces`, region `us-west-2` |
| `terraform/main.tf` | AWS provider in `us-east-1` with `default_tags`; instantiates `./modules` |
| `terraform/variables.tf` | `domainApex`, `domainName`, `domain_root`, `s3_bucket_name`, `cost_grouping` |
| `terraform/output.tf` | echoes the three domain variables |
| `terraform/modules/vars.tf` | module inputs (same four names) |
| `terraform/modules/bucket.tf` | bucket, public-access block, OAI-scoped `s3:GetObject` bucket policy |
| `terraform/modules/cloudfront.tf` | response headers policy (CSP etc.), client distribution, OAI, apex CloudFront function, apex distribution |
| `terraform/modules/route53.tf` | hosted-zone lookup (`private_zone = false`), ACM cert (apex + wildcard, DNS validation), two validation CNAMEs, cert validation waiter, two alias A records |
| `terraform/.terraform.lock.hcl` | provider `hashicorp/aws` 5.31.0 |
| `.gitignore` lines 49–76 | Terraform ignores (`.terraform/`, `*.tfstate`, overrides, tfplan) |

`terraform/.terraform/environment` is a local, git-ignored file naming the
workspace that bare `terraform` commands act on. The Makefile targets always
`workspace select` explicitly; §7.2 requires the same before any `state rm`,
because those commands are typed by hand.

### 3.2 Environments

Two Terraform workspaces, each `<DOMAIN>-web-client`:

| | test | production |
|---|---|---|
| `DOMAIN` (client host) | `client.testsliderule.org` | `client.slideruleearth.io` |
| `DOMAIN_APEX` | `testsliderule.org` | `slideruleearth.io` |
| `S3_BUCKET` (old, destroyed at cutover) | `testsliderule-webclient` | `slideruleearth-webclient` |
| `DOMAIN_ROOT` (`firstword` of `DOMAIN` split on `.`) | `client` | `client` |
| Hosted zone | `Z1039660300QJ4GJRI5NT` | look up |
| Client distribution | `E675VP482LBL9` | look up |
| Apex distribution | `E1LORWIIYX82WR` | look up |
| OAI | `EU1VKF419H8A8` | look up |
| Response headers policy | `74ea47ad-…` (`client-testsliderule-org-shp`) | look up |
| Apex function | `client-testsliderule-org-apex-redirect` | `client-slideruleearth-io-apex-redirect` |
| ACM cert | `…certificate/2cf02d11-…` (`testsliderule.org` + `*.testsliderule.org`) | look up |
| ACM validation CNAME | `_e359ba1d28ec1f967e44241b8709daa5.testsliderule.org` (one record serves both the apex and the wildcard) | look up |

The test-column IDs were read from the Terraform state on 2026-09-04. They
matter only for the pre-cutover checks (V1, V2); none of them survives the
migration (G2) — except the validation CNAME, which is deliberately kept
(§7.2 step 4).

`DOMAIN_ROOT` is `client` in both environments because it takes the first
label of the *client* host, so the `Project` tag is `web-client-client` in both
environments. Nothing reads it; D10 fixes the value anyway.

### 3.3 Resources per environment (17 Terraform addresses, 14 managed)

```
data.aws_caller_identity.current              (unused)
data.aws_iam_policy_document.s3_policy
data.aws_route53_zone.public
aws_s3_bucket.this_site_bucket                 force_destroy = true
aws_s3_bucket_public_access_block.web_client_site_access_block
aws_s3_bucket_policy.web
aws_cloudfront_origin_access_identity.origin_access_identity
aws_cloudfront_response_headers_policy.security_headers_policy
aws_cloudfront_distribution.my_cloudfront      client host
aws_cloudfront_function.apex_redirect[0]       viewer-request, cloudfront-js-2.0
aws_cloudfront_distribution.apex_redirect[0]   apex host
aws_acm_certificate.mysite                     DNS validation
aws_route53_record.cert_validation_root
aws_route53_record.cert_validation_wildcard    (same CNAME as _root; ACM issues one token per domain)
aws_acm_certificate_validation.cert
aws_route53_record.web                         A alias → client distribution
aws_route53_record.apex_redirect[0]            A alias → apex distribution
```

Provider-level `default_tags` on everything: `Owner=SlideRule`,
`Project=web-client-${domain_root}`, `cost-grouping=web-client`,
`terraform-base-path=<path inside repo>`.

### 3.4 Makefile surface that changes

| Target / variable | Today | After |
|---|---|---|
| `deploy` | `terraform init` → `workspace select -or-create` → `validate` → `apply` with four `-var`s | Phase 1 on: alias of `stack-deploy` (§5.4). The Terraform recipe survives as `terraform-destroy` until Phase 5 |
| `destroy` | `terraform destroy` (bucket has `force_destroy`) | Phase 1 on: alias of `stack-destroy` — deletes the stack, then empties the bucket and verifies it is empty; the bucket itself is never deleted (D8) |
| `deploy-client-to-*`, `destroy-client-*` wrappers | `deploy` + `live-update` / `destroy`, with `DOMAIN`, `S3_BUCKET`, `DOMAIN_APEX` spelled out | `DOMAIN_APEX=<apex>` only; CloudFormation from Phase 1 on; never override `S3_BUCKET` |
| `live-update-*`, `release-live-update-to-*` wrappers | same triple spelled out | `DOMAIN_APEX=<apex>` plus `S3_BUCKET=<Terraform-era bucket>` **until that environment's cutover**, then `DOMAIN_APEX` only (D8) |
| `DOMAIN_APEX ?= $(DOMAIN)` | defaults the apex to the client host — a leftover of the retired client-at-apex mode | removed; `DOMAIN ?= client.$(DOMAIN_APEX)` replaces it (G4) |
| `S3_BUCKET` | set explicitly in every wrapper | Phase 1 on it means **uploads only**, defaulting to `$(STACK_BUCKET)`; the pre-cutover wrapper override with the Terraform-era name is its only other source. The bucket the *stack* is built against is the separate, locked `STACK_BUCKET` (§5.4, D8) |
| `DISTRIBUTION_ID` | `aws cloudfront list-distributions` by alias | unchanged (D6); it finds the new distribution the moment it carries the alias |
| `APEX_DISTRIBUTION_ID` | defined, never referenced | removed (G4) |
| `DOMAIN_ROOT` | first label of the client host (`client`); feeds only the Terraform `domain_root` var, i.e. the `Project` tag | kept while `terraform-*` targets exist (they pass it); removed with them in Phase 5. The stack's `Project` tag derives from `DOMAIN_APEX` instead, so nothing in the CloudFormation era needs it (D10) |
| `check-vars` | one check for everything, and it requires `DISTRIBUTION_ID` — which cannot exist before the first stack create | split: `check-vars` (live-update inputs, unchanged), `check-stack-vars` (create/update inputs), `check-destroy-vars` (destruction gates) — §5.4 |
| `make help` coverage | four targets never appear, because `help` lists only lines matching `## `: `deploy` and `destroy` have a **single** `#` (`deploy: # Deploy the web client…`), so the two most consequential targets in the deploy path are invisible; `check-vars` and `verify-s3-assets-testsliderule` have no comment at all | all four get `## ` lines in the G4 PR. It matters more after Phase 1, when `deploy`/`destroy` become the `stack-*` aliases — a destructive target nobody can discover from `make help` is worse than an undocumented one |
| parallel safety | nothing prevents `make -j`; `live-update`'s build and upload steps are prerequisites and so may run concurrently, publishing an `index.html` that names assets not yet uploaded | `.NOTPARALLEL:` (G4 PR, §5.4) |
| `verify-s3-assets` | prints `MISSING` but exits 0 (the `while` loop swallows the status) | exits non-zero on any missing asset, so `live-update` actually fails (G4 PR) |
| `live-update`, `upload-*`, `src-tag-and-push` recipes | S3 sync + invalidation | **untouched** — only the wrappers' variable lists change |

### 3.5 Docs and metadata that mention Terraform

- `README.md` — "We use HashiCorp Terraform to deploy this website" (Deployment section)
- `CLAUDE.md` — repo layout table, "The apex, the client, and crawlers" (cites `terraform/modules/cloudfront.tf`), "Build / deploy"
- `.gitignore` — Terraform block
- `web-client/src/assets/content/release-notes/v4.4.6.md`, `v4.7.0.md` — historical, leave alone
- Claude memory (`~/.claude/projects/.../memory/`): `aws-credentials-denied.md` (mentions the `terraform` deny rule), `apex-404-testsliderule-deploy.md` (names `terraform apply` as the only way to republish the function), `agent-discovery-files.md` (cites `terraform/modules/route53.tf:10`)

### 3.6 Tooling on the owner's machine

`aws`, `terraform` and `uv` (Homebrew). **`cfn-lint` is deliberately not
installed** — there is no `cfn-lint` on `PATH` — because `lint-cfn` runs it
through `uv` from the pinned requirements file (§5.5). The current release is
**1.56.0**, verified on 2026-09-04 by running it that way. Not installed and
not needed: `rain`, `sam`, `cfn-guard`, `taskcat`, `cdk`.

---

## 4. Target state

### 4.1 Repository layout

```
cloudformation/
├── web-client.yaml              the template (single file)
├── README.md                    deploy / cutover / destroy runbook; points back here
├── requirements-lint.in         what we ask for: cfn-lint==<version>
└── requirements-lint.txt        generated by `uv pip compile`, committed (§5.5)
```

`terraform/` is deleted in Phase 5, not before. No parameter files (D3).

### 4.2 Stack naming and region

- Region: `us-east-1` (hard requirement, see §1.4).
- Stack name: `$(DOMAIN_SLUG)-web-client` where `DOMAIN_SLUG = $(subst .,-,$(DOMAIN))`.
  This mirrors the Terraform workspace name `<DOMAIN>-web-client` with the
  dots replaced (stack names cannot contain dots). See D7.
  - test: `client-testsliderule-org-web-client`
  - production: `client-slideruleearth-io-web-client`
- Termination protection **on** for production, enabled by `make stack-protect`
  right after the create. `stack-destroy` refuses while it is on; turning it
  off is a separate deliberate step (`stack-unprotect`), never a side effect.

### 4.3 Parameters

| Parameter | Source in Makefile | Replaces |
|---|---|---|
| `DomainName` | `$(DOMAIN)`, derived as `client.$(DOMAIN_APEX)` (G4) | `var.domainName`. Kept as a parameter so the template states the client host once instead of repeating `!Sub "client.${DomainApex}"` in every alias, record, output and the function body; the Makefile derives it, so the two cannot disagree. |
| `DomainApex` | `$(DOMAIN_APEX)` | `var.domainApex` |
| `S3BucketName` | `$(STACK_BUCKET)` (locked; defaults to `$(STACK_NAME)`, §5.4): the environment's permanent bucket, created once by `make bucket-create` before the first stack create and never deleted (D8) | `var.s3_bucket_name`. A parameter, not a resource — exactly as in the org's docs-site template. |
| `HostedZoneId` | `$(HOSTED_ZONE_ID)`: `aws route53 list-hosted-zones-by-name --dns-name $(DOMAIN_APEX)` filtered to the exact name **and `Config.PrivateZone == false`**, and rejected unless exactly one ID comes back (Terraform's lookup had `private_zone = false`; a private zone of the same name would otherwise win a name-only filter). Overridable for the scratch rehearsal, whose apex is a subdomain of the zone. | `data.aws_route53_zone.public` — CloudFormation has no data sources. `AWS::Route53::RecordSet` could take `HostedZoneName`, but `AWS::CertificateManager::Certificate` DNS auto-validation needs the **ID**, so pass the ID once and use it everywhere. |

No slug parameter: Terraform used `replace(var.domainName, ".", "-")` to name
resources, and CloudFormation has no string-replace intrinsic, but fresh
resources can be named from `${AWS::StackName}` (the pattern the org's
docs-site template uses).

`domain_root` / `cost_grouping` become tag values on the stack, not template
parameters (D10).

### 4.4 Conditions

None. Terraform's `count = var.domainName != var.domainApex ? 1 : 0` on the
apex function, apex distribution and apex A record existed for the retired
client-at-apex mode. Both environments have a separate apex and always will
(G3), so the three apex resources are unconditional.

### 4.5 Resource mapping

Logical IDs are proposals; settle them during review. Items marked **D1**
differ deliberately from what Terraform built; everything else is a faithful
translation.

`DefaultCacheBehavior` **requires** `TargetOriginId` and
`ViewerProtocolPolicy` on every distribution; both are spelled out in the rows
below so the template cannot be written from this table and then fail
validation.

**Every property whose Terraform default differs from the CloudFormation
default is set explicitly**, because "unset" does not mean the same thing in
the two tools and an omission is invisible in review. Two are known:
`HttpVersion` (Terraform 5.31 defaults to `http2`; a CloudFormation
distribution must not be left to its own default — the live distributions
negotiate HTTP/2 today, verified 2026-09-04) and `IPV6Enabled` (D1c). Treat any
other property the template does not state as a question for review, not as a
safe default.

| Terraform address | CloudFormation logical ID / type | Notes |
|---|---|---|
| `aws_s3_bucket.this_site_bucket` + `aws_s3_bucket_public_access_block.*` | *not in the stack* | Created once per environment by `make bucket-create` (D8): `create-bucket` in `us-east-1` plus `put-public-access-block` with all four flags on. The stack references it by name (`S3BucketName`) and never creates, replaces or deletes it. `force_destroy` has no successor: `stack-destroy` empties the bucket after the stack is gone and verifies it is empty (D5). |
| `aws_s3_bucket_policy.web` | `SiteBucketPolicy` — `AWS::S3::BucketPolicy` | **D1a:** `s3:GetObject` for `Principal: {Service: cloudfront.amazonaws.com}` with `Condition: {StringEquals: {AWS:SourceArn: [<client distribution ARN>, <apex distribution ARN>]}}`. Both ARNs, because both distributions name the bucket as their origin (the apex one never fetches, but the policy should not depend on that). `Bucket: !Ref S3BucketName`. No dependency cycle: the policy depends on the distributions; the distributions depend only on the parameter. |
| `aws_cloudfront_origin_access_identity.origin_access_identity` | `OriginAccessControl` — `AWS::CloudFront::OriginAccessControl` | **D1a:** replaces the OAI. `SigningBehavior: always`, `SigningProtocol: sigv4`, `OriginAccessControlOriginType: s3`. Name `${AWS::StackName}-oac`. |
| *(new)* | `CachePolicy` — `AWS::CloudFront::CachePolicy` | **D1b:** `MinTTL 0`, `DefaultTTL 3600`, `MaxTTL 86400` (Terraform's values), no cookies/headers/query strings, `EnableAcceptEncodingGzip` and `Brotli` true. Name `${AWS::StackName}-cache`. Replaces legacy `ForwardedValues`. |
| `aws_cloudfront_response_headers_policy.security_headers_policy` | `SecurityHeadersPolicy` — `AWS::CloudFront::ResponseHeadersPolicy` | Name `${AWS::StackName}-headers`; copy the six header blocks verbatim; the CSP string becomes `!Sub` with `${DomainApex}` in the two `connect-src` entries. **Behaviour must be identical** (§5.3). |
| `aws_cloudfront_distribution.my_cloudfront` | `ClientDistribution` — `AWS::CloudFront::Distribution` | Origin `Id: s3-client`, `DomainName: !Sub "${S3BucketName}.s3.${AWS::Region}.amazonaws.com"`, `OriginAccessControlId: !GetAtt OriginAccessControl.Id`, `S3OriginConfig: {OriginAccessIdentity: ""}` (AWS requires the empty string when an OAC is used). `DefaultCacheBehavior`: `TargetOriginId: s3-client` (**required**), `ViewerProtocolPolicy: redirect-to-https` (**required**), `CachePolicyId: !Ref CachePolicy`, `ResponseHeadersPolicyId`, `Compress: true` (**D1b**), `AllowedMethods: [GET, HEAD, OPTIONS]` (**D1d**), `CachedMethods: [GET, HEAD]`. `Enabled: true`, `HttpVersion: http2`, `PriceClass_200`, `IPV6Enabled: true`, `DefaultRootObject: index.html`, `Aliases: [DomainName]`, two `CustomErrorResponses` (403 and 404 → 200 `/index.html`, `ErrorCachingMinTTL: 0`), `ViewerCertificate` sni-only `TLSv1.2_2021`. |
| `aws_cloudfront_function.apex_redirect[0]` | `ApexRedirectFunction` — `AWS::CloudFront::Function` | `Name: ${AWS::StackName}-apex-redirect`, `Runtime: cloudfront-js-2.0`, `AutoPublish: true`, `FunctionConfig.Comment` (required) set, `FunctionCode: !Sub` of the exact JS in `cloudfront.tf`. Only `${var.domainApex}` and `${var.domainName}` are substituted; there are no JS template literals, so no `${!…}` escaping is needed today — add a comment warning future editors. |
| `aws_cloudfront_distribution.apex_redirect[0]` | `ApexDistribution` — `AWS::CloudFront::Distribution` | Origin `Id: s3-apex-dummy` pointing at the same bucket with the same OAC. `DefaultCacheBehavior`: `TargetOriginId: s3-apex-dummy` (**required**), `ViewerProtocolPolicy: redirect-to-https` (**required**, and what Terraform sets today — without it the apex would answer plain HTTP), `CachePolicyId: !Ref CachePolicy`, GET/HEAD only, `FunctionAssociations: [{EventType: viewer-request, FunctionARN: !GetAtt ApexRedirectFunction.FunctionARN}]`, `Enabled: true`, `HttpVersion: http2`, `PriceClass_100`, `IPV6Enabled: true` (**D1c** — off today), `Aliases: [DomainApex]`, same `ViewerCertificate`. The cache policy is shared with the client distribution but never exercised: a viewer-request function that returns a response short-circuits before the cache lookup, so nothing here is fetched or cached. |
| `aws_acm_certificate.mysite` + `aws_acm_certificate_validation.cert` | `Certificate` — `AWS::CertificateManager::Certificate` | `DomainName: !Ref DomainApex`, `SubjectAlternativeNames: ['*.${DomainApex}']`, `ValidationMethod: DNS`, `DomainValidationOptions` for both names with `HostedZoneId`. CloudFormation waits for `ISSUED` itself. The validation CNAME is **retained from the Terraform era** (§7.2 step 4), so validation of the new certificate is immediate rather than a fresh DNS round-trip (V6). (D2) |
| `aws_route53_record.cert_validation_root` / `_wildcard` | *not modelled* | The one CNAME they both describe is removed from Terraform state before the destroy and left in the zone. ACM validation CNAMEs are stable per account and domain and are shared by every certificate for that domain in the account, so deleting it could break the renewal of a certificate this plan knows nothing about (V7). |
| `aws_route53_record.web` | `ClientAliasA` — `AWS::Route53::RecordSet` | `Type: A`, `AliasTarget: {DNSName: !GetAtt ClientDistribution.DomainName, HostedZoneId: Z2FDTNDATAQYW2}` (CloudFront's fixed zone), `EvaluateTargetHealth: false`. |
| *(new)* | `ClientAliasAAAA` — `AWS::Route53::RecordSet` | **D1c:** same target, `Type: AAAA`. IPv6 is already enabled on the distribution; only the record was missing. |
| `aws_route53_record.apex_redirect[0]` | `ApexAliasA` — `AWS::Route53::RecordSet` | same shape for `DomainApex`. |
| *(new)* | `ApexAliasAAAA` — `AWS::Route53::RecordSet` | **D1c** |
| `data.aws_route53_zone.public` | `HostedZoneId` parameter | see §4.3 |
| `data.aws_caller_identity.current` | dropped | unused |
| `data.aws_iam_policy_document.s3_policy` | inline `PolicyDocument` | |
| `output.*` | `Outputs` | `ClientDistributionId`, `ApexDistributionId`, `ClientDistributionDomainName`, `BucketName`, `CertificateArn`. `BucketName` echoes the `S3BucketName` parameter and exists for humans reading `stack-outputs`; the destroy gate reads the **parameter** rather than this output (D5). |
| provider `default_tags` | stack `--tags` | propagate to every taggable resource; values per D10 |

### 4.6 Existing CloudFormation conventions in the organisation

The main `sliderule` repo already does exactly this pattern for the docs site
(`docs/cloudfront/documentation.yml`, deployed by
`targets/slideruleearth/Makefile` with `aws cloudformation create-stack
--region us-east-1`). Things worth copying so the two look alike:

- plain `AWSTemplateFormatVersion: "2010-09-09"` YAML, short `!Sub`/`!Ref`
  style, no Metadata/Interface blocks
- resource names built from `${AWS::StackName}`
- the site bucket passed in as a parameter, never created by the stack
- `PriceClass_200`, `TLSv1.2_2021`, `Z2FDTNDATAQYW2` alias target
- ACM certificate created **inside** the stack with `DomainValidationOptions`
  + `HostedZoneId`
- `HOSTED_ZONE_ID` resolved in the Makefile with
  `aws route53 list-hosted-zones-by-name`
- stack outputs read back with `aws cloudformation describe-stacks --query`

Where we deliberately differ: the docs stack still uses OAI +
`ForwardedValues`; ours uses OAC + a cache policy (D1). Like the docs stack,
ours takes a pre-existing bucket as a parameter and never owns it (D8). Ours
also has the apex distribution, the function and the wildcard certificate.
And our zone lookup filters out private zones and insists on exactly one
match.

Also historical: the README says the client was derived from
`aws-samples/amazon-cloudfront-secure-static-site` v0.11, which is itself a
CloudFormation project. Useful as a reference for idioms, not as a base — it
uses nested stacks, a custom resource to copy content and (in old versions)
Lambda@Edge for headers, none of which we want.

---

## 5. Detailed design

### 5.1 Template skeleton (prose, not code)

```
AWSTemplateFormatVersion: "2010-09-09"
Description: SlideRule web client — S3 + CloudFront (client host) and apex redirect
Parameters:   DomainName, DomainApex, S3BucketName, HostedZoneId
Resources:    SiteBucketPolicy, OriginAccessControl, CachePolicy,
              SecurityHeadersPolicy, Certificate,
              ClientDistribution, ClientAliasA, ClientAliasAAAA,
              ApexRedirectFunction, ApexDistribution, ApexAliasA, ApexAliasAAAA
Outputs:      ClientDistributionId, ApexDistributionId, ClientDistributionDomainName,
              BucketName, CertificateArn
```

No `Conditions`, no `DeletionPolicy` (D4), no `Metadata`, and no bucket
resource (D8).

### 5.2 Things the template cannot express and how they move to the Makefile

| Terraform feature | Replacement |
|---|---|
| `replace()` for slugs | not needed — names come from `${AWS::StackName}` |
| `data.aws_route53_zone` (public only) | `HostedZoneId` parameter, looked up with the same public-only filter |
| `count` on the apex resources | nothing — the apex is always separate (G3) |
| `aws_s3_bucket` + its public-access block | `make bucket-create`, run once per environment; the stack takes the name as a parameter (D8) |
| `force_destroy` on the bucket | the bucket is never deleted; `stack-destroy` empties it after the stack delete and verifies it is empty (D5) |
| `default_tags` with `path.cwd` | static stack tags |
| `depends_on` bucket → distribution | none needed: the bucket pre-exists; the origin domain is built from the `S3BucketName` parameter |
| workspaces | one stack per environment; the stack name carries the environment |
| remote state in S3 | none needed; CloudFormation is the state |

### 5.3 Behaviour parity (what must be identical, what may differ)

Resource identity is not preserved (G2), so "parity" means what a viewer, a
crawler and the deploy scripts can observe.

**Must be identical:**

- every response header the headers policy sets, including the full CSP
  string (diff the two policies' JSON after the test cutover)
- SPA fallback: 403 and 404 from the origin → 200 with `/index.html`
- apex: `/` → 301 to `https://<client>/landing`; every other path → 404
  `text/plain` with the same body
- HTTPS redirect, `sni-only`, `TLSv1.2_2021`
- HTTP/2 available on both hosts (`HttpVersion: http2`; HTTP/3 is not enabled
  today and this migration does not add it)
- `Cache-Control` on uploaded objects (set by `upload-*`, not by the stack)
- `robots.txt` handling (`upload-robots`, unchanged)
- cache TTLs 0 / 3600 / 86400 for objects that carry no `Cache-Control`

**Deliberately different (D1):** OAC instead of OAI; compression on (it was
never enabled — `compress` defaults to false in the Terraform resource); AAAA
records for both hosts, plus IPv6 turned on for the apex distribution, which
has it off today; client distribution allows `GET, HEAD, OPTIONS` only.

**Different and irrelevant (G2):** distribution IDs and `*.cloudfront.net`
names, bucket name, certificate ARN, OAI/OAC IDs, policy IDs and names.

**Untouched: users' browser-side data.** Everything the client keeps on the
user's machine — science records as Parquet files in the Origin Private File
System (read by DuckDB-WASM), request metadata in IndexedDB (`SlideRuleDb`,
Dexie), preferences in `localStorage`, and the Cache Storage entries that
`SrClearCache` clears — is keyed by the browser on the **origin**: scheme +
host + port. The origin `https://client.<apex>` does not change, so none of
that data is affected by the cutover, by the outage, or by any resource ID
changing behind CloudFront. Nothing on the server side holds user data; the
bucket only holds the built site. The one way infrastructure could interfere
is a CSP that stops workers or WASM from loading — which would break access
to the data, not the data — and that is why the headers policy must be
byte-identical.

### 5.4 Makefile design

From the Phase 1 merge on, the Makefile speaks CloudFormation: **the generic
names `deploy`/`destroy` mean the `stack-*` targets, and the only Terraform
target left is `terraform-destroy`.** There is deliberately no
`terraform-deploy`: between the Phase 1 merge and its cutover an environment
is under an infrastructure freeze — content deploys (`live-update-*`,
`release-*`) continue, infrastructure does not change. If an emergency
Terraform change is ever needed in that window, it is run directly from
`terraform/` with the workspace selected (G6), not through `make`. The
cutover runbook calls `terraform-destroy` and the `stack-*` names
explicitly; the environment wrappers are CloudFormation-only from Phase 1
and must not be run against an environment that is still on Terraform
(`stack-deploy` refuses when it finds the alias on a distribution the stack
does not own).

**Environment input** (the G4 PR — lands before any template code):

```
DOMAIN_APEX ?=                                   # the ONE per-environment input
DOMAIN      ?= client.$(DOMAIN_APEX)             # client host is always client.<apex> (G3)
```

`?=` keeps `DOMAIN` overridable, and `check-vars` gains the assertion that it
equals `client.$(DOMAIN_APEX)` — in this PR, not Phase 1, because `check-vars`
and `live-update` already exist and a stale `make live-update DOMAIN=… S3_BUCKET=…`
is exactly what the assertion is for. Phase 1 factors it into `check-derived`
and adds the `STACK_NAME` clause. `APEX_DISTRIBUTION_ID`
(defined, never referenced) and the `DOMAIN_APEX ?= $(DOMAIN)` default are
deleted in the same PR, the wrappers shrink to `DOMAIN_APEX=<apex>` plus
`S3_BUCKET=<current bucket>`, and `verify-s3-assets` is made to exit non-zero
on a missing asset (today the `while` loop swallows the status, so it is a
report, not a gate). Two details the fix has to get right, because the obvious
one-line version of it silently still passes: the loop body runs in a
**pipeline subshell**, so a flag set inside it is lost at the `done` — the
loop needs to be one group that carries its own status,
`… | { rc=0; while read -r asset; do … rc=1; …; done; exit $$rc; }` — and an
**empty asset list must fail too**, since a `grep -oE` that matches nothing
leaves the pipeline's status to `sort`, which succeeds, so the check would
pass vacuously against an unbuilt or malformed `dist/index.html`. `S3_BUCKET` stays explicit because it still names the
Terraform-era buckets; `DOMAIN_ROOT` stays because the Terraform targets pass
it. `PROD_DOMAIN` / `ROBOTS_SRC` keep keying on `DOMAIN`, for the reason
`CLAUDE.md` gives. The PR touches no infrastructure and is verifiable
offline: `make help DOMAIN_APEX=testsliderule.org` must print the same
`DOMAIN` the wrappers spell out today.

**Stack variables** (Phase 1):

```
override DOMAIN_SLUG  = $(subst .,-,$(DOMAIN))   # purely derived; `override` so no caller can decouple the
override STACK_NAME   = $(DOMAIN_SLUG)-web-client # stack (and with it the default bucket) from the host it serves
override STACK_REGION := us-east-1               # NOT a preference: CloudFront only accepts ACM certificates from
                                                 # us-east-1 (§1.4), so this is an AWS constraint. Every ACM and
                                                 # CloudFormation call passes `--region $(STACK_REGION)` explicitly,
                                                 # so a stray AWS_DEFAULT_REGION cannot reach the stack or its
                                                 # certificate. (S3 bucket calls pass it at create time; sts and
                                                 # route53 are global and take no region.)
override EXPECTED_AWS_ACCOUNT_ID := 742127912612 # `override` + `:=`: not changeable from the command line or the environment;
                                                 # every mutating stack target checks sts get-caller-identity against it (V5)
CFN_TEMPLATE    = cloudformation/web-client.yaml
# The bucket each environment's stack is built against: the origin in both
# distributions, the target of bucket-create/bucket-configure, and the only
# bucket stack-destroy ever empties. Locked, because a stack pointed at the
# wrong bucket is invisible until content stops appearing (R16).
# Default is the stack name. Fill one of these in ONLY if that name turned out
# to be unavailable at bucket-create time (D8) — a committed, reviewable edit,
# never a command-line override. They are `override` too: without that, locking
# STACK_BUCKET alone would be theatre, since `make BUCKET_<stack>=<anything>
# stack-deploy` would reach it through the $(or ...).
override BUCKET_client-testsliderule-org-web-client =
override BUCKET_client-slideruleearth-io-web-client =
override STACK_BUCKET = $(or $(BUCKET_$(STACK_NAME)),$(STACK_NAME))
S3_BUCKET      ?= $(STACK_BUCKET)                # the bucket UPLOADS go to. Overridable, and pre-cutover the
                                                 # live-update-*/release-* wrappers point it at the Terraform-era
                                                 # bucket (D8). No stack operation reads it.
HOSTED_ZONE_ID ?= $(shell aws route53 list-hosted-zones-by-name --dns-name $(DOMAIN_APEX) \
                    --query "HostedZones[?Name=='$(DOMAIN_APEX).' && Config.PrivateZone==\`false\`].Id" \
                    --output text | sed 's|/hostedzone/||')
                                                 # check-stack-vars fails unless this is exactly one ID
TAG_OWNER       = SlideRule                      # D10. The three values live here once and are rendered twice below,
TAG_PROJECT     = web-client-$(DOMAIN_APEX)      # because CloudFormation and S3 want different shapes for the same tags.
TAG_GROUP       = web-client
STACK_TAGS      = Owner=$(TAG_OWNER) Project=$(TAG_PROJECT) cost-grouping=$(TAG_GROUP)
                                                 # `aws cloudformation deploy --tags` form: space-separated Key=Value
S3_TAGSET       = TagSet=[{Key=Owner,Value=$(TAG_OWNER)},{Key=Project,Value=$(TAG_PROJECT)},{Key=cost-grouping,Value=$(TAG_GROUP)}]
                                                 # `aws s3api put-bucket-tagging --tagging` form; STACK_TAGS is NOT
                                                 # accepted here, which is why the values are factored out rather than
                                                 # the string reused (bucket-create, D8)
```

`HOSTED_ZONE_ID` and `DISTRIBUTION_ID` are recursively expanded, so their
`aws` calls run only when a target references them. Neither bucket variable
needs a lookup: the permanent bucket is created once, under a name that
defaults to the stack's, and never replaced (D8), so the name is known from the
Makefile without asking AWS.

**Why there are two bucket variables.** They answer different questions —
*which bucket is this stack built against* and *which bucket does this upload
go to* — and during the migration the answers differ. Collapsing them is the
failure this split exists to prevent: the runbook has the operator type
`S3_BUCKET=<old bucket>` on `terraform-destroy` (step 11), and the very next
command is `stack-deploy`. With one variable, a carried-over value would create
the stack against the **Terraform-era** bucket, `check-stack-vars` would pass
because that bucket really does exist (production deliberately retains it,
step 5), and nothing would look wrong until step 16 removed the wrapper
override — at which point uploads go to the new bucket while CloudFront still
serves the old one, and every subsequent deploy silently changes nothing.
`STACK_BUCKET` is `override` so no command line can reach it.

**What is locked and what stays open.** Everything derived — `DOMAIN_SLUG`,
`STACK_NAME` — and everything fixed by an external constraint —
`STACK_REGION`, `EXPECTED_AWS_ACCOUNT_ID` — is `override`, so no command line
or environment variable can decouple the stack from the host it serves or move
it out of `us-east-1`. Two stay overridable on purpose: `S3_BUCKET`, because
the pre-cutover wrappers must point `live-update` at the Terraform-era bucket
(D8), and `HOSTED_ZONE_ID`, because the scratch rehearsal's apex is a
subdomain of its zone (§7.5).

`DOMAIN` is the exception: it keeps `?=` but is **asserted** rather than
locked. Locking it would make `make live-update DOMAIN=… S3_BUCKET=…` — the
shape every wrapper used before the G4 PR, and the shape in anyone's shell
history — *silently* ignore the `DOMAIN` it was given and derive a different
one. An assertion fails loudly instead, which is what a stale invocation
deserves. `check-derived` therefore requires `DOMAIN` to equal
`client.$(DOMAIN_APEX)` exactly, and requires `DOMAIN_APEX` to be non-empty
first, so a missing input can never derive the plausible-looking `client.`
and carry it into an AWS call.

**Checks** — four, because the inputs differ by operation and one invariant
applies to all of them:

| Target | Verifies |
|---|---|
| `check-derived` | the invariants, before any AWS call: `DOMAIN_APEX` non-empty; `DOMAIN` **equals** `client.$(DOMAIN_APEX)`; `STACK_NAME` equals `$(subst .,-,$(DOMAIN))-web-client`. Cheap, offline, and a prerequisite of the three checks below — a mismatched pair must fail here, not halfway through a stack create in the outage window (R20). |
| `check-account` | `aws sts get-caller-identity` returns `$(EXPECTED_AWS_ACCOUNT_ID)`; prints the caller ARN. Prerequisite of every mutating `stack-*` target below. |
| `check-vars` | `check-derived`, then live-update inputs as today: `DOMAIN`, `S3_BUCKET`, `DOMAIN_APEX`, `DISTRIBUTION_ID` all non-empty; prints them |
| `check-stack-vars` | `check-derived`, then create/update inputs: `HOSTED_ZONE_ID` is exactly one ID; **`$(STACK_BUCKET)`** — never `$(S3_BUCKET)` — exists (`aws s3api head-bucket`; run `bucket-create` first if not); prints them. **Does not** require `DISTRIBUTION_ID` — it cannot exist before the first create. |
| `check-destroy-vars` | destruction gates, all before anything is touched: `check-derived`; `check-account`; the stack exists; its status is one of `CREATE_COMPLETE`, `UPDATE_COMPLETE`, `UPDATE_ROLLBACK_COMPLETE` — **not** `ROLLBACK_COMPLETE`, which is a failed-create shell holding nothing and belongs to `stack-delete-failed` (§7.3); `EnableTerminationProtection` is **false**; `CONFIRM_DESTROY` equals `$(DOMAIN)`; the stack's `S3BucketName` **parameter** equals `$(STACK_BUCKET)` (the bucket about to be emptied is the one this stack served) |

**Targets:**

| Target | Does | Creds |
|---|---|---|
| `lint-cfn` | `uv run --no-project --python 3.13 --with-requirements cloudformation/requirements-lint.txt cfn-lint $(CFN_TEMPLATE)` — versions come from the committed lock and the interpreter is pinned, so nothing is installed and local matches CI (§5.5) | none — agents can run it |
| `validate-cfn` | `aws cloudformation validate-template --region $(STACK_REGION)` | owner |
| `bucket-configure` | idempotent, safe to re-run: `check-derived` → `check-account` → prove the bucket is **this account's** (`aws s3api list-buckets` lists only buckets the caller owns, so `$(STACK_BUCKET)` must appear there; a bucket that merely answers `head-bucket` could belong to someone else) → `put-public-access-block` with all four flags true → `put-bucket-tagging --tagging '$(S3_TAGSET)'`. This is the recovery path when `bucket-create` dies after the create succeeds: the bucket then exists, so `bucket-create` correctly refuses to run again, and `bucket-configure` finishes the job. Run it any time to reassert the settings. | owner |
| `bucket-create` | one-time, per environment: `check-derived` → `check-account` → refuse if `$(STACK_BUCKET)` already exists → `aws s3api create-bucket` in `us-east-1` → `bucket-configure`. The tagging call is needed because the bucket is **not** a stack resource (D8), so the stack's `--tags` cannot reach it — without it the bucket would be the only untagged thing in the environment. It uses `S3_TAGSET`, not `STACK_TAGS`: S3 wants a `TagSet=[{Key=…,Value=…}]` structure where CloudFormation wants space-separated `Key=Value`, so §5.4 factors the three values out and renders both forms. Because the target runs once, a later change to the tag values does **not** retag the bucket; run `make bucket-configure` to reapply them. Never run again for that environment; there is deliberately no `bucket-delete` target (D8). | owner |
| `stack-status` | prints `StackStatus` and `EnableTerminationProtection` (or "no stack") | owner |
| `stack-deploy` | `check-account` → `check-stack-vars` → `lint-cfn` → proceed only if there is no stack or its status is `CREATE_COMPLETE`, `UPDATE_COMPLETE` or `UPDATE_ROLLBACK_COMPLETE`, refusing every other status with a pointer at §7.3 → if the stack does not exist yet, refuse if any distribution already carries `$(DOMAIN)` or `$(DOMAIN_APEX)` (Terraform still owns the environment; the query reads `not_null(Aliases.Items, \`[]\`)`, because a distribution with no aliases has no `Items` key and a bare `contains()` errors on it) → `aws cloudformation deploy --stack-name … --template-file … --region … --parameter-overrides … --tags … --no-fail-on-empty-changeset` → `stack-outputs` | owner |
| `stack-destroy` | `check-destroy-vars` → `delete-stack` → `wait stack-delete-complete` → `aws s3 rm s3://$(STACK_BUCKET) --recursive` → verify empty (`list-objects-v2 --max-keys 1` must return no keys; fail otherwise). The bucket itself is never deleted (D8). Stack first, contents second: a failed stack delete leaves the site's files where they were. | owner |
| `stack-protect` / `stack-unprotect` | `update-termination-protection --enable…` / `--no-enable…`; `stack-unprotect` also demands `CONFIRM_DESTROY=$(DOMAIN)` | owner |
| `stack-delete-failed` | the recovery path out of a failed state, and **not** a second way to delete a working stack: `check-derived` → `check-account` → the stack's status must be one of `ROLLBACK_COMPLETE`, `ROLLBACK_FAILED`, `CREATE_FAILED`, `DELETE_FAILED`, `REVIEW_IN_PROGRESS` (every other status, healthy or in-progress, is refused with a pointer at §7.3) → `CONFIRM_DESTROY` equals `$(DOMAIN)`, as `stack-destroy` demands → `delete-stack` → `wait`. Accepts two escalations, both refused in any status but `DELETE_FAILED`, which is the only status CloudFormation accepts them from: `RETAIN='<logical ids>'` passes `--retain-resources`, and `FORCE_DELETE=1` passes `--deletion-mode FORCE_DELETE_STACK` (V8 confirms the installed CLI supports it). It never touches the bucket. | owner |
| `stack-abort-create` | the only escape from a hung create, and the reason no hand-typed `delete-stack` appears anywhere in this plan: `check-derived` (the stack name is **derived**, never typed) → `check-account` → the status must be exactly `CREATE_IN_PROGRESS`, every other status refused → print the newest stack event and its age, so "stuck" is judged against evidence → `CONFIRM_DESTROY` equals `$(DOMAIN)` → `delete-stack` → `wait stack-delete-complete`. Touches no bucket. Conditions for using it at all: §7.3 | owner |
| `stack-prestage` | `check-derived` → `check-account`, then **one `$(MAKE)` per recipe line, in this order**: `build`; `upload-assets`; `upload-static`; `upload-robots`; `upload-index`; `verify-s3-assets` — each with `S3_BUCKET=$(STACK_BUCKET)`. Recipe lines are sequential whatever `-j` or an inherited `MAKEFLAGS` says; passing them as several goals to a single `$(MAKE)` would not be, and uploads could then race the build or `index.html` could land before the assets it names. Fills the permanent bucket before a window (§7.2 step 9) and proves it landed **while there is still time to fix it** — without this the first verification would be `stack-activate`, minutes after the old stack was destroyed and with the new one already serving. Deliberately **not** `live-update`: pre-cutover there is no new distribution to invalidate, and `check-vars` would resolve `DISTRIBUTION_ID` to the *old* distribution Terraform still owns, so this target needs no `DISTRIBUTION_ID` and does not invalidate | owner |
| `stack-activate` | the post-create step **when the bucket was pre-staged**: `check-derived` → `check-account` → `$(MAKE) verify-s3-assets S3_BUCKET=$(STACK_BUCKET)` → a precautionary `create-invalidation`. It does **not** build and does **not** upload, which is the entire point — see the note below on why `stack-upload` cannot be used here. It is self-checking: `verify-s3-assets` reads the asset names out of the local `web-client/dist/index.html` and fails unless exactly those objects are in the bucket, so a `dist/` that was rebuilt (or never pre-staged) is caught immediately rather than serving a half-updated site | owner |
| `stack-upload` | the post-create step **when the bucket was not pre-staged**, and the normal path outside a cutover: `check-derived` → `check-account` → `$(MAKE) live-update S3_BUCKET=$(STACK_BUCKET)`. The full path — build, upload, invalidate, `verify-s3-assets` — forced to the stack's own bucket. The forcing is the point: passing `S3_BUCKET` as a **sub-make command-line assignment** overrides the environment and any stale outer value, which plain `live-update` cannot do | owner |
| `stack-outputs` | `describe-stacks --query Stacks[0].Outputs` | owner |
| `stack-events` | `describe-stack-events` (watching a create, debugging a failed update) | owner |
| `terraform-destroy` | the current `destroy` recipe, renamed and otherwise unchanged (G6): `init` → `workspace select` → `validate` → `destroy` with the four `-var`s; Terraform's own plan-and-confirm prompt is the gate. Deleted in Phase 5. | owner |
| `deploy` / `destroy` | aliases of `stack-deploy` / `stack-destroy` from Phase 1 on | owner |
| `deploy-client-to-<env>` | `stack-deploy` then **`stack-upload`**, `DOMAIN_APEX` only. Not plain `live-update`: that reads `S3_BUCKET`, which the environment or a stale command line can still set, so a create could be followed by an upload to the *old* bucket — and `verify-s3-assets` would verify that bucket and report success while the new distribution served an empty one | owner |
| `destroy-client-<env>` | `stack-destroy`, `DOMAIN_APEX` only (plus `CONFIRM_DESTROY` from the caller) | owner |
| `live-update-<env>`, `release-live-update-to-<env>` | `live-update`, `DOMAIN_APEX` plus `S3_BUCKET=<Terraform-era name>` until the cutover; `DOMAIN_APEX` only after | owner |

**Why pre-staging needs `stack-activate` rather than `stack-upload`.** Every
`make build` injects a fresh `VITE_APP_BUILD_DATE`
([`Makefile` `build`](../Makefile)), and `SrBuildDate.vue` reads it through
`import.meta.env`, so Vite inlines the timestamp into the bundle. Two builds of
identical source therefore differ in content — at minimum in the chunk holding
`SrBuildDate`, which is `assets/index-<hash>.js`, the very file
`verify-s3-assets` checks — and a changed chunk gets a new hashed filename and
a new reference in `index.html`. (Not *every* asset changes: chunks that do not
contain the timestamp keep their hashes.)

Anything reaching `build` — `live-update`, and therefore `stack-upload` —
therefore replaces the staged artifact set, and `upload-assets` syncs
`--delete` ([`Makefile`](../Makefile)), so the previously staged bundle is
**deleted from the bucket** rather than left beside the new one. There is no
orphan and no fallback: the window would contain a full rebuild and a full
asset upload, which is precisely what step 9 exists to avoid. That is why §7.2
step 12 uses `stack-activate`, and why nothing between step 9 and step 13 may
run `make build`.

**Ordering inside the upload targets is load-bearing, and `make` does not
enforce it.** `live-update` lists `build upload-assets upload-static
upload-robots upload-index` as *prerequisites*, which `make -j` (or a
`MAKEFLAGS` inherited from a parent make) may run concurrently. The order
matters twice over: uploads must not start before `build` finishes writing
`dist/`, and `index.html` must land **after** the assets it names, or a viewer
briefly gets a page referencing objects that are not there yet.

**The G4 PR adds `.NOTPARALLEL:` to the Makefile** — one line, with a comment
saying why. Every target here orchestrates npm, Vite and `aws`; none of them
gains anything from `-j`, and several are unsafe under it. This is preferred
over restructuring `live-update`'s prerequisites because it is a smaller diff,
it cannot be undone by a later edit that adds a prerequisite without thinking,
and it protects every target at once rather than the one that prompted it.
This is **not** deferred to Phase 6: `stack-upload` delegates to `live-update`
and is both the cutover fallback and the ordinary post-migration deploy path,
and `live-update-<env>` is today's everyday content deploy — a race there is a
live bug, not a migration concern. `stack-prestage` additionally uses one
recipe line per step, which holds regardless.

`aws cloudformation deploy` needs no `--capabilities` flag: the template has
no IAM resources. A stack-drift target is not needed for the migration; add
one later if it earns its keep.

### 5.5 CI and pre-commit

- Add `lint-cfn` to `make ci-check` **and** to a new, tiny workflow
  `.github/workflows/cloudformation.yml` triggered on `cloudformation/**`,
  `Makefile` **and the workflow file itself** (installs `cfn-lint` from
  `cloudformation/requirements-lint.txt`, runs the target). Keeping it out of
  `playwright.yml` keeps the Playwright job unchanged. `CLAUDE.md` already
  warns that adding to `ci-check` alone does not add it to CI.
- **`requirements-lint.txt` pins one exact version** and **`uv` reads that file
  directly**, so `lint-cfn` is:

  ```
  lint-cfn:
  	uv run --no-project --python 3.13 \
  	  --with-requirements cloudformation/requirements-lint.txt \
  	  cfn-lint $(CFN_TEMPLATE)
  ```

  Nothing is installed, and the only prerequisite is `uv` itself rather than a
  correctly-installed `cfn-lint`. uv resolves and caches on first use (~90 ms
  warm, measured 2026-09-04).

  **`requirements-lint.txt` is a fully resolved lock, not a one-line pin.** Two
  files, the `pip-compile` pattern:

  ```
  cloudformation/requirements-lint.in    cfn-lint==1.56.0        # what we ask for
  cloudformation/requirements-lint.txt   generated, committed    # what actually gets installed
  ```

  regenerated with

  ```
  uv pip compile cloudformation/requirements-lint.in \
    -o cloudformation/requirements-lint.txt --universal --python-version 3.10
  ```

  `--universal` matters: a default `uv pip compile` resolves **for the machine
  that ran it**, and this one is macOS while CI is Linux. It is not
  hypothetical — compiling the same input both ways differs today, because
  `networkx` resolves to `3.4.2` below Python 3.11 and `3.6.1` at or above it.
  The platform-specific file records one of those with no marker; the universal
  file records both, with markers, and is therefore correct on either runner.
  `lint-cfn` additionally pins the interpreter (`uv run --python 3.13`), so the
  two sides resolve the same branch of those markers rather than merely being
  able to.
  Pinning only `cfn-lint` would leave its nine transitive dependencies floating
  within their own specifiers, and `uv run` resolves them fresh on each machine
  — so local and CI really could differ. One of them is `regex`, which ships
  new versions constantly. **What the lock buys is precise:** every version in
  the resolved set is fixed, so a `cfn-lint` release *or* a dependency release
  cannot change the result without a visible diff to a committed file. What it
  does not do is verify artefact integrity — add `--generate-hashes` if that is
  ever wanted.

  This is the rule the repo already enforces for Node and npm (`engines`,
  `packageManager`, `npm ci`, the lockfile drift check); a floating lint
  toolchain would be the one exception to it. The workflow installs `uv`
  (`astral-sh/setup-uv`) and calls `make lint-cfn`; `cloudformation/README.md`
  says the same for humans.
- Pre-commit: **do not** add `cfn-lint` to `pre-commit-check`; it is a Python
  dependency that not every contributor has, and the hook must stay at ~15 s.

---

## 6. Design decisions

Choices the plan makes on top of the givens. Status legend: `proposed`
(needs review) · `accepted` · `rejected`. Statuses change through the plan
PR's review (G5).

### D1 — Adopt current CloudFront primitives at creation — `proposed`

Because nothing is imported, there is no parity constraint on *how* the
behaviour is produced. Four small changes, each reviewable on its own line of
the template:

- **D1a — Origin Access Control** instead of the legacy OAI (AWS's
  recommended mechanism; needed for SSE-KMS and newer regions, harmless
  here). Bucket policy principal becomes `cloudfront.amazonaws.com` scoped by
  `AWS:SourceArn` to both distributions.
- **D1b — A cache policy** with Terraform's TTLs and compression enabled,
  instead of `ForwardedValues`. Compression was never on; enabling it is the
  one intended behaviour improvement (smaller JS/CSS/WASM transfers).
- **D1c — AAAA alias records, and IPv6 on the apex distribution.** The client
  distribution sets `is_ipv6_enabled = true`; the apex distribution does not
  set it at all, so it is **off** (the Terraform default is `false`). Neither
  host has an AAAA record, so IPv6-only clients cannot resolve either one.
  The template therefore sets `IPV6Enabled: true` **explicitly on both**
  distributions — never relying on a CloudFormation default — and adds an
  AAAA alias for each. §7.4's `dig +short <apex> AAAA` is what catches this
  being missed: an AAAA alias to a distribution without IPv6 answers with no
  records.
- **D1d — Client distribution allows `GET, HEAD, OPTIONS`** instead of all
  seven methods. Safe: every `POST` in the client source targets the
  SlideRule API host, the OAuth/provisioner endpoints or Google's tile
  service; none targets the client's own origin (V3).

**Alternative:** faithful translation (OAI, `ForwardedValues`, seven methods,
no AAAA), matching the org's docs-site template exactly, with these four as
follow-ups. Recommendation: take all four now; each is a few lines, and
follow-ups on a fresh stack are just more CloudFront update cycles.

### D2 — Certificate lives inside the stack, validation CNAME retained — `proposed`

Model `AWS::CertificateManager::Certificate` in the stack, as the docs-site
template does, **and keep the Terraform-era validation CNAME in the zone**
(`terraform state rm` it before the destroy, §7.2 step 4). ACM's validation
CNAME is the same for every certificate for a domain in the account, so with
the record already resolving the new certificate is issued within minutes of
the create starting, and the stack never sits in `CREATE_IN_PROGRESS`
waiting on DNS propagation. Keeping the record also protects any other
certificate for these domains that renews against it (V1).

**Alternative — pre-issue the certificate before the window** (a manual
`aws acm request-certificate` or a 15-line `web-client-cert.yaml` stack, as
the org's `certbot` stack does for its consumers) and pass `CertificateArn`
as a parameter. Removes certificate issuance from the outage entirely and
decouples the certificate's lifecycle from the site stack, at the cost of a
second stack (or an unmanaged certificate) and a `CERTIFICATE_ARN` lookup in
the Makefile. Recommendation: in-stack with the CNAME retained; switch to
pre-issuing if the scratch rehearsal (Phase 2) shows issuance taking more
than a few minutes, or if V1 finds a certificate shared with something else.

### D3 — Parameters via `--parameter-overrides` from the Makefile, no param files — `proposed`

The Makefile already owns every value (`DOMAIN_APEX`, and everything derived
from it) and looks up the zone; pass them on the command line, exactly like
the Terraform `-var` flags today. **Alternative:** committed JSON parameter
files per environment — more discoverable, but a second place where
`slideruleearth.io` is spelled out.

### D4 — No `DeletionPolicy` — `proposed`

The bucket is not a stack resource (D8), so the only things a
`DeletionPolicy` could protect are distributions, policies, a function and a
certificate — all recreated from the template in minutes. **Recommendation:**
none, on any resource; production is protected from an accidental delete by
termination protection (§4.2, `stack-protect`), and `stack-destroy` refuses
to run while it is on. **Alternative:** `Retain` on the certificate alone, so
a stack delete never leaves the domain without one — only worth it if V1 or
V7 find the certificate shared.

### D5 — `stack-destroy` gates everything, deletes the stack, then empties the bucket — `proposed`

`terraform destroy` today deletes the bucket and its contents without
ceremony (`force_destroy = true`). The new target never deletes the bucket
(D8): it deletes the stack, then empties the bucket and verifies it is empty.
Everything irreversible still sits behind `check-destroy-vars` (§5.4):
account, stack existence, a deletable status, termination protection already
off, `CONFIRM_DESTROY=<DOMAIN>`, and the stack's `S3BucketName` **parameter**
equal to `$(STACK_BUCKET)`, the bucket about to be emptied. The status
allowlist deliberately excludes `ROLLBACK_COMPLETE`: that is a create that
never served anything, so there is nothing to decommission, and emptying the
bucket would destroy content pre-staged for the window (§7.2 step 9). It goes
to `stack-delete-failed`, which touches no bucket. The gate reads the stack
**parameter**, not the `BucketName` output — the output merely echoes it, and
the parameter is what the distributions were actually built against. Stack first, contents second, so a
failed stack delete leaves the site's files where they were. Turning
termination protection off is `stack-unprotect`, a separate command that also
demands the confirmation — never a side effect of `destroy`.

### D6 — Keep resolving `DISTRIBUTION_ID` by alias — `proposed`

`live-update` finds the distribution with `list-distributions` by alias. It
finds the new distribution as soon as it carries the alias, and it works in
both the Terraform and the CloudFormation era, which is why it is the one
lookup that does not move to stack outputs now. (`STACK_BUCKET` needs no
lookup at all under D8: the bucket's name defaults to the stack's, so the
Makefile derives it.) Reading
`ClientDistributionId` from stack outputs too is a Phase 6 tidy-up.

### D7 — Stack name mirrors the Terraform workspace name — `proposed`

`$(DOMAIN_SLUG)-web-client`. **Alternative:** `web-client-<env>` with a
short environment label (`testsliderule`, `slideruleearth`) — friendlier in
the console, but a second naming scheme next to the hostnames.

### D8 — One permanent bucket per environment, outside the stack — `proposed`

Bucket names need not survive the migration (G2), but no *chosen* name can be
guaranteed at create time: names are global, S3 can hold a deleted name for an
unspecified time before the same account may reuse it, and any other account
may take a free name. The way to never depend on that is to create the bucket
**once** and never delete it. So `make bucket-create` creates
`$(STACK_BUCKET)` — which defaults to `$(STACK_NAME)`, i.e.
`client-testsliderule-org-web-client` and
`client-slideruleearth-io-web-client` — with the public-access block and tags,
before the first stack create; the template
takes the name as `S3BucketName` and attaches the bucket policy to it, exactly
as the org's docs-site template does; and `stack-destroy` empties the bucket
and verifies it is empty without touching the bucket itself. Consequences:
`STACK_BUCKET` is a known string, not a lookup; a stack can be deleted and
recreated any number of times against the same bucket; the bucket can be
pre-filled with the site before a cutover window (§7.2 step 9), taking the
build and upload out of the outage; and if the name should ever be taken at
that one-time creation, another is chosen once, with no pressure, and
recorded in the Makefile as that environment's `override BUCKET_<stack name>`
value, which `STACK_BUCKET` falls back to (§5.4) — a committed, reviewable
edit that is still unreachable from the command line. Until an environment's cutover its `live-update-*`
/ `release-*` wrappers override `S3_BUCKET` with the Terraform-era name; the
cutover runbook removes the override (§7.2 step 16). `deploy-client-to-*`
never overrides it.

The name appears as **two** Makefile variables, and the distinction is
load-bearing: `STACK_BUCKET` (locked) is what the stack is built against and
the only bucket `stack-destroy` empties, while `S3_BUCKET` (overridable,
defaulting to it) is only ever an upload target. §5.4 explains the failure that
splitting them prevents.
**Alternatives:** (a) the bucket as a stack resource with a
CloudFormation-generated name — collision-proof, but the name must be read
back from stack outputs for every upload, and the bucket dies with the stack;
(b) the bucket as a stack resource with a fixed name — needs the parameter
read back on every update and a collision fallback, all because a name was
chosen.

### D9 — Rehearse on scratch hostnames before touching the test site — `proposed`

`cfn-lint` and `validate-template` check syntax and schema; neither can tell
whether a property value is accepted by the service, whether a name is
available, whether the certificate issues, or whether CloudFront stabilises.
Only creating a stack does. The scratch stack does that against real AWS
without taking any live host down, and it times the create step for §7.3
before the test outage starts. Cost: about 45 minutes and cents.
**Alternative:** skip it and let the test cutover be the first real create —
the test site exists to be broken, but a template bug then extends the test
outage while it is fixed under time pressure, and the runbook is rehearsed
one time fewer before production.

### D10 — Stack tags — `proposed`

Terraform tags every resource `Owner=SlideRule`,
`Project=web-client-${domain_root}`, `cost-grouping=web-client` and
`terraform-base-path=<local path>`. **Nothing consumes these today** — no cost
report, dashboard or query keys on them — so the stack keeps the three that
might earn their keep later and drops the one that cannot:

- `Owner=SlideRule` and `cost-grouping=web-client` — unchanged.
- `Project=web-client-$(DOMAIN_APEX)` — `web-client-testsliderule.org` and
  `web-client-slideruleearth.io`. It replaces `web-client-${domain_root}`,
  which resolves to `web-client-client` in **both** environments (§3.2) and so
  names neither the project nor the environment. Dots are legal in tag values.
- `terraform-base-path` — **dropped**, nothing in its place. It recorded the
  checkout's path on whichever machine ran the apply; CloudFormation has no
  equivalent and needs none.

Because nothing reads the tags, fixing `Project` costs nothing now and leaves
the two environments distinguishable if cost allocation is ever switched on.
**Alternative:** `Project=web-client` with a separate `Environment` tag — a
fourth key for no present benefit.

---

## 7. Migration strategy

### 7.1 Sequence

```
Phase 0  prep           plan reviewed and merged; Makefile input PR (G4); TF state complete; pre-checks
Phase 1  author         template + stack-* / terraform-* targets + lint + CI; no AWS calls
Phase 2  rehearsal      scratch stack under testsliderule.org: prestage, create, activate, verify,
                        then stack-upload as the fallback, then destroy (D9)
Phase 3  test cutover   prestage; terraform-destroy client.testsliderule.org; create; activate; verify; TIME IT
Phase 4  prod cutover   announced window sized from Phase 3; identical runbook
Phase 5  decommission   delete terraform/ and the terraform-* targets, docs, .gitignore, memory, old buckets
Phase 6  follow-ups     DISTRIBUTION_ID from stack outputs (D6); anything D1 deferred
```

### 7.2 Cutover runbook (Phases 3 and 4, identical) — all **[owner]**

**Before the window**

1. `terraform workspace select <env>-web-client`, and confirm with
   `terraform workspace show`. Steps 2–6 all act on the selected workspace's
   state and are typed by hand, so getting this wrong strips the *other*
   environment's records. `terraform plan` should then show no changes; if it
   does not, the infrastructure freeze (§5.4) was broken and the drift needs
   explaining before the destroy.
2. **Snapshot, before anything below touches the state:**
   `terraform state pull > $ARCHIVE/<env>-pre-cutover.tfstate.json`, where
   `$ARCHIVE` is a directory **outside the checkout** (Phase 5 removes the
   Terraform ignore rules, so a file left at the repo root would become
   committable); plus `get-distribution-config` for both distributions,
   `get-response-headers-policy` and `get-function`. Steps 3–5 remove
   addresses from the state, and this archive is the only record of what
   Terraform managed before that.
3. **Certificate check on the known ARN** (from the state pull, V1):
   `aws acm describe-certificate --region us-east-1 --certificate-arn <arn> --query Certificate.InUseBy`
   must list exactly this environment's two distributions. **If it lists
   anything else**, the certificate has users this plan does not own:
   `terraform state rm module.cloudfront.aws_acm_certificate.mysite module.cloudfront.aws_acm_certificate_validation.cert`
   so the destroy leaves it in place. The new stack still issues its own
   certificate (D2) — two certificates for the same names coexist — or, if
   preferred, the retained ARN is passed in as a parameter (D2 alternative).
   The broader inventory of every certificate that shares the validation
   CNAME (V7) is a separate exercise; it never blocks the destroy, because
   the CNAME is retained regardless (step 4).
4. **Retain the validation CNAME:**
   `terraform state rm module.cloudfront.aws_route53_record.cert_validation_root module.cloudfront.aws_route53_record.cert_validation_wildcard`.
   From now on Terraform will not delete the record; CloudFormation's
   certificate will find it already resolving (V6).
5. Optional, recommended for production: `terraform state rm` the bucket, its
   policy and its public-access block too, so the destroy leaves the old
   bucket and its content in place as a fallback copy. Delete it by hand in
   Phase 5.
6. Optional: a second `terraform state pull > $ARCHIVE/<env>-pre-destroy.tfstate.json`
   — exactly what the destroy is about to remove.
7. Nothing outside this repo references the distribution IDs, the
   `*.cloudfront.net` names or the bucket name (V2).
8. `make lint-cfn` and `make validate-cfn` pass; `make stack-status` says "no
   stack"; for production, the test cutover has completed **and** a normal
   `make live-update-testsliderule` has since run cleanly against the new
   stack.
9. `make bucket-create DOMAIN_APEX=<apex>`: the environment's permanent
   bucket, created once and never deleted (D8). Then, recommended, pre-stage
   the site into it so the build and upload are out of the window:
   `make stack-prestage DOMAIN_APEX=<apex>`, which forces the upload to
   `STACK_BUCKET` rather than trusting whatever `S3_BUCKET` happens to hold
   and ends by running `verify-s3-assets` against it — so a bad or partial
   upload surfaces here, with the old site still up and no clock running,
   rather than in step 12.
   **From here until step 13, do not run `make build`** (nor anything that
   depends on it, including `live-update` and `stack-upload`): a rebuild
   changes the timestamp-bearing bundle's hash and throws the pre-staged
   artifact set away (§5.4).
   Leave `web-client/dist/` alone too — `stack-activate` checks the bucket
   against it.
10. Announce the window (production). Pick low traffic. Size it at twice the
    time Phase 3 measured.

**In the window** — the outage starts at step 11 and ends at step 13.

11. `make terraform-destroy DOMAIN_APEX=<apex> S3_BUCKET=<old bucket>` and
    answer Terraform's prompt. Expect 10–20 minutes; CloudFront disables each
    distribution, waits for that to deploy, then deletes it.
12. `make stack-deploy DOMAIN_APEX=<apex>` (certificate issuance and two
    distribution deployments, expect 10–25 minutes; watch `make stack-events`
    in a second terminal), then `make stack-activate DOMAIN_APEX=<apex>`.
    **Not** `deploy-client-to-<env>` and not `stack-upload`: both reach
    `build`, which changes the timestamp-bearing bundle's hash and discards
    the pre-staged artifact set
    (§5.4). `stack-activate` verifies the pre-staged objects against the local
    `dist/` and invalidates; it is seconds, not minutes. If step 9's
    pre-staging was skipped, `make stack-upload DOMAIN_APEX=<apex>` is the
    fallback and the window absorbs the build.
    If the create fails, §7.3 says what to do for each stack state.
13. §7.4 verification. Note the wall-clock time from step 11 to here.
14. Production only: `make stack-protect DOMAIN_APEX=slideruleearth.io`.

**After the window**

15. Retire the Terraform workspace. The state is now empty: the destroy
    removed everything it still listed, and the addresses removed in steps
    3–5 were already gone from it (those resources are simply unmanaged
    now). `terraform workspace select default && terraform workspace delete <ws>`.
    **This deletes the workspace's state object in the backend bucket**, so
    the step-2 archive is not a convenience — it is the only surviving record
    of what the workspace managed, and it must already exist before this
    command runs. Nothing in Phase 5 can archive it afterwards.
16. Remove the `S3_BUCKET=<old>` override from this environment's
    `live-update-*` and `release-live-update-to-*` wrappers (D8), and run
    `make live-update-<env>` once to prove the default path
    (`S3_BUCKET ?= $(STACK_BUCKET)`). **Open this PR before the window** and
    leave it ready to merge the moment step 13 passes: it is a repo change,
    not a command, and for as long as it is unmerged a routine
    `make live-update-<env>` uploads to the *old* bucket while the new
    distribution serves the new one — a deploy that reports success and
    changes nothing (R16). Update the memory note that says only
    `terraform apply` republishes the apex function.

### 7.3 Outage budget, failed-state recovery, rollback

| Step | Expected | Measured (Phase 2 / Phase 3) |
|---|---|---|
| `terraform destroy` | 10–20 min | — / |
| stack create (cert + 2 distributions) | 10–25 min (cert is fast with the CNAME retained) | / |
| build + upload + invalidation (`stack-upload`) | 3–5 min | / |
| verify + invalidate only (`stack-activate`, when pre-staged) | seconds — no build, no upload | / |
| **total outage** | **~30–50 min** | — / |
| resolver negative-cache tail (some users) | up to the zone's SOA minimum TTL, 15 min on a default Route 53 zone | n/a |

**What to do when a stack operation fails.** `stack-deploy` runs only when
there is no stack or its status is `CREATE_COMPLETE`, `UPDATE_COMPLETE` or
`UPDATE_ROLLBACK_COMPLETE`; every other status — the failed states below and
anything `*_IN_PROGRESS` — is refused with a pointer here.

| Stack status | What it means | Recovery |
|---|---|---|
| `ROLLBACK_COMPLETE` | the **first create** failed; CloudFormation removed what it made, but the empty stack shell remains and the only operation it accepts is delete | `make stack-delete-failed DOMAIN_APEX=<apex> CONFIRM_DESTROY=<client host>` (delete + wait), fix the cause from `stack-events`, `make stack-deploy` again |
| `ROLLBACK_FAILED` | a resource could not be removed during that rollback | `stack-events` names it; fix or remove it by hand, then a plain `make stack-delete-failed` (same `CONFIRM_DESTROY`) — `--retain-resources` is **not** accepted in this state. If that delete ends in `DELETE_FAILED`, see that row; then `stack-deploy` |
| `CREATE_FAILED` | only reachable with rollback disabled, which the targets never pass | as `ROLLBACK_COMPLETE` |
| `DELETE_FAILED` | usually a non-empty bucket or a resource still in use | fix the cause (empty the bucket; find the user in `stack-events`), `make stack-delete-failed` again (same `CONFIRM_DESTROY`); as a last resort add `RETAIN='<logical ids>'` or `FORCE_DELETE=1` to that same target — both are accepted only from this status, and both stay inside the guarded target rather than becoming a hand-typed `delete-stack` |
| `UPDATE_ROLLBACK_COMPLETE` | a later **update** failed and the stack is back at its previous good configuration; the site is up | fix the template, `stack-deploy` again |
| `UPDATE_ROLLBACK_FAILED` | the rollback of an update got stuck | fix the resource, then `aws cloudformation continue-update-rollback --region us-east-1` (with `--resources-to-skip` if needed), then `stack-deploy` |
| `REVIEW_IN_PROGRESS` | `aws cloudformation deploy` creates the stack **shell** in this state before executing its change set, so a first create whose change set failed or was never executed leaves one behind. It holds no resources and accepts only delete — easy to mistake for a stack that is mid-create | `make stack-delete-failed DOMAIN_APEX=<apex> CONFIRM_DESTROY=<client host>`, then `stack-deploy` again |
| `ROLLBACK_IN_PROGRESS`, `UPDATE_ROLLBACK_IN_PROGRESS`, `UPDATE_COMPLETE_CLEANUP_IN_PROGRESS`, `UPDATE_ROLLBACK_COMPLETE_CLEANUP_IN_PROGRESS` | CloudFormation is unwinding or tidying up on its own. Every one of these ends in a state this table already covers | **Wait.** There is no safe intervention, and `stack-deploy` refuses until it settles. Watch `make stack-events`; then act on the state it lands in |
| `DELETE_IN_PROGRESS` | the delete is running | Wait. `stack-destroy` and `stack-delete-failed` already `wait stack-delete-complete`, so this is only seen when watching from elsewhere |
| `UPDATE_IN_PROGRESS` | an update is running | Wait first. If it is genuinely stuck, `aws cloudformation cancel-update-stack --region us-east-1` — which exists **only** for this state — rolls it back to `UPDATE_ROLLBACK_COMPLETE`, from which `stack-deploy` works |
| `CREATE_IN_PROGRESS` | the create is running — in the cutover this is the outage | Budget from §7.3: `CREATE_COMPLETE` in 10–25 min. Past ~30 min, suspect the certificate — `aws acm describe-certificate --region us-east-1` and check the validation CNAME actually resolves (D2, V6); making the record resolve is the fix, and the create then completes on its own. `cancel-update-stack` does **not** apply here, and `stack-delete-failed` deliberately refuses this state; the only escape is `stack-abort-create`, and only under the conditions set out below |

**Deleting a stack that is stuck in `CREATE_IN_PROGRESS`.** CloudFormation
accepts `delete-stack` in this state, and `stack-delete-failed` refuses it
because a create that is merely slow looks identical to one that is stuck. That
judgment is the operator's — but making it by hand is the wrong way to be
careful, because a typed `--stack-name` can name any stack in the account and a
raw `delete-stack` checks no status at all. Being deliberate and being unguarded
are not the same thing, so it is a target with the same gates as the other
destructive ones — `make stack-abort-create` (§5.4).

Run it only once all three hold: `make stack-events` shows **no** new event for
at least 15 minutes; the certificate is not simply waiting on DNS (the check in
the `CREATE_IN_PROGRESS` row above); and the §7.3 budget has been exceeded. It
lands in `DELETE_COMPLETE` (start again with `stack-deploy`) or `DELETE_FAILED`
(that row). The bucket is untouched either way — nothing in this section
empties it.

**Rollback of the migration is fix-forward.** In the window, a failed create
is handled by the table above and a re-run; a working create that fails
verification is fixed with a template edit and a stack update (5–15 min per
CloudFront change). Rebuilding the Terraform environment from the archived
state is possible but slower than any fix-forward, and is the option of last
resort. What makes this acceptable is Phases 2 and 3: production runs a
runbook and a template that have already produced a working environment
twice.

### 7.4 Behaviour verification (run after Phases 2, 3 and 4)

```
curl -sI  https://<apex>/                 # 301 → https://<client>/landing
curl -si  https://<apex>/robots.txt       # 404, text/plain, body names <client> and docs.slideruleearth.io
curl -si  https://<apex>/anything/else    # 404 as above
curl -sI  https://<client>/               # 200, text/html, no-cache headers
curl -s -o /dev/null -w '%{http_version}\n' https://<client>/   # 2 — HttpVersion: http2, not CloudFormation's default
curl -s -o /dev/null -w '%{http_version}\n' https://<apex>/     # 2
curl -sI  https://<client>/assets/<an index-*.js from dist>   # 200, immutable, max-age=31536000
curl -sI -H 'Accept-Encoding: br, gzip' https://<client>/assets/<index-*.js>  # content-encoding present (D1b)
curl -s   https://<client>/robots.txt     # production: the real file; anything else: "Disallow: /"
curl -sI  https://<client>/ | grep -i -E 'content-security-policy|strict-transport|x-frame|x-content-type|referrer-policy'
                                          # diff against the pre-cutover snapshot: identical
curl -sI  http://<client>/                # 301 to https
curl -sI  https://<client>/no/such/route  # 200 with index.html (SPA fallback)
curl -sI  -X POST https://<client>/       # 403/405 from CloudFront, not a cached 200 (D1d)
curl -sI  https://<stack bucket>.s3.us-east-1.amazonaws.com/index.html   # 403: bucket is private (D1a)
openssl s_client -connect <client>:443 -servername <client> -tls1_1 </dev/null   # must fail (TLSv1.2_2021); -servername sends SNI so the failure is the policy, not a missing host
dig +short <client> A ; dig +short <client> AAAA   # both non-empty (D1c)
dig +short <apex> A   ; dig +short <apex> AAAA
dig +short <validation CNAME from §3.2> CNAME     # still present (D2)
```

Plus `make verify-s3-assets` (a real gate after the G4 PR), and a full
client smoke test in the browser (landing page, a new request, the elevation
plot, **and opening a record that existed before the cutover** — proves the
OPFS/IndexedDB data survived, §5.3) — the CSP is the thing most likely to
bite if a header is off by a character.

### 7.5 Scratch rehearsal (Phase 2) — values

| | value |
|---|---|
| `DOMAIN_APEX` | `cfn.testsliderule.org` |
| `DOMAIN` | `client.cfn.testsliderule.org` (derived) |
| `STACK_NAME` / `STACK_BUCKET` | both `client-cfn-testsliderule-org-web-client` — `STACK_BUCKET` defaults to the stack name and no `BUCKET_<stack>` value is set for the scratch stack; the bucket is created by `make bucket-create` before the stack |
| `HOSTED_ZONE_ID` | **must be passed explicitly** as the `testsliderule.org` zone: the lookup by name finds no zone called `cfn.testsliderule.org`, which is the intended failure mode for a mistyped apex |
| certificate | `cfn.testsliderule.org` + `*.cfn.testsliderule.org`. **Seed the validation CNAME first**, so the rehearsal meets what the cutovers will meet — a pre-existing, unmanaged record (V6): `aws acm request-certificate --region us-east-1` for the two names with DNS validation, read the CNAME from `describe-certificate --region us-east-1`, create it in the `testsliderule.org` zone, `aws acm wait certificate-validated --region us-east-1`, then `delete-certificate --region us-east-1` (the record stays). Every ACM call carries the region: CloudFront only accepts certificates from `us-east-1`, and a certificate quietly issued elsewhere is useless here (§1.4). The stack's own certificate then issues against the seeded record. |
| `robots.txt` | the noindex variant, correctly, because `DOMAIN` is not production |

Seed the CNAME → `make bucket-create …` → `make stack-prestage …` →
`make stack-deploy …` → `make stack-activate …` → §7.4 → then, separately,
`make stack-upload …` to exercise the non-pre-staged fallback → §7.4 again →
`make stack-destroy … CONFIRM_DESTROY=client.cfn.testsliderule.org` → note
whether the seeded CNAME survived the stack delete (the second half of V6) →
remove it by hand, delete the scratch bucket by hand (`aws s3 rb --force`; the
one bucket this plan ever deletes) and confirm nothing is left for `cfn.` in
Route 53, ACM, CloudFront or S3.

---

## 8. Phase plan

Tick as done. Add sub-items freely; do not remove them.

### Phase 0 — Preparation

- [x] Branch `cloudformation-migration-plan` created (2026-09-03)
- [x] This plan drafted **[agent]**
- [x] Pre-commit reviews folded in: two Codex rounds, plus an audit of every
      claim this plan makes about `terraform/` and the `Makefile` against the
      working tree — see [Review log](#review-log)
- [ ] Plan-only PR opened; D1–D10 settled in its review; merged (G5)
- [ ] Makefile input PR (G4): `DOMAIN_APEX` single input, derived `DOMAIN`,
      dead `APEX_DISTRIBUTION_ID` removed, wrappers shrunk,
      `verify-s3-assets` exits non-zero on a missing asset, `check-vars`
      asserts `DOMAIN == client.$(DOMAIN_APEX)`, `.NOTPARALLEL:` added so
      `make -j` cannot reorder build and upload (§5.4), and the four targets
      missing from `make help` get `##` lines (§3.4); checked with
      `make help DOMAIN_APEX=…` for both environments **[agent]**;
      merged **[owner]**
- [x] **[owner]** Stale `cfn-lint` 0.72 removed (2026-09-04). It was an
      unmanaged 2022 `pip install` into Homebrew's Python 3.10, not a formula;
      it shadowed nothing else and nothing depended on it. It had to go because
      0.72 predates `AWS::CloudFront::OriginAccessControl` and the cache-policy
      properties that D1a/D1b add, so a hand-run `cfn-lint` would have reported
      false errors on exactly the new resources. Nothing replaces it — `uv`
      runs the pinned version (§5.5)
- [ ] Open a tracking issue; rename branch to `issue-NNNN-…` (optional)
- [ ] **[owner]** Certificate inventory for both apexes in both regions (V1)
- [ ] **[owner]** External references to distribution IDs / CloudFront names /
      bucket names checked (V2)
- [ ] **[owner]** AWS account ID confirmed for production (V5)

### Phase 1 — Author (no AWS access needed)

- [ ] `cloudformation/web-client.yaml` — full template per §4/§5 **[agent]**
- [ ] `cloudformation/README.md` — deploy / cutover / destroy runbook
      (a condensed §7.2 + §7.3) **[agent]**
- [ ] `cloudformation/requirements-lint.in` (`cfn-lint==<version>`; 1.56.0 is
      current) and the `uv pip compile` output `requirements-lint.txt`, both
      committed — confirm the version lints the finished template before
      fixing it (§5.5) **[agent]**
- [ ] Makefile: stack variables (`override` on every derived one and on
      `STACK_REGION`), the four `check-*` targets including `check-derived`,
      `bucket-create` / `bucket-configure`, `stack-*` (including
      `stack-abort-create`, `stack-prestage`, `stack-activate` and
      `stack-upload`)
      targets, `terraform-destroy`, `deploy`/`destroy`
      aliased to the stack targets, wrappers per §5.4 with both environments'
      `live-update-*` / `release-*` still overriding `S3_BUCKET` **[agent]**
- [ ] `make lint-cfn` passes with the pinned `cfn-lint` **[agent]**
- [ ] `.github/workflows/cloudformation.yml` (paths include itself) +
      `ci-check` updated **[agent]**
- [ ] Codex review of the template and the Makefile changes — log it
- [ ] **[owner]** `make validate-cfn` passes
- [ ] PR opened for Phase 1; its description declares the infrastructure
      freeze (§5.4): until an environment's cutover its infrastructure is not
      changed, and content deploys continue through `live-update-*`

### Phase 2 — Scratch rehearsal **[owner]** (D9)

- [ ] Validation CNAME for `cfn.testsliderule.org` seeded by hand (§7.5, V6)
- [ ] `make bucket-create DOMAIN_APEX=cfn.testsliderule.org` — the scratch
      stack's bucket, then `bucket-configure` re-run once to prove it is
      idempotent
- [ ] `make stack-prestage DOMAIN_APEX=cfn.testsliderule.org …` — fills the
      bucket and ends in a passing `verify-s3-assets`, before any stack exists
- [ ] `make stack-deploy DOMAIN_APEX=cfn.testsliderule.org HOSTED_ZONE_ID=Z1039660300QJ4GJRI5NT`
      reaches `CREATE_COMPLETE` against the seeded record; **record the create
      time in §7.3**
- [ ] `make stack-activate …`; site loads. **Time it** — this is the number
      that decides whether production is pre-staged (§7.3)
- [ ] §7.4 verification passes (noindex robots expected)
- [ ] `make stack-upload …` afterwards, exercising the non-pre-staged fallback
      end to end; §7.4 still passes. Both paths are rehearsed here because the
      cutover uses `stack-activate` and falls back to `stack-upload`, and
      neither is exercised anywhere else before the test cutover
- [ ] `make stack-destroy … CONFIRM_DESTROY=client.cfn.testsliderule.org`
      completes; noted whether it removed the seeded CNAME (V6); the record
      removed by hand; the scratch bucket deleted by hand; nothing left for
      `cfn.` in Route 53 / ACM / CloudFront / S3
- [ ] Findings folded back into the template; Review log row

### Phase 3 — Test cutover **[owner]**

- [ ] §7.2 steps 1–10 (state clean, snapshot, certificate check, validation
      CNAME retained, permanent bucket created and pre-staged; **no `make build`
      after step 9**)
- [ ] Steps 11–13: `terraform-destroy` → `stack-deploy` → `stack-activate` →
      verify. **Record the outage duration in §7.3**, and note separately how
      long `stack-activate` took — that number is what justifies pre-staging
      production
- [ ] Steps 15–16: workspace retired (state archived first); `S3_BUCKET`
      override removed from the testsliderule wrappers; a normal
      `make live-update-testsliderule` works via the derived default
- [ ] Memory `apex-404-testsliderule-deploy.md` updated: the function is
      republished by `make deploy-client-to-testsliderule` via CloudFormation
- [ ] Findings folded back into the template; Review log row

### Phase 4 — Production cutover **[owner]**

- [ ] Window announced, sized from §7.3
- [ ] §7.2 steps 1–14 on `slideruleearth.io` / `client.slideruleearth.io`,
      with step 5 (retain the old bucket) taken
- [ ] `stack-protect` run; `make stack-status` shows protection on
- [ ] §7.4 verification passes; browser smoke test done
- [ ] Steps 15–16: workspace retired (state archived first); `S3_BUCKET`
      override removed from the slideruleearth wrappers

### Phase 5 — Decommission Terraform

- [ ] **[owner]** Archive and remove what is left in the backend bucket. The
      two workspace state objects under `s3://sliderule/tf-workspaces/…` are
      **already gone** — `terraform workspace delete` removed them in §7.2
      step 15, and the step-2 `terraform state pull` archives are the record.
      What remains is `tf-states/web-client.tfstate`, the *default* workspace's
      object, which no workspace delete touches: copy it to an archive prefix
      (or local), then delete the original. Sweep `tf-workspaces/` for anything
      a skipped `workspace delete` left behind. Do not delete the `sliderule`
      bucket — other repos use it
- [ ] **[owner]** Delete the retained old production bucket
      (`slideruleearth-webclient`) once the new stack has served a full release
      cycle, and the test one if it was retained
- [ ] `git rm -r terraform/` (including `.terraform.lock.hcl`); remove
      `terraform-destroy` and `DOMAIN_ROOT` from the
      Makefile **[agent]**
- [ ] `.gitignore`: drop the Terraform block **[agent]**
- [ ] `README.md` Deployment section: CloudFormation, link to
      `cloudformation/README.md` **[agent]**
- [ ] `CLAUDE.md`: repo layout, apex section, Build/deploy section **[agent]**
- [ ] Claude memory: `aws-credentials-denied.md`, `agent-discovery-files.md`
      references updated; this plan's memory entry marked done **[agent]**
- [ ] Owner's `~/.claude/settings.json`: `Bash(terraform:*)` deny rule can
      go (`Bash(aws:*)` already covers `aws cloudformation`) **[owner]**
- [ ] Final PR; this document's Status → DONE

### Phase 6 — Follow-ups (each its own PR)

- [ ] `DISTRIBUTION_ID` from stack outputs (D6)
- [ ] Anything from D1 that review deferred

---

## 9. Risks and gotchas

| # | Risk | Mitigation |
|---|---|---|
| R1 | The outage runs long: certificate issuance stalls, CloudFront is slow, the build fails | the validation CNAME is retained so issuance does not wait on DNS (D2); Phases 2 and 3 measure every step; the production window is twice the measurement; run a `live-update` the day before to exercise the build |
| R2 | Something outside this repo is pinned to the old distribution IDs, `*.cloudfront.net` names or bucket names | V2; nothing in this repo is (the Makefile resolves the distribution by alias, and the bucket name is derived from the stack name — D8) |
| R3 | Resolvers cache the missing A record after the destroy and keep answering NXDOMAIN for a while after the site is back | bounded by the zone's SOA minimum TTL (15 min default); accepted as part of the outage |
| R4 | A template bug that passed on scratch and test still bites production (different apex, different CSP host list) | the only environment-specific values are parameters; §7.4 diffs the headers policy against the snapshot; browser smoke test |
| R5 | `stack-destroy` pointed at the wrong environment, or run while production's termination protection is on, emptying the bucket before the delete is refused | every gate runs before the first `s3 rm`: account, stack existence and status, protection off, `CONFIRM_DESTROY=<client host>`, and the stack's `S3BucketName` parameter equal to the bucket being emptied (D5) |
| R6 | A stack operation fails and the operator re-runs `deploy` against a stack in a failed or in-progress state (a `ROLLBACK_COMPLETE` shell, for one, accepts only delete) | `stack-deploy` proceeds only from a stable status and points at §7.3; `stack-delete-failed` is the way out |
| R7 | `deploy-client-to-<env>` is run while the environment is still on Terraform, creating a stack that fails on `CNAMEAlreadyExists` after minutes | `stack-deploy` checks for the alias on a foreign distribution before creating |
| R8 | The wrong hosted zone is picked (a private zone, or a duplicate) | lookup filters `Config.PrivateZone == false` and `check-stack-vars` insists on exactly one ID |
| R9 | Deleting the ACM validation CNAME breaks the renewal of another certificate for the same domain that never appeared in this one's `InUseBy` | the CNAME is `state rm`'d before the destroy and kept (§7.2 step 4); V1 checks the known certificate's users and the runbook branches on it; V7 inventories the CNAME's other users |
| R10 | A future edit adds a JS template literal to the function code and `Fn::Sub` swallows the `${x}` | comment in the template; `cfn-lint` flags unknown `${}` references |
| R11 | The permanent bucket's name is taken at its one-time creation | `bucket-create` fails immediately, long before any window; choose another name once, record it in the Makefile, done (D8) |
| R12 | The permanent bucket is deleted by hand and the next `stack-deploy` or `live-update` targets a bucket that does not exist | `check-stack-vars` and `check-vars` fail on `head-bucket` / the upload; `bucket-create` recreates it (the name may be held for a while — the one time D8's "never delete" rule costs something to break) |
| R13 | The cache policy changes caching behaviour | TTLs copied from Terraform; `Cache-Control` set by `upload-*` overrides them as before; compression is the one intended change (D1b) |
| R14 | The OAC bucket policy names only one distribution and the other gets 403 from S3 | both distribution ARNs in `AWS:SourceArn` (§4.5) |
| R15 | Tightened methods break something that POSTs to the client origin | checked: nothing does (V3); `OPTIONS` kept for preflight |
| R16 | A pre-cutover wrapper's `S3_BUCKET` override is left in place after the cutover, so `live-update` silently uploads to the old (retained) bucket — or, worse, an override carried over from `terraform-destroy` reaches `stack-deploy` and builds the stack against the old bucket | the stack half cannot happen at all: stack operations read the locked `STACK_BUCKET`, which no command line can set (§5.4). For the upload half, §7.2 step 16 removes the override and proves the default path immediately, and its PR is drafted **before** the window so the gap between step 13 and the merge is minutes; `check-vars` prints the bucket; once the old bucket is deleted in Phase 5 a stale override fails loudly |
| R17 | `verify-s3-assets` reports `MISSING` but `live-update` still "succeeds" | fixed in the G4 PR: exits non-zero |
| R18 | Two people run `stack-deploy` at once | CloudFormation serialises operations per stack; the second fails fast |
| R19 | Users lose locally stored records (OPFS Parquet, IndexedDB) | cannot happen from this migration: that data is origin-keyed in the browser and the origin is unchanged (§5.3); the only infra-side threat is a CSP regression, caught by the §7.4 header diff and the pre-cutover-record smoke test |
| R20 | A caller overrides a derived variable — `DOMAIN` not matching `DOMAIN_APEX`, or a region other than `us-east-1` — and the mismatch surfaces as a certificate or alias failure minutes into a stack create, inside the outage window | `DOMAIN_SLUG`, `STACK_NAME`, `STACK_REGION` and `EXPECTED_AWS_ACCOUNT_ID` are `override`, so they cannot be set from the command line or the environment at all; `DOMAIN` keeps `?=` but `check-derived` asserts it equals `client.$(DOMAIN_APEX)` before any AWS call, so a stale invocation fails offline in a second rather than after the certificate is issued (§5.4) |
| R21 | `stack-delete-failed` or `stack-abort-create` — the other two targets that delete a stack — are pointed at a healthy or wrong-environment stack. Its gates are **not** R5's: it runs `check-derived` and `check-account`, requires `CONFIRM_DESTROY=$(DOMAIN)`, and refuses any status outside its recovery allowlist, but it never calls `check-destroy-vars`, never compares the `BucketName` output, and never touches bucket contents at all | the status allowlist is the load-bearing gate in both — a healthy `CREATE_COMPLETE` or `UPDATE_COMPLETE` stack is refused outright, and `stack-abort-create` accepts only `CREATE_IN_PROGRESS` — while `check-derived` means neither can be aimed at an arbitrary stack name and `CONFIRM_DESTROY` catches the wrong environment. Termination protection still applies, enforced by the CloudFormation API rather than by the target, so production is refused while it is on. Because the target performs no bucket operation, the site's files survive any misuse of it |
| R22 | `make -j`, or a `MAKEFLAGS` inherited from a parent make, runs `live-update`'s build and upload steps concurrently, publishing an `index.html` that names assets not yet uploaded — or uploading while `build` is still writing `dist/` | `.NOTPARALLEL:` in the Makefile from the G4 PR (§5.4), so no target here can run in parallel; `stack-prestage` additionally uses one recipe line per step. Not deferred: `live-update-<env>` is the everyday content deploy, so this is a live bug independent of the migration |

---

## 10. Things to verify

| # | Question | How | Status |
|---|---|---|---|
| V1 | Is this environment's Terraform-managed certificate (the ARN in the state) `InUseBy` anything besides its own two distributions? If so, the destroy would try to delete a certificate something else needs. | **[owner]** `aws acm describe-certificate --region us-east-1 --certificate-arn <arn> --query Certificate.InUseBy`; the runbook branches on the answer (§7.2 step 3) | open |
| V2 | Does anything outside this repo reference the distribution IDs, the `*.cloudfront.net` domain names or the bucket names (`testsliderule-webclient`, `slideruleearth-webclient`)? other SlideRuleEarth repositories, monitoring, dashboards, the docs site, bookmarks in runbooks | **[owner]** grep the `SlideRuleEarth` checkouts; check CloudWatch alarms and any uptime monitor | open |
| V3 | Does the client ever send a non-GET request to its own origin? | **[agent]** grep of `web-client/src`, re-run 2026-09-04: all eleven `method: 'POST'` sites resolve to an absolute cross-origin URL — `https://<api host>/<path>` (`sliderule/core.ts`, `utils/fetchUtils.ts`), the OAuth `registration_endpoint` / `token_endpoint`, `https://provisioner.<base domain>`, or `tile.googleapis.com`. No relative `fetch('/…')` exists anywhere, and every `location.origin` use is an OAuth **redirect URI** (`/auth/github/callback`), i.e. a browser navigation, not a request method the distribution sees | **closed — no** |
| V4 | With an OAC, is `S3OriginConfig: {OriginAccessIdentity: ""}` the required form? | AWS CloudFormation reference for `S3OriginConfig`: yes — the property must be present and empty when an OAC is used | **closed — yes** |
| V5 | Is production in the same AWS account as test (`742127912612`)? The `AWS_ACCOUNT_ID` guard assumes one account. | **[owner]** `aws sts get-caller-identity` under the production profile | open |
| V6 | When `AWS::CertificateManager::Certificate` creates with DNS validation and the validation CNAME already exists with the same value, does it proceed (upsert / no-op) rather than fail? And does deleting the stack delete that CNAME? Both matter for a record shared with other certificates. | **[owner]** observed in Phase 2 — the scratch rehearsal seeds an unmanaged CNAME first (§7.5), so both halves are seen before any live host is touched — and again in Phase 3; AWS docs for the certificate resource; if the delete-side answer is "yes", note it in `cloudformation/README.md` next to `stack-destroy` | open |
| V7 | Which other certificates in the account validate through the same CNAME? A validation CNAME is per account and domain and is shared by every certificate for those names, in any region, whether the apex is the primary name or a SAN. Informs only whether the retained CNAME must stay forever; nothing in the runbook depends on the answer. | **[owner]** in every region the account uses (at least `us-east-1`, `us-west-2`): `aws acm list-certificates --includes keyTypes=RSA_1024,RSA_2048,RSA_3072,RSA_4096,EC_prime256v1,EC_secp384r1,EC_secp521r1` (the default lists only RSA 1024/2048), filtered on `DomainName` **and** `SubjectAlternativeNameSummaries`; then `describe-certificate … DomainValidationOptions[].ResourceRecord.Name` | open |
| V8 | What `aws` CLI version is in use, and does it support `delete-stack --deletion-mode FORCE_DELETE_STACK`? Only affects the last-resort branch of the `DELETE_FAILED` row (§7.3); everything else in the plan uses long-standing commands. | `aws-cli/2.36.39` (Homebrew, upgraded 2026-09-04 from a 2024-vintage 2.18.8). Its bundled CloudFormation service model declares both `DeletionMode` and `FORCE_DELETE_STACK`, checked in `…/awscli/2.36.39/libexec/.../botocore/data/cloudformation/2010-05-15/service-2.json` | **closed — supported** |
| V9 | What `terraform` version is in use? The cutover depends on `state pull`, `state rm`, `destroy` and `workspace delete` behaving as §7.2 describes — in particular that `workspace delete` removes the remote state object (§7.2 step 15). | `1.14.9` (Homebrew, linked 2026-04-20), well past every command the runbook uses | **closed — 1.14.9** |

---

## 11. Open questions for the owner

1. D1a–d: adopt OAC, the cache policy with compression, AAAA records and
   `GET/HEAD/OPTIONS` at creation, or translate faithfully first?
2. D2: certificate in the stack (with the CNAME retained), or pre-issued
   before the window and passed as a parameter?
3. D4: no `DeletionPolicy` at all, or `Retain` on the certificate? (The
   bucket is not a stack resource, so it is not a candidate — D8.)
4. D9: keep the scratch rehearsal (recommended) or go straight to the test
   cutover?
5. Who needs to hear about the production window, and how far ahead?

---

## Review log

Rows are appended from the plan PR's review onward. The draft was reviewed
three times *before* it was ever committed; those findings were folded into
the text above rather than logged as a trail, so this document reads as one
coherent plan rather than a history of itself.

| Round | Date | Reviewer | Summary of changes made to this plan |
|---|---|---|---|
| Draft | 2026-09-03 → 2026-09-04 | Claude Code (author); Codex ×2; Claude Code (plan-vs-repo audit) | Written from a survey of `terraform/`, the `Makefile`, CI, the local Terraform state and the org's existing CloudFormation (`sliderule/docs/cloudfront/documentation.yml`); givens G1–G5 supplied by the owner. Reviewed twice by Codex, which called the plan viable, and once against the working tree to check every claim it makes about `terraform/` and the `Makefile`. All findings folded in above. |
| 1 | | | |

## Decision log

Status changes to §6 items, recorded through the plan PR's review and after.

| Date | Decision | By |
|---|---|---|
| | | |

---

## Appendix A — Strings that must survive the cutover unchanged

These are observable behaviour, copied verbatim from `terraform/modules/*.tf`
into the template and checked in §7.4:

| Where | Value |
|---|---|
| Headers policy | `X-Content-Type-Options` override; `X-Frame-Options: DENY`; `Referrer-Policy: same-origin`; `X-XSS-Protection: 1; mode=block`; HSTS `max-age=63072000; includeSubDomains; preload`; the full `Content-Security-Policy` string with `https://*.${DomainApex} https://${DomainApex}` in `connect-src` |
| Apex function | the JavaScript in `cloudfront.tf` — 301 on `/` to `https://${DomainName}/landing`; 404 `text/plain; charset=utf-8`, `cache-control: public, max-age=300`, body naming `${DomainApex}`, `${DomainName}` and `docs.slideruleearth.io` |
| Custom error responses | 403→200 `/index.html`, 404→200 `/index.html`, `ErrorCachingMinTTL: 0` |
| Cache TTLs | 0 / 3600 / 86400 |
| TLS | `sni-only`, `TLSv1.2_2021` |
| Price classes | client `PriceClass_200`, apex `PriceClass_100` |
| Cert | `${DomainApex}` + `*.${DomainApex}`, DNS validated |
| `DefaultRootObject` | `index.html` |

## Appendix B — Command sketches (owner-run; to be turned into Makefile targets in Phase 1)

**Only read-only lookups appear here as raw `aws` commands. Everything that
changes state appears as its `make` target, with the calls it makes underneath
as comments.** "Create-only" is not a safe category — `aws cloudformation
deploy` creates *or updates*, and a copied `delete-stack` acts on whatever
`--stack-name` it is handed in any status — so the line between the two is
whether the command changes anything, not what it is called. The gates that
make each mutation safe (derived stack name, status allowlist, alias check,
`CONFIRM_DESTROY`, account check, lint) live in the targets and nowhere else.

The two `terraform state rm` / `workspace delete` sketches are the deliberate
exception: they are one-off state surgery with no `make` target by design
(§7.2 steps 3–5, 15), and their guard is the `terraform workspace select` they
are chained to — never run them detached from it.
Every
ACM and CloudFormation call passes `--region us-east-1` explicitly (§1.4).

```bash
# account guard (every mutating target)
aws sts get-caller-identity --query Account --output text          # must equal EXPECTED_AWS_ACCOUNT_ID (742127912612, V5)

# hosted zone: public only, exactly one
aws route53 list-hosted-zones-by-name --dns-name testsliderule.org \
  --query "HostedZones[?Name=='testsliderule.org.' && Config.PrivateZone==\`false\`].Id" \
  --output text | sed 's|/hostedzone/||'

# stack status + termination protection
aws cloudformation describe-stacks --region us-east-1 --stack-name client-testsliderule-org-web-client \
  --query 'Stacks[0].[StackStatus,EnableTerminationProtection]' --output text

# alias-in-use guard (before a first create); not_null() because a distribution with no aliases has no Items key
aws cloudfront list-distributions \
  --query "DistributionList.Items[?contains(not_null(Aliases.Items, \`[]\`), 'client.testsliderule.org') || contains(not_null(Aliases.Items, \`[]\`), 'testsliderule.org')].Id"

# one-time bucket per environment (D8); never run again, never deleted
make bucket-create    DOMAIN_APEX=testsliderule.org
# reassert the block and tags at any time, and the recovery path if bucket-create
# died after the create succeeded (the bucket then exists, so bucket-create refuses)
make bucket-configure DOMAIN_APEX=testsliderule.org
# what they run, for reference only. Two refusals carry the safety and must survive
# into the Makefile: an existing bucket is a REFUSAL for bucket-create, not a no-op,
# and bucket-configure proves ownership first — list-buckets shows only this account's
# buckets, where head-bucket can succeed against someone else's.
#   if aws s3api head-bucket --bucket <bucket> 2>/dev/null; then
#     echo "refusing: bucket already exists" >&2; exit 1
#   fi
#   aws s3api create-bucket --region us-east-1 --bucket <bucket>
#   test -n "$(aws s3api list-buckets --query "Buckets[?Name=='<bucket>'].Name" --output text)" \
#     || { echo "refusing: bucket is not owned by this account" >&2; exit 1; }
#   aws s3api put-public-access-block --bucket <bucket> \
#     --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
#   aws s3api put-bucket-tagging --bucket <bucket> \
#     --tagging 'TagSet=[{Key=Owner,Value=SlideRule},{Key=Project,Value=web-client-testsliderule.org},{Key=cost-grouping,Value=web-client}]'

# create or update — stack-deploy gates it: check-account, check-stack-vars, lint-cfn,
# a stable-status allowlist, and (on a first create) a refusal if any distribution already
# carries the alias. `aws cloudformation deploy` itself creates OR updates and checks none of that.
make stack-deploy DOMAIN_APEX=testsliderule.org
# what it runs, for reference only:
#   aws cloudformation deploy --region us-east-1 \
#     --stack-name client-testsliderule-org-web-client \
#     --template-file cloudformation/web-client.yaml \
#     --parameter-overrides DomainName=client.testsliderule.org DomainApex=testsliderule.org \
#         S3BucketName=client-testsliderule-org-web-client HostedZoneId=Z1039660300QJ4GJRI5NT \
#     --tags Owner=SlideRule Project=web-client-testsliderule.org cost-grouping=web-client \
#     --no-fail-on-empty-changeset

# the bucket name recorded in the stack (echoes the S3BucketName parameter; check-destroy-vars compares the PARAMETER with $STACK_BUCKET)
aws cloudformation describe-stacks --region us-east-1 --stack-name client-testsliderule-org-web-client \
  --query 'Stacks[0].Outputs[?OutputKey==`BucketName`].OutputValue' --output text

# watch a create
aws cloudformation describe-stack-events --region us-east-1 \
  --stack-name client-testsliderule-org-web-client \
  --query 'StackEvents[].[Timestamp,LogicalResourceId,ResourceStatus,ResourceStatusReason]' --output table

# recover from a failed first create — via the target, which enforces the failed-status
# allowlist and CONFIRM_DESTROY. There is deliberately no raw delete-stack sketch here:
# delete-stack obeys whatever --stack-name it is given, in whatever status.
make stack-delete-failed DOMAIN_APEX=testsliderule.org CONFIRM_DESTROY=client.testsliderule.org
#   RETAIN='<LogicalId> <LogicalId>' only once the stack is DELETE_FAILED
# and for a create that is hung rather than failed (§7.3 conditions first):
make stack-abort-create   DOMAIN_APEX=testsliderule.org CONFIRM_DESTROY=client.testsliderule.org

# certificate check on the known ARN (V1) — the one the destroy would delete
aws acm describe-certificate --region us-east-1 --certificate-arn <arn from the state pull> \
  --query 'Certificate.[InUseBy,DomainValidationOptions[].ResourceRecord.Name]'

# broader inventory: everything that validates through the same CNAME (V7); repeat per region in use.
# --includes because the default lists only RSA 1024/2048; SAN filter because the apex may not be the primary name
aws acm list-certificates --region us-east-1 \
  --includes keyTypes=RSA_1024,RSA_2048,RSA_3072,RSA_4096,EC_prime256v1,EC_secp384r1,EC_secp521r1 \
  --query "CertificateSummaryList[?DomainName=='testsliderule.org' || DomainName=='*.testsliderule.org' || contains(not_null(SubjectAlternativeNameSummaries, \`[]\`), 'testsliderule.org') || contains(not_null(SubjectAlternativeNameSummaries, \`[]\`), '*.testsliderule.org')].CertificateArn" \
  --output text

# retain the validation CNAME before the destroy
cd terraform && terraform workspace select client.testsliderule.org-web-client && \
  terraform state rm module.cloudfront.aws_route53_record.cert_validation_root \
                     module.cloudfront.aws_route53_record.cert_validation_wildcard

# termination protection (production), separate deliberate commands.
# stack-unprotect demands CONFIRM_DESTROY; the raw call does not, which is the whole point of it.
make stack-protect   DOMAIN_APEX=slideruleearth.io
make stack-unprotect DOMAIN_APEX=slideruleearth.io CONFIRM_DESTROY=client.slideruleearth.io
# what they run, for reference only:
#   aws cloudformation update-termination-protection --region us-east-1 \
#     --enable-termination-protection | --no-enable-termination-protection \
#     --stack-name client-slideruleearth-io-web-client

# destroy (CloudFormation era) — the target is the only supported path, because every gate in
# check-destroy-vars (account, status, termination protection, CONFIRM_DESTROY, and the stack's
# S3BucketName parameter matching the bucket about to be emptied) runs before the first s3 rm.
make stack-destroy DOMAIN_APEX=testsliderule.org CONFIRM_DESTROY=client.testsliderule.org
# what it does internally, for reference only — do not run these by hand, in this order or any other:
#   delete-stack; wait stack-delete-complete; s3 rm s3://<bucket> --recursive;
#   list-objects-v2 --max-keys 1 --query KeyCount  (must be 0). The bucket itself is never deleted.

# snapshot BEFORE any state rm (§7.2 step 2); $ARCHIVE is a directory outside the checkout
cd terraform && terraform workspace select client.testsliderule.org-web-client && \
  terraform state pull > "$ARCHIVE/testsliderule-pre-cutover.tfstate.json"

# retire a terraform workspace (after its destroy; the state is empty by then)
cd terraform && terraform workspace select default && \
  terraform workspace delete client.testsliderule.org-web-client
```

## Appendix C — References

- Org template for the same pattern: `sliderule/docs/cloudfront/documentation.yml`
  and its `documentation-*` targets in `sliderule/targets/slideruleearth/Makefile`
- Org certificate stack: `sliderule/applications/certbot/certbot.yml`
- Upstream ancestor: `aws-samples/amazon-cloudfront-secure-static-site` (CloudFormation)
- AWS: `AWS::CloudFront::OriginAccessControl`, `AWS::CloudFront::CachePolicy`,
  `AWS::CloudFront::Function`, `AWS::CloudFront::Distribution` `S3OriginConfig`
  (empty `OriginAccessIdentity` with OAC), `AWS::CertificateManager::Certificate`
  (DNS validation with `HostedZoneId`); ACM "DNS validation" (validation CNAMEs
  are per account and domain, shared across certificates and regions);
  "Protecting a stack from being deleted" (termination protection blocks
  `delete-stack`); "Stack status codes" (`ROLLBACK_COMPLETE` accepts only
  delete); `aws route53 list-hosted-zones-by-name` (`Config.PrivateZone`);
  "Restricting access to an Amazon S3 origin" (OAC bucket policy with `AWS:SourceArn`)
- This repo: `CLAUDE.md` (apex/robots rules, Makefile-first policy), memory notes
  `apex-404-testsliderule-deploy`, `aws-credentials-denied`, `agent-discovery-files`

## Appendix D — Names before and after

Everything CloudFormation creates is named from the stack name, which is
derived from the client host (D7). Shown for test; production substitutes
`client-slideruleearth-io-web-client`. AWS-assigned identifiers (distribution
IDs, `*.cloudfront.net` names, certificate ARNs) are new and unpredictable,
and nothing depends on them (G2).

| What | Terraform today | CloudFormation |
|---|---|---|
| Stack / workspace | workspace `client.testsliderule.org-web-client` | stack `client-testsliderule-org-web-client` |
| S3 bucket | `testsliderule-webclient` (Terraform-owned, deleted at cutover) | `client-testsliderule-org-web-client` — created once by `bucket-create`, outside the stack, never deleted (D8) |
| Origin access | OAI `EU1VKF419H8A8`, comment `access-identity-client-testsliderule-org.s3.amazonaws.com` | OAC `client-testsliderule-org-web-client-oac` (D1a) |
| Cache policy | none (legacy `ForwardedValues`) | `client-testsliderule-org-web-client-cache` (D1b) |
| Response headers policy | `client-testsliderule-org-shp` | `client-testsliderule-org-web-client-headers` |
| CloudFront function | `client-testsliderule-org-apex-redirect` | `client-testsliderule-org-web-client-apex-redirect` |
| Origin IDs (inside the distributions) | `s3-client-testsliderule-org-cloudfront`, `dummy-origin-apex-redirect` | `s3-client`, `s3-apex-dummy` |
| Client distribution | `E675VP482LBL9` | new ID, new `*.cloudfront.net` name |
| Apex distribution | `E1LORWIIYX82WR` | new ID, new `*.cloudfront.net` name |
| Certificate | `…certificate/2cf02d11-…` for `testsliderule.org` + `*.testsliderule.org` | new ARN, same two names |
| Validation CNAME | `_e359ba1d…testsliderule.org` | **the same record, kept** (§7.2 step 4) |
| Route 53 records | `client.testsliderule.org` A, `testsliderule.org` A | same names, A **and AAAA** (D1c) |
| Aliases / URLs | `https://client.testsliderule.org`, `https://testsliderule.org` | **unchanged** |
| Tags | `Owner=SlideRule`, `Project=web-client-client`, `cost-grouping=web-client`, `terraform-base-path=<local path>` | `Owner` and `cost-grouping` unchanged; `Project=web-client-testsliderule.org`; `terraform-base-path` dropped (D10) |
| Template logical IDs | — | `SiteBucketPolicy`, `OriginAccessControl`, `CachePolicy`, `SecurityHeadersPolicy`, `Certificate`, `ClientDistribution`, `ApexDistribution`, `ApexRedirectFunction`, `ClientAliasA/AAAA`, `ApexAliasA/AAAA` (§5.1; internal to the template) |

Every generated name differs from the Terraform-era name for the same thing
(`…-web-client-apex-redirect` vs `…-apex-redirect`, `…-web-client-headers` vs
`…-shp`), and CloudFront function, OAC, cache-policy and response-headers-policy
names are unique **per account**. So a stack can be created while the Terraform
resources still exist without colliding on a name — which is what lets the
scratch rehearsal (D9) run against the live test account, and what lets a
failed create be retried after a partial rollback. The only names that must not
collide within the plan are the two stacks' own, and those differ by apex.

Longest generated name: `client-slideruleearth-io-web-client-apex-redirect`, 49
characters, inside every relevant limit (CloudFront function and OAC names
allow 64, bucket names 63).
The D7 alternative, a short environment label
(`web-client-testsliderule`), would shorten every row by about 15 characters.
