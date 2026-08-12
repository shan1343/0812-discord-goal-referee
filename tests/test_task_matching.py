from app.services import _matches_task


def test_task_matching_rejects_one_generic_shared_word() -> None:
    task = {
        "title": "lecture room data schema and sample data",
        "keywords": ["data", "schema", "columns", "sample"],
    }
    assert _matches_task("lecture room data schema and sample data", task, False)
    assert not _matches_task("FastAPI room availability API", task, False)
