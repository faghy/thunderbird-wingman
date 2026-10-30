# Informativa privacy di Wingman

[🇬🇧 Read in English](PRIVACY.md)

Ultimo aggiornamento: 30 ottobre 2026

Wingman è un componente aggiuntivo di Thunderbird che impara come gestisci le mail automatiche e transazionali e ripete le stesse azioni sulla posta nuova. Questa informativa spiega quali dati legge, quali escono dal tuo computer e dove vanno.

## Chi è il responsabile

Wingman è sviluppato da Faghy (https://github.com/faghy/thunderbird-wingman). Wingman non ha server propri: lo sviluppatore non riceve, non conserva e non vede nessuno dei tuoi dati.

## Dati letti sul tuo computer

Per imparare, Wingman legge le intestazioni dei messaggi nelle caselle che hai attivato: mittente, oggetto, data, cartella, etichette e stato di lettura. Legge anche il testo delle nuove mail automatiche che arrivano in posta in arrivo. Questa elaborazione avviene dentro Thunderbird. I risultati (statistiche, regole imparate, registro delle attività e impostazioni, compresa la chiave API) restano nello spazio locale del componente aggiuntivo e vengono cancellati quando lo disinstalli o premi «Azzera tutto ciò che è stato imparato».

## Dati inviati a terzi

Wingman usa l'API di Anthropic (`api.anthropic.com`) con **la tua chiave API**. Invia dati **solo dopo il tuo consenso esplicito** nella pagina delle opzioni, dove puoi anche revocarlo in qualsiasi momento. Senza consenso Wingman continua a funzionare in locale: aggiorna le statistiche e applica le regole che hai già, ma non invia nulla.

Dopo il consenso vengono inviati:

- **Per imparare** (al massimo una volta per intervallo configurato, di default ogni 24 ore, oppure quando premi «Analizza e impara ora»), per i mittenti più frequenti: indirizzi dei mittenti, oggetti con i numeri rimossi, quante mail hai tenuto, spostato, archiviato, cestinato o etichettato, e i nomi di caselle, cartelle ed etichette coinvolte.
- **Per la posta nuova** che sembra automatica e che nessuna regola copre, solo se l'opzione «Usa l'AI per le mail automatiche di mittenti non ancora coperti da regole» è attiva e nel limite orario che imposti: mittente, oggetto e i primi 800 caratteri del testo, insieme all'elenco delle tue regole.

L'elenco per imparare comprende ogni mittente che hai spostato, archiviato, cestinato o etichettato più volte (di default almeno 3), quindi anche persone, se tratti spesso le loro mail sempre allo stesso modo: di loro partono solo indirizzo e oggetti senza numeri. Il testo delle mail che non sembrano automatiche non viene mai inviato.

Wingman non invia mai allegati, destinatari o altre intestazioni, né dati delle caselle che hai disattivato. Non invia, inoltra né risponde mai a nessuna mail.

Anthropic tratta questi dati secondo la propria informativa privacy (https://www.anthropic.com/legal/privacy) e i termini della tua chiave API. La chiave API viene inviata solo ad `api.anthropic.com`, per autenticare queste richieste.

## Nessun tracciamento

Wingman non ha statistiche d'uso, telemetria, pubblicità o tracciamento e non fa altre richieste di rete oltre a quelle descritte.

## Modifiche

Se una nuova versione invia dati diversi, ti chiederà di nuovo il consenso. L'informativa è pubblicata insieme al codice sorgente, quindi ogni modifica è visibile nella cronologia della repository.

## Contatti

Domande e segnalazioni: https://github.com/faghy/thunderbird-wingman/issues
