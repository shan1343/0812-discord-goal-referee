# Discord Goal Referee

Discord project messages become traceable, evidence-based role proposals. The
included EmptyRoom scenario uses direct work promises, deadlines and source
messages. It never ranks people by message volume or automatically confirms an
owner.

## Run the API

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --port 8000
```

Open `http://localhost:8000/docs` to send Discord-shaped mock events and
inspect proposed assignments.

## Run the visual mock

```bash
pnpm install
pnpm dev:web
```

The page shows the EmptyRoom transcript, each evidence-backed role proposal,
deadline, and the human-confirmation state.

## Test

```bash
pytest -q
```

See [the Discord input contract](docs/DISCORD_INPUT.md) for the direct Discord
Gateway-to-API payload and role-proposal rules.
