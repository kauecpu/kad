import Ionicons from '@/components/ui/app-icon';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Section } from '@/components/ui/section';
import { StackHeader } from '@/components/ui/stack-header';
import { FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { dueCards } from '@/lib/flashcards';
import { useFlashcards } from '@/providers/flashcards-provider';
import type { Flashcard, FlashcardDeck, FlashcardRating } from '@/types';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type EditorMode = { kind: 'deck' | 'card'; deck?: FlashcardDeck; card?: Flashcard } | null;

export default function FlashcardsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const flashcards = useFlashcards();
  const [editor, setEditor] = useState<EditorMode>(null);
  const [query, setQuery] = useState('');
  const [deckFilter, setDeckFilter] = useState('all');
  const [cardView, setCardView] = useState<'active' | 'archived'>('active');
  const [reviewing, setReviewing] = useState(false);
  const [showBack, setShowBack] = useState(false);
  const reviewQueue = useMemo(() => dueCards(flashcards.cards), [flashcards.cards]);
  const visibleCards = useMemo(() => flashcards.filter({ query, deckId: deckFilter, tag: '', state: cardView }), [cardView, deckFilter, flashcards, query]);

  const currentReview = reviewQueue[0];
  const review = (rating: FlashcardRating) => {
    if (!currentReview) return;
    flashcards.reviewCard(currentReview.id, rating);
    setShowBack(false);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <StackHeader title="Flashcards" subtitle="Revisão no seu ritmo" onBack={() => router.back()} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xxxl }]}
        showsVerticalScrollIndicator={false}>
        <Card style={[styles.hero, { backgroundColor: colors.primarySoft }]}>
          <View style={styles.heroCopy}>
            <Text style={[styles.overline, { color: colors.primary }]}>REVISÃO DE HOJE</Text>
            <Text style={[styles.heroTitle, { color: colors.text }]}>Pequenos blocos. Memória constante.</Text>
            <Text style={[styles.heroText, { color: colors.textMuted }]}>Crie seus próprios cards e volte neles quando for a hora certa.</Text>
          </View>
          <View style={[styles.heroMetric, { backgroundColor: colors.surface }]}>
            <Text style={[styles.heroNumber, { color: colors.insight }]}>{reviewQueue.length}</Text>
            <Text style={[styles.heroLabel, { color: colors.textMuted }]}>para revisar</Text>
          </View>
        </Card>

        <View style={styles.actions}>
          <Button label="Criar flashcard" icon="add" onPress={() => setEditor({ kind: 'card' })} />
          <Button label="Novo baralho" icon="layers-outline" variant="secondary" onPress={() => setEditor({ kind: 'deck' })} />
        </View>

        {reviewing ? (
          <ReviewCard card={currentReview} showBack={showBack} onReveal={() => setShowBack(true)} onRate={review} onClose={() => setReviewing(false)} />
        ) : (
          <>
            <Section title="Revisar agora">
              <Card style={styles.reviewCallout}>
                <View style={[styles.calloutIcon, { backgroundColor: colors.insightSoft }]}>
                  <Ionicons name="refresh-outline" size={22} color={colors.insight} />
                </View>
                <View style={styles.calloutCopy}>
                  <Text style={[styles.calloutTitle, { color: colors.text }]}>{reviewQueue.length ? `${reviewQueue.length} cards aguardando` : 'Tudo em dia'}</Text>
                  <Text style={[styles.calloutText, { color: colors.textMuted }]}>{reviewQueue.length ? 'Uma sessão curta mantém o conteúdo fresco.' : 'Crie um card ou volte amanhã para continuar.'}</Text>
                </View>
                <Button label="Revisar agora" size="md" onPress={() => { setShowBack(false); setReviewing(true); }} disabled={!reviewQueue.length} />
              </Card>
            </Section>

            <Section title="Meus baralhos">
              {flashcards.decks.filter((deck) => !deck.archivedAt).length ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.deckRow}>
                  <DeckChip label="Todos" active={deckFilter === 'all'} onPress={() => setDeckFilter('all')} />
                  {flashcards.decks.filter((deck) => !deck.archivedAt).map((deck) => (
                    <DeckChip key={deck.id} label={`${deck.name} · ${deck.cardCount}`} active={deckFilter === deck.id} onPress={() => setDeckFilter(deck.id)} onLongPress={() => setEditor({ kind: 'deck', deck })} />
                  ))}
                </ScrollView>
              ) : <EmptyState title="Crie seu primeiro baralho" text="Organize os cards por concurso, matéria ou qualquer tema." action="Novo baralho" onPress={() => setEditor({ kind: 'deck' })} />}
            </Section>

            <View style={styles.viewToggle} accessibilityRole="tablist">
              {(['active', 'archived'] as const).map((view) => (
                <Pressable key={view} onPress={() => setCardView(view)} accessibilityRole="tab" accessibilityState={{ selected: cardView === view }} style={[styles.viewTab, { backgroundColor: cardView === view ? colors.primary : colors.surface, borderColor: cardView === view ? colors.primary : colors.border }]}>
                  <Text style={[styles.viewTabText, { color: cardView === view ? colors.onPrimary : colors.text }]}>{view === 'active' ? 'Ativos' : 'Arquivados'}</Text>
                </Pressable>
              ))}
            </View>

            <View style={[styles.searchBox, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <Ionicons name="search-outline" size={18} color={colors.textSubtle} />
              <TextInput value={query} onChangeText={setQuery} placeholder="Buscar nos seus cards" placeholderTextColor={colors.textSubtle} style={[styles.searchInput, { color: colors.text }]} accessibilityLabel="Buscar nos seus cards" />
            </View>

            <Section title={cardView === 'archived' ? 'Cards arquivados' : query || deckFilter !== 'all' ? 'Cards encontrados' : 'Cards ativos'}>
              {flashcards.hydrated ? visibleCards.length ? visibleCards.map((card) => <FlashcardRow key={card.id} card={card} deck={flashcards.decks.find((item) => item.id === card.deckId)} onEdit={() => setEditor({ kind: 'card', card })} onArchive={() => flashcards.archiveCard(card.id)} onRestore={() => flashcards.restoreCard(card.id)} archived={cardView === 'archived'} onDelete={() => Alert.alert('Excluir flashcard?', 'O card será removido desta conta.', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Excluir', style: 'destructive', onPress: () => flashcards.deleteCard(card.id) }])} colors={colors} />) : <EmptyState title={cardView === 'archived' ? 'Nenhum card arquivado' : 'Nenhum card encontrado'} text={cardView === 'archived' ? 'Cards arquivados aparecerão aqui.' : 'Tente outro termo ou crie um novo card.'} action="Criar flashcard" onPress={() => setEditor({ kind: 'card' })} /> : <Card style={styles.loading}><ActivityIndicator color={colors.insight} /><Text style={[styles.loadingText, { color: colors.textMuted }]}>Carregando seus cards…</Text></Card>}
            </Section>
          </>
        )}
      </ScrollView>
      <FlashcardEditor editor={editor} decks={flashcards.decks.filter((deck) => !deck.archivedAt)} onClose={() => setEditor(null)} onCreateDeck={flashcards.createDeck} onUpdateDeck={flashcards.updateDeck} onDeleteDeck={flashcards.deleteDeck} onCreateCard={flashcards.createCard} onUpdateCard={flashcards.updateCard} colors={colors} />
    </View>
  );
}

function DeckChip({ label, active, onPress, onLongPress }: { label: string; active: boolean; onPress: () => void; onLongPress?: () => void }) {
  const { colors } = useTheme();
  return <Pressable onPress={onPress} onLongPress={onLongPress} accessibilityRole="button" accessibilityState={{ selected: active }} style={[styles.chip, { backgroundColor: active ? colors.primary : colors.surface, borderColor: active ? colors.primary : colors.border }]}><Text style={[styles.chipText, { color: active ? colors.onPrimary : colors.text }]}>{label}</Text></Pressable>;
}

function EmptyState({ title, text, action, onPress }: { title: string; text: string; action: string; onPress: () => void }) {
  const { colors } = useTheme();
  return <Card style={styles.empty}><Ionicons name="layers-outline" size={26} color={colors.insight} /><Text style={[styles.emptyTitle, { color: colors.text }]}>{title}</Text><Text style={[styles.emptyText, { color: colors.textMuted }]}>{text}</Text><Button label={action} variant="secondary" onPress={onPress} /></Card>;
}

function FlashcardRow({ card, deck, onEdit, onArchive, onRestore, archived, onDelete, colors }: { card: Flashcard; deck?: FlashcardDeck; onEdit: () => void; onArchive: () => void; onRestore: () => void; archived: boolean; onDelete: () => void; colors: ReturnType<typeof useTheme>['colors'] }) {
  return <Card style={styles.cardRow}><View style={styles.rowCopy}><Text style={[styles.rowDeck, { color: colors.insight }]}>{deck?.name ?? 'Sem baralho'}</Text><Text style={[styles.rowFront, { color: colors.text }]} numberOfLines={2}>{card.front}</Text><Text style={[styles.rowBack, { color: colors.textMuted }]} numberOfLines={1}>{card.back}</Text>{card.tags.length ? <Text style={[styles.rowTags, { color: colors.textSubtle }]}>{card.tags.map((tag) => `#${tag}`).join(' ')}</Text> : null}</View><View style={styles.rowActions}><Pressable onPress={onEdit} accessibilityRole="button" accessibilityLabel="Editar flashcard" style={styles.iconButton}><Ionicons name="create-outline" size={19} color={colors.primary} /></Pressable>{archived ? <Pressable onPress={onRestore} accessibilityRole="button" accessibilityLabel="Restaurar flashcard" style={styles.iconButton}><Ionicons name="refresh-outline" size={19} color={colors.insight} /></Pressable> : <Pressable onPress={onArchive} accessibilityRole="button" accessibilityLabel="Arquivar flashcard" style={styles.iconButton}><Ionicons name="archive-outline" size={19} color={colors.textMuted} /></Pressable>}<Pressable onPress={onDelete} accessibilityRole="button" accessibilityLabel="Excluir flashcard" style={styles.iconButton}><Ionicons name="trash-outline" size={19} color={colors.danger} /></Pressable></View></Card>;
}

function ReviewCard({ card, showBack, onReveal, onRate, onClose }: { card?: Flashcard; showBack: boolean; onReveal: () => void; onRate: (rating: FlashcardRating) => void; onClose: () => void }) {
  const { colors } = useTheme();
  if (!card) return <EmptyState title="Tudo revisado" text="Nenhum card está pendente agora." action="Fechar" onPress={onClose} />;
  return <View style={styles.reviewSession}><View style={styles.sessionHeader}><Text style={[styles.overline, { color: colors.insight }]}>SESSÃO DE REVISÃO</Text><Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Fechar sessão"><Ionicons name="close" size={22} color={colors.textMuted} /></Pressable></View><Card style={[styles.bigCard, { borderColor: colors.insight }]}><Text style={[styles.cardSide, { color: colors.textSubtle }]}>{showBack ? 'VERSO' : 'FRENTE'}</Text><Text style={[styles.bigCardText, { color: colors.text }]}>{showBack ? card.back : card.front}</Text>{card.tags.length ? <Text style={[styles.rowTags, { color: colors.textSubtle }]}>{card.tags.map((tag) => `#${tag}`).join(' ')}</Text> : null}</Card>{showBack ? <View style={styles.ratingGrid}>{([['again', 'Errei', '10 min'], ['hard', 'Difícil', '1 dia'], ['good', 'Acertei', 'próximo'], ['easy', 'Fácil', '2 dias']] as const).map(([rating, label, hint]) => <Pressable key={rating} onPress={() => onRate(rating)} accessibilityRole="button" accessibilityLabel={`${label}, próxima revisão ${hint}`} style={[styles.ratingButton, { backgroundColor: rating === 'again' ? colors.dangerSoft : rating === 'easy' ? colors.insightSoft : colors.surface, borderColor: colors.border }]}><Text style={[styles.ratingLabel, { color: rating === 'again' ? colors.danger : rating === 'easy' ? colors.insight : colors.text }]}>{label}</Text><Text style={[styles.ratingHint, { color: colors.textMuted }]}>{hint}</Text></Pressable>)}</View> : <Button label="Mostrar verso" onPress={onReveal} fullWidth icon="eye-outline" />}</View>;
}

function FlashcardEditor({ editor, decks, onClose, onCreateDeck, onUpdateDeck, onDeleteDeck, onCreateCard, onUpdateCard, colors }: { editor: EditorMode; decks: FlashcardDeck[]; onClose: () => void; onCreateDeck: (input: { name: string; description?: string; color?: string }) => FlashcardDeck; onUpdateDeck: (id: string, patch: Partial<Pick<FlashcardDeck, 'name' | 'description' | 'color'>>) => void; onDeleteDeck: (id: string) => void; onCreateCard: (input: { deckId: string; front: string; back: string; tags?: string[] }) => Flashcard; onUpdateCard: (id: string, patch: Partial<Pick<Flashcard, 'front' | 'back' | 'tags' | 'deckId'>>) => void; colors: ReturnType<typeof useTheme>['colors'] }) {
  const [name, setName] = useState('');
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [tags, setTags] = useState('');
  const [deckId, setDeckId] = useState('');

  useEffect(() => {
    setName(editor?.deck?.name ?? '');
    setFront(editor?.card?.front ?? '');
    setBack(editor?.card?.back ?? '');
    setTags(editor?.card?.tags.join(', ') ?? '');
    setDeckId(editor?.card?.deckId ?? '');
  }, [editor]);

  if (!editor) return null;
  const isDeck = editor.kind === 'deck';
  const title = isDeck ? editor.deck ? 'Editar baralho' : 'Novo baralho' : editor.card ? 'Editar flashcard' : 'Novo flashcard';
  const submit = () => {
    try {
      if (isDeck) {
        if (!name.trim()) return Alert.alert('Nome obrigatório', 'Dê um nome ao baralho.');
        if (editor.deck) onUpdateDeck(editor.deck.id, { name: name.trim() }); else onCreateDeck({ name: name.trim() });
      } else {
        const chosenDeck = deckId || editor.card?.deckId || decks[0]?.id;
        if (!chosenDeck) return Alert.alert('Crie um baralho primeiro', 'Escolha um baralho para guardar este card.');
        if (editor.card) onUpdateCard(editor.card.id, { front, back, tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean), deckId: chosenDeck }); else onCreateCard({ deckId: chosenDeck, front, back, tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean) });
      }
      onClose();
    } catch (error) {
      Alert.alert('Não foi possível salvar', error instanceof Error ? error.message : 'Tente novamente.');
    }
  };
  return <Modal visible transparent animationType="slide" onRequestClose={onClose}><View style={[styles.modalBackdrop, { backgroundColor: colors.overlay }]}><View style={[styles.modal, { backgroundColor: colors.surface }]}><View style={styles.modalHeader}><Text style={[styles.modalTitle, { color: colors.text }]}>{title}</Text><Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Fechar"><Ionicons name="close" size={22} color={colors.textMuted} /></Pressable></View>{isDeck ? <><Field label="Nome do baralho" value={name} onChangeText={setName} placeholder="Ex.: Direito Constitucional" colors={colors} />{editor.deck ? <Button label="Excluir baralho" variant="danger" onPress={() => Alert.alert('Excluir baralho?', 'Os cards deste baralho também serão removidos.', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Excluir', style: 'destructive', onPress: () => { onDeleteDeck(editor.deck!.id); onClose(); } }])} fullWidth /> : null}</> : <><Field label="Frente" value={front} onChangeText={setFront} placeholder="Pergunta ou conceito" multiline colors={colors} /><Field label="Verso" value={back} onChangeText={setBack} placeholder="Resposta ou explicação" multiline colors={colors} /><Field label="Tags (separadas por vírgula)" value={tags} onChangeText={setTags} placeholder="ex.: revisão, direito" colors={colors} />{decks.length > 0 ? <View style={styles.deckOptions}><Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Baralho</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.deckRow}>{decks.map((deck) => <DeckChip key={deck.id} label={deck.name} active={(deckId || editor.card?.deckId || decks[0].id) === deck.id} onPress={() => setDeckId(deck.id)} />)}</ScrollView></View> : null}</>}<Button label="Salvar" onPress={submit} fullWidth size="lg" /></View></View></Modal>;
}

function Field({ label, value, onChangeText, placeholder, multiline = false, colors }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string; multiline?: boolean; colors: ReturnType<typeof useTheme>['colors'] }) { return <View style={styles.field}><Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.textSubtle} multiline={multiline} style={[styles.input, multiline && styles.multiline, { color: colors.text, backgroundColor: colors.surfaceAlt, borderColor: colors.border }]} accessibilityLabel={label} /></View>; }

const styles = StyleSheet.create({
  viewToggle: { flexDirection: 'row', gap: Spacing.sm },
  viewTab: { flex: 1, minHeight: 44, borderRadius: Radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  viewTabText: { fontSize: FontSize.small, fontWeight: FontWeight.semibold },
  screen: { flex: 1 }, content: { width: '100%', maxWidth: 840, alignSelf: 'center', padding: Spacing.lg, gap: Spacing.xl },
  hero: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg }, heroCopy: { flex: 1, gap: Spacing.sm }, overline: { fontSize: FontSize.tiny, fontWeight: FontWeight.bold, letterSpacing: 1.2 }, heroTitle: { fontSize: FontSize.title, lineHeight: 30, fontWeight: FontWeight.bold, letterSpacing: -0.3 }, heroText: { ...({ fontSize: FontSize.body, lineHeight: 22 } as const) }, heroMetric: { minWidth: 88, minHeight: 88, borderRadius: Radius.lg, justifyContent: 'center', alignItems: 'center', padding: Spacing.sm }, heroNumber: { fontSize: FontSize.display, lineHeight: 36, fontWeight: FontWeight.bold }, heroLabel: { fontSize: FontSize.tiny, textAlign: 'center' }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm }, reviewCallout: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md }, calloutIcon: { width: 44, height: 44, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' }, calloutCopy: { flex: 1, gap: 2 }, calloutTitle: { fontSize: FontSize.body, fontWeight: FontWeight.semibold }, calloutText: { fontSize: FontSize.small, lineHeight: 18 }, deckRow: { gap: Spacing.sm }, chip: { minHeight: 40, borderRadius: Radius.pill, borderWidth: 1, paddingHorizontal: Spacing.md, alignItems: 'center', justifyContent: 'center' }, chipText: { fontSize: FontSize.small, fontWeight: FontWeight.medium }, searchBox: { minHeight: 48, borderRadius: Radius.md, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md }, searchInput: { flex: 1, fontSize: FontSize.body, minHeight: 44 }, cardRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.sm }, rowCopy: { flex: 1, gap: 3 }, rowDeck: { fontSize: FontSize.tiny, fontWeight: FontWeight.bold, textTransform: 'uppercase', letterSpacing: 0.5 }, rowFront: { fontSize: FontSize.body, fontWeight: FontWeight.semibold, lineHeight: 20 }, rowBack: { fontSize: FontSize.small }, rowTags: { fontSize: FontSize.tiny }, rowActions: { flexDirection: 'row', gap: Spacing.xs }, iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.md }, empty: { alignItems: 'center', gap: Spacing.sm }, emptyTitle: { fontSize: FontSize.heading, fontWeight: FontWeight.semibold, textAlign: 'center' }, emptyText: { fontSize: FontSize.small, lineHeight: 18, textAlign: 'center', maxWidth: 320 }, loading: { alignItems: 'center', gap: Spacing.sm }, loadingText: { fontSize: FontSize.small }, reviewSession: { gap: Spacing.lg }, sessionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, bigCard: { minHeight: 260, justifyContent: 'center', alignItems: 'center', gap: Spacing.lg, borderWidth: 2 }, cardSide: { fontSize: FontSize.tiny, fontWeight: FontWeight.bold, letterSpacing: 1.2 }, bigCardText: { fontSize: FontSize.title, fontWeight: FontWeight.semibold, textAlign: 'center', lineHeight: 32 }, ratingGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm }, ratingButton: { flexGrow: 1, minWidth: 130, minHeight: 62, borderRadius: Radius.md, borderWidth: 1, padding: Spacing.sm, justifyContent: 'center', alignItems: 'center' }, ratingLabel: { fontSize: FontSize.body, fontWeight: FontWeight.semibold }, ratingHint: { fontSize: FontSize.tiny }, modalBackdrop: { flex: 1, justifyContent: 'flex-end' }, modal: { borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.xl, gap: Spacing.lg }, modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, modalTitle: { fontSize: FontSize.title, fontWeight: FontWeight.bold }, field: { gap: Spacing.xs }, fieldLabel: { fontSize: FontSize.small, fontWeight: FontWeight.semibold }, input: { minHeight: 48, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: FontSize.body }, multiline: { minHeight: 92, textAlignVertical: 'top' }, deckOptions: { gap: Spacing.sm }, pressed: { opacity: 0.75 },
});

