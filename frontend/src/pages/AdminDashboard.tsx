import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTicketsQuery } from '@/hooks/api';
import { api } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { CACHE_KEYS, defaultCacheConfig } from '@/hooks/api/useApiCache';
import { 
  Ticket, 
  CheckCircle2,
  AlertTriangle,
  Loader2,
  TrendingUp,
  Calendar,
  UserCheck
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area
} from 'recharts';
import type { Database } from '@/integrations/supabase/types';

type TicketStatus = Database['public']['Enums']['ticket_status'];
type MilestoneHistoryRow = Database['public']['Tables']['ticket_milestone_history']['Row'];
type ProfileRow = Database['public']['Tables']['profiles']['Row'];

interface AgentStats {
  agent_id: string;
  agent_name: string;
  tickets_count: number;
}

interface YearlyStats {
  year: string;
  total: number;
  closed: number;
  blocked: number;
}

interface StatusDistribution {
  name: string;
  value: number;
  color: string;
}

const statusLabels: Record<TicketStatus, string> = {
  CREATED: 'Créé',
  DOSSIER_EN_COURS: 'En cours',
  PIECES_COMPLETES: 'Complet',
  EN_ATTENTE_REPONSE: 'En attente',
  REPONSE_RECUE: 'Réponse reçue',
  DOSSIER_CLOTURE: 'Clôturé',
  BLOQUE_PIECE_MANQUANTE: 'Bloqué',
  REJETE: 'Rejeté',
  ARCHIVE: 'Archivé'
};

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#6366f1'];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { tickets, loading: ticketsLoading, isRefetching } = useTicketsQuery({ withStudent: false });

  // Fetch agent activity data
  const agentActivityQuery = useQuery({
    queryKey: [CACHE_KEYS.MILESTONES, 'agent-activity'],
    queryFn: async (): Promise<AgentStats[]> => {
      const { data: historyData, error: historyError } = await api.data.getMany<MilestoneHistoryRow>(
        'ticket_milestone_history',
        {}
      );

      if (historyError || !historyData) return [];

      const agentCounts: Record<string, number> = {};
      historyData.forEach(h => {
        agentCounts[h.changed_by] = (agentCounts[h.changed_by] || 0) + 1;
      });

      const agentIds = Object.keys(agentCounts);
      if (agentIds.length === 0) return [];

      const { data: profilesData } = await api.data.getMany<ProfileRow>('profiles', {
          filters: [{ field: 'user_id', operator: 'in', value: agentIds }]
      });

      return agentIds.map(id => {
        const profile = profilesData?.find(p => p.user_id === id);
        return {
          agent_id: id,
          agent_name: profile?.full_name || profile?.email || 'Agent inconnu',
          tickets_count: agentCounts[id]
        };
      }).sort((a, b) => b.tickets_count - a.tickets_count).slice(0, 10);
    },
    staleTime: defaultCacheConfig.staleTime,
    gcTime: defaultCacheConfig.cacheTime,
  });

  // Compute statistics from tickets
  const { yearlyStats, statusDistribution, monthlyTrend, stats } = useMemo(() => {
    const yearlyMap: Record<string, YearlyStats> = {};
    const statusMap: Record<string, number> = {};
    const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
    const currentYear = new Date().getFullYear();
    const monthlyMap: Record<string, { created: number; closed: number }> = {};
    months.forEach(m => {
      monthlyMap[m] = { created: 0, closed: 0 };
    });

    tickets?.tickets?.forEach(ticket => {
      // Yearly stats
      const year = new Date(ticket.created_at).getFullYear().toString();
      if (!yearlyMap[year]) {
        yearlyMap[year] = { year, total: 0, closed: 0, blocked: 0 };
      }
      yearlyMap[year].total++;
      if (ticket.status === 'DOSSIER_CLOTURE') yearlyMap[year].closed++;
      if (ticket.status === 'BLOQUE_PIECE_MANQUANTE') yearlyMap[year].blocked++;

      // Status distribution
      statusMap[ticket.status] = (statusMap[ticket.status] || 0) + 1;

      // Monthly trend
      const date = new Date(ticket.created_at);
      if (date.getFullYear() === currentYear) {
        const month = months[date.getMonth()];
        monthlyMap[month].created++;
        if (ticket.status === 'DOSSIER_CLOTURE') {
          monthlyMap[month].closed++;
        }
      }
    });

    const distribution = Object.entries(statusMap).map(([status, value], index) => ({
      name: statusLabels[status as TicketStatus] || status,
      value,
      color: COLORS[index % COLORS.length]
    }));

    const calculatedStats = {
      total: tickets?.total,
      pending: tickets?.tickets?.filter(t => 
        ['CREATED', 'OPEN', 'IN_PROGRESS', 'DOSSIER_EN_COURS', 'PIECES_COMPLETES'].includes(t.status)
      ).length,
      blocked: tickets?.tickets?.filter(t => t.status === 'BLOQUE_PIECE_MANQUANTE').length,
      closed: tickets?.tickets?.filter(t => t.status === 'DOSSIER_CLOTURE').length,
    };
    console.log("calculatedStats:", calculatedStats);

    return {
      yearlyStats: Object.values(yearlyMap).sort((a, b) => a.year.localeCompare(b.year)),
      statusDistribution: distribution,
      monthlyTrend: months.map(m => ({ month: m, ...monthlyMap[m] })),
      stats: calculatedStats
    };
  }, [tickets]);

  const agentStats = agentActivityQuery.data || [];
  const loading = ticketsLoading;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Tableau de bord Admin">
      {/* Refetching indicator */}
      {isRefetching && (
        <div className="fixed top-4 right-4 bg-primary/10 text-primary px-3 py-1 rounded-full text-sm flex items-center gap-2">
          <Loader2 className="h-3 w-3 animate-spin" />
          Actualisation...
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatsCard
          title="Total Dossiers"
          value={stats.total}
          subtitle="Tous les dossiers"
          icon={Ticket}
          variant="primary"
          delay={0}
        />
        <StatsCard
          title="En cours"
          value={stats.pending}
          subtitle="En traitement"
          icon={TrendingUp}
          variant="warning"
          delay={0.1}
        />
        <StatsCard
          title="Bloqués"
          value={stats.blocked}
          subtitle="Pièces manquantes"
          icon={AlertTriangle}
          variant="danger"
          delay={0.2}
        />
        <StatsCard
          title="Clôturés"
          value={stats.closed}
          subtitle="Terminés"
          icon={CheckCircle2}
          variant="success"
          delay={0.3}
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Yearly Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Dossiers par année
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={yearlyStats}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="year" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                  <Bar dataKey="total" name="Total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="closed" name="Clôturés" fill="hsl(var(--status-validated))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="blocked" name="Bloqués" fill="hsl(var(--status-blocked))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Répartition par statut</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {statusDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Monthly Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Tendance mensuelle {new Date().getFullYear()}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="created" 
                    name="Créés" 
                    stroke="hsl(var(--primary))" 
                    fill="hsl(var(--primary))" 
                    fillOpacity={0.3} 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="closed" 
                    name="Clôturés" 
                    stroke="hsl(var(--status-validated))" 
                    fill="hsl(var(--status-validated))" 
                    fillOpacity={0.3} 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Agent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              Activité par agent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {agentStats.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Aucune activité enregistrée
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={agentStats} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" className="text-xs" />
                    <YAxis 
                      dataKey="agent_name" 
                      type="category" 
                      width={120} 
                      className="text-xs"
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar 
                      dataKey="dossiers_count" 
                      name="Actions" 
                      fill="hsl(var(--primary))" 
                      radius={[0, 4, 4, 0]} 
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Résumé des performances</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-primary">
                {stats.total > 0 ? Math.round((stats.closed / stats.total) * 100) : 0}%
              </p>
              <p className="text-sm text-muted-foreground">Taux de clôture</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-[hsl(var(--status-blocked))]">
                {stats.total > 0 ? Math.round((stats.blocked / stats.total) * 100) : 0}%
              </p>
              <p className="text-sm text-muted-foreground">Taux de blocage</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-[hsl(var(--status-in-progress))]">
                {stats.pending}
              </p>
              <p className="text-sm text-muted-foreground">Dossiers actifs</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-foreground">
                {agentStats.length}
              </p>
              <p className="text-sm text-muted-foreground">Agents actifs</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
