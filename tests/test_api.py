from fastapi.testclient import TestClient

from app.main import app
from app.store import store


client = TestClient(app)


def setup_function() -> None:
    store.reset()


def test_health_does_not_expose_secrets() -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert "token" not in str(response.json()).lower()


def test_demo_still_requires_human_confirmation() -> None:
    client.post("/api/demo/seed")
    assignments = client.post("/api/assign").json()["assignments"]
    assert any(item["owner"] is None and item["status"] == "needs_input" for item in assignments)
    confirmed = client.post("/api/confirm", json={"assignment_id": "assignment-a", "actor": "tester"})
    assert confirmed.status_code == 200
    assert confirmed.json()["status"] == "confirmed"


def test_allowlist_and_bot_filter_protect_discord_input() -> None:
    allowed = client.post("/api/discord/events", json={"channel_id": "project-room", "message_id": "m-1", "author_id": "u-1", "content": "hello"})
    denied = client.post("/api/discord/events", json={"channel_id": "private-room", "message_id": "m-2", "author_id": "u-1", "content": "secret"})
    bot = client.post("/api/discord/events", json={"channel_id": "project-room", "message_id": "bot-1", "author_id": "bot", "content": "I will handle it", "is_bot": True})
    assert allowed.status_code == 200
    assert allowed.json()["persisted"] is True
    assert denied.status_code == 403
    assert bot.json() == {"accepted": False, "reason": "Bot messages are not used as role evidence."}


def test_korean_explicit_promise_is_classified() -> None:
    response = client.post(
        "/api/discord/events",
        json={
            "channel_id": "project-room",
            "message_id": "korean-promise",
            "author_id": "yerin-id",
            "author_name": "Yerin",
            "content": "\ub370\uc774\ud130 \uc815\ub9ac\ub294 \ub0b4\uac00 \ub9e1\uc744\uac8c",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["classification"]["category"] == "work_promise"
    assert "\ub370\uc774\ud130" in body["classification"]["task_text"]


def test_emptyroom_mock_discord_transcript_proposes_evidence_based_roles() -> None:
    project = client.post(
        "/api/projects",
        json={
            "id": "emptyroom",
            "title": "EmptyRoom campus classroom finder",
            "channel_id": "project-room",
            "deadline": "2026-08-14T18:00:00+09:00",
            "tasks": [
                {"id": "data", "title": "lecture room data schema and sample data", "keywords": ["data", "schema", "columns", "sample"]},
                {"id": "backend", "title": "FastAPI room availability API", "keywords": ["FastAPI", "API", "backend", "rooms"]},
                {"id": "frontend", "title": "search screen and prototype", "keywords": ["frontend", "Figma", "prototype", "search screen"]},
                {"id": "slides", "title": "five-minute presentation slides", "keywords": ["slides", "presentation"]},
            ],
        },
    )
    assert project.status_code == 200

    messages = [
        {"message_id": "1001", "author_id": "yerin", "author_name": "Yerin", "content": "lecture room data schema and sample data I will organize.", "source_url": "https://discord.com/channels/guild/project-room/1001"},
        {"message_id": "1002", "author_id": "minjae", "author_name": "Minjae", "content": "FastAPI room availability API I will handle by Wednesday evening."},
        {"message_id": "1003", "author_id": "hyunwoo", "author_name": "Hyunwoo", "content": "search screen prototype I will build by Tuesday evening."},
        {"message_id": "1004", "author_id": "yerin", "author_name": "Yerin", "content": "five-minute presentation slides I will prepare."},
        {"message_id": "1005", "author_id": "guest", "author_name": "Guest", "content": "I think this is a good project."},
    ]
    for message in messages:
        response = client.post("/api/discord/events", json={"channel_id": "project-room", **message})
        assert response.status_code == 200

    assignments = client.post("/api/assign").json()["assignments"]
    by_task = {item["task_id"]: item for item in assignments}
    assert by_task["data"]["owner"] == "Yerin"
    assert by_task["backend"]["owner"] == "Minjae"
    assert by_task["frontend"]["owner"] == "Hyunwoo"
    assert by_task["slides"]["owner"] == "Yerin"
    assert by_task["data"]["evidence"][0]["source_url"].endswith("/1001")
    assert all(item["status"] == "proposed" for item in assignments)


def test_duplicate_message_is_not_used_twice() -> None:
    body = {"channel_id": "project-room", "message_id": "same", "author_id": "u-1", "content": "hello"}
    assert client.post("/api/discord/events", json=body).json()["duplicate"] is False
    assert client.post("/api/discord/events", json=body).json()["duplicate"] is True
