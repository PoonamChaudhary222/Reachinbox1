import { Toaster } from 'react-hot-toast';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './components/Common/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import ComposeEmail from './pages/ComposeEmail';
import Dashboard from './pages/Dashboard';
import EmailDetails from './pages/EmailDetails';
import Login from './pages/Login';
import ScheduledEmails from './pages/ScheduledEmails';
import SentEmails from './pages/SentEmails';
import Settings from './pages/Settings';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/scheduled"
        element={
          <ProtectedRoute>
            <ScheduledEmails />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sent"
        element={
          <ProtectedRoute>
            <SentEmails />
          </ProtectedRoute>
        }
      />
      <Route
        path="/emails/:id"
        element={
          <ProtectedRoute>
            <EmailDetails />
          </ProtectedRoute>
        }
      />
      <Route
        path="/compose"
        element={
          <ProtectedRoute>
            <ComposeEmail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            style: { fontSize: '12px' },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  );
}
