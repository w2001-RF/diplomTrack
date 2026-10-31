import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import type { Database } from '@/integrations/supabase/types';
import { toast } from 'sonner';

type TicketRow = Database['public']['Tables']['tickets']['Row'];
type TicketInsert = Database['public']['Tables']['tickets']['Insert'];
type TicketUpdate = Database['public']['Tables']['tickets']['Update'];
type StudentRow = Database['public']['Tables']['students']['Row'];
type TicketStatus = Database['public']['Enums']['ticket_status'];

export interface TicketWithStudent extends TicketRow {
  student: StudentRow;
}

interface UseTicketsOptions {
  autoFetch?: boolean;
  withStudent?: boolean;
}

interface UseTicketsReturn {
  tickets: TicketWithStudent[];
  loading: boolean;
  error: string | null;
  fetchTickets: () => Promise<void>;
  createTicket: (data: TicketInsert) => Promise<TicketRow | null>;
  updateTicket: (id: string, data: TicketUpdate) => Promise<boolean>;
  deleteTicket: (id: string) => Promise<boolean>;
  updateStatus: (id: string, status: TicketStatus, milestoneId?: string) => Promise<boolean>;
}

export function useTickets(options: UseTicketsOptions = {}): UseTicketsReturn {
  const { autoFetch = true, withStudent = true } = options;
  const [tickets, setTickets] = useState<TicketWithStudent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: ticketsData, error: ticketsError } = await api.data.getMany<TicketRow>('tickets', {
        sort: [{ field: 'created_at', direction: 'desc' }]
      });

      if (ticketsError) throw new Error(ticketsError.message);

      if (withStudent && ticketsData) {
        const studentIds = [...new Set(ticketsData.map(t => t.student_id))];
        const { data: studentsData, error: studentsError } = await api.data.getMany<StudentRow>('students', {
          filters: [{ field: 'id', operator: 'in', value: studentIds }]
        });

        if (studentsError) throw new Error(studentsError.message);

        const ticketsWithStudents = ticketsData.map(ticket => ({
          ...ticket,
          student: studentsData?.find(s => s.id === ticket.student_id)!
        }));
        setTickets(ticketsWithStudents);
      } else {
        setTickets(ticketsData?.map(t => ({ ...t, student: {} as StudentRow })) || []);
      }
    } catch (err: any) {
      const message = err.message || 'Erreur lors du chargement des tickets';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [withStudent]);

  const createTicket = useCallback(async (data: TicketInsert): Promise<TicketRow | null> => {
    try {
      const { data: ticket, error } = await api.data.create<TicketRow>('tickets', data);
      if (error) throw new Error(error.message);
      toast.success('Ticket créé avec succès');
      return ticket;
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la création du ticket');
      return null;
    }
  }, []);

  const updateTicket = useCallback(async (id: string, data: TicketUpdate): Promise<boolean> => {
    try {
      const { error } = await api.data.update<TicketRow>('tickets', id, data);
      if (error) throw new Error(error.message);
      await fetchTickets();
      return true;
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la mise à jour du ticket');
      return false;
    }
  }, [fetchTickets]);

  const deleteTicket = useCallback(async (id: string): Promise<boolean> => {
    try {
      // Delete associated data first
      await api.data.deleteMany('documents', [{ field: 'ticket_id', operator: 'eq', value: id }]);
      await api.data.deleteMany('ticket_milestone_history', [{ field: 'ticket_id', operator: 'eq', value: id }]);
      await api.data.deleteMany('notifications', [{ field: 'ticket_id', operator: 'eq', value: id }]);
      
      const { error } = await api.data.delete('tickets', id);
      if (error) throw new Error(error.message);
      
      setTickets(prev => prev.filter(t => t.id !== id));
      toast.success('Ticket supprimé avec succès');
      return true;
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la suppression du ticket');
      return false;
    }
  }, []);

  const updateStatus = useCallback(async (
    id: string, 
    status: TicketStatus, 
    milestoneId?: string
  ): Promise<boolean> => {
    try {
      const updateData: TicketUpdate = { status };
      if (milestoneId) {
        updateData.current_milestone_id = milestoneId;
      }
      
      const { error } = await api.data.update<TicketRow>('tickets', id, updateData);
      if (error) throw new Error(error.message);
      
      toast.success('Statut mis à jour');
      await fetchTickets();
      return true;
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la mise à jour du statut');
      return false;
    }
  }, [fetchTickets]);

  useEffect(() => {
    if (autoFetch) {
      fetchTickets();
    }
  }, [autoFetch, fetchTickets]);

  return {
    tickets,
    loading,
    error,
    fetchTickets,
    createTicket,
    updateTicket,
    deleteTicket,
    updateStatus
  };
}
