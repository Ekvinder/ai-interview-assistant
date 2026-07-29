import { redirect } from 'next/navigation';

/**
 * The waiting room now lives at /dashboard/interview/waiting/[id].
 * Direct visits to /dashboard/interview/waiting without an ID go back to the dashboard.
 */
export default function WaitingRoomIndexPage() {
  redirect('/dashboard');
}
