import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Segmented, type SegmentedOption } from '@/components/ui/segmented';
import { FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { initials } from '@/lib/format';
import {
  createQuestionComment,
  deleteQuestionComment,
  loadQuestionComments,
  setQuestionCommentLiked,
  updateQuestionComment,
  type QuestionComment,
} from '@/lib/question-comments-api';
import { useApp } from '@/providers/app-provider';
import { useAuth } from '@/providers/auth-provider';

type CommentSort = 'recent' | 'liked';

const SORT_OPTIONS: SegmentedOption<CommentSort>[] = [
  { value: 'recent', label: 'Mais recentes' },
  { value: 'liked', label: 'Mais curtidos' },
];

function relativeDate(value: string): string {
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `há ${days} d`;
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(
    new Date(value)
  );
}

export function QuestionComments({ questionId }: { questionId: string }) {
  const { colors } = useTheme();
  const { profile } = useApp();
  const { user, isConfigured } = useAuth();
  const [comments, setComments] = useState<QuestionComment[]>([]);
  const [sort, setSort] = useState<CommentSort>('recent');
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!user) {
      setComments([]);
      setError(undefined);
      return;
    }
    let active = true;
    setLoading(true);
    setError(undefined);
    loadQuestionComments(questionId, user.id)
      .then((next) => {
        if (active) setComments(next);
      })
      .catch(() => {
        if (active) setError('Não foi possível carregar os comentários.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [questionId, user]);

  const visibleComments = useMemo(
    () =>
      [...comments].sort((a, b) =>
        sort === 'liked'
          ? b.likes - a.likes || b.createdAt.localeCompare(a.createdAt)
          : b.createdAt.localeCompare(a.createdAt)
      ),
    [comments, sort]
  );

  const publish = async () => {
    const text = draft.trim();
    if (!text || !user || saving) return;
    setSaving(true);
    setError(undefined);
    try {
      const next = await createQuestionComment({
        questionId,
        userId: user.id,
        author: profile.name.trim() || 'Estudante',
        text,
      });
      setComments((current) => [next, ...current]);
      setDraft('');
      setSort('recent');
    } catch {
      setError('Não foi possível publicar o comentário.');
    } finally {
      setSaving(false);
    }
  };

  const toggleLike = async (comment: QuestionComment) => {
    if (!user) return;
    const liked = !comment.likedByMe;
    setComments((current) =>
      current.map((item) =>
        item.id === comment.id
          ? { ...item, likedByMe: liked, likes: Math.max(0, item.likes + (liked ? 1 : -1)) }
          : item
      )
    );
    try {
      await setQuestionCommentLiked(comment.id, user.id, liked);
    } catch {
      setComments((current) =>
        current.map((item) => (item.id === comment.id ? comment : item))
      );
      setError('Não foi possível atualizar a curtida.');
    }
  };

  const beginEdit = (comment: QuestionComment) => {
    setDeletingId(null);
    setEditingId(comment.id);
    setEditingText(comment.text);
  };

  const saveEdit = async () => {
    const text = editingText.trim();
    if (!editingId || !text || !user) return;
    setSaving(true);
    try {
      const updated = await updateQuestionComment(editingId, user.id, text);
      setComments((current) =>
        current.map((item) =>
          item.id === editingId
            ? { ...item, text: updated.text, updatedAt: updated.updated_at }
            : item
        )
      );
      setEditingId(null);
      setEditingText('');
    } catch {
      setError('Não foi possível editar o comentário.');
    } finally {
      setSaving(false);
    }
  };

  const removeComment = async (comment: QuestionComment) => {
    if (!user) return;
    setSaving(true);
    try {
      await deleteQuestionComment(comment.id, user.id);
      setComments((current) => current.filter((item) => item.id !== comment.id));
      setDeletingId(null);
    } catch {
      setError('Não foi possível excluir o comentário.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.section, { borderTopColor: colors.border }]}>
      <View style={styles.headingRow}>
        <View style={styles.headingText}>
          <Ionicons name="chatbubble-outline" size={19} color={colors.primary} />
          <Text style={[styles.title, { color: colors.text }]}>Comentários</Text>
        </View>
        <Text style={[styles.count, { color: colors.textSubtle }]}>{comments.length}</Text>
      </View>

      {user ? (
        <View style={[styles.composer, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Escreva um comentário"
            placeholderTextColor={colors.textSubtle}
            multiline
            maxLength={500}
            textAlignVertical="top"
            accessibilityLabel="Novo comentário"
            style={[styles.composerInput, { color: colors.text }]}
          />
          <View style={styles.composerFooter}>
            <Text style={[styles.characterCount, { color: colors.textSubtle }]}>{draft.length}/500</Text>
            <Button
              label={saving ? 'Enviando...' : 'Comentar'}
              icon="send-outline"
              onPress={publish}
              disabled={!draft.trim() || saving}
            />
          </View>
        </View>
      ) : (
        <View style={[styles.accountNotice, { backgroundColor: colors.surfaceAlt }]}> 
          <Ionicons name="person-outline" size={18} color={colors.textMuted} />
          <Text style={[styles.accountNoticeText, { color: colors.textMuted }]}> 
            {isConfigured
              ? 'Entre na sua conta para ver e participar dos comentários.'
              : 'Os comentários compartilhados serão ativados ao conectar o banco.'}
          </Text>
        </View>
      )}

      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

      {comments.length > 1 ? (
        <Segmented options={SORT_OPTIONS} value={sort} onChange={setSort} />
      ) : null}

      {loading ? (
        <Text style={[styles.loading, { color: colors.textSubtle }]}>Carregando comentários...</Text>
      ) : visibleComments.length === 0 && user ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Nenhum comentário ainda</Text>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>Compartilhe como você resolveu a questão.</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {visibleComments.map((comment, index) => (
            <View
              key={comment.id}
              style={[
                styles.comment,
                index < visibleComments.length - 1 && {
                  borderBottomColor: colors.border,
                  borderBottomWidth: StyleSheet.hairlineWidth,
                },
              ]}>
              <View style={styles.commentHeader}>
                <View style={[styles.avatar, { backgroundColor: colors.primarySoft }]}>
                  <Text style={[styles.avatarText, { color: colors.primary }]}>
                    {initials(comment.author)}
                  </Text>
                </View>
                <View style={styles.authorText}>
                  <Text style={[styles.author, { color: colors.text }]}>{comment.author}</Text>
                  <Text style={[styles.date, { color: colors.textSubtle }]}>
                    {relativeDate(comment.updatedAt ?? comment.createdAt)}
                    {comment.updatedAt ? ' · editado' : ''}
                  </Text>
                </View>
              </View>

              {editingId === comment.id ? (
                <View style={styles.editArea}>
                  <TextInput
                    value={editingText}
                    onChangeText={setEditingText}
                    multiline
                    maxLength={500}
                    autoFocus
                    accessibilityLabel="Editar comentário"
                    style={[
                      styles.editInput,
                      { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface },
                    ]}
                  />
                  <View style={styles.editActions}>
                    <Pressable
                      onPress={() => setEditingId(null)}
                      accessibilityRole="button"
                      accessibilityLabel="Cancelar edição">
                      <Text style={[styles.textAction, { color: colors.textMuted }]}>Cancelar</Text>
                    </Pressable>
                    <Pressable
                      onPress={saveEdit}
                      disabled={!editingText.trim() || saving}
                      accessibilityRole="button"
                      accessibilityLabel="Salvar comentário">
                      <Text style={[styles.textAction, { color: colors.primary }]}>Salvar</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Text style={[styles.commentText, { color: colors.textMuted }]}>{comment.text}</Text>
              )}

              <View style={styles.actions}>
                <Pressable
                  onPress={() => toggleLike(comment)}
                  accessibilityRole="button"
                  accessibilityLabel={`${comment.likedByMe ? 'Descurtir' : 'Curtir'} comentário de ${comment.author}`}
                  style={styles.likeButton}>
                  <Ionicons
                    name={comment.likedByMe ? 'heart' : 'heart-outline'}
                    size={17}
                    color={comment.likedByMe ? colors.primary : colors.textSubtle}
                  />
                  <Text
                    style={[
                      styles.likeCount,
                      { color: comment.likedByMe ? colors.primary : colors.textSubtle },
                    ]}>
                    {comment.likes}
                  </Text>
                </Pressable>
                {comment.isOwn && editingId !== comment.id ? (
                  deletingId === comment.id ? (
                    <View style={styles.deleteActions}>
                      <Text style={[styles.deletePrompt, { color: colors.textMuted }]}>Excluir?</Text>
                      <Pressable
                        onPress={() => setDeletingId(null)}
                        accessibilityRole="button"
                        accessibilityLabel="Cancelar exclusão">
                        <Text style={[styles.textAction, { color: colors.textMuted }]}>Cancelar</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => removeComment(comment)}
                        disabled={saving}
                        accessibilityRole="button"
                        accessibilityLabel="Confirmar exclusão">
                        <Text style={[styles.textAction, { color: colors.danger }]}>Confirmar</Text>
                      </Pressable>
                    </View>
                  ) : (
                  <>
                    <Pressable
                      onPress={() => beginEdit(comment)}
                      accessibilityRole="button"
                      accessibilityLabel="Editar comentário">
                      <Text style={[styles.textAction, { color: colors.textMuted }]}>Editar</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setDeletingId(comment.id)}
                      accessibilityRole="button"
                      accessibilityLabel="Excluir comentário">
                      <Text style={[styles.textAction, { color: colors.danger }]}>Excluir</Text>
                    </Pressable>
                  </>
                  )
                ) : null}
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.md, paddingTop: Spacing.lg, borderTopWidth: StyleSheet.hairlineWidth },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headingText: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  title: { fontSize: FontSize.heading, fontWeight: FontWeight.bold },
  count: { fontSize: FontSize.small, fontWeight: FontWeight.semibold },
  composer: { gap: Spacing.sm, padding: Spacing.md, borderWidth: 1, borderRadius: Radius.md },
  composerInput: { minHeight: 62, fontSize: FontSize.body, lineHeight: 20, padding: 0 },
  composerFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  characterCount: { fontSize: FontSize.tiny },
  accountNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
  },
  accountNoticeText: { flex: 1, fontSize: FontSize.small, lineHeight: 19 },
  error: { fontSize: FontSize.small },
  loading: { paddingVertical: Spacing.md, fontSize: FontSize.small, textAlign: 'center' },
  list: { gap: 0 },
  comment: { gap: Spacing.sm, paddingVertical: Spacing.md },
  commentHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  avatar: { width: 32, height: 32, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: FontSize.tiny, fontWeight: FontWeight.bold },
  authorText: { flex: 1, gap: 1 },
  author: { fontSize: FontSize.small, fontWeight: FontWeight.semibold },
  date: { fontSize: FontSize.tiny },
  commentText: { fontSize: FontSize.body, lineHeight: 21 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  likeButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  likeCount: { fontSize: FontSize.small, fontWeight: FontWeight.medium },
  textAction: { fontSize: FontSize.small, fontWeight: FontWeight.semibold },
  deleteActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  deletePrompt: { fontSize: FontSize.small },
  editArea: { gap: Spacing.sm },
  editInput: { minHeight: 72, padding: Spacing.sm, borderWidth: 1, borderRadius: Radius.md, fontSize: FontSize.body },
  editActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.lg },
  empty: { alignItems: 'center', gap: 3, paddingVertical: Spacing.lg },
  emptyTitle: { fontSize: FontSize.body, fontWeight: FontWeight.semibold },
  emptyText: { fontSize: FontSize.small, textAlign: 'center' },
});
