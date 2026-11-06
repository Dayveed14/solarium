import { useLocation } from 'react-router-dom';

// Inside the signed-in dashboard (/app/...) the shop, its item pages and the cart open in the dashboard
// itself. On the public website they use /shop and /cart. Every shop link is built from this, so nobody
// is sent out of the dashboard by clicking a product.
export function useShopPaths() {
  const { pathname } = useLocation();
  const inApp = pathname === '/app' || pathname.startsWith('/app/');
  return {
    inApp,
    shop: inApp ? '/app/shop' : '/shop',
    cart: inApp ? '/app/cart' : '/cart',
    product: (id) => `${inApp ? '/app/shop' : '/shop'}/product/${id}`,
    deal: (id) => `${inApp ? '/app/shop' : '/shop'}/deal/${id}`,
  };
}
