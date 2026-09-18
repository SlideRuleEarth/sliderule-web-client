# CloudFormation deployment of the web client

One template, one stack per environment, always in `us-east-1`. This replaced
the Terraform deployment in September 2026 — see
[`docs/cloudformation-migration-plan.md`](../docs/cloudformation-migration-plan.md)
for the design and the decisions behind it, and
[`RUNBOOK-production.md`](RUNBOOK-production.md) for the record of the
production cutover. This file is the short version for someone operating it.

```
cloudformation/
├── web-client.yaml          the template
├── requirements-lint.in     what we ask for: cfn-lint==<version>
├── requirements-lint.txt    the resolved lock uv actually installs (generated, committed)
└── RUNBOOK-production.md    the production cutover of 2026-09-18, as run (historical)
```

## What the stack is

| | test | production |
|---|---|---|
| Stack name | `client-testsliderule-org-web-client` | `client-slideruleearth-io-web-client` |
| Client host | `client.testsliderule.org` | `client.slideruleearth.io` |
| Apex | `testsliderule.org` | `slideruleearth.io` |

The stack name is `client-<apex with dots replaced by dashes>-web-client`.
The Makefile derives it from `DOMAIN_APEX`, the one per-environment input; it is
never typed.

Resources, in creation order: the wildcard ACM certificate (`<apex>` and
`*.<apex>`, DNS-validated in the stack), an Origin Access Control, a cache policy
(TTLs 0 / 3600 / 86400, compression on), the security-headers policy, the client
distribution with its A and AAAA aliases, the apex viewer-request function, the
apex distribution with its A and AAAA aliases, and the bucket policy that admits
exactly those two distributions.

**Not in the stack, on purpose:**

- **The S3 bucket.** It is created once per environment by `make bucket-create`
  and passed in as the `S3BucketName` parameter. The stack never creates,
  replaces or deletes it, so deleting the stack cannot take the site with it.
- **The ACM validation CNAME.** It is the same record for every certificate for
  the domain in this account, it already exists in the zone, and other
  certificates may renew against it. Leave it alone.

## Parameters

| Parameter | Where the Makefile gets it |
|---|---|
| `DomainName` | derived: `client.$(DOMAIN_APEX)` — `check-derived` refuses anything else |
| `DomainApex` | `DOMAIN_APEX`, the one input |
| `S3BucketName` | `STACK_BUCKET`, locked to the environment's permanent bucket |
| `HostedZoneId` | `list-hosted-zones-by-name` filtered to the exact apex, public zones only, exactly one match |

No parameter files; the Makefile passes `--parameter-overrides`.

## Checking the template

`lint-cfn` is cfn-lint, pinned; it needs `uv` and nothing else, and no AWS.
`validate-cfn` is the CloudFormation API's own syntax check; it needs
credentials and changes nothing.

```bash
make lint-cfn
make validate-cfn
```

`lint-cfn` runs in CI ([`.github/workflows/cloudformation.yml`](../.github/workflows/cloudformation.yml))
on any change under `cloudformation/`, to the `Makefile`, or to the workflow
itself, and is part of `make ci-check`. It is deliberately **not** in the
pre-commit hook.

`cfn-lint` is not installed anywhere. `uv run` resolves `requirements-lint.txt`
into its cache and runs the pinned version from there, with the interpreter
pinned to 3.13 so local and CI resolve the same branch of the lock. The lock is
universal (macOS and Linux) because `networkx` resolves differently below and
above Python 3.11. To move to a newer `cfn-lint`, edit the version in
`requirements-lint.in` and regenerate:

```bash
uv pip compile cloudformation/requirements-lint.in \
  -o cloudformation/requirements-lint.txt --universal --python-version 3.10
```

Commit both files.

## Editing the template

Two strings are load-bearing, because the client's workers and WASM load only
if the response headers are exactly right:

- the `ContentSecurityPolicy` value in `SecurityHeadersPolicy` — one long line,
  copied verbatim, including its repeated hosts and doubled spaces;
- the `FunctionCode` of `ApexRedirectFunction`.

Both sit inside `!Sub`, so every `${…}` in them is a substitution. Today those
are only `${DomainApex}` and `${DomainName}`; if you ever need a literal `${`
(a JS template literal, say), write `${!`.

Every CloudFront property whose CloudFormation default is not what we want is
set explicitly (`HttpVersion`, `IPV6Enabled`, `Restrictions`). Treat anything
the template does not state as a question, not as a safe default.

## Operating it

Every target takes `DOMAIN_APEX=<apex>` and derives the rest. Every target that
changes anything first checks the derived names offline (`check-derived`) and
the AWS account (`check-account`). Every target that deletes a stack also demands
`CONFIRM_DESTROY=<client host>`, typed.

| | |
|---|---|
| `make stack-status DOMAIN_APEX=…` | status and termination protection, or "no stack" |
| `make stack-outputs …` / `make stack-events …` | outputs; events newest first |
| `make check-stack-vars …` | the create/update inputs, without creating anything |
| `make check-destroy-vars … CONFIRM_DESTROY=…` | every destroy gate, without destroying anything |
| `make bucket-create …` | the permanent bucket, **once** per environment; refuses if it exists |
| `make bucket-configure …` | reassert its public-access block and tags; idempotent |
| `make stack-deploy …` | create or update; refuses a stack in any state but healthy, and refuses a first create while any distribution still carries either hostname |
| `make stack-prestage …` | build, upload to the stack's bucket, verify — **no** invalidation |
| `make stack-activate …` | verify the pre-staged bucket against `dist/` and invalidate — **no** build |
| `make stack-upload …` | the full build + upload + invalidate, forced to the stack's bucket |
| `make stack-protect …` / `stack-unprotect … CONFIRM_DESTROY=…` | termination protection (production) |
| `make stack-destroy … CONFIRM_DESTROY=…` | delete the stack, then empty the bucket; never deletes the bucket |
| `make stack-delete-failed … CONFIRM_DESTROY=…` | the way out of a failed state; refuses a healthy or in-progress stack |
| `make stack-abort-create … CONFIRM_DESTROY=…` | the way out of a hung `CREATE_IN_PROGRESS`; shows the evidence first |

`deploy` / `destroy` are aliases of `stack-deploy` / `stack-destroy`.
`deploy-client-to-<env>` is `stack-deploy` then `stack-upload`;
`destroy-client-<env>` is `stack-destroy`.

**What cannot be overridden:** `STACK_NAME`, `STACK_BUCKET`, `STACK_REGION`
(`us-east-1`) and `EXPECTED_AWS_ACCOUNT_ID` are locked in the Makefile. A stray
`STACK_BUCKET=` or `AWS_DEFAULT_REGION` cannot reach a stack operation. `DOMAIN`
can be given but is refused if it is not `client.<DOMAIN_APEX>`.

**Two bucket variables.** `STACK_BUCKET` is the bucket the stack is built
against and the only one `stack-destroy` empties. `S3_BUCKET` is where the
low-level `upload-*` targets write; it defaults to `STACK_BUCKET`, and the
`live-update-<env>` / `release-*` wrappers go through `stack-upload` /
`stack-verify`, which force the stack's bucket and ignore any `S3_BUCKET` on
the command line. No stack operation reads `S3_BUCKET`.

### Creating an environment from nothing

Both environments exist and have termination protection on; this is for a
new one, or for rebuilding one after `stack-destroy`. Everything runs from a
shell with `AWS_PROFILE=sliderule-power` exported and logged in
(`aws sso login`; `aws sts get-caller-identity` must show `Project-Power-User`).

```bash
make bucket-create DOMAIN_APEX=<apex>
make check-stack-vars DOMAIN_APEX=<apex>
make stack-deploy DOMAIN_APEX=<apex>
make stack-upload DOMAIN_APEX=<apex>
make stack-protect DOMAIN_APEX=<apex>
```

`stack-deploy` needs the apex's public hosted zone to exist and, if a
certificate for the domain has been issued in this account before, its ACM
validation CNAME to still be in the zone (the template does not create that
record — see "Not in the stack"). A first create takes ~6 minutes; a new
certificate on a zone with no validation record will sit in
`CREATE_IN_PROGRESS` until the record is added by hand from the ACM console.

The two cutovers that created today's stacks (test 2026-09-15, production
2026-09-18) followed the plan's §7.2 with the Terraform-era resources destroyed
first; [`RUNBOOK-production.md`](RUNBOOK-production.md) is the production one
as run, kept for the record. The Terraform deployment and its `make` targets
were removed afterwards (Phase 5), so those runbooks are no longer executable.

### When a stack operation fails (condensed §7.3)

`stack-deploy` runs only when there is no stack or it is `CREATE_COMPLETE`,
`UPDATE_COMPLETE` or `UPDATE_ROLLBACK_COMPLETE`; everything else is refused.

| Status | Do |
|---|---|
| `ROLLBACK_COMPLETE`, `CREATE_FAILED`, `REVIEW_IN_PROGRESS` | `make stack-delete-failed … CONFIRM_DESTROY=…`, read `stack-events`, fix, `stack-deploy` again |
| `ROLLBACK_FAILED` | fix or remove the resource `stack-events` names by hand, then `stack-delete-failed` (no `RETAIN=` here) |
| `DELETE_FAILED` | fix the cause, `stack-delete-failed` again; last resort `RETAIN='<logical ids>'` **or** `FORCE_DELETE=1` — only from this status, one at a time |
| `UPDATE_ROLLBACK_COMPLETE` | the site is up on the previous configuration; fix the template, `stack-deploy` |
| `UPDATE_ROLLBACK_FAILED` | fix the resource, `aws cloudformation continue-update-rollback --region us-east-1 --stack-name <name>`, then `stack-deploy` |
| any `*_IN_PROGRESS` except the two below | wait; watch `stack-events` |
| `UPDATE_IN_PROGRESS`, genuinely stuck | `aws cloudformation cancel-update-stack --region us-east-1 --stack-name <name>` → `UPDATE_ROLLBACK_COMPLETE` |
| `CREATE_IN_PROGRESS` past ~30 min | suspect the certificate: is the validation CNAME resolving? Only once **no event for 15+ minutes**, the certificate is not merely waiting on DNS, and the budget is blown: `make stack-abort-create … CONFIRM_DESTROY=…` |

Recovery is fix-forward: a template edit and a stack update. Nothing in this
table touches the bucket.
