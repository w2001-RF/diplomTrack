from flask import Flask
from config import Config
from extensions import db

from utils.constants import VALID_TRANSITIONS
from services.audit_service import AuditService

# Import ALL models here
from models import *
from utils.security import hash_password
from utils.passwords import generate_secure_password

import os

def get_or_create_professor(full_name: str, email: str = None, phone: str = None):
    """
    Dedup: prefer email, else full name.
    Default department: Enseignements Généraux if none.
    """
    default_dep = Departement.query.filter_by(departement_name="Enseignements Généraux").first()

    # normalize name split
    parts = (full_name or "").strip().replace("Pr.", "").replace("Prof.", "").replace("Pr", "").replace("Prof", "").strip().split()
    if len(parts) == 0:
        first_name, last_name = "UNKNOWN", "UNKNOWN"
    elif len(parts) == 1:
        first_name, last_name = parts[0], "UNKNOWN"
    else:
        first_name, last_name = " ".join(parts[:-1]), parts[-1]

    prof = None
    if email:
        prof = Professor.query.filter_by(email=email).first()

    if not prof:
        prof = Professor.query.filter_by(first_name=first_name, last_name=last_name).first()

    if prof:
        # update missing fields if new info provided
        if email and not prof.email:
            prof.email = email
        if phone and not prof.phone:
            prof.phone = phone

        # If no department => default
        if not prof.departement_id and default_dep:
            prof.departement_id = default_dep.id
        
        db.session.commit()
        return prof

    prof = Professor(
        first_name=first_name,
        last_name=last_name,
        email=email,
        phone=phone,
        departement_id=default_dep.id if default_dep else None
    )
    db.session.add(prof)
    db.session.flush()
    return prof

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    db.init_app(app)
    return app

def load_email_template(filename):
    """
    Charger un template d'email depuis le dossier templates/emails
    """
    template_path = os.path.join(os.path.dirname(__file__), 'templates', 'emails', filename)
    try:
        with open(template_path, 'r', encoding='utf-8') as f:
            return f.read()
    except FileNotFoundError:
        print(f"⚠️ Template {filename} not found at {template_path}")
        return None
    
def seed_milestones():
    """
    Populate milestones table with predefined order
    """
    print("📍 Seeding milestones...")

    # Ordre prédéfini des milestones
    ORDERED_MILESTONES = [
        "CREATED",
        "ATTENTE_CORRECTION_DOCS",
        "DOCS_CORRIGES_SOUMIS",
        "ATTENTE_DIPLOME",
        "DIPLOME_DEPOSE",
        "DIPLOME_ENVOYE_CENTRE",
        "VALIDATION_CENTRE_RECUE",
        "DOSSIER_EN_COURS",
        "PIECES_COMPLETES",
        "EN_ATTENTE_REPONSE",
        "REPONSE_RECUE",
        "DOSSIER_CLOTURE"
    ]
    
    # Milestone terminal
    terminal_code = "DOSSIER_CLOTURE"
    
    # Récupérer les milestones existants
    existing = {m.code: m for m in Milestone.query.all()}
    
    # Créer ou mettre à jour les milestones selon l'ordre prédéfini
    for index, code in enumerate(ORDERED_MILESTONES, start=1):
        if code in existing:
            # Mettre à jour l'ordre du milestone existant
            milestone = existing[code]
            milestone.order = index
            milestone.is_terminal = (code == terminal_code)
            print(f"  ↪ Mise à jour de l'ordre du milestone {code} à {index}")
        else:
            # Créer un nouveau milestone
            milestone = Milestone(
                code=code,
                label=code.replace("_", " ").title(),
                order=index,
                is_terminal=(code == terminal_code)
            )
            db.session.add(milestone)
            print(f"  ↪ Création du milestone {code} à l'ordre {index}")
    
    # Vérifier s'il y a des milestones existants qui ne sont pas dans la liste prédéfinie
    for code, milestone in existing.items():
        if code not in ORDERED_MILESTONES:
            print(f"  ⚠️ Milestone {code} non inclus dans l'ordre prédéfini")
    
    db.session.commit()
    print("✅ Milestones populated successfully")

def seed_admin_user():
    print("👤 Seeding admin user...")

    admin_username = "admin"
    admin_email = os.getenv("ADMIN_EMAIL", "admin@uit.ac.ma")

    admin = User.query.filter_by(username=admin_username).first()
    if admin:
        print("ℹ️ Admin user already exists")
        return

    # Initial password: ADMIN_PASSWORD, or a random one printed once.
    # Either way it must be changed at first login.
    admin_password = os.getenv("ADMIN_PASSWORD")
    if not admin_password:
        admin_password = generate_secure_password(16)
        print(f"🔑 Generated initial admin password (shown once): {admin_password}")

    admin = User(
        username=admin_username,
        email=admin_email,
        password_hash=hash_password(admin_password),
        role="ADMIN",
        must_reset_password=True,
        is_active=True
    )

    db.session.add(admin)
    db.session.commit()

    AuditService.log_action(
        action="CREATE_ADMIN",
        entity_type="User",
        entity_id=admin.id,
        performed_by=None
    )
    print("✅ Admin user created successfully")

def seed_formation_types():
    existing = {ft.code for ft in FormationType.query.all()}
    required = [("LUS", "Licence Universitaire Spécialisée"),
                ("MUS", "Master Universitaire Spécialisé")]

    for code, label in required:
        if code in existing:
            continue
        db.session.add(FormationType(code=code, label=label))

    db.session.commit()

def seed_app_config():
    """
    Initialize app configuration with email templates loaded from files
    """
    print("⚙️ Seeding app configuration...")
    
    config = db.session.get(AppConfig, 1)
    if config:
        print("ℹ️ App config already exists")
        return
    
    # Charger les templates depuis les fichiers
    ticket_blocked_template = load_email_template('ticket_blocked.html')
    agent_delay_template = load_email_template('agent_delay_warning.html')
    admin_report_template = load_email_template('admin_daily_report.html')
    
    config = AppConfig(
        id=1,
        warning_delay_days=14,
        alerts_email="admin@uit.ac.ma",
        notification_template_student="Bonjour {nom}, votre diplôme {reference} est en attente de révision. Statut: {status}",
        notification_template_agent="Nouveau diplôme {reference} soumis pour révision par {nom}. Statut: {status}",
        max_upload_size_mb=50,
        auto_archive_days=365,
        
        # ✅ Email Templates - Subjects
        email_ticket_blocked_subject='🚫 Ticket bloqué - {ticket_reference}',
        email_agent_delay_subject='⚠️ Tickets en retard - {count} dossier(s)',
        email_admin_report_subject='📊 Rapport journalier - {date}',
        
        # ✅ Email Templates - HTML Bodies (loaded from files)
        email_ticket_blocked_template=ticket_blocked_template,
        email_agent_delay_template=agent_delay_template,
        email_admin_report_template=admin_report_template,
        
        # ✅ Email Notification Settings
        enable_email_notifications=True,
        email_check_interval_hours=1
    )
    
    db.session.add(config)
    db.session.commit()
    print("✅ App config seeded with email templates")

def seed_departements():
    """
    Create departments and link each one to a Chef Professor.
    Also ensures 'Enseignements Généraux' exists.
    """
    print("🏛️ Seeding departements...")

    # Ensure default dep exists later, but we need chef professors first
    items = [
        {
            "departement_name": "Informatique, Logistique et Mathématiques",
            "chef_full_name": "GRETETE DRISS",
            "chef_email": None,
            "chef_phone": None
        },
        {
            "departement_name": "Génie Electrique, Réseaux et Système de Télécommunication",
            "chef_full_name": "EL BOUAYADI RACHID",
            "chef_email": None,
            "chef_phone": None
        },
        {
            "departement_name": "Enseignements Généraux",
            "chef_full_name": "BOUMAZZOU IBRAHIM",
            "chef_email": None,
            "chef_phone": None
        }
    ]

    existing = {d.departement_name: d for d in Departement.query.all()}

    for it in items:
        if it["departement_name"] in existing:
            continue

        chef = get_or_create_professor(
            it["chef_full_name"],
            email=it["chef_email"],
            phone=it["chef_phone"]
        )

        dep = Departement(
            departement_name=it["departement_name"],
            chef_professor_id=chef.id
        )
        db.session.add(dep)
        db.session.flush()

        # Optional but recommended: assign chef to his own department
        if not chef.departement_id:
            chef.departement_id = dep.id

    db.session.commit()
    print("✅ Departements seeded")

def seed_grades():
    defaults = [
        {"name": "Professeur", "code": "PR"},
        {"name": "Maître de Conférences", "code": "MC"},
        {"name": "Enseignant", "code": "ENS"},
    ]

    existing = {g.name for g in Grade.query.all()}
    for g in defaults:
        if g["name"] in existing:
            continue
        db.session.add(Grade(**g))
    db.session.commit()

def seed_formations():
    lus = [
        ("Ingénierie des Systèmes Automobiles et Mécatronique Industrielle", "LUS",
         "Prof. M. N. Srifi", "abdellah.lassioui@uit.ac.ma", "06 75 27 49 05"),

        ("Ingénierie Logicielle et Systèmes d'Information (ILSI)", "LUS",
         "Younès EL BOUZEKRI EL IDRISSI", "y.elbouzekri@uit.ac.ma", "0667 15 87 59"),

        ("Ingénierie des Systèmes Informatiques (ISI)", "LUS",
         "Boujiha Tarik", "tarik.boujiha@uit.ac.ma", "0666584221"),

        ("Ingénierie Electriques, Energie Renouvelable et Management de la Qualité (IEERMAQ)", "LUS",
         "EL GOURI Rachid", "rachid.elgouri@uit.ac.ma", "0661642767"),

        ("Ingénierie Décisionnelle et Big Data (LP-IDBD)", "LUS",
         "Younes ZOUINE", "lp.idbd.ensak@gmail.com", "0664275616"),

        ("Génie civil", "LUS",
         "ABOUTAFAIL Moulay Othman", "moulayothman.aboutafail@uit.ac.ma", "0661637449"),

        ("Génie Mécanique, Productique, Aéronautique", "LUS",
         "LAGRAT Ismail", "ismail.lagrat@uit.ac.ma", "0665633851"),

        ("Génie informatique et digitalisation", "LUS",
         "Khalid Chougdali", "khalid.chougdali@uit.ac.ma", "06.58.69.44.58"),

        ("Génie Industriel", "LUS",
         "Rachid BANNARI", "rachid.bannari@uit.ac.ma", "0661482285"),

        ("Ingénierie des systèmes embarquée et IoT", "LUS",
         "EL FADIL Hassan", "elfadil.h@gmail.com", "06 94 50 05 58"),

        ("Ingénierie des Systèmes industriels et supply chaîne", "LUS",
         "Laila EL ABBADI", "laila.elabbadi@uit.ac.ma", "0694500550"),

        ("Ingénierie Mécanique et de Contrôle Non Destructif dans l’Industrie Automobile (IMCIA)", "LUS",
         "Rachid EL BOUAYADI", "rachid.elbouayadi@uit.ac.ma", "06 61 90 66 88"),

        ("Systèmes automatisés et intelligence artificielle pour l’industrie 4.0", "LUS",
         "JAROU Tarik", "Tarik.jarou@uit.ac.ma", "0678208421"),

        ("Ingénierie du cloud block chain et IA", "LUS",
         "Ayoub AIT LAHCEN", "ayoub.aitlahcen@uit.ac.ma", "0664271855"),

        ("Ingénierie et gestion de l’eau", "LUS",
         "SAAD Aouatif", "saad.aouatif@uit.ac.ma", "0667547495"),

        ("Ingénierie Monétique Et Transactions Électroniques Sécurisées", "LUS",
         "Hanaa Hachimi", "hanaa.hachimi@uit.ac.ma", "+212 694 500 053"),

        ("Ingénierie de conception et d’industrialisation des produits et procédés", "LUS",
         "BOUAZAOUI Oussama", "Oussama.Bouazoaui@uit.ac.ma", "06.78.09.15.38"),

        ("Ingénierie des infrastructures industrielles", "LUS",
         "MHARZI Hassan", "contact.lus.3i@gmail.com", "06 94 50 00 50"),

        ("Informatique Industrielle et Digitalisation (IID)", "LUS",
         "GHARIB Jihane", "Jihane.gharib@uit.ac.ma", "0666781908"),
    ]

    mus = [
        ("Sécurité des Systèmes D'Informations (SSI)", "MUS",
         "Khalid Chougdali", "khalid.chougdali@uit.ac.ma", "06.58.69.44.58"),

        ("Génie Industriel et Logistique", "MUS",
         "Laila EL ABBADI", "laila.elabbadi@uit.ac.ma", "0694500550"),

        ("Ingénierie et Administration des Affaires Industrielles", "MUS",
         "Prof. Mohamed Nabil Srifi", "abdellah.lassioui@uit.ac.ma", "06 75 27 49 05"),

        ("Ingénierie Mécatronique Automobile et Avionique", "MUS",
         "Benbrahim Mohammed", "Mohammed.Benbrahim@uit.ac.ma", "06.61.30.12.02"),

        ("Ingénierie des Systems Embarqués", "MUS",
         "EL FADIL", "elfadil.h@gmail.com", "06 94 50 05 58"),

        ("Génie industriel, Management des systèmes et productique", "MUS",
         "Rachid BANNARI", "rachid.bannari@uit.ac.ma", "0661482285"),

        ("IA et technologie numérique pour l’industrie 4.0", "MUS",
         "JAROU Tarik", "Tarik.jarou@uit.ac.ma", "0678208421"),

        ("Génie Electromécanique des Systèmes Industriels", "MUS",
         "EL GOURI Rachid", "rachid.elgouri@uit.ac.ma", "0661642767"),

        ("BIG DATA et Business Intelligence", "MUS",
         "Ayoub AIT LAHCEN", "ayoub.aitlahcen@uit.ac.ma", "0664271855"),

        ("Ingénierie Logicielle et Management des Systèmes D'Information", "MUS",
         "Younès EL BOUZEKRI EL IDRISSI", "y.elbouzekri@uit.ac.ma", "0667 15 87 59"),

        ("Ingénierie Mécanique et Procédés industriels", "MUS",
         "BOUAZAOUI Oussama", "Oussama.Bouazoaui@uit.ac.ma", "06.78.09.15.38"),

        ("Génie Civil", "MUS",
         "ABOUTAFAIL Moulay Othman", "moulayothman.aboutafail@uit.ac.ma", "0661637449"),

        ("Management & Ingénierie de l’Agriculture de Précision", "MUS",
         "Rachid EL BOUAYADI", "rachid.elbouayadi@uit.ac.ma", "06 61 90 66 88"),

        ("Technologie industrielle et ingénierie de projets", "MUS",
         "Bilal LOTFI", "bilal.lotfi@uit.ac.ma", "0661 988 645"),

        ("Smart industry pour les véhicules autonomes", "MUS",
         "MHARZI Hassan", "contact.lus.3i@gmail.com", "06 94 50 00 50"),

        ("e-santé et IA", "MUS",
         "LAGRAT Ismail", "ismail.lagrat@uit.ac.ma", "0665633851"),

        ("Transformation Digital", "MUS",
         "MADINI Zhour", "mus.transformationdigitale.ensak@gmail.com", "06 94 50 05 72"),

        ("Digitalisation et architecture des systèmes d’information", "MUS",
         "Youssef GAHI", "youssef.gahi@uit.ac.ma", "0665254435"),

        ("Génie informatique, Digitalisation et Cybersécurité", "MUS",
         "TARIK BOUJIHA", "tarik.boujiha@uit.ac.ma", "0666584221"),
    ]

    all_items = lus + mus

    # formation types
    ft_map = {ft.code: ft for ft in FormationType.query.all()}

    existing = {(f.formation_name, f.formation_type_id) for f in Formation.query.all()}

    for formation_name, ftype_code, prof_name, prof_email, prof_phone in all_items:
        ft = ft_map.get(ftype_code)
        if not ft:
            continue

        key = (formation_name, ft.id)
        if key in existing:
            continue

        prof = get_or_create_professor(prof_name, email=(prof_email.split("/")[0].strip() if prof_email else None), phone=prof_phone)

        formation = Formation(
            formation_name=formation_name,
            description="Descriptif",
            formation_type_id=ft.id,
            professor_responsible_id=prof.id
        )

        db.session.add(formation)

    db.session.commit()

def init_database():
    app = create_app()

    with app.app_context():
        print("📦 Creating database tables...")
        db.create_all()
        seed_app_config()
        seed_admin_user()
        seed_milestones()
        seed_departements() # MUST be before professors default assignment in formations
        seed_grades()
        seed_formation_types()
        seed_formations()
        print("✅ Database initialized successfully")


if __name__ == "__main__":
    init_database()
