const ACHIEVEMENT_ICONS: Record<string, string> = {
  'footsteps-outline': 'Footprints',
  'flame-outline': 'Flame',
  'walk-outline': 'Route',
  'ribbon-outline': 'Ribbon',
  'fitness-outline': 'Dumbbell',
  'medal-outline': 'Medal',
  'trophy-outline': 'Trophy',
  'checkmark-circle-outline': 'CircleCheck',
  'locate-outline': 'Crosshair',
  'shield-checkmark-outline': 'ShieldCheck',
  'calendar-outline': 'CalendarDays',
  'calendar-number-outline': 'CalendarRange',
  'infinite-outline': 'Infinity',
  'stopwatch-outline': 'Clock3',
  'timer-outline': 'Timer',
  'podium-outline': 'ChartNoAxesColumnIncreasing',
  'albums-outline': 'Layers3',
  'layers-outline': 'Layers3',
  'library-outline': 'Library',
  'star-outline': 'Star',
  'star-half-outline': 'StarHalf',
  'sparkles-outline': 'Sparkles',
  'diamond-outline': 'Diamond',
};

export function achievementIconName(name: string): string {
  return ACHIEVEMENT_ICONS[name] ?? 'Award';
}
