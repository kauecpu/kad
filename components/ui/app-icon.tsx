import ExpoIonicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

type ExpoIconProps = ComponentProps<typeof ExpoIonicons>;
type IconName = ExpoIconProps['name'];
type AppIconProps = ExpoIconProps & {
  filled?: boolean;
};

export const AppIconSize = {
  compact: 14,
  standard: 20,
  featured: 28,
} as const;

function filledIconName(name: IconName): IconName {
  const outlineSuffix = '-outline';

  if (name.endsWith(outlineSuffix)) {
    const filledName = name.slice(0, -outlineSuffix.length) as IconName;
    if (filledName in ExpoIonicons.glyphMap) return filledName;
  }

  return name;
}

function standardizedIconSize(requestedSize: number | undefined): number {
  if (requestedSize !== undefined && requestedSize <= 15) return AppIconSize.compact;
  if (requestedSize !== undefined && requestedSize >= 24) return AppIconSize.featured;
  return AppIconSize.standard;
}

function AppIconBase({ name, size, filled = true, ...props }: AppIconProps) {
  return (
    <ExpoIonicons
      {...props}
      name={filled ? filledIconName(name) : name}
      size={standardizedIconSize(size)}
    />
  );
}

const AppIcon = Object.assign(AppIconBase, { glyphMap: ExpoIonicons.glyphMap });

export default AppIcon;
