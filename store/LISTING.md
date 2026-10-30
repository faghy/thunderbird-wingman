# addons.thunderbird.net listing

Text and files to paste into the Developer Hub when submitting or updating Wingman.

## Files

| Field | File |
|---|---|
| Add-on package | `wingman.xpi` (`npm run build`) |
| Source code archive | `wingman-source.zip` (`npm run source`, after committing) |
| Icon | `store/icon-128.png` |
| Screenshots | `store/screenshot-rules.png`, `store/screenshot-consent.png` (demo data, no real mail) |

## Basic fields

- **Name:** Wingman
- **Add-on URL:** `wingman`, or another free slug if taken
- **Categories:** Message and News Reading; Miscellaneous
- **License:** GNU General Public License v3.0 (or later)
- **Homepage:** https://wingman.faghy.it/
- **Support site:** https://github.com/faghy/thunderbird-wingman/issues
- **Tags:** filters, automation, transactional, newsletter, ai
- **Default locale of the listing:** Italian, with an English translation

## Summary (max 250 characters)

**IT:** Impara come gestisci le mail automatiche (ordini, spedizioni, fatture, newsletter) e lo rifà sulla posta nuova: sposta, archivia, cestina o etichetta. Nessun filtro da scrivere. Usa la tua chiave API Anthropic.

**EN:** Learns how you handle automated email (orders, shipping, invoices, newsletters) and does the same on new mail: move, archive, trash or tag. No filters to write. Uses your own Anthropic API key.

## Description

### IT

Wingman osserva cosa fai già con le mail automatiche e transazionali in tutte le tue caselle e lo ripete al posto tuo.

**Come funziona**
- Guarda dove sono finite le mail degli ultimi mesi (tenute, spostate, archiviate, cestinate, etichettate).
- Un modello linguistico propone delle regole, per esempio «le bollette della luce vanno in Fatture».
- Ogni regola viene verificata in locale sul tuo storico. Se non è coerente almeno all'85% su almeno 3 mail, viene scartata.
- Sulla posta nuova le regole si applicano in locale, senza costi. Il modello serve solo per mittenti automatici nuovi e può scegliere solo tra le tue regole esistenti.

**Sicurezza**
- Non elimina mai definitivamente: «elimina» vuol dire sempre «sposta nel cestino».
- Le regole che cestinano restano proposte finché non le attivi tu.
- Modalità «solo suggerimenti» e pulsante Annulla per ogni azione.
- Se riporti una mail dove stava, Wingman se ne accorge e spegne le regole che correggi spesso.
- Non può inviare, inoltrare o rispondere.

**Privacy**
Wingman non ha server propri. Con la tua chiave API, e solo dopo il tuo consenso esplicito (revocabile), invia ad Anthropic mittenti, oggetti senza numeri e conteggi per imparare. Per le mail automatiche che nessuna regola copre invia anche i primi 800 caratteri del testo. Dettagli nell'informativa privacy.

**Requisiti:** Thunderbird 140 o successivo e una chiave API Anthropic (console.anthropic.com). L'uso dell'API è a pagamento secondo il listino Anthropic.

Codice sorgente (GPL-3.0): https://github.com/faghy/thunderbird-wingman

### EN

Wingman watches what you already do with automated and transactional email across all your accounts, and repeats it for you.

**How it works**
- It looks at where the mail of the last months ended up (kept, moved, archived, trashed, tagged).
- A language model proposes rules, such as "electricity bills go to Invoices".
- Each rule is checked locally against your history and dropped unless it holds at least 85% of the time over at least 3 messages.
- On new mail, rules run locally at no cost. The model is only used for new automated senders, and it can only pick one of your existing rules.

**Safety**
- Never deletes permanently: "delete" always means "move to trash".
- Rules that trash mail stay proposed until you turn them on.
- Suggest-only mode and an Undo button for every action.
- If you move a message back, Wingman notices and switches off rules you keep correcting.
- It cannot send, forward or reply.

**Privacy**
Wingman has no servers of its own. With your API key, and only after your explicit (revocable) consent, it sends Anthropic sender addresses, subjects with numbers removed and counts so it can learn. For automated mail that no rule covers it also sends the first 800 characters of the text. See the privacy policy for details.

**Requirements:** Thunderbird 140 or later and an Anthropic API key (console.anthropic.com). API usage is billed at Anthropic's prices.

Source code (GPL-3.0): https://github.com/faghy/thunderbird-wingman

## Privacy policy

ATN wants the text pasted into the privacy policy field, not a link. Paste the full text of `PRIVACY.md`, and `PRIVACY.it.md` for the Italian listing. The same text is published at https://wingman.faghy.it/privacy (Italian); keep the two in sync.

## Notes to reviewers

Paste this into "Notes to Reviewer" and add a test key at the marked spot.

```
Build instructions
- Requirements: Node.js 20 or later (built with Node 24.22.0, npm 11.19.1), zip (Info-ZIP).
- Steps: unpack the source archive, then run
    npm ci
    npm run build
- The output is dist/ and wingman.xpi. dist/background.js is src/background.js bundled with esbuild
  (not minified) together with the official Anthropic SDK @anthropic-ai/sdk 1.3.0
  (https://www.npmjs.com/package/@anthropic-ai/sdk/v/1.3.0). Every other file is copied unchanged.
- Tests: npm test

Data and consent
- The add-on sends mail data only to https://api.anthropic.com, with the user's own API key, and declares
  the sensitiveDataUpload permission.
- On install the options page opens. It shows a consent panel listing exactly what is sent, with
  "Accept" and "Not now". No request with mail data is made before consent (see aiEnabled() in
  src/state.js, checked in src/learner.js and src/agent.js). Consent can be withdrawn from the settings
  section. CONSENT_VERSION re-asks for consent when the data sent changes.
- Without consent the add-on keeps working locally (statistics and rules the user already has).
- No remote code, no telemetry, no other network requests.

Testing
- An Anthropic API key is needed for the AI features: <TEST KEY HERE, with a spending limit>
- Steps: open the options page, accept consent, paste the key, press "Verifica", then
  "Analizza e impara ora". Rules appear under "Regole imparate". New mail in the inbox is then filed
  by the active rules (or only logged in "Solo suggerimenti" mode).
```
