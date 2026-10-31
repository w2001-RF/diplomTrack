import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { CACHE_KEYS } from './useApiCache';

export function useDeleteUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await api.data.delete('admin/users', userId);

      if (error) {
        throw new Error(error.message || 'Suppression échouée');
      }
    },

    onSuccess: () => {
      toast.success('Utilisateur supprimé');
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.USERS] });
    },

    onError: (error: Error) => {
      toast.error(error.message || 'Erreur lors de la suppression');
    }
  });
}
