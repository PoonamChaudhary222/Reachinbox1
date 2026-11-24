import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '../context/AuthContext';
import { extractErrorMessage } from '../services/api';
import { authService } from '../services/authService';

const authFormSchema = z.object({
  name: z.string().optional(),
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type AuthFormValues = z.infer<typeof authFormSchema>;

export default function Login() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AuthFormValues>({
    resolver: zodResolver(authFormSchema),
  });

  useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    const oauthErr = searchParams.get('error');
    if (oauthErr) {
      setErrorMsg(decodeURIComponent(oauthErr));
    }
  }, [searchParams]);

  const handleGoogleLogin = () => {
    window.location.href = authService.getGoogleOAuthRedirectUrl();
  };

  const onSubmit = async (values: AuthFormValues) => {
    setErrorMsg(null);
    try {
      if (mode === 'register') {
        if (!values.name || values.name.trim().length < 2) {
          setErrorMsg('Name must be at least 2 characters.');
          return;
        }
        if (values.password.length < 8) {
          setErrorMsg('Password must be at least 8 characters for registration.');
          return;
        }
        const registeredUser = await authService.registerWithPassword(
          values.name.trim(),
          values.email,
          values.password
        );
        setUser(registeredUser);
        toast.success('Account created successfully');
      } else {
        const loggedUser = await authService.loginWithPassword(
          values.email,
          values.password
        );
        setUser(loggedUser);
        toast.success('Logged in successfully');
      }
      navigate('/', { replace: true });
    } catch (err) {
      const msg = extractErrorMessage(err);
      setErrorMsg(msg);
      toast.error(msg);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="w-full max-w-[356px] rounded-xl border border-gray-200 bg-white px-7 py-8 shadow-sm">
        <h1 className="mb-5 text-center text-[18px] font-semibold text-gray-900">
          {mode === 'login' ? 'Login' : 'Create Account'}
        </h1>

        {errorMsg && (
          <div
            role="alert"
            className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
          >
            {errorMsg}
          </div>
        )}

        <button
          type="button"
          onClick={handleGoogleLogin}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-[#E8F7EE] px-4 py-2.5 text-xs font-medium text-gray-800 hover:bg-[#DAF2E3] transition-colors"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
            />
            <path
              fill="#FBBC05"
              d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
            />
          </svg>
          Login with Google
        </button>

        <div className="my-4 flex items-center gap-2">
          <div className="h-px flex-1 bg-gray-100" />
          <span className="text-[11px] text-gray-400">or sign up through email</span>
          <div className="h-px flex-1 bg-gray-100" />
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          {mode === 'register' && (
            <div>
              <input
                type="text"
                placeholder="Full Name"
                {...register('name')}
                className="w-full rounded-md border border-gray-200 bg-[#F7F8FA] px-3 py-2 text-xs text-gray-900 placeholder-gray-400 focus:border-[#00A838] focus:bg-white focus:outline-none"
              />
            </div>
          )}

          <div>
            <input
              type="email"
              placeholder="Email ID"
              {...register('email')}
              className="w-full rounded-md border border-gray-200 bg-[#F7F8FA] px-3 py-2 text-xs text-gray-900 placeholder-gray-400 focus:border-[#00A838] focus:bg-white focus:outline-none"
            />
            {errors.email && (
              <p className="mt-1 text-[11px] text-red-500">{errors.email.message}</p>
            )}
          </div>

          <div>
            <input
              type="password"
              placeholder="Password"
              {...register('password')}
              className="w-full rounded-md border border-gray-200 bg-[#F7F8FA] px-3 py-2 text-xs text-gray-900 placeholder-gray-400 focus:border-[#00A838] focus:bg-white focus:outline-none"
            />
            {errors.password && (
              <p className="mt-1 text-[11px] text-red-500">{errors.password.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-[#00A838] py-2 text-xs font-medium text-white hover:bg-[#008F30] disabled:opacity-60 transition-colors"
          >
            {isSubmitting
              ? 'Please wait...'
              : mode === 'login'
              ? 'Login'
              : 'Create Account'}
          </button>
        </form>

        <div className="mt-4 text-center text-[11px] text-gray-500">
          {mode === 'login' ? (
            <>
              Need an email account?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setErrorMsg(null);
                }}
                className="font-medium text-[#00A838] hover:underline"
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrorMsg(null);
                }}
                className="font-medium text-[#00A838] hover:underline"
              >
                Login
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
