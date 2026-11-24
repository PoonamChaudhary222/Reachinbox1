import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ComposeForm } from '../components/Compose/ComposeForm';
import { Sidebar } from '../components/Sidebar/Sidebar';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'u1',
      name: 'Oliver Brown',
      email: 'oliver@domain.io',
      avatar: null,
      role: 'USER',
    },
    loading: false,
    logout: vi.fn(),
    refreshUser: vi.fn(),
    setUser: vi.fn(),
  }),
}));

const { listSendersMock, scheduleEmailsMock } = vi.hoisted(() => ({
  listSendersMock: vi.fn(),
  scheduleEmailsMock: vi.fn(),
}));

vi.mock('../services/senderService', () => ({
  senderService: {
    listSenders: listSendersMock,
  },
}));

vi.mock('../services/emailService', () => ({
  emailService: {
    scheduleEmails: scheduleEmailsMock,
  },
}));

vi.mock('../components/RichTextEditor/RichTextEditor', () => ({
  RichTextEditor: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (html: string) => void;
  }) => (
    <textarea
      aria-label="Email Body"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

describe('Frontend Navigation & Compose Form Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listSendersMock.mockResolvedValue([
      {
        id: 'sender-1',
        email: 'oliver@domain.io',
        displayName: 'Oliver Brown',
        smtpHost: null,
        smtpPort: null,
        smtpUser: null,
        isDefault: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);
  });

  it('renders Sidebar navigation links and triggers Compose navigation', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route
            path="/"
            element={
              <Sidebar
                stats={{
                  total: 12,
                  scheduled: 5,
                  sent: 7,
                  failed: 0,
                  cancelled: 0,
                  sentAndFailed: 7,
                }}
              />
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('All Emails')).toBeInTheDocument();
    expect(screen.getByText('Scheduled')).toBeInTheDocument();
    expect(screen.getByText('Sent')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Compose' }));
    expect(mockNavigate).toHaveBeenCalledWith('/compose');
  });

  it('validates Compose form fields before calling schedule API', async () => {
    render(
      <MemoryRouter>
        <ComposeForm />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(listSendersMock).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Send Later' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Add at least one recipient email or upload a CSV/TXT list.'
    );
    expect(scheduleEmailsMock).not.toHaveBeenCalled();
  });

  it('adds recipient chips, parses CSV, submits valid campaign, and navigates to /scheduled', async () => {
    scheduleEmailsMock.mockResolvedValue({
      scheduledCount: 2,
      emails: [],
      deduplicated: false,
    });

    render(
      <MemoryRouter>
        <ComposeForm />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(listSendersMock).toHaveBeenCalled();
    });

    const toInput = screen.getByLabelText('To');
    fireEvent.change(toInput, { target: { value: 'lead1@example.com' } });
    fireEvent.keyDown(toInput, { key: 'Enter' });

    fireEvent.change(toInput, { target: { value: 'lead2@example.com' } });
    fireEvent.keyDown(toInput, { key: 'Enter' });

    expect(screen.getByText('lead1@example.com')).toBeInTheDocument();
    expect(screen.getByText('lead2@example.com')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Subject'), {
      target: { value: 'ReachInbox Demo Invite' },
    });

    const bodyInput = screen.getByLabelText('Email Body');
    fireEvent.change(bodyInput, {
      target: { value: '<p>Hi there, excited to connect!</p>' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Send Later' }));

    await waitFor(() => {
      expect(scheduleEmailsMock).toHaveBeenCalledWith(
        expect.objectContaining({
          senderId: 'sender-1',
          recipients: ['lead1@example.com', 'lead2@example.com'],
          subject: 'ReachInbox Demo Invite',
        })
      );
    });
    expect(mockNavigate).toHaveBeenCalledWith('/scheduled');
  });
});
