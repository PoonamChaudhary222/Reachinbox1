import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate, useParams } from 'react-router-dom';
import { EmailDetailView } from '../components/EmailDetails/EmailDetailView';
import { Spinner } from '../components/Loading/Spinner';
import { useAuth } from '../context/AuthContext';
import { extractErrorMessage } from '../services/api';
import { emailService } from '../services/emailService';
import { EmailRecord } from '../types';

export default function EmailDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [email, setEmail] = useState<EmailRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    emailService
      .getEmailById(id)
      .then(setEmail)
      .catch((err) => setError(extractErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [id]);

  const handleToggleStar = async () => {
    if (!email) return;
    try {
      const updated = await emailService.toggleStar(email.id);
      setEmail(updated);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  const handleCancelOrDelete = async () => {
    if (!email) return;
    try {
      const res = await emailService.cancelOrDelete(email.id);
      toast.success(res.action === 'cancelled' ? 'Scheduled email cancelled' : 'Email deleted');
      navigate(-1);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <Spinner size="lg" label="Loading email..." />
      </div>
    );
  }

  if (error || !email) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-white px-4">
        <p className="text-sm text-red-600">{error || 'Email not found.'}</p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="mt-3 rounded-full border border-gray-200 px-4 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
        >
          Back to Inbox
        </button>
      </div>
    );
  }

  return (
    <EmailDetailView
      email={email}
      userAvatar={user?.avatar}
      userName={user?.name}
      onBack={() => navigate(-1)}
      onToggleStar={handleToggleStar}
      onCancelOrDelete={handleCancelOrDelete}
    />
  );
}
