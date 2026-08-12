# Discord input contract

The application accepts one selected, allowlisted Discord message at
`POST /api/discord/events`. A Discord Gateway adapter maps a `messageCreate`
event into this small payload before sending it to the API.

```json
{
  "channel_id": "project-room",
  "message_id": "1234567890",
  "author_id": "u01",
  "author_name": "Yerin",
  "content": "lecture room data schema and sample data I will organize.",
  "created_at": "2026-08-10T09:51:00+09:00",
  "source_url": "https://discord.com/channels/GUILD/CHANNEL/1234567890",
  "is_bot": false,
  "attachments": [
    {"id": "a1", "name": "rooms.json", "content_type": "application/json", "size": 2048}
  ]
}
```

Only allowlisted channels are accepted and bot messages are ignored. The API
keeps the message id, author id, text and traceable source reference; it does
not store attachment download URLs.

## Role proposal rule

1. Create the project task list with `POST /api/projects`.
2. Send normalized Discord messages to `/api/discord/events`.
3. Request `/api/assign`.

The current MVP proposes an owner only after an explicit work promise matches a
task title or configured keyword. It returns the matching message as evidence
and always uses `proposed` status; a person must confirm separately through
`POST /api/confirm`.

It does not use message count, writing tone, inferred competence or private
messages to assign work.
