# Production cutover runbook — `slideruleearth.io`

The Terraform → CloudFormation cutover of the production web client:
`slideruleearth.io` (apex) and `client.slideruleearth.io` (the SPA). This is
Phase 4 of [`docs/cloudformation-migration-plan.md`](../docs/cloudformation-migration-plan.md)
(§7.2 is the procedure this expands, §7.3 the recovery table), written after
the test cutover of 2026-09-15 and carrying everything it taught.

**How to read this.** Every fenced block is pasted whole, with the copy
button, into one shell. Blocks contain commands only — never a `#` comment,
because an interactive zsh runs `#` lines. Every value is literal: nothing to
substitute, nothing to remember from an earlier step; where a step needs an
id that only AWS knows, the block looks it up and prints it. After each block
is what you should see, and **STOP** conditions. If a STOP condition is met,
do not run the next block; paste the output to Claude Code (or read §7.3) and
decide.

**Names, once, for reference only** — you never type these; the blocks do:

| | |
|---|---|
| Apex | `slideruleearth.io` |
| Client host | `client.slideruleearth.io` |
| Terraform workspace | `client.slideruleearth.io-web-client` |
| Terraform-era bucket (retained) | `slideruleearth-webclient` |
| Stack name | `client-slideruleearth-io-web-client` |
| Stack bucket (new, permanent) | `client-slideruleearth-io-web-client` |
| Region | `us-east-1` |
| Account | `742127912612` |
| Archive directory | `$HOME/sliderule-tf-archive` (outside the checkout) |

**What is different from the test cutover.** Three steps that were optional
or skipped for test are **mandatory** here: the old bucket is retained as a
fallback copy (step 5), termination protection is turned on (step 14), and
the window is announced (step 10). Verification is the full §7.4 list, not
the short one. Expect the window to be shorter than test's 28 minutes: the
template fault that cost 15 minutes there is fixed.

---

## Go / no-go

Do not open the window until every line is true.

- [ ] Part A done: V1 and V7 for `slideruleearth.io` recorded in the plan (§10)
- [ ] Announcement agreed with the other developer — method: ______ lead time: ______
- [ ] Announcement sent, window: date ______ start (local) ______ length **60 min**
- [ ] In-app banner deployed on ______ (step 8b); **no content deploy without `BANNER_TEXT` since** — that includes `release-live-update-to-slideruleearth` and `deploy-client-to-slideruleearth` — and the banner seen in the browser immediately before step 9
- [ ] `main` is clean and pulled; `make lint-cfn` and `make validate-cfn` pass
- [ ] The post-cutover wrappers PR for `slideruleearth.io` is open and **not merged** (Part D, step 16)
- [ ] Part B steps 0–9 done, in this order, on the day (or the evening before, for 1–8)
- [ ] `make stack-status DOMAIN_APEX=slideruleearth.io` says `no stack`
- [ ] `make stack-status DOMAIN_APEX=testsliderule.org` says `CREATE_COMPLETE` (test is healthy; nothing regressed)
- [ ] Nobody has run `make build` since step 9's pre-stage, and `web-client/dist/` is untouched
- [ ] Claude Code session open, ready to read `stack-events` if the create fails

---

## Part A — scheduling gate (any time before; read-only)

**A0. Profile.** The default profile is `Project-Read-Only`; it can do all of
Part A. Use it or `sliderule-power`, either is fine here.

**A1. V1 — is the production certificate used by anything but its own two
distributions?** This decides whether step 3 takes its branch.

```bash
cd terraform
terraform workspace select client.slideruleearth.io-web-client
terraform workspace show
CERT_ARN=$(terraform state show module.cloudfront.aws_acm_certificate.mysite | awk '$1=="arn"{gsub(/"/,"",$3); print $3}')
cd ..
echo "$CERT_ARN"
aws acm describe-certificate --region us-east-1 --certificate-arn "$CERT_ARN" --query 'Certificate.[InUseBy,DomainValidationOptions[].ResourceRecord.[Name,Value]]'
```

Expect: `client.slideruleearth.io-web-client`, one ARN
`arn:aws:acm:us-east-1:742127912612:certificate/…`, then `InUseBy` with
**exactly two** `arn:aws:cloudfront::742127912612:distribution/…` entries
and the validation record name/value. (Step 3 repeats this on the day and
saves the ARN; step 8 uses the saved copy.)
**STOP** if `InUseBy` has a third entry: something else uses this
certificate, and step 3 must take its branch. Tell Claude Code; the plan's V1
row is updated with the answer either way.

**A2. V7 — which other certificates share the validation CNAME?**

```bash
for region in us-east-1 us-west-2; do echo "== $region"; aws acm list-certificates --region $region --includes keyTypes=RSA_1024,RSA_2048,RSA_3072,RSA_4096,EC_prime256v1,EC_secp384r1,EC_secp521r1 --query "CertificateSummaryList[?DomainName=='slideruleearth.io' || DomainName=='*.slideruleearth.io' || contains(not_null(SubjectAlternativeNameSummaries, \`[]\`), 'slideruleearth.io') || contains(not_null(SubjectAlternativeNameSummaries, \`[]\`), '*.slideruleearth.io')].[CertificateArn,DomainName,Status,InUse]" --output table; done
```

Expect: our certificate with `InUse True`, possibly others (the docs site and
the API hosts live under this apex in other stacks — some may be **in use**).
This never blocks the cutover: the validation CNAME is retained regardless.
Record the list in the plan's V7 row. It does tell you what would be hurt if
the CNAME were ever deleted — so it never is.

---

## Part B — before the window (site up, no clock)

Step 8b (the banner) is days ahead. Steps 1–8 can be done the evening before.
Step 9 too, as long as nobody runs `make build` afterwards.

**Step 0 — the right profile, logged in, verified.** Everything from here
writes. `sliderule-power` (`Project-Power-User`) was sufficient for every
step of the test cutover; its session is 8 hours. The export must be in
**this** shell, the one you will paste every later block into.

```bash
export AWS_PROFILE=sliderule-power
export AWS_PAGER=
aws sso login
aws sts get-caller-identity --query '[Account,Arn]' --output text
```

Expect: `742127912612` and an ARN containing `Project-Power-User`.
**STOP** if it says `Read-Only` — the export did not happen in this shell.

**Step 1 — select the workspace, prove it, prove there is no drift.** The
four `-var`s are required: without them Terraform uses defaults that
describe the retired client-at-apex mode and proposes destroying the apex.

```bash
mkdir -p "$HOME/sliderule-tf-archive"
cd terraform
terraform workspace select client.slideruleearth.io-web-client
terraform workspace show
terraform plan -var="domainName=client.slideruleearth.io" -var="domainApex=slideruleearth.io" -var="domain_root=client" -var="s3_bucket_name=slideruleearth-webclient"
```

Expect: `client.slideruleearth.io-web-client`, then a refresh of ~14
resources ending in **`No changes.`**
**STOP** on anything but `No changes.` — the infrastructure freeze was
broken; the drift must be explained before anything is destroyed.

**Step 2 — snapshot, before any `state rm`.** Five files; the `echo` must
print one `E…` id for each distribution.

```bash
terraform state pull > "$HOME/sliderule-tf-archive/slideruleearth.io-pre-cutover.tfstate.json"
CLIENT_ID=$(aws cloudfront list-distributions --query "DistributionList.Items[?Aliases.Items[0]=='client.slideruleearth.io'].Id" --output text)
APEX_ID=$(aws cloudfront list-distributions --query "DistributionList.Items[?Aliases.Items[0]=='slideruleearth.io'].Id" --output text)
echo "client=$CLIENT_ID apex=$APEX_ID"
aws cloudfront get-distribution-config --id "$CLIENT_ID" > "$HOME/sliderule-tf-archive/slideruleearth.io-client-distribution.json"
aws cloudfront get-distribution-config --id "$APEX_ID" > "$HOME/sliderule-tf-archive/slideruleearth.io-apex-distribution.json"
POLICY_ID=$(terraform state show module.cloudfront.aws_cloudfront_response_headers_policy.security_headers_policy | awk '$1=="id"{gsub(/"/,"",$3); print $3}')
aws cloudfront get-response-headers-policy --id "$POLICY_ID" > "$HOME/sliderule-tf-archive/slideruleearth.io-headers-policy.json"
aws cloudfront get-function --name client-slideruleearth-io-apex-redirect --stage LIVE "$HOME/sliderule-tf-archive/slideruleearth.io-apex-function.js"
ls -l "$HOME/sliderule-tf-archive"
```

Expect: `client=E… apex=E…` (one id each), one `ETag` line from
`get-function`, and `ls` showing the five `slideruleearth.io-*` files, all
non-zero. **STOP** if an id is empty or doubled, or a file is missing.

**Step 3 — certificate check, repeated on the day.** Same as A1; the answer
must not have changed. The block also **saves the certificate ARN to the
archive**, because step 8 needs it and, if the branch below is taken, the
state address it came from will be gone.

```bash
terraform state show module.cloudfront.aws_acm_certificate.mysite | awk '$1=="arn"{gsub(/"/,"",$3); print $3}' > "$HOME/sliderule-tf-archive/slideruleearth.io-terraform-cert-arn.txt"
cat "$HOME/sliderule-tf-archive/slideruleearth.io-terraform-cert-arn.txt"
aws acm describe-certificate --region us-east-1 --certificate-arn "$(cat "$HOME/sliderule-tf-archive/slideruleearth.io-terraform-cert-arn.txt")" --query 'Certificate.InUseBy'
```

Expect: one ARN, then exactly the two ids step 2 printed. **Only if a third
entry appears**, run this so the destroy leaves the certificate in place —
the stack issues its own regardless. Taking this branch changes two later
numbers: step 6 lists **10** (not 12) and step 11 destroys **7** (not 9).

```bash
terraform state rm module.cloudfront.aws_acm_certificate.mysite module.cloudfront.aws_acm_certificate_validation.cert
```

**Step 4 — retain the validation CNAME.** Terraform stops managing the
record; it stays in the zone, and the new certificate validates against it.

```bash
terraform state rm module.cloudfront.aws_route53_record.cert_validation_root module.cloudfront.aws_route53_record.cert_validation_wildcard
```

Expect: two `Removed …` lines and `Successfully removed 2 resource instance(s).`
**STOP** on `Error saving the state` (a 403 here means step 0 was not done
in this shell).

**Step 5 — retain the old bucket — mandatory for production.** After this,
`terraform destroy` leaves `slideruleearth-webclient` and its contents alone,
as the fallback copy. It is deleted by hand in Phase 5, never before.

```bash
terraform state rm module.cloudfront.aws_s3_bucket.this_site_bucket module.cloudfront.aws_s3_bucket_policy.web module.cloudfront.aws_s3_bucket_public_access_block.web_client_site_access_block
```

Expect: three `Removed …` lines, `Successfully removed 3 resource instance(s).`

**Step 6 — record exactly what the destroy will remove; leave `terraform/`.**

```bash
terraform state pull > "$HOME/sliderule-tf-archive/slideruleearth.io-pre-destroy.tfstate.json"
terraform state list
cd ..
```

Expect: **12** lines — 9 resources plus the 3 `data.` sources — with no
`cert_validation_*` and no `aws_s3_bucket*` among them. **If step 3 took its
branch: 10 lines**, 7 resources, and no `aws_acm_certificate*` either. (Test
listed 14 managed and destroyed 12; production destroys 9, or 7.)

**Step 7 — V2.** Done for both environments on 2026-09-14; nothing to run.

**Step 8 — everything is ready and nothing exists yet.** The last block
proves the validation CNAME in the zone is what ACM expects, so the
certificate will validate without the template touching the record: it reads
the expected record name and value from the Terraform-era certificate (the
ARN step 3 saved — same account, same domain, so the new certificate expects
the same record), then looks up **exactly that name** in the zone.

```bash
make lint-cfn
make validate-cfn
make stack-status DOMAIN_APEX=slideruleearth.io
make stack-status DOMAIN_APEX=testsliderule.org
```

Expect: lint silent, the template Description, `no stack named
client-slideruleearth-io-web-client in us-east-1`, and
`client-testsliderule-org-web-client: CREATE_COMPLETE (…)`.

```bash
ZONE_ID=$(aws route53 list-hosted-zones-by-name --dns-name slideruleearth.io --query "HostedZones[?Name=='slideruleearth.io.' && Config.PrivateZone==\`false\`].Id" --output text | sed 's|/hostedzone/||')
CERT_ARN=$(cat "$HOME/sliderule-tf-archive/slideruleearth.io-terraform-cert-arn.txt")
EXPECTED=$(aws acm describe-certificate --region us-east-1 --certificate-arn "$CERT_ARN" --query 'Certificate.DomainValidationOptions[0].ResourceRecord.[Name,Value]' --output text)
read -r EXPECTED_NAME EXPECTED_VALUE <<< "$EXPECTED"
IN_ZONE=$(aws route53 list-resource-record-sets --hosted-zone-id "$ZONE_ID" --query "ResourceRecordSets[?Name=='$EXPECTED_NAME' && Type=='CNAME'].ResourceRecords[0].Value" --output text)
echo "zone=$ZONE_ID"
echo "ACM expects  $EXPECTED_NAME -> $EXPECTED_VALUE"
echo "zone has     $EXPECTED_NAME -> $IN_ZONE"
case "$EXPECTED_VALUE" in _*.acm-validations.aws.) test "$IN_ZONE" = "$EXPECTED_VALUE" && echo VALIDATION-CNAME-OK || echo VALIDATION-CNAME-MISMATCH;; *) echo VALIDATION-CNAME-LOOKUP-FAILED;; esac
```

Expect: `zone=Z…` (one id), two lines showing the same `_….slideruleearth.io.`
name and the same `_….acm-validations.aws.` value, and
**`VALIDATION-CNAME-OK`**. The verdict is only `OK` when ACM returned a real
`_….acm-validations.aws.` value *and* the zone holds exactly it; two empty
strings are `LOOKUP-FAILED`, not `OK`. **STOP** on `MISMATCH` (the new
certificate would hang in `CREATE_IN_PROGRESS`) or `LOOKUP-FAILED` (the ARN
file, the session or the zone id is wrong). Tell Claude Code before doing
anything to the zone.

**Step 8b — the in-app banner, days ahead.** The client already supports a
banner: `BANNER_TEXT` is inlined at build time and `SrAppBar.vue` shows it
whenever it is non-empty. This is an ordinary content deploy to the
Terraform-era bucket and distribution — exactly what the freeze permits — and
it needs no infrastructure change. Do it as many days ahead as the
announcement agreed. Only people who open the client see it, so it complements
the announcement; it does not replace it. Edit the text and the date first.

```bash
make live-update-slideruleearth BANNER_TEXT='Scheduled maintenance: the SlideRule web client will be unavailable for about an hour on DAY DD MONTH from HH:MM to HH:MM UTC. Your saved records are not affected.'
```

Expect: the build echoes `VITE_BANNER_TEXT=Scheduled maintenance: …`, the
usual uploads to `s3://slideruleearth-webclient/…`, an invalidation, and
`✅ Found:` lines. Reload `https://client.slideruleearth.io/` — the banner is
in the app bar.

**After this, no content deploy without `BANNER_TEXT`**: any build with it
empty removes the banner, and that is every wrapper that builds —
`live-update-slideruleearth`, `release-live-update-to-slideruleearth`,
`deploy-client-to-slideruleearth`. To change the wording, run the same
command with the new text. Look at the site immediately before step 9 and
confirm the banner is still there. The banner comes off by
itself at the cutover: step 9 builds with `BANNER_TEXT` empty, so the
pre-staged site that goes live at step 12 has none.

**Step 9 — the permanent bucket, then pre-stage the site into it.**

```bash
make bucket-create DOMAIN_APEX=slideruleearth.io
make bucket-configure DOMAIN_APEX=slideruleearth.io
make check-stack-vars DOMAIN_APEX=slideruleearth.io
```

Expect: `✅ created bucket client-slideruleearth-io-web-client in us-east-1`,
`✅ … public access blocked, tagged` twice, then the stack inputs with
`HOSTED_ZONE_ID = Z… (lookup)` matching step 8's zone.
If `bucket-create` refuses, read which message it printed:

- `❌ bucket … already exists: refusing. To reassert its settings run make bucket-configure`
  — **this account already has the bucket** (step 9 was run before, or a
  previous attempt got as far as `create-bucket`). That is fine: the next
  command, `bucket-configure`, finishes the job; continue.
- `❌ head-bucket on … failed for a reason other than 'not found'` with a
  `403` — **STOP**, but a 403 is not yet proof that another account owns the
  name: S3 answers 403 for a session or permission problem too. Diagnose in
  this order: the session (`aws sts get-caller-identity` — still
  `Project-Power-User`?); then ownership
  (`aws s3api list-buckets --query "Buckets[?Name=='client-slideruleearth-io-web-client'].Name"`
  — lists it only if this account owns it, in which case run
  `make bucket-configure DOMAIN_APEX=slideruleearth.io` and continue). Only
  if the session is right and the bucket is not ours is the name genuinely
  taken — and then the fix is a committed Makefile edit
  (`BUCKET_client-slideruleearth-io-web-client`, plan §5.4), reviewed, before
  the window. Never pick a name by hand.

```bash
make stack-prestage DOMAIN_APEX=slideruleearth.io
```

Expect (several minutes): a full build echoing **`VITE_BANNER_TEXT=`**
(empty — the banner is not carried into the new site), uploads to
`s3://client-slideruleearth-io-web-client/…`, **`Uploading web-client/dist/robots.txt`**
(the real, crawlable file — this is production; test said "substituting
robots.noindex.txt"), `✅ Found:` for each `index-*.js/css`, and
`✅ pre-staged into s3://client-slideruleearth-io-web-client. Do NOT run make build …`.

**From here until step 13 has passed: no `make build`, and leave
`web-client/dist/` alone.** Step 12's `stack-activate` checks the bucket
against it, and step 13 picks the asset it fetches from it — a rebuild in
between would make verification look for an object that was never uploaded.

**Step 10 — announce the window.** As agreed (go/no-go line 2). Size: **60
minutes**; test took 28 including a 15-minute template fault that is fixed.

---

## Part C — the window (outage from step 11 to step 13)

Write down the time when you type `yes` in step 11 and when step 13's checks
pass.

**Step 11 — verify the session, then Terraform destroy (test: 5 min).**

```bash
aws sts get-caller-identity --query '[Account,Arn]' --output text
make terraform-destroy DOMAIN_APEX=slideruleearth.io S3_BUCKET=slideruleearth-webclient
```

Expect: the ARN with `Project-Power-User`; Terraform plans **9 to destroy**
(not 12 — the bucket trio stays; **7** if step 3 took its branch), asks for
`yes`; then `Destroy complete! Resources: 9 destroyed.` (or `7`). The site is down from the first
distribution's disable.
**If it stops with `AccessDenied`** part-way: `export AWS_PROFILE=sliderule-admin`,
`aws sso login`, verify, and run the same `make terraform-destroy …` line again — it
resumes with what is left in state.

**Step 12 — create the stack (test: ~15 min for a clean create), then activate.**

```bash
make stack-deploy DOMAIN_APEX=slideruleearth.io
```

Expect: account check, lint, `▶ first create of client-slideruleearth-io-web-client`,
`HostedZoneId=Z… (lookup)  S3BucketName=client-slideruleearth-io-web-client`,
`Waiting for stack create/update to complete`, then
`Successfully created/updated stack` and the outputs table with **five**
rows. In a second terminal, progress:

```bash
export AWS_PROFILE=sliderule-power
export AWS_PAGER=
make stack-events DOMAIN_APEX=slideruleearth.io
```

**If it prints `Failed to create/update the stack`**, do not retry blind.
Read the failure, decide from §7.3, then the recovery is always the same
shape as the test cutover's:

```bash
aws cloudformation describe-stack-events --region us-east-1 --stack-name client-slideruleearth-io-web-client --query "StackEvents[?contains(ResourceStatus,'FAILED')].[Timestamp,LogicalResourceId,ResourceStatus,ResourceStatusReason]" --output text
make stack-status DOMAIN_APEX=slideruleearth.io
```

then, once the cause is fixed (a template edit, linted), and the status is
`ROLLBACK_COMPLETE`:

```bash
make stack-delete-failed DOMAIN_APEX=slideruleearth.io CONFIRM_DESTROY=client.slideruleearth.io
make stack-deploy DOMAIN_APEX=slideruleearth.io
```

When the create has succeeded:

```bash
make stack-activate DOMAIN_APEX=slideruleearth.io
```

Expect: `✅ Found:` for the same asset names step 9 printed, `▶ invalidating E…`,
and the invalidation JSON. Seconds. **Not** `deploy-client-to-slideruleearth`
and **not** `stack-upload` — both rebuild and throw away the pre-staged set.
Only if step 9's pre-stage was skipped: `make stack-upload DOMAIN_APEX=slideruleearth.io`.

**Step 13 — verify (the full §7.4 list). Note the time.**

```bash
curl -sI https://slideruleearth.io/ | head -5
curl -si https://slideruleearth.io/robots.txt | head -12
curl -si https://slideruleearth.io/anything/else | head -3
curl -sI https://client.slideruleearth.io/ | head -6
curl -s -o /dev/null -w '%{http_version}\n' https://client.slideruleearth.io/
curl -s -o /dev/null -w '%{http_version}\n' https://slideruleearth.io/
```

Expect: `301` with `location: https://client.slideruleearth.io/landing`;
`404` `text/plain` with `x-cache: FunctionGeneratedResponse from cloudfront`;
`404` again; `200 text/html` with `cache-control: no-cache, no-store, must-revalidate`;
`2` and `2`.

```bash
ASSET=$(grep -oE 'assets/index-[a-zA-Z0-9_-]+\.js' web-client/dist/index.html | head -1)
echo "$ASSET"
curl -sI "https://client.slideruleearth.io/$ASSET" | grep -i -E '^HTTP|cache-control'
curl -sI -H 'Accept-Encoding: br, gzip' "https://client.slideruleearth.io/$ASSET" | grep -i -E '^HTTP|content-encoding'
curl -s https://client.slideruleearth.io/robots.txt | head -3
curl -sI http://client.slideruleearth.io/ | head -3
curl -sI https://client.slideruleearth.io/no/such/route | head -1
curl -sI -X POST https://client.slideruleearth.io/ | head -1
curl -sI https://client-slideruleearth-io-web-client.s3.us-east-1.amazonaws.com/index.html | head -1
```

Expect: `200` with `max-age=31536000, immutable`; `200` with a
`content-encoding:` line (compression, D1b — new); the **real** robots.txt
(`User-agent:` lines, not `Disallow: /`); `301` to https; `200` (SPA
fallback); `403` or `405` for POST (D1d — new); `403` from the bucket
directly (private, D1a).

```bash
curl -sI https://client.slideruleearth.io/ | grep -i '^content-security-policy' | sed 's/^[^:]*: //' | tr -d '\r' > /tmp/csp-live.txt
python3 -c "import json;print(json.load(open('$HOME/sliderule-tf-archive/slideruleearth.io-headers-policy.json'))['ResponseHeadersPolicy']['ResponseHeadersPolicyConfig']['SecurityHeadersConfig']['ContentSecurityPolicy']['ContentSecurityPolicy'])" > /tmp/csp-old.txt
test -s /tmp/csp-live.txt && test -s /tmp/csp-old.txt && diff /tmp/csp-live.txt /tmp/csp-old.txt && echo CSP-IDENTICAL || echo CSP-CHECK-FAILED
curl -sI https://client.slideruleearth.io/ | grep -i -E 'strict-transport|x-frame|x-content-type|referrer-policy|x-xss'
```

Expect: `CSP-IDENTICAL`, then the five other headers. `CSP-CHECK-FAILED`
means either a difference (the `diff` lines above it say what) or one side
was empty — the header missing from the live response, or the archive file
from step 2 unreadable. **STOP and read** either way: the CSP is the header
most likely to break workers and WASM in the client.

```bash
openssl s_client -connect client.slideruleearth.io:443 -servername client.slideruleearth.io -tls1_1 </dev/null 2>&1 | grep -i -E 'alert|error|no protocols' | head -2
dig +short slideruleearth.io A
dig +short slideruleearth.io AAAA
dig +short client.slideruleearth.io A
dig +short client.slideruleearth.io AAAA
```

Expect: a TLS failure line (1.1 refused — `TLSv1.2_2021`), then four
non-empty answer sets — the AAAA ones are new (D1c).

Browser: `https://client.slideruleearth.io/` — landing page, a new request,
the elevation plot, and **open a record that existed before the cutover**
(proves the browser-side data survived; it is keyed on the origin, which did
not change). The build date in the UI is step 9's, and **the banner is
gone**.

**Step 14 — termination protection, mandatory.**

```bash
make stack-protect DOMAIN_APEX=slideruleearth.io
make stack-status DOMAIN_APEX=slideruleearth.io
```

Expect: `client-slideruleearth-io-web-client: CREATE_COMPLETE (termination protection: true)`.
From now on `stack-destroy` refuses production until `stack-unprotect` is run
deliberately, with `CONFIRM_DESTROY`.

The outage is over. Post the all-clear as agreed.

---

## Part D — after the window

**Step 15 — retire the workspace.** This deletes the state object in the
backend bucket; step 2's archive is the only surviving record.

```bash
aws sts get-caller-identity --query '[Account,Arn]' --output text
cd terraform
terraform workspace select default
terraform workspace delete client.slideruleearth.io-web-client
cd ..
```

Expect: `Deleted workspace "client.slideruleearth.io-web-client"!`

**Step 16 — merge the prepared wrappers PR, prove the everyday path.** The PR
switches `live-update-slideruleearth`, `release-live-update-to-slideruleearth`
and the production verify wrapper to `stack-upload` / `stack-verify` (the
same change #1111 made for test). Merge it on GitHub, then:

```bash
git pull
make live-update-slideruleearth
```

Expect: a rebuild, `s3 sync … s3://client-slideruleearth-io-web-client/assets/`,
the **real** robots.txt uploaded, an invalidation of the new client
distribution, `✅ Found:` for the new hashes. Reload the client: the build
date is now.

Then, for the record: the measured times go into the plan's §7.3, the Phase 4
checklist is ticked, the tracking issue #1108 is updated, and the old bucket
`slideruleearth-webclient` waits for Phase 5.

---

## If a stack operation fails

`stack-deploy` runs only when there is no stack or it is `CREATE_COMPLETE`,
`UPDATE_COMPLETE` or `UPDATE_ROLLBACK_COMPLETE`; every other status is refused.
The full table is the plan's §7.3; the cases that can happen on the day:

| `make stack-status` says | Do |
|---|---|
| `ROLLBACK_COMPLETE` | the create failed and was rolled back; read the `FAILED` events (block in step 12), fix, `stack-delete-failed`, `stack-deploy` |
| `CREATE_IN_PROGRESS` for more than 30 min | suspect the certificate: is the CNAME step 8 checked still resolving? Only after **15 minutes with no new event**, the certificate not merely waiting, and the 60-minute budget blown: `make stack-abort-create DOMAIN_APEX=slideruleearth.io CONFIRM_DESTROY=client.slideruleearth.io` |
| `DELETE_FAILED` (after `stack-delete-failed`) | fix the named resource, `stack-delete-failed` again; last resort `RETAIN='<ids>'` **or** `FORCE_DELETE=1`, one at a time |
| anything else `*_IN_PROGRESS` | wait; watch `make stack-events DOMAIN_APEX=slideruleearth.io` |

Rollback of the whole migration is fix-forward: a template edit and a stack
update. The old bucket and its content are untouched by anything above, and
the archived state can rebuild the Terraform environment as the last resort.
