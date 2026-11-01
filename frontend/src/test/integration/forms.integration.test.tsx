// Forms and multi-step pages: StudentForm, EmailTemplateEditor, CreateAdvancedTicket,
// the dossier page's document upload, and MyDossier's contact form.

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Toaster } from 'sonner';
import { StudentForm, type StudentFormData } from '@/components/students/StudentForm';
import { EmailTemplateEditor } from '@/components/admin/EmailTemplateEditor';
import CreateAdvancedTicket from '@/pages/CreateAdvancedTicket';
import TicketDetail from '@/pages/TicketDetail';
import MyDossier from '@/pages/MyDossier';
import AgentTickets from '@/pages/AgentTickets';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { UserRole } from '@/constants/roles';
import { getAnneeUniversitaires } from '@/data/formations';
import { API, server, tokenFor, users } from '@/test/server';
import { queryWrapper, renderWithProviders } from '@/test/utils';

type Call = { method: string; path: string; body?: unknown };

function recorder() {
  const calls: Call[] = [];
  const record = async (request: Request) => {
    const body = await request.clone().json().catch(() => undefined);
    calls.push({ method: request.method, path: new URL(request.url).pathname.replace('/api', ''), body });
  };
  return { calls, record };
}

const FORMATIONS = [
  { id: 1, formation_name: 'Génie logiciel', formation_type: { id: 1, code: 'LUS', label: 'Licence' } },
  { id: 2, formation_name: 'Data science', formation_type: { id: 2, code: 'MUS', label: 'Master' } },
  { id: 3, formation_name: 'Réseaux', formation_type: { id: 1, code: 'LUS', label: 'Licence' } },
];

const milestone = (id: number, code: string, label: string) => ({ id, code, label, order: id, is_terminal: code === 'DOSSIER_CLOTURE', description: null });
const MILESTONES = [
  milestone(1, 'CREATED', 'Créé'),
  milestone(2, 'ATTENTE_DIPLOME', 'En attente du diplôme'),
  milestone(3, 'DOSSIER_EN_COURS', 'Dossier en cours'),
  milestone(4, 'PIECES_COMPLETES', 'Pièces complètes'),
  milestone(5, 'EN_ATTENTE_REPONSE', 'En attente de réponse'),
  milestone(6, 'REPONSE_RECUE', 'Réponse reçue'),
  milestone(7, 'DOSSIER_CLOTURE', 'Dossier clôturé'),
];

const student = {
  id: 7, user_id: users.student.id, first_name: 'Karim', last_name: 'Parcours', email: 'etudiant@uit.ac.ma',
  num_apogee: 20261234, academic_year: '2025-2026', formation_id: 1, formation: FORMATIONS[0],
};

function referenceData() {
  server.use(
    http.get(`${API}/formations`, () => HttpResponse.json({ data: FORMATIONS, count: FORMATIONS.length })),
    http.get(`${API}/milestones`, () => HttpResponse.json({ data: MILESTONES, count: MILESTONES.length })),
    http.get(`${API}/students`, () => HttpResponse.json({ students: [student], total: 1, page: 1 })),
    http.get(`${API}/notifications`, () => HttpResponse.json([])),
    http.get(`${API}/profiles`, () => HttpResponse.json({ data: [], count: 0 })),
  );
}

describe('StudentForm', () => {
  const blank: StudentFormData = { first_name: '', last_name: '', num_apogee: '', email: '', formation_id: '', academic_year: '' };

  function renderForm(props: Partial<Parameters<typeof StudentForm>[0]> = {}) {
    const onSubmit = vi.fn(async () => {});
    const onCancel = vi.fn();
    render(<StudentForm onSubmit={onSubmit} onCancel={onCancel} isSubmitting={false} {...props} />, { wrapper: queryWrapper() });
    return { onSubmit, onCancel };
  }

  it('offers only the formations of the chosen type and submits the typed fields', async () => {
    referenceData();
    const user = userEvent.setup({ delay: null }); // many keystrokes
    const { onSubmit } = renderForm();
    const [typeSelect, formationSelect, yearSelect] = screen.getAllByRole('combobox');

    expect(formationSelect).toBeDisabled();
    await user.type(screen.getByLabelText(/Prénom/), 'Salma');
    await user.type(screen.getByLabelText(/^Nom/), 'Idrissi');
    await user.type(screen.getByLabelText(/apogée/), '2026001');
    await user.type(screen.getByLabelText('Email'), 'salma@uit.ac.ma');

    await user.click(typeSelect);
    await user.click(await screen.findByRole('option', { name: 'MUS' }));
    await waitFor(() => expect(formationSelect).toBeEnabled());
    await user.click(formationSelect);
    const options = (await screen.findAllByRole('option')).map((o) => o.textContent);
    expect(options).toEqual(['Data science']);
    await user.click(screen.getByRole('option', { name: 'Data science' }));

    const year = getAnneeUniversitaires()[0];
    await user.click(yearSelect);
    await user.click(await screen.findByRole('option', { name: year }));
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(onSubmit).toHaveBeenCalledWith({
      first_name: 'Salma', last_name: 'Idrissi', num_apogee: '2026001', email: 'salma@uit.ac.ma',
      formation_id: '2', academic_year: year,
    });
  });

  it('derives the formation type when editing and clears the formation when the type changes', async () => {
    referenceData();
    const user = userEvent.setup();
    const { onSubmit } = renderForm({
      initialData: { ...blank, first_name: 'Karim', last_name: 'Parcours', formation_id: '3', academic_year: '2025-2026' },
      submitLabel: 'Mettre à jour',
    });
    const [typeSelect, formationSelect] = screen.getAllByRole('combobox');

    await waitFor(() => expect(typeSelect).toHaveTextContent('LUS'));
    await waitFor(() => expect(formationSelect).toHaveTextContent('Réseaux'));

    await user.click(typeSelect);
    await user.click(await screen.findByRole('option', { name: 'MUS' }));
    await user.click(screen.getByRole('button', { name: 'Mettre à jour' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ first_name: 'Karim', formation_id: '' }));
  });

  it('cancels without submitting', async () => {
    referenceData();
    const user = userEvent.setup();
    const { onSubmit, onCancel } = renderForm();

    await user.click(screen.getByRole('button', { name: 'Annuler' }));

    expect(onCancel).toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('EmailTemplateEditor', () => {
  function renderEditor() {
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(
      <EmailTemplateEditor
        isOpen
        onClose={onClose}
        onSave={onSave}
        templateKey="ticket_completed"
        templateTitle="Dossier complet"
        subjectValue="Votre dossier {ticket_reference}"
        bodyValue="<p>Bonjour </p>"
        variables={['student_name', 'ticket_reference']}
      />
    );
    return { onSave, onClose };
  }

  it('saves the edited subject and body', async () => {
    const user = userEvent.setup();
    const { onSave, onClose } = renderEditor();

    const subject = screen.getByLabelText("Sujet de l'email");
    await user.clear(subject);
    await user.type(subject, 'Dossier prêt');
    fireEvent.change(screen.getByLabelText('Contenu HTML'), { target: { value: '<p>Prêt</p>' } });
    await user.click(screen.getByRole('button', { name: /Enregistrer/ }));

    expect(onSave).toHaveBeenCalledWith('Dossier prêt', '<p>Prêt</p>');
    expect(onClose).toHaveBeenCalled();
  });

  it('inserts a variable at the cursor', async () => {
    const user = userEvent.setup();
    const { onSave } = renderEditor();
    const body = screen.getByLabelText('Contenu HTML') as HTMLTextAreaElement;

    body.setSelectionRange(11, 11); // after "<p>Bonjour "
    await user.click(screen.getByText('{student_name}'));
    await user.click(screen.getByRole('button', { name: /Enregistrer/ }));

    expect(onSave).toHaveBeenCalledWith('Votre dossier {ticket_reference}', '<p>Bonjour {student_name}</p>');
  });

  it('previews the template with example values', async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getByText('{student_name}'));
    await user.click(screen.getByRole('tab', { name: /Aperçu/ }));

    expect(await screen.findByText('Ahmed BENALI', { exact: false })).toBeInTheDocument();
  });

  it('discards changes on cancel', async () => {
    const user = userEvent.setup();
    const { onSave, onClose } = renderEditor();

    await user.type(screen.getByLabelText("Sujet de l'email"), ' modifié');
    await user.click(screen.getByRole('button', { name: /Annuler/ }));

    expect(onClose).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe('CreateAdvancedTicket (agent)', () => {
  function open() {
    localStorage.setItem('auth_token', tokenFor(users.agent));
    const { calls, record } = recorder();
    referenceData();
    server.use(
      http.post(`${API}/tickets/create-advanced`, async ({ request }) => {
        await record(request);
        return HttpResponse.json({ id: 9, reference: 'DT-2026-0009' }, { status: 201 });
      })
    );
    renderWithProviders(
      <ProtectedRoute allowedRoles={[UserRole.AGENT]}>
        <CreateAdvancedTicket />
      </ProtectedRoute>,
      { path: '/dossiers/create-advanced' }
    );
    return calls;
  }

  async function pickStudentAndTarget(user: ReturnType<typeof userEvent.setup>, workflowId: string, target: string) {
    await user.click(await screen.findByText('Karim Parcours'));
    await user.click(screen.getByRole('button', { name: 'Suivant' }));
    await user.click(document.getElementById(workflowId)!);
    await user.click(screen.getByRole('button', { name: 'Suivant' }));
    await user.click(await screen.findByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: target }));
    await user.click(screen.getByRole('button', { name: 'Suivant' }));
  }

  it('creates a dossier with one chronology per milestone up to the target', async () => {
    const calls = open();
    const user = userEvent.setup();

    await pickStudentAndTarget(user, 'normal', 'Pièces complètes');
    await user.click(await screen.findByRole('button', { name: /Créer le dossier/ }));

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/dossier/9'));
    const body = calls.find((c) => c.path === '/tickets/create-advanced')?.body as {
      student_id: number; target_milestone_code: string; diploma_validation_type: string; chronologies: { milestone_code: string }[];
    };
    expect(body.student_id).toBe(7);
    expect(body.target_milestone_code).toBe('PIECES_COMPLETES');
    expect(body.diploma_validation_type).toBe('DIPLOMA');
    expect(body.chronologies.map((c) => c.milestone_code)).toEqual(['CREATED', 'DOSSIER_EN_COURS', 'PIECES_COMPLETES']);
  });

  it('marks dossiers of the attestation workflow as ATTESTATION', async () => {
    const calls = open();
    const user = userEvent.setup();

    await pickStudentAndTarget(user, 'attestation', 'En attente du diplôme');
    await user.click(await screen.findByRole('button', { name: /Créer le dossier/ }));

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].body).toMatchObject({
      target_milestone_code: 'ATTENTE_DIPLOME',
      diploma_validation_type: 'ATTESTATION',
      chronologies: [{ milestone_code: 'CREATED' }, { milestone_code: 'ATTENTE_DIPLOME' }],
    });
  });

  it('cannot leave the first step without a student', async () => {
    open();

    expect(await screen.findByRole('button', { name: 'Suivant' })).toBeDisabled();
  });
});

describe('TicketDetail document files (agent)', () => {
  const documents = [
    { id: 11, ticket_id: 5, document_type: 'CIN', file_path: null, is_validated: false, validation_comment: null, validated_by: null, validated_at: null, created_at: '2026-10-02T09:00:00' },
    { id: 12, ticket_id: 5, document_type: 'BAC', file_path: 'ticket_5_BAC_ab12cd34.pdf', is_validated: true, validation_comment: null, validated_by: 2, validated_at: null, created_at: '2026-10-02T09:00:00' },
  ];
  const current = MILESTONES[2];
  const ticket = {
    id: 5, reference: 'DT-2026-0005', status: 'PENDING', current_milestone_id: current.id, current_milestone: current,
    diploma_validation_type: 'DIPLOMA', student, student_id: 7, created_at: '2026-10-01T09:00:00', updated_at: '2026-10-02T09:00:00',
    chronologies: [{ id: 1, ticket_id: 5, milestone_id: current.id, milestone: current, status: 'PENDING', started_at: '2026-10-02T09:00:00', ended_at: null, comment: null }],
  };

  function open() {
    localStorage.setItem('auth_token', tokenFor(users.agent));
    referenceData();
    const downloads: string[] = [];
    server.use(
      http.get(`${API}/tickets/:id`, () => HttpResponse.json(ticket)),
      http.get(`${API}/ticket_milestone_history`, () => HttpResponse.json([])),
      http.get(`${API}/documents`, () => HttpResponse.json({ documents, total: documents.length })),
      http.get(`${API}/documents/:id/file`, ({ params }) => {
        downloads.push(String(params.id));
        return new HttpResponse(new Blob(['%PDF']), { headers: { 'Content-Type': 'application/pdf' } });
      })
    );
    renderWithProviders(
      <ProtectedRoute allowedRoles={[UserRole.AGENT]}>
        <TicketDetail />
        <Toaster />
      </ProtectedRoute>,
      { path: '/dossier/:id', initialPath: '/dossier/5' }
    );
    return { downloads };
  }

  it('uploads a scanned file for a document as multipart form data', async () => {
    open();
    // jsdom's FormData is not one Node's fetch (hence MSW) can read, so look at what the app hands fetch
    const uploads: { url: string; method?: string; form: FormData }[] = [];
    const realFetch = globalThis.fetch;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      if (init?.body instanceof FormData) {
        uploads.push({ url: String(input), method: init.method, form: init.body });
        return HttpResponse.json({ ...documents[0], file_path: 'ticket_5_CIN_00000000.pdf' }, { status: 201 });
      }
      return realFetch(input, init);
    });
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Téléverser CIN' }));
    const dialog = await screen.findByRole('dialog');
    const send = within(dialog).getByRole('button', { name: 'Téléverser' });
    expect(send).toBeDisabled();
    await user.upload(within(dialog).getByLabelText('Fichier'), new File(['%PDF'], 'cin.pdf', { type: 'application/pdf' }));
    await user.click(send);

    await waitFor(() => expect(uploads).toHaveLength(1));
    const [{ url, method, form }] = uploads;
    expect([method, new URL(url, 'http://x').pathname]).toEqual(['POST', '/api/documents']);
    expect([form.get('ticket_id'), form.get('document_type'), (form.get('file') as File).name]).toEqual(['5', 'CIN', 'cin.pdf']);
    expect(await screen.findByText('Document téléversé avec succès')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fetchSpy.mockRestore();
  });

  it('opens a stored file and offers no viewer for a document without one', async () => {
    const createObjectURL = vi.fn(() => 'blob:scan');
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
    const windowOpen = vi.spyOn(window, 'open').mockReturnValue(null);
    const { downloads } = open();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Voir BAC' }));

    await waitFor(() => expect(windowOpen).toHaveBeenCalledWith('blob:scan', '_blank', 'noopener'));
    expect(downloads).toEqual(['12']);
    expect(screen.queryByRole('button', { name: 'Voir CIN' })).not.toBeInTheDocument();
    windowOpen.mockRestore();
  });
});

describe('MyDossier contact details (student)', () => {
  it('saves the email to the profile of the signed-in user', async () => {
    localStorage.setItem('auth_token', tokenFor(users.student));
    referenceData();
    const { calls, record } = recorder();
    server.use(
      http.get(`${API}/tickets`, () => HttpResponse.json({ tickets: [], total: 0, pages: 1, page: 1, length: 100 })),
      http.put(`${API}/profiles/:id`, async ({ request }) => {
        await record(request);
        return HttpResponse.json({});
      })
    );
    const user = userEvent.setup();
    renderWithProviders(
      <ProtectedRoute allowedRoles={[UserRole.STUDENT]}>
        <MyDossier />
        <Toaster />
      </ProtectedRoute>,
      { path: '/my-dossier' }
    );

    await user.click(await screen.findByRole('button', { name: /Modifier/ }));
    const email = await screen.findByLabelText('Email');
    expect(email).toHaveValue('etudiant@uit.ac.ma');
    await user.clear(email);
    await user.type(email, 'karim@uit.ac.ma');
    await user.click(screen.getByRole('button', { name: /Enregistrer/ }));

    // The student record is id 7; the profile shares the user's id
    await waitFor(() => expect(calls).toEqual([
      { method: 'PUT', path: `/profiles/${users.student.id}`, body: { email: 'karim@uit.ac.ma' } },
    ]));
  });
});

describe('AgentTickets search', () => {
  it('finds dossiers by a nested student field', async () => {
    localStorage.setItem('auth_token', tokenFor(users.agent));
    referenceData();
    const row = (id: number, last_name: string) => ({
      id, reference: `DT-${id}`, status: 'PENDING', current_milestone: MILESTONES[2],
      student: { ...student, id, last_name }, created_at: '2026-10-01T09:00:00', updated_at: '2026-10-02T09:00:00',
    });
    server.use(
      http.get(`${API}/tickets`, () =>
        HttpResponse.json({ tickets: [row(1, 'Parcours'), row(2, 'Bennani')], total: 2, pages: 1, page: 1, length: 100 })
      )
    );
    const user = userEvent.setup();
    renderWithProviders(
      <ProtectedRoute allowedRoles={[UserRole.AGENT]}>
        <AgentTickets />
      </ProtectedRoute>,
      { path: '/dossiers' }
    );

    expect(await screen.findByText('DT-2')).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText(/Rechercher par référence/), 'benna');

    await waitFor(() => expect(screen.queryByText('DT-1')).not.toBeInTheDocument());
    expect(screen.getByText('DT-2')).toBeInTheDocument();
  });
});
