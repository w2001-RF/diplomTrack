// src/pages/AgentTickets.tsx
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DataTable } from '@/components/common/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { milestoneCodeOf, STATUS_LABELS } from '@/lib/tickets';
import { useTicketsQuery } from '@/hooks/api/useTicketsQuery';
import { Plus, Loader2, Ticket, Trash2, Upload, Clock } from 'lucide-react';
import type { TicketStatus } from '@/lib/api/models';
import { UserRole } from '@/constants/roles';
import { TicketImportDialog } from '@/components/tickets/TicketImportDialog';

const statusLabels = STATUS_LABELS;

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

export default function AgentTickets() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const { tickets, loading, isRefetching, deleteTicket, isDeleting } = useTicketsQuery({ withStudent: true });
  const [showImportDialog, setShowImportDialog] = useState(false);

  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});

  const isAdmin = role === UserRole.ADMIN;
  const isAgent = role === UserRole.AGENT;

  // Préparer les données pour le DataTable
  const ticketsList = useMemo(() => tickets?.tickets || [], [tickets]);

  // Options de statut pour les filtres
  const statusOptions = useMemo(() => 
    Object.entries(statusLabels).map(([value, label]) => ({ value, label })),
    []
  );

  // Options de formations uniques
  const formationOptions = useMemo(() => {
    const formations = new Map();
    ticketsList.forEach(ticket => {
      if (ticket.student?.formation) {
        formations.set(
          ticket.student.formation.id,
          ticket.student.formation.formation_name
        );
      }
    });
    return Array.from(formations.entries()).map(([id, name]) => ({
      value: String(id),
      label: name
    }));
  }, [ticketsList]);

  // Options d'années académiques uniques
  const academicYearOptions = useMemo(() => {
    const years = new Set<string>();
    ticketsList.forEach(ticket => {
      if (ticket.student?.academic_year) {
        years.add(ticket.student.academic_year);
      }
    });
    return Array.from(years).sort().reverse().map(year => ({
      value: year,
      label: year
    }));
  }, [ticketsList]);

  // Filtrer les données avant de les passer au DataTable
  const filteredTicketsList = useMemo(() => {
    return ticketsList.filter(ticket => {
      // Filtre par statut
      if (activeFilters.status && activeFilters.status !== 'ALL') {
        if (milestoneCodeOf(ticket) !== activeFilters.status) return false;
      }
      
      // Filtre par formation
      if (activeFilters.formation && activeFilters.formation !== 'ALL') {
        if (String(ticket.student?.formation?.id) !== activeFilters.formation) return false;
      }
      
      // Filtre par année académique
      if (activeFilters.academicYear && activeFilters.academicYear !== 'ALL') {
        if (ticket.student?.academic_year !== activeFilters.academicYear) return false;
      }
      
      return true;
    });
  }, [ticketsList, activeFilters]);

  // Handler de suppression
  const handleDelete = async (ids: (number | string)[]) => {
    for (const id of ids) {
      await deleteTicket(String(id));
    }
  };

  return (
    <DashboardLayout title="Dossiers">
      {/* Refetch indicator */}
      {isRefetching && (
        <div className="fixed top-4 right-4 z-50">
          <Badge variant="secondary" className="animate-pulse">
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
            Actualisation...
          </Badge>
        </div>
      )}

      <DataTable
        data={filteredTicketsList}
        loading={loading}
        getItemId={(ticket) => ticket.id}
        
        // Colonnes
        columns={[
          {
            key: 'reference',
            label: 'Référence & Statut',
            render: (ticket) => (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{ticket.reference}</span>
                  <Badge className={`${getStatusColor(milestoneCodeOf(ticket))} text-primary-foreground text-xs`}>
                    {statusLabels[milestoneCodeOf(ticket)]}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {ticket.student?.first_name} {ticket.student?.last_name} - {ticket.student?.num_apogee}
                </p>
                <p className="text-xs text-muted-foreground">
                  {ticket.student?.formation?.formation_name} ({ticket.student?.formation?.formation_type?.code})
                </p>
              </div>
            )
          },
          {
            key: 'dates',
            label: 'Dates',
            render: (ticket) => (
              <div className="text-right space-y-1">
                <p className="text-sm text-muted-foreground">
                  Créé le {new Date(ticket.created_at).toLocaleDateString('fr-FR')}
                </p>
                <p className="text-xs text-muted-foreground">
                  Mis à jour: {new Date(ticket.updated_at).toLocaleDateString('fr-FR')}
                </p>
              </div>
            )
          }
        ]}
        
        // Recherche
        searchPlaceholder="Rechercher par référence, nom, num apogee..."
        searchKeys={['reference', 'student.first_name', 'student.last_name', 'student.email', 'student.num_apogee', 'student.academic_year']}
        
        // Filtres
        filters={[
          {
            key: 'status',
            label: 'Statut',
            type: 'select',
            options: statusOptions
          },
          {
            key: 'formation',
            label: 'Formation',
            type: 'select',
            options: formationOptions
          },
          {
            key: 'academicYear',
            label: 'Année universitaire',
            type: 'select',
            options: academicYearOptions
          }
        ]}
        onFilterChange={(filters) => setActiveFilters(filters)}
        
        // Click sur une ligne
        onItemClick={(ticket) => navigate(`/dossier/${ticket.id}`)}
        
        // Actions sur les lignes
        rowActions={isAgent ? [
          {
            label: 'Supprimer',
            icon: <Trash2 className="h-4 w-4" />,
            variant: 'ghost',
            onClick: async (ticket) => {
              if (confirm(`Supprimer le dossier ${ticket.reference} ?`)) {
                await deleteTicket(ticket.id);
              }
            }
          }
        ] : []}
        
        // Actions en masse
        bulkActions={isAgent ? {
          delete: {
            enabled: true,
            onDelete: handleDelete,
            isDeleting: isDeleting
          }
        } : undefined}
        
        // ✅ Actions personnalisées dans le header
        customHeaderActions={
          isAgent ? (
            <>
              <Button variant="outline" onClick={() => setShowImportDialog(true)}>
                <Upload size={16} className="mr-2" />
                Importer
              </Button>
              <Button variant="default" onClick={() => navigate('/dossiers/create-advanced')} className="mr-2">
                <Clock size={16} className="mr-2" />
                Dossier Existant
              </Button>
              <Button variant="default" onClick={() => navigate('/dossiers/create')}>
                <Plus size={16} className="mr-2" />
                Nouveau Dossier
              </Button>
            </>
          ) : null
        }
        
        // Pagination
        pagination={{
          enabled: true,
          defaultPageSize: 10,
          pageSizeOptions: [5, 10, 20, 50, 100]
        }}
        
        // État vide
        emptyState={{
          icon: <Ticket className="h-12 w-12 mb-4 opacity-50" />,
          message: 'Aucun dossier trouvé'
        }}
      />

      {/* ✅ Dialog d'import en dehors du DataTable */}
      {isAgent && (
        <TicketImportDialog 
          isOpen={showImportDialog}
          onClose={() => setShowImportDialog(false)}
        />
      )}
    </DashboardLayout>
  );
}