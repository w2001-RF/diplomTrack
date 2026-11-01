import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTicketsQuery } from '@/hooks/api/useTicketsQuery';
import { 
  Ticket, 
  Clock, 
  AlertTriangle, 
  CheckCircle2,
  Plus,
  Eye,
  Loader2,
  TrendingUp
} from 'lucide-react';
import type { TicketStatus } from '@/lib/api/models';
import { useAuth } from '@/hooks/useAuth';

const statusLabels: Record<TicketStatus, string> = {
  CREATED: 'Créé',
  DOSSIER_EN_COURS: 'Dossier en cours',
  PIECES_COMPLETES: 'Pièces complètes',
  EN_ATTENTE_REPONSE: 'En attente de réponse',
  REPONSE_RECUE: 'Réponse reçue',
  DOSSIER_CLOTURE: 'Dossier clôturé',
  BLOQUE_PIECE_MANQUANTE: 'Bloqué - pièce manquante',
  REJETE: 'Rejeté',
  ARCHIVE: 'Archivé'
};

const getStatusColor = (status: TicketStatus) => {
  switch (status) {
    case 'DOSSIER_CLOTURE':
      return 'bg-[hsl(var(--status-validated))]';
    case 'REJETE':
      return 'bg-[hsl(var(--status-rejected))]';
    case 'BLOQUE_PIECE_MANQUANTE':
      return 'bg-[hsl(var(--status-blocked))]';
    case 'CREATED':
    case 'EN_ATTENTE_REPONSE':
      return 'bg-[hsl(var(--status-pending))]';
    default:
      return 'bg-[hsl(var(--status-in-progress))]';
  }
};

export default function AgentDashboard() {
  const navigate = useNavigate();
  const {user} = useAuth();
  const { tickets, loading, isRefetching } = useTicketsQuery(user?.id);

  const stats = {
    total: tickets?.total,
    pending: tickets?.tickets?.filter(t => 
      ['CREATED', 'DOSSIER_EN_COURS', 'PIECES_COMPLETES'].includes(t.current_milestone?.code)
    ).length,
    blocked: tickets?.tickets?.filter(t => t.current_milestone?.code === 'BLOQUE_PIECE_MANQUANTE').length,
    closed: tickets?.tickets?.filter(t => t.current_milestone?.code === 'DOSSIER_CLOTURE').length,
  };

  const statusDistribution = tickets?.tickets?.reduce((acc, ticket) => {
    acc[ticket.current_milestone?.code] = (acc[ticket.current_milestone?.code] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const recentTickets = tickets?.tickets?.slice(0, 5);

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
    <DashboardLayout title="Tableau de bord">
      {/* Refetch indicator */}
      {isRefetching && (
        <div className="fixed top-4 right-4 z-50">
          <Badge variant="secondary" className="animate-pulse">
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
            Actualisation...
          </Badge>
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
          icon={Clock}
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
          subtitle="Ce mois"
          icon={CheckCircle2}
          variant="success"
          delay={0.3}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Dossiers */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Dossiers récents</h2>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate('/dossiers')}>
                <Eye size={16} className="mr-2" />
                Voir tous
              </Button>
              <Button variant="default" size="sm" onClick={() => navigate('/dossiers/create')}>
                <Plus size={16} className="mr-2" />
                Nouveau dossier
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              {!recentTickets?.length ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Ticket className="h-12 w-12 mb-4 opacity-50" />
                  <p>Aucun dossier</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {recentTickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      className="flex items-center justify-between p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/dossier/${ticket.id}`)}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{ticket.reference}</span>
                          <Badge className={`${getStatusColor(ticket.current_milestone.code)} text-primary-foreground text-xs`}>
                            {statusLabels[ticket.current_milestone.code]}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {ticket.student?.first_name} {ticket.student?.last_name} - {ticket.student?.num_apogee}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">
                          {new Date(ticket.created_at).toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Stats */}
        <div className="space-y-6">
          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Statistiques rapides
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Taux de clôture</span>
                <span className="font-semibold text-foreground">
                  {stats.total > 0 ? Math.round((stats.closed / stats.total) * 100) : 0}%
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[hsl(var(--status-validated))] rounded-full transition-all" 
                  style={{ width: `${stats.total > 0 ? (stats.closed / stats.total) * 100 : 0}%` }} 
                />
              </div>
              
              <div className="flex items-center justify-between pt-2">
                <span className="text-sm text-muted-foreground">Dossiers bloqués</span>
                <span className="font-semibold text-foreground">
                  {stats.total > 0 ? Math.round((stats.blocked / stats.total) * 100) : 0}%
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Status Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Répartition par statut</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {Object.entries(statusDistribution).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <Badge className={`${getStatusColor(status as TicketStatus)} text-primary-foreground text-xs`}>
                    {statusLabels[status as TicketStatus]}
                  </Badge>
                  <span className="text-sm font-medium text-foreground">{count}</span>
                </div>
              ))}
              {Object.keys(statusDistribution).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Aucune donnée
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
