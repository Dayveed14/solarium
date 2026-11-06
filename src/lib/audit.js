export const AUDIT_STATUS = {
  requested: 'Request received',
  assigned: 'Field agent assigned',
  in_progress: 'Audit in progress',
  completed: 'Results ready',
  reopened: 'Being rechecked',
};

// The steps a business watches, in order. `reopened` sits at the "results" step with a note.
export const AUDIT_STEPS = [
  ['requested', 'Request received', 'We have your request. An agent will be assigned shortly.'],
  ['assigned', 'Field agent assigned', 'Your agent will contact you before the visit.'],
  ['in_progress', 'Audit in progress', 'The agent is surveying your site now.'],
  ['completed', 'Results ready', 'Your energy requirement is ready. Pick how you want to get it.'],
];
export const stepIndex = (status) => (status === 'reopened' ? 3 : Math.max(0, AUDIT_STEPS.findIndex(([k]) => k === status)));

export const EVENT_LABEL = {
  requested: 'Request sent', assigned: 'Agent assigned', reassigned: 'Agent changed', started: 'Visit started',
  completed: 'Results ready', updated: 'Updated results', reopened: 'Sent back for a recheck',
};

export const PHOTO_LABEL = {
  plaza: 'Full plaza or building', roof: 'Roof', exterior: 'Shop exterior', interior: 'Shop interior',
  equipment_space: 'Where the equipment would go', generator: 'Generator and its size plate', signature: "Owner's signature",
};
