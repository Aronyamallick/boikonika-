import { cn } from '@/lib/cn';

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('animate-pulse rounded-md bg-skeleton', className)} />;
}

export function BookCardSkeleton() {
  return (
    <div className="space-y-2" aria-hidden="true">
      <Skeleton className="aspect-[2/3] w-full rounded-lg" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-3 w-3/5" />
      <Skeleton className="h-4 w-1/3" />
    </div>
  );
}
