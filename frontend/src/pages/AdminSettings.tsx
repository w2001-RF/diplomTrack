import { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { EmailTemplateEditor } from '@/components/admin/EmailTemplateEditor';
import { Settings, Save, Loader2, Mail, Clock, FileText, Archive, Bell, Edit } from 'lucide-react';
import { useSettingsQuery } from '@/hooks/api/useSettingsQuery';

interface EmailTemplate {
  key: string;
  title: string;
  subjectKey: string;
  bodyKey: string;
  variables: string[];
  description: string;
}

// Configuration des templates (métadonnées)
const EMAIL_TEMPLATES_CONFIG: EmailTemplate[] = [
  {
    key: 'ticket_blocked',
    title: 'Notification - Dossier Bloqué (Étudiant)',
    subjectKey: 'email_ticket_blocked_subject',
    bodyKey: 'email_ticket_blocked_template',
    variables: ['student_name', 'ticket_reference', 'ticket_id', 'reason', 'frontend_url', 'current_year'],
    description: 'Email envoyé à l\'étudiant lorsque son ticket est bloqué'
  },
  {
    key: 'agent_delay',
    title: 'Alerte - Dossiers en Retard (Agent)',
    subjectKey: 'email_agent_delay_subject',
    bodyKey: 'email_agent_delay_template',
    variables: ['agent_name', 'count', 'tickets_rows', 'frontend_url', 'current_year'],
    description: 'Email envoyé à l\'agent pour les tickets dépassant le délai d\'avertissement'
  },
  {
    key: 'admin_report',
    title: 'Rapport Journalier (Admin)',
    subjectKey: 'email_admin_report_subject',
    bodyKey: 'email_admin_report_template',
    variables: ['admin_name', 'report_date', 'total_delayed', 'agents_with_delays', 'agents_summary_rows', 'tickets_rows', 'frontend_url', 'current_year'],
    description: 'Rapport journalier envoyé à l\'administrateur'
  }
];

const settingIcons: Record<string, React.ReactNode> = {
  warning_delay_days: <Clock className="h-5 w-5" />,
  alerts_email: <Mail className="h-5 w-5" />,
  notification_template_student: <FileText className="h-5 w-5" />,
  notification_template_agent: <FileText className="h-5 w-5" />,
  max_upload_size_mb: <FileText className="h-5 w-5" />,
  auto_archive_days: <Archive className="h-5 w-5" />,
  enable_email_notifications: <Bell className="h-5 w-5" />,
  email_check_interval_hours: <Clock className="h-5 w-5" />
};

const settingLabels: Record<string, string> = {
  warning_delay_days: 'Délai d\'alerte (jours)',
  alerts_email: 'Email des alertes',
  notification_template_student: 'Template notification étudiant',
  notification_template_agent: 'Template notification agent',
  max_upload_size_mb: 'Taille max. fichiers (MB)',
  auto_archive_days: 'Archivage auto (jours)',
  enable_email_notifications: 'Activer les notifications email',
  email_check_interval_hours: 'Intervalle de vérification (heures)'
};

export default function AdminSettings() {
  const { settings, loading, isSaving, updateMultipleSettings } = useSettingsQuery();
  const [editedValues, setEditedValues] = useState<Record<string, any>>({});
  const [activeTemplate, setActiveTemplate] = useState<EmailTemplate | null>(null);

  // ✅ Construire dynamiquement emailTemplates depuis settings
  const emailTemplates = useMemo(() => {
    if (!settings || settings.length === 0) return [];

    return EMAIL_TEMPLATES_CONFIG.map(config => {
      const subjectSetting = settings.find(s => s.key === config.subjectKey);
      const bodySetting = settings.find(s => s.key === config.bodyKey);

      return {
        ...config,
        subjectValue: subjectSetting?.value || '',
        bodyValue: bodySetting?.value || '',
        subjectId: subjectSetting?.id,
        bodyId: bodySetting?.id,
        hasSubject: !!subjectSetting?.value,
        hasBody: !!bodySetting?.value
      };
    });
  }, [settings]);

  // Initialize edited values when settings load
  if (Object.keys(editedValues).length === 0 && settings.length > 0) {
    const initialValues = settings.reduce((acc, s) => {
      if (s.key === 'enable_email_notifications') {
        return { ...acc, [s.key]: s.value === 'true' || s.value === true };
      }
      return { ...acc, [s.key]: s.value || '' };
    }, {});
    setEditedValues(initialValues);
  }

  const handleSaveSettings = async () => {
    const updates = settings
      .filter(s => {
        const currentValue = editedValues[s.key];
        const originalValue = s.value;
        
        if (s.key === 'enable_email_notifications') {
          return currentValue !== (originalValue === 'true' || originalValue === true);
        }
        
        return currentValue !== originalValue && s.key !== 'updated_at';
      })
      .map(s => {
        let value = editedValues[s.key];
        
        if (s.type === "integer") {
          value = parseInt(value, 10);
        } else if (s.key === 'enable_email_notifications') {
          value = Boolean(value);
        }
        
        return {
          id: s.id,
          data: { [s.key]: value }
        };
      });

    if (updates.length > 0) {
      await updateMultipleSettings(updates);
    }
  };

  const handleSaveTemplate = (subjectKey: string, bodyKey: string) => (subject: string, body: string) => {
    setEditedValues(prev => ({
      ...prev,
      [subjectKey]: subject,
      [bodyKey]: body
    }));
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Settings className="h-8 w-8" />
              Configuration
            </h1>
            <p className="text-muted-foreground mt-1">
              Paramètres globaux de l'application
            </p>
          </div>
          <Button onClick={handleSaveSettings} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Enregistrer
          </Button>
        </div>

        {/* Settings Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* General Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Paramètres généraux</CardTitle>
              <CardDescription>Configuration des délais et alertes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {settings
                .filter(s => 
                  !s.key.includes('template') && 
                  !s.key.includes('email_') && 
                  s.key !== 'updated_at' &&
                  s.key !== 'enable_email_notifications' &&
                  s.key !== 'email_check_interval_hours')
                .map(setting => (
                  <div key={setting.key} className="space-y-2">
                    <Label className="flex items-center gap-2">
                      {settingIcons[setting.key]}
                      {settingLabels[setting.key] || setting.key}
                    </Label>
                    <Input
                      type={setting.key.includes('email') ? 'email' : setting.type === 'integer' ? 'number' : 'text'}
                      value={editedValues[setting.key] || ''}
                      onChange={(e) => setEditedValues(prev => ({
                        ...prev,
                        [setting.key]: e.target.value
                      }))}
                    />
                    {setting.description && (
                      <p className="text-xs text-muted-foreground">{setting.description}</p>
                    )}
                  </div>
                ))}
            </CardContent>
          </Card>

          {/* Notification Templates */}
          <Card>
            <CardHeader>
              <CardTitle>Templates de notification</CardTitle>
              <CardDescription>
                Utilisez {'{nom}'}, {'{reference}'}, {'{status}'} comme variables
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {settings
                .filter(s => s.key === 'notification_template_student' || s.key === 'notification_template_agent')
                .map(setting => (
                  <div key={setting.key} className="space-y-2">
                    <Label className="flex items-center gap-2">
                      {settingIcons[setting.key]}
                      {settingLabels[setting.key] || setting.key}
                    </Label>
                    <Textarea
                      value={editedValues[setting.key] || ''}
                      onChange={(e) => setEditedValues(prev => ({
                        ...prev,
                        [setting.key]: e.target.value
                      }))}
                      rows={3}
                    />
                    {setting.description && (
                      <p className="text-xs text-muted-foreground">{setting.description}</p>
                    )}
                  </div>
                ))}
            </CardContent>
          </Card>
        </div>

        {/* Email Templates Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Templates d'emails HTML
            </CardTitle>
            <CardDescription>
              Personnalisez les emails envoyés automatiquement par le système
            </CardDescription>
          </CardHeader>
          <CardContent>
            {emailTemplates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Mail className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Aucun template d'email configuré</p>
              </div>
            ) : (
              <div className="space-y-4">
                {emailTemplates.map((template) => {
                  const subjectValue = editedValues[template.subjectKey] || 
                    settings.find(s => s.key === template.subjectKey)?.value || '';
                  const bodyValue = editedValues[template.bodyKey] || 
                    settings.find(s => s.key === template.bodyKey)?.value || '';

                  return (
                    <div
                      key={template.key}
                      className="border rounded-lg p-4 hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg mb-1">{template.title}</h3>
                          <p className="text-sm text-muted-foreground mb-3">
                            {template.description}
                          </p>
                          
                          {/* Subject Preview */}
                          <div className="mb-2">
                            <p className="text-xs font-medium text-muted-foreground mb-1">Sujet:</p>
                            <p className="text-sm bg-muted px-3 py-2 rounded">
                              {subjectValue || 'Non défini'}
                            </p>
                          </div>

                          {/* Variables */}
                          <div className="flex flex-wrap gap-1 mt-2">
                            {template.variables.map((variable) => (
                              <code
                                key={variable}
                                className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded"
                              >
                                {`{${variable}}`}
                              </code>
                            ))}
                          </div>
                        </div>

                        <div className="flex gap-2 ml-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setActiveTemplate(template)}
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Éditer
                          </Button>
                        </div>
                      </div>

                      {/* Template Status */}
                      <div className="mt-3 pt-3 border-t">
                        <div className="flex items-center gap-2 text-xs">
                          {bodyValue ? (
                            <>
                              <div className="h-2 w-2 rounded-full bg-green-500" />
                              <span className="text-muted-foreground">Template configuré</span>
                            </>
                          ) : (
                            <>
                              <div className="h-2 w-2 rounded-full bg-yellow-500" />
                              <span className="text-muted-foreground">Template non configuré</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
        {/* Email Notification Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Paramètres de notification email</CardTitle>
            <CardDescription>Configuration des emails automatiques</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Enable Email Notifications */}
            <div className="flex items-center justify-between space-x-2">
              <div className="flex items-center gap-2">
                {settingIcons['enable_email_notifications']}
                <Label htmlFor="enable_email_notifications" className="cursor-pointer">
                  {settingLabels['enable_email_notifications']}
                </Label>
              </div>
              <Switch
                id="enable_email_notifications"
                checked={editedValues['enable_email_notifications'] || false}
                onCheckedChange={(checked) => setEditedValues(prev => ({
                  ...prev,
                  enable_email_notifications: checked
                }))}
              />
            </div>
            {/* Email Check Interval */}
            {settings
              .filter(s => s.key === 'email_check_interval_hours')
              .map(setting => (
                <div key={setting.key} className="space-y-2">
                  <Label className="flex items-center gap-2">
                    {settingIcons[setting.key]}
                    {settingLabels[setting.key]}
                  </Label>
                  <Input
                    type="number"
                    min="1"
                    value={editedValues[setting.key] || ''}
                    onChange={(e) => setEditedValues(prev => ({
                      ...prev,
                      [setting.key]: e.target.value
                    }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Fréquence de vérification des tickets en retard
                  </p>
                </div>
              ))}
          </CardContent>
        </Card>

        {/* Last Updated Info */}
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">
              Dernière modification: {settings.length > 0 ? 
                new Date(settings.filter(s => s.key === 'updated_at')[0]?.value || '')
                  .toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })
                : '-'
              }
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Email Template Editor Dialog */}
      {activeTemplate && (
        <EmailTemplateEditor
          isOpen={!!activeTemplate}
          onClose={() => setActiveTemplate(null)}
          templateKey={activeTemplate.key}
          templateTitle={activeTemplate.title}
          subjectValue={editedValues[activeTemplate.subjectKey] || 
            settings.find(s => s.key === activeTemplate.subjectKey)?.value || ''}
          bodyValue={editedValues[activeTemplate.bodyKey] || 
            settings.find(s => s.key === activeTemplate.bodyKey)?.value || ''}
          onSave={handleSaveTemplate(activeTemplate.subjectKey, activeTemplate.bodyKey)}
          variables={activeTemplate.variables}
        />
      )}
    </DashboardLayout>
  );
}
