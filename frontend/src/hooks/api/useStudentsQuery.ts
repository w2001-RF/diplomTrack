import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { fetchAllPages } from '@/lib/api/pagination';
import type { StudentRow, StudentInsert, StudentUpdate } from '@/lib/api/models';
import { toast } from 'sonner';
import { CACHE_KEYS, defaultCacheConfig } from './useApiCache';

interface UseStudentsQueryOptions {
  enabled?: boolean;
}

/**
 * React Query-based hook for students with caching and auto-refetch
 */
export function useStudentsQuery(options: UseStudentsQueryOptions = {}) {
  const { enabled = true } = options;
  const queryClient = useQueryClient();

  // Main query for fetching students
  const studentsQuery = useQuery({
    queryKey: [CACHE_KEYS.STUDENTS],
    queryFn: async (): Promise<StudentRow[]> => {
      // The API pages students (`limit`, default 10); the list filters client side
      const { items } = await fetchAllPages<StudentRow>(async (page, size) => {
        const { data, error, count } = await api.data.getMany<StudentRow>('students', {
          sort: [{ field: 'num_apogee', direction: 'asc' }],
          pagination: { page, limit: size },
        });
        return { data: { items: data ?? [], total: count ?? data?.length ?? 0 }, error };
      }, 100);
      return items;
    },
    enabled,
    staleTime: defaultCacheConfig.staleTime,
    gcTime: defaultCacheConfig.cacheTime,
    refetchOnWindowFocus: defaultCacheConfig.refetchOnWindowFocus,
    refetchOnReconnect: defaultCacheConfig.refetchOnReconnect,
  });

  // Mutation for creating students
  const createMutation = useMutation({
    mutationFn: async (data: StudentInsert) => {
      const { data: student, error } = await api.data.create<StudentRow>('students', data);
      if (error) throw new Error(error.message);
      return student;
    },
    onSuccess: () => {
      toast.success('Étudiant créé avec succès');
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.STUDENTS] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erreur lors de la création de l\'étudiant');
    }
  });

  // Mutation for creating multiple students
  const createManyMutation = useMutation({
    mutationFn: async (students: any[]) => {
      // Transformer les données pour correspondre au format backend
      const studentsData = students.map(s => ({
        first_name: s.first_name,
        last_name: s.last_name,
        academic_year: s.academic_year,
        formation_type: s.formation_type,
        formation_name: s.formation_name,
        email: s.email || null,
        num_apogee: s.num_apogee || null
      }));

      const { data, error } = await api.data.customRequest<{
        success: number;
        failed: number;
        total: number;
        errors: Array<{ index: number; data: any; error: string }>;
      }>('students/bulk', {
        method: 'POST',
        body: { students: studentsData }
      });

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (result) => {
      if (result) {
        toast.success(`${result.success} étudiants créés avec succès`);
        if (result.failed > 0) {
          toast.warning(`${result.failed} étudiants ont échoué`);
        }
        queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.STUDENTS] });
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erreur lors de la création en masse');
    }
  });

  // Mutation for updating students
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: StudentUpdate }) => {
      const { error } = await api.data.update<StudentRow>('students', id, data, 'PUT');
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success('Étudiant mis à jour');
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.STUDENTS] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erreur lors de la mise à jour de l\'étudiant');
    }
  });

  // Mutation for deleting students
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await api.data.delete('students', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success('Étudiant supprimé');
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.STUDENTS] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erreur lors de la suppression de l\'étudiant');
    }
  });
  
  // Mutation for deleting many students
  const deleteManyMutation = useMutation({
    mutationFn: async (studentIds: number[]) => {
      // Supprimer chaque étudiant individuellement
      const deletePromises = studentIds.map(id => 
        api.data.delete('students', String(id))
      );
      
      const results = await Promise.allSettled(deletePromises);
      
      const failed = results.filter(r => r.status === 'rejected').length;
      const success = results.filter(r => r.status === 'fulfilled').length;
      
      return { success, failed, total: studentIds.length };
    },
    onSuccess: (result) => {
      toast.success(`${result.success} étudiant(s) supprimé(s)`);
      if (result.failed > 0) {
        toast.error(`${result.failed} suppression(s) échouée(s)`);
      }
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.STUDENTS] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erreur lors de la suppression');
    }
  });

  return {
    // Query state
    students: studentsQuery.data || [],
    loading: studentsQuery.isLoading,
    error: studentsQuery.error?.message || null,
    isRefetching: studentsQuery.isRefetching,
    
    // Query actions
    refetch: studentsQuery.refetch,
    
    // Mutations
    createStudent: createMutation.mutateAsync,
    createManyStudents: createManyMutation.mutateAsync,
    updateStudent: (id: string, data: StudentUpdate) => updateMutation.mutateAsync({ id, data }),
    deleteStudent: deleteMutation.mutateAsync,
    deleteManyStudents: deleteManyMutation.mutateAsync,
    
    // Mutation states
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isDeletingMany: deleteManyMutation.isPending,
    isCreatingMany: createManyMutation.isPending,
  };
}

/**
 * Hook to fetch a single student by ID
 */
export function useStudentQuery(studentId: string | undefined) {
  return useQuery({
    queryKey: [CACHE_KEYS.STUDENTS, studentId],
    queryFn: async (): Promise<StudentRow | null> => {
      if (!studentId) return null;

      const { data, error } = await api.data.getOne<StudentRow>('students', studentId);
      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!studentId,
    staleTime: defaultCacheConfig.staleTime,
    gcTime: defaultCacheConfig.cacheTime,
  });
}

/**
 * Hook to fetch student by user_id
 */
export function useStudentByUserQuery(userId: string | undefined) {
  return useQuery({
    queryKey: [CACHE_KEYS.STUDENTS, 'by-user', userId],
    queryFn: async (): Promise<StudentRow | null> => {
      if (!userId) return null;

      const { data, error } = await api.data.getMany<StudentRow>('students', {
        filters: [{ field: 'user_id', operator: 'eq', value: userId }],
        limit: 1
      });
      
      if (error) throw new Error(error.message);
      return data?.[0] ?? null;
    },
    enabled: !!userId,
    staleTime: defaultCacheConfig.staleTime,
    gcTime: defaultCacheConfig.cacheTime,
  });
}
