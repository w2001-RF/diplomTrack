import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import type { Database } from '@/integrations/supabase/types';
import { toast } from 'sonner';

type StudentRow = Database['public']['Tables']['students']['Row'];
type StudentInsert = Database['public']['Tables']['students']['Insert'];
type StudentUpdate = Database['public']['Tables']['students']['Update'];

interface UseStudentsOptions {
  autoFetch?: boolean;
}

interface UseStudentsReturn {
  students: StudentRow[];
  loading: boolean;
  error: string | null;
  fetchStudents: () => Promise<void>;
  getStudent: (id: string) => Promise<StudentRow | null>;
  createStudent: (data: StudentInsert) => Promise<StudentRow | null>;
  updateStudent: (id: string, data: StudentUpdate) => Promise<boolean>;
  deleteStudent: (id: string) => Promise<boolean>;
}

export function useStudents(options: UseStudentsOptions = {}): UseStudentsReturn {
  const { autoFetch = true } = options;
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await api.data.getMany<StudentRow>('students', {
        sort: [{ field: 'num_apogee', direction: 'asc' }]
      });

      if (fetchError) throw new Error(fetchError.message);
      setStudents(data || []);
    } catch (err: any) {
      const message = err.message || 'Erreur lors du chargement des étudiants';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const getStudent = useCallback(async (id: string): Promise<StudentRow | null> => {
    try {
      const { data, error } = await api.data.getOne<StudentRow>('students', id);
      if (error) throw new Error(error.message);
      return data;
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors du chargement de l\'étudiant');
      return null;
    }
  }, []);

  const createStudent = useCallback(async (data: StudentInsert): Promise<StudentRow | null> => {
    try {
      const { data: student, error } = await api.data.create<StudentRow>('students', data);
      if (error) throw new Error(error.message);
      toast.success('Étudiant créé avec succès');
      await fetchStudents();
      return student;
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la création de l\'étudiant');
      return null;
    }
  }, [fetchStudents]);

  const updateStudent = useCallback(async (id: string, data: StudentUpdate): Promise<boolean> => {
    try {
      const { error } = await api.data.update<StudentRow>('students', id, data);
      if (error) throw new Error(error.message);
      await fetchStudents();
      return true;
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la mise à jour de l\'étudiant');
      return false;
    }
  }, [fetchStudents]);

  const deleteStudent = useCallback(async (id: string): Promise<boolean> => {
    try {
      const { error } = await api.data.delete('students', id);
      if (error) throw new Error(error.message);
      setStudents(prev => prev.filter(s => s.id !== id));
      toast.success('Étudiant supprimé avec succès');
      return true;
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la suppression de l\'étudiant');
      return false;
    }
  }, []);

  useEffect(() => {
    if (autoFetch) {
      fetchStudents();
    }
  }, [autoFetch, fetchStudents]);

  return {
    students,
    loading,
    error,
    fetchStudents,
    getStudent,
    createStudent,
    updateStudent,
    deleteStudent
  };
}
