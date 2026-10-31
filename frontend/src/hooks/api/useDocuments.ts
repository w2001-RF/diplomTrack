import { useState, useCallback } from 'react';
import { api } from '@/lib/api';
import type { Database } from '@/integrations/supabase/types';
import { toast } from 'sonner';

type DocumentRow = Database['public']['Tables']['documents']['Row'];
type DocumentInsert = Database['public']['Tables']['documents']['Insert'];
type DocumentUpdate = Database['public']['Tables']['documents']['Update'];
type DocumentStatus = Database['public']['Enums']['document_status'];

interface UseDocumentsReturn {
  documents: DocumentRow[];
  loading: boolean;
  error: string | null;
  fetchDocuments: (ticketId: string) => Promise<void>;
  uploadDocument: (data: DocumentInsert) => Promise<DocumentRow | null>;
  validateDocument: (id: string, userId: string) => Promise<boolean>;
  rejectDocument: (id: string, userId: string, reason: string) => Promise<boolean>;
  deleteDocument: (id: string) => Promise<boolean>;
}

export function useDocuments(): UseDocumentsReturn {
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = useCallback(async (ticketId: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await api.data.getMany<DocumentRow>('documents', {
        filters: [{ field: 'ticket_id', operator: 'eq', value: ticketId }],
        sort: [{ field: 'uploaded_at', direction: 'desc' }]
      });

      if (fetchError) throw new Error(fetchError.message);
      setDocuments(data || []);
    } catch (err: any) {
      const message = err.message || 'Erreur lors du chargement des documents';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const uploadDocument = useCallback(async (data: DocumentInsert): Promise<DocumentRow | null> => {
    try {
      const { data: document, error } = await api.data.create<DocumentRow>('documents', data);
      if (error) throw new Error(error.message);
      toast.success('Document téléversé avec succès');
      if (data.ticket_id) {
        await fetchDocuments(data.ticket_id);
      }
      return document;
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors du téléversement du document');
      return null;
    }
  }, [fetchDocuments]);

  const validateDocument = useCallback(async (id: string, userId: string): Promise<boolean> => {
    try {
      const updateData: DocumentUpdate = {
        status: 'VALIDATED' as DocumentStatus,
        validated_by: userId,
        validated_at: new Date().toISOString()
      };
      
      const { error } = await api.data.update<DocumentRow>('documents', id, updateData);
      if (error) throw new Error(error.message);
      
      toast.success('Document validé');
      setDocuments(prev => prev.map(d => 
        d.id === id ? { ...d, ...updateData } : d
      ));
      return true;
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la validation du document');
      return false;
    }
  }, []);

  const rejectDocument = useCallback(async (
    id: string, 
    userId: string, 
    reason: string
  ): Promise<boolean> => {
    try {
      const updateData: DocumentUpdate = {
        status: 'REJECTED' as DocumentStatus,
        rejection_reason: reason,
        validated_by: userId,
        validated_at: new Date().toISOString()
      };
      
      const { error } = await api.data.update<DocumentRow>('documents', id, updateData);
      if (error) throw new Error(error.message);
      
      toast.success('Document rejeté');
      setDocuments(prev => prev.map(d => 
        d.id === id ? { ...d, ...updateData } : d
      ));
      return true;
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors du rejet du document');
      return false;
    }
  }, []);

  const deleteDocument = useCallback(async (id: string): Promise<boolean> => {
    try {
      const { error } = await api.data.delete('documents', id);
      if (error) throw new Error(error.message);
      setDocuments(prev => prev.filter(d => d.id !== id));
      toast.success('Document supprimé');
      return true;
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la suppression du document');
      return false;
    }
  }, []);

  return {
    documents,
    loading,
    error,
    fetchDocuments,
    uploadDocument,
    validateDocument,
    rejectDocument,
    deleteDocument
  };
}
