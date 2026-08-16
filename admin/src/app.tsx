import { LoaderCircle } from 'lucide-react';
import { Navigate, Route, Routes } from 'react-router';

import { useAuth } from './context/auth-context';
import { AdminLayout } from './layout/admin-layout';
import { DashboardPage } from './pages/dashboard-page';
import { ConcursosPage } from './pages/concursos-page';
import { LoginPage } from './pages/login-page';
import { ImportsPage } from './pages/imports-page';
import { ModulePage } from './pages/module-page';
import { QuestionsPage } from './pages/questions-page';
import { SettingsPage } from './pages/settings-page';
import { FeedbackPage } from './pages/feedback-page';

export function App() {
  const { access, loading } = useAuth();

  if (loading) {
    return (
      <div className="app-loading" role="status">
        <LoaderCircle size={28} className="spin" />
        <span>Validando acesso administrativo…</span>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={access ? <AdminLayout /> : <Navigate to="/login" replace />}>
        <Route index element={<DashboardPage />} />
        <Route path="concursos" element={<ConcursosPage />} />
        <Route path="questoes" element={<QuestionsPage />} />
        <Route path="importacoes" element={<ImportsPage />} />
        <Route
          path="feedback"
          element={access?.permissions.includes('feedback.read') ? <FeedbackPage /> : <Navigate to="/" replace />}
        />
        <Route path="comunidade" element={<ModulePage kind="comunidade" />} />
        <Route path="usuarios" element={<ModulePage kind="usuarios" />} />
        <Route path="auditoria" element={<ModulePage kind="auditoria" />} />
        <Route path="configuracoes" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to={access ? '/' : '/login'} replace />} />
    </Routes>
  );
}
