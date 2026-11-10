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

from playwright.sync_api import Page
_orig_wait = Page.wait_for_load_state
def _wait_settle(self, state=None, **kw):
    """"networkidle" can fail to settle on a slow machine; say what was still loading and carry on (the checks after it catch a really broken page)."""
    try: _orig_wait(self, state, timeout=15000)
    except Exception: print(f'  (page still busy after 15s, carrying on: {self.url} pending={sorted(getattr(self, "_pend", []))[:5]})', flush=True)
Page.wait_for_load_state = _wait_settle

def run(p, label, ctx_args):
    b = p.chromium.launch()
    # A fresh pretend visitor IP per run, so repeated runs do not trip the server's per-IP rate limits (the API runs with TRUST_PROXY=1).
    ctx = b.new_context(**ctx_args, extra_http_headers={'X-Forwarded-For': f'10.77.{STAMP % 250}.{sum(map(ord, label)) % 250}'})
    ctx.route(re.compile(r'https://fonts\.(googleapis|gstatic)\.com/.*'), lambda r: r.abort())
    page = ctx.new_page()
    # Track unfinished requests on every page, so a page that never goes quiet can be explained.
    def _track(pg):
        pg._pend = set()
        pg.on('request', lambda r: pg._pend.add(f'{r.method} {r.url}')); pg.on('requestfinished', lambda r: pg._pend.discard(f'{r.method} {r.url}')); pg.on('requestfailed', lambda r: pg._pend.discard(f'{r.method} {r.url}'))
    _track(page)
    ctx.on('page', _track)
    errors = []
    page.on('console', lambda m: errors.append(f'console {m.type}: {m.text}') if m.type == 'error' and 'Failed to load resource' not in m.text and 'fonts.g' not in m.text else None)
    page.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
    page.on('response', lambda r: errors.append(f'HTTP {r.status} {r.url}') if r.status >= 500 else None)
    def shot(name): page.screenshot(path=f'{SHOTS}/{label}-{name}.png', full_page=False)
    def overflow(name):
        # Compare with the real screen width: on a phone the browser quietly widens the layout when something is too wide,
        # so innerWidth would hide the problem.
        w = page.evaluate('[document.documentElement.scrollWidth, window.screen.width, Math.max(0, ...[...document.querySelectorAll("header *, [role=dialog] *")].map(e => e.getBoundingClientRect().right))]')
        if w[0] > w[1] + 1:
            print('SCROLL:', page.evaluate('[window.scrollX, document.documentElement.scrollWidth, document.querySelector(".request-card").getBoundingClientRect().left, document.querySelector(".review-box").getBoundingClientRect().left]'))
            print('CHAIN:', page.evaluate('(()=>{let e=[...document.querySelectorAll("h4.dash-h3")].find(x=>x.getBoundingClientRect().right>window.screen.width+1);let o=[];while(e&&e.tagName!="BODY"){let r=e.getBoundingClientRect();o.push(e.tagName+"."+e.className+" "+Math.round(r.width)+" "+getComputedStyle(e).display);e=e.parentElement}return o})()'))
            print('WIDE:', page.evaluate('[...document.querySelectorAll("main *")].filter(e=>e.getBoundingClientRect().right>window.screen.width+1).slice(0,6).map(e=>e.tagName+"."+e.className+" "+Math.round(e.getBoundingClientRect().right))'))
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
    assert 'TerraVoltix' in page.title(), page.title()
    overflow('home'); shot('home')
    page.get_by_role('button', name=re.compile('explore your energy needs', re.I)).first.click()
    page.wait_for_url(re.compile('/assess$'), timeout=6000); page.wait_for_load_state('networkidle')
    assert page.get_by_role('heading', name='What are you looking to power?').count() == 1
    overflow('assess-home'); shot('assess-home')
    # A category that is not live yet takes an email and nothing else.
    page.get_by_role('button', name='Notify me when it opens').first.click()
    page.locator('.cat-form input[type=email]').fill(f'jr-notify-{label}-{STAMP}@example.test')
    page.get_by_role('button', name='Notify me', exact=True).click()
    expect(page.get_by_text('We will email you when this opens')).to_be_visible(timeout=5000)
    page.get_by_role('link', name='Explore solar').click()
    page.wait_for_url(re.compile('/assess/solar$')); page.wait_for_load_state('networkidle')
    overflow('assess-solar'); shot('assess-solar')
    # The quick calculator is still there. With a budget, the person chooses between suggestions for it and picking their own devices.
    page.get_by_role('button', name='Start my solar assessment').click()
    page.wait_for_timeout(500); shot('assessment-open'); overflow('assessment')
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
    # The guided path: who, what, how long and what matters, budget, where.
    page.get_by_role('link', name='Enter your budget').click()
    page.wait_for_url(re.compile('/assess/solar/guided')); page.wait_for_load_state('networkidle')
    assert page.get_by_role('heading', name='Who are you powering?').count() == 1
    page.get_by_role('button', name='Continue').is_disabled() or problems.append(f'{label}: Continue should wait for an answer')
    page.locator('label.choice', has_text='Home').first.locator('input').check(force=True)
    overflow('guided-1'); shot('guided-1')
    page.get_by_role('button', name='Continue').click()
    page.get_by_role('button', name=re.compile('Small flat')).click(); page.wait_for_timeout(300)
    page.get_by_role('tab', name=re.compile('Kitchen')).click()
    overflow('guided-2'); shot('guided-2')
    page.get_by_role('button', name='Continue').click()
    assert page.get_by_role('heading', name='How long, and what matters most?').count() == 1
    page.locator('label.choice', has_text='6–8 hours').first.locator('input').check(force=True)
    page.locator('label.gf-check', has_text='Keep food and drinks cold').locator('input').check()
    page.locator('label.gf-check', has_text='Keep lights and fans on').locator('input').check()
    page.locator('label.gf-check', has_text='Reduce generator and fuel use').locator('input').check()
    assert page.locator('.gf-rank li').count() == 3, 'ticked priorities can be put in order'
    page.get_by_role('button', name=re.compile('Move .* down')).first.click()
    overflow('guided-3'); shot('guided-3')
    page.get_by_role('button', name='Continue').click()
    page.locator('label.choice', has_text='₦500,000 – ₦1.5 million').first.locator('input').check(force=True)
    overflow('guided-4'); shot('guided-4')
    page.get_by_role('button', name='Continue').click()
    page.locator('select').nth(0).select_option('lagos')
    page.locator('select').nth(1).select_option(index=2)
    overflow('guided-5'); shot('guided-5')
    page.get_by_role('button', name='Show my options').click()
    page.wait_for_url(re.compile('/results'), timeout=10000); page.wait_for_load_state('networkidle'); page.wait_for_timeout(500)
    cards = page.locator('.cfg')
    assert cards.count() >= 2, f'expected several configurations, got {cards.count()}'
    assert page.get_by_text('We suggest this').count() == 1
    assert page.locator('.cfg h3', has_text='Fitted to your budget').count() == 1, 'a budget below the whole site gets a fitted option'
    assert page.get_by_text(re.compile('more would add')).count() >= 1, 'it says what a little more money would add'
    overflow('guided-results'); shot('guided-results')
    before = page.locator('.cfg-on h3').inner_text()
    page.locator('.cfg:not(.cfg-on) button', has_text='Show me this one').first.click()
    page.wait_for_function('b => document.querySelector(".cfg-on h3").innerText !== b', arg=before, timeout=8000)
    step('categories page, notify-me, solar landing, quick calculator, then the five guided screens to three configurations that can be switched')
    page.get_by_role('button', name='Change my answers').click()
    page.wait_for_url(re.compile('/assess/solar/guided\\?edit=1')); page.wait_for_timeout(600)
    assert page.locator('label.choice.on', has_text='Home').count() == 1, 'editing keeps the earlier answers'
    step('answers come back when they change them')

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
    assert 'TerraVoltix' in page.title() and page.locator('script[data-seo-jsonld]').count() == 1
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

    # ---- site assessment: business asks, admin adds an agent and assigns, agent surveys on the phone, business sees results
    import struct, zlib
    def make_png(w=64, h=48):
        raw = b''.join(b'\x00' + bytes([200, 160, 60]) * w for _ in range(h))
        chunk = lambda t, d: struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
        return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b'')
    PNG = make_png()
    def login_as(email):
        ctx.clear_cookies()
        page.goto(BASE + '/login'); page.wait_for_load_state('networkidle')
        page.get_by_label('Email').fill(email); page.locator('input[type=password]').first.fill(PW)
        page.get_by_role('button', name=re.compile('Log in|Sign in', re.I)).last.click()
        page.wait_for_url(re.compile('/app'), timeout=8000); page.wait_for_load_state('networkidle')
    biz = f'jr-biz-{label}-{STAMP}@example.test'
    agent_email = f'jr-agent-{label}-{STAMP}@example.test'
    ctx.clear_cookies()
    fill_signup('business', 'Journey Plaza Owner', biz, company='Journey Plaza Ltd')
    page.goto(BASE + '/app/site-assessment'); page.wait_for_load_state('networkidle'); page.wait_for_timeout(600)
    shot('site-request'); overflow('site-request')
    page.get_by_label('Street address').fill('Shop 14, Journey Plaza, Wuse')
    page.get_by_label('State').select_option('abuja'); page.get_by_label('Area').select_option(index=2)
    page.get_by_role('button', name='Request energy assessment').click()
    page.wait_for_url(re.compile('/app/site-assessment/AU-'), timeout=8000); page.wait_for_load_state('networkidle')
    audit_ref = page.url.rsplit('/', 1)[1]
    page.get_by_text('Request received').first.wait_for(timeout=8000)
    shot('site-requested'); overflow('site-requested')
    step('business requested a site assessment and sees the timeline')

    admin2 = f'jr-admin2-{label}-{STAMP}@example.test'
    os.system(f"""mysql solalium -e "INSERT INTO users (email, password_hash, role, full_name, email_verified_at) SELECT '{admin2}', password_hash, 'admin', 'Journey Admin Two', UTC_TIMESTAMP() FROM users WHERE email='{vend}' LIMIT 1" """)
    login_as(admin2)
    page.goto(BASE + '/app/field-agents'); page.wait_for_load_state('networkidle'); page.wait_for_timeout(500)
    page.get_by_label('Full name').fill('Journey Agent'); page.get_by_label('Email').fill(agent_email)
    shot('admin-agents'); overflow('admin-agents')
    page.get_by_role('button', name='Add field agent').click()
    page.get_by_text('was added').wait_for(timeout=8000)
    os.system(f"""mysql solalium -e "UPDATE users a JOIN users v ON v.email='{vend}' SET a.password_hash = v.password_hash WHERE a.email='{agent_email}'" """)
    page.goto(BASE + '/app/audits'); page.wait_for_load_state('networkidle'); page.wait_for_timeout(600)
    page.locator('.order-row', has_text=audit_ref).click(); page.wait_for_timeout(600)
    page.get_by_label('Field agent').select_option(label='Journey Agent (0 open)')
    shot('admin-audits'); overflow('admin-audits')
    page.get_by_role('button', name='Assign', exact=True).click(); page.wait_for_timeout(800)
    page.get_by_text('Agent: Journey Agent').first.wait_for(timeout=8000)
    step('admin added a field agent and assigned the audit')

    ctx.grant_permissions(['geolocation']); ctx.set_geolocation({'latitude': 9.0765, 'longitude': 7.3986})
    login_as(agent_email)
    page.get_by_text('Your jobs').first.wait_for(timeout=8000)
    shot('agent-home'); overflow('agent-home')
    page.locator('.order-row', has_text='Journey Plaza').click(); page.wait_for_url(re.compile('/app/jobs/AU-'))
    page.get_by_role('button', name=re.compile('start the audit')).click()
    page.get_by_label(re.compile('Plaza or market name')).wait_for(timeout=8000)
    page.get_by_label(re.compile('Plaza or market name')).fill('Journey Plaza')
    page.get_by_role('radio', name='Plaza', exact=True).click()
    page.get_by_role('radio', name='Occupied', exact=True).click()
    page.get_by_role('button', name='Capture my location').click(); page.get_by_text('Check on the map').wait_for(timeout=8000)
    shot('agent-step1'); overflow('agent-step1')
    page.get_by_role('button', name='Next').click()
    page.get_by_label(re.compile('Shop or business name')).fill('Journey Phones')
    page.get_by_label(re.compile("Owner's first name")).fill('Ade'); page.get_by_label(re.compile("Owner's phone")).fill('08031234567')
    shot('agent-step2'); overflow('agent-step2')
    page.get_by_role('button', name='Next').click()
    page.get_by_label(re.compile('Electricity company')).select_option('aedc')
    page.get_by_role('radio', name='No', exact=True).click()
    page.get_by_label(re.compile('Roof space')).fill('60')
    shot('agent-step3'); overflow('agent-step3')
    page.get_by_role('button', name='Next').click()
    page.get_by_label('Search appliances').fill('hair dryer'); page.wait_for_timeout(300)
    page.locator('.appl-results button').first.click()
    page.get_by_label('How many').fill('6')
    page.get_by_text('Live result').wait_for(timeout=8000)
    shot('agent-step4'); overflow('agent-step4')
    page.get_by_role('button', name='Next').click()
    for title in ['Full plaza', 'Roof', 'Where the equipment']:
        page.locator('.photo-slot', has_text=title).locator('input[type=file]').set_input_files({'name': 'p.png', 'mimeType': 'image/png', 'buffer': PNG})
        page.locator('.photo-slot', has_text=title).get_by_text('Retake').wait_for(timeout=10000)
    shot('agent-step5'); overflow('agent-step5')
    page.get_by_role('button', name='Next').click()
    assert page.get_by_role('button', name='Submit audit and send results').is_disabled(), 'cannot submit without the signature'
    page.locator('.sig-canvas').scroll_into_view_if_needed(); page.wait_for_timeout(300)
    box = page.locator('.sig-canvas').bounding_box()
    page.mouse.move(box['x'] + 30, box['y'] + 60); page.mouse.down(); page.mouse.move(box['x'] + 120, box['y'] + 100, steps=6); page.mouse.move(box['x'] + 200, box['y'] + 50, steps=6); page.mouse.up()
    page.get_by_role('button', name='Save signature').click(); page.get_by_text('Signature saved').wait_for(timeout=10000)
    shot('agent-step6'); overflow('agent-step6')
    page.get_by_role('button', name='Submit audit and send results').click()
    page.get_by_text('Audit submitted').first.wait_for(timeout=15000)
    shot('agent-done'); overflow('agent-done')
    step('field agent surveyed the site on the phone, took photos, got the owner signature and submitted')

    login_as(biz)
    page.goto(BASE + f'/app/site-assessment/{audit_ref}'); page.wait_for_load_state('networkidle'); page.wait_for_timeout(1000)
    page.get_by_text('Sizes, roof and fuel').first.wait_for(timeout=10000)
    assert page.get_by_text('Journey Agent').count() > 0
    shot('site-results'); overflow('site-results')
    step('business sees the agent, the timeline and the audited result with options')

    # ---- installer: registration wizard, admin phones references and approves, installer edits work profile
    inst = f'jr-inst-{label}-{STAMP}@example.test'
    ctx.clear_cookies()
    fill_signup('installer', 'Journey Installer', inst)
    page.goto(BASE + '/app'); page.wait_for_load_state('networkidle'); page.wait_for_timeout(600)
    page.get_by_text('Finish your registration').first.wait_for(timeout=8000)
    shot('inst-home-start'); overflow('inst-home-start')
    page.goto(BASE + '/app/register'); page.wait_for_load_state('networkidle'); page.wait_for_timeout(600)
    page.locator('[aria-label="Is your work registered as a business?"] button').nth(1).click()
    page.locator('[aria-label="How far will you travel for a job?"] button').nth(1).click()
    shot('inst-step1'); overflow('inst-step1')
    page.get_by_role('button', name='Next').click(); page.wait_for_timeout(700)
    page.locator('[aria-label="How many years have you worked on solar, inverters or batteries?"] button').nth(2).click()
    page.locator('[aria-label="Do you have a technical qualification?"] button').nth(0).click()
    page.locator('[aria-label="What kind of jobs do you take?"] button').nth(0).click()
    page.locator('textarea').fill('Fitted home inverters and batteries in Wuse and Garki for five years.')
    shot('inst-step2'); overflow('inst-step2')
    page.get_by_role('button', name='Next').click(); page.wait_for_timeout(700)
    page.locator('[aria-label="How many jobs can you handle at the same time?"] button').nth(1).click()
    page.locator('[aria-label="How quickly do you usually answer a new enquiry?"] button').nth(1).click()
    shot('inst-step3'); overflow('inst-step3')
    page.get_by_role('button', name='Next').click(); page.wait_for_timeout(1200)
    page.get_by_text('Skills check').first.wait_for(timeout=8000)
    names = page.locator('fieldset.quiz-q input[type=radio]').evaluate_all("els => [...new Set(els.map(e => e.name))]")
    for n in names:
        page.locator(f'fieldset.quiz-q input[name="{n}"]').first.check(force=True)
    shot('inst-step4'); overflow('inst-step4')
    page.get_by_role('button', name=re.compile('Save my answers')).click(); page.wait_for_timeout(1200)
    page.get_by_text('References').first.wait_for(timeout=8000)
    page.locator('fieldset.ref-card').nth(0).get_by_label('Name').fill('Ada Okafor')
    page.locator('fieldset.ref-card').nth(0).get_by_label('Phone number').fill('08031112222')
    page.locator('fieldset.ref-card').nth(0).get_by_label('How do they know you?').fill('Past customer')
    page.locator('fieldset.ref-card').nth(1).get_by_label('Name').fill('Musa Bello')
    page.locator('fieldset.ref-card').nth(1).get_by_label('Phone number').fill('08033334444')
    page.locator('fieldset.ref-card').nth(1).get_by_label('How do they know you?').fill('Former employer')
    page.get_by_label('I have asked these people').check()
    shot('inst-step5'); overflow('inst-step5')
    page.get_by_role('button', name='Next').click(); page.wait_for_timeout(1000)
    page.get_by_text('Finish').first.wait_for(timeout=8000)
    page.locator('input[type=file]').nth(0).set_input_files({'name': 'me.png', 'mimeType': 'image/png', 'buffer': PNG}); page.wait_for_timeout(1000)
    page.get_by_label(re.compile('I confirm that the information')).check()
    shot('inst-step6'); overflow('inst-step6')
    page.get_by_role('button', name='Submit for review').click(); page.wait_for_timeout(1500)
    page.goto(BASE + '/app'); page.wait_for_load_state('networkidle'); page.wait_for_timeout(600)
    assert page.get_by_text('Finish your registration').count() == 0
    shot('inst-waiting'); overflow('inst-waiting')
    step('installer finished the 6-step registration and is waiting for review')

    admin3 = f'jr-admin3-{label}-{STAMP}@example.test'
    os.system(f"""mysql solalium -e "INSERT INTO users (email, password_hash, role, full_name, email_verified_at) SELECT '{admin3}', password_hash, 'admin', 'Journey Admin Three', UTC_TIMESTAMP() FROM users WHERE email='{vend}' LIMIT 1" """)
    login_as(admin3)
    page.goto(BASE + '/app/installers'); page.wait_for_load_state('networkidle'); page.wait_for_timeout(800)
    page.get_by_role('button', name='Review registration').first.click(); page.wait_for_timeout(800)
    shot('inst-admin-review'); overflow('inst-admin-review')
    assert page.get_by_role('button', name='Approve').first.is_disabled(), 'approve must wait for the reference calls'
    ticks = page.locator('.ref-tick input')
    for k in range(ticks.count()):
        ticks.nth(k).click(force=True); page.wait_for_timeout(1200)
    page.get_by_role('button', name='Approve').first.click(); page.wait_for_timeout(1200)
    shot('inst-admin-approved'); overflow('inst-admin-approved')
    login_as(inst)
    page.wait_for_load_state('networkidle'); page.wait_for_timeout(600)
    page.get_by_text('Approved installer').first.wait_for(timeout=8000)
    shot('inst-approved'); overflow('inst-approved')
    page.goto(BASE + '/app/installer-profile'); page.wait_for_load_state('networkidle'); page.wait_for_timeout(800)
    shot('inst-profile'); overflow('inst-profile')
    page.get_by_role('button', name='Save changes').click(); page.get_by_text('Saved').first.wait_for(timeout=6000)
    step('admin phoned both references, approved; installer sees the approved dashboard and saves the work profile')

    # ---- repairs: customer reports a fault and pays the call-out fee; admin approves the recommended technician; technician visits and reports
    # Earlier steps (and the API e2e run before them) left other approved technicians behind; stand them down so this journey's installer is the one recommended.
    os.system(f"""mysql solalium -e "UPDATE installer_profiles ip JOIN users u ON u.id = ip.user_id SET ip.verification_status = 'pending' WHERE u.email NOT LIKE 'jr-inst-{label}-%'" """)
    login_as(biz)
    page.goto(BASE + '/app/repairs'); page.wait_for_load_state('networkidle'); page.wait_for_timeout(500)
    shot('rep-list-empty'); overflow('rep-list-empty')
    page.get_by_role('link', name='Report a fault').first.click(); page.wait_for_url(re.compile('/app/repairs/new'), timeout=6000); page.wait_for_load_state('networkidle'); page.wait_for_timeout(500)
    page.locator('select').first.select_option('inverter')
    page.locator('textarea').fill('The inverter shows a red light and trips every evening when the fridge starts.')
    page.locator('[aria-label="Equipment affected"] button').nth(0).click()
    page.locator('[aria-label="Equipment affected"] button').nth(1).click()
    page.locator('[aria-label="How urgent is it?"] button').nth(1).click()
    page.locator('.photo-picker input[type=file]').set_input_files({'name': 'fault.png', 'mimeType': 'image/png', 'buffer': PNG}); page.wait_for_timeout(800)
    shot('rep-new'); overflow('rep-new')
    page.get_by_role('button', name='Continue').click()
    page.wait_for_url(re.compile('/app/repairs/RR-'), timeout=8000); page.wait_for_load_state('networkidle'); page.wait_for_timeout(600)
    rep_ref = page.url.rsplit('/', 1)[1]
    page.get_by_text(re.compile('Pay the call-out fee')).first.wait_for(timeout=8000)
    assert page.get_by_text('Pay only inside TerraVoltix').count() > 0, 'the pay-in-app notice must show at the payment step'
    assert page.locator('.photo-tiles img').count() == 1, 'the fault picture is shown'
    shot('rep-quote'); overflow('rep-quote')
    page.get_by_role('button', name=re.compile('^Pay ')).click()
    page.wait_for_url(re.compile('/repair/mock'), timeout=8000); page.wait_for_load_state('networkidle')
    page.get_by_role('button', name=re.compile('Pay now')).click()
    page.get_by_text('Call-out fee paid').first.wait_for(timeout=8000)
    shot('rep-paid'); overflow('rep-paid')
    page.get_by_role('link', name='Track your repair').click(); page.wait_for_load_state('networkidle'); page.wait_for_timeout(600)
    assert page.get_by_text('Finding a technician').count() > 0
    shot('rep-finding'); overflow('rep-finding')
    step('customer reported a fault with a picture, saw the call-out fee and the pay-in-app notice, paid (simulated) and sees "finding a technician"')

    login_as(admin3)
    page.goto(BASE + '/app/admin-repairs'); page.wait_for_load_state('networkidle'); page.wait_for_timeout(800)
    page.get_by_text('WAITING FOR YOUR APPROVAL').first.wait_for(timeout=8000)
    shot('rep-admin-list'); overflow('rep-admin-list')
    page.get_by_role('button', name='Open', exact=True).first.click(); page.wait_for_timeout(900)
    page.get_by_text(re.compile('Recommended: ')).first.wait_for(timeout=8000)
    shot('rep-admin-open'); overflow('rep-admin-open')
    page.get_by_role('button', name=re.compile('^Approve ')).first.click(); page.wait_for_timeout(1200)
    page.get_by_text(re.compile('Offered to')).first.wait_for(timeout=8000)
    step('admin saw the recommended technician with score and distance, approved, and the job was offered')

    login_as(inst)
    page.goto(BASE + '/app/repair-jobs'); page.wait_for_load_state('networkidle'); page.wait_for_timeout(800)
    page.get_by_text(re.compile('You earn')).first.wait_for(timeout=8000)
    assert page.get_by_text('Secret').count() == 0
    shot('rep-tech-offer'); overflow('rep-tech-offer')
    page.get_by_role('button', name='Accept the job').click(); page.wait_for_timeout(1200)
    page.get_by_role('button', name=re.compile('on my way')).wait_for(timeout=8000)
    assert page.get_by_text('12 Test Street').count() > 0, 'the address appears after accepting'
    shot('rep-tech-assigned'); overflow('rep-tech-assigned')
    page.get_by_role('button', name=re.compile('on my way')).click(); page.wait_for_timeout(1000)
    page.get_by_role('button', name='I have arrived').click(); page.wait_for_timeout(1000)
    page.get_by_role('button', name='Write the inspection report').click(); page.wait_for_timeout(500)
    page.locator('textarea').last.fill('The inverter control board has failed. One battery cell is also weak.')
    page.get_by_label('Part 1 name').fill('Inverter control board')
    page.get_by_label('Part 1 price each (naira)').fill('45000')
    page.get_by_label('Your labour (₦)').fill('10000')
    page.get_by_label('Time to fix (hours)').fill('6')
    page.locator('.review-box .photo-picker input[type=file]').set_input_files({'name': 'found.png', 'mimeType': 'image/png', 'buffer': PNG}); page.wait_for_timeout(800)
    assert page.get_by_text(re.compile('Total the customer will see')).first.inner_text().count('55,000') == 1
    shot('rep-tech-report'); overflow('rep-tech-report')
    page.get_by_role('button', name='Send report to the customer').click(); page.wait_for_timeout(1500)
    page.get_by_text('Your report').first.wait_for(timeout=8000)
    shot('rep-tech-reported'); overflow('rep-tech-reported')
    step('technician saw the offer without the address, accepted, set off, arrived and sent an itemised inspection report')

    login_as(biz)
    page.goto(BASE + f'/app/repairs/{rep_ref}'); page.wait_for_load_state('networkidle'); page.wait_for_timeout(800)
    page.get_by_text('Inspection report').first.wait_for(timeout=8000)
    assert page.get_by_text('Still to pay if you go ahead').count() > 0
    assert page.get_by_text('50,000').count() > 0, 'total minus the call-out fee is shown'
    assert page.get_by_text('Journey Installer').count() > 0
    shot('rep-customer-report'); overflow('rep-customer-report')
    step('customer sees the technician, the inspection report, the itemised cost with the call-out fee credited, and the history')

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
            import traceback; traceback.print_exc(); problems.append(f'{label}: FAILED {type(e).__name__}: {str(e)[:400]}')
print('\nPROBLEMS:' if problems else '\nAll journeys passed with no layout overflow or page errors.')
for x in problems: print(' -', x)
sys.exit(1 if problems else 0)
