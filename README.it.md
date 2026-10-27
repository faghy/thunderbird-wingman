# Wingman per Thunderbird

[🇬🇧 Read in English](README.md)

Wingman è un componente aggiuntivo per Thunderbird (140 ESR e successivi) che impara come gestisci le mail automatiche e transazionali (ordini, spedizioni, bollette, newsletter, notifiche) in tutte le tue caselle. Poi lo rifà al posto tuo sulle mail nuove: le sposta, le archivia, le mette nel cestino o le etichetta.

Lavora osservando quello che fai già: non devi scrivere nessun filtro.

## Come funziona

1. **Osserva.** Wingman guarda dove sono finiti i messaggi degli ultimi N giorni:
   - letto e rimasto in Posta in arrivo → "tenuto"
   - nel cestino → "eliminato"
   - in archivio → "archiviato"
   - in un'altra cartella → "spostato"
   - contano anche le etichette

   Da lì in poi osserva in tempo reale anche i messaggi che sposti, elimini o etichetti.
2. **Impara.** Per ogni mittente al modello arrivano solo i conteggi e gli oggetti (con i numeri tolti). Il modello linguistico riconosce quali mittenti sono automatici e propone regole, come "le bollette Enel vanno in Fatture" o "le promo di quel negozio vanno nel cestino". Quando uno stesso mittente va in posti diversi, separa le regole in base alle parole dell'oggetto.
3. **Verifica.** Ogni regola proposta viene ricontrollata in locale sul tuo storico. Viene scartata se si basa su meno di 3 messaggi o se il tuo comportamento è stato coerente meno dell'85% delle volte (entrambe le soglie sono configurabili). Una regola non può mai puntare a cartelle o etichette inesistenti.
4. **Agisce.** Le mail nuove in Posta in arrivo vengono confrontate con le regole attive in locale, senza chiamate API e senza costi. Quando una mail automatica arriva da un mittente che nessuna regola copre, il modello può collegarla a una regola esistente, per esempio l'avviso di spedizione di un negozio da cui non hai mai comprato. La sua risposta può essere solo l'ID di una regola esistente oppure "nessuna", quindi non può inventare azioni nuove.
5. **Si corregge.** Ogni azione si può annullare dalla pagina delle opzioni. Se rimetti in Posta in arrivo una mail che Wingman aveva spostato, lui se ne accorge. Una regola che annulli spesso si disattiva da sola.

## Sicurezza

- **Mai eliminazioni definitive.** "Elimina" significa sempre "sposta nel cestino".
- **Le regole di eliminazione richiedono la tua approvazione.** Restano *proposte* finché non le attivi tu (è l'impostazione predefinita e si può cambiare).
- **Modalità solo suggerimenti.** Wingman registra cosa farebbe senza toccare nulla.
- **Non invia mai niente.** Non può inviare, inoltrare o rispondere. Un'istruzione malevola nascosta in una mail (prompt injection) può al massimo far scegliere una delle tue regole esistenti.
- **La chiave API resta in locale.** È salvata nello storage locale dell'estensione e le richieste vanno direttamente a `api.anthropic.com`.
- **Privacy.** Per imparare escono dal tuo computer solo mittenti, oggetti senza numeri e conteggi. Il testo di una mail (al massimo 800 caratteri) viene inviato solo per le mail automatiche che nessuna regola copre, e solo se l'opzione è attiva.

## Build e installazione

```bash
npm install
npm test        # test della logica con Thunderbird e API simulati
npm run build   # crea dist/ e wingman.xpi
```

In Thunderbird vai su *Strumenti → Componenti aggiuntivi e temi → ⚙ → Installa componente aggiuntivo da file…* e scegli `wingman.xpi`.
Per lo sviluppo usa *Strumenti → Strumenti per sviluppatori → Debug componenti aggiuntivi → Carica componente aggiuntivo temporaneo* e scegli `dist/manifest.json`.

La pagina delle opzioni si apre da sola al primo avvio, oppure dal pulsante nella barra. Inserisci la tua chiave API di Anthropic e premi **Analizza e impara ora**. Per i primi giorni la **modalità solo suggerimenti** è un buon modo per controllare cosa farebbe Wingman.

## Modelli e costi

Wingman usa l'API di Anthropic; il modello predefinito è Claude Opus 5.5. Le regole vengono ricalcolate una volta al giorno e le mail già coperte da una regola non costano nulla. Per risparmiare puoi passare a Claude Sonnet 5.5 o Claude Haiku 5.5 dalle opzioni. Sui modelli che lo supportano, se il modello rifiuta una richiesta, questa viene ripetuta in automatico su un modello di riserva (`fallbacks: "default"`).

## Struttura del progetto

| Percorso | Ruolo |
|---|---|
| `src/background.js` | Listener di Thunderbird, scheduler, comandi per la pagina opzioni |
| `src/agent.js` | Applicazione delle regole alle mail nuove, classificazione dei mittenti sconosciuti, annullamento, apprendimento in tempo reale |
| `src/learner.js` | Scansione dello storico, riepilogo per mittente, generazione e verifica delle regole |
| `src/rules.js` | Corrispondenza delle regole, statistiche, osservazioni |
| `src/mail.js` | Helper per le API di Thunderbird |
| `src/llm.js` | Chiamate API al modello con output strutturato |
| `options/` | Pagina di impostazioni, regole e attività |
| `test/` | Test in Node con Thunderbird e API simulati |

## Licenza

Copyright (C) 2026 Faghy. Distribuito con licenza [GNU General Public License v3.0 o successiva](LICENSE): puoi usarlo, studiarlo, modificarlo e ridistribuirlo, ma le opere derivate devono restare sotto GPL e mantenere l'indicazione del copyright originale.
