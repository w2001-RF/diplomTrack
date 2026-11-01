import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { DocumentRow, DocumentInsert, DocumentUpdate, DocumentStatus } from '@/lib/api/models';
import { toast } from 'sonner';
import { CACHE_KEYS, defaultCacheConfig } from './useApiCache';

interface UseDocumentsQueryOptions {
  ticketId?: string;
  enabled?: boolean;
}

/**
 * React Query-based hook for documents with caching and auto-refetch
 */
export function useDocumentsQuery(options: UseDocumentsQueryOptions = {}) {
  const { ticketId, enabled = true } = options;
  const queryClient = useQueryClient();

  // Main query for fetching documents
  const documentsQuery = useQuery({
    queryKey: [CACHE_KEYS.DOCUMENTS, ticketId],
    queryFn: async (): Promise<unknown[]> => {
      if (!ticketId) return [];
      
      const { data, error } = await api.data.getMany<unknown>('documents', {
        filters: [{ field: 'ticket_id', operator: 'eq', value: ticketId }],
        sort: [{ field: 'created_at', direction: 'desc' }]
      });

      if (error) throw new Error(error.message);
      return data?.documents || data || [];
    },
    enabled: enabled && !!ticketId,
    staleTime: defaultCacheConfig.staleTime,
    gcTime: defaultCacheConfig.cacheTime,
    refetchOnWindowFocus: defaultCacheConfig.refetchOnWindowFocus,
  });

  // Mutation for uploading documents
  const uploadMutation = useMutation({
    mutationFn: async (data: DocumentInsert) => {
      const { data: document, error } = await api.data.create<DocumentRow>('documents', data);
      if (error) throw new Error(error.message);
      return document;
    },
    onSuccess: () => {
      toast.success('Document téléversé avec succès');
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.DOCUMENTS, ticketId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erreur lors du téléversement du document');
    }
  });

  // Mutation for validating documents
  const validateMutation = useMutation({
    mutationFn: async ({ id, comment }: { id: string; comment?: string }) => {
      const { data, error } = await api.data.customRequest<{ message: string; document: any }>(
        `documents/${id}/validate`,
        {
          method: 'PATCH',
          body: { comment }
        }
      );

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      toast.success('Document validé');
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.DOCUMENTS, ticketId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erreur lors de la validation du document');
    }
  });

  // Mutation for rejecting documents
  const invalidateMutation = useMutation({
    mutationFn: async ({ id, comment }: { id: string; comment: string }) => {
      const { data, error } = await api.data.customRequest<{ message: string; document: any }>(
        `documents/${id}/invalidate`,
        {
          method: 'PATCH',
          body: { comment }
        }
      );

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      toast.success('Document rejeté');
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.DOCUMENTS, ticketId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erreur lors du rejet du document');
    }
  });

  // Mutation for deleting documents
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await api.data.delete('documents', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success('Document supprimé');
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.DOCUMENTS, ticketId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erreur lors de la suppression du document');
    }
  });

  return {
    // Query state
    documents: documentsQuery.data || [],
    loading: documentsQuery.isLoading,
    error: documentsQuery.error?.message || null,
    isRefetching: documentsQuery.isRefetching,
    
    // Query actions
    refetch: documentsQuery.refetch,
    
    // Mutations
    uploadDocument: uploadMutation.mutateAsync,
    validateDocument: (id: string, comment?: string) => validateMutation.mutateAsync({ id, comment }),
    inValidateDocument: (id: string, reason: string) => invalidateMutation.mutateAsync({ id, reason }),
    deleteDocument: deleteMutation.mutateAsync,
    
    // Mutation states
    isUploading: uploadMutation.isPending,
    isValidating: validateMutation.isPending,
    isInValidating: invalidateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
