import { Baby, Backpack, BookOpen, Briefcase, Feather, Globe, GraduationCap, Lamp, Library, Lightbulb, Microscope, Palette, PenTool, Printer, Sun, Tablet, type LucideIcon } from 'lucide-react';

/** Icons admins can assign to categories (names match the seed data and the admin picker). */
const ICONS: Record<string, LucideIcon> = {
  baby: Baby,
  backpack: Backpack,
  'book-open': BookOpen,
  briefcase: Briefcase,
  feather: Feather,
  globe: Globe,
  'graduation-cap': GraduationCap,
  'lamp-desk': Lamp,
  library: Library,
  lightbulb: Lightbulb,
  microscope: Microscope,
  palette: Palette,
  'pen-tool': PenTool,
  printer: Printer,
  sun: Sun,
  tablet: Tablet,
};

export function CategoryIcon({ name, className }: { name: string | null; className?: string }) {
  const Icon = (name && ICONS[name]) || BookOpen;
  return <Icon className={className} aria-hidden="true" />;
}
