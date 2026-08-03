import type { LucideIcon } from 'lucide-react';
import {
  BookOpenCheck,
  BriefcaseBusiness,
  CheckCircle2,
  ClipboardList,
  Database,
  FileSearch,
  MessageSquareText,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';

import { StatusPill } from '../components/status-pill';

export type ModuleKind = 'concursos' | 'questoes' | 'comunidade' | 'usuarios' | 'auditoria';

const moduleContent: Record<ModuleKind, {
  title: string;
  eyebrow: string;
  description: string;
  icon: LucideIcon;
  features: Array<{ title: string; description: string; icon: LucideIcon }>;
  dependency: string;
}> = {
  concursos: {
    title: 'Concursos',
    eyebrow: 'GESTÃO DE OPORTUNIDADES',
    description: 'Cadastre, revise e publique oportunidades com rastreabilidade da fonte oficial.',
    icon: BriefcaseBusiness,
    features: [
      { title: 'Fluxo editorial', description: 'Rascunho, revisão, agendamento e publicação.', icon: CheckCircle2 },
      { title: 'Fonte oficial', description: 'Edital, retificações e histórico de atualizações.', icon: FileSearch },
      { title: 'Dados estruturados', description: 'Cargos, vagas, salários, datas e áreas.', icon: Database },
    ],
    dependency: 'Os concursos atuais ainda estão no arquivo de dados do aplicativo.',
  },
  questoes: {
    title: 'Banco de questões',
    eyebrow: 'CONTEÚDO EDUCACIONAL',
    description: 'Centralize autoria, revisão, gabarito e publicação do acervo do KAD.',
    icon: BookOpenCheck,
    features: [
      { title: 'Editor completo', description: 'Enunciado, alternativas, resposta e explicação.', icon: BookOpenCheck },
      { title: 'Revisão em duas etapas', description: 'Conteúdo só é publicado após validação.', icon: CheckCircle2 },
      { title: 'Importação controlada', description: 'Lotes com validação e relatório de erros.', icon: Database },
    ],
    dependency: 'As questões atuais precisam ser migradas do código para tabelas editoriais.',
  },
  comunidade: {
    title: 'Comunidade',
    eyebrow: 'MODERAÇÃO',
    description: 'Acompanhe conversas, denúncias e decisões de moderação com contexto.',
    icon: MessageSquareText,
    features: [
      { title: 'Fila de análise', description: 'Prioridade por denúncia e risco.', icon: ClipboardList },
      { title: 'Contexto da questão', description: 'Comentário analisado junto ao conteúdo.', icon: FileSearch },
      { title: 'Decisão registrada', description: 'Motivo, responsável e horário da ação.', icon: ShieldCheck },
    ],
    dependency: 'A base de comentários já existe; falta criar as políticas de moderação administrativa.',
  },
  usuarios: {
    title: 'Usuários',
    eyebrow: 'ATENDIMENTO E CONTA',
    description: 'Consulte contas com acesso mínimo necessário e ações administrativas auditadas.',
    icon: UsersRound,
    features: [
      { title: 'Busca segura', description: 'Nome, usuário e identificador da conta.', icon: FileSearch },
      { title: 'Visão de atendimento', description: 'Status e dados estritamente necessários.', icon: UsersRound },
      { title: 'Ações sensíveis', description: 'Suspensão e exclusão via função protegida.', icon: ShieldCheck },
    ],
    dependency: 'A listagem administrativa será exposta por RPC com colunas e papéis limitados.',
  },
  auditoria: {
    title: 'Auditoria',
    eyebrow: 'RASTREABILIDADE',
    description: 'Saiba quem alterou o quê, quando e por qual motivo.',
    icon: ClipboardList,
    features: [
      { title: 'Trilha imutável', description: 'Registro separado dos dados operacionais.', icon: ShieldCheck },
      { title: 'Filtros por recurso', description: 'Usuário, conteúdo, período e responsável.', icon: FileSearch },
      { title: 'Contexto da mudança', description: 'Metadados mínimos, sem guardar segredos.', icon: Database },
    ],
    dependency: 'A tabela de auditoria já está preparada; os próximos CRUDs registrarão ações nela.',
  },
};

export function ModulePage({ kind }: { kind: ModuleKind }) {
  const content = moduleContent[kind];
  const Icon = content.icon;

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="page-eyebrow">{content.eyebrow}</span>
          <h1>{content.title}</h1>
          <p>{content.description}</p>
        </div>
        <StatusPill>Em preparação</StatusPill>
      </section>

      <section className="module-hero">
        <div className="module-hero__icon"><Icon size={30} /></div>
        <div>
          <span className="panel-card__eyebrow">FUNDAÇÃO PRONTA</span>
          <h2>Este módulo já tem lugar, acesso e propósito definidos.</h2>
          <p>{content.dependency}</p>
        </div>
      </section>

      <section className="feature-grid">
        {content.features.map((feature) => {
          const FeatureIcon = feature.icon;
          return (
            <article className="feature-card" key={feature.title}>
              <span className="feature-card__icon"><FeatureIcon size={20} /></span>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </article>
          );
        })}
      </section>

      <section className="empty-workspace">
        <div className="empty-workspace__graphic">
          <Icon size={30} />
        </div>
        <h2>Nenhuma operação disponível ainda</h2>
        <p>
          Esta área será ativada quando as tabelas, permissões e ações auditadas do módulo forem
          adicionadas. Nenhum dado demonstrativo será apresentado como real.
        </p>
      </section>
    </div>
  );
}
