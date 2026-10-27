import { useAuth } from '../auth/AuthContext.jsx';
import AdminShell from './admin/AdminShell.jsx';
import AdminVendors from './admin/AdminVendors.jsx';
import Dashboard from './Dashboard.jsx';
import InstallerHome from './installer/InstallerHome.jsx';
import VendorOverview from './vendor/VendorOverview.jsx';
import VendorShell from './vendor/VendorShell.jsx';

// /app looks different for each kind of account.
export default function AppHome() {
  const { user } = useAuth();
  if (user.role === 'admin') {
    return (
      <AdminShell>
        <AdminVendors />
      </AdminShell>
    );
  }
  if (user.role === 'vendor') {
    return (
      <VendorShell open>
        <VendorOverview />
      </VendorShell>
    );
  }
  if (user.role === 'installer') return <InstallerHome />;
  return <Dashboard />;
}
