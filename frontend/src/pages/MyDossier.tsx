import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { milestoneCodeOf, STATUS_LABELS } from '@/lib/tickets';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Clock, CheckCircle, XCircle, AlertTriangle, Loader2, Edit2, Save, X, Bell } from 'lucide-react';
import type { StudentRow as Student, TicketRow as Ticket, MilestoneRow as Milestone, TicketStatus } from '@/lib/api/models';
import { FORMATIONS, PROFESSEURS, getAnneeUniversitaires } from '@/data/formations';
import { 
  useStudentByUserQuery
} from '@/hooks/api/useStudentsQuery';
import { useUpdateProfile } from '@/hooks/api/useProfilesQuery';
import { useTicketsQuery } from '@/hooks/api/useTicketsQuery';
import { useNotificationsQuery } from '@/hooks/api/useNotificationsQuery';
import { useMilestonesQuery } from '@/hooks/api/useMilestonesQuery';
import { useEffect, useState } from 'react';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  ticket_id: string | null;
  created_at: string;
}

const statusLabels = STATUS_LABELS;

const getStatusColor = (status: TicketStatus) => {
  switch (status) {
    case 'DOSSIER_CLOTURE':
      return 'bg-[hsl(var(--status-validated))]';
    case 'REJETE':
      return 'bg-[hsl(var(--status-rejected))]';
    case 'BLOQUE_PIECE_MANQUANTE':
      return 'bg-[hsl(var(--status-blocked))]';
    case 'CREATED':
    case 'EN_ATTENTE_REPONSE':
      return 'bg-[hsl(var(--status-pending))]';
    default:
      return 'bg-[hsl(var(--status-in-progress))]';
  }
};

const getStatusIcon = (status: TicketStatus) => {
  switch (status) {
    case 'DOSSIER_CLOTURE':
      return <CheckCircle className="h-4 w-4" />;
    case 'REJETE':
      return <XCircle className="h-4 w-4" />;
    case 'BLOQUE_PIECE_MANQUANTE':
      return <AlertTriangle className="h-4 w-4" />;
    default:
      return <Clock className="h-4 w-4" />;
  }
};

export default function MyDossier() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [editingContact, setEditingContact] = useState(false);
  const [contactForm, setContactForm] = useState({ email: '' });

  // Fetch student by user_id
  const studentQuery = useStudentByUserQuery(user?.id);
  const student = studentQuery.data;
  
  // Fetch tickets for the student  
  const ticketsQuery = useTicketsQuery({ enabled: !!student?.id });
  const tickets = ticketsQuery.tickets;

  // Fetch notifications for the user
  const notificationsQuery = useNotificationsQuery({ userId: user?.id, limit: 10 });
  const notificationsList = notificationsQuery.notifications;

  // Fetch milestones
  const milestonesQuery = useMilestonesQuery();
  const milestones = milestonesQuery.milestones;

  // Update profile mutation
  const updateProfileMutation = useUpdateProfile();

  // Determine loading state
  const isLoading = studentQuery.isLoading || milestonesQuery.loading;

  // Fill the contact form once the student record has loaded
  const studentEmail = student?.email ?? '';
  useEffect(() => {
    setContactForm({ email: studentEmail });
  }, [studentEmail]);

  const handleSaveContact = async () => {
    if (!student || !user) return;

    try {
      // A profile shares its id with the user; the student record id is another table's
      await updateProfileMutation.mutateAsync({
        profileId: String(user.id),
        data: {
          email: contactForm.email
        }
      });

      setEditingContact(false);
      toast.success('Informations de contact mises à jour');
    } catch (error) {
      console.error('Error updating contact:', error);
    }
  };

  const getCurrentMilestone = (ticket: Ticket) => {
    return milestones.find(m => m.code === milestoneCodeOf(ticket));
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    return `Il y a ${diffDays}j`;
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  // If no student profile exists, show a message
  if (!student) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Profil non trouvé</CardTitle>
              <CardDescription>
                Votre profil étudiant n'a pas encore été créé. Veuillez contacter l'administration.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Mon Dossier</h1>
          <p className="text-muted-foreground mt-1">
            Consultez vos informations et suivez l'avancement de votre demande
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Personal Info & Contact */}
          <div className="space-y-6">
            {/* Personal Info Card (Read-only) */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Informations personnelles</CardTitle>
                <CardDescription>Ces informations ne peuvent pas être modifiées</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Nom complet</p>
                  <p className="font-medium">{student.first_name} {student.last_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Numéro d'apogée</p>
                  <p className="font-medium">{student.num_apogee}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Formation</p>
                  <p className="font-medium">{student.formation.formation_name} ({student.formation.formation_type.code})</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Année universitaire</p>
                  <p className="font-medium">{student.academic_year}</p>
                </div>
                {student.formation.professor_responsible && (
                  <div>
                    <p className="text-sm text-muted-foreground">Professeur responsable</p>
                    {student.formation.professor_responsible.first_name && student.formation.professor_responsible.last_name && (
                      <p className="font-medium">{student.formation.professor_responsible.first_name} {student.formation.professor_responsible.last_name}</p>
                    )}
                    {student.formation.professor_responsible.email && (
                      <p className="font-medium">{student.formation.professor_responsible.email}</p>
                    )}
                    {student.formation.professor_responsible.phone && (
                      <p className="font-medium">{student.formation.professor_responsible.phone}</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Contact Info Card (Editable) */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Informations de contact</CardTitle>
                  <CardDescription>Vous pouvez modifier ces informations</CardDescription>
                </div>
                {!editingContact && (
                  <Button variant="outline" size="sm" onClick={() => setEditingContact(true)}>
                    <Edit2 className="h-4 w-4 mr-2" />
                    Modifier
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {editingContact ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={contactForm.email}
                        onChange={(e) => setContactForm(prev => ({ ...prev, email: e.target.value }))}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleSaveContact} disabled={updateProfileMutation.isPending} className="flex-1">
                        {updateProfileMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                        Enregistrer
                      </Button>
                      <Button variant="outline" onClick={() => {
                        setEditingContact(false);
                        setContactForm({ email: student.email || '' });
                      }}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Email</p>
                      <p className="font-medium">{student.email}</p>
                    </div>
                    {/* <div>
                      <p className="text-sm text-muted-foreground">Téléphone</p>
                      <p className="font-medium">{student.phone || 'Non renseigné'}</p>
                    </div> */}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Ticket & Notifications */}
          <div className="lg:col-span-2 space-y-6">
            {/* Ticket Timeline */}
            {tickets?.total > 0 ? (
              tickets.tickets.map((ticket) => {
                const currentMilestone = milestones.find(m => m.code === milestoneCodeOf(ticket));
                const ticketNotifications = notificationsList.filter(n => n.ticket_id === ticket.id);

                return (
                  <Card key={ticket.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-lg flex items-center gap-3">
                            {ticket.reference}
                            <Badge className={`${getStatusColor(milestoneCodeOf(ticket))} text-primary-foreground`}>
                              {getStatusIcon(milestoneCodeOf(ticket))}
                              <span className="ml-1">{statusLabels[milestoneCodeOf(ticket)]}</span>
                            </Badge>
                          </CardTitle>
                          <CardDescription>
                            Créé le {new Date(ticket.created_at).toLocaleDateString('fr-FR', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric'
                            })}
                          </CardDescription>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => navigate(`/dossier/${ticket.id}`)}>
                          Voir détails
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Progress Timeline */}
                      <div>
                        <h4 className="font-medium mb-4">Historique chronologique</h4>
                        <div className="relative">
                          {milestones.map((milestone, index) => {
                            const isCurrent = milestone.code === milestoneCodeOf(ticket);
                            const isPast = currentMilestone ? milestone.order < currentMilestone.order : false;
                            const isFuture = currentMilestone ? milestone.order > currentMilestone.order : true;

                            return (
                              <div key={milestone.id} className="flex gap-4 pb-4 last:pb-0">
                                <div className="relative flex flex-col items-center">
                                  <div className={`w-3 h-3 rounded-full border-2 ${
                                    isPast ? 'bg-primary border-primary' :
                                    isCurrent ? 'bg-primary border-primary ring-4 ring-primary/20' :
                                    'bg-background border-muted-foreground/30'
                                  }`} />
                                  {index < milestones.length - 1 && (
                                    <div className={`w-0.5 flex-1 mt-1 ${
                                      isPast ? 'bg-primary' : 'bg-muted-foreground/30'
                                    }`} />
                                  )}
                                </div>
                                <div className={`flex-1 pb-4 ${isFuture ? 'opacity-50' : ''}`}>
                                  <p className={`text-sm font-medium ${isCurrent ? 'text-primary' : 'text-foreground'}`}>
                                    {milestone.label}
                                  </p>
                                  {isCurrent && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      Étape actuelle
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Ticket Notifications */}
                      {ticketNotifications.length > 0 && (
                        <>
                          <Separator />
                          <div>
                            <h4 className="font-medium mb-4 flex items-center gap-2">
                              <Bell className="h-4 w-4" />
                              Notifications liées à ce ticket
                            </h4>
                            <div className="space-y-3">
                              {ticketNotifications.map((notification) => (
                                <div 
                                  key={notification.id}
                                  className={`p-3 rounded-lg border ${
                                    !notification.is_read ? 'bg-primary/5 border-primary/20' : 'bg-muted/50'
                                  }`}
                                >
                                  <div className="flex items-start justify-between">
                                    <div>
                                      <p className={`text-sm ${!notification.is_read ? 'font-semibold' : 'font-medium'}`}>
                                        {notification.title}
                                      </p>
                                      <p className="text-sm text-muted-foreground mt-0.5">
                                        {notification.message}
                                      </p>
                                    </div>
                                    {!notification.is_read && (
                                      <Badge variant="default" className="text-xs">Nouveau</Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-2">
                                    {formatTimeAgo(notification.created_at)}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground text-center">
                    Aucune demande de validation trouvée.
                  </p>
                  <p className="text-sm text-muted-foreground text-center mt-1">
                    Veuillez contacter l'administration pour plus d'informations.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
