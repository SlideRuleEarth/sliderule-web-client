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

### Cutover runbook (§7.2 of the plan, made cut-and-paste)

Every fenced block below is meant to be pasted whole, with the copy button.
**The blocks contain commands only — no comments** — because an interactive
zsh does not treat `#` as a comment and would run it. Everything you need to
know is in the prose above each block.

Set these once, in the shell you will use for the whole procedure. Phase 4
uses `slideruleearth.io` and `slideruleearth-webclient`. `ARCHIVE` is any
directory outside the checkout.

```bash
export APEX=testsliderule.org
export OLD_BUCKET=testsliderule-webclient
export ARCHIVE=$HOME/sliderule-tf-archive
export CLIENT=client.$APEX
export WS=$CLIENT-web-client
mkdir -p "$ARCHIVE"
```

**Terraform `plan` and `apply` need the four `-var`s.** The root
`variables.tf` defaults `domainName` to the apex itself — the retired
client-at-apex mode — so a bare `terraform plan` proposes destroying the apex
distribution and re-aliasing the client to the apex. The block below carries
the same values the Makefile passes. `state pull`, `state rm`, `state show`
and `workspace` commands do not read variables and are safe bare.

#### Before the window

The site stays up and no clock is running.

**Step 1 — select the workspace, prove it, prove there is no drift.** The
plan must end with `No changes.` Anything else means the freeze was broken;
stop and explain it before going on.

```bash
cd terraform
terraform workspace select "$WS"
terraform workspace show
terraform plan -var="domainName=$CLIENT" -var="domainApex=$APEX" -var="domain_root=client" -var="s3_bucket_name=$OLD_BUCKET"
```

**Step 2 — snapshot, before any `state rm`.** Five files land in `$ARCHIVE`;
the `echo` must print one `E…` id for each distribution.

```bash
terraform state pull > "$ARCHIVE/$APEX-pre-cutover.tfstate.json"
CLIENT_ID=$(aws cloudfront list-distributions --query "DistributionList.Items[?Aliases.Items[0]=='$CLIENT'].Id" --output text)
APEX_ID=$(aws cloudfront list-distributions --query "DistributionList.Items[?Aliases.Items[0]=='$APEX'].Id" --output text)
echo "client=$CLIENT_ID apex=$APEX_ID"
aws cloudfront get-distribution-config --id "$CLIENT_ID" > "$ARCHIVE/$APEX-client-distribution.json"
aws cloudfront get-distribution-config --id "$APEX_ID" > "$ARCHIVE/$APEX-apex-distribution.json"
POLICY_ID=$(terraform state show module.cloudfront.aws_cloudfront_response_headers_policy.security_headers_policy | awk '$1=="id"{gsub(/"/,"",$3); print $3}')
aws cloudfront get-response-headers-policy --id "$POLICY_ID" > "$ARCHIVE/$APEX-headers-policy.json"
aws cloudfront get-function --name "$(echo "$CLIENT" | tr . -)-apex-redirect" --stage LIVE "$ARCHIVE/$APEX-apex-function.js"
ls -l "$ARCHIVE"
```

**Step 3 — certificate check (V1).** `InUseBy` must list exactly
`$CLIENT_ID` and `$APEX_ID`.

```bash
CERT_ARN=$(terraform state show module.cloudfront.aws_acm_certificate.mysite | awk '$1=="arn"{gsub(/"/,"",$3); print $3}')
aws acm describe-certificate --region us-east-1 --certificate-arn "$CERT_ARN" --query Certificate.InUseBy
```

Only if it lists anything else, also run this, so the destroy leaves the
certificate in place:

```bash
terraform state rm module.cloudfront.aws_acm_certificate.mysite module.cloudfront.aws_acm_certificate_validation.cert
```

**Step 4 — retain the validation CNAME.** Terraform stops managing the
record; the record itself stays in the zone.

```bash
terraform state rm module.cloudfront.aws_route53_record.cert_validation_root module.cloudfront.aws_route53_record.cert_validation_wildcard
```

**Step 5 — production only, recommended.** Keeps the old bucket and its
content as a fallback copy; delete it by hand in Phase 5. Skip for test.

```bash
terraform state rm module.cloudfront.aws_s3_bucket.this_site_bucket module.cloudfront.aws_s3_bucket_policy.web module.cloudfront.aws_s3_bucket_public_access_block.web_client_site_access_block
```

**Step 6 — optional: record exactly what the destroy is about to remove, and
leave `terraform/`.**

```bash
terraform state pull > "$ARCHIVE/$APEX-pre-destroy.tfstate.json"
cd ..
```

**Step 7 — V2.** Done for both environments on 2026-09-14; nothing to run.

**Step 8 — the template and the account are ready; there is no stack yet.**
`stack-status` must say `no stack named …`.

```bash
make lint-cfn
make validate-cfn
make stack-status DOMAIN_APEX=$APEX
```

**Step 9 — the permanent bucket, then pre-stage the site into it.** After
this block, **do not run `make build`** until step 12 has run, and leave
`web-client/dist/` alone: a rebuild changes the hashed bundle and
`upload-assets` deletes what was staged.

```bash
make bucket-create DOMAIN_APEX=$APEX
make check-stack-vars DOMAIN_APEX=$APEX
make stack-prestage DOMAIN_APEX=$APEX
```

**Step 10 — production only:** announce the window, sized at twice what
Phase 3 measured.

#### In the window

The outage runs from step 11 to step 13. Note the time at 11 and at 13.

**Step 11 — Terraform destroy, 10–20 minutes.** Answer Terraform's prompt.

```bash
make terraform-destroy DOMAIN_APEX=$APEX S3_BUCKET=$OLD_BUCKET
```

**Step 12 — create the stack (10–25 minutes), then activate the pre-staged
bucket (seconds).** In a second terminal, `make stack-events DOMAIN_APEX=$APEX`
shows progress. **Not** `deploy-client-to-<env>` and **not** `stack-upload`:
both rebuild and discard the pre-staged set. If the create fails, see the
table below.

```bash
make stack-deploy DOMAIN_APEX=$APEX
make stack-activate DOMAIN_APEX=$APEX
```

Only if step 9's pre-staging was skipped, use this instead of
`stack-activate`; the window absorbs the build:

```bash
make stack-upload DOMAIN_APEX=$APEX
```

**Step 13 — verify** (§7.4 of the plan). Expected, in order: the apex `/`
is a 301 whose `location` is `https://$CLIENT/landing`; the apex
`robots.txt` is a 404 `text/plain` naming `$CLIENT` and
`docs.slideruleearth.io`; the client `/` is a 200 carrying the security
headers; the client `robots.txt` is a 200 `text/plain`; all four `dig`
queries answer.

```bash
curl -sI "https://$APEX/" | head -5
curl -si "https://$APEX/robots.txt" | head -12
curl -sI "https://$CLIENT/" | head -20
curl -sI "https://$CLIENT/robots.txt" | head -5
dig +short "$APEX" A
dig +short "$APEX" AAAA
dig +short "$CLIENT" A
dig +short "$CLIENT" AAAA
```

**Step 14 — production only.**

```bash
make stack-protect DOMAIN_APEX=$APEX
make stack-status DOMAIN_APEX=$APEX
```

#### After the window

**Step 15 — retire the workspace.** This **deletes its state object**; step
2's archive is the only record.

```bash
cd terraform
terraform workspace select default
terraform workspace delete "$WS"
cd ..
```

**Step 16 — merge the prepared PR** that drops `S3_BUCKET=$OLD_BUCKET` from
this environment's `live-update-*` / `release-*` wrappers, then prove the
default path once (Phase 4: `live-update-slideruleearth`):

```bash
make live-update-testsliderule
```

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
