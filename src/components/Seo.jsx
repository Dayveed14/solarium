import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { PUBLIC_PAGES, SITE_NAME, TAGLINE, applySeo, isPrivatePath, organizationLd } from '../lib/seo.js';

// Page-level override: <Seo title="..." description="..." jsonLd={...} />. Runs after RouteSeo so it wins.
export default function Seo(props) {
  const key = JSON.stringify(props);
  useEffect(() => { applySeo(props); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [key]);
  return null;
}

// Sets sensible defaults for every route: listed public pages get their copy, private pages and unknown URLs get noindex.
export function RouteSeo() {
  const { pathname } = useLocation();
  useEffect(() => {
    const page = PUBLIC_PAGES[pathname];
    if (page) applySeo({ ...page, path: pathname, jsonLd: pathname === '/' ? organizationLd() : null });
    else if (isPrivatePath(pathname)) applySeo({ title: `${SITE_NAME}: ${TAGLINE}`, path: pathname, noindex: true });
    else if (/^\/shop\/(product|deal)\//.test(pathname)) applySeo({ title: `Shop | ${SITE_NAME}`, path: pathname }); // ItemPage replaces this once it has loaded
    else applySeo({ title: `Page not found | ${SITE_NAME}`, path: pathname, noindex: true });
  }, [pathname]);
  return null;
}
