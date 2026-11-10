export const AUDIT_STATUS = {
  requested: 'Request received',
  assigned: 'Field agent assigned',
  in_progress: 'Audit in progress',
  submitted: 'Being checked by our team',
  technical_review: 'Being checked by our team',
  completed: 'Results ready',
  reopened: 'Being rechecked',
};
// What the admin and the agent see (the customer is not told about the technical check).
export const STAFF_STATUS = { ...AUDIT_STATUS, submitted: 'Waiting for your review', technical_review: 'In technical review' };

// The steps a business watches, in order. `reopened` sits at the "results" step with a note.
export const AUDIT_STEPS = [
  ['requested', 'Request received', 'We have your request. An agent will be assigned shortly.'],
  ['assigned', 'Field agent assigned', 'Your agent will contact you before the visit.'],
  ['in_progress', 'Audit in progress', 'The agent is surveying your site now.'],
  ['submitted', 'Checked by our team', 'The visit is done. Our team is checking the figures before your results are released.'],
  ['completed', 'Results ready', 'Your energy requirement is ready. Pick how you want to get it.'],
];
export const stepIndex = (status) => (status === 'reopened' || status === 'technical_review' ? 3 : Math.max(0, AUDIT_STEPS.findIndex(([k]) => k === status)));

export const EVENT_LABEL = {
  requested: 'Request sent', assigned: 'Agent assigned', reassigned: 'Agent changed', started: 'Visit started',
  submitted: 'Submitted for review', technical_review: 'Sent to technical review', approved: 'Approved, results released', approved_update: 'Approved, updated results released',
  completed: 'Results ready', updated: 'Updated results', reopened: 'Sent back for a recheck',
};
// The customer's timeline never mentions the internal technical check.
export const CUSTOMER_EVENT = { ...EVENT_LABEL, technical_review: null };

export const PHOTO_LABEL = {
  checkin: 'Check-in photo', building: 'The building or site', plaza: 'The building or site', roof: 'Roof', meter: 'Electricity meter or board',
  exterior: 'Outside', interior: 'Inside', equipment_space: 'Where the equipment would go', generator: 'Generator and its size plate',
  signature: "Client's signature", agent_signature: "Agent's signature",
};
export const SITE_TYPE_LABEL = {
  home: 'Home', shop: 'Shop or kiosk', plaza: 'Plaza or market', office: 'Office', restaurant: 'Restaurant, bar or hotel', school: 'School',
  clinic: 'Clinic or pharmacy', worship: 'Church or mosque', factory: 'Factory or workshop', farm: 'Farm', other: 'Other',
};
export const SOURCE_LABEL = { generator: 'Generator', inverter: 'Inverter and battery', solar: 'Solar already installed', other: 'Something else' };
