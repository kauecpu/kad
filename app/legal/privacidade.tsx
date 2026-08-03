import { LegalPage, type LegalSection } from '@/components/legal-page';

const SECTIONS: LegalSection[] = [
  {
    title: 'Escopo e responsável',
    paragraphs: [
      'Esta Política explica como o KAD trata dados pessoais no modo visitante, em contas autenticadas e nos recursos de comunidade. Ela se aplica aos aplicativos e páginas oficiais do serviço.',
      'O responsável que opera o KAD toma as decisões sobre esse tratamento e atua como controlador nos termos da Lei Geral de Proteção de Dados Pessoais (LGPD). Sua identificação completa e o canal formal de privacidade serão publicados antes do lançamento comercial.',
    ],
  },
  {
    title: 'Dados que podemos tratar',
    paragraphs: ['Conforme as funções utilizadas, o KAD pode tratar:'],
    bullets: [
      'Cadastro e perfil: nome, nome de usuário, e-mail, telefone, cidade e cargo desejado.',
      'Autenticação: identificadores da conta, registros de sessão e informações necessárias para proteger o acesso. A senha é processada pelo serviço de autenticação e não fica disponível em texto legível para o KAD.',
      'Estudos: respostas, acertos, erros, questões favoritas, concursos salvos, progresso, redações e histórico de simulados.',
      'Comunidade: comentários, curtidas, nome e nome de usuário associados à publicação.',
      'Dispositivo: tema, preferências locais, rascunhos, foto escolhida e dados técnicos necessários ao funcionamento e à segurança.',
    ],
  },
  {
    title: 'Como os dados são obtidos',
    paragraphs: [
      'Recebemos dados diretamente de você ao criar ou editar a conta, responder questões, salvar itens e publicar comentários. Outros dados surgem da utilização do serviço, como progresso e registros técnicos de autenticação.',
      'O acesso à biblioteca de fotos só é solicitado quando você decide escolher uma imagem de perfil. A permissão pode ser recusada ou revogada nas configurações do sistema sem impedir as demais funções.',
    ],
  },
  {
    title: 'Finalidades e bases legais',
    paragraphs: [
      'Tratamos apenas os dados necessários para finalidades legítimas e informadas. Conforme o contexto, o tratamento poderá se apoiar na execução do serviço solicitado, em procedimentos relacionados ao contrato, no cumprimento de obrigação legal, no exercício regular de direitos, em interesse legítimo avaliado com respeito aos direitos do titular ou em consentimento quando ele for exigido.',
    ],
    bullets: [
      'Criar, autenticar e proteger sua conta.',
      'Personalizar o perfil e sincronizar preferências e progresso.',
      'Entregar questões, simulados, estatísticas e recursos da comunidade.',
      'Prevenir fraude, abuso e incidentes de segurança.',
      'Corrigir falhas, atender solicitações e cumprir obrigações legais.',
    ],
    note: 'Quando o consentimento for a base adequada, você poderá revogá-lo por meio simples e gratuito, sem afetar os tratamentos anteriores realizados de forma legítima.',
  },
  {
    title: 'Dados locais e dados na nuvem',
    paragraphs: [
      'No modo visitante, perfil, respostas, favoritos, concursos salvos, preferências, redações e simulados ficam armazenados no próprio aparelho.',
      'Quando você entra em uma conta, dados do perfil, respostas, questões favoritas, concursos salvos, comentários e interações compatíveis podem ser sincronizados com a infraestrutura em nuvem do KAD. Na versão atual, rascunhos de redação, foto local, tema, assinatura demonstrativa e histórico de simulados permanecem no dispositivo.',
      'Dados que permanecem apenas no aparelho não podem ser recuperados pelo KAD depois de apagados, da limpeza do aplicativo ou da perda do dispositivo.',
    ],
  },
  {
    title: 'Visibilidade na comunidade',
    paragraphs: [
      'Comentários e curtidas são recursos sociais. Ao publicar, o conteúdo, seu nome de exibição e seu nome de usuário podem ficar visíveis para outros usuários autenticados.',
      'Evite inserir telefone, e-mail, documentos, senhas, dados sensíveis ou informações de terceiros em comentários. Conteúdo poderá ser moderado conforme os Termos de Uso.',
    ],
  },
  {
    title: 'Compartilhamento e operadores',
    paragraphs: [
      'O KAD não vende dados pessoais e, nesta versão, não utiliza dados para publicidade comportamental. O compartilhamento ocorre somente quando necessário para operar o serviço, cumprir a lei, proteger direitos ou atender a uma solicitação válida do titular.',
    ],
    bullets: [
      'Supabase, como provedor de autenticação, banco de dados, armazenamento e funções de infraestrutura.',
      'Fornecedores técnicos estritamente necessários, sujeitos a deveres de segurança e confidencialidade.',
      'Autoridades públicas, quando houver obrigação legal, ordem válida ou necessidade de exercício regular de direitos.',
      'Terceiros envolvidos em reorganização societária, com preservação dos direitos e informações aos titulares quando aplicável.',
    ],
    note: 'Sites oficiais e lojas de aplicativos possuem políticas próprias. Ao acessá-los, o tratamento realizado por esses terceiros não é controlado pelo KAD.',
  },
  {
    title: 'Transferências internacionais',
    paragraphs: [
      'A infraestrutura principal do projeto é hospedada na região selecionada no provedor. Fornecedores e subprocessadores podem realizar operações técnicas ou suporte fora do Brasil.',
      'Quando houver transferência internacional de dados pessoais, o KAD adotará mecanismos admitidos pela LGPD e pela regulamentação aplicável, além de medidas contratuais e de segurança compatíveis com o risco.',
    ],
  },
  {
    title: 'Prazo de conservação e exclusão',
    paragraphs: [
      'Os dados são mantidos pelo tempo necessário para fornecer o serviço e cumprir as finalidades desta Política. Após a exclusão da conta, eles serão eliminados ou anonimizados, salvo quando a conservação for necessária para obrigação legal, prevenção de fraude, segurança ou exercício regular de direitos.',
      'Cópias de segurança e registros técnicos podem permanecer por período limitado até sua substituição segura. Dados locais permanecem no aparelho até você usar a opção de apagá-los, limpar os dados do aplicativo ou desinstalá-lo.',
    ],
  },
  {
    title: 'Segurança da informação',
    paragraphs: [
      'O KAD adota medidas técnicas e administrativas proporcionais ao risco, incluindo transmissão protegida, controle de acesso, políticas de autorização no banco de dados, proteção de sessão e revisão de configurações de segurança.',
      'Nenhum sistema é totalmente imune a incidentes. Se ocorrer evento que possa gerar risco ou dano relevante, serão tomadas medidas de contenção, investigação e comunicação aos titulares e à autoridade competente, quando exigido.',
    ],
    bullets: [
      'Use uma senha exclusiva e mantenha o dispositivo atualizado.',
      'Não compartilhe códigos, links de recuperação ou sessões autenticadas.',
      'Encerre a sessão em dispositivos compartilhados e comunique atividades suspeitas.',
    ],
  },
  {
    title: 'Seus direitos',
    paragraphs: ['Nos limites e nas condições da LGPD, você pode solicitar:'],
    bullets: [
      'Confirmação da existência de tratamento e acesso aos dados.',
      'Correção de dados incompletos, inexatos ou desatualizados.',
      'Anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados irregularmente.',
      'Portabilidade, quando regulamentada e tecnicamente aplicável.',
      'Informações sobre compartilhamento e sobre a possibilidade de negar ou revogar consentimento.',
      'Eliminação de dados tratados com consentimento, quando cabível, e revisão de decisões automatizadas que afetem seus interesses.',
    ],
    note: 'Você já pode editar parte do perfil, apagar dados locais e solicitar a exclusão da conta no aplicativo. Os demais pedidos serão recebidos pelo canal formal de privacidade após sua publicação.',
  },
  {
    title: 'Armazenamento no navegador e métricas',
    paragraphs: [
      'Na versão web, o KAD usa armazenamento do navegador para manter sessão, preferências e dados locais necessários. No aplicativo móvel, utiliza mecanismos equivalentes do dispositivo, incluindo armazenamento protegido para credenciais quando disponível.',
      'Analytics, rastreamento publicitário, notificações comerciais e pagamentos reais não estão ativos nesta versão. Esta Política será revisada antes da ativação de qualquer recurso que altere materialmente o tratamento de dados.',
    ],
  },
  {
    title: 'Crianças e adolescentes',
    paragraphs: [
      'O KAD não é direcionado a crianças. Adolescentes devem utilizar o serviço com ciência e assistência de seu responsável legal, conforme a idade e a legislação aplicável.',
      'Se identificarmos tratamento incompatível com essas regras, poderemos limitar a conta e adotar providências para proteger o titular, incluindo a exclusão dos dados quando cabível.',
    ],
  },
  {
    title: 'Atualizações e contato',
    paragraphs: [
      'Esta Política poderá ser atualizada por mudanças legais, técnicas ou funcionais. Alterações relevantes terão nova versão e data de vigência e serão comunicadas de forma adequada antes de produzirem efeitos quando isso for exigido.',
      'Solicitações de titulares, dúvidas e relatos de segurança deverão ser enviados ao canal formal de privacidade que será identificado no aplicativo antes do lançamento comercial. Poderemos solicitar informações adicionais para confirmar a identidade do solicitante e proteger os dados contra acesso indevido.',
      'Se a solicitação não for resolvida, o titular também poderá peticionar perante a Autoridade Nacional de Proteção de Dados (ANPD), observados os requisitos aplicáveis.',
    ],
  },
];

export default function PrivacyScreen() {
  return (
    <LegalPage
      title="Política de Privacidade"
      documentIcon="shield-checkmark-outline"
      introduction="Transparência sobre os dados usados pelo KAD, por que eles são necessários e quais escolhas estão sob seu controle."
      effectiveDate="2 de agosto de 2026"
      readingTime="9 minutos"
      version="1.0"
      sections={SECTIONS}
    />
  );
}
