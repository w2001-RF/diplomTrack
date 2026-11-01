import type { TicketStatus } from '@/lib/api/models';

/**
 * The milestone a ticket is on. The API's `status` is only OPEN | PENDING |
 * COMPLETED; the workflow position is `current_milestone.code`.
 */
export function milestoneCodeOf(
  ticket: { status?: string; current_milestone?: { code?: string } | null } | null | undefined
): TicketStatus | undefined {
  return ticket?.current_milestone?.code as TicketStatus | undefined;
}

/** French label of every milestone code */
export const STATUS_LABELS: Record<TicketStatus, string> = {
  CREATED: 'Créé',
  DOSSIER_EN_COURS: 'Dossier en cours',
  ATTENTE_CORRECTION_DOCS: 'En attente de correction',
  DOCS_CORRIGES_SOUMIS: 'Documents corrigés soumis',
  ATTENTE_DIPLOME: 'En attente du diplôme',
  DIPLOME_DEPOSE: 'Diplôme déposé',
  DIPLOME_ENVOYE_CENTRE: 'Diplôme envoyé au centre',
  VALIDATION_CENTRE_RECUE: 'Validation du centre reçue',
  PIECES_COMPLETES: 'Pièces complètes',
  EN_ATTENTE_REPONSE: 'En attente de réponse',
  REPONSE_RECUE: 'Réponse reçue',
  DOSSIER_CLOTURE: 'Dossier clôturé',
  BLOQUE_PIECE_MANQUANTE: 'Bloqué - pièce manquante',
  REJETE: 'Rejeté',
  ARCHIVE: 'Archivé',
};
