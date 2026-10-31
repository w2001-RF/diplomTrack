import { useState, useCallback } from 'react';
import { api } from '@/lib/api';
import type { Database } from '@/integrations/supabase/types';
import { toast } from 'sonner';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

interface UseProfilesReturn {
  loading: boolean;
  error: string | null;
  getProfile: (userId: string) => Promise<ProfileRow | null>;
  updateProfile: (userId: string, data: ProfileUpdate) => Promise<boolean>;
}

export function useProfiles(): UseProfilesReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getProfile = useCallback(async (userId: string): Promise<ProfileRow | null> => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await api.data.getMany<ProfileRow>('profiles', {
        filters: [{ field: 'user_id', operator: 'eq', value: userId }],
        limit: 1
      });

      if (fetchError) throw new Error(fetchError.message);
      return data?.[0] || null;
    } catch (err: any) {
      const message = err.message || 'Erreur lors du chargement du profil';
      setError(message);
      toast.error(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateProfile = useCallback(async (
    userId: string, 
    data: ProfileUpdate
  ): Promise<boolean> => {
    setLoading(true);
    try {
      // First get the profile ID
      const profile = await getProfile(userId);
      if (!profile) throw new Error('Profil non trouvé');

      const { error } = await api.data.update<ProfileRow>('profiles', profile.id, data);
      if (error) throw new Error(error.message);
      
      toast.success('Profil mis à jour');
      return true;
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la mise à jour du profil');
      return false;
    } finally {
      setLoading(false);
    }
  }, [getProfile]);

  return {
    loading,
    error,
    getProfile,
    updateProfile
  };
}
