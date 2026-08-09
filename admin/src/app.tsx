import { LoaderCircle } from 'lucide-react';
import { Navigate, Route, Routes } from 'react-router';

import { useAuth } from './context/auth-context';
import { AdminLayout } from './layout/admin-layout';
import { DashboardPage } from './pages/dashboard-page';
import { ConcursosPage } from './pages/concursos-page';
import { LoginPage } from './pages/login-page';
import { ModulePage } from './pages/module-page';
import { NewPasswordPage } from './pages/new-password-page';
import { RecoverPasswordPage } from './pages/recover-password-page';
import { SettingsPage } from './pages/settings-page';

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
      <Route path="/recuperar-senha" element={<RecoverPasswordPage />} />
      <Route path="/auth/nova-senha" element={<NewPasswordPage />} />
      <Route element={access ? <AdminLayout /> : <Navigate to="/login" replace />}>
        <Route index element={<DashboardPage />} />
        <Route path="concursos" element={<ConcursosPage />} />
        <Route path="questoes" element={<ModulePage kind="questoes" />} />
        <Route path="comunidade" element={<ModulePage kind="comunidade" />} />
        <Route path="usuarios" element={<ModulePage kind="usuarios" />} />
        <Route path="auditoria" element={<ModulePage kind="auditoria" />} />
        <Route path="configuracoes" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to={access ? '/' : '/login'} replace />} />
    </Routes>
  );
}
