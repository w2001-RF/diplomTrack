import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Search, User, X, Filter, Calendar, Clock, Plus, Trash, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useStudentsQuery, useMilestonesQuery, useTicketsQuery } from '@/hooks/api';
import { useFormationsQuery } from '@/hooks/api/useFormationsQuery';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

const FILTERS_CACHE_KEY = 'create_advanced_ticket_filters';

// Définition des workflows
const WORKFLOWS = {
  NORMAL: {
    id: 'normal',
    name: 'Workflow Normal',
    description: 'Processus standard de traitement de dossier',
    steps: [
      'CREATED', 
      'DOSSIER_EN_COURS', 
      'PIECES_COMPLETES', 
      'EN_ATTENTE_REPONSE', 
      'REPONSE_RECUE', 
      'DOSSIER_CLOTURE'
    ]
  },
  CORRECTION: {
    id: 'correction',
    name: 'Workflow Correction de Documents',
    description: 'Processus incluant une étape de correction de documents',
    steps: [
      'CREATED', 
      'ATTENTE_CORRECTION_DOCS', 
      'DOCS_CORRIGES_SOUMIS', 
      'DOSSIER_EN_COURS', 
      'PIECES_COMPLETES', 
      'EN_ATTENTE_REPONSE', 
      'REPONSE_RECUE', 
      'DOSSIER_CLOTURE'
    ]
  },
  ATTESTATION: {
    id: 'attestation',
    name: 'Workflow Attestation',
    description: 'Processus incluant la validation d\'une attestation',
    steps: [
      'CREATED', 
      'ATTENTE_DIPLOME', 
      'DIPLOME_DEPOSE', 
      'DIPLOME_ENVOYE_CENTRE', 
      'VALIDATION_CENTRE_RECUE', 
      'DOSSIER_EN_COURS', 
      'PIECES_COMPLETES', 
      'EN_ATTENTE_REPONSE', 
      'REPONSE_RECUE', 
      'DOSSIER_CLOTURE'
    ]
  }
};

export default function CreateAdvancedTicket() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [currentStep, setCurrentStep] = useState(1);
    const totalSteps = 4; // 1: Student, 2: Workflow, 3: Milestone, 4: Chronologies

        // Fonction pour passer à l'étape suivante
    const goToNextStep = () => {
        if (currentStep < totalSteps) {
            setCurrentStep(currentStep + 1);
        }
    };

    // Fonction pour revenir à l'étape précédente
    const goToPreviousStep = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
        }
    };
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [targetMilestone, setTargetMilestone] = useState('');
    const [chronologies, setChronologies] = useState([]);
    const [showFilters, setShowFilters] = useState(false);
    const [selectedWorkflow, setSelectedWorkflow] = useState(WORKFLOWS.NORMAL.id);
    const [filters, setFilters] = useState({
        formationType: 'ALL',
        formationId: 'ALL',
        professorId: 'ALL',
        academicYear: 'ALL'
    });

    const { students, loading: studentsLoading } = useStudentsQuery();
    const { milestones, loading: milestonesLoading } = useMilestonesQuery();
    const { createAdvancedTicket, isCreatingAdvanced } = useTicketsQuery();
    const { formations } = useFormationsQuery();

    useEffect(() => {
        if (user?.id) {
          try {
            localStorage.setItem(
              `${FILTERS_CACHE_KEY}_${user.id}`,
              JSON.stringify(filters)
            );
          } catch (error) {
            console.error('Error saving filters to cache:', error);
          }
        }
      }, [filters, user?.id]);
    
      // ✅ Professeurs uniques
      const uniqueProfessors = useMemo(() => {
        const profMap = new Map();
        formations.forEach(f => {
          if (f.professor_responsible?.id) {
            profMap.set(f.professor_responsible.id, f.professor_responsible);
          }
        });
        return Array.from(profMap.values()).sort((a, b) => 
          a.last_name.localeCompare(b.last_name)
        );
      }, [formations]);
    
      // ✅ Années académiques uniques
      const uniqueAcademicYears = useMemo(() => {
        const years = new Set<string>();
        students.forEach(s => {
          if (s.academic_year) {
            years.add(s.academic_year);
          }
        });
        return Array.from(years).sort().reverse();
      }, [students]);
    
      // ✅ Filtrer les professeurs selon le type de formation
      const filteredProfessors = useMemo(() => {
        if (filters.formationType === 'ALL') return uniqueProfessors;
        
        return uniqueProfessors.filter(prof => 
          formations.some(f => 
            f.professor_responsible?.id === prof.id && 
            f.formation_type?.code === filters.formationType
          )
        );
      }, [uniqueProfessors, formations, filters.formationType]);
    
      // ✅ Filtrer les formations selon type et professeur
      const filteredFormations = useMemo(() => {
        return formations.filter(f => {
          const matchesType = filters.formationType === 'ALL' || 
            f.formation_type?.code === filters.formationType;
          const matchesProf = filters.professorId === 'ALL' || 
            String(f.professor_responsible?.id) === filters.professorId;
          return matchesType && matchesProf;
        });
      }, [formations, filters.formationType, filters.professorId]);
    
      // ✅ Appliquer tous les filtres sur les étudiants
      const filteredStudents = useMemo(() => {
        return students.filter(student => {
          // Recherche textuelle
          const q = searchQuery.toLowerCase();
          const matchesSearch = 
            student.last_name.toLowerCase().includes(q) ||
            student.first_name.toLowerCase().includes(q) ||
            String(student.num_apogee ?? '').includes(q);
    
          if (!matchesSearch) return false;
    
          // Filtre par type de formation
          if (filters.formationType !== 'ALL') {
            const formationType = student.formation?.formation_type?.code;
            if (formationType !== filters.formationType) return false;
          }
    
          // Filtre par formation
          if (filters.formationId !== 'ALL') {
            if (String(student.formation_id) !== filters.formationId) return false;
          }
    
          // Filtre par professeur responsable
          if (filters.professorId !== 'ALL') {
            const profId = String(student.formation?.professor_responsible?.id);
            if (profId !== filters.professorId) return false;
          }
    
          // Filtre par année académique
          if (filters.academicYear !== 'ALL') {
            if (student.academic_year !== filters.academicYear) return false;
          }
    
          return true;
        });
      }, [students, searchQuery, filters]);

    // Obtenir les milestones triés par ordre
    const sortedMilestones = useMemo(() => {
        return [...milestones].sort((a, b) => a.order - b.order);
    }, [milestones]);

    // Obtenir les milestones filtrés selon le workflow sélectionné
    const workflowMilestones = useMemo(() => {
        const workflowSteps = WORKFLOWS[selectedWorkflow.toUpperCase()]?.steps || [];
        return sortedMilestones.filter(m => workflowSteps.includes(m.code));
    }, [sortedMilestones, selectedWorkflow]);

    // Effet pour générer les chronologies quand on passe à l'étape 4
    useEffect(() => {
        if (currentStep === 4 && targetMilestone && workflowMilestones.length && chronologies.length === 0) {
            // Trouver l'index du milestone cible
            const targetIndex = workflowMilestones.findIndex(m => m.code === targetMilestone);
            if (targetIndex === -1) return;
            
            // Créer les chronologies jusqu'au milestone cible
            const newChronologies = [];
            for (let i = 0; i <= targetIndex; i++) {
                const milestone = workflowMilestones[i];
                const now = new Date();
                
                // Calculer des dates fictives pour la démonstration
                const startDate = new Date();
                startDate.setDate(now.getDate() - (targetIndex - i) * 2);
                
                const endDate = i < targetIndex ? new Date(startDate) : null;
                if (endDate) endDate.setHours(startDate.getHours() + 8);
                newChronologies.push({
                        milestone_code: milestone.code,
                        milestone_label: milestone.label,
                        started_at: startDate.toISOString(),
                        completed_at: endDate?.toISOString() || null,
                        comment: `Commentaire pour ${milestone.label}`
                });
            }
            
            setChronologies(newChronologies);
        }
    }, [currentStep, targetMilestone, workflowMilestones, chronologies.length]);

    // Effet pour valider les conditions avant de passer à l'étape suivante
    useEffect(() => {
        // Si on est à l'étape 1 mais qu'aucun étudiant n'est sélectionné, revenir à l'étape 1
        if (currentStep > 1 && !selectedStudent) {
            setCurrentStep(1);
        }
        
        // Si on est à l'étape 3 ou 4 mais qu'aucun workflow n'est sélectionné, revenir à l'étape 2
        if (currentStep > 2 && !selectedWorkflow) {
            setCurrentStep(2);
        }
        
        // Si on est à l'étape 4 mais qu'aucun milestone cible n'est sélectionné, revenir à l'étape 3
        if (currentStep > 3 && !targetMilestone) {
            setCurrentStep(3);
        }
    }, [currentStep, selectedStudent, selectedWorkflow, targetMilestone]);

    // Réinitialiser le milestone cible et les chronologies quand le workflow change
    useEffect(() => {
        setTargetMilestone('');
        setChronologies([]);
    }, [selectedWorkflow]);

    const handleCreateTicket = async () => {
        if (!selectedStudent || !targetMilestone || !chronologies.length) {
        toast.error('Veuillez sélectionner un étudiant, un milestone cible et définir des chronologies');
        return;
        }

        try {
            console.log(selectedWorkflow);
            const ticket = await createAdvancedTicket({
                student_id: selectedStudent.id,
                target_milestone_code: targetMilestone,
                chronologies: chronologies.map(c => ({
                milestone_code: c.milestone_code,
                started_at: c.started_at,
                completed_at: c.completed_at,
                comment: c.comment
                })),
                // Définir le type de validation en fonction du workflow
                diploma_validation_type: selectedWorkflow === WORKFLOWS.ATTESTATION.id ? "ATTESTATION" : "DIPLOMA"
            });

        if (ticket) {
            navigate(`/dossier/${ticket.id}`);
        }
        } catch (error) {
        console.error('Error creating advanced ticket:', error);
        }
    };

    const updateChronology = (index, field, value) => {
        const updatedChronologies = [...chronologies];
        updatedChronologies[index] = {
        ...updatedChronologies[index],
        [field]: value
        };
        setChronologies(updatedChronologies);
    };

    const addChronology = () => {
        // Trouver le prochain milestone disponible
        if (!chronologies.length && workflowMilestones.length) {
        // Si aucune chronologie, ajouter la première
        const firstMilestone = workflowMilestones[0];
        setChronologies([{
            milestone_code: firstMilestone.code,
            milestone_label: firstMilestone.label,
            started_at: new Date().toISOString(),
            completed_at: null,
            comment: ''
        }]);
        setTargetMilestone(firstMilestone.code);
        return;
        }

        const lastChronology = chronologies[chronologies.length - 1];
        const lastIndex = workflowMilestones.findIndex(m => m.code === lastChronology.milestone_code);
        
        if (lastIndex < workflowMilestones.length - 1) {
        const nextMilestone = workflowMilestones[lastIndex + 1];
        
        // Utiliser la date de complétion de la dernière chronologie comme date de début
        const startDate = lastChronology.completed_at || new Date().toISOString();
        
        setChronologies([
            ...chronologies,
            {
            milestone_code: nextMilestone.code,
            milestone_label: nextMilestone.label,
            started_at: startDate,
            completed_at: null,
            comment: ''
            }
        ]);
        
        // Mettre à jour le milestone cible
        setTargetMilestone(nextMilestone.code);
        }
    };

    const removeChronology = (index) => {
        if (chronologies.length <= 1) {
        toast.error('Vous devez avoir au moins une chronologie');
        return;
        }
        
        const updatedChronologies = chronologies.filter((_, i) => i !== index);
        setChronologies(updatedChronologies);
        
        // Mettre à jour le milestone cible
        const lastChronology = updatedChronologies[updatedChronologies.length - 1];
        setTargetMilestone(lastChronology.milestone_code);
    };

    if (studentsLoading || milestonesLoading) {
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
        <div className="max-w-3xl mx-auto space-y-6">
            {/* Header avec indicateur d'étape */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Création avancée de dossier</h1>
                    <p className="text-muted-foreground">Créer un dossier avec des chronologies spécifiques</p>
                </div>
                </div>
                <div className="text-sm text-muted-foreground">
                Étape {currentStep} sur {totalSteps}
                </div>
            </div>

            {/* Indicateur de progression */}
            <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                <div 
                className="bg-primary h-full transition-all duration-300 ease-in-out" 
                style={{ width: `${(currentStep / totalSteps) * 100}%` }}
                />
            </div>

            {/* Étape 1: Sélection de l'étudiant */}
            {currentStep === 1 && (
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle>Sélectionner un étudiant</CardTitle>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowFilters(!showFilters)}
                            >
                                {showFilters ? 'Masquer les filtres' : 'Afficher les filtres'}
                            </Button>
                        </div>
                        <CardDescription>
                            {filteredStudents.length} étudiant{filteredStudents.length > 1 ? 's' : ''} trouvé{filteredStudents.length > 1 ? 's' : ''}
                        </CardDescription>
                    </CardHeader>

                    {showFilters && (
                        <CardContent className="border-b pb-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Type de formation */}
                            <div className="space-y-2">
                            <Label className="text-xs">Type de formation</Label>
                                                <Select
                                value={filters.formationType}
                                onValueChange={(value) => setFilters(prev => ({
                                ...prev,
                                formationType: value,
                                formationId: 'ALL'
                                }))}
                            >
                                <SelectTrigger className="h-9">
                                <SelectValue placeholder="Tous" />
                                </SelectTrigger>
                                <SelectContent>
                                <SelectItem value="ALL">Tous</SelectItem>
                                <SelectItem value="LUS">LUS</SelectItem>
                                <SelectItem value="MUS">MUS</SelectItem>
                                </SelectContent>
                            </Select>
                            </div>

                            {/* Professeur responsable */}
                            <div className="space-y-2">
                              <Label className="text-xs">Professeur responsable</Label>
                              <Select
                                value={filters.professorId}
                                onValueChange={(value) => {
                                  setFilters(prev => ({
                                    ...prev,
                                    professorId: value,
                                    formationId: 'ALL'
                                  }));
                                }}
                              >
                                <SelectTrigger className="h-9">
                                  <SelectValue placeholder="Tous" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="ALL">Tous</SelectItem>
                                  {filteredProfessors.map(prof => (
                                    <SelectItem key={prof.id} value={String(prof.id)}>
                                      {prof.first_name} {prof.last_name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Formation */}
                            <div className="space-y-2">
                            <Label className="text-xs">Formation</Label>
                            <Select
                                value={filters.formationId}
                                onValueChange={(value) => setFilters(prev => ({ ...prev, formationId: value }))}
                            >
                                <SelectTrigger className="h-9">
                                <SelectValue placeholder="Toutes" />
                                </SelectTrigger>
                                <SelectContent>
                                <SelectItem value="ALL">Toutes</SelectItem>
                                {formations
                                    .filter(f => filters.formationType === 'ALL' || f.formation_type?.code === filters.formationType)
                                    .map(f => (
                                    <SelectItem key={f.id} value={String(f.id)}>
                                        {f.formation_name}
                                    </SelectItem>
                                    ))
                                }
                                </SelectContent>
                            </Select>
                            </div>

                            {/* Année académique */}
                            <div className="space-y-2">
                            <Label className="text-xs">Année universitaire</Label>
                            <Select
                                value={filters.academicYear}
                                onValueChange={(value) => setFilters(prev => ({ ...prev, academicYear: value }))}
                            >
                                <SelectTrigger className="h-9">
                                <SelectValue placeholder="Toutes" />
                                </SelectTrigger>
                                <SelectContent>
                                <SelectItem value="ALL">Toutes</SelectItem>
                                {Array.from(new Set(students.map(s => s.academic_year).filter(Boolean)))
                                    .sort()
                                    .reverse()
                                    .map(year => (
                                    <SelectItem key={year} value={year}>
                                        {year}
                                    </SelectItem>
                                    ))
                                }
                                </SelectContent>
                            </Select>
                            </div>
                        </div>
                        </CardContent>
                    )}
                    <CardContent className="space-y-4 pt-4">
                        <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                        <Input
                            placeholder="Rechercher par nom, prénom, Numero d'Apogee..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                        />
                        </div>

                        <div className="max-h-64 overflow-y-auto border rounded-lg">
                            {filteredStudents.length === 0 ? (
                                <div className="p-4 text-center text-muted-foreground">
                                Aucun étudiant trouvé
                                </div>
                            ) : (
                                <div className="divide-y divide-border">
                                {filteredStudents.map((student) => (
                                    <div
                                    key={student.id}
                                    className={`p-3 cursor-pointer transition-colors ${
                                        selectedStudent?.id === student.id 
                                        ? 'bg-primary/10 border-l-4 border-l-primary' 
                                        : 'hover:bg-muted/50'
                                    }`}
                                    onClick={() => setSelectedStudent(student)}
                                    >
                                    <p className="font-medium text-foreground">
                                        {student.first_name} {student.last_name}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        Numero d'Apogee: {student.num_apogee}
                                        {student.formation?.formation_name && ` • ${student.formation.formation_type.code}`}
                                    </p>
                                    </div>
                                ))}
                                </div>
                            )}
                        </div>
                    </CardContent>
                    <CardFooter className="flex justify-end border-t pt-4">
                        <Button 
                        onClick={goToNextStep} 
                        disabled={!selectedStudent}
                        >
                        Suivant
                        </Button>
                    </CardFooter>
                </Card>
            )}

            {/* Étape 2: Sélection du workflow */}
            {currentStep === 2 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Sélectionner un workflow</CardTitle>
                        <CardDescription>
                        Choisissez le type de workflow pour ce dossier
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <RadioGroup 
                            value={selectedWorkflow} 
                            onValueChange={setSelectedWorkflow}
                            className="space-y-4"
                        >
                        {Object.values(WORKFLOWS).map(workflow => (
                            <div key={workflow.id} className={`flex items-start space-x-3 border rounded-lg p-4 ${selectedWorkflow === workflow.id ? 'bg-primary/5 border-primary' : 'hover:bg-muted/50'}`}>
                            <RadioGroupItem value={workflow.id} id={workflow.id} className="mt-1" />
                            <div className="flex-1">
                                <Label htmlFor={workflow.id} className="text-base font-medium cursor-pointer">
                                {workflow.name}
                                </Label>
                                <p className="text-sm text-muted-foreground mt-1">
                                {workflow.description}
                                </p>
                                <div className="flex flex-wrap gap-2 mt-2">
                                {workflow.steps.map((step, i) => (
                                    <div key={step} className="flex items-center text-xs bg-muted px-2 py-1 rounded">
                                    {i > 0 && <span className="text-muted-foreground mx-1">→</span>}
                                    {step}
                                    </div>
                                ))}
                                </div>
                            </div>
                            </div>
                        ))}
                        </RadioGroup>
                    </CardContent>
                    <CardFooter className="flex justify-between border-t pt-4">
                        <Button 
                        variant="outline" 
                        onClick={goToPreviousStep}
                        >
                        Retour
                        </Button>
                        <Button 
                        onClick={goToNextStep} 
                        disabled={!selectedWorkflow}
                        >
                        Suivant
                        </Button>
                    </CardFooter>
                </Card>
            )}

            {/* Étape 3: Sélection du milestone cible */}
            {currentStep === 3 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Milestone cible</CardTitle>
                        <CardDescription>
                            Sélectionnez le milestone final pour ce dossier
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <Select
                                value={targetMilestone}
                                onValueChange={setTargetMilestone}
                            >
                            <SelectTrigger>
                                <SelectValue placeholder="Sélectionner un milestone" />
                            </SelectTrigger>
                            <SelectContent>
                                {workflowMilestones.map((milestone) => (
                                <SelectItem key={milestone.id} value={milestone.code}>
                                    {milestone.label}
                                </SelectItem>
                                ))}
                            </SelectContent>
                            </Select>

                            {targetMilestone && (
                                <div className="p-3 bg-muted/50 rounded-lg">
                                    <p className="text-sm font-medium">Chronologies qui seront créées :</p>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {workflowMilestones
                                            .filter((_, i) => i <= workflowMilestones.findIndex(m => m.code === targetMilestone))
                                            .map((milestone, i, arr) => (
                                            <div key={milestone.code} className="flex items-center">
                                                <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                                                    {milestone.label}
                                                </span>
                                                {i < arr.length - 1 && (
                                                    <ArrowLeft className="h-4 w-4 rotate-180 mx-1 text-muted-foreground" />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </CardContent>
                    <CardFooter className="flex justify-between border-t pt-4">
                        <Button 
                            variant="outline" 
                            onClick={goToPreviousStep}
                        >
                        Retour
                        </Button>
                        <Button 
                            onClick={goToNextStep} 
                            disabled={!targetMilestone}
                        >
                        Suivant
                        </Button>
                    </CardFooter>
                </Card>
            )}

            {/* Étape 4: Configuration des chronologies */}
            {currentStep === 4 && (
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle>Chronologies</CardTitle>
                            <Button 
                                variant="outline" 
                                size="sm"
                                onClick={addChronology}
                                disabled={chronologies.length >= workflowMilestones.length}
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                Ajouter
                            </Button>
                        </div>
                        <CardDescription>
                            Définissez les dates et commentaires pour chaque étape
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {chronologies.map((chrono, index) => (
                            <div key={index} className="p-4 border rounded-lg space-y-4 relative">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute top-2 right-2 h-6 w-6 text-destructive"
                                    onClick={() => removeChronology(index)}
                                    disabled={chronologies.length <= 1}
                                >
                                    <Trash className="h-4 w-4" />
                                </Button>
                                
                                <div className="flex items-center gap-2">
                                    <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                                        {index + 1}
                                    </div>
                                    <div>
                                        <h3 className="font-medium">{chrono.milestone_label}</h3>
                                        <p className="text-xs text-muted-foreground">
                                            {index === chronologies.length - 1 ? 'Milestone cible' : 'Milestone intermédiaire'}
                                        </p>
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Date de début</Label>
                                        <Input
                                            type="datetime-local"
                                            value={chrono.started_at ? new Date(chrono.started_at).toISOString().slice(0, 16) : ''}
                                            onChange={(e) => updateChronology(index, 'started_at', new Date(e.target.value).toISOString())}
                                        />
                                    </div>
                                    
                                    {index < chronologies.length - 1 && (
                                        <div className="space-y-2">
                                            <Label>Date de fin</Label>
                                            <Input
                                                type="datetime-local"
                                                value={chrono.completed_at ? new Date(chrono.completed_at).toISOString().slice(0, 16) : ''}
                                                onChange={(e) => updateChronology(index, 'completed_at', new Date(e.target.value).toISOString())}
                                            />
                                        </div>
                                    )}
                                </div>
                                
                                <div className="space-y-2">
                                    <Label>Commentaire</Label>
                                    <Textarea
                                        placeholder="Commentaire pour cette étape..."
                                        value={chrono.comment || ''}
                                        onChange={(e) => updateChronology(index, 'comment', e.target.value)}
                                        rows={2}
                                    />
                                </div>
                            </div>
                        ))}
                        
                        {chronologies.length === 0 && (
                            <div className="text-center p-6 text-muted-foreground">
                                <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                <p>Aucune chronologie définie</p>
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="mt-2"
                                    onClick={addChronology}
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Ajouter une chronologie
                                </Button>
                            </div>
                        )}
                    </CardContent>
                    <CardFooter className="flex justify-between border-t pt-4">
                        <Button 
                            variant="outline" 
                            onClick={goToPreviousStep}
                        >
                        Retour
                        </Button>
                        {/* Create Button */}
                        <Button 
                            onClick={handleCreateTicket} 
                            disabled={!chronologies.length || isCreatingAdvanced}
                            className="bg-green-600 hover:bg-green-700"
                        >
                            {isCreatingAdvanced && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            Créer le dossier
                        </Button>
                    </CardFooter>
                </Card>
            )}

            {/* Résumé des sélections (visible à toutes les étapes sauf la première) */}
        {currentStep > 1 && (
            <Card className="bg-muted/30">
            <CardContent className="p-4">
                <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Étudiant sélectionné:</span>
                    <span className="text-sm">
                    {selectedStudent?.first_name} {selectedStudent?.last_name} ({selectedStudent?.num_apogee})
                    </span>
                </div>
                
                {currentStep > 2 && (
                    <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Workflow:</span>
                    <span className="text-sm">
                        {WORKFLOWS[selectedWorkflow.toUpperCase()]?.name}
                    </span>
                    </div>
                )}

                {currentStep > 3 && (
                    <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Milestone cible:</span>
                    <span className="text-sm">
                        {workflowMilestones.find(m => m.code === targetMilestone)?.label}
                    </span>
                    </div>
                )}
                </div>
            </CardContent>
            </Card>
        )}

        </div>
        </DashboardLayout>
    );
}
