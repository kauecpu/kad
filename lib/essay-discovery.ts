import type { EssayTopic } from '../data/essay-topics.ts';
import type { ConcursoPack } from '../types/index.ts';
import { normalizeSearchText } from './text.ts';

export const INITIAL_ESSAY_TOPIC_COUNT = 3;

export function filterEssayTopics({
  topics,
  packs,
  query,
  packId,
}: {
  topics: EssayTopic[];
  packs: ConcursoPack[];
  query: string;
  packId: string;
}): EssayTopic[] {
  const normalizedQuery = normalizeSearchText(query);

  return topics.filter((topic) => {
    if (packId !== 'all' && topic.packId !== packId) return false;
    if (!normalizedQuery) return true;
    const pack = packs.find((item) => item.id === topic.packId);
    return normalizeSearchText(
      `${topic.title} ${topic.category} ${pack?.name ?? ''}`,
    ).includes(normalizedQuery);
  });
}

export function essayTopicDisclosure({
  topics,
  recommendedTopicId,
  hasActiveDiscovery,
  expanded,
  limit = INITIAL_ESSAY_TOPIC_COUNT,
}: {
  topics: EssayTopic[];
  recommendedTopicId?: string;
  hasActiveDiscovery: boolean;
  expanded: boolean;
  limit?: number;
}) {
  const availableTopics = hasActiveDiscovery
    ? topics
    : topics.filter((topic) => topic.id !== recommendedTopicId);
  const visibleTopics = expanded || hasActiveDiscovery
    ? availableTopics
    : availableTopics.slice(0, limit);

  return {
    visibleTopics,
    hiddenCount: Math.max(0, availableTopics.length - visibleTopics.length),
    total: availableTopics.length,
  };
}
