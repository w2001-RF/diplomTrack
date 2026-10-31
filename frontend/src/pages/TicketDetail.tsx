import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTicketQuery } from '@/hooks/api/useTicketsQuery';
import { useDocumentsQuery } from '@/hooks/api/useDocumentsQuery';
import { useMilestonesQuery, useMilestoneHistoryQuery } from '@/hooks/api/useMilestonesQuery';
import { useApiCache, CACHE_KEYS } from '@/hooks/api/useApiCache';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { 
  ArrowLeft, 
  Upload, 
  FileText, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertTriangle,
  Loader2,
  Download,
  Eye,
  History,
  ArrowRight,
  User
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { Database } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';

import { UserRole } from '@/constants/roles';

type TicketStatus = Database['public']['Enums']['ticket_status'];
type DocumentType = Database['public']['Enums']['document_type'];
type DocumentStatus = Database['public']['Enums']['document_status'];

const statusLabels: Record<TicketStatus, string> = {
  CREATED: 'Créé',
  ATTENTE_CORRECTION_DOCS: 'En attente de correction',
  DOCS_CORRIGES_SOUMIS: 'Documents corrigés soumis',
  ATTENTE_DIPLOME: 'En attente du diplôme',
  DIPLOME_DEPOSE: 'Diplôme déposé',
  DIPLOME_ENVOYE_CENTRE: 'Diplôme envoyé au centre',
  VALIDATION_CENTRE_RECUE: 'Validation du centre reçue',
  DOSSIER_EN_COURS: 'Dossier en cours',
  PIECES_COMPLETES: 'Pièces complètes',
  EN_ATTENTE_REPONSE: 'En attente de réponse',
  REPONSE_RECUE: 'Réponse reçue',
  DOSSIER_CLOTURE: 'Dossier clôturé',
  BLOQUE_PIECE_MANQUANTE: 'Bloqué - pièce manquante',
  REJETE: 'Rejeté',
  ARCHIVE: 'Archivé'
};

const documentTypeLabels: Record<DocumentType, string> = {
  BAC: 'Baccalauréat',
  BAC_PLUS_2: 'BAC+2',
  BAC_PLUS_3: 'BAC+3',
  CIN: 'Carte d\'identité nationale',
  CONTRAT: 'Contrat',
  RECU_PAIEMENT: 'Reçu de paiement',
  RETOUR_CFC: 'Retour CFC',
  PV_DIPLOME: 'PV Diplôme',
  ATTESTATION_INSC: 'Attestation d\'inscription'
};

const CORRECTION_WORKFLOW_MILESTONES = [
  'ATTENTE_CORRECTION_DOCS',
  'DOCS_CORRIGES_SOUMIS'
];

const ATTESTATION_WORKFLOW_MILESTONES = [
  'ATTENTE_DIPLOME',
  'DIPLOME_DEPOSE',
  'DIPLOME_ENVOYE_CENTRE',
  'VALIDATION_CENTRE_RECUE'
];

const AUTO_VALIDATED_DOCUMENTS = ['BAC', 'CIN', 'CONTRAT', 'RECU_PAIEMENT', 'ATTESTATION_INSC', 'BAC_PLUS_2', 'BAC_PLUS_3'];

type DiplomaValidationType = 'DIPLOMA' | 'ATTESTATION';

const getStatusColor = (status: TicketStatus) => {
  switch (status) {
    case 'DOSSIER_CLOTURE':
      return 'bg-[hsl(var(--status-validated))]';
    case 'REJETE':
      return 'bg-[hsl(var(--status-rejected))]';
    case 'BLOQUE_PIECE_MANQUANTE':
      return 'bg-[hsl(var(--status-blocked))]';
    case 'ATTENTE_CORRECTION_DOCS':
      return 'bg-[hsl(var(--status-blocked))]';
    case 'CREATED':
      return 'bg-[hsl(var(--status-in-progress))]';
    case 'EN_ATTENTE_REPONSE':
      return 'bg-[hsl(var(--status-in-pending))]';
    case 'ATTENTE_DIPLOME':
      return 'bg-[hsl(var(--status-pending))]';
    case 'DOCS_CORRIGES_SOUMIS':
      return 'bg-[hsl(var(--status-in-progress))]';
    case 'DIPLOME_DEPOSE':
    case 'DIPLOME_ENVOYE_CENTRE':
      return 'bg-[hsl(var(--status-in-progress))]';
    case 'VALIDATION_CENTRE_RECUE':
      return 'bg-[hsl(var(--status-in-progress))]';
    case 'DOSSIER_EN_COURS':
      return 'bg-[hsl(var(--status-in-progress))]';
    case 'PIECES_COMPLETES':
      return 'bg-[hsl(var(--status-in-progress))]';
    case 'REPONSE_RECUE':
      return 'bg-[hsl(var(--status-in-progress))]';
    default:
      return 'bg-[hsl(var(--status-in-progress))]';
  }
};

const getStatusIcon = (status: TicketStatus) => {
  switch (status) {
    case 'DOSSIER_CLOTURE':
    case 'VALIDATION_CENTRE_RECUE':
      return <CheckCircle2 className="h-4 w-4" />;
    case 'REJETE':
      return <XCircle className="h-4 w-4" />;
    case 'BLOQUE_PIECE_MANQUANTE':
      return <AlertTriangle className="h-4 w-4" />;
    case 'ATTENTE_CORRECTION_DOCS':
      return <AlertTriangle className="h-4 w-4" />;
    case 'ATTENTE_DIPLOME':
      return <Clock className="h-4 w-4" />;
    case 'DOCS_CORRIGES_SOUMIS':
      return <Clock className="h-4 w-4" />;
    default:
      return <Clock className="h-4 w-4" />;
  }
};

const getDocStatusColor = (is_validated: boolean | null) => {
  switch (is_validated) {
    case true:
      return 'bg-[hsl(var(--status-validated))]';
    case false:
      return 'bg-[hsl(var(--status-pending))]';
    default:
      return 'bg-[hsl(var(--status-pending))]';
  }
};

const getDocStatusLabel = (is_validated: boolean | null) => {
  switch (is_validated) {
    case true:
      return 'Validé';
    case false:
      return 'En attente';
    default:
      return 'En attente';
  }
};

export default function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { invalidateCache } = useApiCache();
  const [isUpdatingDiplomaType, setIsUpdatingDiplomaType] = useState(false);
  
  // Use React Query hooks
  const { data: ticketData, isLoading: isTicketLoading, error: ticketError } = useTicketQuery(id);
  const { documents: documentsList, loading: isDocumentsLoading, isRefetching, refetch, uploadDocument, validateDocument, inValidateDocument, isUploading: isDocumentUploading, isValidating: isDocumentValidating, isInValidating: isDocumentInValidating } = useDocumentsQuery({ ticketId: id });
  const { chronologies: chronologiesList, loading: isChronologiesLoading, getMilestoneByCode } = useMilestonesQuery();
  const { data: milestoneHistory = [], isLoading: isMilestoneHistoryLoading } = useMilestoneHistoryQuery(id);

  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [validateDialogOpen, setValidateDialogOpen] = useState(false);
  const [inValidateDialogOpen, setInValidateDialogOpen] = useState(false);
  const [comment, setComment] = useState('');
  const [milestoneChangeDate, setMilestoneChangeDate] = useState<string>('');
  const [milestoneDateOnly, setMilestoneDateOnly] = useState<string>(''); // "YYYY-MM-DD"
  const [milestoneTimeOnly, setMilestoneTimeOnly] = useState<string>(''); // "HH:mm"

  // Helper : ISO <-> date/time
  const pad = (n: number) => String(n).padStart(2, '0');

  const isoToDateAndTime = (iso?: string) => {
    if (!iso) return { date: '', time: '' };
    const d = new Date(iso);
    const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`; // HH:mm (24h)
    return { date, time };
  };

  const dateAndTimeToIso = (date: string, time: string) => {
    if (!date) return '';
    // create local Date from "YYYY-MM-DD" and "HH:mm"
    const dt = time ? `${date}T${time}` : `${date}T00:00`;
    const d = new Date(dt); // interpreted as local
    return d.toISOString();
  };
  const [milestoneComment, setMilestoneComment] = useState('');

  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [changingMilestone, setChangingMilestone] = useState(false);
  const [milestoneNotes, setMilestoneNotes] = useState('');
  
  const [uploadForm, setUploadForm] = useState({
    type: '' as DocumentType | '',
    file: null as File | null
  });

  const getCurrentMilestone = () => {
    if (!ticket) return null;
    return ticket?.current_milestone;
  };
  
  const ticket = ticketData;
  const student = ticket?.student;
  const documents = documentsList.sort((a, b) => a.id - b.id) || [];
  const currentMilestone = getCurrentMilestone();
  const currentMilestoneOrder = currentMilestone?.order || 0;

  const documentValidated = documents.filter(d => d.is_validated === true).length;
  const documentNotValidated = documents.filter(d => d.is_validated === false).length;

  const hasInvalidatedAutoValidatedDocs = documents.some(doc => 
    AUTO_VALIDATED_DOCUMENTS.includes(doc.document_type) && doc.is_validated === false
  );

  const [diplomaValidationType, setDiplomaValidationType] = useState<DiplomaValidationType>(
    ticket?.diploma_validation_type
  );
  console.log(diplomaValidationType);

  const chronologies = (ticket?.chronologies || []).filter(chrono => {
    const milestoneCode = chrono.milestone.code;
    
    // ✅ Filtrer les milestones de correction
    if (CORRECTION_WORKFLOW_MILESTONES.includes(milestoneCode)) {
      // Afficher seulement si des docs auto-validés ont été invalidés OU si on est déjà dans ce workflow
      const isInCorrectionWorkflow = currentMilestone && CORRECTION_WORKFLOW_MILESTONES.includes(currentMilestone.code);
      if (!hasInvalidatedAutoValidatedDocs && !isInCorrectionWorkflow) return false;
    }
    
    // ✅ Filtrer les milestones ATTESTATION
    if (ATTESTATION_WORKFLOW_MILESTONES.includes(milestoneCode)) {
      // Afficher seulement si le type est ATTESTATION OU si on est déjà dans ce workflow
      const isInAttestationWorkflow = currentMilestone && ATTESTATION_WORKFLOW_MILESTONES.includes(currentMilestone.code);
      if (diplomaValidationType !== 'ATTESTATION' && !isInAttestationWorkflow) return false;
    }
    
    return true;
  });
  const isStudent = role === UserRole.STUDENT;
  const canValidate = role === UserRole.AGENT;

  const formationType = student?.formation?.formation_type?.code;
  const diplomaDocType = formationType === 'MUS' ? 'BAC_PLUS_3' : 'BAC_PLUS_2';
  const diplomaDoc = documents.find(d => d.document_type === diplomaDocType);
  
  useEffect(() => {
    if (milestoneChangeDate) {
      const { date, time } = isoToDateAndTime(milestoneChangeDate);
      setMilestoneDateOnly(date);
      setMilestoneTimeOnly(time);
    } else {
      setMilestoneDateOnly('');
      setMilestoneTimeOnly('');
    }
  }, [milestoneChangeDate]);

  // État de chargement global
  const isLoading = isTicketLoading || isMilestoneHistoryLoading || isDocumentsLoading || isChronologiesLoading;

  // État de chargement spécifique pour les actions
  const isAnyActionPending = isDocumentUploading || isDocumentValidating || isDocumentInValidating || changingMilestone;

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const handleUploadDocument = async () => {
    if (!uploadForm.type || !uploadForm.file || !ticket) return;

    try {
      await uploadDocument({
        ticket_id: ticket.id,
        type: uploadForm.type,
        file_name: uploadForm.file.name,
        file_url: `placeholder://${uploadForm.file.name}`
      });
      setUploadDialogOpen(false);
      setUploadForm({ type: '', file: null });
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleValidateDocument = async () => {
    if (!selectedDocId) return;

    try {
      await validateDocument(selectedDocId, comment || undefined);
      setValidateDialogOpen(false);
      setSelectedDocId(null);
      setComment('');
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleInvalidateDocument = async () => {
    if (!selectedDocId || !comment) return;

    try {
      const selectedDoc = documents.find(d => d.id === selectedDocId);
      const AUTO_VALIDATED_DOCUMENTS = ['BAC', 'CIN', 'CONTRAT', 'RECU_PAIEMENT', 'ATTESTATION_INSC', 'BAC_PLUS_2', 'BAC_PLUS_3'];
      const isAutoValidatedDoc = selectedDoc && AUTO_VALIDATED_DOCUMENTS.includes(selectedDoc.document_type);
      
      await inValidateDocument(selectedDocId, comment);
      
      //Message différent si document auto-validé
      if (isAutoValidatedDoc) {
        toast.warning(
          'Document invalidé. Le dossier a été transféré en attente de correction.',
          { duration: 5000 }
        );
      } else {
        toast.success('Document invalidé avec succès');
      }
      
      setInValidateDialogOpen(false);
      setSelectedDocId(null);
      setComment('');
      
      //Invalider les caches pour rafraîchir
      invalidateCache('TICKETS');
      invalidateCache([CACHE_KEYS.MILESTONES, 'history', id]);
      
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de l\'invalidation');
    }
  };

  const handleUpdateTicketMilestone = async (newMilestone: string) => {
    if (!ticket || !user) return;

    setChangingMilestone(true);
    try {
      const toMilestone = getMilestoneByCode(newMilestone);

      const { data, error } = await api.data.customRequest<{data: any, error: any}>(
        `tickets/${ticket.id}/transition`,
        {
          method: 'PATCH',
          body: { 
            next_state: toMilestone.code,
            changed_at: milestoneChangeDate || undefined,
            comment: milestoneComment || undefined
          }
        }
      );
      console.log(data, error);
      if (error) throw new Error(error.message);

      // Si on arrive à VALIDATION_CENTRE_RECUE, changer automatiquement en DIPLOMA
      if (newMilestone === 'VALIDATION_CENTRE_RECUE' && diplomaValidationType === 'ATTESTATION') {
        try {
          await handleUpdateDiplomaValidationType('DIPLOMA');
          toast.success(
            'Validation du centre reçue. Le type de validation a été changé en Diplôme.',
            { duration: 5000 }
          );
        } catch (err: any) {
          toast.warning('Milestone mis à jour mais erreur lors du changement de type de validation');
        }
      } else {
        toast.success('Milestone est modifiée avec succès');
      }

      setMilestoneChangeDate('');
      setMilestoneDateOnly('');
      setMilestoneTimeOnly('');
      setMilestoneComment('');
      setMilestoneNotes('');
      
      // Invalidate caches to refetch
      invalidateCache('TICKETS');
      invalidateCache([CACHE_KEYS.MILESTONES, 'history', id]);
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la mise à jour');
    } finally {
      setChangingMilestone(false);
    }
  };

  const handleUpdateDiplomaValidationType = async (newType: DiplomaValidationType) => {
    if (!ticket || !user) return;

    setIsUpdatingDiplomaType(true);
    try {
      const { data, error } = await api.data.customRequest<{
        message: string; 
        ticket: any; 
      }>(
        `tickets/${ticket.id}/diploma-validation-type`,
        {
          method: 'PATCH',
          body: { validation_type: newType }
        }
      );

      if (error) throw new Error(error.message);

      setDiplomaValidationType(newType);
    
      //Transition automatique vers DOSSIER_EN_COURS si DIPLOMA
      if (newType === 'DIPLOMA') {
        const currentMilestoneCode = data?.ticket?.current_milestone?.code;
        const ATTESTATION_MILESTONES = ['ATTENTE_DIPLOME', 'DIPLOME_DEPOSE', 'DIPLOME_ENVOYE_CENTRE', 'VALIDATION_CENTRE_RECUE'];
        
        // Si on est dans un milestone ATTESTATION, retourner à CREATED
        if (ATTESTATION_MILESTONES.includes(currentMilestoneCode)) {
          try {
            await handleUpdateTicketMilestone('DOSSIER_EN_COURS');
            toast.success(
              'Type de validation changé en Diplôme. Le dossier a été réinitialisé.',
              { duration: 5000 }
            );
          } catch (err: any) {
            toast.error('Erreur lors de la réinitialisation du dossier');
          }
        } else {
          toast.success('Type de validation changé en Diplôme');
        }
      } else if (newType === 'ATTESTATION' && data?.ticket?.current_milestone?.code === 'ATTENTE_DIPLOME') {
        toast.success(
          'Type de validation changé en Attestation. Le dossier a été transféré en attente de diplôme.',
          { duration: 5000 }
        );
      } else {
        toast.success(`Type de validation changé en ${newType === 'DIPLOMA' ? 'Diplôme' : 'Attestation'}`);
      }
      
      
      // Invalidate cache
      invalidateCache('TICKETS');
      invalidateCache([CACHE_KEYS.MILESTONES, 'history', id]);
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la mise à jour');
    } finally {
      setIsUpdatingDiplomaType(false);
    }
  };

  if (ticketError || !ticket || !student) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-64">
          <p className="text-muted-foreground">Dossier non trouvé</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>
            Retour
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">{ticket.reference}</h1>
              <Badge className={`${getStatusColor(currentMilestone.code)} text-primary-foreground`}>
                {getStatusIcon(currentMilestone.code)}
                <span className="ml-1">{statusLabels[currentMilestone.label]}</span>
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Créé le {new Date(ticket.created_at).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              })}
            </p>
          </div>
          
          {canValidate && (
            <div className="flex gap-2 items-end">
              {/* Date de changement */}
              <div className="flex flex-col gap-1">
                <Label htmlFor="milestone-date" className="text-xs">
                  Date de changement
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="milestone-date"
                    type="date"
                    value={milestoneDateOnly}
                    onChange={(e) => {
                      const newDate = e.target.value; // "YYYY-MM-DD"
                      setMilestoneDateOnly(newDate);
                      // mettre à jour milestoneChangeDate (ISO)
                      setMilestoneChangeDate(dateAndTimeToIso(newDate, milestoneTimeOnly));
                    }}
                    className="w-[160px]" 
                  />

                  <Input
                    id="milestone-time"
                    type="time"
                    step={60} // minute precision
                    value={milestoneTimeOnly}
                    onChange={(e) => {
                      const newTime = e.target.value; // "HH:mm"
                      setMilestoneTimeOnly(newTime);
                      setMilestoneChangeDate(dateAndTimeToIso(milestoneDateOnly, newTime));
                    }}
                    className="w-[120px]"
                  />
                </div>
              </div>
              
              {/* Commentaire */}
              <div className="flex flex-col gap-1">
                <Label htmlFor="milestone-comment" className="text-xs">
                  Commentaire
                </Label>
                <Input
                  id="milestone-comment"
                  type="text"
                  placeholder="Commentaire optionnel..."
                  value={milestoneComment}
                  onChange={(e) => setMilestoneComment(e.target.value)}
                  className="w-[250px]"
                />
              </div>
              
              {/* Select de milestone */}
              <Select
                value={currentMilestone.code}
                onValueChange={(value: string) => handleUpdateTicketMilestone(value)}
                disabled={changingMilestone}
              >
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Changer le jalon" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(statusLabels)
                  .filter(([value, label]) => {
                    // ✅ Filtrer les milestones de correction
                    if (CORRECTION_WORKFLOW_MILESTONES.includes(value)) {
                      const isInCorrectionWorkflow = currentMilestone && CORRECTION_WORKFLOW_MILESTONES.includes(currentMilestone.code);
                      if (!hasInvalidatedAutoValidatedDocs && !isInCorrectionWorkflow) return false;
                    }
                    
                    // ✅ Filtrer les milestones ATTESTATION
                    if (ATTESTATION_WORKFLOW_MILESTONES.includes(value)) {
                      const isInAttestationWorkflow = currentMilestone && ATTESTATION_WORKFLOW_MILESTONES.includes(currentMilestone.code);
                      if (diplomaValidationType !== 'ATTESTATION' && !isInAttestationWorkflow) return false;
                    }
                    
                    return true;
                  })
                  .map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Student Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Informations de l'étudiant</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Nom complet</p>
                    <p className="font-medium">{student.first_name} {student.last_name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Numero Apogee</p>
                    <p className="font-medium">{student.num_apogee}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Email</p>
                    <p className="font-medium">{student.email}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Formation <strong>({student?.formation?.formation_type?.code})</strong></p>
                    <p className="font-medium">{student?.formation?.formation_name} ({student?.formation?.formation_type?.label})</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Année universitaire</p>
                    <p className="font-medium">{student.academic_year}</p>
                  </div>
                  {student?.formation?.professor_responsible && (
                    <div className="col-span-2">
                      <p className="text-muted-foreground">Professeur responsable</p>
                      <p className="font-medium"><span className="font-normal">Nom Complet: </span>{student?.formation?.professor_responsible?.first_name} {student?.formation?.professor_responsible?.last_name}</p>
                      <p className="font-medium"><span className="font-normal">Email: </span>{student?.formation?.professor_responsible?.email} </p>
                      <p className="font-medium"><span className="font-normal">Telephone: </span>{student?.formation?.professor_responsible?.phone} </p>
                      <p className="font-medium"><span className="font-normal">Departement: </span>{student?.formation?.professor_responsible?.departement?.name} </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Documents */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Documents</CardTitle>
                  <CardDescription>
                    {documents.length} document{documents.length > 1 ? 's' : ''} téléversé{documents.length > 1 ? 's' : ''}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                {canValidate && documents.some(d => d.is_validated === false) && (
                  <div className="mt-2 p-3 bg-[hsl(var(--status-blocked))]/10 border border-[hsl(var(--status-blocked))]/30 rounded-lg">
                    <div className="flex items-center gap-2 text-sm">
                      <AlertTriangle className="h-4 w-4 text-[hsl(var(--status-blocked))]" />
                      <span className="font-medium text-[hsl(var(--status-blocked))]">
                        {documents.filter(d => d.is_validated === false).length} document(s) en attente de validation
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 ml-6">
                      Ces documents doivent être validés avant de pouvoir progresser
                    </p>
                  </div>
                )}
                {documents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Aucun document téléversé</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {documents.map((doc, index) => (
                      <div 
                        key={doc.id}
                        className={cn(
                          "flex items-center justify-between p-4 rounded-lg border bg-card animate-fade-in",
                          doc.is_validated && "border-[hsl(var(--status-validated))]/30",
                          doc.is_validated === false && "border-[hsl(var(--status-pending))]/30"
                        )}
                        style={{ animationDelay: `${index * 0.05}s` }}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "flex items-center justify-center w-10 h-10 rounded-lg",
                            doc.is_validated && "bg-[hsl(var(--status-validated))]/10",
                            doc.is_validated === false && "bg-[hsl(var(--status-pending))]/10"
                          )}>
                            <FileText className={cn(
                              "h-5 w-5",
                              doc.is_validated && "text-[hsl(var(--status-validated))]",
                              doc.is_validated === false && "text-[hsl(var(--status-pending))]"
                            )} />
                          </div>
                          <div>
                            <p className="font-medium">
                              {doc.document_type === 'BAC+2' 
                                ? documentTypeLabels['BAC_PLUS_2']
                                : doc.document_type === 'BAC+3'
                                ? documentTypeLabels['BAC_PLUS_3']
                                : documentTypeLabels[doc.document_type]
                              }
                            </p>
                            <p className="text-xs text-muted-foreground">{doc.file_path}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <Badge className={`${getDocStatusColor(doc.is_validated)} text-primary-foreground`}>
                            {getDocStatusLabel(doc.is_validated)}
                          </Badge>

                          {doc.file_path && (
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <Eye className="h-4 w-4" />
                              </Button>
                              {doc.is_validated && (
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <Download className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          )}

                          {/* ✅ Switch pour diplôme validé */}
                          {canValidate && (doc.document_type === 'BAC+2' || doc.document_type === 'BAC+3') && doc.is_validated === true && (
                            <div className="flex items-center gap-2 border-l border-border pl-3">
                              <Label 
                                htmlFor={`diploma-type-${doc.id}`} 
                                className="text-xs text-muted-foreground cursor-pointer whitespace-nowrap"
                              >
                                {diplomaValidationType === 'ATTESTATION' ? 'Attestation' : 'Diplôme'}
                              </Label>
                              <Switch
                                id={`diploma-type-${doc.id}`}
                                checked={diplomaValidationType === 'ATTESTATION'}
                                onCheckedChange={(checked) => {
                                  handleUpdateDiplomaValidationType(checked ? 'ATTESTATION' : 'DIPLOMA');
                                }}
                                disabled={isUpdatingDiplomaType}
                              />
                            </div>
                          )}

                          {/* ✅ Boutons de validation/invalidation */}
                          {canValidate && (
                            <div className="flex items-center gap-1 border-l border-border pl-3">
                              {doc.is_validated === false && (
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  className="text-[hsl(var(--status-validated))] hover:bg-[hsl(var(--status-validated))]/10"
                                  onClick={() => {
                                    setSelectedDocId(doc.id);
                                    setValidateDialogOpen(true);
                                  }}
                                  disabled={isDocumentValidating}
                                >
                                  {isDocumentValidating ? (
                                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                  ) : (
                                    <CheckCircle2 className="h-4 w-4 mr-1" />
                                  )}
                                  Valider
                                </Button>
                              )}
                              {doc.is_validated === true && (
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  className="text-[hsl(var(--status-rejected))] hover:bg-[hsl(var(--status-rejected))]/10"
                                  onClick={() => {
                                    setSelectedDocId(doc.id);
                                    setInValidateDialogOpen(true);
                                  }}
                                  disabled={isDocumentInValidating}
                                >
                                  <XCircle className="h-4 w-4 mr-1" />
                                  Invalider
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* ✅ Dialog de validation */}
                <Dialog open={validateDialogOpen} onOpenChange={setValidateDialogOpen}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Valider le document</DialogTitle>
                      <DialogDescription>
                        Ajoutez un commentaire optionnel pour la validation.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label>Commentaire (optionnel)</Label>
                        <Textarea
                          value={comment}
                          onChange={(e) => setComment(e.target.value)}
                          placeholder="Ex: Document conforme, toutes les informations sont présentes..."
                          rows={3}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          onClick={handleValidateDocument}
                          className="flex-1"
                          disabled={isDocumentValidating}
                        >
                          {isDocumentValidating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Confirmer la validation
                        </Button>
                        <Button 
                          onClick={() => {
                            setValidateDialogOpen(false);
                            setSelectedDocId(null);
                            setComment('');
                          }}
                          variant="outline"
                          className="flex-1"
                        >
                          Annuler
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>

                {/* Invalidation dialog */}
                <Dialog open={inValidateDialogOpen} onOpenChange={setInValidateDialogOpen}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Invalider le document</DialogTitle>
                      <DialogDescription>
                        Indiquez la raison de l'invalidation. L'étudiant sera notifié.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label>Raison de l'invalidation</Label>
                        <Textarea
                          value={comment}
                          onChange={(e) => setComment(e.target.value)}
                          placeholder="Ex: Document illisible, informations manquantes..."
                          rows={3}
                        />
                      </div>
                      <Button 
                        onClick={handleInvalidateDocument}
                        className="w-full"
                        variant="destructive"
                        disabled={!comment || isDocumentInValidating}
                      >
                        {isDocumentInValidating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Confirmer l'invalidation
                      </Button>
                      <Button 
                        onClick={() => {
                          setInvalidateDialogOpen(false);
                          setSelectedDocId(null);
                          setComment('');
                        }}
                        variant="outline"
                        className="flex-1"
                      >
                        Annuler
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>

            {canValidate && 
              currentMilestone?.code === 'ATTENTE_CORRECTION_DOCS' && 
              documents.every(d => d.is_validated !== false || d.file_path) && (
                <div className="mt-4 p-4 bg-primary/5 border border-primary/20 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-foreground">Documents corrigés prêts ?</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Une fois que vous avez téléversé tous les documents corrigés, soumettez-les pour validation
                      </p>
                    </div>
                    <Button
                      onClick={async () => {
                        try {
                          const { error } = await api.data.customRequest(
                            `tickets/${ticket.id}/submit-corrected-documents`,
                            { method: 'POST' }
                          );
                          
                          if (error) throw new Error(error.message);
                          
                          toast.success('Documents corrigés soumis avec succès');
                          invalidateCache('TICKETS');
                        } catch (error: any) {
                          toast.error(error.message || 'Erreur lors de la soumission');
                        }
                      }}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Soumettre les documents
                    </Button>
                  </div>
                </div>
              )}
          </div>

          {/* Sidebar - Timeline */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Progression du dossier</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
                  
                  {/* Milestones */}
                  <div className="space-y-4">
                    {chronologies
                    .sort((a, b) => {
                      // D'abord trier par ordre
                      const orderDiff = a.milestone.order - b.milestone.order;
                      if (orderDiff !== 0) return orderDiff;
                      
                      // Si même ordre, trier par date (plus récent d'abord)
                      return new Date(b.started_at || 0).getTime() - new Date(a.started_at || 0).getTime();
                    })
                    .map((chrono, index) => {
                      const milestone = chrono.milestone;
                      const isCompleted = milestone.order < currentMilestoneOrder;
                      const isCurrent = milestone.order === currentMilestoneOrder;
                      const isPending = milestone.order > currentMilestoneOrder;
                      const isBlocked = ticket.status === 'BLOQUE_PIECE_MANQUANTE';
                      const isisMilestoneHistoryLoading = ticket.status === 'REJETE';

                      return (
                        <div
                          key={chrono.id}
                          className={cn(
                            "relative flex items-start gap-4 pl-0",
                            index === chronologies.length - 1 && "pb-0"
                          )}
                        >
                          {/* Status icon */}
                          <div
                            className={cn(
                              "relative z-10 flex items-center justify-center w-8 h-8 rounded-full transition-all duration-300",
                              isCompleted && "bg-[hsl(var(--status-validated))] text-primary-foreground",
                              isCurrent && !isBlocked && !isisMilestoneHistoryLoading && "bg-[hsl(var(--status-in-progress))] text-primary-foreground animate-pulse",
                              isCurrent && isBlocked && "bg-[hsl(var(--status-blocked))] text-primary-foreground",
                              isCurrent && isisMilestoneHistoryLoading && "bg-[hsl(var(--status-isMilestoneHistoryLoading))] text-primary-foreground",
                              isPending && "bg-muted text-muted-foreground"
                            )}
                          >
                            {isCompleted ? (
                              <CheckCircle2 className="h-4 w-4" />
                            ) : isCurrent && (isBlocked || isisMilestoneHistoryLoading) ? (
                              <AlertTriangle className="h-4 w-4" />
                            ) : (
                              <Clock className="h-4 w-4" />
                            )}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0 pt-1">
                            <p
                              className={cn(
                                "text-sm font-medium",
                                (isCompleted || isCurrent) && "text-foreground",
                                isPending && "text-muted-foreground"
                              )}
                            >
                              {milestone.label}
                            </p>
                            {isCurrent && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {isBlocked ? 'Bloqué - Pièce manquante' : isisMilestoneHistoryLoading ? 'Rejeté' : 'En cours'}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Milestone History */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Historique des changements
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isMilestoneHistoryLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : milestoneHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Aucun changement enregistré
                  </p>
                ) : (
                  <div className="space-y-4">
                    {milestoneHistory.map((history, index) => {
                      const isDone = history.status === 'DONE';
                      const isInProgress = history.status === 'PENDING';
                        
                      return (
                        <div 
                          key={history.id} 
                          className={cn(
                            "border-l-2 pl-4 pb-4",
                            isDone && "border-green-500/30",
                            isInProgress && "border-blue-500/30",
                            index === milestoneHistory.length - 1 && "pb-0"
                          )}
                        >
                          {/* Transition */}
                          <div className="flex items-center gap-2 text-sm">
                            {history.from_milestone ? (
                              <>
                                <Badge variant="outline" className="text-xs">
                                  {history.from_milestone.label}
                                </Badge>
                                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                              </>
                            ) : (
                              <span className="text-xs text-muted-foreground">Création</span>
                            )}
                            <Badge className="bg-primary text-primary-foreground text-xs">
                              {history.to_milestone?.label || 'Inconnu'}
                            </Badge>
                            
                            {/* ✅ Badge de statut avec couleur */}
                            {isDone && (
                              <Badge variant="secondary" className="text-xs ml-auto bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Complété
                              </Badge>
                            )}
                            {isInProgress && (
                              <Badge variant="secondary" className="text-xs ml-auto bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
                                <Clock className="h-3 w-3 mr-1" />
                                En cours
                              </Badge>
                            )}
                          </div>

                          {/* Utilisateur */}
                          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                            <User className="h-3 w-3" />
                            <span>
                              {history.changed_by_profile?.full_name || history.changed_by_profile?.email || 'Utilisateur inconnu'}
                            </span>
                          </div>

                          {/* Date */}
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(history.changed_at).toLocaleDateString('fr-FR', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                          {history.notes && (
                            <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded">
                              <p className="text-xs font-medium text-blue-900 dark:text-blue-100 mb-1">
                                Commentaire:
                              </p>
                              <p className="text-xs text-blue-700 dark:text-blue-300">
                                {history.notes}
                              </p>
                              {history?.to_milestone?.code === 'ATTENTE_CORRECTION_DOCS' && (
                                <div className="mt-2">
                                  {(() => {
                                    // Trouver les documents invalidés autour de cette date
                                    const changeDate = new Date(history.changed_at);
                                    const invalidatedDocs = documents.filter(doc => {
                                      if (!doc.validation_comment || doc.is_validated !== false) return false;
                                      
                                      // Vérifier si le document a été invalidé dans un intervalle de temps proche
                                      // (par exemple, dans les 5 minutes avant/après le changement)
                                      const docDate = doc.validated_at ? new Date(doc.validated_at) : null;
                                      if (!docDate) return false;
                                      
                                      const timeDiff = Math.abs(changeDate.getTime() - docDate.getTime());
                                      return timeDiff < 5 * 60 * 1000; // 5 minutes
                                    });
                                    
                                    if (invalidatedDocs.length === 0) return null;
                                    
                                    return (
                                      <div className="space-y-2">
                                        <p className="text-xs font-medium text-orange-900 dark:text-orange-100">
                                          Documents invalidés:
                                        </p>
                                        {invalidatedDocs.map(doc => (
                                          <div 
                                            key={doc.id}
                                            className="p-2 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded"
                                          >
                                            <p className="text-xs font-medium text-orange-900 dark:text-orange-100">
                                              {documentTypeLabels[doc.document_type] || doc.document_type}
                                            </p>
                                            <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">
                                              Raison: {doc.validation_comment}
                                            </p>
                                          </div>
                                        ))}
                                      </div>
                                    );
                                  })()}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Résumé</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Documents</span>
                  <span className="font-medium">{documents.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Validés</span>
                  <span className="font-medium text-[hsl(var(--status-validated))]">
                    {documentValidated}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Non Validés</span>
                  <span className="font-medium text-[hsl(var(--status-isMilestoneHistoryLoading))]">
                    {documentNotValidated}
                  </span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Dernière mise à jour</span>
                  <span className="text-sm">
                    {ticket.updated_at 
                      ? new Date(ticket.updated_at).toLocaleDateString('fr-FR')
                      : new Date(ticket.created_at).toLocaleDateString('fr-FR')
                    }
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
