import type { FormEventHandler, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ShieldCheck } from 'lucide-react';

import { Brand } from './brand';

type AuthShellProps = {
  children: ReactNode;
  description: string;
  icon: LucideIcon;
  onSubmit: FormEventHandler<HTMLFormElement>;
  title: string;
};

export function AuthShell({ children, description, icon: Icon, onSubmit, title }: AuthShellProps) {
  return (
    <div className="login-page">
      <section className="login-brand-panel">
        <div className="login-brand-panel__content">
          <Brand />
          <div className="login-brand-panel__copy">
            <span className="login-eyebrow">CENTRAL DE OPERAÇÕES</span>
            <h1>Decisões melhores começam com uma operação clara.</h1>
            <p>
              Conteúdo, comunidade e usuários do KAD reunidos em um ambiente separado e
              protegido.
            </p>
          </div>
          <div className="login-security-note">
            <ShieldCheck size={20} />
            <div>
              <strong>Acesso restrito</strong>
              <span>Cada ação administrativa será associada ao responsável.</span>
            </div>
          </div>
        </div>
        <div className="login-orb login-orb--one" />
        <div className="login-orb login-orb--two" />
      </section>

      <section className="login-form-panel">
        <form className="login-card" onSubmit={onSubmit}>
          <div className="login-card__heading">
            <span className="login-card__icon"><Icon size={22} /></span>
            <div>
              <h2>{title}</h2>
              <p>{description}</p>
            </div>
          </div>
          {children}
        </form>
      </section>
    </div>
  );
}
