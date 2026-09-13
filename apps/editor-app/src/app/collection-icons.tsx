import { createElement } from 'react';
import {
  BookOpen,
  Briefcase,
  CalendarDays,
  Camera,
  GraduationCap,
  Heart,
  Megaphone,
  Newspaper,
  Package,
  Star,
  type LucideIcon,
} from 'lucide-react';

/**
 * The icons a collection can wear in the sidebar.
 *
 * A short curated list, not the whole lucide set: the choice is made
 * once when somebody names a collection, and a thousand-icon picker turns a
 * two-second decision into a browsing session. Everything unknown falls
 * back rather than rendering a hole in a list of eleven entries.
 */
export const COLLECTION_ICONS: Record<string, LucideIcon> = {
  newspaper: Newspaper,
  'calendar-days': CalendarDays,
  briefcase: Briefcase,
  'book-open': BookOpen,
  star: Star,
  megaphone: Megaphone,
  camera: Camera,
  package: Package,
  'graduation-cap': GraduationCap,
  heart: Heart,
};

export const COLLECTION_ICON_NAMES = Object.keys(COLLECTION_ICONS);

export function collectionIcon(name: string): LucideIcon {
  return COLLECTION_ICONS[name] ?? Newspaper;
}

/** Rendered with createElement, never `<Icon />` — see block-icons.tsx: a component built during render trips React. */
export function CollectionIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  return createElement(collectionIcon(name), { className });
}
