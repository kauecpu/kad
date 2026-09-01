import { FeaturePreviewScreen } from '@/components/feature-preview-screen';
import { useOpenAppDrawer } from '@/hooks/use-open-app-drawer';
import { useTheme } from '@/hooks/use-theme';

export default function LibraryScreen() {
  const { scheme } = useTheme();
  const openMenu = useOpenAppDrawer();
  const accent = scheme === 'dark' ? '#2DD4BF' : '#0F766E';

  return (
    <FeaturePreviewScreen
      title="Biblioteca"
      subtitle="Conteúdo para revisar"
      description="Esta área está em preparação. Em breve, seus materiais de revisão ficarão reunidos aqui."
      icon="library-outline"
      color={accent}
      statusLabel="Em breve"
      onMenu={openMenu}
      items={[
        {
          icon: 'headset-outline',
          title: 'Audiobooks',
          description: 'Escute conteúdos importantes enquanto acompanha os capítulos.',
        },
        {
          icon: 'document-text-outline',
          title: 'Anotações',
          description: 'Registre ideias e destaques vinculados ao material estudado.',
        },
        {
          icon: 'layers-outline',
          title: 'Flashcards',
          description: 'Revise conceitos em sessões curtas e objetivas.',
        },
      ]}
    />
  );
}
