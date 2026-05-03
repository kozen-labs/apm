# 🤖 SDLC Skills Pack 🤖

> AI advisory pack for MongoDB Atlas, Enterprise Advanced, and Community Edition. Schema design, security hardening, encryption, compliance mapping, and pre-sales fit assessment, all product-aware and grounded in authoritative documentation.

![](./docs/rsc/semantic_core_agents.png)

| | |
|---|---|
| 🤖 **Tools** | Claude Desktop · Claude Code · Cursor · Windsurf · Aider · GitHub Copilot · OpenCode |
| 🏛️ **Topics** | Architecture · Security · Encryption · Compliance · Observability · Data Sovereignty |
| 📋 **Regulations** | GDPR · DORA · NIS2 · EU AI Act · HIPAA · CCPA · PCI DSS · ISO 27001 · FedRAMP · PIPL · LGPD · +29 more |
| 🌍 **Industries** | FSI · Healthcare · Public Sector · Defense · Retail · Automotive · Telco · SaaS |

For the methodology behind agent-driven context engineering, see [Agent-Driven Development](./docs/agent_driven_development.md).

---

## ⚡ Quick Start

**Prerequisite:** Node.js 18 or later must be on your PATH. Run `node --version` to confirm.

### 🧰 Skills — extend your agent's knowledge

Context files that load MongoDB domain knowledge into your current AI session on demand. Work with Claude Desktop, Claude Code, Cursor, Windsurf, Aider, and more.

```bash
# macOS / Linux
npm install
bash bin/skill.sh --provider claude --scope global install

# Windows
npm install
.\bin\skill.ps1 --provider claude --scope global install
```

You can also use the full APM interface, which supports skills and agents across all providers:

```bash
# Initialize APM in your project (creates apm.config.json + apm.lock.json)
bin/apm.sh init

# Interactive menu (no arguments)
bin/apm.sh

# List all available skills
bin/apm.sh list --type skill

# Install specific skills
bin/apm.sh install --type skill --provider claude --scope global ks-mongodb-core ks-security-patterns-and-principles

# Check for outdated installs
bin/apm.sh outdated --type skill

# Pull latest from remote sources (after enabling a source in apm.config.json)
bin/apm.sh refresh
```

📖 [Skills guide: installation, routing, progressive disclosure model, examples](./docs/getting-started-skills.md)
📖 [Using APM in projects: multi-source config, phase-by-phase selection, team workflow](./docs/using-apm-in-projects.md)

### 🤖 Agents — parallel specialist processes

Five self-contained specialist agents (schema, security, compliance, pre-sales, orchestration) that run independently and can execute in parallel. Requires Claude Code with sub-agent support.

```bash
# macOS / Linux
bin/apm.sh install --type agent --provider claude --scope global

# Windows
.\bin\apm.ps1 install --type agent --provider claude --scope global
```

📖 [Agents guide: orchestrator workflow, routing, parallel execution, examples](./docs/getting-started-agents.md)

### 🗂️ Running a project end-to-end

Once skills and agents are installed, this guide shows how to combine them across the full project lifecycle: from writing a PRD and Engineering Proposal through AI-assisted implementation and security review.

📖 [Project workflow: artifact chain, phase-by-phase skill selection, worked example](./docs/project-workflow.md)

---

## 🧰 Skills

28 skills across 5 domains. All skills are prefixed `ks-` to identify user-authored skills and avoid name collisions.

### 🍃 MongoDB

11 skills covering the full MongoDB advisory surface: product selection, data architecture, security hardening, encryption, network topology, and compliance.

| Skill | What it covers |
|---|---|
| `ks-mongodb-core` | Foundation: intent routing, response format enforcement, and all shared MongoDB reference docs |
| `ks-mongodb-product-topology-selection` | Atlas vs EA vs Community, tier selection, fit validation |
| `ks-mongodb-data-architecture-design` | Schema, 4-phase methodology, 12 patterns, indexes, shard keys |
| `ks-mongodb-security-baseline-atlas` | Atlas hardening: identity, network, encryption, audit, backup |
| `ks-mongodb-security-baseline-selfmanaged` | EA/Community hardening: KMIP, FIPS, Kerberos/LDAP, auditing |
| `ks-mongodb-security-encryption-design` | CSFLE vs Queryable Encryption, KMS/KMIP, data classification |
| `ks-mongodb-security-network-connectivity` | Private Endpoints, VPC peering, KMS/SIEM path, EU sovereign |
| `ks-mongodb-security-architecture-review` | Injection risk, PII exposure, multi-tenant isolation, anti-patterns |
| `ks-mongodb-compliance-mapping` | Regulation to feature mapping: DORA, GDPR, PCI, HIPAA, and more |
| `ks-mongodb-compliance-observability` | SIEM wiring (Datadog/Splunk/OpenTelemetry), alert rules, runbooks |
| `ks-mongodb-compliance-data-sovereignty` | EU data sovereignty, geopatriation, cloud offloading |

### 🔒 Security

5 skills covering security as a cross-cutting discipline: regulations, patterns, identity, posture, and threat management.

| Skill | What it covers |
|---|---|
| `ks-security-regulations-and-standards` | Authoritative text for 40+ regulations: scope, obligations, penalties, including EU AI Act, NIST AI RMF, ISO/IEC 42001 AI governance standards |
| `ks-security-patterns-and-principles` | 67+ security patterns and anti-patterns: access control, Zero Trust, STRIDE, data security, MongoDB Atlas, OWASP LLM Top 10, prompt injection defenses, MCP/agent security |
| `ks-security-iam` | IAM protocols (SAML, OAuth 2.0, OIDC, SCIM, WIF), MFA, PAM, lifecycle, access governance |
| `ks-security-posture-management` | CSPM, DSPM, SSPM, SIEM, ISMS/ISO 27001, SOC operations |
| `ks-security-threats-and-risk` | Threat taxonomy, risk frameworks (NIST RMF, FAIR), AI/LLM security, threat intelligence, ASM |

### ⚙️ Software Engineering

5 skills covering the full SDLC: architecture, coding standards, AI-assisted development, quality assurance, and project management.

| Skill | What it covers |
|---|---|
| `ks-software-architecture` | Design principles (SOLID, CAP, 12-Factor, Azure Cloud Design Principles, Well-Architected Framework), GoF patterns, GRASP patterns, 42 Azure Cloud Design Patterns (one deep-dive file each), architectural styles (hexagonal, event-driven, DDD, serverless, big data, web-queue-worker), microservices, integration, data patterns, UI/frontend, AI/agent patterns (RAG, ReAct, MCP/A2A, AAOSA distributed multi-agent coordination, Agent Context Segregation/sly_data for LLM data protection), anti-patterns (architecture, microservices, data, 10 cloud performance) |
| `ks-software-development` | Personal coding standards: naming conventions (camelCase/PascalCase/UPPER_SNAKE_CASE/dot.notation), project structure (src/cfg/iac/bin/doc/rsc/test/tmp), programming paradigms (OOP-first, IoC/DI, Microkernel), documentation (JSDoc/docstrings/Javadoc), TDD, code quality (SOLID, DRY, Clean Code, KISS, commit messages), static analysis per language. Supports TypeScript, JavaScript, Python, Java, C++, C#, Rust. |
| `ks-ai-agent-development` | Orchestrator for AI-assisted development sessions. Detects project stack and loads relevant domain skills automatically. 5-stage workflow (Understand → Plan → Implement → Validate → Security review), `tmp/dev.plan.md` as shared source of truth, ask-before-assuming principle, agent role differentiation (Cursor/Copilot/Claude Code/CI bots), multi-agent orchestration, safety and governance rules. |
| `ks-quality-assurance` | ISTQB testing principles, ISO 25010 quality dimensions (FR/NFR), test design techniques (EP, BVA, Decision Table, State Transition, PBT), test patterns (AAA, GWT, test doubles, Object Mother), TDD/BDD/ATDD/SDD approaches, test pyramid, 10 API test types, CI/CD quality gates, testing anti-patterns |
| `ks-project-management` | PMBOK 6 & 7, Agile Manifesto, Scrum, Kanban, XP, SAFe, PRINCE2, lifecycle types, estimation (planning poker, PERT, Monte Carlo), scheduling (CPM, Gantt), risk management, team dynamics, stakeholder management, EVM (CPI/SPI/EAC), KPIs, prioritization (MoSCoW/WSJF/Kano), PMO/OPM governance, anti-patterns |

### 🛠️ Technologies

4 skills providing deep knowledge on specific technology platforms used across engineering and AI workloads.

| Skill | What it covers |
|---|---|
| `ks-devops` | Containers (Docker, Docker Compose), orchestration (Kubernetes architecture, workloads, autoscaling, Pod Security Admission, RBAC, OPA/Kyverno, operators), IaC (Terraform, Pulumi, Helm, Kustomize, Ansible, AWS CDK, Crossplane, database migrations), CI/CD (GitHub Actions, GitLab CI, Jenkins, Tekton, deployment patterns), GitOps (ArgoCD, Flux, SOPS/ESO/Sealed Secrets), observability (OpenTelemetry, Prometheus, Loki, Jaeger, SLO/error budgets, eBPF), DevSecOps (SLSA, SBOM, cosign, Zero Trust CI/CD, shift-left security) |
| `ks-apache-kafka` | Core architecture (topics, partitions, brokers, consumer groups, replication, KRaft, offsets), delivery semantics (at-most-once, at-least-once, idempotent producer, transactional EOS), topic and partition design (Schema Registry, Avro/Protobuf, key-based partitioning), architectural patterns (Event Notification, Outbox/CDC, CQRS, Event Sourcing, Saga, Shock Absorber), reliability, performance tuning, security (SASL/SCRAM/OAuth/mTLS, ACLs, TLS), observability (consumer lag, Prometheus/Grafana, Burrow), technology selection guide (vs RabbitMQ, SQS, NATS, Redis Streams), and client practices for TypeScript, Python, Java, Rust, and C#. |
| `ks-sql-rdbms` | Relational model and normalization (1NF–BCNF), complete SQL reference (DDL/DML/DQL/DCL/TCL, all JOINs, CTEs, window functions, recursive CTEs), indexes and query optimization (B-tree, composite, covering, partial, EXPLAIN analysis, SARGABLE queries), transaction isolation levels (READ COMMITTED through SERIALIZABLE, MVCC, deadlocks, FOR UPDATE/SKIP LOCKED), engine comparison (PostgreSQL, MySQL/MariaDB, SQL Server, Oracle, SQLite, CockroachDB) with cross-engine migration guide, server-side objects (stored procedures, functions, triggers, views, materialized views in PL/pgSQL and T-SQL), scaling and operations (partitioning, sharding strategies, replication, pg_dump/mysqldump/RMAN backup and PITR), caching strategies (Cache-Aside, Write-Through, Write-Back, cache failure modes), and SQL security and anti-patterns (SQL injection, N+1, SELECT *, EAV, NOLOCK abuse, implicit type conversion). |
| `ks-artificial-intelligence` | ML algorithm taxonomy and selection, transformer architecture (attention, Q/K/V, scaling laws), LLM landscape (pre-training, RLHF, SLM vs LLM, hallucination), fine-tuning (LoRA, QLoRA, PEFT), inference optimization (quantization, vLLM, serving frameworks), vector search and embedding models (HNSW, Qdrant, Milvus, MTEB, reranking), EDD and golden datasets, RAGAS and LLM evaluation benchmarks, production cost optimization, LLM observability and drift detection, agent payments protocol (AP2) |

### ✍️ Content & Communication

3 skills for producing structured technical content: slide decks, executive blogs, and long-form technical articles.

| Skill | What it covers |
|---|---|
| `ks-mongodb-writer-deck` | Design or validate MongoDB-compliant slide decks: narrative arc, visual system, speaker notes, brand rules |
| `ks-mongodb-writer-itdm-blog` | Write or validate MongoDB ITDM blogs: 9-element template, exec audience, Why MongoDB messaging, SEO, RACI/DACI, CTA |
| `ks-technical-article-writer` | Full-lifecycle technical article writing: research, planning, drafting, Phase 4 review, bibliography |

---

## 🤖 Agents

Five specialist agents that own distinct domains and can run in parallel. The orchestrator produces a dispatch plan; the user invokes the specialists.

| Agent | Domain | Color |
|---|---|---|
| `mongodb-orchestrator` | Tags domains, produces dispatch plan with ready-to-run prompts per specialist | 🔵 cyan |
| `mongodb-solution-architect` | Schema, patterns, indexes, topology, fit validation | 🔵 blue |
| `mongodb-security-specialist` | Hardening, encryption (CSFLE/QE/KMS), network topology, security review | 🔴 red |
| `mongodb-compliance-specialist` | Regulation mapping, data sovereignty, SIEM, TOSM reference | 🟡 yellow |
| `mongodb-presales-advisor` | Fit assessment, product/tier recommendation, business value, POC scoping | 🟢 green |

---

## 📚 Documentation

| Document | Content |
|---|---|
| [Getting Started: Skills](./docs/getting-started-skills.md) | Installation for all tools, progressive disclosure model, routing, examples |
| [Getting Started: Agents](./docs/getting-started-agents.md) | Orchestrator workflow, routing guide, parallel execution, examples |
| [Using APM in Projects](./docs/using-apm-in-projects.md) | Multi-source configuration, phase-by-phase skill selection, team setup, update workflow |
| [Running a Project](./docs/project-workflow.md) | End-to-end workflow across the project lifecycle: PRD → EP → dev.plan.md artifact chain, phase-by-phase skill selection, signal routing guide, and a complete worked example |
| [Project Structure](./docs/project-structure.md) | Directory layout, component descriptions, install targets |
| [Agent-Driven Development](./docs/agent_driven_development.md) | ADD methodology, context engineering, BDD/TDD lineage, Multi-Agent Systems |
| [ADD in the Enterprise with MongoDB](./docs/agent_driven_development_mongodb_enterprise.md) | ADD applied to enterprise: SoR/SoA model, MCP tool layer, RBAC gateway, evaluation store |
| [LLM Context Window Management](./docs/llm_context_window_management_with_mongodb.md) | Progressive disclosure, RAG, Atlas Vector Search, token budgeting |
| [Evaluation-Driven Development](./docs/evaluation_driven_development.md) | EDD for AI-powered products: graded metrics, eval tooling (RAGAS/LangSmith/DeepEval), EDDOps, maturity model, 9 principles |
| [AI-Augmented Development: SDLC and Product Dimensions](./docs/ai_development_dimensions.md) | Two-dimension framework: SDLC (TDD/BDD/SDD/ADD) and Product AI (EDD/context engineering/agent patterns), SoR/SoA architectural lens, conceptual models, anti-patterns |

---

## ✅ Common Guardrails

These rules apply to every skill and agent.

- 🏷️ Always name the specific MongoDB product assumed (Atlas, AtlasGov, Enterprise Advanced, Community).
- 🤝 Always acknowledge shared responsibility: MongoDB certifications reduce audit scope, not configuration responsibility.
- 🚫 Never claim MongoDB "fully certifies" the customer as compliant.
- 🔒 Never recommend disabling TLS or encryption in production.
- 🔑 Never suggest root or admin DB users for application code.
- 📜 Never fabricate regulatory requirements not backed by `.agents/skills/ks-mongodb-core/mongodb/docs/mongodb-compliance-by-industry.md`.

---

## 🔗 References

**Tools**

- [Visual interface for awesome-claude-skills](https://awesomeclaude.ai/awesome-claude-skills)
- [Skills are reusable capabilities for AI agents](https://skills.sh/)
- [Graphify: Knowledge Graphs for AI Coding Assistants](https://graphify.net/)
- [LangChain Skills](https://www.langchain.com/blog/langchain-skills)
- [Marketplace for ai tools](https://github.com/10gen/core-platforms-ai-tools)
- [Agent Development Kit (ADK)](https://github.com/google/adk-python)
- [Agentgateway is an open source proxy built on AI-native protocols (MCP & A2A) ](https://github.com/agentgateway/agentgateway)

**Tutorials**

- [How to create custom Skills](https://support.claude.com/en/articles/12512198-how-to-create-custom-skills)
- [Extend Claude with skills](https://code.claude.com/docs/en/skills)
- [Sub-agents in Claude Code](https://code.claude.com/docs/en/sub-agents)
- [Introducing MongoDB Agent Skills and Plugins for Coding Agents](https://www.mongodb.com/company/blog/product-release-announcements/introducing-mongodb-agent-skills)
- [Claude Code, 1,000 Files, 0 Memory](https://www.youtube.com/watch?v=EKbQ5sajVxA)
- [Using skills with Deep Agents](https://www.langchain.com/blog/using-skills-with-deep-agents)
- [Architecting efficient context-aware multi-agent framework for production](https://developers.googleblog.com/architecting-efficient-context-aware-multi-agent-framework-for-production/)

**Training**

- [Claude Code in Action](https://anthropic.skilljar.com/claude-code-in-action)

**Skill packs**
- [Agent Skills Standard](https://agentskills.io/home)
- [MongoDB Agent Skills](https://github.com/mongodb/agent-skills)
- [Karpathy-Inspired Claude Code Guidelines](https://github.com/forrestchang/andrej-karpathy-skills)
- [LangChain skills](https://www.langchain.com/blog/langchain-skills)
- [10gen Agent skills](https://github.com/10gen/agent-skills)
- [Skill validator](https://github.com/agent-ecosystem/skill-validator)
- [Matt Pocock - Agent Skills](https://github.com/mattpocock/skills)
  
