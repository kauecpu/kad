import {
  BarChart3,
  Bell,
  BookOpenCheck,
  BriefcaseBusiness,
  CircleUserRound,
  ClipboardList,
  LogOut,
  Menu,
  MessageSquareText,
  Search,
  Settings,
  ShieldCheck,
  UsersRound,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';

import { Brand } from '../components/brand';
import { useAuth } from '../context/auth-context';

const navigation = [
  { label: 'Visão geral', to: '/', icon: BarChart3, permission: 'dashboard.read' },
  { label: 'Concursos', to: '/concursos', icon: BriefcaseBusiness, permission: 'content.read' },
  { label: 'Banco de questões', to: '/questoes', icon: BookOpenCheck, permission: 'content.read' },
  { label: 'Comunidade', to: '/comunidade', icon: MessageSquareText, permission: 'community.read' },
  { label: 'Usuários', to: '/usuarios', icon: UsersRound, permission: 'users.read' },
  { label: 'Auditoria', to: '/auditoria', icon: ClipboardList, permission: 'audit.read' },
];

const roleNames = {
  owner: 'Proprietário',
  admin: 'Administrador',
  editor: 'Editor de conteúdo',
  moderator: 'Moderador',
  support: 'Atendimento',
};

export function AdminLayout() {
  const { access, isPreview, signOut, user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setMenuOpen(false), [location.pathname]);

  const displayEmail = isPreview ? 'Sessão local' : user?.email ?? 'Administrador';
  const displayRole = isPreview
    ? 'Sem autenticação ou dados reais'
    : access
      ? roleNames[access.role]
      : 'Sem permissão';
  const visibleNavigation = navigation.filter(
    (item) => access?.permissions.includes(item.permission),
  );

  return (
    <div className="admin-shell">
      <button
        type="button"
        className={`sidebar-backdrop ${menuOpen ? 'sidebar-backdrop--visible' : ''}`}
        aria-label="Fechar menu"
        onClick={() => setMenuOpen(false)}
      />

      <aside className={`sidebar ${menuOpen ? 'sidebar--open' : ''}`}>
        <div className="sidebar__header">
          <Brand />
          <button
            type="button"
            className="icon-button sidebar__close"
            aria-label="Fechar menu"
            onClick={() => setMenuOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar__nav" aria-label="Navegação administrativa">
          <span className="sidebar__eyebrow">OPERAÇÃO</span>
          {visibleNavigation.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `nav-item ${isActive ? 'nav-item--active' : ''}`
                }>
                <Icon size={19} strokeWidth={1.8} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="sidebar__footer">
          <NavLink to="/configuracoes" className="nav-item">
            <Settings size={19} strokeWidth={1.8} />
            <span>Configurações</span>
          </NavLink>
          <div className="sidebar__security">
            <ShieldCheck size={17} />
            <span>Acesso protegido por função</span>
          </div>
        </div>
      </aside>

      <div className="admin-main">
        <header className="topbar">
          <div className="topbar__left">
            <button
              type="button"
              className="icon-button topbar__menu"
              aria-label="Abrir menu"
              onClick={() => setMenuOpen(true)}>
              <Menu size={21} />
            </button>
            <div className="search-shell">
              <Search size={18} aria-hidden="true" />
              <input aria-label="Busca disponível em breve" placeholder="Busca disponível em breve" disabled />
            </div>
          </div>

          <div className="topbar__actions">
            {isPreview ? <span className="preview-badge">MODO LOCAL · SEM DADOS REAIS</span> : null}
            <button type="button" className="icon-button" aria-label="Notificações em breve" disabled title="Notificações em breve">
              <Bell size={19} />
            </button>
            <div className="account-menu">
              <div className="account-menu__avatar">
                <CircleUserRound size={20} />
              </div>
              <div className="account-menu__text">
                <strong>{displayEmail}</strong>
                <span>{displayRole}</span>
              </div>
            </div>
            <button type="button" className="icon-button" aria-label="Sair" onClick={signOut} disabled={isPreview} title={isPreview ? 'Indisponível na prévia local' : 'Sair'}>
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <main className="page-container">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
