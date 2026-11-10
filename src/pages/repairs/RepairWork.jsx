import { useState } from 'react';
import { api } from '../../api.js';
import { naira } from '../../lib/format.js';
import { PayNotice, PhotoTiles } from './shared.jsx';

const stamp = (iso) => new Date(iso).toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Lagos' });

// The itemised list of a revision: what is extra and why.
function VariationBox({ v, children }) {
  return (
    <div className="review-box">
      <p><strong>{v.status === 'proposed' ? 'The technician asks to change the estimate' : 'Revised estimate'}</strong> <span className="muted">({v.status})</span></p>
      <p className="request-message">{v.reason}</p>
      <table className="cost-table">
        <tbody>
          {v.parts.map((p, i) => <tr key={i}><td>{p.name}</td><td>{p.qty} × {naira(p.unitPrice)}</td><td>{naira(p.amount)}</td></tr>)}
          {v.labour > 0 && <tr><td colSpan="2">Labour</td><td>{naira(v.labour)}</td></tr>}
        </tbody>
        <tfoot><tr><th colSpan="2">Extra cost</th><th>{naira(v.extraTotal)}</th></tr></tfoot>
      </table>
      {children}
    </div>
  );
}

function Stars({ value, onChange }) {
  return (
    <div className="stars" role="radiogroup" aria-label="Your rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} star${n === 1 ? '' : 's'}`} className={n <= value ? 'on' : ''} onClick={() => onChange(n)}>★</button>
      ))}
    </div>
  );
}

// After the estimate: approve and pay, the repair, changes to the price, confirming the work and leaving a review.
export default function RepairWork({ r, act, busy, reqRef: ref, payNotice }) {
  const [problem, setProblem] = useState('');
  const [reporting, setReporting] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const w = r.work;
  const pending = w?.variations.find((v) => v.status === 'proposed');
  const goPay = (fn) => act(async () => { const p = await fn(); if (p.authorizationUrl) window.location.assign(p.authorizationUrl); });
  const due = r.report?.amountDue ?? 0;

  return (
    <>
      {r.status === 'inspected' && (
        <section className="fee-gate" aria-label="Approve the estimate">
          <h2>Go ahead with the repair?</h2>
          <p>Total repair cost {naira(r.report.total)}. Your call-out fee of {naira(r.report.callOutCredit)} is credited, so you pay <strong>{naira(due)}</strong> now{due === 0 ? ' (nothing more)' : ''}. The money is held by TerraVoltix and the technician is paid when you confirm the finished work.</p>
          <PayNotice text={payNotice} />
          <div className="row-actions">
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => goPay(() => api.repairApproveQuote(ref))}>{busy ? 'Please wait…' : due > 0 ? `Approve and pay ${naira(due)}` : 'Approve the estimate'}</button>
            {!declining && <button type="button" className="btn btn-quiet" disabled={busy} onClick={() => setDeclining(true)}>No thanks</button>}
          </div>
          {declining && (
            <div className="review-box">
              <p><strong>Turn down this estimate?</strong> The visit has been done, so your call-out fee of {naira(r.callOutFee)} is not refunded. Nothing else is charged.</p>
              <div className="row-actions">
                <button type="button" className="btn btn-primary" disabled={busy} onClick={() => act(async () => { await api.repairDeclineQuote(ref); setDeclining(false); })}>Yes, no repair</button>
                <button type="button" className="btn btn-quiet" onClick={() => setDeclining(false)}>Keep thinking</button>
              </div>
            </div>
          )}
        </section>
      )}

      {w && (
        <section className="fee-gate" aria-label="The repair">
          <h2>The repair</h2>
          <p>Agreed price <strong>{naira(w.agreedTotal)}</strong> · you have paid <strong>{naira(w.paidAmount)}</strong> in total.</p>
          {r.status === 'approved' && <p className="muted">Paid. Your technician will start the repair soon.</p>}
          {r.status === 'in_repair' && <p className="muted">Your technician is working on it.</p>}
          {r.status === 'awaiting_parts' && <aside className="r-banner"><div><strong>Waiting for parts.</strong><span>{w.partsNote}</span></div></aside>}

          {pending && (
            <VariationBox v={pending}>
              <PayNotice text={payNotice} />
              <p className="muted">Nothing changes unless you approve. If you decline, the work continues as originally agreed.</p>
              <div className="row-actions">
                <button type="button" className="btn btn-primary" disabled={busy} onClick={() => goPay(() => api.repairApproveVariation(ref, pending.id))}>Approve and pay {naira(pending.extraTotal)}</button>
                <button type="button" className="btn btn-quiet" disabled={busy} onClick={() => act(() => api.repairDeclineVariation(ref, pending.id))}>Decline the change</button>
              </div>
            </VariationBox>
          )}
          {w.variations.filter((v) => v.status !== 'proposed').length > 0 && (
            <ul className="doc-list">
              {w.variations.filter((v) => v.status !== 'proposed').map((v) => <li key={v.id}><div><strong>Revision: {naira(v.extraTotal)} extra</strong><small>{v.reason}</small></div><small>{v.status}</small></li>)}
            </ul>
          )}

          {w.completion && (
            <div className="review-box">
              <p><strong>The technician says the work is finished</strong></p>
              <p className="request-message">{w.completion.summary}</p>
              <PhotoTiles base={`/repairs/${r.ref}`} ids={w.completion.photos} />
            </div>
          )}
          {r.status === 'repair_done' && !w.problem && (
            <>
              <p>Please check the work. {w.confirmDueAt && <>If you do nothing, it is closed automatically on <strong>{stamp(w.confirmDueAt)}</strong>.</>}</p>
              <div className="row-actions">
                <button type="button" className="btn btn-primary" disabled={busy} onClick={() => act(() => api.repairConfirm(ref))}>Everything works: confirm</button>
                {!reporting && <button type="button" className="btn btn-quiet" disabled={busy} onClick={() => setReporting(true)}>Report a problem</button>}
              </div>
              {reporting && (
                <div className="review-box">
                  <label className="field"><span>What is wrong?</span><textarea rows={3} maxLength={500} value={problem} onChange={(e) => setProblem(e.target.value)} /></label>
                  <p className="muted">Reporting a problem stops the automatic close. Our team will contact you and the technician.</p>
                  <div className="row-actions">
                    <button type="button" className="btn btn-primary" disabled={busy || problem.trim().length < 10} onClick={() => act(async () => { await api.repairProblem(ref, problem.trim()); setReporting(false); })}>Send to TerraVoltix</button>
                    <button type="button" className="btn btn-quiet" onClick={() => setReporting(false)}>Never mind</button>
                  </div>
                </div>
              )}
            </>
          )}
          {r.status === 'repair_done' && w.problem && <aside className="r-banner"><div><strong>You reported a problem.</strong><span>Our team is looking into it and will be in touch. You can still confirm if it gets sorted out.</span></div></aside>}
          {r.status === 'repair_done' && w.problem && <p><button type="button" className="btn btn-quiet" disabled={busy} onClick={() => act(() => api.repairConfirm(ref))}>It is fixed now: confirm</button></p>}

          {r.status === 'completed' && !w.review && (
            <div className="review-box">
              <p><strong>All done. How was it?</strong></p>
              <Stars value={rating} onChange={setRating} />
              <label className="field"><span>Anything to add? (optional)</span><input type="text" maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)} /></label>
              <button type="button" className="btn btn-primary" disabled={busy || rating === 0} onClick={() => act(() => api.repairReview(ref, { rating, ...(comment.trim() ? { comment: comment.trim() } : {}) }))}>Send review</button>
            </div>
          )}
          {w.review && <p className="muted">Your review: {'★'.repeat(w.review.rating)}{'☆'.repeat(5 - w.review.rating)}{w.review.comment ? ` · "${w.review.comment}"` : ''}</p>}
        </section>
      )}
    </>
  );
}
