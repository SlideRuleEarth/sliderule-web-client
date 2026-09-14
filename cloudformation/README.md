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
| `make terraform-destroy … S3_BUCKET=<old bucket>` | the Terraform-era destroy, once, at the cutover |

`deploy` / `destroy` are aliases of `stack-deploy` / `stack-destroy`.
`deploy-client-to-<env>` is `stack-deploy` then `stack-upload`;
`destroy-client-<env>` is `stack-destroy`. There is no `terraform-deploy`.

**What cannot be overridden:** `STACK_NAME`, `STACK_BUCKET`, `STACK_REGION`
(`us-east-1`) and `EXPECTED_AWS_ACCOUNT_ID` are locked in the Makefile. A stray
`STACK_BUCKET=` or `AWS_DEFAULT_REGION` cannot reach a stack operation. `DOMAIN`
can be given but is refused if it is not `client.<DOMAIN_APEX>`.

**Two bucket variables.** `STACK_BUCKET` is the bucket the stack is built
against and the only one `stack-destroy` empties. `S3_BUCKET` is where uploads
go; it defaults to `STACK_BUCKET`, and until an environment's cutover its
`live-update-<env>` wrapper pins it to the Terraform-era bucket. No stack
operation reads `S3_BUCKET`; `terraform-destroy` insists it is typed on the
command line and is not the stack's bucket.

### Cutover runbook (condensed §7.2 — the plan is authoritative)

Before the window:

1. `cd terraform && terraform workspace select client.<apex>-web-client`; `terraform plan` shows no changes.
2. Snapshot to a directory **outside the checkout**: `terraform state pull > $ARCHIVE/<env>-pre-cutover.tfstate.json`, plus `get-distribution-config` for both distributions, the headers policy and the function.
3. Certificate check (V1): `aws acm describe-certificate --region us-east-1 --certificate-arn <arn> --query Certificate.InUseBy` lists exactly this environment's two distributions. If not, `terraform state rm` the certificate and its validation so the destroy leaves it.
4. Retain the validation CNAME: `terraform state rm module.cloudfront.aws_route53_record.cert_validation_root module.cloudfront.aws_route53_record.cert_validation_wildcard`.
5. Production: `terraform state rm` the bucket, its policy and its public-access block too, so the old bucket survives as a fallback copy.
6. `make lint-cfn`, `make validate-cfn`; `make stack-status DOMAIN_APEX=<apex>` says no stack.
7. `make bucket-create DOMAIN_APEX=<apex>`, then `make stack-prestage DOMAIN_APEX=<apex>`. **From here until step 10, do not run `make build`** — a rebuild changes the hashed bundle and `upload-assets` deletes what was staged. Leave `web-client/dist/` alone.
8. Production: announce the window.

In the window — the outage runs from step 9 to step 11:

9. `make terraform-destroy DOMAIN_APEX=<apex> S3_BUCKET=<old bucket>`; answer Terraform's prompt. 10–20 min.
10. `make stack-deploy DOMAIN_APEX=<apex>` (10–25 min; `make stack-events` in a second terminal), then `make stack-activate DOMAIN_APEX=<apex>`. Not `deploy-client-to-<env>` and not `stack-upload`: both rebuild. If step 7's pre-staging was skipped, `stack-upload` is the fallback and the window absorbs the build.
11. Verify (§7.4 of the plan): apex 301 and 404, client 200, headers, `dig` A and AAAA for both hosts. Note the elapsed time.
12. Production: `make stack-protect DOMAIN_APEX=slideruleearth.io`.

After the window:

13. `terraform workspace select default && terraform workspace delete client.<apex>-web-client` — this deletes the state object; step 2's archive is the only record.
14. Merge the prepared PR that drops `S3_BUCKET=<old>` from this environment's `live-update-*` / `release-*` wrappers, and run `make live-update-<env>` once to prove the default path.

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

Rollback of the migration is fix-forward: a template edit and a stack update.
Nothing in this table touches the bucket.
