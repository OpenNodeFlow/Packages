# Structural catalog migration

The 2.1.0 release migrates all reviewed public generic contract families represented by the existing public baseline. It uses the 2.0.0 manifests and pure static factories as inputs. No installed app database, library snapshot, workflow export, private model context or publication journal is read.

| Source group | Explicit existing asset updates | New types | New definitions |
| --- | ---: | ---: | ---: |
| Collaboration (16 public families) | 124 | 75 | 225 |
| Cloud and infrastructure (15 public families) | 506 | 432 | 1,296 |
| Azure DevOps public SDK models and operations | 20 | 346 | 1,044 |
| Total | 650 | 853 | 2,565 |

Another 196 existing definitions receive the matching structural type reference updates, for 846 revised existing identities. The 34 manifests include exact dependency closures; shared dependencies retain identical content. The original 36 manifests, catalog entries and their 1,938 definition revisions remain unchanged. New identities are deterministic; existing canonical public type IDs stay stable.

Cloud coverage includes Azure ARM/AKS/App Service/Monitor, Kubernetes, Prometheus, Loki, Grafana, Alertmanager, Docker, Rancher, NetBird, Pushgateway, cert-manager, CloudNativePG, Longhorn, Traefik and Fleet. Collaboration includes GitHub, GitLab, Gitea, Jira, Confluence, Slack, Discord, Notion, Sentry, PagerDuty, HubSpot, Xero, Teams, Google Analytics, Google Ads and WebSocket contracts. Utility/type manifests supply their shared dependencies.

Azure DevOps uses public Microsoft SDK DTO declarations, canonical entity models, timeline shape and operation paging. Existing canonical pull request, work item and build types receive ordinary paired field codecs; these six nodes supplement the new-type codec pairs. Nullable Text List adds its missing standalone contract and codec pair. Finite JSON already includes null, so it reuses that existing vocabulary.

Deliberate exclusions are the office ingress callback policy, receiver deployment, private PR workflow controllers/reports, model gateway/chat contexts, live state, snapshots and publication journals. The historical audit included these installed-context assets; their counts are not a public package target. No generic family represented by the public baseline is left pending from the reviewed overlay. Independent future public integrations require their own scope and source review.

Live workflows use current logical assets. Package artifacts and integer definition revisions remain immutable internal records for provenance and run/history preservation. Installing a changed existing identity uses the app's impact preview and confirmation when current workflows or definitions become invalid.

`PROVENANCE-STRUCTURAL.json` lists source fingerprints and adaptations. `npm test` checks historical preservation, package bounds, every changed/new schema and code body, exact socket references, reciprocal codecs with synthetic values, known-field rejection, 307 mocked cloud operations, 15 mocked Azure DevOps operations, bounded pagination and the Jira/Slack response corrections. Actual app preview/installation evidence is recorded separately in `VALIDATION-STRUCTURAL.json`; provider permissions and live behavior are not covered by those synthetic checks.
