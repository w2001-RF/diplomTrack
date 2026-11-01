import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';

type BulkAgentInput = {
  agents: { username: string; email: string }[];
};

type BulkAgentCreated = {
  id: number | string;
  username: string;
  email: string;
  password: string; // returned once by backend
};

type BulkAgentResponse = {
  created: BulkAgentCreated[];
  count: number;
  note?: string;
};

export function useBulkCreateAgentsMutation() {
  return useMutation({
    mutationFn: async (payload: BulkAgentInput): Promise<BulkAgentResponse> => {
      const res = await api.data.customRequest<BulkAgentResponse>('admin/users/agents/bulk', {
        method: 'POST',
        body: payload,
      });
      if (res.error || !res.data) {
        throw new Error(res.error?.message || 'Erreur lors de la création en masse');
      }
      return res.data;
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erreur lors de la création en masse');
    }
  });
}
