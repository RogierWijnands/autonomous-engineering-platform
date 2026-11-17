# Architectuur

## Doel en status

De Autonomous Engineering Platform (AEP) is bedoeld als lokale
mini-enterpriseomgeving die werk vanuit een lokale Jira-simulator gecontroleerd
door een reeks gespecialiseerde agents leidt, en uiteindelijk een GitHub-draft
pull request kan opleveren.

Dit document beschrijft het beoogde ontwerp, niet reeds geïmplementeerd gedrag.
De repository bevat momenteel een scaffold. Componenten, integraties,
persistente workflows en beveiligingscontroles moeten nog worden gebouwd en
getest.

## Ontwerpprincipes

- **Host beheert bevoegdheden:** credentials en externe acties blijven buiten
  de agentcontainer.
- **Minimale rechten:** iedere component krijgt alleen de toegang die nodig is
  voor zijn taak.
- **Persistente orkestratie:** workflowstatus, pogingen, goedkeuringen en
  resultaten moeten herstelbaar zijn na een procesrestart.
- **Expliciete gates:** risicovolle stappen vereisen beleidstoetsing en waar
  nodig menselijke goedkeuring.
- **Controleerbaarheid:** belangrijke beslissingen en acties worden aan een
  workflow en actor gekoppeld vastgelegd.
- **Lokale uitvoering:** Jira-simulator, MCP-server, AEP en PostgreSQL draaien
  lokaal; modelaanroepen en GitHub-integratie vereisen internettoegang.

## Componenten en verantwoordelijkheden

| Component | Verantwoordelijkheid |
|---|---|
| `Aep.Api` | ASP.NET Core HTTP-ingang voor webhooks en beheer- of statusaanvragen. Valideert verzoeken en geeft werk door aan application-use-cases. |
| `Aep.Application` | Use-cases, workflowcoördinatie, policies en contracten tussen de domeinlaag en adapters. |
| `Aep.Domain` | Workflowconcepten, toestanden, invarianten en domeinregels, onafhankelijk van externe integraties. |
| `Aep.Infrastructure` | PostgreSQL-persistentie via EF Core/Npgsql en implementaties van externe of technische adapters. |
| `Aep.AgentRunner` | Start en volgt agentruns met GitHub Copilot CLI binnen een geïsoleerde workspace. Krijgt geen GitHub-token of Docker-socket. |
| `Aep.GitHub` | GitHub-bewerkingen namens de host, zoals branch-, commit- en draft-PR-acties. Beheert GitHub-credentials buiten de agentcontainer. |
| `Aep.Worker` | Achtergrondverwerking van geaccepteerde workflows en herstelbare of opnieuw uitvoerbare taken. |
| Jira-simulator | Lokale TypeScript-applicatie die tickets beheert en wijzigingen via MCP en een webhook aan de AEP kan aanbieden. |
| PostgreSQL | Persistente workflowstatus, agentruns, goedkeuringen en auditgegevens. |
| Docker-workspace | Afgebakende, tijdelijke werkomgeving voor agents en hun repositorycheckout. |

De grenzen zijn logisch; de uiteindelijke procesindeling en hostingconfiguratie
worden tijdens implementatie vastgesteld.

## Hoofdstromen

### Ticket naar workflow

1. Een gebruiker maakt een ticket aan in de lokale Jira-simulator en zet het op
   **In Progress**.
2. De simulator verstuurt een webhook naar de AEP API. De API valideert de
   aanvraag en registreert of plant de workflow.
3. De worker laadt de workflow en voert policy- en risicocontroles uit.
4. De agentpipeline werkt in een geïsoleerde Docker-workspace.
5. De host verwerkt toegestane GitHub-acties en maakt een feature branch en
   draft PR aan.
6. Een mens beoordeelt de PR en beslist over samenvoegen of verdere actie.

De exacte webhook-authenticatie, retry-strategie, idempotentiesleutel en
transities moeten vóór implementatie worden vastgelegd. Dubbele webhooklevering
mag niet leiden tot ongecontroleerde dubbele workflows.

### Agentpipeline

De standaardrollen zijn:

1. **Analyst** — verduidelijkt het verzoek en stelt acceptatiecriteria op.
2. **Architect** — vertaalt die criteria naar een ontwerp of beperkte aanpak.
3. **Implementer** — voert de goedgekeurde wijziging uit.
4. **Tester** — controleert gedrag met gerichte tests.
5. **Reviewer** — beoordeelt de wijziging onafhankelijk op fouten en
   regressies.

Iedere agent ontvangt alleen de context en tools die nodig zijn voor zijn rol.
De uitvoer van een stap wordt als workflowresultaat vastgelegd en door de
orchestrator gecontroleerd voordat de volgende stap begint. De concrete
agentprotocollen en uitvoerformaten moeten nog worden gedefinieerd.

## Persistente workflow

De workflow-engine wordt een eigen persisted state machine. De database is de
bron van waarheid voor de workflowstatus; het geheugen van een agent of worker
is dat niet. Een workflow moet minimaal kunnen verwijzen naar:

- de externe ticketidentiteit en ontvangen event;
- de huidige toestand en voortgang van stappen;
- agentruns, resultaten en pogingen;
- risico-inschatting, policybeslissingen en goedkeuringsstatus;
- workspace- en GitHub-resultaten;
- auditgebeurtenissen en relevante timestamps.

Dit is een conceptueel minimum, geen vastgelegd databaseschema. Transactiegrenzen,
concurrency control, retentie en herstelgedrag moeten bij de implementatie
worden ontworpen.

## Repository-indeling

- `src/Aep.Api/`, `src/Aep.Application/`, `src/Aep.Domain/` en
  `src/Aep.Infrastructure/` vormen de kern van de .NET-applicatie.
- `src/Aep.AgentRunner/`, `src/Aep.GitHub/` en `src/Aep.Worker/` bevatten
  uitvoerings-, integratie- en achtergrondcomponenten.
- `mcp/jira-simulator/` bevat de lokale TypeScript Jira-simulator en MCP-server.
- `agents/` bevat rolbeschrijvingen voor de agentpipeline.
- `policies/` bevat initiële policyconfiguraties; deze zijn pas effectief als
  de runtime ze afdwingt.
- `infrastructure/` bevat de geplande Docker-configuratie.
- `tests/` bevat de geplande unit- en integratietests.

## Nog te beslissen

- Exacte .NET-projectreferenties, solution-indeling en API-contracten.
- Webhook-authenticatie, deduplicatie en retry-/dead-lettergedrag.
- Workflowstatussen, herstelstrategie, time-outs en annulering.
- Datamodel, migraties, auditretentie en back-upstrategie.
- Docker-netwerkbeleid, resource-limieten en workspace-opruiming.
- GitHub-tokenbeheer, toegestane repositories en branch-/PR-conventies.
- Agent-outputcontracten, model-/CLI-versies en observability.

