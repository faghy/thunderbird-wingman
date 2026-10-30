# Wingman for Thunderbird

[🇮🇹 Leggi in italiano](README.it.md) · [Website](https://wingman.faghy.it/) · [Download](https://github.com/faghy/thunderbird-wingman/releases/latest)

Wingman is a Thunderbird add-on (140 ESR and later) that learns how you deal with automated and transactional email (orders, shipping updates, invoices, newsletters, notifications) across all your mailboxes. It then does the same for you on new mail: moves it, archives it, sends it to the trash or tags it.

It works by watching what you already do. You don't write any filters.

## How it works

1. **Observe.** Wingman looks at where your messages from the last N days ended up:
   - read and still in the inbox → "kept"
   - in the trash → "deleted"
   - in the archive → "archived"
   - in any other folder → "moved"
   - tags count too

   From then on it also watches, live, the messages you move, delete or tag.
2. **Learn.** For each sender, only the counts and the subjects (with numbers stripped) go to the language model, which works out which senders are automated and proposes rules, such as "Enel bills go to Invoices" or "this shop's promos go to the trash". When one sender's mail goes to different places, it splits the rules by subject keywords.
3. **Verify.** Every proposed rule is re-checked locally against your history. It is dropped if it rests on fewer than 3 messages or if you behaved consistently less than 85% of the time (both thresholds are configurable). A rule can never point to a folder or tag that doesn't exist.
4. **Act.** New mail in the inbox is matched against the active rules locally, with no API call and no cost. When automated mail comes from a sender that no rule covers, the model can map it to an existing rule, for example a shipping notice from a shop you've never bought from. Its answer is limited to the IDs of existing rules or "none", so it cannot invent new actions.
5. **Self-correct.** Every action can be undone from the options page. If you drag a message Wingman filed back to the inbox, it notices. A rule you keep undoing switches itself off.

## Safety

- **No permanent deletes.** "Delete" always means "move to trash".
- **Delete rules need your approval.** They stay *proposed* until you activate them (this is the default and can be changed).
- **Suggest-only mode.** Wingman logs what it would do without touching anything.
- **It never sends anything.** It cannot send, forward or reply. A prompt injection hidden in an email can at most pick one of your existing rules.
- **Your API key stays local.** It lives in the add-on's local storage, and requests go straight to `api.anthropic.com`.
- **Privacy.** Nothing leaves your machine until you give explicit consent in the options page, and you can withdraw it at any time. After that, learning sends only senders, subjects with numbers removed, counts and folder names. Message text (at most 800 characters) is sent only for automated mail that no rule covers, and only if that option is turned on. See the [privacy policy](PRIVACY.md).

## Build and install

```bash
npm install
npm test        # logic tests against a simulated Thunderbird and API
npm run build   # produces dist/ and wingman.xpi
```

In Thunderbird, go to *Tools → Add-ons and Themes → ⚙ → Install Add-on From File…* and pick `wingman.xpi`.
For development, use *Tools → Developer Tools → Debug Add-ons → Load Temporary Add-on* and pick `dist/manifest.json`.

The options page opens on first run, or from the toolbar button. Accept the consent panel, enter your Anthropic API key and press **Analizza e impara ora** ("Analyze and learn now"; the UI is currently in Italian). For the first few days, **suggest-only mode** is a good way to check what Wingman would do.

To publish on addons.thunderbird.net, commit everything and run `npm run source` to produce `wingman-source.zip`, the source archive reviewers rebuild from. The listing text, reviewer notes, icon and screenshots are in [`store/`](store/LISTING.md).

## Models and cost

Wingman uses the Anthropic API; the default model is Claude Opus 5.5. Rules are re-learned once a day, and mail that already matches a rule costs nothing. You can switch to Claude Sonnet 5.5 or Claude Haiku 5.5 in the options to save money. On models that support it, refused requests are retried automatically on a fallback model (`fallbacks: "default"`).

## Project layout

| Path | Role |
|---|---|
| `src/background.js` | Thunderbird listeners, scheduler, commands for the options page |
| `src/agent.js` | Applies rules to new mail, classification of unknown senders, undo, live learning |
| `src/learner.js` | History scan, per-sender summary, rule generation and verification |
| `src/rules.js` | Rule matching, statistics, observations |
| `src/mail.js` | Thunderbird API helpers |
| `src/llm.js` | Model API calls with structured output |
| `options/` | Settings, rules and activity page |
| `test/` | Node tests with Thunderbird and the API mocked |
| `store/` | Listing text, reviewer notes, icon and screenshots for addons.thunderbird.net |

## License

Copyright (C) 2026 Faghy. Released under the [GNU General Public License v3.0 or later](LICENSE): you may use, study, modify and redistribute it, but derived works must stay under the GPL and keep the original copyright notice.
