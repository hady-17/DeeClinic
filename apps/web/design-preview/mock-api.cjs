// A fake DeeClinic API with realistic sample data, for design review only.
const http = require('http');

const now = new Date();
const beirutDay = (offset = 0) => {
  const d = new Date(now.getTime() + offset * 864e5);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Beirut' }).format(d);
};
const at = (offset, hhmm) => new Date(`${beirutDay(offset)}T${hhmm}:00+02:00`).toISOString();
const iso = (s) => new Date(s).toISOString();

const ALL = ['settings.read','settings.write','services.read','services.write','clients.read','clients.write','clients.import','appointments.read','appointments.write','notes.read','notes.write','packages.read','packages.sell','packages.manage','payments.read','payments.record','payments.void','rates.read','rates.write','users.manage'];
const me = { id: 'u1', email: 'dina@deeclinic.com', fullName: 'Dina Haddad', role: 'owner', permissions: ALL };

const settings = { name: 'Dee Clinic', phoneE164: '+96101234567', address: 'Hamra Street, Beirut', timezone: 'Asia/Beirut', reminderSendTime: '10:00', noShowUsesSession: false, updatedAt: iso(now) };

const services = [
  { id: 's1', name: 'HydraFacial', category: 'skin_care', durationMinutes: 60, priceUsd: 120, followUpIntervalDays: 30, isActive: true },
  { id: 's2', name: 'Laser hair removal, underarms', category: 'laser_injectables', durationMinutes: 30, priceUsd: 60, followUpIntervalDays: 42, isActive: true },
  { id: 's3', name: 'Gel manicure', category: 'hair_nails', durationMinutes: 45, priceUsd: 35, followUpIntervalDays: 21, isActive: true },
  { id: 's4', name: 'Full leg waxing', category: 'waxing_body', durationMinutes: 40, priceUsd: 45, followUpIntervalDays: null, isActive: true },
  { id: 's5', name: 'Chemical peel', category: 'skin_care', durationMinutes: 45, priceUsd: 90, followUpIntervalDays: null, isActive: false },
].map((s) => ({ ...s, createdAt: iso(now), updatedAt: iso(now) }));

const clients = [
  ['c1', 'Rana Haddad', '+96171123456', true, false, 'instagram', 'rana.h'],
  ['c2', 'Nour Khalil', '+96170555123', true, false, 'referral', null],
  ['c3', 'Maya Fares', '+96103222111', false, true, 'walk_in', null],
  ['c4', 'Layal Aoun', '+96176987654', true, false, 'whatsapp', 'layal.aoun'],
  ['c5', 'Sara Mansour', '+96171000999', false, false, null, null],
  ['c6', 'Joumana Saad', '+96170123987', true, false, 'phone', null],
  ['c7', 'Tala Nassar', '+96178456321', true, false, 'instagram', 'tala.n'],
  ['c8', 'Hiba Karam', '+96103777888', true, false, 'referral', null],
].map(([id, fullName, phoneE164, consent, optOut, source, instagramHandle]) => ({
  id, fullName, phoneE164, instagramHandle, email: null, source, notes: id === 'c1' ? 'Prefers morning appointments. Sensitive skin: patch test before peels.' : null,
  whatsappConsentAt: consent ? iso(now) : null, whatsappOptOutAt: optOut ? iso(now) : null, createdAt: iso(now), updatedAt: iso(now),
}));
const clientById = (id) => clients.find((c) => c.id === id);

const A = (id, clientId, serviceId, off, start, mins, status, pkg = null, notes = null) => {
  const c = clientById(clientId); const s = services.find((x) => x.id === serviceId);
  const startAt = at(off, start);
  return { id, clientId, clientName: c.fullName, clientPhone: c.phoneE164, serviceId, serviceName: s.name, clientPackageId: pkg,
    startAt, endAt: new Date(new Date(startAt).getTime() + mins * 60000).toISOString(), status, priceUsd: pkg ? 0 : s.priceUsd, notes, createdAt: iso(now), updatedAt: iso(now) };
};
const appointments = [
  A('a1', 'c1', 's1', 0, '09:00', 60, 'completed'),
  A('a2', 'c2', 's2', 0, '10:30', 30, 'confirmed', 'p1'),
  A('a3', 'c3', 's3', 0, '13:00', 45, 'scheduled'),
  A('a4', 'c4', 's4', 0, '15:30', 40, 'scheduled', null, 'Allergic to latex gloves'),
  A('a5', 'c5', 's1', 0, '17:00', 60, 'no_show'),
  A('a6', 'c6', 's3', 1, '10:00', 45, 'scheduled'),
  A('a7', 'c7', 's2', 1, '12:00', 30, 'confirmed', 'p1'),
  A('a8', 'c8', 's1', 2, '11:00', 60, 'scheduled'),
  A('a9', 'c1', 's4', 3, '16:00', 40, 'scheduled'),
  A('a10', 'c2', 's3', -1, '14:00', 45, 'completed'),
];

const packages = [
  { id: 'p1', clientId: 'c1', templateId: 't1', name: '6 laser sessions', serviceId: 's2', serviceName: 'Laser hair removal, underarms', sessionsTotal: 6, sessionsUsed: 2, sessionsRemaining: 4, sessionsAvailableToBook: 3, priceUsd: 300, paidUsd: 200, purchasedAt: iso(now), expiresAt: at(120, '00:00'), status: 'active' },
  { id: 'p2', clientId: 'c1', templateId: 't2', name: '3 HydraFacials', serviceId: 's1', serviceName: 'HydraFacial', sessionsTotal: 3, sessionsUsed: 3, sessionsRemaining: 0, sessionsAvailableToBook: 0, priceUsd: 300, paidUsd: 300, purchasedAt: iso(now), expiresAt: at(30, '00:00'), status: 'completed' },
];
const templates = [
  { id: 't1', name: '6 laser sessions', serviceId: 's2', serviceName: 'Laser hair removal, underarms', sessionCount: 6, priceUsd: 300, validityDays: 180, isActive: true, createdAt: iso(now) },
  { id: 't2', name: '3 HydraFacials', serviceId: 's1', serviceName: 'HydraFacial', sessionCount: 3, priceUsd: 300, validityDays: 120, isActive: true, createdAt: iso(now) },
  { id: 't3', name: '10 gel manicures', serviceId: 's3', serviceName: 'Gel manicure', sessionCount: 10, priceUsd: 280, validityDays: 365, isActive: false, createdAt: iso(now) },
];
const payments = [
  { id: 'pay1', clientId: 'c1', appointmentId: null, clientPackageId: 'p1', forLabel: 'Package: 6 laser sessions', currency: 'USD', amount: 100, exchangeRate: null, amountUsd: 100, method: 'cash', paidAt: at(-9, '11:00'), voidedAt: null, voidReason: null },
  { id: 'pay2', clientId: 'c1', appointmentId: null, clientPackageId: 'p1', forLabel: 'Package: 6 laser sessions', currency: 'LBP', amount: 8950000, exchangeRate: 89500, amountUsd: 100, method: 'cash', paidAt: at(-2, '12:30'), voidedAt: null, voidReason: null },
  { id: 'pay3', clientId: 'c1', appointmentId: 'a1', clientPackageId: null, forLabel: 'HydraFacial', currency: 'USD', amount: 120, exchangeRate: null, amountUsd: 120, method: 'card', paidAt: at(0, '10:05'), voidedAt: at(0, '10:20'), voidReason: 'Entered twice' },
];
const history = [
  { ...appointments[0], visitNotes: [{ id: 'n1', clientId: 'c1', appointmentId: 'a1', body: 'Skin calm, no redness after extraction. Recommended SPF 50 daily.', productsUsed: 'HydraFacial Syndeo, Brightening serum', createdAt: iso(now), updatedAt: iso(now) }] },
  { ...A('h2', 'c1', 's2', -14, '09:30', 30, 'completed', 'p1'), visitNotes: [] },
  { ...A('h3', 'c1', 's4', -40, '16:00', 40, 'completed'), visitNotes: [{ id: 'n2', clientId: 'c1', appointmentId: 'h3', body: 'Mild irritation on left calf, soothing gel applied.', productsUsed: null, createdAt: iso(now), updatedAt: iso(now) }] },
  { ...A('h4', 'c1', 's1', -62, '11:00', 60, 'no_show'), visitNotes: [] },
];
const rates = { current: { id: 'r2', lbpPerUsd: 89500, effectiveFrom: at(-3, '09:00'), setBy: 'u1', setByName: 'Dina Haddad', createdAt: iso(now) },
  history: [ { id: 'r2', lbpPerUsd: 89500, effectiveFrom: at(-3, '09:00'), setBy: 'u1', setByName: 'Dina Haddad', createdAt: iso(now) }, { id: 'r1', lbpPerUsd: 89000, effectiveFrom: at(-20, '09:00'), setBy: 'u1', setByName: 'Dina Haddad', createdAt: iso(now) } ] };
const users = [
  { id: 'u1', email: 'dina@deeclinic.com', fullName: 'Dina Haddad', role: 'owner', isActive: true, deactivatedAt: null, createdAt: iso(now), lastSignInAt: iso(now) },
  { id: 'u2', email: 'karim@deeclinic.com', fullName: 'Karim Nader', role: 'manager', isActive: true, deactivatedAt: null, createdAt: iso(now), lastSignInAt: at(-1, '17:12') },
  { id: 'u3', email: 'lara@deeclinic.com', fullName: 'Lara Saab', role: 'staff', isActive: true, deactivatedAt: null, createdAt: iso(now), lastSignInAt: null },
  { id: 'u4', email: 'omar@deeclinic.com', fullName: 'Omar Jabbour', role: 'staff', isActive: false, deactivatedAt: iso(now), createdAt: iso(now), lastSignInAt: at(-30, '10:00') },
];

function route(method, url) {
  const u = new URL(url, 'http://x');
  const p = u.pathname.replace('/api/v1', '');
  const q = u.searchParams;
  if (p === '/me') return { data: me };
  if (p === '/me/passcode') return { data: { set: true, updatedAt: at(-5, '10:00') } };
  if (p === '/clinic-settings') return { data: settings };
  if (p === '/services') return { data: q.get('includeInactive') === 'true' ? services : services.filter((s) => s.isActive) };
  if (p === '/package-templates') return { data: q.get('includeInactive') === 'true' ? templates : templates.filter((t) => t.isActive) };
  if (p === '/exchange-rates') return { data: rates };
  if (p === '/users') return { data: users };
  if (p === '/appointments') {
    const from = new Date(q.get('from')), to = new Date(q.get('to'));
    return { data: appointments.filter((a) => new Date(a.startAt) < to && new Date(a.endAt) > from) };
  }
  if (p === '/clients') {
    const term = (q.get('q') || '').toLowerCase();
    return { data: clients.filter((c) => !term || c.fullName.toLowerCase().includes(term) || c.phoneE164.includes(term)), nextCursor: null };
  }
  let m;
  if ((m = p.match(/^\/clients\/([^/]+)\/history$/))) return { data: { visits: m[1] === 'c1' ? history : [] } };
  if ((m = p.match(/^\/clients\/([^/]+)\/packages$/))) return { data: packages.filter((x) => x.clientId === m[1]) };
  if ((m = p.match(/^\/clients\/([^/]+)$/))) return { data: clientById(m[1]) || clients[0] };
  if (p === '/payments') {
    if (q.get('appointmentId')) return { data: payments.filter((x) => x.appointmentId === q.get('appointmentId')) };
    return { data: payments.filter((x) => !q.get('clientId') || x.clientId === q.get('clientId')) };
  }
  if (p === '/visit-notes') return { data: history.flatMap((h) => h.visitNotes).filter((n) => n.appointmentId === q.get('appointmentId')) };
  return { data: null };
}

http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type, idempotency-key');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(route(req.method, req.url)));
}).listen(4999, () => console.log('mock api on 4999'));
