import { redirect } from 'next/navigation';

type AdminPageComponent = () => never;

const AdminPage: AdminPageComponent = () => {
  redirect('/admin/cron-jobs');
};

export default AdminPage;
