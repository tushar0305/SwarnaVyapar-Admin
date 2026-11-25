import { redirect } from 'next/navigation';

/** Legacy route — Overview is the real dashboard. */
export default function DashboardPage() {
  redirect('/overview');
}
