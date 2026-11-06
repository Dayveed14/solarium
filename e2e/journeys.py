"""Browser journeys on desktop and mobile against a running stack (API on :4000, built client on :4173).
   python3 e2e/journeys.py <api-log-file> <screenshots-dir>
   Needs: pip install playwright. The API must run in simulation mode (no PAYSTACK_SECRET_KEY) so payment can be simulated."""
import re, sys, time, json, os
from playwright.sync_api import sync_playwright, expect

API_LOG, SHOTS = sys.argv[1], sys.argv[2]
os.makedirs(SHOTS, exist_ok=True)
BASE = 'http://localhost:4173'
STAMP = int(time.time())
PW = 'Passw0rd!long'
problems = []

def code_for(email):
    for _ in range(40):
        txt = open(API_LOG, errors='ignore').read()
        m = re.findall(r'Verification code for ' + re.escape(email) + r': (\d{6})', txt)
        if m: return m[-1]
        time.sleep(0.25)
    raise RuntimeError('no code for ' + email)

def run(p, label, ctx_args):
    b = p.chromium.launch()
    # A fresh pretend visitor IP per run, so repeated runs do not trip the server's per-IP rate limits (the API runs with TRUST_PROXY=1).
    ctx = b.new_context(**ctx_args, extra_http_headers={'X-Forwarded-For': f'10.77.{STAMP % 250}.{sum(map(ord, label)) % 250}'})
    ctx.route(re.compile(r'https://fonts\.(googleapis|gstatic)\.com/.*'), lambda r: r.abort())
    page = ctx.new_page()
    errors = []
    page.on('console', lambda m: errors.append(f'console {m.type}: {m.text}') if m.type == 'error' and 'Failed to load resource' not in m.text and 'fonts.g' not in m.text else None)
    page.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
    page.on('response', lambda r: errors.append(f'HTTP {r.status} {r.url}') if r.status >= 500 else None)
    def shot(name): page.screenshot(path=f'{SHOTS}/{label}-{name}.png', full_page=False)
    def overflow(name):
        # Compare with the real screen width: on a phone the browser quietly widens the layout when something is too wide,
        # so innerWidth would hide the problem.
        w = page.evaluate('[document.documentElement.scrollWidth, window.screen.width, Math.max(0, ...[...document.querySelectorAll("header *, [role=dialog] *")].map(e => e.getBoundingClientRect().right))]')
        if w[0] > w[1] + 1 or w[2] > w[1] + 1: problems.append(f'{label} {name}: content {w[0]}px / widest header or dialog element {round(w[2])}px on a {w[1]}px screen')
    def step(msg): print(f'  ✓ [{label}] {msg}', flush=True)
    def fill_signup(role_text, name, email, company=None, area='Yaba'):
        page.goto(BASE + '/signup'); page.wait_for_load_state('networkidle')
        if role_text and role_text != 'individual':
            page.locator('label.choice', has_text=re.compile(role_text, re.I)).first.locator('input').check(force=True)
        page.get_by_label('Your full name').fill(name)
        if company: page.get_by_label(re.compile('Company name|Shop or business|Business or organisation')).fill(company)
        page.locator('input[type=email]').fill(email)
        page.get_by_label('Phone number').fill('08031234567')
        page.get_by_label('Street address').fill('12 Test Street, Yaba')
        page.locator('select').nth(0).select_option('lagos')
        page.locator('select').nth(1).select_option(index=2)
        page.locator('input[type=password]').first.fill(PW)
        overflow('signup'); shot('signup')
        page.get_by_role('button', name=re.compile('Create|Sign up|Continue', re.I)).last.click()
        page.wait_for_url(re.compile('/verify'), timeout=8000)
        page.locator('input[inputmode=numeric]').first.fill(code_for(email))
        page.wait_for_url(re.compile('/app|/shop|/results|/$'), timeout=8000)

    # ---- visitor
    page.goto(BASE + '/'); page.wait_for_load_state('networkidle')
    assert 'Solariun' in page.title(), page.title()
    overflow('home'); shot('home')
    page.get_by_role('button', name=re.compile('explore your energy needs', re.I)).first.click()
    page.wait_for_timeout(500); shot('assessment-open'); overflow('assessment')
    # With a budget, the person chooses between suggestions for it and picking their own devices.
    page.locator('input[name=segment]').first.check(force=True)
    page.get_by_label(re.compile('How much can you spend')).fill('500000')
    page.get_by_role('button', name='Continue').click(); page.wait_for_timeout(400)
    assert page.get_by_text('Suggest for my budget').count() > 0 and page.get_by_text(re.compile('pick my devices', re.I)).count() > 0
    shot('assessment-choose'); overflow('assessment-choose')
    page.get_by_text('Suggest for my budget').click(); page.wait_for_timeout(500)
    if page.get_by_role('button', name='Lagos').count() > 0:
        page.get_by_role('button', name='Lagos').first.click()
    page.wait_for_timeout(1200)
    assert page.locator('.picks').count() > 0
    shot('assessment-picks'); overflow('assessment-picks')
    page.get_by_role('button', name='Pick my devices instead').click(); page.wait_for_timeout(600)
    assert page.get_by_text('What do you use?').count() > 0, 'picking devices goes on to the appliance step'
    page.keyboard.press('Escape')
    step('home loads, assessment dialog opens; a budget leads to suggestions or to picking devices')

    # ---- customer signs up, shops, pays (simulated)
    cust = f'jr-cust-{label}-{STAMP}@example.test'
    fill_signup('individual', 'Journey Customer', cust)
    step('customer signed up and verified by email code')
    page.goto(BASE + '/shop'); page.wait_for_load_state('networkidle'); page.wait_for_timeout(800)
    overflow('shop'); shot('shop')
    if page.get_by_role('tab', name=re.compile('Current|Saved|My address', re.I)).count():
        t = page.get_by_role('tab', name=re.compile('Current|Saved|My address', re.I)).first
        if t.is_enabled(): t.click()
    page.wait_for_timeout(800)
    cards = page.locator('a[href^="/shop/product/"]')
    n = cards.count()
    assert n > 0, 'no products shown in the shop for a Lagos customer'
    page.get_by_role('tab', name='More products').click(); page.wait_for_timeout(800)
    shot('shop-more'); overflow('shop-more')
    assert page.locator('select').count() >= 1
    step(f'shop shows {n} items; "More products" tab and type filter work')
    page.get_by_role('tab', name=re.compile('All parts')).click(); page.wait_for_timeout(600)
    page.locator('a[href^="/shop/product/"]').first.click()
    page.wait_for_url(re.compile('/shop/product/'))
    page.wait_for_timeout(600); shot('product'); overflow('product')
    assert 'Solariun' in page.title() and page.locator('script[data-seo-jsonld]').count() == 1
    page.get_by_role('button', name='Add to cart').click()
    page.goto(BASE + '/cart'); page.wait_for_load_state('networkidle'); page.wait_for_timeout(800)
    shot('cart'); overflow('cart')
    page.get_by_role('button', name=re.compile(r'^Pay|Pay ', re.I)).first.click()
    page.wait_for_url(re.compile('/checkout/mock'), timeout=10000)
    shot('pay-sim'); overflow('pay-sim')
    page.get_by_role('button', name=re.compile('pay|confirm|simulate', re.I)).first.click()
    page.wait_for_timeout(1500); shot('paid'); overflow('paid')
    page.goto(BASE + '/app/orders'); page.wait_for_load_state('networkidle'); page.wait_for_timeout(600)
    shot('orders'); overflow('orders')
    assert page.locator('text=/SL-|Order|order/').count() > 0
    step('customer added to cart, paid with the simulated page, order is listed')

    # ---- the dashboard menu keeps shoppers inside the dashboard
    if page.get_by_role('link', name='Shop', exact=True).count():
        link = page.locator('.app-nav a[href="/app/shop"], nav a[href="/app/shop"]')
        if link.count() == 0:
            page.locator('button[aria-label*="enu"]').first.click(); page.wait_for_timeout(300)
        page.goto(BASE + '/app/shop'); page.wait_for_load_state('networkidle'); page.wait_for_timeout(800)
        assert '/app/shop' in page.url, 'Shop must stay inside the dashboard'
        shot('app-shop'); overflow('app-shop')
        card = page.locator('a[href^="/app/shop/product/"]')
        assert card.count() > 0, 'in-dashboard shop cards must link inside the dashboard'
        assert page.locator('a[href^="/shop/product/"]').count() == 0
        card.first.click(); page.wait_for_url(re.compile('/app/shop/product/'))
        assert page.locator('.app-nav, aside, nav').count() > 0
        step('Shop and product pages open inside the dashboard')

    # ---- blog sections
    page.goto(BASE + '/blog'); page.wait_for_load_state('networkidle'); page.wait_for_timeout(800)
    shot('blog'); overflow('blog')
    page.locator('.blog-tabs').get_by_role('button', name='Events').click(); page.wait_for_timeout(600)
    assert 'section=events' in page.url
    step('blog has News / Stories / Events tabs that filter the list')

    # ---- vendor lists a cable (a no-size product) and a charge controller
    page2 = ctx.new_page()
    ctx.clear_cookies()
    page = page2
    page.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
    vend = f'jr-vend-{label}-{STAMP}@example.test'
    fill_signup('vendor|sell|provider', 'Journey Vendor', vend, company='Journey Solar Ltd')
    # A new vendor cannot list anything until the admin approves them: the products page sends them to verification.
    page.goto(BASE + '/app/products'); page.wait_for_load_state('networkidle'); page.wait_for_timeout(800)
    shot('vendor-gate'); overflow('vendor-gate')
    assert page.get_by_role('button', name='Add product').count() == 0, 'an unverified vendor must not be able to add products'
    assert page.locator('text=/verif/i').count() > 0, 'an unverified vendor should be told to get verified'
    step('an unverified vendor is stopped at the verification page')
    os.system(f"""mysql solalium -e "UPDATE vendor_profiles vp JOIN users u ON u.id = vp.user_id SET vp.verification_status = 'verified', vp.verified_at = UTC_TIMESTAMP() WHERE u.email = '{vend}'" """)
    page.goto(BASE + '/app/products'); page.wait_for_load_state('networkidle'); page.wait_for_timeout(800)
    shot('vendor-products'); overflow('vendor-products')
    page.get_by_role('button', name='Add product').first.click(); page.wait_for_timeout(400)
    page.get_by_label('Type').select_option('cable')
    page.get_by_label('Product name').fill('Journey solar cable 6mm')
    assert page.get_by_label(re.compile('Rating|Size|Capacity|Power|kVA|kWh|Watts')).count() == 0, 'a cable must not ask for a size'
    page.get_by_label(re.compile('Your price')).fill('45000')
    shot('vendor-form-cable'); overflow('vendor-form')
    page.get_by_role('button', name='Add product').last.click(); page.wait_for_timeout(1200)
    assert page.locator('text=Journey solar cable 6mm').count() > 0, 'new cable is not in the vendor list'
    page.get_by_role('button', name='Add product').first.click(); page.wait_for_timeout(400)
    page.get_by_label('Type').select_option('controller')
    assert page.get_by_label(re.compile('charging current', re.I)).count() >= 1, 'a charge controller must ask for amps'
    shot('vendor-form-controller')
    page.get_by_label('Product name').fill('Journey MPPT 60A')
    page.get_by_label(re.compile('charging current', re.I)).first.fill('60')
    page.get_by_label(re.compile('Your price')).fill('85000')
    page.get_by_role('button', name='Add product').last.click(); page.wait_for_timeout(1200)
    assert page.locator('text=Journey MPPT 60A').count() > 0
    shot('vendor-products-after'); overflow('vendor-products-after')
    step('vendor added a cable (no size asked) and a charge controller (amps asked); both listed')

    # ---- long description, then a deal built from a listed product plus a typed-in item, with an automatic total
    page.get_by_role('button', name='Add product').first.click(); page.wait_for_timeout(400)
    page.get_by_label('Type').select_option('cable')
    page.get_by_label('Product name').fill('Journey described cable')
    page.get_by_label(re.compile('Your price')).fill('20000')
    desc = page.get_by_label(re.compile('^Description'))
    desc.fill('Line one of a long description.\n' + ('More detail. ' * 120))
    assert 'characters' in page.locator('text=/\\/ 5,000 characters/').first.inner_text()
    shot('vendor-form-description'); overflow('vendor-form-description')
    page.get_by_role('button', name='Add product').last.click(); page.wait_for_timeout(1200)
    assert page.locator('text=Journey described cable').count() > 0
    page.goto(BASE + '/app/deals'); page.wait_for_load_state('networkidle'); page.wait_for_timeout(600)
    page.get_by_role('button', name=re.compile('Build (a|your first) deal')).first.click(); page.wait_for_timeout(500)
    page.get_by_label('Deal name').fill('Journey wiring bundle')
    page.get_by_role('button', name='+ From my products').click()
    page.get_by_label('Product').first.select_option(index=1)
    page.get_by_label('How many').first.fill('2')
    page.get_by_role('button', name='+ New item').click()
    page.get_by_label('Item name').fill('Installation kit')
    page.get_by_label('Price of one in naira').fill('15000')
    page.wait_for_timeout(300)
    total_text = page.locator('.deal-total strong').inner_text()
    assert re.search(r'[0-9]', total_text), total_text
    digits = int(re.sub(r'[^0-9]', '', total_text.split('.')[0]))
    assert digits >= 15000 + 2 * 20000 or digits >= 15000 + 2 * 45000 or digits > 15000, total_text
    page.get_by_role('button', name='Use as buy price').click()
    page.get_by_label(re.compile('Total price')).fill(str(digits))
    shot('vendor-deal-form'); overflow('vendor-deal-form')
    page.get_by_role('button', name=re.compile('Save')).last.click(); page.wait_for_timeout(1500)
    assert page.locator('text=Journey wiring bundle').count() > 0, 'the bundle deal was not saved'
    assert page.locator('text=Installation kit').count() > 0
    shot('vendor-deals-after'); overflow('vendor-deals-after')
    step('a deal of listed + typed-in items shows an automatic total and saves as a bundle')

    # ---- admin
    admin = f'jr-admin-{label}-{STAMP}@example.test'
    os.system(f"""mysql solalium -e "INSERT INTO users (email, password_hash, role, full_name, email_verified_at) SELECT '{admin}', password_hash, 'admin', 'Journey Admin', UTC_TIMESTAMP() FROM users WHERE email='{vend}' LIMIT 1" """)
    ctx.clear_cookies()
    page.goto(BASE + '/login'); page.wait_for_load_state('networkidle')
    page.get_by_label('Email').fill(admin); page.locator('input[type=password]').first.fill(PW)
    shot('login'); overflow('login')
    page.get_by_role('button', name=re.compile('Log in|Sign in', re.I)).last.click()
    page.wait_for_url(re.compile('/app'), timeout=8000)
    page.goto(BASE + '/app/admin-products'); page.wait_for_load_state('networkidle'); page.wait_for_timeout(800)
    shot('admin-products'); overflow('admin-products')
    page.locator('select').first.select_option('cable') if page.locator('select option[value="cable"]').count() else None
    page.wait_for_timeout(600)
    page.goto(BASE + '/app/pricing'); page.wait_for_load_state('networkidle'); page.wait_for_timeout(600)
    shot('admin-pricing'); overflow('admin-pricing')
    page.goto(BASE + '/app/users'); page.wait_for_load_state('networkidle'); page.wait_for_timeout(500)
    shot('admin-users'); overflow('admin-users')
    step('admin pages load (products with new types, pricing tabs, users)')

    # ---- public + SEO + 404
    page.goto(BASE + '/definitely-not-a-page'); page.wait_for_timeout(600); shot('404')
    assert page.get_attribute('meta[name=robots]', 'content').startswith('noindex')
    overflow('404')
    r = page.request.get(BASE + '/sitemap.xml'); assert r.ok and '<urlset' in r.text()
    r = page.request.get(BASE + '/robots.txt'); assert r.ok and 'Disallow: /app' in r.text()
    step('404 is noindex; sitemap.xml and robots.txt are served')

    if errors: problems.extend(f'{label}: {e}' for e in errors)
    b.close()

with sync_playwright() as p:
    for label, args in [('desktop', dict(viewport={'width': 1280, 'height': 800})), ('mobile', {**p.devices['iPhone 13']})]:
        try: run(p, label, args)
        except Exception as e:
            problems.append(f'{label}: FAILED {type(e).__name__}: {str(e)[:400]}')
print('\nPROBLEMS:' if problems else '\nAll journeys passed with no layout overflow or page errors.')
for x in problems: print(' -', x)
sys.exit(1 if problems else 0)
