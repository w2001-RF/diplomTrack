import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { TicketCard } from '@/components/tickets/TicketCard';
import { WorkflowTimeline } from '@/components/tickets/WorkflowTimeline';
import { DocumentList } from '@/components/documents/DocumentList';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { mockTickets, getStatusBadgeVariant } from '@/data/mockData';
import { Ticket, STATUS_LABELS } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { 
  Search, 
  Filter, 
  Plus, 
  X, 
  User, 
  Calendar, 
  Mail, 
  Phone,
  GraduationCap,
  ArrowLeft
} from 'lucide-react';
import { UserRole } from '@/constants/roles';

const TicketsPage = () => {
  const { role } = useAuth();
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const canValidate = role === UserRole.AGENT || role === UserRole.ADMIN;

  const filteredTickets = mockTickets.filter(ticket => 
    ticket.reference.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ticket.student.nom.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ticket.student.prenom.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ticket.student.cne.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (selectedTicket) {
    return (
      <DashboardLayout title="">
        {/* Back button and title */}
        <div className="flex items-center gap-4 mb-6">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setSelectedTicket(null)}
          >
            <ArrowLeft size={20} />
          </Button>
          <div>
            <h1 className="text-xl font-semibold text-foreground">{selectedTicket.reference}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={getStatusBadgeVariant(selectedTicket.status) as any}>
                {STATUS_LABELS[selectedTicket.status]}
              </Badge>
              <span className="text-sm text-muted-foreground">
                Dernière mise à jour: {new Date(selectedTicket.updatedAt).toLocaleDateString('fr-FR')}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Student info */}
            <Card className="p-6 animate-fade-in">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <User size={20} />
                Informations étudiant
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Nom complet</p>
                    <p className="font-medium text-foreground">
                      {selectedTicket.student.prenom} {selectedTicket.student.nom}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">CNE</p>
                    <p className="font-medium text-foreground">{selectedTicket.student.cne}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail size={14} className="text-muted-foreground" />
                    <p className="text-sm text-foreground">{selectedTicket.student.email}</p>
                  </div>
                  {selectedTicket.student.phone && (
                    <div className="flex items-center gap-2">
                      <Phone size={14} className="text-muted-foreground" />
                      <p className="text-sm text-foreground">{selectedTicket.student.phone}</p>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Formation</p>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground">{selectedTicket.student.formation}</p>
                      <Badge variant="outline">{selectedTicket.student.typeFormation}</Badge>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Année universitaire</p>
                    <p className="font-medium text-foreground">{selectedTicket.student.anneeUniversitaire}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Professeur responsable</p>
                    <p className="font-medium text-foreground">{selectedTicket.student.professeurResponsable}</p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Documents */}
            <Card className="p-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <GraduationCap size={20} />
                Documents justificatifs
              </h2>
              
              <DocumentList 
                documents={selectedTicket.documents}
                canValidate={canValidate}
                onValidate={(id) => console.log('Validate', id)}
                onReject={(id) => console.log('Reject', id)}
              />
            </Card>
          </div>

          {/* Sidebar - Workflow */}
          <div className="space-y-6">
            <Card className="p-6 animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <WorkflowTimeline ticket={selectedTicket} />
            </Card>

            {/* Actions */}
            <Card className="p-4 animate-fade-in" style={{ animationDelay: '0.3s' }}>
              <h3 className="font-semibold text-foreground mb-4">Actions</h3>
              
              <div className="space-y-2">
                <Button variant="accent" className="w-full">
                  Valider et passer à l'étape suivante
                </Button>
                <Button variant="outline" className="w-full">
                  Envoyer une notification
                </Button>
                <Button variant="ghost" className="w-full text-destructive hover:text-destructive">
                  Forcer la transition
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Dossiers">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <Input 
            placeholder="Rechercher par référence, nom, CNE..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
          {searchQuery && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
              onClick={() => setSearchQuery('')}
            >
              <X size={16} />
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline">
            <Filter size={16} className="mr-2" />
            Filtrer
          </Button>
          <Button variant="accent">
            <Plus size={16} className="mr-2" />
            Nouveau dossier
          </Button>
        </div>
      </div>

      {/* Results count */}
      <p className="text-sm text-muted-foreground mb-4">
        {filteredtickets?.total} dossier{filteredtickets?.total > 1 ? 's' : ''} trouvé{filteredtickets?.total > 1 ? 's' : ''}
      </p>

      {/* Tickets list */}
      <div className="space-y-3">
        {filteredTickets.map((ticket) => (
          <TicketCard 
            key={ticket.id} 
            ticket={ticket}
            onClick={() => setSelectedTicket(ticket)}
          />
        ))}
      </div>

      {filteredtickets?.total === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Aucun ticket trouvé</p>
        </div>
      )}
    </DashboardLayout>
  );
};

export default TicketsPage;
