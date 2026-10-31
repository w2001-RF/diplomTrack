import { Ticket, MILESTONES, STATUS_LABELS } from '@/types';
import { cn } from '@/lib/utils';
import { CheckCircle2, Circle, AlertCircle } from 'lucide-react';

interface WorkflowTimelineProps {
  ticket: Ticket;
}

export function WorkflowTimeline({ ticket }: WorkflowTimelineProps) {
  const currentMilestoneOrder = MILESTONES.find(m => m.id === ticket.currentMilestoneId)?.ordre || 0;
  
  const isBlocked = ticket.status === 'BLOQUE_PIECE_MANQUANTE';
  const isRejected = ticket.status === 'REJETE';

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground">Progression du dossier</h3>
      
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
        
        {/* Milestones */}
        <div className="space-y-4">
          {MILESTONES.map((milestone, index) => {
            const isCompleted = milestone.ordre < currentMilestoneOrder;
            const isCurrent = milestone.ordre === currentMilestoneOrder;
            const isPending = milestone.ordre > currentMilestoneOrder;

            return (
              <div
                key={milestone.id}
                className={cn(
                  "relative flex items-start gap-4 pl-0",
                  index === MILESTONES.length - 1 && "pb-0"
                )}
              >
                {/* Status icon */}
                <div
                  className={cn(
                    "relative z-10 flex items-center justify-center w-8 h-8 rounded-full transition-all duration-300",
                    isCompleted && "bg-status-validated text-primary-foreground",
                    isCurrent && !isBlocked && !isRejected && "bg-status-in-progress text-primary-foreground animate-pulse-subtle",
                    isCurrent && isBlocked && "bg-status-blocked text-primary-foreground",
                    isCurrent && isRejected && "bg-status-rejected text-primary-foreground",
                    isPending && "bg-muted text-muted-foreground"
                  )}
                >
                  {isCompleted ? (
                    <CheckCircle2 size={18} />
                  ) : isCurrent && (isBlocked || isRejected) ? (
                    <AlertCircle size={18} />
                  ) : (
                    <Circle size={18} />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pt-1">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      isCompleted && "text-foreground",
                      isCurrent && "text-foreground",
                      isPending && "text-muted-foreground"
                    )}
                  >
                    {milestone.label}
                  </p>
                  {isCurrent && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {isBlocked ? 'Bloqué - Pièce manquante' : isRejected ? 'Rejeté' : 'En cours'}
                    </p>
                  )}
                  {milestone.delaiMax > 0 && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Délai max: {milestone.delaiMax} jour{milestone.delaiMax > 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
