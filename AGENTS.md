# AGENTS.md — SDLC Skills Pack

This file configures AI coding assistants (Cursor, Windsurf, Aider, OpenCode, GitHub Copilot, and others) to use the SDLC Skills Pack bundled in this repository.

Install all skills into your agent (requires Python 3.8+):

```bash
# macOS / Linux
bash bin/skill.sh --provider claude --scope global install

# Windows
.\bin\skill.ps1 --provider claude --scope global install
```

Run `bin/skill.sh list` (or `bin/skill.ps1 list`) to see all 28 available skills.

---

## MongoDB advisory skills

The 12 MongoDB-specific skills below cover architecture, security, compliance, encryption, observability, and data sovereignty. They share four authoritative knowledge-base docs and the full regulations library located at:

```
.agents/skills/shared/mongodb/docs/
├── mongodb-architecture-best-practices.md   — schema patterns, indexing, 12 design patterns
├── mongodb-security-mechanisms.md           — auth, encryption (CSFLE/QE), FIPS, KMIP
├── mongodb-product-landscape.md             — Atlas / Enterprise Advanced / Community / AtlasGov
└── mongodb-compliance-by-industry.md        — DORA, GDPR, PCI, HIPAA, ISO, SOC 2, FedRAMP, TISAX…

.agents/skills/shared/regulations/           — 30 authoritative regulation reference files
├── gdpr-eu-2016-679.md                      — GDPR (EU)
├── dora-eu-2022-2554.md                     — DORA (EU financial)
├── eu-ai-act-2024-1689.md                   — EU AI Act
├── nis2-eu-2022-2555.md                     — NIS2 Directive
├── us-hipaa-1996.md                         — HIPAA (US health)
├── pci-dss.md                               — PCI DSS v4.0.1
├── iso-iec-27001.md                         — ISO/IEC 27001:2022
└── [27 more — see shared/docs-map.md]
```

Read the relevant doc (or section) before answering any MongoDB question that requires precise feature or compliance information.

---

## Skill routing

When a user asks a MongoDB question, classify the intent and apply the corresponding skill logic:

| Intent | Skill |
|---|---|
| Product choice, Atlas vs on-prem, topology | `mongodb-product-topology-selection` |
| Schema design, patterns, embedding, indexes, shard keys | `mongodb-data-architecture-design` |
| Atlas security hardening, identity, CMK, audit, BCDR | `mongodb-security-baseline-atlas` |
| Self-managed hardening, KMIP, Kerberos, FIPS, auditing | `mongodb-security-baseline-selfmanaged` |
| CSFLE vs Queryable Encryption, KMS, data classification | `mongodb-security-encryption-design` |
| Network topology, VPC peering, Private Endpoints, SIEM path | `mongodb-security-network-connectivity` |
| SIEM wiring, alerts, incident runbooks | `mongodb-compliance-observability` |
| What a regulation requires — scope, obligations, rights, penalties, definitions | `regulations-and-standards` |
| MongoDB ↔ regulation mapping — certifications, product controls, customer responsibilities | `mongodb-compliance-mapping` |
| Code review, injection risk, multi-tenant isolation, schema review | `mongodb-security-architecture-review` |
| European data sovereignty, geopatriation, cloud offloading | `mongodb-compliance-data-sovereignty` |

Multi-skill routing examples:
- "Secure Atlas for EU FSI under DORA" → compliance-mapping + security-baseline-atlas + network-and-connectivity-patterns
- "Schema for healthcare SaaS with HIPAA" → architecture-and-patterns-design + encryption-design + compliance-mapping
- "European data sovereignty strategy" → data-sovereignty-and-regional-strategy + product-and-topology-selection + compliance-mapping
- "What does DORA require for incident reporting?" → regulations-and-standards + compliance-mapping

Skill logic and decision tables are in `.agents/skills/<skill-name>/SKILL.md`.
Per-skill distilled references are in `.agents/skills/<skill-name>/references/`.
Shared cross-skill resources are in `.agents/skills/shared/`.

---

## Universal rules (apply to every MongoDB answer)

**Always:**
- State the specific MongoDB product assumed — Atlas, Atlas for Government, Enterprise Advanced, or Community Edition.
- Acknowledge shared responsibility: MongoDB certifications reduce the customer's audit scope; they do not eliminate the customer's configuration obligations.
- Separate data plane (customer data in selected region) from control plane (Atlas management API, global) when sovereignty is relevant.
- Map to the relevant regulation when industry or compliance context is stated. Source: `shared/mongodb/docs/mongodb-compliance-by-industry.md`.

**Never:**
- Claim MongoDB "fully certifies" the customer as compliant with any regulation.
- Recommend disabling TLS in any environment.
- Suggest using `root`, `atlasAdmin`, `dbOwner`, or `__system` roles from application code.
- Fabricate regulatory requirements not backed by `shared/mongodb/docs/mongodb-compliance-by-industry.md`.
- Assert FIPS 140-2 compliance for standard Atlas — only Atlas for Government and Enterprise Advanced with FIPS mode qualify.
- Recommend Atlas for Government for non-US workloads without explicit qualification.
- Recommend M0/Free/Flex clusters for production regulated workloads.
- Recommend local keyfiles for production encrypted storage.
- Recommend HTTP load balancers in front of MongoDB — use TCP/passthrough only.

---

## Standard response format

Every MongoDB advisory answer must follow this structure:

```
## Decision summary
- [Key recommendation]
- [Key context or constraint]
- [Trade-off or caveat, if applicable]

## [Checklist or numbered steps]
1. …
2. …

## Relevant MongoDB docs
- [Feature/page name]: <URL>
```

Tone: concise, technical, aimed at architects and security professionals. Prefer checklists and tables over prose. Always end with at least two MongoDB documentation links.

---

## Knowledge-base quick reference

| Topic | File | Section |
|---|---|---|
| 12 schema design patterns | `shared/mongodb/docs/mongodb-architecture-best-practices.md` | §3 |
| Indexing strategy | `shared/mongodb/docs/mongodb-architecture-best-practices.md` | §4 |
| Product capability matrix | `shared/mongodb/docs/mongodb-security-mechanisms.md` | §1 |
| CSFLE + Queryable Encryption | `shared/mongodb/docs/mongodb-security-mechanisms.md` | §6 |
| Product selection heuristics | `shared/mongodb/docs/mongodb-product-landscape.md` | §4 |
| Atlas certifications + TOSM | `shared/mongodb/docs/mongodb-compliance-by-industry.md` | §3 |
| Regulation → feature mapping | `shared/mongodb/docs/mongodb-compliance-by-industry.md` | §4 |
| Industry × regulation matrix | `shared/mongodb/docs/mongodb-compliance-by-industry.md` | §6 |

Full section index: `.agents/skills/shared/docs-map.md`
