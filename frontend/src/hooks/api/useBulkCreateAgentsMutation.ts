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
      // IMPORTANT: table path must match your REST adapter pattern:
      // api.data.create(table, data) -> POST /api/{table}
      // Your endpoint is POST /api/admin/users/agents/bulk
      // So we use query() to hit a custom endpoint:

      const res = await api.data.createMany<BulkAgentResponse>('admin/users/agents', payload);
      if(res.error) {
        throw new Error(res.error.message || 'Erreur lors de la création en masse');
      }
      return res.data;
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erreur lors de la création en masse');
    }
  });
}
