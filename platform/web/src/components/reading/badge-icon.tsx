import { Award, BookCheck, Brain, CalendarCheck, Compass, Library, PenLine, Share2, Star, Trophy, Users, type LucideIcon } from 'lucide-react';

const ICONS: Record<string, LucideIcon> = { 'book-check': BookCheck, compass: Compass, star: Star, 'share-2': Share2, award: Award, 'calendar-check': CalendarCheck, 'pen-line': PenLine, brain: Brain, users: Users, library: Library };

/** Lucide icon named by a badge's `icon` key (a trophy when unknown). */
export function BadgeIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? Trophy;
  return <Icon className={className} aria-hidden="true" />;
}
