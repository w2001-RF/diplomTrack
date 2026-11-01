import { useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DataTable } from '@/components/common/DataTable';
import { StudentForm, type StudentFormData } from '@/components/students/StudentForm';
import { ImportStudentsDialog } from '@/components/students/ImportStudentsDialog';
import { Button } from '@/components/ui/button';
import { Users, Mail, GraduationCap, Trash2, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import { getAnneeUniversitaires } from '@/data/formations';
import { useStudentsQuery, type StudentImportRow } from '@/hooks/api/useStudentsQuery';
import type { StudentRow } from '@/lib/api/models';
import { useFormationsQuery } from '@/hooks/api/useFormationsQuery';

export default function AgentStudents() {
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  
  const { 
    students, 
    loading, 
    isCreating, 
    createStudent, 
    refetch, 
    createManyStudents, 
    isCreatingMany,
    deleteStudent,
    deleteManyStudents,
    isDeletingMany,
    updateStudent,
    isUpdating 
  } = useStudentsQuery();
  
  const { formations } = useFormationsQuery();

  // Unique professors
  const uniqueProfesseurs = useMemo(() => {
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

  // Helper to get formation name
  const getFormationName = (formationId: number | string) => {
    const formation = formations.find(f => f.id === Number(formationId));
    return formation?.formation_name || 'N/A';
  };

  // Create handler
  const handleCreate = async (data: StudentFormData) => {
    if (!data.first_name || !data.last_name || !data.formation_id || !data.academic_year) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      throw new Error('Missing required fields');
    }

    let numApogee: number | null = null;
    if (data.num_apogee) {
      numApogee = parseInt(data.num_apogee, 10);
      if (Number.isNaN(numApogee)) {
        toast.error("Numéro d'apogée invalide");
        throw new Error('Invalid num_apogee');
      }
    }

    await createStudent({
      user_id: null,
      first_name: data.first_name,
      last_name: data.last_name,
      num_apogee: numApogee,
      email: data.email || null,
      formation_id: parseInt(data.formation_id, 10),
      academic_year: data.academic_year
    });

    toast.success("Étudiant ajouté avec succès");
    await refetch();
  };

  // Update handler
  const handleUpdate = async (student: StudentRow, data: StudentFormData) => {
    if (!data.first_name || !data.last_name || !data.formation_id || !data.academic_year) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      throw new Error('Missing required fields');
    }

    let numApogee: number | null = null;
    if (data.num_apogee) {
      numApogee = parseInt(data.num_apogee, 10);
      if (Number.isNaN(numApogee)) {
        toast.error("Numéro d'apogée invalide");
        throw new Error('Invalid num_apogee');
      }
    }

    await updateStudent(String(student.id), {
      first_name: data.first_name,
      last_name: data.last_name,
      num_apogee: numApogee,
      email: data.email || null,
      formation_id: parseInt(data.formation_id, 10),
      academic_year: data.academic_year
    });

    toast.success("Étudiant mis à jour avec succès");
    await refetch();
  };

  // Delete handler
  const handleDelete = async (ids: (number | string)[]) => {
    await deleteManyStudents(ids.map(Number));
    await refetch();
  };

  // Import handler
  const handleBulkImport = async (students: StudentImportRow[]) => {
    try {
      await createManyStudents(students);
      setImportDialogOpen(false);
      await refetch();
    } catch (error) {
      console.error('Bulk import error:', error);
    }
  };

  return (
    <DashboardLayout title="Étudiants">
      <DataTable
        data={students}
        loading={loading}
        getItemId={(student) => student.id}
        
        // Columns
        columns={[
          {
            key: 'name',
            label: 'Nom complet',
            render: (student) => (
              <div className="space-y-1">
                <p className="font-medium text-foreground">
                  {student.first_name} {student.last_name}
                </p>
                {student.num_apogee && (
                  <p className="text-sm text-muted-foreground">
                    Apogée: {student.num_apogee}
                  </p>
                )}
                {student.email && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Mail className="h-3 w-3" />
                    {student.email}
                  </div>
                )}
              </div>
            )
          },
          {
            key: 'formation',
            label: 'Formation',
            render: (student) => (
              <div className="text-right space-y-1">
                <div className="flex items-center gap-1 text-sm">
                  <GraduationCap className="h-4 w-4 text-muted-foreground" />
                  <span className="text-foreground">{getFormationName(student.formation_id)}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {student.academic_year}
                </p>
              </div>
            )
          }
        ]}
        
        // Search
        searchPlaceholder="Rechercher par nom, Num Apogee, email..."
        searchKeys={['first_name', 'last_name', 'num_apogee', 'email', 'academic_year']}
        
        // Filters
        filters={[
          {
            key: 'formationType',
            label: 'Type de formation',
            type: 'select',
            options: [
              { value: 'LUS', label: 'LUS' },
              { value: 'MUS', label: 'MUS' }
            ]
          },
          {
            key: 'professorId',
            label: 'Professeur responsable',
            type: 'select',
            options: uniqueProfesseurs
              .filter(p => {
                if (!activeFilters.formationType || activeFilters.formationType === 'ALL') return true;
                return formations.some(f => 
                  f.professor_responsible?.id === p.id && 
                  f.formation_type?.code === activeFilters.formationType
                );
              })
              .map(p => ({
                value: String(p.id),
                label: `${p.first_name} ${p.last_name}`
              }))
          },
          {
            key: 'formationId',
            label: 'Formation',
            type: 'select',
            options: formations
              .filter(f => {
                const matchesType = !activeFilters.formationType || 
                  activeFilters.formationType === 'ALL' || 
                  f.formation_type?.code === activeFilters.formationType;
                const matchesProf = !activeFilters.professorId || 
                  activeFilters.professorId === 'ALL' || 
                  String(f.professor_responsible?.id) === activeFilters.professorId;
                return matchesType && matchesProf;
              })
              .map(f => ({
                value: String(f.id),
                label: f.formation_name
              }))
          },
          {
            key: 'academicYear',
            label: 'Année universitaire',
            type: 'select',
            options: getAnneeUniversitaires().map(year => ({
              value: year,
              label: year
            }))
          }
        ]}
        onFilterChange={(filters) => {
          setActiveFilters(filters);
        }}
        
        // Bulk actions
        bulkActions={{
          delete: {
            enabled: true,
            onDelete: handleDelete,
            isDeleting: isDeletingMany
          }
        }}
        
        // Row actions
        rowActions={[
          {
            label: 'Supprimer',
            icon: <Trash2 className="h-4 w-4 text-destructive" />,
            variant: 'ghost',
            onClick: async (student) => {
              await deleteManyStudents([student.id]);
              await refetch();
            }
          }
        ]}
        
        // Create
        onCreate={{
          enabled: true,
          buttonLabel: 'Ajouter un étudiant',
          dialogTitle: 'Ajouter un nouvel étudiant',
          dialogDescription: 'Remplissez les informations de l\'étudiant.',
          form: (onClose, isSubmitting) => (
            <StudentForm
              onSubmit={async (data) => {
                await handleCreate(data);
                onClose();
              }}
              onCancel={onClose}
              isSubmitting={isCreating}
              submitLabel="Ajouter l'étudiant"
            />
          )
        }}
        
        // Edit
        onEdit={{
          enabled: true,
          dialogTitle: 'Modifier l\'étudiant',
          dialogDescription: 'Modifiez les informations de l\'étudiant.',
          form: (student, onClose, isSubmitting) => (
            <StudentForm
              initialData={{
                first_name: student.first_name || '',
                last_name: student.last_name || '',
                num_apogee: student.num_apogee?.toString() || '',
                email: student.email || '',
                formation_id: student.formation_id?.toString() || '',
                academic_year: student.academic_year || ''
              }}
              onSubmit={async (data) => {
                await handleUpdate(student, data);
                onClose();
              }}
              onCancel={onClose}
              isSubmitting={isUpdating}
              submitLabel="Enregistrer"
            />
          )
        }}
        
        // Import
        onImport={{
          enabled: true,
          buttonLabel: 'Importer Excel',
          component: (
            <>
              <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
                <FileSpreadsheet size={16} className="mr-2" />
                Importer Excel
              </Button>
              <ImportStudentsDialog
                open={importDialogOpen}
                onOpenChange={setImportDialogOpen}
                onImport={handleBulkImport}
                isImporting={isCreatingMany}
              />
            </>
          )
        }}
        
        // Pagination
        pagination={{
          enabled: true,
          defaultPageSize: 10,
          pageSizeOptions: [5, 10, 20, 50, 100]
        }}
        
        // Empty state
        emptyState={{
          icon: <Users className="h-12 w-12 mb-4 opacity-50" />,
          message: 'Aucun étudiant trouvé'
        }}
      />
    </DashboardLayout>
  );
}
