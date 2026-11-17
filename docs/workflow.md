# Workflow en agentpipeline

## Status

Dit document beschrijft de beoogde end-to-end-flow. Het is geen beschrijving
van een reeds werkende workflow: de API, state machine, database, MCP-server,
container en GitHub-integratie moeten nog worden geïmplementeerd.

## Overzicht

```text
Ticket aangemaakt en In Progress
        ↓ webhook
Ontvangst, validatie en deduplicatie
        ↓
Policy- en risico-evaluatie
        ↓ indien vereist
Menselijke goedkeuring
        ↓
Analyst → Architect → Implementer → Tester → Reviewer
        ↓
Resultaat- en policycontrole
        ↓ host-side GitHub-acties
Feature branch → draft PR → menselijke review
```

## Fasen

### 1. Ticket ontvangen

De Jira-simulator beheert lokale tickets en biedt ze via MCP aan. Bij een
relevante statusovergang verstuurt de simulator een webhook naar de AEP API.
De API hoort de afzender te authenticeren, de payload te valideren en een
duurzame workflowregistratie te maken. Herlevering van dezelfde event hoort
geen onbedoelde tweede uitvoering te veroorzaken.

### 2. Scope en policy vaststellen

De orchestrator koppelt het ticket aan de geconfigureerde GitHub-repository,
controleert scope en bepaalt het risiconiveau. De policy-engine beslist welke
acties en goedkeuringen nodig zijn. Ticket- of repositorytekst kan de policy
niet aanpassen.

Als scope, risico of vereiste invoer niet betrouwbaar kan worden vastgesteld,
wordt de workflow gepauzeerd voor menselijke beoordeling in plaats van
stilzwijgend door te gaan.

### 3. Goedkeuring vóór uitvoering

Een workflow die volgens policy goedkeuring nodig heeft, blijft geblokkeerd
totdat een bevoegde gebruiker de concrete taak en scope goedkeurt. De
goedkeuring wordt aan die workflow en inhoud gebonden; wezenlijke wijzigingen
vereisen herbeoordeling. Afwijzing en timeout stoppen of pauzeren de workflow
volgens expliciete regels.

### 4. Agentuitvoering

De host maakt een afgebakende Docker-workspace voor de taak aan. Agents
doorlopen de analyst-, architect-, implementer-, tester- en reviewerrollen.
Agentinstructies staan onder `agents/`; runtime-invoer en uitvoerformaten
moeten nog worden vastgelegd.

De agentcontainer krijgt geen GitHub-token, Docker-socket of toegang tot
persoonlijke bestanden. Elke stap hoort een begrensde taak, time-out en
resourcebudget te hebben. De orchestrator registreert status en resultaten
zodat een procesrestart de workflow niet afhankelijk maakt van vluchtig
agentgeheugen.

### 5. Kwaliteits- en policycontrole

Tests worden uitgevoerd in de geïsoleerde omgeving. De reviewer levert
bevindingen en de orchestrator controleert of alle vereiste stappen zijn
afgerond en er geen policyblokkade openstaat. Een mislukte test of kritieke
bevinding leidt niet automatisch tot een PR alsof de taak geslaagd is.

### 6. GitHub-publicatie en menselijke review

De .NET-host voert toegestane GitHub-acties uit met beperkte credentials:
feature branch, commits en draft PR. De agentcontainer voert deze acties niet
zelf uit. De PR verwijst naar het oorspronkelijke ticket en bevat een
samenvatting, testresultaten en relevante risico's.

Een mens beoordeelt de draft PR. Het aanmaken van een draft PR is niet hetzelfde
als goedkeuring voor samenvoegen of deployen; die handelingen blijven buiten
deze initiële scope tenzij later expliciet ontworpen.

### 7. Afronding en opruimen

De host legt eindstatus en auditinformatie vast. Tijdelijke workspaces en
artefacten worden volgens een vast te stellen retentiebeleid verwijderd.
Mislukte of geannuleerde taken moeten veilig kunnen worden gestopt en hun
gedeeltelijke resultaten herkenbaar houden.

## Workflowvereisten

- Statusovergangen zijn expliciet en worden door de orchestrator gevalideerd.
- Webhook-, worker- en agentherhalingen zijn idempotent waar mogelijk.
- Elke stap heeft vastgelegde input, output, start/eindtijd en resultaatstatus.
- Goedkeuringen zijn herleidbaar naar de scope en wijzigingsset.
- Fouten, time-outs en annulering zijn zichtbaar; een fout wordt niet als
  succes gepresenteerd.
- Een workflow kan worden gepauzeerd, hervat of geannuleerd zonder policychecks
  te omzeilen.

## Nog te bepalen

- Exacte statusnamen en toegestane transities.
- Criteria voor een geldige Jira-statusovergang en eventdeduplicatie.
- Goedkeuringsinterface, bevoegdheden en verlopen goedkeuringen.
- Agentcontracten, contextselectie en toegestane CLI-commando's.
- Herhaalbaarheid per fase en behandeling van gedeeltelijke resultaten.
- Test-/reviewdrempels die een draft PR blokkeren.
- Workspace-, log- en transcriptretentie.

