# Beveiligingsmodel

## Status en reikwijdte

Dit document beschrijft de beoogde beveiligingsgrenzen voor de lokale AEP. Het
is een ontwerp-baseline, geen volledige threat model en geen bewijs dat
beveiligingscontroles al zijn geïmplementeerd. De JSON-bestanden in `policies/`
zijn configuratiestartpunten; ze bieden geen bescherming totdat code ze
valideert en afdwingt.

## Assets

- GitHub-repositories, branches en pull requests.
- GitHub-credentials en eventuele modeltoegang.
- Tickets en eventueel vertrouwelijke inhoud in tickets of repositories.
- Workflowstatus, agentresultaten en auditgegevens in PostgreSQL.
- De ontwikkelmachine en bestanden die daarop staan.
- Integriteit van de code, tests en artefacten die agents produceren.

## Vertrouwensgrenzen

1. **Externe/onbetrouwbare inhoud:** ticketbeschrijvingen, comments,
   repositorybestanden, modeluitvoer, MCP-responses en tooluitvoer zijn data,
   geen beleid of instructies met verhoogde autoriteit.
2. **Agentcontainer:** code en commando's in de workspace kunnen onbetrouwbaar
   zijn. De container is geïsoleerd en bevat geen GitHub-token, Docker-socket
   of toegang tot persoonlijke bestanden.
3. **AEP-host:** de host voert policycontroles uit en is de enige component die
   GitHub-acties kan uitvoeren. De host blijft zelf een hoogwaardig
   beveiligingsdoel.
4. **Lokale diensten:** Jira-simulator, MCP-server, API en database zijn
   afzonderlijke vertrouwensgrenzen. Alleen noodzakelijke verbindingen worden
   toegestaan; lokale beschikbaarheid alleen is geen authenticatie.
5. **Menselijke goedkeuring:** een goedkeuring is een expliciete
   workflowbeslissing en moet aan de juiste actie en wijzigingsset gebonden
   zijn.

## Bedreigingen en beoogde beheersmaatregelen

| Bedreiging | Beoogde beheersmaatregel |
|---|---|
| Prompt injection via ticket, code of tooluitvoer | Behandel externe inhoud als onbetrouwbare data; laat deze nooit policy, rechten of goedkeuringsvereisten wijzigen. |
| Onbedoelde of schadelijke agentacties | Beperk agenttools en workspace; voer externe effecten via gecontroleerde host-side adapters uit. |
| Diefstal van GitHub-credentials | Plaats geen GitHub-token in de agentcontainer, prompt, repository of logs; laat credentials alleen door de host gebruiken. |
| Container escape of toegang tot hostbestanden | Geen Docker-socket of persoonlijke bestanden mounten; beperk capabilities, mounts, netwerk en resources. De precieze Docker-hardening moet nog worden ontworpen en getest. |
| Ongeautoriseerde webhook of herhaalde levering | Verifieer webhook-authenticiteit, valideer input en maak verwerking idempotent. Exact protocol en opslagmechanisme zijn nog open punten. |
| Ongewenste repository- of PR-wijziging | Beperk GitHub-app/tokenrechten en toegestane repository/scope; vereist menselijke PR-review voordat samenvoegen plaatsvindt. |
| Verlies of manipulatie van workflow/auditgegevens | Gebruik gecontroleerde database-toegang, consistente writes en passende back-ups; ontwerp retentie en integriteitscontrole vóór productiegebruik. |
| Secrets in logs of agentuitvoer | Redigeer gevoelige waarden, beperk logtoegang en voorkom dat geheimen aan agents worden doorgegeven. |

## Autorisatie en goedkeuring

- Default-deny voor niet-expliciet toegestane acties.
- Agentrollen krijgen alleen minimale taakgebonden tools.
- Productie-impact en externe side-effects vereisen menselijke goedkeuring volgens
  het beleid.
- Hoog-risicowijzigingen vereisen goedkeuring; de initiële classificatie staat in
  `policies/risk-classification.json`.
- Goedkeuring moet worden vastgelegd met actor, tijdstip, workflow, actie en
  wijzigingscontext. Een wijziging van de goed te keuren inhoud maakt de
  eerdere goedkeuring ongeldig.
- Agents mogen hun eigen risico- of goedkeuringsstatus niet verlagen.

De precieze identiteit van goedkeurders, goedkeurings-API en het gedrag bij
afwijzing of timeout moeten nog worden ontworpen.

## Geheimen en gegevens

- Geen secrets in source control; commit alleen niet-gevoelige
  voorbeeldconfiguratie.
- Geen credentials in prompts, agentinput, commandoregels of ongeredigeerde
  logs.
- Gebruik voor lokale ontwikkeling een expliciet gekozen secretopslag en
  documenteer installatie buiten versiebeheer.
- Beperk welke ticket- en repositorygegevens naar modelaanroepen worden
  verstuurd; bepaal dit per integratie en dataklasse.
- Stel bewaartermijnen en verwijderprocedures vast voor ticketinhoud,
  agenttranscripten en auditdata.

Secretopslag, dataclassificatie en retentie zijn nog niet geïmplementeerd of
definitief gekozen.

## Audit en incidentrespons

Leg ten minste workflowtransities, policybeslissingen, goedkeuringen,
agentstart/-einde, relevante toolacties en GitHub-acties vast. Logs horen
correlatie-ID's te bevatten en gevoelige inhoud te vermijden of redigeren.
Auditlogging moet storingen zichtbaar maken; kritieke acties mogen niet stilzwijgend
doorgaan wanneer een vereiste auditregistratie mislukt.

Voor gebruik buiten een lokale demo zijn daarnaast een incidentprocedure,
credential-rotatie, herstel uit back-up en een procedure voor het stoppen of
annuleren van actieve agentruns nodig.

## Minimale security-checklist vóór uitvoering

- [ ] Webhook-authenticatie, inputvalidatie en idempotente verwerking.
- [ ] Least-privilege GitHub-app/token met expliciete repository-scope.
- [ ] Geen GitHub-token, Docker-socket of persoonlijke mounts in agentcontainers.
- [ ] Docker-netwerk-, capability-, resource- en workspace-opruimbeleid.
- [ ] Secrets veilig lokaal beheren en logredactie testen.
- [ ] Policybeslissingen en goedkeuringen duurzaam en controleerbaar opslaan.
- [ ] Tests voor geweigerde acties, prompt injection en falende audit/policy-opslag.
- [ ] Annulering, timeout, retry en herstel van agentruns definiëren.

