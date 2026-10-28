![OpenNodeFlow package collection](banner-expansion-2026-10-27.png)

# OpenNodeFlow Packages

The official public package source for OpenNodeFlow. Browse 97 package families covering workflow foundations, utilities and integrations. Packages are optional and installed through ONF.

Recommended starting packages, in order:

1. **OpenNodeFlow Core** — workflow entries, constants and custom code.
2. **OpenNodeFlow Runtime** — storage, queues, variables, waits and execution coordination.
3. **OpenNodeFlow Logic** — branching, comparisons, selection and general logic.
4. **OpenNodeFlow Utilities** — HTTP, text, dates, collections, files and serialization.
5. **OpenNodeFlow Types** — general reusable data contracts.

## Install

1. Open **Library → Packs → Package manager → Sources** in ONF.
2. Select the official source, or add `https://github.com/OpenNodeFlow/Packages` with ref `main`.
3. Choose **Refresh catalog**, then inspect the package you want.
4. Review its code and any affected workflows, trust the source and confirm installation.
5. Enable the installed pack for your workspace under **Library → Packs**.

Refreshing checks availability; it does not install or run anything. Installed node code runs with the ONF worker's permissions when used by a workflow. Read each asset's included documentation before configuring provider access or executing it.

Event releases require a V2 runtime supporting package-declared ingress. Explicitly select the saved entry mode (Webhook, Poll, WebSocket or Schedule), configure its fields, create and acknowledge the matching profile under **Infrastructure → Ingress**, bind the node and save before deliberate activation. Installing creates no profile, secret, subscription, relay, listener, workflow or enabled automation. Retained triggers newly declaring ingress also need an explicit compatible binding after upgrade.

Direct callbacks support only their documented authentication contract. Entries marked **external relay** are typed receivers for a separately deployed provider-aware verifier/protocol adapter; no relay is bundled. Polls make bounded read requests with documented baseline/cursor behavior, including resumable Drive/Gmail feeds. A trigger checkpoint commits before downstream completion; downstream failure does not rewind it. Read each provider's setup and delivery limits in the included asset documentation. No live provider interoperability is implied by synthetic validation.

New Direct operations expose useful typed command fields while earlier operation revisions remain available. Upgrades can retain visible legacy operations; fresh and upgraded libraries therefore differ. FreshBooks, Intercom and OneDrive/SharePoint also include configuration-only operation revision 2. Workflows explicitly pinned to their historical revision 1 must deliberately adopt the corrected revision before execution; historical snapshots retain their original configuration defect.

Runtime includes 15 typed Queue operations. Manage queues under **Storage → Queues** and use a scheduled or manually triggered consumer flow to claim work. Queue items do not start workflows automatically; ambiguous external outcomes require explicit recovery.

Runtime 2.5.0 combines Direct queue and storage operations with the structured-table operations introduced in 2.4.0. These include Table Insert, Update, Read, Query, Delete and Transaction with named request/result types. These require an ONF build supporting structured tables. Create the schema under **Storage → Data**, then configure the namespace, table and schema revision on each node. Transactions are explicit bounded batches; changing a schema requires reviewing existing rows and workflow contracts.

## Files

| Path | Purpose |
| --- | --- |
| `onf-packages.json` | Catalog of package releases and their SHA256 digests. |
| `onf-source.json`, `logo.png`, `banner*.png` | Source card metadata and artwork. |
| `packages/<family>/<release>.json` | Installable definitions, dependencies and embedded asset documentation. |
| `packages/<family>/onf-package.json` | Package display name, description, category, tags and website. |
| `packages/<family>/logo.png`, `banner.png` | Package card artwork. |

ONF reads these files directly from a refreshed Git commit. No npm installation or build step is needed to use this repository. Earlier release files remain available for compatibility and provenance.

Maintenance validation runs locally in the private Package-Resources repository. Jamie disabled GitHub-hosted testing on 27 October 2026: do not add, restore or run GitHub Actions test/CI workflows without his later explicit instruction.
