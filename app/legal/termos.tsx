import { LegalPage, type LegalSection } from '@/components/legal-page';

const SECTIONS: LegalSection[] = [
  {
    title: 'Aceitação e escopo',
    paragraphs: [
      'Estes Termos regulam o acesso e o uso do KAD, incluindo seus aplicativos, páginas e funcionalidades relacionadas. Ao criar uma conta ou continuar a usar o serviço, você declara que leu e concorda com este documento e com a Política de Privacidade.',
      'Se você não concordar com alguma condição, não utilize o KAD. Condições específicas apresentadas antes da contratação de um recurso pago também passarão a integrar estes Termos.',
    ],
  },
  {
    title: 'Quem pode utilizar',
    paragraphs: [
      'Você deve ter capacidade legal para aceitar estes Termos. Menores de 18 anos devem utilizar o serviço com a assistência ou representação de seu responsável legal, conforme aplicável.',
      'Ao se cadastrar, forneça informações verdadeiras, completas e atualizadas. Cada conta é pessoal, e você é responsável por manter a confidencialidade da senha e pelas atividades realizadas nela.',
    ],
    bullets: [
      'Não compartilhe senha, código de acesso ou sessão autenticada.',
      'Avise o KAD caso suspeite de acesso não autorizado.',
      'O nome de usuário deve ser único e pode aparecer em recursos da comunidade.',
    ],
  },
  {
    title: 'O que o KAD oferece',
    paragraphs: [
      'O KAD reúne ferramentas de apoio ao estudo para concursos públicos, como questões, simulados, trilhas, acompanhamento de desempenho, concursos salvos, redações e recursos de comunidade.',
      'Algumas funções operam apenas no dispositivo e outras dependem de uma conta e de conexão com a internet. Funcionalidades podem variar entre web, Android e iOS e durante o período de desenvolvimento.',
    ],
  },
  {
    title: 'Informações sobre concursos',
    paragraphs: [
      'O KAD é uma plataforma independente e não representa órgãos públicos, bancas organizadoras ou instituições mencionadas no aplicativo. Editais, inscrições, datas, vagas, remunerações e requisitos devem ser confirmados nos canais oficiais.',
    ],
    bullets: [
      'O edital e suas retificações sempre prevalecem em caso de divergência.',
      'Salvar ou acompanhar um concurso no KAD não realiza nem garante a inscrição.',
      'Alertas e resumos não substituem a consulta periódica ao órgão ou à banca responsável.',
    ],
    note: 'Na versão atual, parte das oportunidades e dos dados exibidos possui finalidade demonstrativa. Itens reais devem ser identificados e vinculados à fonte oficial.',
  },
  {
    title: 'Conteúdo educacional e desempenho',
    paragraphs: [
      'Questões, comentários, explicações, correções e estatísticas têm finalidade exclusivamente educacional. Embora o KAD busque qualidade e atualização, podem existir erros, desatualizações ou diferenças em relação ao conteúdo oficial da prova.',
      'Resultados e estimativas de desempenho não garantem inscrição, classificação, aprovação, nomeação ou qualquer resultado profissional. Cabe a você conferir o conteúdo programático e organizar sua preparação.',
    ],
  },
  {
    title: 'Conteúdo publicado por usuários',
    paragraphs: [
      'Você é responsável por comentários, respostas e demais materiais que publicar. Ao enviar conteúdo, declara possuir os direitos necessários e concede ao KAD licença não exclusiva, gratuita e limitada ao funcionamento do serviço para armazenar, reproduzir e exibir esse material.',
      'O KAD poderá moderar ou remover conteúdo e restringir interações quando houver indício de ilegalidade, abuso, fraude, violação destes Termos ou risco à comunidade, preservados os direitos do usuário aplicáveis.',
    ],
    bullets: [
      'Não publique dados pessoais sensíveis, documentos ou informações confidenciais.',
      'Não pratique assédio, discriminação, ameaça, spam ou falsidade ideológica.',
      'Não viole direitos autorais, de imagem, de marca ou outros direitos de terceiros.',
    ],
  },
  {
    title: 'Uso permitido e segurança',
    paragraphs: ['Utilize o KAD de forma lícita, pessoal e compatível com sua finalidade educacional. É proibido:'],
    bullets: [
      'Tentar acessar contas, dados, sistemas ou áreas sem autorização.',
      'Explorar falhas, contornar limites, interferir no serviço ou disseminar código malicioso.',
      'Usar robôs, coleta automatizada ou tráfego abusivo sem autorização prévia.',
      'Copiar, vender, sublicenciar ou redistribuir conteúdo protegido, salvo autorização ou permissão legal.',
      'Utilizar o KAD para fraude ou para violar a lei e os direitos de terceiros.',
    ],
  },
  {
    title: 'Propriedade intelectual',
    paragraphs: [
      'A marca KAD, a identidade visual, a interface, o software, a organização dos conteúdos e os materiais próprios são protegidos pela legislação aplicável. O uso do serviço não transfere a você qualquer direito de propriedade intelectual.',
      'Conteúdos de terceiros, questões de fontes identificadas e informações públicas permanecem sujeitos aos direitos e às licenças de seus respectivos titulares.',
    ],
  },
  {
    title: 'Planos, pagamentos e cancelamento',
    paragraphs: [
      'No estágio atual, os planos pagos, a assinatura Diamante e demais ofertas são demonstrações de interface: não há cobrança, renovação automática ou contratação real.',
      'Antes de ativar pagamentos, o KAD apresentará preço total, periodicidade, benefícios, limitações, renovação, meios de cancelamento, reembolso e demais condições relevantes. Compras realizadas por lojas de aplicativos também poderão seguir as regras da plataforma, sem afastar direitos assegurados pela legislação brasileira.',
    ],
    note: 'Nenhum valor deve ser informado ou cobrado nesta versão demonstrativa.',
  },
  {
    title: 'Serviços e links de terceiros',
    paragraphs: [
      'O KAD utiliza fornecedores de infraestrutura, como autenticação e armazenamento em nuvem, e pode direcionar para editais ou páginas oficiais. Serviços externos possuem termos e políticas próprios e podem ficar indisponíveis independentemente do KAD.',
      'Um link externo não significa endosso, parceria ou responsabilidade pelo conteúdo do site acessado.',
    ],
  },
  {
    title: 'Disponibilidade e alterações do serviço',
    paragraphs: [
      'O KAD poderá corrigir falhas, atualizar segurança, alterar funcionalidades ou interromper recursos para manutenção. Buscaremos comunicar mudanças relevantes com antecedência razoável quando isso for possível.',
      'Não garantimos operação ininterrupta ou livre de erros, especialmente em versões de teste, indisponibilidades de terceiros ou eventos fora de controle razoável.',
    ],
  },
  {
    title: 'Suspensão, encerramento e exclusão',
    paragraphs: [
      'O acesso poderá ser suspenso ou encerrado em caso de violação destes Termos, risco de segurança, fraude, obrigação legal ou descontinuação do serviço. Quando adequado e permitido, o usuário será informado e poderá contestar a medida pelo canal de atendimento.',
      'Você pode excluir dados locais no modo visitante ou solicitar a exclusão da conta autenticada pelas configurações do Perfil. A exclusão é permanente, ressalvada a conservação estritamente necessária para cumprir obrigação legal, prevenir fraude ou exercer direitos, conforme a Política de Privacidade.',
    ],
  },
  {
    title: 'Responsabilidades e garantias legais',
    paragraphs: [
      'Na extensão permitida pela lei, o KAD não responde por decisões tomadas exclusivamente com base em conteúdo educacional ou demonstrativo, por perda de prazo não confirmada em fonte oficial, por conduta de terceiros ou por falhas externas ao seu controle razoável.',
      'Nada nestes Termos exclui ou limita direitos obrigatórios do consumidor, a responsabilidade que não possa ser afastada por lei ou o dever do KAD de reparar danos que lhe sejam legalmente atribuíveis.',
    ],
  },
  {
    title: 'Privacidade e proteção de dados',
    paragraphs: [
      'O tratamento de dados pessoais segue a Política de Privacidade do KAD, que informa quais dados são utilizados, para quais finalidades, com quem podem ser compartilhados, por quanto tempo são mantidos e como exercer seus direitos.',
    ],
  },
  {
    title: 'Mudanças, legislação e contato',
    paragraphs: [
      'Estes Termos podem ser atualizados para refletir alterações legais, de segurança ou do serviço. Mudanças relevantes terão nova versão e data de vigência e, quando necessário, serão comunicadas antes de produzir efeitos.',
      'Aplica-se a legislação brasileira. Eventuais conflitos serão tratados preferencialmente de forma amigável e, quando houver relação de consumo, permanece assegurado o foro legalmente competente, inclusive o do domicílio do consumidor quando aplicável.',
      'Dúvidas, contestações e notificações deverão ser encaminhadas pelo canal oficial de atendimento que será identificado no aplicativo antes do lançamento comercial.',
    ],
  },
];

export default function TermsScreen() {
  return (
    <LegalPage
      title="Termos de Uso"
      documentIcon="document-text-outline"
      introduction="Regras claras para usar o KAD, participar da comunidade e entender os limites desta versão do serviço."
      effectiveDate="2 de agosto de 2026"
      readingTime="8 minutos"
      version="1.0"
      sections={SECTIONS}
    />
  );
}
