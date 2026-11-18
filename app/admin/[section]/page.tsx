import { notFound, redirect } from 'next/navigation';
import AdminDashboard from '../admin-dashboard';
import { getPageAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';
const sections: Record<string, string> = {
  applications: 'applications', jobs: 'opportunities', enquiries: 'enquiries', emails: 'email_management',
  content: 'content', settings: 'settings', analytics: 'website_analytics', projects: 'projects', assignments: 'assignments',
  services: 'services', partnerships: 'partnership_management', partners: 'partnerships', 'career-interests': 'career_interests', certificates: 'certificates',
};

export default async function AdminSectionPage({ params }: { params: Promise<{ section: string }> }) {
  if (!await getPageAdmin()) redirect('/admin/login');
  const { section } = await params;
  const initialTab = sections[section];
  if (!initialTab) notFound();
  return <AdminDashboard initialTab={initialTab} />;
}
