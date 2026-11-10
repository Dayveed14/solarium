const BASE = `${import.meta.env.VITE_API_URL ?? ''}/api`;

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request(path, { method = 'GET', body, raw, headers } = {}) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      credentials: 'include',
      headers: raw ? { 'Content-Type': raw.type, ...headers } : body ? { 'Content-Type': 'application/json', ...headers } : headers,
      body: raw ?? (body ? JSON.stringify(body) : undefined),
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Could not reach TerraVoltix. Check your connection and try again.');
  }

  if (res.status === 204) return null;
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON response */
  }
  if (!res.ok) {
    throw new ApiError(
      res.status,
      data?.error?.code ?? 'UNKNOWN',
      data?.error?.message ?? 'Something went wrong. Please try again.',
      data?.error?.details
    );
  }
  return data;
}

export const apiUrl = (path) => `${BASE}${path}`;
const post = (path, body) => request(path, { method: 'POST', body });
const put = (path, body) => request(path, { method: 'PUT', body });
const patch = (path, body) => request(path, { method: 'PATCH', body });
const del = (path) => request(path, { method: 'DELETE' });
const qs = (params) => {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
  return q ? `?${q}` : '';
};

export const api = {
  // password reset
  forgotPassword: (email) => post('/auth/forgot-password', { email }),
  resetPassword: (token, password) => post('/auth/reset-password', { token, password }),

  // admin
  adminSummary: () => request('/admin/summary'),
  adminVendors: (status) => request(`/admin/vendors${qs({ status })}`),
  adminVendorVerification: (id, status, note) => patch(`/admin/vendors/${id}/verification`, { status, ...(note ? { note } : {}) }),
  adminVendorReview: (id) => request(`/admin/vendors/${id}/review`),
  adminInstallers: (status) => request(`/admin/installers${qs({ status })}`),
  adminInstaller: (id) => request(`/admin/installers/${id}`),
  adminInstallerDecision: (id, status, note) => patch(`/admin/installers/${id}/verification`, { status, ...(note ? { note } : {}) }),
  adminUsers: (params) => request(`/admin/users${qs(params)}`),
  adminUser: (id) => request(`/admin/users/${id}`),
  adminUserStatus: (id, status) => patch(`/admin/users/${id}/status`, { status }),
  adminSettings: () => request('/admin/settings'),
  adminSaveSettings: (changes) => put('/admin/settings', { changes }),
  adminAudit: () => request('/admin/audit'),
  adminProducts: (params) => request(`/admin/products${qs(params)}`),
  adminUpdateProduct: (id, body) => put(`/admin/products/${id}`, body),
  adminDeleteProduct: (id) => del(`/admin/products/${id}`),
  adminUploadImage: (blob) => request('/admin/images', { method: 'POST', raw: blob }),
  // site audits: business
  auditList: () => request('/audits'),
  auditRequest: (body) => post('/audits', body),
  auditGet: (ref) => request(`/audits/${ref}`),
  // site audits: field agent
  agentCatalog: () => request('/agent/catalog'),
  agentJobs: () => request('/agent/jobs'),
  agentJob: (ref) => request(`/agent/jobs/${ref}`),
  agentStart: (ref) => post(`/agent/jobs/${ref}/start`),
  agentSaveDraft: (ref, form) => put(`/agent/jobs/${ref}/draft`, { form }),
  agentPreview: (ref, form) => post(`/agent/jobs/${ref}/preview`, { form }),
  agentPhoto: (ref, slot, blob) => request(`/agent/jobs/${ref}/photos/${slot}`, { method: 'POST', raw: blob }),
  agentSubmit: (ref, form) => post(`/agent/jobs/${ref}/submit`, { form }),
  // site audits: admin
  adminAudits: (status) => request(`/admin/audits${qs({ status })}`),
  adminAudit: (ref) => request(`/admin/audits/${ref}`),
  adminAuditAssign: (ref, agentId) => post(`/admin/audits/${ref}/assign`, { agentId }),
  adminAuditReopen: (ref, note) => post(`/admin/audits/${ref}/reopen`, { note }),
  adminAuditApprove: (ref, note) => post(`/admin/audits/${ref}/approve`, note ? { note } : {}),
  adminAuditTechnical: (ref, note) => post(`/admin/audits/${ref}/technical-review`, { note }),
  adminAgents: () => request('/admin/field-agents'),
  adminAgentCreate: (body) => post('/admin/field-agents', body),

  // energy analysis
  catalog: (segment) => request(`/analysis/catalog/${segment}`),
  estimate: (input) => post('/analysis/estimate', input),
  interest: (category, email) => post('/interest', { category, email }),
  adminInterest: () => request('/interest'),
  saveAssessment: (input) => post('/analysis/assessments', input),
  listAssessments: () => request('/analysis/assessments'),
  getAssessment: (id) => request(`/analysis/assessments/${id}`),

  // vendor dashboard
  vendorSummary: () => request('/vendor/summary'),
  vendorVerification: () => request('/vendor/verification'),
  vendorUploadDocument: (file, kind, label) => request(`/vendor/documents${qs({ kind, label })}`, { method: 'POST', raw: file }),
  vendorDeleteDocument: (id) => del(`/vendor/documents/${id}`),
  vendorSubmitVerification: () => post('/vendor/verification/submit'),

  // installer
  installerSummary: () => request('/installer/summary'),
  installerQuiz: () => request('/installer/quiz'),
  installerRegistration: () => request('/installer/registration'),
  installerSaveRegistration: (patch) => put('/installer/registration', patch),
  installerSaveReferences: (references) => put('/installer/references', { references }),
  installerSubmitRegistration: () => post('/installer/registration/submit', { declaration: true }),
  installerUploadDocument: (file, kind, label) => request(`/installer/documents${qs({ kind, label })}`, { method: 'POST', raw: file }),
  installerDeleteDocument: (id) => del(`/installer/documents/${id}`),
  adminInstallerReference: (id, refId, called, note) => patch(`/admin/installers/${id}/references/${refId}`, { called, ...(note ? { note } : {}) }),
  installerSubmitQuiz: (answers, yearsExperience) => post('/installer/quiz', { answers, ...(yearsExperience != null ? { yearsExperience } : {}) }),
  vendorProducts: () => request('/vendor/products'),
  vendorCreateProduct: (body) => post('/vendor/products', body),
  vendorUpdateProduct: (id, body) => put(`/vendor/products/${id}`, body),
  vendorDeleteProduct: (id) => del(`/vendor/products/${id}`),
  vendorDeals: () => request('/vendor/deals'),
  vendorCreateDeal: (body) => post('/vendor/deals', body),
  vendorUpdateDeal: (id, body) => put(`/vendor/deals/${id}`, body),
  vendorEaasRules: () => request('/vendor/eaas-rules'),
  vendorEaasPreview: (body) => post('/vendor/eaas-preview', body),
  vendorDealStatus: (id, status) => patch(`/vendor/deals/${id}/status`, { status }),
  vendorDeleteDeal: (id) => del(`/vendor/deals/${id}`),
  vendorRequests: () => request('/vendor/requests'),
  vendorRequestStatus: (id, status) => patch(`/vendor/requests/${id}/status`, { status }),

  // customer offers
  offers: (assessmentId, plan) => request(`/offers/assessments/${assessmentId}?plan=${plan}`),
  diyQuote: (assessmentId, items) => post(`/offers/assessments/${assessmentId}/diy-quote`, { items }),
  sendRequest: (assessmentId, body) => post(`/offers/assessments/${assessmentId}/requests`, body),
  myRequests: () => request('/offers/requests'),
  cancelRequest: (id) => post(`/offers/requests/${id}/cancel`),

  uploadImage: (blob) => request('/vendor/images', { method: 'POST', raw: blob }),
  // vendor registration fee (only used once registration is switched to paid)
  partners: () => request('/partners'),
  vendorSubscription: () => request('/vendor/subscription'),
  vendorSubscriptionStart: (months) => post('/vendor/subscription/start', { months }),
  vendorSubscriptionVerify: (reference) => post('/vendor/subscription/verify', { reference }),
  vendorSubscriptionMockPay: (reference) => post('/vendor/subscription/mock-pay', { reference }),
  adminSubscriptions: () => request('/admin/subscriptions'),
  adminSubscriptionGrant: (id, days) => post(`/admin/subscriptions/${id}/grant`, { days }),
  adminSubscriptionGrantAll: (days, vendorType) => post('/admin/subscriptions/grant-all', { days, ...(vendorType ? { vendorType } : {}) }),
  vendorFeeStart: () => post('/vendor/fee/start'),
  vendorFeeVerify: (reference) => post('/vendor/fee/verify', { reference }),
  vendorFeeMockPay: (reference) => post('/vendor/fee/mock-pay', { reference }),
  vendorLeasePreview: (body) => post('/vendor/lease-preview', body),

  // public shop (always for one state)
  shopProducts: (params = {}) => request(`/shop/products${qs(params)}`),
  shopDeals: (params = {}) => request(`/shop/deals${qs(params)}`),
  shopBudgetPicks: (params = {}) => request(`/shop/budget-picks${qs(params)}`),
  shopProduct: (id, dest) => request(`/shop/products/${id}${qs(dest ?? {})}`),
  shopDeal: (id, dest) => request(`/shop/deals/${id}${qs(dest ?? {})}`),

  // installation requests (customer)
  installBands: () => request('/installations/bands'),
  installList: () => request('/installations'),
  installCreate: (body) => post('/installations', body),
  installGet: (ref) => request(`/installations/${ref}`),
  installPay: (ref) => post(`/installations/${ref}/pay`),
  installVerify: (reference) => post('/installations/verify', { reference }),
  installMockPay: (reference) => post('/installations/mock-pay', { reference }),
  installCancel: (ref) => post(`/installations/${ref}/cancel`),
  installConfirm: (ref) => post(`/installations/${ref}/confirm`),
  installNoShow: (ref) => post(`/installations/${ref}/no-show`),
  installProblem: (ref, note) => post(`/installations/${ref}/problem`, { note }),
  installReview: (ref, body) => post(`/installations/${ref}/review`, body),
  // installer jobs
  jobsOpen: () => request('/installer/jobs'),
  jobsMine: () => request('/installer/jobs/mine'),
  jobAccept: (ref) => post(`/installer/jobs/${ref}/accept`, { confirmAvailable: true }),
  jobDecline: (ref) => post(`/installer/jobs/${ref}/decline`),
  jobOnMyWay: (ref) => post(`/installer/jobs/${ref}/on-my-way`),
  jobArrived: (ref) => post(`/installer/jobs/${ref}/arrived`),
  jobStart: (ref) => post(`/installer/jobs/${ref}/start`),
  jobPhoto: (ref, kind, blob) => request(`/installer/jobs/${ref}/photos/${kind}`, { method: 'POST', raw: blob }),
  jobPhotoDelete: (ref, id) => del(`/installer/jobs/${ref}/photos/${id}`),
  jobComplete: (ref, summary) => post(`/installer/jobs/${ref}/complete`, { summary }),
  // repairs: customer
  repairOptions: () => request('/repairs/options'),
  repairList: () => request('/repairs'),
  repairCreate: (body) => post('/repairs', body),
  repairGet: (ref) => request(`/repairs/${ref}`),
  repairPhoto: (ref, blob) => request(`/repairs/${ref}/photos`, { method: 'POST', raw: blob }),
  repairPhotoDelete: (ref, id) => del(`/repairs/${ref}/photos/${id}`),
  repairPay: (ref) => post(`/repairs/${ref}/pay`),
  repairVerify: (reference) => post('/repairs/verify', { reference }),
  repairMockPay: (reference) => post('/repairs/mock-pay', { reference }),
  repairCancel: (ref) => post(`/repairs/${ref}/cancel`),
  repairApproveQuote: (ref) => post(`/repairs/${ref}/approve-quote`),
  repairDeclineQuote: (ref) => post(`/repairs/${ref}/decline-quote`),
  repairApproveVariation: (ref, id) => post(`/repairs/${ref}/variations/${id}/approve`),
  repairDeclineVariation: (ref, id) => post(`/repairs/${ref}/variations/${id}/decline`),
  repairConfirm: (ref) => post(`/repairs/${ref}/confirm`),
  repairProblem: (ref, note) => post(`/repairs/${ref}/problem`, { note }),
  repairReview: (ref, body) => post(`/repairs/${ref}/review`, body),
  repairNoShow: (ref) => post(`/repairs/${ref}/no-show`),
  // repairs: technician
  techOffers: () => request('/installer/repairs'),
  techRepairs: () => request('/installer/repairs/mine'),
  techRepair: (ref) => request(`/installer/repairs/${ref}`),
  techAccept: (ref) => post(`/installer/repairs/${ref}/accept`),
  techDecline: (ref) => post(`/installer/repairs/${ref}/decline`),
  techOnMyWay: (ref) => post(`/installer/repairs/${ref}/on-my-way`),
  techArrived: (ref) => post(`/installer/repairs/${ref}/arrived`),
  techPhoto: (ref, blob) => request(`/installer/repairs/${ref}/photos`, { method: 'POST', raw: blob }),
  techPhotoDelete: (ref, id) => del(`/installer/repairs/${ref}/photos/${id}`),
  techReport: (ref, body) => post(`/installer/repairs/${ref}/report`, body),
  techStart: (ref) => post(`/installer/repairs/${ref}/start`),
  techAwaitingParts: (ref, note) => post(`/installer/repairs/${ref}/awaiting-parts`, { note }),
  techPartsArrived: (ref) => post(`/installer/repairs/${ref}/parts-arrived`),
  techVariation: (ref, body) => post(`/installer/repairs/${ref}/variations`, body),
  techVariationWithdraw: (ref, id) => post(`/installer/repairs/${ref}/variations/${id}/withdraw`),
  techCompletionPhoto: (ref, blob) => request(`/installer/repairs/${ref}/completion-photos`, { method: 'POST', raw: blob }),
  techCompletionPhotoDelete: (ref, id) => del(`/installer/repairs/${ref}/completion-photos/${id}`),
  techComplete: (ref, summary) => post(`/installer/repairs/${ref}/complete`, { summary }),
  // repairs: admin
  adminRepairs: (status) => request(`/admin/repairs${qs({ status })}`),
  adminRepair: (ref) => request(`/admin/repairs/${ref}`),
  adminRepairApprove: (ref) => post(`/admin/repairs/${ref}/approve`),
  adminRepairDecline: (ref) => post(`/admin/repairs/${ref}/decline`),
  adminRepairAssign: (ref, technicianId) => post(`/admin/repairs/${ref}/assign`, { technicianId }),
  adminRepairCancel: (ref, reason) => post(`/admin/repairs/${ref}/cancel`, { reason }),
  adminRepairRefunded: (ref) => post(`/admin/repairs/${ref}/refunded`),
  adminRepairConfirm: (ref) => post(`/admin/repairs/${ref}/confirm`),
  adminRepairPayoutPaid: (ref) => post(`/admin/repairs/${ref}/payout-paid`),
  // admin installations
  adminInstalls: (filter) => request(`/admin/installations${filter === 'needs_action' ? '?needsAction=1' : qs({ status: filter })}`),
  adminInstall: (ref) => request(`/admin/installations/${ref}`),
  adminInstallApprove: (ref) => post(`/admin/installations/${ref}/approve`),
  adminInstallDecline: (ref) => post(`/admin/installations/${ref}/decline`),
  adminInstallAssign: (ref, installerId) => post(`/admin/installations/${ref}/assign`, { installerId }),
  adminInstallConfirm: (ref) => post(`/admin/installations/${ref}/confirm`),
  adminInstallCancel: (ref, reason) => post(`/admin/installations/${ref}/cancel`, { reason }),
  adminInstallPayout: (ref) => post(`/admin/installations/${ref}/payout-paid`),
  adminInstallRefunded: (ref) => post(`/admin/installations/${ref}/refunded`),

  // blog
  blogList: (limit, filters = {}) => request(`/blog${qs({ limit, ...filters })}`),
  blogGet: (slug) => request(`/blog/${encodeURIComponent(slug)}`),
  adminBlogList: () => request('/admin/blog'),
  adminBlogGet: (id) => request(`/admin/blog/${id}`),
  adminBlogCreate: (body) => post('/admin/blog', body),
  adminBlogUpdate: (id, body) => put(`/admin/blog/${id}`, body),
  adminBlogDelete: (id) => del(`/admin/blog/${id}`),

  // checkout and orders
  quote: (items, destination) => post('/checkout/quote', { items, destination }),
  checkout: (items, destination, key) => request('/checkout', { method: 'POST', body: { items, destination }, headers: { 'Idempotency-Key': key } }),
  payAgain: (ref) => post(`/checkout/${ref}/pay`),
  verifyPayment: (reference) => post('/checkout/verify', { reference }),
  mockPay: (reference) => post('/checkout/mock-pay', { reference }),
  myOrders: () => request('/orders'),
  myOrder: (ref) => request(`/orders/${ref}`),
  confirmReceived: (ref, voId) => post(`/orders/${ref}/received/${voId}`),
  vendorOrders: (status) => request(`/vendor/orders${qs({ status })}`),
  vendorOrderAction: (id, action, note) => post(`/vendor/orders/${id}/${action}`, note ? { note } : {}),
  adminOrders: (params) => request(`/admin/orders${qs(params)}`),
  adminOrderStats: () => request('/admin/orders/stats'),
  adminOrderAction: (id, action) => post(`/admin/orders/${id}/${action}`, {}),
  adminOrderEvents: (ref) => request(`/admin/orders/ref/${ref}/events`),
  dispatchInfo: (t) => request(`/dispatch/info${qs({ t })}`),
  dispatchConfirm: (t) => post('/dispatch/confirm', { t }),

  // auth
  register: (body) => post('/auth/register', body),
  verifyOtp: (body) => post('/auth/verify-otp', body),
  resendOtp: (body) => post('/auth/resend-otp', body),
  login: (body) => post('/auth/login', body),
  logout: () => post('/auth/logout'),
  me: () => request('/auth/me'),
  areas: () => request('/auth/areas'),
  switchAccount: (role) => post('/auth/switch', { role }),
  addAccount: (body) => post('/auth/accounts', body),
  updateProfile: (body) => put('/auth/profile', body),
  changePassword: (body) => post('/auth/change-password', body),
};
