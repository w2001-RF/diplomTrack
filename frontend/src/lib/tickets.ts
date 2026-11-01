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
