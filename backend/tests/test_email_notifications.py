import os
from datetime import datetime, timedelta

import pytest
from flask import Flask

from extensions import db, mail
from models import (
    AppConfig, Chronologie, Document, Formation, FormationType, Milestone,
    Professor, Student, Ticket, User,
)
from services.notification_service import NotificationService
from services.workflow_service import update_status

TEMPLATES = os.path.join(os.path.dirname(__file__), "..", "templates", "emails")


def _template(name):
    with open(os.path.join(TEMPLATES, name), encoding="utf-8") as f:
        return f.read()


@pytest.fixture()
def mail_app():
    app = Flask(__name__)
    app.config.update(
        TESTING=True,  # Flask-Mail suppresses real sending when TESTING is set
        SQLALCHEMY_DATABASE_URI="sqlite:///:memory:",
        MAIL_DEFAULT_SENDER="noreply@test.ma",
        FRONTEND_URL="https://diplomtrack.test",
    )
    db.init_app(app)
    mail.init_app(app)

    with app.app_context():
        db.create_all()
        db.session.add(AppConfig(
            id=1,
            warning_delay_days=14,
            email_ticket_blocked_template=_template("ticket_blocked.html"),
            email_agent_delay_template=_template("agent_delay_warning.html"),
            email_admin_report_template=_template("admin_daily_report.html"),
        ))
        db.session.commit()
        yield app
        db.session.remove()
        db.drop_all()


def _make_ticket(milestone_code, days_on_milestone=0):
    milestones = {}
    for order, code in enumerate(
        ["CREATED", "ATTENTE_CORRECTION_DOCS", "DOSSIER_EN_COURS", "EN_ATTENTE_REPONSE"], start=1
    ):
        milestones[code] = Milestone(code=code, label=code, order=order)
    agent = User(username="agent1", email="agent1@test.ma", password_hash="x", role="AGENT")
    admin = User(username="admin", email="admin@test.ma", password_hash="x", role="ADMIN")
    ftype = FormationType(code="LUS", label="Licence")
    prof = Professor(first_name="Pr", last_name="Test")
    db.session.add_all([*milestones.values(), agent, admin, ftype, prof])
    db.session.flush()

    formation = Formation(
        formation_name="Info", formation_type_id=ftype.id, professor_responsible_id=prof.id
    )
    db.session.add(formation)
    db.session.flush()

    student = Student(
        first_name="Salma", last_name="Bennani", email="salma@test.ma",
        academic_year="2024-2025", formation_id=formation.id,
    )
    db.session.add(student)
    db.session.flush()

    ticket = Ticket(
        reference="FC-MAIL0001", student_id=student.id, user_id=agent.id,
        status="PENDING", current_milestone_id=milestones[milestone_code].id,
    )
    db.session.add(ticket)
    db.session.flush()

    db.session.add(Chronologie(
        ticket_id=ticket.id, milestone_id=milestones[milestone_code].id, status="PENDING",
        started_at=datetime.utcnow() - timedelta(days=days_on_milestone),
    ))
    db.session.commit()
    return ticket


def test_delay_warning_emails_the_agent(mail_app):
    _make_ticket("EN_ATTENTE_REPONSE", days_on_milestone=20)

    with mail.record_messages() as outbox:
        assert NotificationService.check_and_create_delay_warnings() == 1

    assert len(outbox) == 1
    assert outbox[0].recipients == ["agent1@test.ma"]
    assert "FC-MAIL0001" in outbox[0].html
    assert "https://diplomtrack.test/dossiers" in outbox[0].html


def test_daily_report_goes_to_admins(mail_app):
    _make_ticket("EN_ATTENTE_REPONSE", days_on_milestone=20)

    with mail.record_messages() as outbox:
        assert NotificationService.send_admin_daily_report() == 1

    assert outbox[0].recipients == ["admin@test.ma"]
    assert "FC-MAIL0001" in outbox[0].html


def test_daily_report_prefers_alerts_email(mail_app):
    _make_ticket("EN_ATTENTE_REPONSE", days_on_milestone=20)
    AppConfig.get_config().alerts_email = "alerts@test.ma"
    db.session.commit()

    with mail.record_messages() as outbox:
        NotificationService.send_admin_daily_report()

    assert [m.recipients for m in outbox] == [["alerts@test.ma"]]


def test_correction_required_emails_the_student(mail_app):
    ticket = _make_ticket("DOSSIER_EN_COURS")
    db.session.add(Document(
        ticket_id=ticket.id, document_type="BAC",
        is_validated=False, validation_comment="Copie illisible",
    ))
    db.session.commit()

    with mail.record_messages() as outbox:
        update_status(ticket, "ATTENTE_CORRECTION_DOCS", performed_by=ticket.user_id)

    assert len(outbox) == 1
    assert outbox[0].recipients == ["salma@test.ma"]
    assert "Copie illisible" in outbox[0].html
    assert f"https://diplomtrack.test/dossier/{ticket.id}" in outbox[0].html


def test_disabled_email_notifications_send_nothing(mail_app):
    _make_ticket("EN_ATTENTE_REPONSE", days_on_milestone=20)
    AppConfig.get_config().enable_email_notifications = False
    db.session.commit()

    with mail.record_messages() as outbox:
        NotificationService.check_and_create_delay_warnings()

    assert outbox == []
