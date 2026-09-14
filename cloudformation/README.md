# CloudFormation deployment of the web client

One template, one stack per environment, always in `us-east-1`. This directory
replaces [`terraform/`](../terraform/) — see
[`docs/cloudformation-migration-plan.md`](../docs/cloudformation-migration-plan.md)
for the design, the decisions behind it and the cutover runbook. This file is
the short version for someone operating it.

```
cloudformation/
├── web-client.yaml          the template
├── requirements-lint.in     what we ask for: cfn-lint==<version>
└── requirements-lint.txt    the resolved lock uv actually installs (generated, committed)
```

## What the stack is

| | test | production |
|---|---|---|
| Stack name | `client-testsliderule-org-web-client` | `client-slideruleearth-io-web-client` |
| Client host | `client.testsliderule.org` | `client.slideruleearth.io` |
| Apex | `testsliderule.org` | `slideruleearth.io` |

The stack name mirrors the old Terraform workspace name with the dots replaced.
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

```bash
make lint-cfn       # cfn-lint, pinned; needs uv and nothing else, no AWS
make validate-cfn   # the CloudFormation API's syntax check; needs credentials, changes nothing
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

Two strings must stay byte-identical to what the Terraform module served,
because the client's workers and WASM load only if the response headers are the
same:

- the `ContentSecurityPolicy` value in `SecurityHeadersPolicy` — one long line,
  copied verbatim, including its repeated hosts and doubled spaces;
- the `FunctionCode` of `ApexRedirectFunction`.

Both sit inside `!Sub`, so every `${…}` in them is a substitution. Today those
are only `${DomainApex}` and `${DomainName}`; if you ever need a literal `${`
(a JS template literal, say), write `${!`.

Every CloudFront property whose Terraform default differed from the
CloudFormation default is set explicitly (`HttpVersion`, `IPV6Enabled`,
`Restrictions`). Treat anything the template does not state as a question, not
as a safe default.

## Deploying, cutting over, destroying

The `stack-*`, `bucket-*` and `check-*` Makefile targets that drive this
template land in a separate PR; the runbook section of this README is written
with them. Until then, the authoritative procedure is §7.2 (cutover) and §7.3
(recovery) of the migration plan. Until an environment's cutover its
infrastructure is frozen: content deploys continue through `make
live-update-<env>`, and nothing under `terraform/` changes.
