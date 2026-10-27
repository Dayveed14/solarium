import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { VENDOR_REGISTRATION_FEE_REQUIRED } from '../../config/launch.js';
import VendorFeeGate from './VendorFeeGate.jsx';
import VerifyGate from './VerifyGate.jsx';

const VERIFY_LABEL = { pending: 'Pending verification', verified: 'Verified vendor', rejected: 'Not approved' };
const TYPE_LABEL = { seller: 'Seller', company: 'Company' };

// The frame every vendor page sits in: who you are, your verification status, and the tabs.
// `open` pages (the overview and Verification) are shown even before the admin approves the vendor.
export default function VendorShell({ children, open = false }) {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.vendorSummary().then((s) => !cancelled && setSummary(s)).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="wrap dash">
      <header className="dash-head">
        <div>
          <p className="eyebrow">{TYPE_LABEL[summary?.vendorType] ?? 'Vendor'} account{user.companyName ? ` · ${user.companyName}` : ''}</p>
          <h1>Vendor dashboard</h1>
        </div>
        {summary && <span className={`badge badge-${summary.verification}`}>{VERIFY_LABEL[summary.verification]}</span>}
      </header>

      {VENDOR_REGISTRATION_FEE_REQUIRED && summary?.registrationFee?.mustPay && !open ? (
        <VendorFeeGate fee={summary.registrationFee} />
      ) : summary && summary.verification !== 'verified' && !open ? (
        <VerifyGate status={summary.verification} note={summary.note} />
      ) : (
        children
      )}
    </div>
  );
}
