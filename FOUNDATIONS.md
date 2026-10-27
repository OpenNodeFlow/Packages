# Default packages and queues

The 2.2.0 catalog adds Logic and separates general workflow building blocks from provider integrations. There are 37 package families and 107 retained release manifests, containing 4,615 current logical assets and 5,469 archived definition revisions. The original 70 manifests and all previously published definition identities remain unchanged.

| Default package | Purpose | Current manifest definitions, including dependencies |
|---|---|---:|
| OpenNodeFlow Core | Manual, webhook and schedule entries; constants; custom TypeScript | 8 |
| OpenNodeFlow Runtime | Durable state, work queues, variables, waits, joins and remote routing contracts | 326 |
| Shared types | JSON values/records/lists, nullable primitives and text lists | 8 |
| Utilities | General HTTP/GraphQL, text, dates, collections, files, SQLite, mail and codecs | 149 |
| Logic | Branching, comparison, selection, defaults, assertions and boolean logic | 43 |

Defaults are recommended starting packages, not automatically trusted or installed. Every default package's transitive dependencies stay within these five families. Utility HTTP/mail/file operations still perform their documented effects when explicitly executed; general does not mean side-effect-free.

Three Azure DTOs now belong to Azure DevOps. Condition and 24 existing general Utilities logic nodes move to Logic; Delay moves to Runtime. Stable definition IDs and code remain intact. Six general GraphQL/SMTP codecs receive a new internal revision to reference general dictionaries/lists instead of coincidentally matching Xero/HubSpot types. Twelve new Logic nodes cover NAND, NOR, implication, majority, blank text, finite numbers, JSON kinds/null, list emptiness/length bounds and literal prefix/suffix matching.

The manifests include `libraryMigrations` with exact previous pack/asset metadata and desired next rows. ONF previews these organization changes and checks the preview token at installation. Only exact prior metadata from the same installed source may migrate; user-customized organization produces a conflict instead of being overwritten. An older release cannot silently move an asset back. Definition history and saved runs remain independent of library organization.

## Runtime queue nodes

Runtime adds 15 Queue nodes and 87 named contracts/codecs. Queue operations use `context.storage(namespace).request('workQueue.OPERATION', request)` in the executing workflow's workspace. These named queues are separate from retained conversation-oriented `queue.*` primitives and accepted execution jobs.

| Nodes | Use |
|---|---|
| Queue Create, Configure, Inspect, List Queues | Define and inspect named queues, bounded concurrency, ordering, pause and retry policy |
| Queue Enqueue, Get, List | Add deduplicated JSON work, schedule availability and inspect records |
| Queue Claim, Start, Heartbeat | Atomically claim available work, mark external effects started and extend a live lease |
| Queue Ack, Fail | Record success or classify failure using the current version and original lease token |
| Queue Cancel, Recover, Prune | Cancel safe pending work, explicitly reconcile ambiguous outcomes, and remove completed/cancelled records |

Create `jobs` in namespace `example`, then enqueue `{queue:'jobs', dedupKey:'example-1', payload:{message:'hello'}}`. In a deliberately scheduled consumer, Claim returns an item or null. Its Decode exposes `found` and optional `item`; branch on `found` before consuming the item. Keep the original claim token alongside each operation's returned version. Start and Heartbeat intentionally do not return a new token. Mark Start before external work, acknowledge afterward, and reconcile ambiguous external outcomes before any retry.

Ready ordering permits available work to bypass delayed items. FIFO enforces concurrency one and can block behind delayed or uncertain work. Pausing prevents new claims without cancelling accepted work. Leases, retry backoff, maximum attempts and capacity are bounded by the runtime. No package node automatically schedules a consumer, creates queues on installation or calls a provider.

Prune requires a reason and removes up to 1,000 completed/cancelled records older than the specified cutoff. It also removes their deduplication history: an old dedupKey may enqueue again afterward. Dead and uncertain work must be reconciled first. Nothing is automatically pruned. New queues do not claim exactly-once external effects; callers must use idempotency and recovery appropriate to their destination.

`src/builders/work-queue-contracts.json` is a public schema snapshot of v2 `shared/queue-model.ts`, exported with Zod's JSON Schema conversion on 27 October 2026. Runtime finite-JSON validation additionally rejects unsafe keys, undefined/non-finite values, excessive depth and oversized payloads. Request/response nodes expose named typed sockets; optional fields preserve absence versus explicit null. Lease tokens are capabilities and must never be logged.

## Package presentation

Each new catalog entry adds `config: 'packages/FAMILY/onf-package.json'`. This optional file lives beside its release manifest and is read at the same immutable Git commit. Custom repositories can use the same contract:

```json
{
  "schemaVersion": 1,
  "summary": "A short explanation of the package",
  "description": "Longer plain-text details, intended uses and setup notes.",
  "website": "https://example.com/project",
  "category": "Utilities",
  "tags": ["data", "formatting"],
  "defaultPackage": false,
  "logo": "logo.png",
  "banner": "banner.png"
}
```

Summary is limited to 180 characters, description to 6,000, category to 40 and tags to eight values of at most 24 characters. Website URLs must be credential-free HTTPS. PNG artwork must remain in the config folder, at most 1 MiB and 4096 pixels per dimension. There is no HTML, active SVG, remote image fetch or installation script. Missing presentation metadata falls back to package text; invalid presentation data is reported without changing the executable installation contract.

The included 192×192 monogram logos and 1120×360 circuit banners are original ONF package artwork, not official provider trademarks or a claim of endorsement. `scripts/build-branding.py` can recreate them using Pillow; installed packages do not need Python or Pillow.

## Reproduction and evidence

Run `npm ci`, `npm test`, `npm run check`, and `npm run build:foundations -- --check`. Foundation generation reads only retained public 2.0.0/2.1.0 sources and the checked-in queue schema snapshot, then appends guarded releases. It neither reads installed data nor contacts providers. It will not overwrite a released identity.

`scripts/validate-foundations-app.mjs --app <v2 checkout>` runs with that checkout's `tsx` import loader. It uses mocked Git and a new temporary SQLite directory, previews and installs all retained releases before the new foundations, verifies retained definition bytes and checks current asset diagnostics. It creates no workflow and executes no provider or node body. `VALIDATION-FOUNDATIONS.json` records the resulting artifact fingerprints and counts when this check succeeds. Pure logic/codec and queue-transport tests are in `scripts/foundations.test.mjs`; live queue lifecycle testing belongs to the application's isolated queue tests.

Adding `--defaults` verifies a clean five-package install in reverse order and rejects an older release that would reverse migrated organization; `VALIDATION-DEFAULTS.json` records 523 current assets and zero diagnostics. `scripts/validate-queue-app.mjs --app <v2 checkout>` executes all 15 shipped Queue node bodies against encrypted, in-memory v2 storage and validates actual requests/results against their package socket schemas. It checks deduplication, start/heartbeat/acknowledgement, cancellation, terminal failure, recovery and explicit pruning without providers or persistent files. Always use the returned item version; revisions are fencing tokens, not a predictable counter for a specific item.

On 27 October 2026 the full 107-release preview/install check passed: 5,469 archived definition revisions, 4,615 current assets, all 5,349 prior definition revision bytes retained, zero current asset diagnostics, and rejection of an old release attempting to reverse library organization. It created no workflows or runs and contacted no providers. All 27 package tests, all catalog digest checks and foundation/structural reproducibility checks passed. The separate 15-operation Queue node integration check also passed and confirmed the checked-in request/result schema snapshot matches the current application exactly.
