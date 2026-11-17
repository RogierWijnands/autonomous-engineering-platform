# Autonomous Engineering Platform

Een lokale mini-enterprise engineeringomgeving waarin AI-agents zelfstandig
engineeringwerk kunnen uitvoeren binnen expliciete grenzen. Het platform
coördineert de volledige workflow van een Jira-ticket tot een draft pull request,
met aandacht voor policies, security, auditability en menselijke goedkeuring.

## Doel

Dit project demonstreert niet alleen AI-codegeneratie, maar ook hoe je
agent-workflows gecontroleerd kunt uitvoeren. Agents krijgen alleen de rechten
die nodig zijn voor hun taak. Risicovolle acties en wijzigingen die daar om
vragen worden door mensen beoordeeld en goedgekeurd.

## Architectuur

```text
Lokale Jira-simulator
        │ ticket / webhook
        ▼
.NET AEP Orchestrator ───── PostgreSQL
        │                    workflowstatus,
        │                    agentruns, auditlogs
        ├── Policy Engine
        ├── Human approvals
        ├── Agent Pipeline
        │   Analyst → Architect → Implementer → Tester → Reviewer
        │   GitHub Copilot CLI, gespecialiseerde agentdefinities
        │
        ├── Geïsoleerde Docker-workspace
        │
        └── GitHub-integratie ── feature branch → draft PR → menselijke review
```

De Jira-simulator en MCP-server draaien lokaal. Ook de AEP draait lokaal.
Alleen modelaanroepen en de GitHub-integratie hebben internettoegang nodig.

## Veiligheidsgrenzen

- De agentcontainer krijgt geen GitHub-token, Docker-socket of toegang tot
  persoonlijke bestanden.
- De .NET-host beheert GitHub-acties buiten de agentcontainer.
- Agentrechten, policies en goedkeuringsmomenten worden expliciet begrensd.
- Workflowstatus en agentacties zijn persistent en controleerbaar.

## Technologiestack

| Onderdeel | Technologie |
|---|---|
| Orchestrator | .NET 10 LTS |
| API | ASP.NET Core |
| Workflow engine | Eigen persisted state machine |
| Database | PostgreSQL 17 |
| ORM | EF Core + Npgsql |
| Agent runtime | GitHub Copilot CLI |
| MCP-server | TypeScript + officiële MCP SDK |
| Jira-simulator | Node.js + TypeScript |
| Agent-isolatie | Docker |
| Source control | GitHub |
| Logging | Serilog |
| Tests | xUnit |

## Workflow

1. Een ticket wordt in de lokale Jira-simulator aangemaakt en naar **In
   Progress** verplaatst.
2. De simulator meldt het ticket via een webhook aan de AEP Orchestrator.
3. De orchestrator controleert policies, risico's en vereiste goedkeuringen.
4. Gespecialiseerde agents analyseren, ontwerpen, implementeren, testen en
   reviewen het werk in een geïsoleerde Docker-workspace.
5. De .NET-host beheert de GitHub-integratie en maakt een feature branch en
   draft PR aan.
6. Een mens beoordeelt en keurt de PR goed voordat wijzigingen verdergaan.

## Repositorystructuur

- `src/` — .NET-componenten voor API, applicatie, domein, infrastructuur,
  agent-runner, GitHub-integratie en worker.
- `mcp/jira-simulator/` — lokale Jira-simulator en MCP-server.
- `agents/` — rolbeschrijvingen voor de agentpipeline.
- `policies/` — standaard-, beveiligings- en risicobeleid.
- `infrastructure/` — Docker-infrastructuur.
- `tests/` — unit- en integratietests.
- `docs/` — architectuur, workflow en beveiligingsmodel.
- `.github/` — GitHub-agent- en workflowconfiguratie.

## Status

De repository bevat momenteel de initiële mappenstructuur en basisdocumentatie.
De .NET-projecten, database, MCP-server en uitvoerbare workflows moeten nog
worden geïmplementeerd.
