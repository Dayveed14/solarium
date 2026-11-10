import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import AssessmentModal from './components/AssessmentModal.jsx';
import AppLayout from './components/AppLayout.jsx';
import AddAccount from './pages/AddAccount.jsx';
import Profile from './pages/Profile.jsx';
import Security from './pages/Security.jsx';
import Partners from './pages/Partners.jsx';
import VendorSubscription from './pages/vendor/VendorSubscription.jsx';
import AdminSubscriptions from './pages/admin/AdminSubscriptions.jsx';
import RequireAuth, { Only } from './components/RequireAuth.jsx';
import SiteFooter from './components/SiteFooter.jsx';
import SiteHeader from './components/SiteHeader.jsx';
import AdminActivity from './pages/admin/AdminActivity.jsx';
import AdminPricing from './pages/admin/AdminPricing.jsx';
import AdminShell from './pages/admin/AdminShell.jsx';
import AdminProducts from './pages/admin/AdminProducts.jsx';
import AdminBlog from './pages/admin/AdminBlog.jsx';
import AdminInstallations from './pages/admin/AdminInstallations.jsx';
import AdminInstallers from './pages/admin/AdminInstallers.jsx';
import AdminRepairs from './pages/admin/AdminRepairs.jsx';
import Repairs from './pages/repairs/Repairs.jsx';
import RepairNew from './pages/repairs/RepairNew.jsx';
import RepairDetail from './pages/repairs/RepairDetail.jsx';
import RepairJobs from './pages/installer/RepairJobs.jsx';
import AdminUsers from './pages/admin/AdminUsers.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import AppHome from './pages/AppHome.jsx';
import Blog from './pages/Blog.jsx';
import BlogPost from './pages/BlogPost.jsx';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import NotFound from './pages/NotFound.jsx';
import AssessHome from './pages/assess/AssessHome.jsx';
import GuidedFlow from './pages/assess/GuidedFlow.jsx';
import SolarLanding from './pages/assess/SolarLanding.jsx';
import { RouteSeo } from './components/Seo.jsx';
import Offers from './pages/Offers.jsx';
import Results from './pages/Results.jsx';
import SavedAssessment from './pages/SavedAssessment.jsx';
import Shop from './pages/Shop.jsx';
import Cart from './pages/Cart.jsx';
import CheckoutReturn from './pages/CheckoutReturn.jsx';
import Dispatch from './pages/Dispatch.jsx';
import ItemPage from './pages/ItemPage.jsx';
import OrderDetail from './pages/OrderDetail.jsx';
import OrdersHome from './pages/OrdersHome.jsx';
import InstallationDetail from './pages/InstallationDetail.jsx';
import Installations from './pages/Installations.jsx';
import InstallerRegister from './pages/installer/InstallerRegister.jsx';
import InstallerProfile from './pages/installer/InstallerProfile.jsx';
import SiteAssessments from './pages/audit/SiteAssessments.jsx';
import SiteAssessmentDetail from './pages/audit/SiteAssessmentDetail.jsx';
import AgentJob from './pages/agent/AgentJob.jsx';
import AdminAudits from './pages/admin/AdminAudits.jsx';
import AdminAgents from './pages/admin/AdminAgents.jsx';
import VendorVerification from './pages/vendor/VendorVerification.jsx';
import Signup from './pages/Signup.jsx';
import Verify from './pages/Verify.jsx';
import VendorDeals from './pages/vendor/VendorDeals.jsx';
import VendorProducts from './pages/vendor/VendorProducts.jsx';
import VendorRequests from './pages/vendor/VendorRequests.jsx';
import VendorShell from './pages/vendor/VendorShell.jsx';

// Jump to #sections on the home page; otherwise start every page at the top.
function ScrollManager() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      const el = document.getElementById(hash.slice(1));
      if (el) {
        el.scrollIntoView();
        return;
      }
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

export default function App() {
  return (
    <>
      <div className="noise" aria-hidden="true" />
      <ScrollManager />
      <SiteHeader />
      <main id="top">
        <RouteSeo />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/partners" element={<Partners />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/blog/:slug" element={<BlogPost />} />
          <Route path="/assess" element={<AssessHome />} />
          <Route path="/assess/solar" element={<SolarLanding />} />
          <Route path="/assess/solar/guided" element={<GuidedFlow />} />
          <Route path="/results" element={<Results />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/verify" element={<Verify />} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/shop/product/:id" element={<ItemPage kind="product" />} />
          <Route path="/shop/deal/:id" element={<ItemPage kind="deal" />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout/return" element={<RequireAuth><CheckoutReturn /></RequireAuth>} />
          <Route path="/checkout/mock" element={<RequireAuth><CheckoutReturn mock /></RequireAuth>} />
          <Route path="/dispatch" element={<Dispatch />} />
          <Route path="/installation/return" element={<RequireAuth><CheckoutReturn kind="installation" /></RequireAuth>} />
          <Route path="/installation/mock" element={<RequireAuth><CheckoutReturn kind="installation" mock /></RequireAuth>} />
          <Route path="/repair/return" element={<RequireAuth><CheckoutReturn kind="repair" /></RequireAuth>} />
          <Route path="/repair/mock" element={<RequireAuth><CheckoutReturn kind="repair" mock /></RequireAuth>} />
          <Route path="/vendor/subscription/return" element={<RequireAuth><CheckoutReturn kind="subscription" /></RequireAuth>} />
          <Route path="/vendor/subscription/mock" element={<RequireAuth><CheckoutReturn kind="subscription" mock /></RequireAuth>} />
          <Route path="/vendor/fee/return" element={<RequireAuth><CheckoutReturn kind="fee" /></RequireAuth>} />
          <Route path="/vendor/fee/mock" element={<RequireAuth><CheckoutReturn kind="fee" mock /></RequireAuth>} />
          <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
            <Route path="/app" element={<AppHome />} />
            <Route path="/app/profile" element={<Profile />} />
            <Route path="/app/password" element={<Security />} />
            <Route path="/app/shop" element={<Only roles={['individual', 'business']}><Shop /></Only>} />
            <Route path="/app/shop/product/:id" element={<Only roles={['individual', 'business']}><ItemPage kind="product" /></Only>} />
            <Route path="/app/shop/deal/:id" element={<Only roles={['individual', 'business']}><ItemPage kind="deal" /></Only>} />
            <Route path="/app/cart" element={<Only roles={['individual', 'business']}><Cart /></Only>} />
            <Route path="/app/orders" element={<OrdersHome />} />
            <Route path="/app/orders/:ref" element={<Only roles={['individual', 'business']}><OrderDetail /></Only>} />
            <Route path="/app/add-account" element={<AddAccount />} />
            <Route path="/app/assessments/:id" element={<Only roles={['individual', 'business']}><SavedAssessment /></Only>} />
            <Route path="/app/assessments/:id/offers" element={<Only roles={['individual', 'business']}><Offers /></Only>} />
            <Route path="/app/verification" element={<Only roles={['vendor']}><VendorShell open><VendorVerification /></VendorShell></Only>} />
            <Route path="/app/installations" element={<Only roles={['individual', 'business']}><Installations /></Only>} />
            <Route path="/app/installations/:ref" element={<Only roles={['individual', 'business']}><InstallationDetail /></Only>} />
            <Route path="/app/repairs" element={<Only roles={['individual', 'business']}><Repairs /></Only>} />
            <Route path="/app/repairs/new" element={<Only roles={['individual', 'business']}><RepairNew /></Only>} />
            <Route path="/app/repairs/:ref" element={<Only roles={['individual', 'business']}><RepairDetail /></Only>} />
            <Route path="/app/repair-jobs" element={<Only roles={['installer']}><RepairJobs /></Only>} />
            <Route path="/app/admin-repairs" element={<Only roles={['admin']}><AdminShell><AdminRepairs /></AdminShell></Only>} />
            <Route path="/app/subscription" element={<Only roles={['vendor']}><VendorShell open><VendorSubscription /></VendorShell></Only>} />
            <Route path="/app/admin-subscriptions" element={<Only roles={['admin']}><AdminShell><AdminSubscriptions /></AdminShell></Only>} />
            <Route path="/app/site-assessment" element={<Only roles={['business']}><SiteAssessments /></Only>} />
            <Route path="/app/site-assessment/:ref" element={<Only roles={['business']}><SiteAssessmentDetail /></Only>} />
            <Route path="/app/jobs/:ref" element={<Only roles={['field_agent']}><AgentJob /></Only>} />
            <Route path="/app/audits" element={<Only roles={['admin']}><AdminShell><AdminAudits /></AdminShell></Only>} />
            <Route path="/app/field-agents" element={<Only roles={['admin']}><AdminShell><AdminAgents /></AdminShell></Only>} />
            <Route path="/app/register" element={<Only roles={['installer']}><InstallerRegister /></Only>} />
            <Route path="/app/installer-profile" element={<Only roles={['installer']}><InstallerProfile /></Only>} />
            <Route path="/app/quiz" element={<Navigate to="/app/register" replace />} />
            <Route path="/app/admin-installations" element={<Only roles={['admin']}><AdminShell><AdminInstallations /></AdminShell></Only>} />
            <Route path="/app/blog" element={<Only roles={['admin']}><AdminShell><AdminBlog /></AdminShell></Only>} />
            <Route path="/app/installers" element={<Only roles={['admin']}><AdminShell><AdminInstallers /></AdminShell></Only>} />
            <Route path="/app/products" element={<Only roles={['vendor']}><VendorShell><VendorProducts /></VendorShell></Only>} />
            <Route path="/app/deals" element={<Only roles={['vendor']}><VendorShell><VendorDeals /></VendorShell></Only>} />
            <Route path="/app/requests" element={<Only roles={['vendor']}><VendorShell><VendorRequests /></VendorShell></Only>} />
            <Route path="/app/pricing" element={<Only roles={['admin']}><AdminShell><AdminPricing /></AdminShell></Only>} />
            <Route path="/app/admin-products" element={<Only roles={['admin']}><AdminShell><AdminProducts /></AdminShell></Only>} />
            <Route path="/app/users" element={<Only roles={['admin']}><AdminShell><AdminUsers /></AdminShell></Only>} />
            <Route path="/app/activity" element={<Only roles={['admin']}><AdminShell><AdminActivity /></AdminShell></Only>} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <SiteFooter />
      <AssessmentModal />
    </>
  );
}
