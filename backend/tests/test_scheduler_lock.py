from flask import Flask

from tasks import scheduler as scheduler_module


def test_only_one_scheduler_per_lock_file(tmp_path, monkeypatch):
    monkeypatch.setenv("SCHEDULER_LOCK_FILE", str(tmp_path / "scheduler.lock"))
    monkeypatch.setattr(scheduler_module, "_lock_file", None)
    app = Flask(__name__)

    first = scheduler_module.init_scheduler(app)
    holder = scheduler_module._lock_file
    try:
        assert first is not None
        # A second worker trying the same lock file must not start another one
        assert scheduler_module.init_scheduler(app) is None
    finally:
        if first:
            first.shutdown(wait=False)
        holder.close()


def test_scheduler_can_be_disabled(tmp_path, monkeypatch):
    monkeypatch.setenv("SCHEDULER_LOCK_FILE", str(tmp_path / "scheduler.lock"))
    monkeypatch.setenv("ENABLE_SCHEDULER", "false")

    assert scheduler_module.init_scheduler(Flask(__name__)) is None
