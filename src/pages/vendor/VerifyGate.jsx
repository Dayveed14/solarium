import { Link } from 'react-router-dom';

// Shown in place of the selling pages until the admin has approved the vendor.
export default function VerifyGate({ status, note }) {
  return (
    <section className="fee-gate">
      <p className="eyebrow">Before you can sell</p>
      <h2>{status === 'rejected' ? 'Your verification was not approved' : 'Your account needs to be verified'}</h2>
      <p>
        {status === 'rejected'
          ? `${note ? `${note} ` : ''}Upload corrected documents and send them again.`
          : 'Upload your documents so our team can check them. Once you are approved you can post your products and deals.'}
      </p>
      <Link to="/app/verification" className="btn btn-primary">Open verification</Link>
    </section>
  );
}
