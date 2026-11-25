import { PageSkeleton } from '../_components/page-skeleton';

export default function HealthLoading() {
  return <PageSkeleton metrics={3} panels={2} />;
}
