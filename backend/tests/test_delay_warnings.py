import threading
from datetime import datetime, timedelta

import pytest
from flask import Flask

from extensions import db
from models import (
    AppConfig, Chronologie, Formation, FormationType, Milestone,
    Notification, Professor, Student, Ticket, User,
)
from services.notification_service import NotificationService
from tasks.scheduler import check_delay_warnings


@pytest.fixture()
def db_app():
    app = Flask(__name__)
    app.config["TESTING"] = True
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    db.init_app(app)

    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


def _make_waiting_ticket(days_waiting, milestone_code="EN_ATTENTE_REPONSE"):
    db.session.add(AppConfig(id=1, warning_delay_days=14))
    milestone = Milestone(code=milestone_code, label=milestone_code, order=10)
    agent = User(username="agent", email="agent@test.ma", password_hash="x", role="AGENT")
    ftype = FormationType(code="LUS", label="Licence")
    prof = Professor(first_name="Pr", last_name="Test")
    db.session.add_all([milestone, agent, ftype, prof])
    db.session.flush()

    formation = Formation(
        formation_name="Info", formation_type_id=ftype.id, professor_responsible_id=prof.id
    )
    db.session.add(formation)
    db.session.flush()

    student = Student(
        first_name="Etu", last_name="Diant", academic_year="2024-2025", formation_id=formation.id
    )
    db.session.add(student)
    db.session.flush()

    # Status as set by WorkflowManager.update_ticket_status for this milestone
    ticket = Ticket(
        reference="FC-TEST0001", student_id=student.id, user_id=agent.id,
        status="PENDING", current_milestone_id=milestone.id,
    )
    db.session.add(ticket)
    db.session.flush()

    db.session.add(Chronologie(
        ticket_id=ticket.id, milestone_id=milestone.id, status="PENDING",
        started_at=datetime.utcnow() - timedelta(days=days_waiting),
    ))
    db.session.commit()
    return ticket


def test_overdue_ticket_gets_one_warning(db_app):
    ticket = _make_waiting_ticket(days_waiting=20)

    assert NotificationService.check_and_create_delay_warnings() == 1
    notification = Notification.query.one()
    assert notification.ticket_id == ticket.id
    assert notification.user_id == ticket.user_id

    # A second run within 24h must not duplicate the warning
    assert NotificationService.check_and_create_delay_warnings() == 0


def test_ticket_within_delay_gets_no_warning(db_app):
    _make_waiting_ticket(days_waiting=5)

    assert NotificationService.check_and_create_delay_warnings() == 0


def test_other_warnings_do_not_suppress_delay_warning(db_app):
    ticket = _make_waiting_ticket(days_waiting=20)
    NotificationService.create_notification(
        user_id=ticket.user_id, ticket_id=ticket.id, type="warning",
        title="Correction de documents requise", message="...",
    )

    assert NotificationService.check_and_create_delay_warnings() == 1


def test_scheduler_job_runs_outside_request_context(db_app):
    _make_waiting_ticket(days_waiting=20)

    # APScheduler calls the job from a bare thread with no app context
    thread = threading.Thread(target=check_delay_warnings, args=(db_app,))
    thread.start()
    thread.join()

    assert Notification.query.count() == 1
