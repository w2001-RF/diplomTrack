import { Ticket, STATUS_LABELS } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { getStatusBadgeVariant } from '@/data/mockData';
import { Calendar, User, FileText, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TicketCardProps {
  ticket: Ticket;
  onClick?: () => void;
}

export function TicketCard({ ticket, onClick }: TicketCardProps) {
  const statusVariant = getStatusBadgeVariant(ticket.status);
  const validatedDocs = ticket.documents.filter(d => d.status === 'VALIDATED').length;
  const totalDocs = ticket.documents.length;

  return (
    <Card 
      className={cn(
        "p-4 cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/20 group",
        "animate-fade-in"
      )}
      onClick={onClick}
      style={{ animationDelay: '0.1s' }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-3 mb-2">
            <span className="font-semibold text-foreground">{ticket.reference}</span>
            <Badge variant={statusVariant as any}>
              {STATUS_LABELS[ticket.status]}
            </Badge>
          </div>

          {/* Student info */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <User size={14} />
            <span>{ticket.student.prenom} {ticket.student.nom}</span>
            <span className="text-border">•</span>
            <span>{ticket.student.formation}</span>
            <span className="text-border">•</span>
            <Badge variant="outline" className="text-xs py-0">
              {ticket.student.typeFormation}
            </Badge>
          </div>

          {/* Meta info */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar size={12} />
              <span>Créé le {new Date(ticket.createdAt).toLocaleDateString('fr-FR')}</span>
            </div>
            <div className="flex items-center gap-1">
              <FileText size={12} />
              <span>{validatedDocs}/{totalDocs} documents validés</span>
            </div>
          </div>
        </div>

        {/* Arrow */}
        <div className="flex items-center text-muted-foreground group-hover:text-primary transition-colors">
          <ChevronRight size={20} />
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-4">
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div 
            className={cn(
              "h-full rounded-full transition-all duration-500",
              statusVariant === 'validated' && "bg-status-validated",
              statusVariant === 'blocked' && "bg-status-blocked",
              statusVariant === 'rejected' && "bg-status-rejected",
              statusVariant === 'in-progress' && "bg-status-in-progress",
              statusVariant === 'pending' && "bg-status-pending"
            )}
            style={{ width: `${(validatedDocs / Math.max(totalDocs, 1)) * 100}%` }}
          />
        </div>
      </div>
    </Card>
  );
}
