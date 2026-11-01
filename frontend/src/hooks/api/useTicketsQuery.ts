import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { TicketRow, TicketInsert, TicketUpdate, StudentRow, TicketStatus } from '@/lib/api/models';
import { toast } from 'sonner';
import { CACHE_KEYS, defaultCacheConfig } from './useApiCache';


export interface TicketWithStudent extends TicketRow {
  student?: StudentRow;
  initial_milestone_code?: String | null;
}

/** GET /api/tickets (get_tickets in backend/routes/ticket_routes.py) */
export interface TicketListResponse {
  tickets: TicketWithStudent[];
  total: number;
  pages: number;
  page: number;
  length: number;
}

const EMPTY_TICKET_LIST: TicketListResponse = { tickets: [], total: 0, pages: 0, page: 1, length: 0 };

interface UseTicketsQueryOptions {
  withStudent?: boolean;
  enabled?: boolean;
}

/**
 * React Query-based hook for tickets with caching and auto-refetch
 */
export function useTicketsQuery(options: UseTicketsQueryOptions = {}) {
  const queryClient = useQueryClient();
  const { enabled = true } = options;

  // Main query for fetching tickets
  const ticketsQuery = useQuery({
    queryKey: [CACHE_KEYS.TICKETS],
    queryFn: async (): Promise<TicketListResponse> => {
      // The pages read the envelope (tickets + total), so keep it whole
      const { data, error } = await api.data.customRequest<TicketListResponse>('tickets', {
        query: { sort: [{ field: 'created_at', direction: 'desc' }] }
      });

      if (error) throw new Error(error.message);
      return data ?? EMPTY_TICKET_LIST;
    },
    enabled,
    staleTime: defaultCacheConfig.staleTime,
    gcTime: defaultCacheConfig.cacheTime,
    refetchOnWindowFocus: defaultCacheConfig.refetchOnWindowFocus,
    refetchOnReconnect: defaultCacheConfig.refetchOnReconnect,
  });

  // Mutation for creating tickets
  const createMutation = useMutation({
    mutationFn: async (data: TicketInsert) => {
      const { data: ticket, error } = await api.data.create<TicketWithStudent>('tickets', data);
      if (error) throw new Error(error.message);
      return ticket;
    },
    onSuccess: () => {
      toast.success('Ticket créé avec succès');
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.TICKETS] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erreur lors de la création du ticket');
    }
  });

  // Mutation for updating tickets
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: TicketUpdate }) => {
      const { error } = await api.data.update<TicketRow>('tickets', id, data);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.TICKETS] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erreur lors de la mise à jour du ticket');
    }
  });

  // Mutation for deleting tickets
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await api.data.delete('tickets', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success('Ticket supprimé avec succès');
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.TICKETS] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erreur lors de la suppression du ticket');
    }
  });

  // Mutation for updating status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, milestoneId }: { id: string; status: TicketStatus; milestoneId?: string }) => {
      const updateData: TicketUpdate = { status };
      if (milestoneId) {
        updateData.current_milestone_id = milestoneId;
      }
      
      const { error } = await api.data.update<TicketRow>('tickets', id, updateData);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success('Statut mis à jour');
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.TICKETS] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erreur lors de la mise à jour du statut');
    }
  });

  // Mutation for importing tickets
  const importMutation = useMutation({
    mutationFn: async (data: { tickets: any[] }) => {
      const { data: result, error } = await api.data.import('tickets', data);
      if (error) throw new Error(error.message);
      return result;
    },
    onSuccess: (result) => {
      if (result && result.success) {
        toast.success(`${result.imported} ticket(s) importé(s) avec succès`);
      } else if (result) {
        toast.warning(`${result.imported} importé(s), ${result.failed} échec(s)`);
      }
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.TICKETS] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erreur lors de l\'importation des tickets');
    }
  });

  // Mutation for creating existant ticket
  const createAdvancedTicketMutation = useMutation({
    mutationFn: async (data: {
      student_id: string;
      target_milestone_code: string;
      chronologies: Array<{
        milestone_code: string;
        started_at?: string;
        completed_at?: string;
        comment?: string;
      }>;
      diploma_validation_type?: string;
    }) => {
      const { data: result, error } = await api.data.customRequest<TicketWithStudent>(
        '/tickets/create-advanced',
        {
          method: 'POST',
          body: data
        }
      );
      if (error) throw new Error(error.message);
      return result;
    },
    onSuccess: () => {
      toast.success('Ticket avancé créé avec succès');
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.TICKETS] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erreur lors de la création du ticket avancé');
    }
  });


  return {
    // Query state
    tickets: ticketsQuery.data ?? EMPTY_TICKET_LIST,
    loading: ticketsQuery.isLoading,
    error: ticketsQuery.error?.message || null,
    isRefetching: ticketsQuery.isRefetching,
    
    // Query actions
    refetch: ticketsQuery.refetch,
    
    // Mutations
    createTicket: createMutation.mutateAsync,
    updateTicket: (id: string, data: TicketUpdate) => updateMutation.mutateAsync({ id, data }),
    deleteTicket: deleteMutation.mutateAsync,
    updateStatus: (id: string, status: TicketStatus, milestoneId?: string) => 
      updateStatusMutation.mutateAsync({ id, status, milestoneId }),
    importTickets: importMutation.mutateAsync,
    createAdvancedTicket: createAdvancedTicketMutation.mutateAsync,
    
    // Mutation states
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isImporting: importMutation.isPending,
    isCreatingAdvanced: createAdvancedTicketMutation.isPending,
  };
}

/**
 * Hook to fetch a single ticket by ID with caching
 */
export function useTicketQuery(ticketId: string | undefined, options: { withStudent?: boolean } = {}) {
  const { withStudent = true } = options;

  return useQuery({
    queryKey: [CACHE_KEYS.TICKETS, ticketId, { withStudent }],
    queryFn: async (): Promise<TicketWithStudent | null> => {
      if (!ticketId) return null;

      const { data: ticket, error: ticketError } = await api.data.getOne<TicketWithStudent>('tickets', ticketId);
      if (ticketError) throw new Error(ticketError.message);
      if (!ticket) return null;

      return ticket;
    },
    enabled: !!ticketId,
    staleTime: defaultCacheConfig.staleTime,
    gcTime: defaultCacheConfig.cacheTime,
  });
}
