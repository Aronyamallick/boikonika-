import { Spinner } from '@/components/ui/spinner';

export default function Loading() {
  return (
    <div className="container-page flex justify-center py-24 text-primary">
      <Spinner className="h-8 w-8" label="Loading" />
    </div>
  );
}
