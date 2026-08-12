# Discord Goal Referee dashboard bridge

## What it connects

`/goal-referee` publishes its structured result to the FastAPI service. The public
dashboard reads only the sanitized latest result, so it never receives Discord
user IDs or the ingest secret.

```
Discord /goal-referee -> FastAPI POST /api/goal-referee/results -> dashboard GET /api/goal-referee/latest
```

## Required configuration

Run the FastAPI service on a public HTTPS URL and give it a persistent volume for
`GOAL_REFEREE_RESULTS_PATH`. Set these values:

- FastAPI: `ALLOWED_CHANNEL_IDS=<channel id>`,
  `GOAL_REFEREE_INGEST_TOKEN=<long random secret>`, and
  `DASHBOARD_CORS_ORIGINS=https://discord-goal-referee-0812.sanghyun1343590633.chatgpt.site`
- Discord bot: `GOAL_REFEREE_API_URL=https://<your-api-host>`,
  `GOAL_REFEREE_INGEST_TOKEN=<the same secret>`, and
  `GOAL_REFEREE_DASHBOARD_URL=https://discord-goal-referee-0812.sanghyun1343590633.chatgpt.site/`
- Site build environment:
  `NEXT_PUBLIC_GOAL_REFEREE_API_URL=https://<your-api-host>`

Do not put `GOAL_REFEREE_INGEST_TOKEN` in the website environment. It belongs
only in the bot and API service.

After deployment, run `/goal-referee` in the allowed Discord channel and open
the dashboard. It automatically refreshes every 15 seconds.
