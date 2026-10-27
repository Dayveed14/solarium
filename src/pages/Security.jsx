import { useState } from 'react';
import { ApiError, api } from '../api.js';
import { useAuth } from '../auth/AuthContext.jsx';

export default function Security() {
  const { user } = useAuth();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setErrors({});
    setFormError(null);
    setSaved(false);
    if (form.newPassword !== form.confirm) {
      setErrors({ confirm: 'The two new passwords do not match.' });
      return;
    }
    setSaving(true);
    try {
      await api.changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword });
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
      setSaved(true);
    } catch (err) {
      if (err instanceof ApiError && err.details?.fields) setErrors(err.details.fields);
      else setFormError(err.message);
    }
    setSaving(false);
  };

  const type = show ? 'text' : 'password';
  return (
    <div className="wrap dash">
      <header className="dash-head">
        <div>
          <p className="eyebrow">Your account</p>
          <h1>Change password</h1>
        </div>
      </header>
      <form onSubmit={submit} noValidate className="profile-form">
        <p className="muted">
          This changes the password for {user.email} on every account type you hold with it. Other devices where you are signed in will be logged out.
        </p>
        <label className="field">
          <span>Current password</span>
          <input type={type} autoComplete="current-password" value={form.currentPassword} onChange={set('currentPassword')} aria-invalid={Boolean(errors.currentPassword)} required />
          {errors.currentPassword && <small className="err">{errors.currentPassword}</small>}
        </label>
        <label className="field">
          <span>New password</span>
          <input type={type} autoComplete="new-password" value={form.newPassword} onChange={set('newPassword')} aria-invalid={Boolean(errors.newPassword)} required />
          <small>At least 8 characters, with a letter and a number.</small>
          {errors.newPassword && <small className="err">{errors.newPassword}</small>}
        </label>
        <label className="field">
          <span>Repeat the new password</span>
          <input type={type} autoComplete="new-password" value={form.confirm} onChange={set('confirm')} aria-invalid={Boolean(errors.confirm)} required />
          {errors.confirm && <small className="err">{errors.confirm}</small>}
        </label>
        <label className="check"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Show passwords</label>
        {formError && <p className="form-error" role="alert">{formError}</p>}
        {saved && <p className="form-ok" role="status">Password changed.</p>}
        <button type="submit" className="btn btn-primary" disabled={saving || !form.currentPassword || !form.newPassword}>{saving ? 'Saving…' : 'Change password'}</button>
      </form>
    </div>
  );
}
