# Swimlanes – egen Trello Power-Up

Viser kortene på en Trello-tavle i et rutenett: listene som kolonner og
etiketter, medlemmer eller egendefinerte felt som rader (swimlanes).

## Personvern
- Alt kjører i brukerens nettleser. Data hentes via Trellos klientbibliotek
  (`p.trellocdn.com`) som snakker direkte med trello.com.
- Ingen backend, ingen analytics, ingen eksterne fonter eller CDN-er.
- Valgt gruppering lagres i Trellos egen `pluginData` på tavla.
- `Content-Security-Policy` blokkerer nettverkskall til andre domener.

## Filer
| Fil | Formål |
|---|---|
| `index.html` + `connector.js` | «Iframe connector» som Trello laster. Legger til knappen *Swimlanes* på tavla. |
| `swimlanes.html/.css/.js` | Selve visningen, åpnes i fullskjerm-modal. |
| `icon.svg` | Ikon på knappen. |

## Kom i gang
1. **Host filene statisk over HTTPS** et sted dere stoler på (egen server,
   intern plattform, skyleverandør i EU/Norge). Ingen byggesteg trengs.
2. Gå til **https://trello.com/power-ups/admin** → *New*.
   - Velg workspace teamet bruker.
   - *Iframe connector URL*: `https://<din-host>/index.html`
3. Under fanen **Capabilities**: slå på `board-buttons`.
4. På tavla: *Power-Ups* → *Custom* → legg til power-upen.
5. Klikk **Swimlanes** øverst på tavla.

Test lokalt: `npx http-server -S` (eller en ngrok/cloudflared-tunnel) og
bruk den HTTPS-adressen som connector-URL i en test-workspace.

## Videre ideer
- **Dra og slipp** mellom baner/lister krever skriving via Trellos REST-API.
  Bruk `t.getRestApi()` med en API-nøkkel; tokenet lagres hos Trello og
  kallene går direkte fra nettleseren til `api.trello.com`
  (husk å legge til `https://api.trello.com` i `connect-src`).
- Filtrere hvilke etiketter som skal bli baner.
