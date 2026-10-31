import { Ticket, Student, Document, Notification, TicketStatus } from '@/types';

export const mockStudents: Student[] = [
  {
    id: 's1',
    cne: 'R130456789',
    nom: 'Benali',
    prenom: 'Ahmed',
    typeFormation: 'LUS',
    formation: 'Génie Informatique',
    anneeUniversitaire: '2023-2024',
    professeurResponsable: 'Pr. El Amrani',
    email: 'ahmed.benali@etu.uit.ac.ma',
    phone: '0612345678',
  },
  {
    id: 's2',
    cne: 'R140567890',
    nom: 'Tazi',
    prenom: 'Fatima',
    typeFormation: 'MUS',
    formation: 'Génie Civil',
    anneeUniversitaire: '2023-2024',
    professeurResponsable: 'Pr. Kadiri',
    email: 'fatima.tazi@etu.uit.ac.ma',
    phone: '0623456789',
  },
  {
    id: 's3',
    cne: 'R150678901',
    nom: 'Alaoui',
    prenom: 'Youssef',
    typeFormation: 'LUS',
    formation: 'Génie Électrique',
    anneeUniversitaire: '2022-2023',
    professeurResponsable: 'Pr. Bennani',
    email: 'youssef.alaoui@etu.uit.ac.ma',
  },
  {
    id: 's4',
    cne: 'R160789012',
    nom: 'Cherkaoui',
    prenom: 'Sara',
    typeFormation: 'MUS',
    formation: 'Génie Industriel',
    anneeUniversitaire: '2023-2024',
    professeurResponsable: 'Pr. Fassi',
    email: 'sara.cherkaoui@etu.uit.ac.ma',
    phone: '0634567890',
  },
];

const createDocuments = (ticketId: string, statuses: Record<string, 'PENDING' | 'VALIDATED' | 'REJECTED'>): Document[] => {
  return Object.entries(statuses).map(([type, status], index) => ({
    id: `${ticketId}-doc-${index}`,
    type: type as Document['type'],
    status,
    fileName: `${type.toLowerCase()}_${ticketId}.pdf`,
    uploadedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
    validatedBy: status === 'VALIDATED' ? 'Agent BFC' : undefined,
    ticketId,
  }));
};

export const mockTickets: Ticket[] = [
  {
    id: 't1',
    reference: 'DT-2024-001',
    status: 'VALIDATION_CFC',
    currentMilestoneId: '4',
    student: mockStudents[0],
    documents: createDocuments('t1', {
      BAC: 'VALIDATED',
      BAC_PLUS_2: 'VALIDATED',
      CIN: 'VALIDATED',
      CONTRAT: 'VALIDATED',
      RECU_PAIEMENT: 'PENDING',
    }),
    createdAt: '2024-01-15T10:30:00Z',
    updatedAt: '2024-01-20T14:45:00Z',
  },
  {
    id: 't2',
    reference: 'DT-2024-002',
    status: 'BLOQUE_PIECE_MANQUANTE',
    currentMilestoneId: '2',
    student: mockStudents[1],
    documents: createDocuments('t2', {
      BAC: 'VALIDATED',
      CIN: 'REJECTED',
    }),
    createdAt: '2024-01-10T09:00:00Z',
    updatedAt: '2024-01-18T11:30:00Z',
  },
  {
    id: 't3',
    reference: 'DT-2024-003',
    status: 'EN_ATTENTE_REPONSE',
    currentMilestoneId: '6',
    student: mockStudents[2],
    documents: createDocuments('t3', {
      BAC: 'VALIDATED',
      BAC_PLUS_2: 'VALIDATED',
      CIN: 'VALIDATED',
      CONTRAT: 'VALIDATED',
      RECU_PAIEMENT: 'VALIDATED',
      RETOUR_CFC: 'VALIDATED',
    }),
    createdAt: '2024-01-05T08:15:00Z',
    updatedAt: '2024-01-22T16:00:00Z',
  },
  {
    id: 't4',
    reference: 'DT-2024-004',
    status: 'DOSSIER_CLOTURE',
    currentMilestoneId: '8',
    student: mockStudents[3],
    documents: createDocuments('t4', {
      BAC: 'VALIDATED',
      BAC_PLUS_2: 'VALIDATED',
      CIN: 'VALIDATED',
      CONTRAT: 'VALIDATED',
      RECU_PAIEMENT: 'VALIDATED',
      RETOUR_CFC: 'VALIDATED',
      PV_DIPLOME: 'VALIDATED',
      ATTESTATION_INSC: 'VALIDATED',
    }),
    createdAt: '2023-12-01T10:00:00Z',
    updatedAt: '2024-01-10T09:00:00Z',
  },
  {
    id: 't5',
    reference: 'DT-2024-005',
    status: 'DOSSIER_EN_COURS',
    currentMilestoneId: '2',
    student: { ...mockStudents[0], id: 's5', cne: 'R170890123', nom: 'Haddad', prenom: 'Karim' },
    documents: createDocuments('t5', {
      BAC: 'PENDING',
      CIN: 'PENDING',
    }),
    createdAt: '2024-01-25T11:00:00Z',
    updatedAt: '2024-01-25T11:00:00Z',
  },
];

export const mockNotifications: Notification[] = [
  {
    id: 'n1',
    type: 'STATUS_CHANGE',
    message: 'Le ticket DT-2024-001 est passé à l\'étape "Validation CFC"',
    recipientId: 'agent1',
    sentAt: '2024-01-20T14:45:00Z',
    read: false,
  },
  {
    id: 'n2',
    type: 'DOCUMENT_REJECTED',
    message: 'La CIN du ticket DT-2024-002 a été rejetée - qualité insuffisante',
    recipientId: 's2',
    sentAt: '2024-01-18T11:30:00Z',
    read: false,
  },
  {
    id: 'n3',
    type: 'DELAY_EXCEEDED',
    message: 'Délai dépassé pour le ticket DT-2024-003 à l\'étape "En attente réponse"',
    recipientId: 'agent1',
    sentAt: '2024-01-22T08:00:00Z',
    read: true,
  },
];

export const getStatusBadgeVariant = (status: TicketStatus) => {
  switch (status) {
    case 'DOSSIER_CLOTURE':
      return 'validated';
    case 'BLOQUE_PIECE_MANQUANTE':
      return 'blocked';
    case 'REJETE':
      return 'rejected';
    case 'EN_ATTENTE_REPONSE':
    case 'ENVOYE_DEPARTEMENT_DIPLOMES':
      return 'in-progress';
    case 'CREATED':
    case 'DOSSIER_EN_COURS':
      return 'pending';
    default:
      return 'in-progress';
  }
};
