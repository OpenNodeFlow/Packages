![OpenNodeFlow package collection](banner.png)

# OpenNodeFlow Packages

The official public package source for OpenNodeFlow. Browse 49 package families covering workflow foundations, utilities and integrations. Packages are optional and installed through ONF.

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

Runtime includes 15 typed Queue operations. Manage queues under **Storage → Queues** and use a scheduled or manually triggered consumer flow to claim work. Queue items do not start workflows automatically; ambiguous external outcomes require explicit recovery.

## Files

| Path | Purpose |
| --- | --- |
| `onf-packages.json` | Catalog of package releases and their SHA256 digests. |
| `onf-source.json`, `logo.png`, `banner.png` | Source card metadata and artwork. |
| `packages/<family>/<release>.json` | Installable definitions, dependencies and embedded asset documentation. |
| `packages/<family>/onf-package.json` | Package display name, description, category, tags and website. |
| `packages/<family>/logo.png`, `banner.png` | Package card artwork. |

ONF reads these files directly from a refreshed Git commit. No npm installation or build step is needed to use this repository. Earlier release files remain available for compatibility and provenance.
