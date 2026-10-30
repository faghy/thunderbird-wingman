# Wingman privacy policy

[🇮🇹 Leggi in italiano](PRIVACY.it.md)

Last updated: 30 October 2026

Wingman is a Thunderbird add-on that learns how you file automated and transactional email and repeats it on new mail. This policy explains what data it reads, what leaves your computer, and where it goes.

## Who is responsible

Wingman is developed by Faghy (https://github.com/faghy/thunderbird-wingman). Wingman has no servers of its own. The developer does not receive, store or see any of your data.

## Data read on your computer

To learn, Wingman reads the headers of messages in the mail accounts you enable: sender, subject, date, folder, tags and read status. It also reads the text of new automated messages that arrive in the inbox. This processing happens inside Thunderbird. Its results (statistics, learned rules, activity log and your settings, including your API key) are stored in the add-on's local storage and are deleted when you uninstall the add-on or press "Reset everything learned".

## Data sent to a third party

Wingman uses the Anthropic API (`api.anthropic.com`) with **your own API key**. It sends data **only after you give explicit consent** in the add-on's options page. You can withdraw consent at any time from the same page. Without consent, Wingman keeps working locally: it updates its statistics and applies the rules you already have, but sends nothing.

Once you consent, the following is sent:

- **When learning** (at most once per configured interval, by default every 24 hours, or when you press "Analyze and learn now"), for the most frequent senders: sender addresses, subjects with numbers removed, how many messages you kept, moved, archived, deleted or tagged, and the names of the accounts, folders and tags involved.
- **For new mail** that looks automated and that no rule covers, only if the "Use AI for automated mail from senders not yet covered" option is on, and limited to the hourly cap you set: sender, subject and the first 800 characters of the message text, together with the list of your existing rules.

The learning list includes every sender whose mail you moved, archived, trashed or tagged several times (at least 3 by default), so it can include people whose mail you always handle the same way: for them only the address and subjects with numbers removed are sent. The text of messages that don't look automated is never sent.

Wingman never sends attachments, recipients or other headers, or anything from accounts you have disabled. It never sends, forwards or replies to email.

Anthropic processes this data under its own privacy policy (https://www.anthropic.com/legal/privacy) and the terms that apply to your API key. The API key is sent only to `api.anthropic.com`, to authenticate those requests.

## No tracking

Wingman has no analytics, telemetry, advertising or tracking, and makes no network requests other than those described above.

## Changes

If a new version sends different data, it will ask for your consent again. This policy is published with the source code, so every change is visible in the repository history.

## Contact

Questions and reports: https://github.com/faghy/thunderbird-wingman/issues
