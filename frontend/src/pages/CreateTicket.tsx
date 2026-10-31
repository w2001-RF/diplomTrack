import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Search, User, X, Filter } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useStudentsQuery, useMilestonesQuery, useTicketsQuery } from '@/hooks/api';
import { useFormationsQuery  } from '@/hooks/api/useFormationsQuery';
import { useAuth } from '@/hooks/useAuth';
import { StudentRow } from '@/types/database';


const FILTERS_CACHE_KEY = 'create_ticket_filters';

type FormationTypeCode = 'LUS' | 'MUS' | 'ALL';

interface FilterState {
  formationType: FormationTypeCode;
  formationId: string;
  professorId: string;
  academicYear: string;
}

export default function CreateTicket() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<StudentRow | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const loadFiltersFromCache = (): FilterState => {
    try {
      const cached = localStorage.getItem(`${FILTERS_CACHE_KEY}_${user?.id}`);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      console.error('Error loading filters from cache:', error);
    }
    return {
      formationType: 'ALL',
      formationId: 'ALL',
      professorId: 'ALL',
      academicYear: 'ALL'
    };
  };

  const [filters, setFilters] = useState<FilterState>(loadFiltersFromCache);
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

  const { students, loading: studentsLoading, isRefetching } = useStudentsQuery();
  const { getFirstMilestone } = useMilestonesQuery();
  const { createTicket, isCreating } = useTicketsQuery();

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
        student.num_apogee?.toLowerCase().includes(q);

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

  const handleCreateTicket = async () => {
    if (!selectedStudent) return;

    const firstMilestone = getFirstMilestone();
    
    const ticket = await createTicket({
      student_id: selectedStudent.id,
      initial_milestone_code: firstMilestone?.code || null,
    });

    if (ticket) {
      navigate(`/dossier/${ticket.id}`);
    }
  };

  const resetFilters = () => {
    setFilters({
      formationType: 'ALL',
      formationId: 'ALL',
      professorId: 'ALL',
      academicYear: 'ALL'
    });
  };

  // ✅ Vérifier si des filtres sont actifs
  const hasActiveFilters = 
    filters.formationType !== 'ALL' ||
    filters.formationId !== 'ALL' ||
    filters.professorId !== 'ALL' ||
    filters.academicYear !== 'ALL';

  if (studentsLoading) {
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
      {/* Refetching indicator */}
      {isRefetching && (
        <div className="fixed top-4 right-4 bg-primary/10 text-primary px-3 py-1 rounded-full text-sm flex items-center gap-2 z-50">
          <Loader2 className="h-3 w-3 animate-spin" />
          Actualisation...
        </div>
      )}

      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Créer un nouveau ticket</h1>
            <p className="text-muted-foreground">Sélectionnez l'étudiant pour ce dossier</p>
          </div>
        </div>

        {/* Filtres */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filtres
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
              >
                {showFilters ? 'Masquer' : 'Afficher'}
              </Button>
            </div>
          </CardHeader>
          {showFilters && (
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Type de formation */}
                <div className="space-y-2">
                  <Label className="text-xs">Type de formation</Label>
                  <Select
                    value={filters.formationType}
                    onValueChange={(value: FormationTypeCode) => {
                      setFilters(prev => ({
                        ...prev,
                        formationType: value,
                        formationId: 'ALL',
                        professorId: 'ALL'
                      }));
                    }}
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
                    onValueChange={(value) => {
                      setFilters(prev => ({ ...prev, formationId: value }));
                    }}
                    disabled={filters.formationType === 'ALL' && filters.professorId === 'ALL'}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder={
                        filters.formationType === 'ALL' && filters.professorId === 'ALL'
                          ? "Choisir type ou prof"
                          : "Toutes"
                      } />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Toutes</SelectItem>
                      {filteredFormations.map(f => (
                        <SelectItem key={f.id} value={String(f.id)}>
                          {f.formation_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Année académique */}
                <div className="space-y-2">
                  <Label className="text-xs">Année universitaire</Label>
                  <Select
                    value={filters.academicYear}
                    onValueChange={(value) => {
                      setFilters(prev => ({ ...prev, academicYear: value }));
                    }}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Toutes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Toutes</SelectItem>
                      {uniqueAcademicYears.map(year => (
                        <SelectItem key={year} value={year}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Bouton réinitialiser */}
              {hasActiveFilters && (
                <div className="mt-4 flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetFilters}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Réinitialiser les filtres
                  </Button>
                </div>
              )}
            </CardContent>
          )}
        </Card>

        {/* Student Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Sélectionner un étudiant</CardTitle>
            <CardDescription>
              {filteredStudents.length} étudiant{filteredStudents.length > 1 ? 's' : ''} trouvé{filteredStudents.length > 1 ? 's' : ''}
              {hasActiveFilters && ' (filtré)'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
                        {student.formation?.formation_name && ` • ${student.formation.formation_name}`}
                        {student.formation?.formation_type?.code && ` (${student.formation.formation_type.code})`}
                      </p>
                      {student.formation?.professeur_responsable && (
                        <p className="text-sm text-muted-foreground">
                          Professeur Responsable: {student.formation.professeur_responsable.first_name} {student.formation.professeur_responsable.last_name}
                          {student.formation.professeur_responsable.email && (
                            <>
                              <br /> {student.formation.professeur_responsable.email}
                            </>
                          )}
                          {student.formation.professeur_responsable.phone && (
                            <>
                              <br /> {student.formation.professeur_responsable.phone}
                            </>
                          )}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Selected Student Summary */}
        {selectedStudent && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Étudiant sélectionné
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Nom complet</p>
                  <p className="font-medium">{selectedStudent.first_name} {selectedStudent.last_name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">CNE</p>
                  <p className="font-medium">{selectedStudent.numero_apogee}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Formation</p>
                  <p className="font-medium">{selectedStudent.formation.formation_name} ({selectedStudent.formation.formation_type.code})</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Année universitaire</p>
                  <p className="font-medium">{selectedStudent.academic_year}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Create Button */}
        <Button 
          onClick={handleCreateTicket} 
          disabled={!selectedStudent || isCreating}
          className="w-full"
          size="lg"
        >
          {isCreating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Créer le ticket
        </Button>
      </div>
    </DashboardLayout>
  );
}
