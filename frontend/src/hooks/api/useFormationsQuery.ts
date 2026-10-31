import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface FormationType {
  id: number;
  code: string;
  label: string;
}

export interface ProfessorMini {
  id: number;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
}

export interface Formation {
  id: number;
  formation_name: string;
  description?: string;
  formation_type: FormationType;
  professor_responsible: ProfessorMini;
  created_at: string;
}

export const useFormationsQuery = () => {
  const query = useQuery<Formation[]>({
    queryKey: ['formations'],
    queryFn: async () => {
      const { data, error } = await api.data.getMany<Formation>('formations', {
        sort: [{ field: 'formation_name', direction: 'asc' }]
      });

      if (error) throw new Error(error.message);
      return data || [];
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
    refetchOnWindowFocus: false,
  });

  return {
    formations: query.data || [],
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
};
