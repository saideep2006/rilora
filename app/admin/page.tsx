import { redirect } from 'next/navigation';
import AdminDashboard from './admin-dashboard';
import { getPageAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  if (!await getPageAdmin()) redirect('/admin/login');
  return <AdminDashboard initialTab="overview" />;
}
