import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { TicketCard } from '@/components/tickets/TicketCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { mockTickets, mockNotifications, getStatusBadgeVariant } from '@/data/mockData';
import { STATUS_LABELS } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { 
  Ticket, 
  FileCheck, 
  AlertTriangle, 
  Clock, 
  Plus, 
  Filter,
  Bell,
  TrendingUp,
  Users,
  CheckCircle2
} from 'lucide-react';

const Dashboard = () => {
  const { role } = useAuth();
  const isStudent = role === 'student';

  // Calculate stats
  const totalTickets = mocktickets?.total;
  const pendingTickets = mockTickets.filter(t => 
    ['CREATED', 'DOSSIER_EN_COURS', 'PIECES_COMPLETES'].includes(t.status)
  ).length;
  const blockedTickets = mockTickets.filter(t => t.status === 'BLOQUE_PIECE_MANQUANTE').length;
  const closedTickets = mockTickets.filter(t => t.status === 'DOSSIER_CLOTURE').length;
  const unreadNotifications = mockNotifications.filter(n => !n.read).length;

  // Recent tickets
  const recentTickets = [...mockTickets]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 4);

  return (
    <DashboardLayout title="Tableau de bord">

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatsCard
          title="Total dossiers"
          value={totalTickets}
          subtitle="Tous les dossiers"
          icon={Ticket}
          variant="primary"
          delay={0}
        />
        <StatsCard
          title="En cours"
          value={pendingTickets}
          subtitle="En traitement"
          icon={Clock}
          variant="warning"
          trend={{ value: 12, isPositive: true }}
          delay={0.1}
        />
        <StatsCard
          title="Bloqués"
          value={blockedTickets}
          subtitle="Pièces manquantes"
          icon={AlertTriangle}
          variant="danger"
          delay={0.2}
        />
        <StatsCard
          title="Clôturés"
          value={closedTickets}
          subtitle="Ce mois"
          icon={CheckCircle2}
          variant="success"
          trend={{ value: 8, isPositive: true }}
          delay={0.3}
        />
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent tickets */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">dossiers récents</h2>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <Filter size={16} className="mr-2" />
                Filtrer
              </Button>
              {!isStudent && (
                <Button variant="accent" size="sm">
                  <Plus size={16} className="mr-2" />
                  Nouveau ticket
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {recentTickets.map((ticket, index) => (
              <TicketCard 
                key={ticket.id} 
                ticket={ticket}
                onClick={() => console.log('Open ticket', ticket.id)}
              />
            ))}
          </div>

          <Button variant="ghost" className="w-full">
            Voir tous les tickets
          </Button>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Notifications */}
          <Card className="p-4 animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <Bell size={18} />
                Notifications
                {unreadNotifications > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {unreadNotifications}
                  </Badge>
                )}
              </h3>
            </div>

            <div className="space-y-3">
              {mockNotifications.slice(0, 3).map(notification => (
                <div 
                  key={notification.id}
                  className={`p-3 rounded-lg text-sm ${
                    notification.read ? 'bg-muted/50' : 'bg-accent/10 border border-accent/20'
                  }`}
                >
                  <p className="text-foreground">{notification.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(notification.sentAt).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              ))}
            </div>

            <Button variant="ghost" size="sm" className="w-full mt-3">
              Voir toutes les notifications
            </Button>
          </Card>

          {/* Quick stats */}
          <Card className="p-4 animate-fade-in" style={{ animationDelay: '0.3s' }}>
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <TrendingUp size={18} />
              Statistiques rapides
            </h3>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Taux de validation</span>
                <span className="font-semibold text-foreground">78%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-status-validated rounded-full" style={{ width: '78%' }} />
              </div>

              <div className="flex items-center justify-between mt-4">
                <span className="text-sm text-muted-foreground">Délai moyen</span>
                <span className="font-semibold text-foreground">12 jours</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Documents traités</span>
                <span className="font-semibold text-foreground">156</span>
              </div>
            </div>
          </Card>

          {/* Status distribution */}
          <Card className="p-4 animate-fade-in" style={{ animationDelay: '0.4s' }}>
            <h3 className="font-semibold text-foreground mb-4">Répartition par statut</h3>
            
            <div className="space-y-2">
              {Object.entries(
                mockTickets.reduce((acc, t) => {
                  acc[t.status] = (acc[t.status] || 0) + 1;
                  return acc;
                }, {} as Record<string, number>)
              ).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <Badge variant={getStatusBadgeVariant(status as any) as any}>
                    {STATUS_LABELS[status as keyof typeof STATUS_LABELS]}
                  </Badge>
                  <span className="text-sm font-medium text-foreground">{count}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
