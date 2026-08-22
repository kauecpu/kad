import { Redirect } from 'expo-router';

import { APP_ROUTE_ALIASES } from '@/lib/app-feature-catalog';

export default function RankRedirect() {
  return <Redirect href={APP_ROUTE_ALIASES.rank} />;
}
