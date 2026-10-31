from flask_mail import Message
from extensions import mail, db
from flask import current_app
from datetime import datetime
from models.app_config import AppConfig
import logging
import socket

logger = logging.getLogger(__name__)


class EmailService:
    
    @staticmethod
    def _get_config():
        """
        Récupérer la configuration de l'application
        """
        return AppConfig.get_config()
    
    @staticmethod
    def _render_template(template_html, **context):
        """
        Remplacer les variables dans le template HTML
        """
        if not template_html:
            return None
        
        # Ajouter des variables par défaut
        context['current_year'] = datetime.now().year
        context['frontend_url'] = current_app.config.get('FRONTEND_URL', 'http://localhost:3000')
        
        # Remplacer toutes les variables {variable_name}
        rendered = template_html
        for key, value in context.items():
            placeholder = f"{{{key}}}"
            rendered = rendered.replace(placeholder, str(value) if value is not None else '')
        
        return rendered
    
    @staticmethod
    def send_email(to, subject, html_body, text_body=None):
        """
        Envoyer un email
        """
        config = EmailService._get_config()
        
        # Vérifier si les notifications email sont activées
        if not config.enable_email_notifications:
            logger.info(f"Email notifications disabled. Skipping email to {to}")
            return False
        
        try:
            msg = Message(
                subject=subject,
                recipients=[to] if isinstance(to, str) else to,
                html=html_body,
                body=text_body or html_body
            )
            
            mail.send(msg)
            logger.info(f"Email sent to {to}: {subject}")
            return True
        except Exception as e:
            logger.error(f"Error sending email to {to}: {str(e)}")
            return False
    
    @staticmethod
    def test_smtp_connection():
        """
        Tester la connexion SMTP sans envoyer d'email
        """
        import smtplib
        
        server = current_app.config.get('MAIL_SERVER')
        port = current_app.config.get('MAIL_PORT')
        use_tls = current_app.config.get('MAIL_USE_TLS')
        use_ssl = current_app.config.get('MAIL_USE_SSL')
        username = current_app.config.get('MAIL_USERNAME')
        password = current_app.config.get('MAIL_PASSWORD')
        
        logger.info(f"Testing SMTP connection to {server}:{port}")
        logger.info(f"TLS: {use_tls}, SSL: {use_ssl}")
        
        try:
            if use_ssl:
                smtp = smtplib.SMTP_SSL(server, port, timeout=10)
            else:
                smtp = smtplib.SMTP(server, port, timeout=10)
                if use_tls:
                    smtp.starttls()
            
            if username and password:
                smtp.login(username, password)
                logger.info("✅ SMTP authentication successful")
            
            smtp.quit()
            logger.info("✅ SMTP connection test successful")
            return True
            
        except socket.gaierror as e:
            logger.error(f"❌ DNS resolution failed for {server}: {str(e)}")
            return False
            
        except socket.error as e:
            logger.error(f"❌ Socket error: {str(e)}")
            logger.error(f"   This may be caused by:")
            logger.error(f"   1. Firewall blocking port {port}")
            logger.error(f"   2. Antivirus blocking SMTP")
            logger.error(f"   3. Port {port} already in use")
            logger.error(f"   4. Hyper-V reserving the port (Windows)")
            return False
            
        except smtplib.SMTPAuthenticationError as e:
            logger.error(f"❌ SMTP authentication failed: {str(e)}")
            logger.error(f"   Check username and password")
            return False
            
        except Exception as e:
            logger.error(f"❌ Unexpected error: {str(e)}")
            logger.exception(e)
            return False
        
    @staticmethod
    def send_ticket_blocked_notification(student_email, student_name, ticket_reference, ticket_id, reason):
        """
        Envoyer une notification à l'étudiant quand son ticket est bloqué
        """
        config = EmailService._get_config()
        
        # Récupérer le sujet et le template
        subject_template = config.email_ticket_blocked_subject or '🚫 Ticket bloqué - {ticket_reference}'
        html_template = config.email_ticket_blocked_template
        
        if not html_template:
            logger.error("Email template for blocked ticket not found in config")
            return False
        
        # Rendre le sujet
        subject = subject_template.format(ticket_reference=ticket_reference)
        
        # Rendre le template HTML
        html_body = EmailService._render_template(
            html_template,
            student_name=student_name,
            ticket_reference=ticket_reference,
            ticket_id=ticket_id,
            reason=reason
        )
        
        return EmailService.send_email(student_email, subject, html_body)
    
    @staticmethod
    def send_agent_delay_warning(agent_email, agent_name, delayed_tickets):
        """
        Envoyer un rapport des tickets en retard à un agent
        
        Args:
            agent_email: Email de l'agent
            agent_name: Nom de l'agent
            delayed_tickets: Liste de dictionnaires avec les clés:
                - reference: Référence du ticket
                - student_name: Nom de l'étudiant
                - days_late: Nombre de jours de retard
                - started_at: Date de début (format string)
                - id: ID du ticket (optionnel)
        """
        config = EmailService._get_config()
        
        # Récupérer le sujet et le template
        subject_template = config.email_agent_delay_subject or '⚠️ Tickets en retard - {count} dossier(s)'
        html_template = config.email_agent_delay_template
        
        if not html_template:
            logger.error("Email template for agent delay warning not found in config")
            return False
        
        # Générer les lignes du tableau
        tickets_rows = ""
        for ticket in delayed_tickets:
            tickets_rows += f"""
            <tr>
                <td><strong>{ticket['reference']}</strong></td>
                <td>{ticket['student_name']}</td>
                <td style="color: #f44336; font-weight: bold;">{ticket['days_late']} jour(s)</td>
                <td>{ticket['started_at']}</td>
            </tr>
            """
        
        # Rendre le sujet
        subject = subject_template.format(count=len(delayed_tickets))
        
        # Rendre le template HTML
        html_body = EmailService._render_template(
            html_template,
            agent_name=agent_name,
            count=len(delayed_tickets),
            tickets_rows=tickets_rows
        )
        
        return EmailService.send_email(agent_email, subject, html_body)
    
    @staticmethod
    def send_admin_daily_report(admin_email, admin_name, report_data):
        """
        Envoyer un rapport journalier complet à l'admin
        
        Args:
            admin_email: Email de l'admin
            admin_name: Nom de l'admin
            report_data: Dictionnaire contenant:
                - delayed_tickets: Liste des tickets en retard (même format que agent)
                - agents_summary: Liste de dictionnaires avec:
                    - name: Nom de l'agent
                    - email: Email de l'agent
                    - delayed_count: Nombre de tickets en retard
                - total_delayed: Nombre total de tickets en retard
                - agents_with_delays: Nombre d'agents concernés
        """
        config = EmailService._get_config()
        
        # Récupérer le sujet et le template
        subject_template = config.email_admin_report_subject or '📊 Rapport journalier - {date}'
        html_template = config.email_admin_report_template
        
        if not html_template:
            logger.error("Email template for admin report not found in config")
            return False
        
        # Générer les lignes du tableau des agents
        agents_summary_rows = ""
        for agent in report_data.get('agents_summary', []):
            agents_summary_rows += f"""
            <tr>
                <td><strong>{agent['name']}</strong></td>
                <td>{agent['email']}</td>
                <td style="text-align: center; font-weight: bold;">{agent['delayed_count']}</td>
            </tr>
            """
        
        # Générer les lignes du tableau des tickets
        tickets_rows = ""
        for ticket in report_data.get('delayed_tickets', []):
            tickets_rows += f"""
            <tr>
                <td><strong>{ticket['reference']}</strong></td>
                <td>{ticket.get('agent_name', 'N/A')}</td>
                <td>{ticket['student_name']}</td>
                <td style="color: #f44336; font-weight: bold;">{ticket['days_late']} jour(s)</td>
                <td>{ticket['started_at']}</td>
            </tr>
            """
        
        # Rendre le sujet
        report_date = datetime.now().strftime('%d/%m/%Y')
        subject = subject_template.format(date=report_date)
        
        # Rendre le template HTML
        html_body = EmailService._render_template(
            html_template,
            admin_name=admin_name,
            report_date=report_date,
            total_delayed=report_data.get('total_delayed', 0),
            agents_with_delays=report_data.get('agents_with_delays', 0),
            agents_summary_rows=agents_summary_rows,
            tickets_rows=tickets_rows
        )
        
        return EmailService.send_email(admin_email, subject, html_body)
    
    @staticmethod
    def test_email_configuration():
        """
        Tester la configuration email en envoyant un email de test
        """
        config = EmailService._get_config()
        
        if not config.alerts_email:
            logger.error("No alerts email configured")
            return False
        
        test_html = """
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>✅ Test de Configuration Email</h2>
            <p>Ce message confirme que la configuration email fonctionne correctement.</p>
            <p><strong>Date:</strong> {current_year}</p>
            <p><strong>Application:</strong> DiplomTrack</p>
        </body>
        </html>
        """
        
        html_body = EmailService._render_template(test_html)
        
        return EmailService.send_email(
            config.alerts_email,
            "✅ Test de Configuration Email - DiplomTrack",
            html_body
        )
