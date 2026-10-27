/* ============================================================================
   CampusConnect — Student Interaction Portal (app.js)
   ----------------------------------------------------------------------------
   HOW IT RUNS
   • DEMO MODE (default): no keys needed. A complete local database is seeded
     in localStorage so every feature works instantly — great for demos.
   • LIVE MODE: paste your Supabase URL + anon key below (or use the
     "Connect your own Supabase project" button on the login screen), and run
     schema.sql once in the Supabase SQL Editor. All data/auth/storage/realtime
     then go through Supabase. The UI code is identical in both modes — only
     the `Store` data layer switches implementation.
   Demo accounts (college.edu):
     admin@college.edu / admin123      (Admin)
     moderator@college.edu    / mod123        (Moderator)
     Aarav@college.edu     / student123    (Student)
============================================================================ */
'use strict';
/* Storage that never crashes: file:// pages, strict privacy modes and
   sandboxed frames can deny localStorage — fall back to in-memory storage so
   the app still runs (sessions then last until refresh instead of persisting). */
const SafeStorage = (() => {
  try { localStorage.setItem('__cc_test', '1'); localStorage.removeItem('__cc_test'); return localStorage; }
  catch { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; }
})();

/* ── 1. CONFIG ────────────────────────────────────────────────────────────── */
// OPTION A (developers): hardcode your project keys here.
// OPTION B (no code): use "Connect your own Supabase project" in the UI —
// keys are saved to localStorage and take priority over the values below.
const SUPABASE_URL = 'https://lzjrdtlxwporjzqnfclb.supabase.co'; // connected project (lzjrdtlxwporjzqnfclb)
const SUPABASE_ANON_KEY = 'sb_publishable_RUtmFjj5Oipit5Ekgi6KrA_s3hMjTp8'; // publishable key — safe in frontend, RLS protects data

const CONFIG = {
  // Only these email domains may sign up / log in. 'college.edu' is kept so
  // Demo Mode logins keep working — remove it to restrict to IPEC only.
  ALLOWED_DOMAINS: ['ipec.org.in', 'college.edu'],
  STORAGE_BUCKET: 'resources',
  MAX_MESSAGE_LEN: 4000,
  POPULAR_STACKS: ['React','Node.js','Python','Flutter','Java','C++','Machine Learning','UI/UX','Firebase','Solidity'],
};

const savedCfg = (() => { try { return JSON.parse(SafeStorage.getItem('cc_supa_cfg') || 'null'); } catch { return null; } })();
const ACTIVE_URL = savedCfg?.url || SUPABASE_URL;
const ACTIVE_KEY = savedCfg?.key || SUPABASE_ANON_KEY;
const MODE = (ACTIVE_URL && ACTIVE_URL !== 'YOUR_SUPABASE_URL' && ACTIVE_KEY && ACTIVE_KEY !== 'YOUR_SUPABASE_ANON_KEY' && window.supabase)
  ? 'supabase' : 'demo';
const sb = MODE === 'supabase' ? window.supabase.createClient(ACTIVE_URL, ACTIVE_KEY, { auth: { storage: SafeStorage, persistSession: true, autoRefreshToken: true } }) : null;

/* ── 2. SMALL UTILITIES ───────────────────────────────────────────────────── */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9));
const nowISO = () => new Date().toISOString();
const esc = (v = '') => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const initials = (name = '?') => name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';
const AVATAR_COLORS = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#0ea5e9','#f43f5e','#14b8a6'];
const avatarColor = (seed = '') => AVATAR_COLORS[[...String(seed)].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length];
const avatarHTML = (p, size = 'w-9 h-9 text-xs') => p?.avatar_url
  ? `<img src="${esc(p.avatar_url)}" class="${size} rounded-full object-cover flex-none" alt=""/>`
  : `<div class="avatar ${size}" style="background:${avatarColor(p?.email || p?.full_name || '?')}">${esc(initials(p?.full_name || '?'))}</div>`;
function timeAgo(iso) {
  const s = Math.max(1, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago'; if (s < 2592000) return Math.floor(s / 86400) + 'd ago';
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}
const fmtDate = (d) => d ? new Date(d + (String(d).length === 10 ? 'T00:00:00' : '')).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '';
const fmtTime = (iso) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
const dateKey = (d) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
const daysFromNow = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return dateKey(d); };
const parseTags = (s) => String(s || '').split(',').map(t => t.trim()).filter(Boolean).slice(0, 12);
const domainOf = (email = '') => String(email).split('@')[1]?.toLowerCase() || '';
const isAllowedEmail = (email = '') => CONFIG.ALLOWED_DOMAINS.map(d => d.toLowerCase()).includes(domainOf(email.trim()));
const roleChip = (role) => role === 'admin'
  ? '<span class="chip bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400"><i class="fa-solid fa-crown"></i>Admin</span>'
  : role === 'moderator'
    ? '<span class="chip bg-sky-100 dark:bg-sky-500/15 text-sky-600 dark:text-sky-400"><i class="fa-solid fa-shield"></i>Moderator</span>'
    : '<span class="chip bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-300"><i class="fa-solid fa-user-graduate"></i>Student</span>';
const statusChip = (s) => s === 'approved'
  ? '<span class="chip bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"><i class="fa-solid fa-circle-check"></i>Approved</span>'
  : s === 'rejected'
    ? '<span class="chip bg-rose-100 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400"><i class="fa-solid fa-circle-xmark"></i>Rejected</span>'
    : s === 'resolved'
      ? '<span class="chip bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">Resolved</span>'
      : s === 'dismissed'
        ? '<span class="chip bg-slate-200 dark:bg-white/10 text-slate-500">Dismissed</span>'
        : '<span class="chip bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400"><i class="fa-solid fa-hourglass-half"></i>Pending review</span>';
const priorityChip = (p) => p === 'high'
  ? '<span class="chip bg-rose-100 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400">High</span>'
  : p === 'low' ? '<span class="chip bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-300">Low</span>'
  : '<span class="chip bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400">Medium</span>';
const emptyState = (icon, title, sub = '') => `<div class="card p-10 text-center col-span-full">
  <div class="w-14 h-14 mx-auto rounded-2xl bg-brand-50 dark:bg-brand-500/10 text-brand-500 flex items-center justify-center text-2xl"><i class="fa-solid ${icon}"></i></div>
  <p class="font-black mt-4">${esc(title)}</p>${sub ? `<p class="text-sm text-slate-400 mt-1 leading-relaxed">${esc(sub)}</p>` : ''}</div>`;

/* Minimal, safe Markdown renderer (escape-first, so no XSS via roadmaps). */
function renderMarkdown(src = '') {
  let h = esc(src);
  h = h.replace(/```([\s\S]*?)```/g, (_, c) => `\u0001PRE${btoa(unescape(encodeURIComponent(c)))}\u0002`);
  h = h.replace(/^###\s?(.*)$/gm, '<h3>$1</h3>').replace(/^##\s?(.*)$/gm, '<h2>$1</h2>').replace(/^#\s?(.*)$/gm, '<h1>$1</h1>');
  h = h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^\*])\*([^*]+)\*/g, '$1<em>$2</em>');
  h = h.replace(/`([^`]+)`/g, '<code>$1</code>');
  h = h.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  h = h.replace(/^&gt;\s?(.*)$/gm, '<blockquote>$1</blockquote>');
  h = h.replace(/^\s*[-*]\s+(.*)$/gm, '<li data-u>$1</li>').replace(/^\s*\d+\.\s+(.*)$/gm, '<li data-o>$1</li>');
  h = h.replace(/((?:<li data-u>.*<\/li>\n?)+)/g, m => `<ul>${m.replace(/ data-u/g, '')}</ul>`);
  h = h.replace(/((?:<li data-o>.*<\/li>\n?)+)/g, m => `<ol>${m.replace(/ data-o/g, '')}</ol>`);
  h = h.split(/\n{2,}/).map(b => /^\s*<(h\d|ul|ol|blockquote|pre)/.test(b) ? b : (b.trim() ? `<p>${b.replace(/\n/g, '<br/>')}</p>` : '')).join('');
  h = h.replace(/\u0001PRE([A-Za-z0-9+/=]+)\u0002/g, (_, b) => `<pre>${esc(decodeURIComponent(escape(atob(b))))}</pre>`);
  return h;
}
const linkify = (t) => esc(t).replace(/(https?:\/\/[^\s<]+)/g, '<a class="text-brand-500 underline break-all" target="_blank" rel="noopener" href="$1">$1</a>');
/* Normalise a user-typed link: allow http/https (or bare domains → https), block other schemes. */
function safeUrl(u = '') {
  const t = String(u || '').trim(); if (!t) return '';
  if (/^https?:\/\//i.test(t)) return t;
  if (/^[a-z][a-z0-9+.-]*:/i.test(t)) return '';
  return 'https://' + t;
}
const prettyHost = (u = '') => { try { return new URL(safeUrl(u)).hostname.replace(/^www\./, ''); } catch { return String(u); } };

/* Toasts + modal helpers */
function toast(msg, type = 'success') {
  const icons = { success: 'fa-circle-check text-emerald-500', error: 'fa-circle-exclamation text-rose-500', info: 'fa-circle-info text-sky-500' };
  const el = document.createElement('div');
  el.className = 'toast glass border border-slate-200 dark:border-white/15 rounded-2xl px-4 py-3 shadow-card flex gap-3 items-start';
  el.innerHTML = `<i class="fa-solid ${icons[type] || icons.success} mt-0.5"></i><p class="text-sm font-semibold leading-snug flex-1">${esc(msg)}</p>
    <button class="text-slate-400 hover:text-slate-600" onclick="this.parentElement.remove()"><i class="fa-solid fa-xmark"></i></button>`;
  $('#toastRoot').appendChild(el); setTimeout(() => el.remove(), 4500);
}
function openModal(html, maxW = 'max-w-lg') {
  $('#modalRoot').innerHTML = `<div class="fixed inset-0 z-[80] modal-backdrop flex items-end sm:items-center justify-center p-0 sm:p-4" id="modalBackdrop">
    <div class="card w-full ${maxW} max-h-[92vh] overflow-y-auto !rounded-t-3xl sm:!rounded-3xl animate-pop p-6 sm:p-7 relative">
      <button class="absolute top-4 right-4 w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/10 hover:rotate-90 transition z-10" id="modalClose"><i class="fa-solid fa-xmark"></i></button>
      ${html}</div></div>`;
  $('#modalClose').onclick = closeModal;
  $('#modalBackdrop').addEventListener('mousedown', e => { if (e.target.id === 'modalBackdrop') closeModal(); });
}
function closeModal() { $('#modalRoot').innerHTML = ''; }
function confirmDialog(title, body, confirmLabel = 'Yes, continue') {
  return new Promise(res => {
    openModal(`<h3 class="font-black text-xl pr-8">${esc(title)}</h3><p class="text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">${esc(body)}</p>
      <div class="flex gap-2 mt-6"><button id="cfNo" class="flex-1 py-2.5 rounded-xl font-bold bg-slate-100 dark:bg-white/10">Cancel</button>
      <button id="cfYes" class="flex-1 py-2.5 rounded-xl font-bold bg-rose-500 hover:bg-rose-600 text-white">${esc(confirmLabel)}</button></div>`, 'max-w-md');
    $('#cfNo').onclick = () => { closeModal(); res(false); };
    $('#cfYes').onclick = () => { closeModal(); res(true); };
  });
}
const setBusy = (btn, busy, label) => { if (!btn) return; btn.disabled = busy; if (label) btn.dataset.label ??= btn.innerHTML, btn.innerHTML = busy ? '<i class="fa-solid fa-spinner fa-spin mr-2"></i>Working…' : (btn.dataset.label || label); };

/* ── 3. DEMO DATABASE (localStorage) ──────────────────────────────────────── */
const DEMO_KEY = 'cc_demo_db_v1', DEMO_SESSION = 'cc_demo_session';
function seedDemo() {
  const t = (hAgo) => new Date(Date.now() - hAgo * 3600e3).toISOString();
  const U = {
    admin: { id: 'u-admin', password: 'admin123', full_name: 'Prof. Meena Verma', email: 'admin@college.edu', academic_year: 'Faculty', branch: 'CSE', course: 'Faculty', role: 'admin', skills: ['Mentoring', 'Placement Cell'], github_url: '', linkedin_url: '', bio: 'Faculty coordinator for the Student Interaction Portal. Ping me for channel requests and event approvals.', avatar_url: '', college_domain: 'college.edu', is_banned: false, created_at: t(24 * 90) },
    mod:   { id: 'u-mod', password: 'mod123', full_name: 'Ananya Kapoor', email: 'moderator@college.edu', academic_year: '4th Year', branch: 'IT', course: 'B.Tech', role: 'moderator', skills: ['Community', 'Event Ops'], github_url: 'https://github.com', linkedin_url: 'https://linkedin.com', bio: 'Student moderator. I keep the channels friendly and the hackathon board fresh.', avatar_url: '', college_domain: 'college.edu', is_banned: false, created_at: t(24 * 60) },
    Aarav: { id: 'u-aarav', password: 'student123', full_name: 'Aarav Sharma', email: 'Aarav@college.edu', academic_year: '3rd Year', branch: 'CSE', course: 'B.Tech', role: 'student', skills: ['React', 'Node.js', 'Python', 'DSA'], github_url: 'https://github.com', linkedin_url: 'https://linkedin.com', bio: 'Full-stack enthusiast, SIH finalist, and forever looking for interesting side projects.', avatar_url: '', college_domain: 'college.edu', is_banned: false, created_at: t(24 * 40) },
    neha:  { id: 'u-neha', password: 'student123', full_name: 'Priya Sharma', email: 'Priya@college.edu', academic_year: '2nd Year', branch: 'ECE', course: 'B.Tech', role: 'student', skills: ['Flutter', 'UI/UX', 'Figma'], github_url: 'https://github.com', linkedin_url: '', bio: 'Design + mobile dev. I make hackathon pitches look inevitable.', avatar_url: '', college_domain: 'college.edu', is_banned: false, created_at: t(24 * 30) },
    Rahul:  { id: 'u-rahul', password: 'student123', full_name: 'Rahul', email: 'rahul@college.edu', academic_year: '3rd Year', branch: 'AI/DS', course: 'B.Tech', role: 'student', skills: ['Python', 'Machine Learning', 'SQL'], github_url: 'https://github.com', linkedin_url: 'https://linkedin.com', bio: 'ML geek. Currently building a timetable optimizer for our department.', avatar_url: '', college_domain: 'college.edu', is_banned: false, created_at: t(24 * 20) },
    zoya:  { id: 'u-zoya', password: 'student123', full_name: 'Zara Khan', email: 'zoya@college.edu', academic_year: '1st Year', branch: 'CSE', course: 'B.Tech', role: 'student', skills: ['C++', 'Java'], github_url: '', linkedin_url: '', bio: 'First-year, first hackathon soon. Here to learn everything.', avatar_url: '', college_domain: 'college.edu', is_banned: false, created_at: t(24 * 5) },
  };
  // Custom website / portfolio links on seeded profiles
  const SEED_SITES = { 'u-aarav': 'https://aaravsharma.dev', 'u-neha': 'https://nehasingh.design', 'u-rahul': 'https://rahulml.github.io' };
  Object.values(U).forEach(u => { u.website_url = SEED_SITES[u.id] || ''; });
  const C = [
    { id: 'c-general', name: 'general', description: 'Campus-wide casual chat', created_by: 'u-admin', created_at: t(24 * 90) },
    { id: 'c-placements', name: 'placements', description: 'Internships, PPOs and placement prep', created_by: 'u-admin', created_at: t(24 * 80) },
    { id: 'c-coding', name: 'coding-help', description: 'DSA doubts, debugging help, code reviews', created_by: 'u-admin', created_at: t(24 * 80) },
    { id: 'c-hack', name: 'hackathons', description: 'Hackathon discussions and team hunts', created_by: 'u-admin', created_at: t(24 * 70) },
  ];
  const M = [
    ['c-general', 'u-admin', 'Welcome to CampusConnect! 🎉 This is your college server — be kind, keep it useful, and use the flag on any message if something looks off.', 50],
    ['c-general', 'u-neha', 'The new canteen menu just dropped and the maggi counter finally takes UPI. Living in the future.', 26],
    ['c-general', 'u-rahul', 'Library is open till midnight this week for mid-sems. The 3rd floor silent zone has the good chairs.', 9],
    ['c-general', 'u-aarav', 'Who is coming for the open-source meetup on Saturday? We are setting up first PRs for juniors.', 3],
    ['c-placements', 'u-mod', 'Reminder: resume review drive this Friday in Seminar Hall B. Bring two printed copies.', 30],
    ['c-placements', 'u-aarav', 'For OA prep, revise sliding window + heap patterns. They showed up in almost every test last season.', 14],
    ['c-coding', 'u-zoya', 'Stuck on recursion basics — any playlist that actually makes backtracking click?', 20],
    ['c-coding', 'u-rahul', 'Start with visualising the call stack on paper for subsets/permutations. Happy to pair in the lab at 5pm today.', 19],
    ['c-hack', 'u-neha', 'Smart India Hackathon problem statements are OUT. Check the Teammate Finder — teams are forming fast!', 6],
    ['c-hack', 'u-aarav', 'We need one Flutter dev for SIH. Posted the details on the board 👇', 5],
  ].map((m, i) => ({ id: 'm-' + i, channel_id: m[0], user_id: m[1], content: m[2], is_deleted: false, created_at: t(m[3]) }));
  const db = {
    users: Object.values(U), channels: C, messages: M,
    teamPosts: [
      { id: 'tp-1', user_id: 'u-aarav', title: 'Smart India Hackathon — need Flutter + ML teammates', description: 'Building an offline-first attendance + smart timetable app for SIH PS category "Smart Education". Backend (Node) is ready. Need 1 Flutter dev and 1 ML/Python dev. Weekly sprints, serious about nationals.', tech_stack: ['Flutter', 'Python', 'Machine Learning', 'Node.js'], team_size: 4, spots_filled: 2, event_type: 'Hackathon', contact: 'Aarav@college.edu', is_open: true, created_at: t(28) },
      { id: 'tp-2', user_id: 'u-neha', title: 'UI/UX designer for campus events app (side project)', description: 'Designing a one-stop events discovery app for fests. Looking for a React partner to build it with me. Portfolio project, chill pace, big learning.', tech_stack: ['React', 'UI/UX', 'Firebase'], team_size: 3, spots_filled: 1, event_type: 'Project', contact: 'Priya@college.edu', is_open: true, created_at: t(50) },
      { id: 'tp-3', user_id: 'u-rahul', title: 'Kaggle study circle — weekly ML paper reading', description: 'Small group, big models. Every Sunday we implement one classic paper in PyTorch and run one Kaggle comp together. All levels welcome.', tech_stack: ['Python', 'Machine Learning', 'SQL'], team_size: 6, spots_filled: 4, event_type: 'Study Group', contact: 'rahul@college.edu', is_open: true, created_at: t(80) },
      { id: 'tp-4', user_id: 'u-zoya', title: 'First hackathon team — beginners welcome!', description: 'I know C++ and basic Java. Looking for 3 fellow first/second years for HackNight next month. Goal: ship something small and learn a LOT.', tech_stack: ['C++', 'Java', 'React'], team_size: 4, spots_filled: 1, event_type: 'Hackathon', contact: 'zoya@college.edu', is_open: true, created_at: t(12) },
    ],
    resources: [
      { id: 'r-1', user_id: 'u-aarav', title: 'DBMS Complete Notes — Units 1–5 (with diagrams)', description: 'Handwritten + typed notes covering ER models, normalization, indexing and transactions. Includes previous-year question mapping.', file_url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', file_name: 'DBMS-Units-1-5.pdf', storage_path: '', category: 'Notes', subject: 'DBMS', upvotes: 42, downloads: 318, created_at: t(24 * 6) },
      { id: 'r-2', user_id: 'u-rahul', title: 'DSA Cheat Sheet — complexity + patterns', description: 'One-pager: Big-O table, 14 must-know patterns (sliding window, two pointers, monotonic stack) with template code.', file_url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', file_name: 'DSA-Cheat-Sheet.pdf', storage_path: '', category: 'Cheat Sheet', subject: 'DSA', upvotes: 67, downloads: 502, created_at: t(24 * 4) },
      { id: 'r-3', user_id: 'u-neha', title: 'Operating Systems — Previous Year Papers 2021–2025', description: 'Scanned PYQs with topic-wise tags. Unit 3 (deadlocks) repeats every year — marked in yellow.', file_url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', file_name: 'OS-PYQs.pdf', storage_path: '', category: 'Previous Papers', subject: 'Operating Systems', upvotes: 35, downloads: 264, created_at: t(24 * 2) },
      { id: 'r-4', user_id: 'u-mod', title: 'Placement Aptitude Formula Booklet', description: 'Quant shortcuts, logical reasoning templates and verbal rules — everything the placement cell recommends.', file_url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', file_name: 'Aptitude-Booklet.pdf', storage_path: '', category: 'Books', subject: 'Placements', upvotes: 28, downloads: 197, created_at: t(24) },
    ],
    roadmaps: [
      { id: 'rm-1', user_id: 'u-aarav', title: 'Full-Stack Web Dev Roadmap 2026 (0 → internship-ready)', category: 'Web Development', status: 'approved', admin_note: 'Excellent, well structured.', attachment_url: '', created_at: t(24 * 8), content: `# Full-Stack Web Dev Roadmap 2026\n\n## Phase 1 — Foundations (Weeks 1–4)\n- HTML semantics + modern CSS (Flexbox, Grid, Tailwind)\n- JavaScript deeply: closures, promises, async/await, DOM\n- Git & GitHub from day one — commit daily\n\n## Phase 2 — Frontend (Weeks 5–8)\n- React: components, hooks, state, routing\n- Build **3 projects**: portfolio, dashboard, one API-driven app\n- Learn fetch patterns and basic testing\n\n## Phase 3 — Backend (Weeks 9–12)\n- Node + Express (or Supabase for speed)\n- SQL: design schemas, joins, indexes\n- Auth, file uploads, deployment (Vercel/Render)\n\n## Phase 4 — Get hired\n- DSA in parallel: 1 problem/day, patterns over volume\n- Ship one **flagship project** with real users\n- Apply everywhere; track applications in a sheet\n\n> Consistency beats intensity. 1 focused hour daily for 6 months wins.` },
      { id: 'rm-2', user_id: 'u-rahul', title: 'Machine Learning Roadmap for Engineers', category: 'Machine Learning', status: 'approved', admin_note: '', attachment_url: '', created_at: t(24 * 5), content: `# ML Roadmap for Engineers\n\n## Maths first (2 weeks)\n- Linear algebra: vectors, matrices, eigen intuition\n- Probability: Bayes, distributions, expectation\n- Calculus: gradients and the chain rule\n\n## Core ML (6 weeks)\n1. Python + NumPy/Pandas fluency\n2. Regression → trees → ensembles (scikit-learn)\n3. Evaluation: cross-validation, leakage, metrics\n\n## Deep learning (6 weeks)\n- PyTorch basics, CNNs, then Transformers\n- One end-to-end project with deployment\n\n## Portfolio\n- 2 Kaggle competitions with write-ups\n- Blog every project — teaching is proof of learning` },
      { id: 'rm-3', user_id: 'u-neha', title: 'Cracking Product Design (UI/UX) Internships', category: 'Design', status: 'approved', admin_note: '', attachment_url: '', created_at: t(24 * 3), content: `# UI/UX Internship Roadmap\n\n## Learn the craft\n- Figma: auto-layout, components, prototyping\n- Design fundamentals: hierarchy, spacing, type, colour\n- Study 1 great app daily — steal like an artist\n\n## Build proof\n- 2 case studies (problem → research → iterations → outcome)\n- Redesign one campus app and present before/after\n\n## Interviews\n- Whiteboard challenges: clarify, scope, sketch, justify\n- Know basic frontend — designers who code stand out` },
      { id: 'rm-4', user_id: 'u-zoya', title: 'My 90-day DSA plan (beginner friendly)', category: 'Placements', status: 'pending', admin_note: '', attachment_url: '', created_at: t(30), content: `# 90-Day DSA Plan\n\n## Month 1\nArrays, strings, hashing — 2 easy problems a day.\n\n## Month 2\nTwo pointers, sliding window, binary search, stacks.\n\n## Month 3\nTrees, graphs, and weekly contests.` },
      { id: 'rm-5', user_id: 'u-rahul', title: 'Gate CS 2027 — subject-wise strategy', category: 'Higher Studies', status: 'pending', admin_note: '', attachment_url: '', created_at: t(8), content: `# GATE CS 2027 Strategy\n\nPrioritise high-weightage subjects: OS, DBMS, CN, TOC.\n\n- Daily: 2 subjects, 50 PYQs/week\n- Monthly: full mock + error log review` },
    ],
    announcements: [
      { id: 'a-1', admin_id: 'u-admin', title: '🚀 Smart India Hackathon 2026 — internal selections open', content: 'Form your teams (max 6, at least one female member as per SIH rules) and submit problem statements by the deadline. Use the Teammate Finder to complete your squad. Top 10 teams represent the college at nationals.', event_date: daysFromNow(9) + 'T09:00:00', link: 'https://www.sih.gov.in', is_pinned: true, created_at: t(20) },
      { id: 'a-2', admin_id: 'u-mod', title: 'Placement drive: resume review + mock interviews this week', content: 'The placement cell is running resume reviews (Seminar Hall B) and alumni mock interviews all week. Slots are first-come — carry two printed copies of your resume.', event_date: daysFromNow(4) + 'T10:00:00', link: '', is_pinned: false, created_at: t(40) },
      { id: 'a-3', admin_id: 'u-admin', title: 'Mid-semester exams: library hours extended', content: 'Central library will remain open till midnight until exams end. Group study rooms can be booked at the help desk. Good luck, everyone!', event_date: daysFromNow(14) + 'T09:00:00', link: '', is_pinned: false, created_at: t(70) },
    ],
    todos: [
      { id: 'td-1', user_id: 'u-aarav', task: 'Finish DBMS Unit 4 — transactions & serializability', due_date: daysFromNow(2), priority: 'high', completed: false, created_at: t(30) },
      { id: 'td-2', user_id: 'u-aarav', task: 'Shortlist 2 SIH problem statements with the team', due_date: daysFromNow(3), priority: 'high', completed: false, created_at: t(28) },
      { id: 'td-3', user_id: 'u-aarav', task: '30 sliding-window problems on LeetCode', due_date: daysFromNow(6), priority: 'medium', completed: false, created_at: t(26) },
      { id: 'td-4', user_id: 'u-aarav', task: 'Update resume with the portal project', due_date: daysFromNow(-1), priority: 'medium', completed: true, created_at: t(90) },
      { id: 'td-5', user_id: 'u-neha', task: 'Figma prototype for events app v2', due_date: daysFromNow(4), priority: 'medium', completed: false, created_at: t(20) },
    ],
    events: [
      { id: 'e-1', user_id: 'u-aarav', title: 'OS Lab viva', event_date: daysFromNow(5), description: 'Revise scheduling algorithms + deadlock detection code.', created_at: t(40) },
      { id: 'e-2', user_id: 'u-aarav', title: 'Team sync — SIH prototype', event_date: daysFromNow(1), description: 'Library group room 3, 5 PM.', created_at: t(30) },
    ],
    reports: [
      { id: 'rp-1', reporter_id: 'u-zoya', target_type: 'message', target_id: 'm-2', reason: 'Spam', details: 'Looked like an advertisement at first glance.', status: 'pending', created_at: t(4) },
    ],
    directMessages: seedDirectMessages(),
    upvotes: { 'u-aarav': ['r-2', 'r-3'] },
    interests: { 'u-neha': ['tp-1'] },
  };
  db.resources.forEach(r => { r.status = 'approved'; r.admin_note = ''; });
  db.resources.push(
    { id: 'r-5', user_id: 'u-aarav', title: 'Computer Networks — Unit 2 mind-map (Data Link Layer)', description: 'One-page visual map: framing, ARQ protocols, sliding window, HDLC vs PPP. Perfect night-before revision.', file_url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', file_name: 'CN-Unit2-Mindmap.pdf', storage_path: '', category: 'Cheat Sheet', subject: 'Computer Networks', upvotes: 0, downloads: 0, status: 'pending', admin_note: '', created_at: t(3) },
    { id: 'r-6', user_id: 'u-zoya', title: 'Physics formula sheet — Mechanics + Optics', description: 'All first-year physics formulas with units and the 10 most-asked derivations.', file_url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', file_name: 'Physics-Formulas.pdf', storage_path: '', category: 'Cheat Sheet', subject: 'Physics', upvotes: 0, downloads: 0, status: 'pending', admin_note: '', created_at: t(7) },
  );
  SafeStorage.setItem(DEMO_KEY, JSON.stringify(db));
  return db;
}
/* Sample 1-to-1 conversations so Messages feels alive on first login. */
function seedDirectMessages() {
  const t = (hAgo) => new Date(Date.now() - hAgo * 3600e3).toISOString();
  const M = (id, sender_id, receiver_id, content, hAgo, is_read = true) => ({ id, sender_id, receiver_id, content, is_read, created_at: t(hAgo) });
  return [
    M('dm-1', 'u-neha', 'u-aarav', 'Hey Aarav! Saw your SIH post on Teammate Finder — I do Flutter + UI design. Is the Flutter spot still open?', 30),
    M('dm-2', 'u-aarav', 'u-neha', 'Hi Priya! Yes it is 🙌 Backend is ready, we mostly need the app screens. Want to sync tomorrow after labs?', 29),
    M('dm-3', 'u-neha', 'u-aarav', 'Perfect, tomorrow 5pm at the library works. I will bring a rough Figma flow for the attendance screens.', 28, false),
    M('dm-4', 'u-rahul', 'u-aarav', 'That timetable ML model finally converged 😭 Want a demo before I post it in #coding-help?', 9),
    M('dm-5', 'u-aarav', 'u-rahul', 'No way, congrats! Demo today at 6? Also — we still need an ML person for SIH, keep that in mind 👀', 8),
    M('dm-6', 'u-zoya', 'u-aarav', 'Hi! I am a first-year — your full-stack roadmap was super helpful. How did you pick your first internship project?', 3, false),
    M('dm-7', 'u-mod', 'u-admin', 'Heads up: one pending report in #general looks like a false positive. I have left it in the queue for your review.', 5, false),
    M('dm-8', 'u-aarav', 'u-mod', 'Hi Ananya Kapoor, quick one — can we get a #sih-2026 channel for shortlisted teams?', 26),
    M('dm-9', 'u-mod', 'u-aarav', 'Great idea! Only admins can create channels though — I have forwarded it to Prof. Meena Verma. Should be live soon.', 25),
  ];
}
const SEED_WEBSITES = { 'u-aarav': 'https://aaravsharma.dev', 'u-neha': 'https://nehasingh.design', 'u-rahul': 'https://rahulml.github.io' };
const demoDB = {
  load() {
    try {
      const d = JSON.parse(SafeStorage.getItem(DEMO_KEY) || 'null');
      if (!d?.users) return seedDemo();
      let changed = false; // migrate DBs created before DMs / website links existed
      if (!Array.isArray(d.directMessages)) { d.directMessages = seedDirectMessages(); changed = true; }
      (d.resources || []).forEach(r => { if (r.status === undefined) { r.status = 'approved'; r.admin_note = ''; changed = true; } });
      d.users.forEach(u => { if (u.website_url === undefined) { u.website_url = SEED_WEBSITES[u.id] || ''; changed = true; } });
      if (changed) SafeStorage.setItem(DEMO_KEY, JSON.stringify(d));
      return d;
    } catch { return seedDemo(); }
  },
  save(db) { SafeStorage.setItem(DEMO_KEY, JSON.stringify(db)); },
  get sessionId() { return SafeStorage.getItem(DEMO_SESSION); },
  set sessionId(v) { v ? SafeStorage.setItem(DEMO_SESSION, v) : SafeStorage.removeItem(DEMO_SESSION); },
};
const publicProfile = (u) => u ? (({ password, ...rest }) => rest)(u) : null;

/* ── 4. STORE — one async API, two backends (Demo ⇄ Supabase) ─────────────── */
const Store = (() => {
  if (MODE === 'demo') {
    const me = (db) => db.users.find(u => u.id === demoDB.sessionId) || null;
    const authorOf = (db, id) => publicProfile(db.users.find(u => u.id === id)) || { id, full_name: 'Unknown user', email: '', role: 'student' };
    const withAuthor = (db, rows, key = 'user_id') => rows.map(r => ({ ...r, author: authorOf(db, r[key]) }));
    const run = (fn) => { const db = demoDB.load(); const out = fn(db); demoDB.save(db); return out; };
    const mustMe = (db) => { const u = me(db); if (!u) throw new Error('Please log in again.'); return u; };
    return {
      async getSessionUser() { const db = demoDB.load(); const u = me(db); return u && !u.is_banned ? publicProfile(u) : null; },
      async signIn(email, password) {
        const db = demoDB.load(); const u = db.users.find(x => x.email.toLowerCase() === email.trim().toLowerCase());
        if (!u || u.password !== password) throw new Error('Invalid email or password. (Demo hint: Aarav@college.edu / student123)');
        if (u.is_banned) throw new Error('This account has been suspended by an admin.');
        demoDB.sessionId = u.id; return publicProfile(u);
      },
      async signUp({ full_name, email, password, academic_year, branch, course }) {
        return run(db => {
          if (db.users.some(x => x.email.toLowerCase() === email.trim().toLowerCase())) throw new Error('An account with this email already exists. Try logging in.');
          const u = { id: uid(), password, full_name, email: email.trim().toLowerCase(), academic_year, branch, course, role: 'student', skills: [], github_url: '', linkedin_url: '', website_url: '', bio: '', avatar_url: '', college_domain: domainOf(email), is_banned: false, created_at: nowISO() };
          db.users.push(u); demoDB.sessionId = u.id; return publicProfile(u);
        });
      },
      async signOut() { demoDB.sessionId = null; },
      async resetPassword(email) {
        return run(db => {
          const u = db.users.find(x => x.email.toLowerCase() === email.trim().toLowerCase());
          if (!u) throw new Error('No account found for that email.');
          u.password = 'reset123'; // Demo only — Supabase mode emails a real reset link.
          return 'Demo mode: password reset to "reset123". Log in and change it from your profile.';
        });
      },
      async changePassword(newPw) { run(db => { mustMe(db).password = newPw; }); },
      async updateProfile(id, patch) { return run(db => { const u = db.users.find(x => x.id === id); Object.assign(u, patch); return publicProfile(u); }); },
      async listProfiles() { return demoDB.load().users.map(publicProfile).sort((a, b) => a.full_name.localeCompare(b.full_name)); },
      async setRole(userId, role) { run(db => { db.users.find(u => u.id === userId).role = role; }); },
      async setBan(userId, banned) { run(db => { db.users.find(u => u.id === userId).is_banned = banned; }); },

      async listChannels() { return [...demoDB.load().channels].sort((a, b) => a.name.localeCompare(b.name)); },
      async createChannel(name, description) { return run(db => { const u = mustMe(db); if (u.role !== 'admin') throw new Error('Only admins can create channels.'); const c = { id: uid(), name, description, created_by: u.id, created_at: nowISO() }; db.channels.push(c); return c; }); },
      async deleteChannel(id) { run(db => { db.channels = db.channels.filter(c => c.id !== id); db.messages = db.messages.filter(m => m.channel_id !== id); }); },

      async listMessages(channelId) { const db = demoDB.load(); return withAuthor(db, db.messages.filter(m => m.channel_id === channelId).sort((a, b) => a.created_at.localeCompare(b.created_at))); },
      async sendMessage(channelId, content) { return run(db => { const u = mustMe(db); const m = { id: uid(), channel_id: channelId, user_id: u.id, content, is_deleted: false, created_at: nowISO() }; db.messages.push(m); return { ...m, author: publicProfile(u) }; }); },
      async deleteMessage(id) { run(db => { db.messages = db.messages.filter(m => m.id !== id); }); },
      async totalMessages() { return demoDB.load().messages.length; },

      async listTeamPosts() { const db = demoDB.load(); return withAuthor(db, [...db.teamPosts].sort((a, b) => b.created_at.localeCompare(a.created_at))); },
      async createTeamPost(d) { return run(db => { const u = mustMe(db); const p = { id: uid(), user_id: u.id, spots_filled: 1, is_open: true, created_at: nowISO(), ...d }; db.teamPosts.unshift(p); return p; }); },
      async deleteTeamPost(id) { run(db => { db.teamPosts = db.teamPosts.filter(p => p.id !== id); }); },
      async setTeamOpen(id, is_open) { run(db => { db.teamPosts.find(p => p.id === id).is_open = is_open; }); },
      async toggleInterest(postId) {
        return run(db => { const u = mustMe(db); const post = db.teamPosts.find(p => p.id === postId);
          db.interests[u.id] ??= []; const i = db.interests[u.id].indexOf(postId);
          if (i >= 0) { db.interests[u.id].splice(i, 1); post.spots_filled = Math.max(1, post.spots_filled - 1); return false; }
          if (post.spots_filled >= post.team_size) throw new Error('This team is already full.');
          db.interests[u.id].push(postId); post.spots_filled++; return true; });
      },
      async myInterests() { const db = demoDB.load(); return new Set(db.interests[demoDB.sessionId] || []); },

      async listResources(scope = 'approved') { // 'approved' | 'mine' | 'all'
        const db = demoDB.load();
        let rows = [...db.resources].sort((a, b) => b.created_at.localeCompare(a.created_at));
        if (scope === 'approved') rows = rows.filter(r => (r.status || 'approved') === 'approved');
        if (scope === 'mine') rows = rows.filter(r => r.user_id === demoDB.sessionId);
        return withAuthor(db, rows);
      },
      async createResource(d) { return run(db => { const u = mustMe(db); const r = { id: uid(), user_id: u.id, upvotes: 0, downloads: 0, storage_path: '', created_at: nowISO(), ...d, status: 'pending', admin_note: '' }; db.resources.unshift(r); return r; }); },
      async deleteResource(id) { run(db => { db.resources = db.resources.filter(r => r.id !== id); }); },
      async reviewResource(id, status, note) { run(db => { const r = db.resources.find(x => x.id === id); r.status = status; r.admin_note = note || ''; r.reviewed_by = demoDB.sessionId; r.reviewed_at = nowISO(); }); },
      async toggleUpvote(id) {
        return run(db => { const u = mustMe(db); const r = db.resources.find(x => x.id === id);
          db.upvotes[u.id] ??= []; const i = db.upvotes[u.id].indexOf(id);
          if (i >= 0) { db.upvotes[u.id].splice(i, 1); r.upvotes = Math.max(0, r.upvotes - 1); return false; }
          db.upvotes[u.id].push(id); r.upvotes++; return true; });
      },
      async myUpvotes() { return new Set(demoDB.load().upvotes[demoDB.sessionId] || []); },
      async incrementDownload(id) { run(db => { const r = db.resources.find(x => x.id === id); if (r) r.downloads++; }); },

      async listRoadmaps(scope) { // 'approved' | 'mine' | 'all'
        const db = demoDB.load(); const u = mustMe(db);
        let rows = [...db.roadmaps].sort((a, b) => b.created_at.localeCompare(a.created_at));
        if (scope === 'approved') rows = rows.filter(r => r.status === 'approved');
        if (scope === 'mine') rows = rows.filter(r => r.user_id === u.id);
        return withAuthor(db, rows);
      },
      async submitRoadmap(d) { return run(db => { const u = mustMe(db); const r = { id: uid(), user_id: u.id, status: 'pending', admin_note: '', created_at: nowISO(), ...d }; db.roadmaps.unshift(r); return r; }); },
      async reviewRoadmap(id, status, note) { run(db => { const r = db.roadmaps.find(x => x.id === id); r.status = status; r.admin_note = note || ''; r.reviewed_by = demoDB.sessionId; r.reviewed_at = nowISO(); }); },
      async deleteRoadmap(id) { run(db => { db.roadmaps = db.roadmaps.filter(r => r.id !== id); }); },

      async listAnnouncements() { const db = demoDB.load(); return withAuthor(db, [...db.announcements].sort((a, b) => (b.is_pinned - a.is_pinned) || b.created_at.localeCompare(a.created_at)), 'admin_id'); },
      async createAnnouncement(d) { return run(db => { const u = mustMe(db); if (!['admin', 'moderator'].includes(u.role)) throw new Error('Only staff can broadcast announcements.'); const a = { id: uid(), admin_id: u.id, created_at: nowISO(), ...d }; db.announcements.unshift(a); return a; }); },
      async deleteAnnouncement(id) { run(db => { db.announcements = db.announcements.filter(a => a.id !== id); }); },

      async listTodos() { const db = demoDB.load(); return db.todos.filter(t => t.user_id === demoDB.sessionId).sort((a, b) => (a.completed - b.completed) || String(a.due_date || '9999').localeCompare(String(b.due_date || '9999'))); },
      async createTodo(d) { return run(db => { const t = { id: uid(), user_id: demoDB.sessionId, completed: false, created_at: nowISO(), ...d }; db.todos.push(t); return t; }); },
      async toggleTodo(id, completed) { run(db => { db.todos.find(t => t.id === id).completed = completed; }); },
      async deleteTodo(id) { run(db => { db.todos = db.todos.filter(t => t.id !== id); }); },

      async listEvents() { return demoDB.load().events.filter(e => e.user_id === demoDB.sessionId).sort((a, b) => a.event_date.localeCompare(b.event_date)); },
      async createEvent(d) { return run(db => { const e = { id: uid(), user_id: demoDB.sessionId, created_at: nowISO(), ...d }; db.events.push(e); return e; }); },
      async deleteEvent(id) { run(db => { db.events = db.events.filter(e => e.id !== id); }); },

      async createReport(d) { return run(db => { const r = { id: uid(), reporter_id: demoDB.sessionId, status: 'pending', created_at: nowISO(), ...d }; db.reports.unshift(r); return r; }); },
      async listReports() { const db = demoDB.load(); return withAuthor(db, [...db.reports].sort((a, b) => b.created_at.localeCompare(a.created_at)), 'reporter_id').map(r => ({ ...r, reporter: r.author })); },
      async updateReport(id, status) { run(db => { const r = db.reports.find(x => x.id === id); r.status = status; r.reviewed_by = demoDB.sessionId; }); },
      async getMessage(id) { const db = demoDB.load(); const m = db.messages.find(x => x.id === id); return m ? { ...m, author: authorOf(db, m.user_id) } : null; },

      /* ── Direct messages (1-to-1) ── */
      async listConversations() {
        const db = demoDB.load(), meId = demoDB.sessionId, map = new Map();
        [...db.directMessages].sort((a, b) => a.created_at.localeCompare(b.created_at)).forEach(m => {
          if (m.sender_id !== meId && m.receiver_id !== meId) return;
          const otherId = m.sender_id === meId ? m.receiver_id : m.sender_id;
          const cur = map.get(otherId) || { user: authorOf(db, otherId), lastMessage: null, unread: 0 };
          cur.lastMessage = { ...m, author: authorOf(db, m.sender_id) };
          if (m.receiver_id === meId && !m.is_read) cur.unread++;
          map.set(otherId, cur);
        });
        return [...map.values()].sort((a, b) => b.lastMessage.created_at.localeCompare(a.lastMessage.created_at));
      },
      async listDirectMessages(otherId) {
        const db = demoDB.load(), meId = demoDB.sessionId;
        return db.directMessages
          .filter(m => (m.sender_id === meId && m.receiver_id === otherId) || (m.sender_id === otherId && m.receiver_id === meId))
          .sort((a, b) => a.created_at.localeCompare(b.created_at))
          .map(m => ({ ...m, author: authorOf(db, m.sender_id) }));
      },
      async sendDirectMessage(otherId, content) { return run(db => { const u = mustMe(db); const m = { id: uid(), sender_id: u.id, receiver_id: otherId, content, is_read: false, created_at: nowISO() }; db.directMessages.push(m); return { ...m, author: publicProfile(u) }; }); },
      async markConversationRead(otherId) { run(db => { db.directMessages.forEach(m => { if (m.sender_id === otherId && m.receiver_id === demoDB.sessionId) m.is_read = true; }); }); },
      async deleteDirectMessage(id) { run(db => { db.directMessages = db.directMessages.filter(m => m.id !== id); }); },
      async unreadDMCount() { return demoDB.load().directMessages.filter(m => m.receiver_id === demoDB.sessionId && !m.is_read).length; },
      subscribeDirectMessages(cb) { const h = (e) => { if (e.key === DEMO_KEY) cb(); }; window.addEventListener('storage', h); return () => window.removeEventListener('storage', h); },
      async uploadFile(file) { // Demo: keep small files as data URLs so downloads really work.
        if (!file) return { url: '', path: '' };
        if (file.size > 1.5 * 1024 * 1024) throw new Error('Demo mode keeps files ≤1.5 MB in the browser. Connect Supabase Storage for large files — or paste an external link instead.');
        const url = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
        return { url, path: '' };
      },
      subscribeMessages(channelId, cb) { // Cross-tab "realtime" for the demo.
        const h = (e) => { if (e.key === DEMO_KEY) cb(); };
        window.addEventListener('storage', h); return () => window.removeEventListener('storage', h);
      },
      subscribeAnnouncements(cb) { const h = (e) => { if (e.key === DEMO_KEY) cb(); }; window.addEventListener('storage', h); return () => window.removeEventListener('storage', h); },
    };
  }

  /* ── Supabase implementation (identical API) ── */
  const P = 'id,full_name,email,academic_year,branch,course,role,skills,github_url,linkedin_url,website_url,bio,avatar_url,college_domain,is_banned,created_at';
  const throwErr = (e) => { if (e) throw new Error(e.message || 'Something went wrong.'); };
  async function myProfile() {
    const { data: { user } } = await sb.auth.getUser(); if (!user) return null;
    let { data, error } = await sb.from('profiles').select(P).eq('id', user.id).single();
    if (error || !data) { // trigger may lag on first signup — create the row
      const meta = user.user_metadata || {};
      const row = { id: user.id, email: user.email, full_name: meta.full_name || user.email.split('@')[0], academic_year: meta.academic_year || '1st Year', branch: meta.branch || 'CSE', course: meta.course || 'B.Tech', college_domain: domainOf(user.email) };
      const ins = await sb.from('profiles').insert(row).select(P).single(); throwErr(ins.error); data = ins.data;
    }
    return data;
  }
  const withProfiles = (rows, key = 'profiles') => (rows || []).map(r => ({ ...r, author: r.author || r[key] || { full_name: 'Unknown user' } }));
  return {
    async getSessionUser() { const { data } = await sb.auth.getSession(); if (!data.session) return null; const p = await myProfile(); if (p?.is_banned) { await sb.auth.signOut(); return null; } return p; },
    async signIn(email, password) { const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password }); throwErr(error); const p = await myProfile(); if (p?.is_banned) { await sb.auth.signOut(); throw new Error('This account has been suspended by an admin.'); } return p; },
    async signUp({ full_name, email, password, academic_year, branch, course }) {
      const { data, error } = await sb.auth.signUp({ email: email.trim(), password, options: { data: { full_name, academic_year, branch, course } } });
      throwErr(error);
      if (!data.session) throw new Error('Account created! Please confirm your email, then log in. (Tip: for demos, disable "Confirm email" in Supabase → Authentication.)');
      await new Promise(r => setTimeout(r, 600)); return myProfile();
    },
    async signOut() { await sb.auth.signOut(); },
    async resetPassword(email) { const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: location.href }); throwErr(error); return 'Password reset email sent. Check your inbox.'; },
    async changePassword(newPw) { const { error } = await sb.auth.updateUser({ password: newPw }); throwErr(error); },
    async updateProfile(id, patch) { const { data, error } = await sb.from('profiles').update(patch).eq('id', id).select(P).single(); throwErr(error); return data; },
    async listProfiles() { const { data, error } = await sb.from('profiles').select(P).order('full_name'); throwErr(error); return data; },
    async setRole(userId, role) { throwErr((await sb.from('profiles').update({ role }).eq('id', userId)).error); },
    async setBan(userId, is_banned) { throwErr((await sb.from('profiles').update({ is_banned }).eq('id', userId)).error); },

    async listChannels() { const { data, error } = await sb.from('channels').select('*').order('name'); throwErr(error); return data; },
    async createChannel(name, description) { const p = await myProfile(); const { data, error } = await sb.from('channels').insert({ name, description, created_by: p.id }).select().single(); throwErr(error); return data; },
    async deleteChannel(id) { throwErr((await sb.from('channels').delete().eq('id', id)).error); },

    async listMessages(channelId) { const { data, error } = await sb.from('messages').select(`*, profiles(${P})`).eq('channel_id', channelId).order('created_at').limit(300); throwErr(error); return withProfiles(data); },
    async sendMessage(channelId, content) { const p = await myProfile(); const { data, error } = await sb.from('messages').insert({ channel_id: channelId, user_id: p.id, content }).select(`*, profiles(${P})`).single(); throwErr(error); return { ...data, author: data.profiles }; },
    async deleteMessage(id) { throwErr((await sb.from('messages').delete().eq('id', id)).error); },
    async totalMessages() { const { count } = await sb.from('messages').select('id', { count: 'exact', head: true }); return count || 0; },

    async listTeamPosts() { const { data, error } = await sb.from('hackathon_posts').select(`*, profiles(${P})`).order('created_at', { ascending: false }); throwErr(error); return withProfiles(data); },
    async createTeamPost(d) { const p = await myProfile(); const { data, error } = await sb.from('hackathon_posts').insert({ ...d, user_id: p.id }).select().single(); throwErr(error); return data; },
    async deleteTeamPost(id) { throwErr((await sb.from('hackathon_posts').delete().eq('id', id)).error); },
    async setTeamOpen(id, is_open) { throwErr((await sb.from('hackathon_posts').update({ is_open }).eq('id', id)).error); },
    async toggleInterest(postId) { // device-local interest set; counter updated via SECURITY DEFINER RPC
      const key = 'cc_interests'; const set = new Set(JSON.parse(SafeStorage.getItem(key) || '[]'));
      const { data: post, error } = await sb.from('hackathon_posts').select('spots_filled,team_size').eq('id', postId).single(); throwErr(error);
      let joined;
      if (set.has(postId)) { set.delete(postId); throwErr((await sb.rpc('adjust_team_spots', { p_post: postId, p_delta: -1 })).error); joined = false; }
      else { if (post.spots_filled >= post.team_size) throw new Error('This team is already full.'); set.add(postId); throwErr((await sb.rpc('adjust_team_spots', { p_post: postId, p_delta: 1 })).error); joined = true; }
      SafeStorage.setItem(key, JSON.stringify([...set])); return joined;
    },
    async myInterests() { return new Set(JSON.parse(SafeStorage.getItem('cc_interests') || '[]')); },

    async listResources(scope = 'approved') { // 'approved' | 'mine' | 'all'
      const p = await myProfile();
      const build = () => sb.from('resources').select(`*, author:profiles!resources_user_id_fkey(${P})`).order('created_at', { ascending: false });
      let q = build();
      if (scope === 'approved') q = q.eq('status', 'approved');
      if (scope === 'mine') q = q.eq('user_id', p.id);
      let { data, error } = await q;
      if (error) { const retry = await build(); data = retry.data; error = retry.error; } // DB not yet migrated (no status column)
      throwErr(error);
      return withProfiles(data).map(r => ({ ...r, status: r.status || 'approved', admin_note: r.admin_note || '' }));
    },
    async createResource(d) { const p = await myProfile();
      let res = await sb.from('resources').insert({ ...d, user_id: p.id, status: 'pending', admin_note: '' }).select().single();
      if (res.error) res = await sb.from('resources').insert({ ...d, user_id: p.id }).select().single(); // pre-migration fallback
      throwErr(res.error); return res.data; },
    async deleteResource(id) { const { data: r } = await sb.from('resources').select('storage_path').eq('id', id).single(); if (r?.storage_path) await sb.storage.from(CONFIG.STORAGE_BUCKET).remove([r.storage_path]); throwErr((await sb.from('resources').delete().eq('id', id)).error); },
    async reviewResource(id, status, note) { const p = await myProfile(); const { error } = await sb.from('resources').update({ status, admin_note: note || '', reviewed_by: p.id, reviewed_at: nowISO() }).eq('id', id);
      if (error) throw new Error(/status|column/i.test(error.message) ? 'Database update needed: please re-run the latest schema.sql in the Supabase SQL Editor to enable resource reviews.' : error.message); },
    async toggleUpvote(id) { const p = await myProfile(); const mine = await this.myUpvotes();
      if (mine.has(id)) { throwErr((await sb.from('resource_upvotes').delete().eq('resource_id', id).eq('user_id', p.id)).error); return false; }
      throwErr((await sb.from('resource_upvotes').insert({ resource_id: id, user_id: p.id })).error); return true; },
    async myUpvotes() { const p = await myProfile(); if (!p) return new Set(); const { data } = await sb.from('resource_upvotes').select('resource_id').eq('user_id', p.id); return new Set((data || []).map(x => x.resource_id)); },
    async incrementDownload(id) { await sb.rpc('increment_download', { p_resource: id }); },

    async listRoadmaps(scope) {
      // roadmaps has 2 FKs to profiles (author + reviewer) → FK hint required
      let q = sb.from('roadmaps').select(`*, author:profiles!roadmaps_user_id_fkey(${P})`).order('created_at', { ascending: false });
      if (scope === 'approved') q = q.eq('status', 'approved');
      if (scope === 'mine') { const p = await myProfile(); q = q.eq('user_id', p.id); }
      const { data, error } = await q; throwErr(error); return withProfiles(data);
    },
    async submitRoadmap(d) { const p = await myProfile(); const { data, error } = await sb.from('roadmaps').insert({ ...d, user_id: p.id, status: 'pending' }).select().single(); throwErr(error); return data; },
    async reviewRoadmap(id, status, note) { const p = await myProfile(); throwErr((await sb.from('roadmaps').update({ status, admin_note: note || '', reviewed_by: p.id, reviewed_at: nowISO() }).eq('id', id)).error); },
    async deleteRoadmap(id) { throwErr((await sb.from('roadmaps').delete().eq('id', id)).error); },

    async listAnnouncements() { const { data, error } = await sb.from('announcements').select(`*, profiles(${P})`).order('is_pinned', { ascending: false }).order('created_at', { ascending: false }); throwErr(error); return withProfiles(data); },
    async createAnnouncement(d) { const p = await myProfile(); const { data, error } = await sb.from('announcements').insert({ ...d, admin_id: p.id }).select().single(); throwErr(error); return data; },
    async deleteAnnouncement(id) { throwErr((await sb.from('announcements').delete().eq('id', id)).error); },

    async listTodos() { const p = await myProfile(); const { data, error } = await sb.from('todos').select('*').eq('user_id', p.id).order('completed').order('due_date', { nullsFirst: false }); throwErr(error); return data; },
    async createTodo(d) { const p = await myProfile(); const { data, error } = await sb.from('todos').insert({ ...d, user_id: p.id }).select().single(); throwErr(error); return data; },
    async toggleTodo(id, completed) { throwErr((await sb.from('todos').update({ completed }).eq('id', id)).error); },
    async deleteTodo(id) { throwErr((await sb.from('todos').delete().eq('id', id)).error); },

    async listEvents() { const p = await myProfile(); const { data, error } = await sb.from('calendar_events').select('*').eq('user_id', p.id).order('event_date'); throwErr(error); return data; },
    async createEvent(d) { const p = await myProfile(); const { data, error } = await sb.from('calendar_events').insert({ ...d, user_id: p.id }).select().single(); throwErr(error); return data; },
    async deleteEvent(id) { throwErr((await sb.from('calendar_events').delete().eq('id', id)).error); },

    async createReport(d) { const p = await myProfile(); const { data, error } = await sb.from('reports').insert({ ...d, reporter_id: p.id }).select().single(); throwErr(error); return data; },
    // reports also has 2 FKs to profiles (reporter + reviewer) → FK hint required
    async listReports() { const { data, error } = await sb.from('reports').select(`*, author:profiles!reports_reporter_id_fkey(${P})`).order('created_at', { ascending: false }); throwErr(error); return (data || []).map(r => ({ ...r, reporter: r.author })); },
    async updateReport(id, status) { const p = await myProfile(); throwErr((await sb.from('reports').update({ status, reviewed_by: p.id }).eq('id', id)).error); },
    async getMessage(id) { const { data } = await sb.from('messages').select(`*, profiles(${P})`).eq('id', id).single(); return data ? { ...data, author: data.profiles } : null; },

    /* ── Direct messages (1-to-1) ── */
    async listConversations() {
      const p = await myProfile(); if (!p) return [];
      const { data, error } = await sb.from('direct_messages').select('*').or(`sender_id.eq.${p.id},receiver_id.eq.${p.id}`).order('created_at', { ascending: false }).limit(500); throwErr(error);
      const ids = [...new Set((data || []).flatMap(m => [m.sender_id, m.receiver_id]).filter(id => id !== p.id))];
      const profs = {};
      if (ids.length) { const { data: ps } = await sb.from('profiles').select(P).in('id', ids); (ps || []).forEach(x => profs[x.id] = x); }
      const map = new Map();
      [...(data || [])].reverse().forEach(m => {
        const otherId = m.sender_id === p.id ? m.receiver_id : m.sender_id;
        const cur = map.get(otherId) || { user: profs[otherId] || { id: otherId, full_name: 'Unknown user' }, lastMessage: null, unread: 0 };
        cur.lastMessage = m; if (m.receiver_id === p.id && !m.is_read) cur.unread++;
        map.set(otherId, cur);
      });
      return [...map.values()].sort((a, b) => b.lastMessage.created_at.localeCompare(a.lastMessage.created_at));
    },
    async listDirectMessages(otherId) { const p = await myProfile(); const { data, error } = await sb.from('direct_messages').select('*').or(`and(sender_id.eq.${p.id},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${p.id})`).order('created_at').limit(500); throwErr(error); return data || []; },
    async sendDirectMessage(otherId, content) { const p = await myProfile(); const { data, error } = await sb.from('direct_messages').insert({ sender_id: p.id, receiver_id: otherId, content }).select().single(); throwErr(error); return { ...data, author: p }; },
    async markConversationRead(otherId) { const p = await myProfile(); throwErr((await sb.from('direct_messages').update({ is_read: true }).eq('sender_id', otherId).eq('receiver_id', p.id).eq('is_read', false)).error); },
    async deleteDirectMessage(id) { throwErr((await sb.from('direct_messages').delete().eq('id', id)).error); },
    async unreadDMCount() { const p = await myProfile(); if (!p) return 0; const { count } = await sb.from('direct_messages').select('id', { count: 'exact', head: true }).eq('receiver_id', p.id).eq('is_read', false); return count || 0; },
    subscribeDirectMessages(cb) {
      // RLS ensures only rows you participate in are delivered.
      const ch = sb.channel('dms-live').on('postgres_changes', { event: '*', schema: 'public', table: 'direct_messages' }, cb).subscribe();
      return () => sb.removeChannel(ch);
    },
    async uploadFile(file) {
      if (!file) return { url: '', path: '' };
      const p = await myProfile(); const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${p.id}/${Date.now()}_${safe}`;
      const { error } = await sb.storage.from(CONFIG.STORAGE_BUCKET).upload(path, file, { upsert: false }); throwErr(error);
      return { url: sb.storage.from(CONFIG.STORAGE_BUCKET).getPublicUrl(path).data.publicUrl, path };
    },
    subscribeMessages(channelId, cb) {
      const ch = sb.channel('msgs-' + channelId)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `channel_id=eq.${channelId}` }, cb).subscribe();
      return () => sb.removeChannel(ch);
    },
    subscribeAnnouncements(cb) {
      const ch = sb.channel('ann-live').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'announcements' }, cb).subscribe();
      return () => sb.removeChannel(ch);
    },
  };
})();

/* ── 5. APP STATE ─────────────────────────────────────────────────────────── */
const state = {
  user: null, view: 'home',
  channels: [], activeChannelId: null, messages: [], unsubMessages: null, unsubAnn: null,
  teamPosts: [], interests: new Set(),
  resourcesApproved: [], resourcesMine: [], resourcesAll: [], resourceTab: 'approved', myUpvotes: new Set(),
  roadmapsApproved: [], roadmapsMine: [], roadmapsAll: [], roadmapTab: 'approved',
  announcements: [], todos: [], events: [], todoFilter: 'all',
  reports: [], users: [], adminTab: 'roadmaps',
  calCursor: new Date(), chatVisited: false,
  conversations: [], activeDMUser: null, dmMessages: [], unsubDMs: null, pendingDM: null, _lastDMNotified: null,
};
const isAdmin = () => state.user?.role === 'admin';
const isStaff = () => ['admin', 'moderator'].includes(state.user?.role);
const VIEW_META = {
  home: ['Home / Feed', "What's happening on campus"], chat: ['Chat Rooms', 'Real-time channels for your college'],
  teammates: ['Teammate Finder', 'Hackathons, projects & study groups'], resources: ['Resource Hub', 'Notes & materials shared by students'],
  roadmaps: ['Roadmaps', 'Admin-verified guides from your seniors'], productivity: ['Planner & To-Do', 'Your private calendar and tasks'],
  messages: ['Messages', 'Your private one-to-one chats'],
  profile: ['My Profile', 'Your campus identity'], admin: ['Admin Portal', 'Moderation, approvals & user management'],
};

/* ── 6. THEME ─────────────────────────────────────────────────────────────── */
function applyTheme(t) { document.documentElement.classList.toggle('dark', t === 'dark'); SafeStorage.setItem('cc_theme', t); }
applyTheme(SafeStorage.getItem('cc_theme') || 'dark');
const toggleTheme = () => applyTheme(document.documentElement.classList.contains('dark') ? 'light' : 'dark');

/* ── 7. AUTH UI ───────────────────────────────────────────────────────────── */
function showAuthTab(which) {
  $('#loginForm').classList.toggle('hidden', which !== 'login');
  $('#signupForm').classList.toggle('hidden', which !== 'signup');
  $('#tabLogin').classList.toggle('active', which === 'login');
  $('#tabSignup').classList.toggle('active', which === 'signup');
}
function authError(id, msg) { const el = $(id); el.textContent = msg || ''; el.classList.toggle('hidden', !msg); }
function validateCollegeEmail(email) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Please enter a valid email address.';
  if (!isAllowedEmail(email)) return `Only college emails are allowed (${CONFIG.ALLOWED_DOMAINS.map(d => '@' + d).join(', ')}). You entered @${domainOf(email) || '—'}.`;
  return '';
}
function renderAuthExtras() {
  $$('.allowed-domains').forEach(el => el.textContent = CONFIG.ALLOWED_DOMAINS.map(d => '@' + d).join(' '));
  const banner = $('#modeBanner');
  if (MODE === 'demo') {
    banner.className = 'mb-5 text-[13px] rounded-xl px-4 py-3 font-medium leading-relaxed bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/25';
    banner.innerHTML = '<b><i class="fa-solid fa-flask mr-1"></i>Demo Mode</b> — everything works instantly with local data. Connect Supabase below to go live for your whole college.';
    $('#demoAccounts').innerHTML = `<div class="card p-4 !bg-slate-50 dark:!bg-white/[.04]">
      <p class="text-xs font-black tracking-widest text-slate-400 mb-2.5">ONE-CLICK DEMO LOGINS</p>
      <div class="grid grid-cols-3 gap-2">
        <button type="button" class="demo-login py-2.5 rounded-xl font-bold text-[13px] bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 hover:scale-[1.03] transition" data-email="admin@college.edu" data-pw="admin123"><i class="fa-solid fa-crown block mb-1"></i>Admin</button>
        <button type="button" class="demo-login py-2.5 rounded-xl font-bold text-[13px] bg-sky-100 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300 hover:scale-[1.03] transition" data-email="moderator@college.edu" data-pw="mod123"><i class="fa-solid fa-shield block mb-1"></i>Moderator</button>
        <button type="button" class="demo-login py-2.5 rounded-xl font-bold text-[13px] bg-brand-100 dark:bg-brand-500/15 text-brand-700 dark:text-brand-300 hover:scale-[1.03] transition" data-email="Aarav@college.edu" data-pw="student123"><i class="fa-solid fa-user-graduate block mb-1"></i>Student</button>
      </div>
      <button type="button" id="resetDemoBtn" class="text-xs font-semibold text-slate-400 hover:text-rose-500 mt-3 underline underline-offset-2">Reset demo data to factory seed</button></div>`;
    $$('.demo-login').forEach(b => b.onclick = () => { $('#loginEmail').value = b.dataset.email; $('#loginPassword').value = b.dataset.pw; $('#loginForm').requestSubmit(); });
    $('#resetDemoBtn').onclick = async () => { if (await confirmDialog('Reset demo data?', 'All demo accounts, chats and posts will be restored to the original seed.', 'Reset everything')) { SafeStorage.removeItem(DEMO_KEY); demoDB.sessionId = null; seedDemo(); toast('Demo data reset. Log in with any demo account.'); } };
  } else {
    banner.className = 'mb-5 text-[13px] rounded-xl px-4 py-3 font-medium leading-relaxed bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/25';
    banner.innerHTML = '<b><i class="fa-solid fa-bolt mr-1"></i>Live Mode</b> — connected to your Supabase project. Auth, database, storage and realtime are all live.';
    $('#demoAccounts').innerHTML = '';
  }
}
function openSupabaseConfig() {
  openModal(`<h3 class="font-black text-xl pr-8"><i class="fa-solid fa-database text-brand-500 mr-2"></i>Connect Supabase</h3>
    <p class="text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">1. Create a free project at <b>supabase.com</b> &nbsp;2. Run <code class="font-mono text-brand-500">schema.sql</code> in its SQL Editor &nbsp;3. Paste your keys (Settings → API):</p>
    <form id="sbCfgForm" class="space-y-3 mt-4">
      <div><label class="text-sm font-bold">Project URL</label><input id="cfgUrl" class="field mt-1.5 font-mono !text-[13px]" placeholder="https://xxxx.supabase.co" value="${MODE === 'supabase' ? esc(ACTIVE_URL) : ''}"/></div>
      <div><label class="text-sm font-bold">Anon / public key</label><textarea id="cfgKey" rows="3" class="field mt-1.5 font-mono !text-[13px]" placeholder="eyJhbGciOi…">${MODE === 'supabase' ? esc(ACTIVE_KEY) : ''}</textarea></div>
      <button class="grad-btn w-full py-3 rounded-xl font-bold">Save & reconnect</button>
      ${MODE === 'supabase' ? '<button type="button" id="cfgClear" class="w-full py-2.5 rounded-xl font-bold bg-slate-100 dark:bg-white/10 text-sm">Remove saved override → use built-in project keys</button>' : ''}
    </form>`);
  $('#sbCfgForm').onsubmit = (e) => { e.preventDefault(); const url = $('#cfgUrl').value.trim(), key = $('#cfgKey').value.trim();
    if (!/^https:\/\/.*\.supabase\.co/.test(url) || key.length < 20) return toast('That does not look like a valid Supabase URL + anon key.', 'error');
    SafeStorage.setItem('cc_supa_cfg', JSON.stringify({ url: url.replace(/\/$/, ''), key })); location.reload(); };
  const clr = $('#cfgClear'); if (clr) clr.onclick = () => { SafeStorage.removeItem('cc_supa_cfg'); location.reload(); };
}
async function handleLogin(e) {
  e.preventDefault(); authError('#loginError', '');
  const email = $('#loginEmail').value.trim(), pw = $('#loginPassword').value;
  const v = validateCollegeEmail(email); if (v) return authError('#loginError', v);
  if (!pw) return authError('#loginError', 'Please enter your password.');
  setBusy($('#loginBtn'), true, 'Log in');
  try { enterApp(await Store.signIn(email, pw)); toast(`Welcome back!`); }
  catch (err) { authError('#loginError', err.message); }
  finally { setBusy($('#loginBtn'), false, 'Log in'); }
}
async function handleSignup(e) {
  e.preventDefault(); authError('#signupError', ''); $('#signupOk').classList.add('hidden');
  const d = { full_name: $('#suName').value.trim(), email: $('#suEmail').value.trim(), password: $('#suPassword').value, academic_year: $('#suYear').value, branch: $('#suBranch').value, course: $('#suCourse').value };
  if (d.full_name.length < 2) return authError('#signupError', 'Please enter your full name.');
  const v = validateCollegeEmail(d.email); if (v) return authError('#signupError', v);
  if (d.password.length < 6) return authError('#signupError', 'Password must be at least 6 characters.');
  setBusy($('#signupBtn'), true, 'Create account');
  try { const u = await Store.signUp(d); enterApp(u); toast(`Account created — welcome to the @${domainOf(d.email)} server, ${d.full_name.split(' ')[0]}!`); }
  catch (err) {
    if (/confirm your email/i.test(err.message)) { const ok = $('#signupOk'); ok.textContent = '✅ ' + err.message; ok.classList.remove('hidden'); showAuthTab('login'); }
    else authError('#signupError', err.message);
  } finally { setBusy($('#signupBtn'), false, 'Create account'); }
}
async function handleForgot() {
  const email = $('#loginEmail').value.trim();
  if (!email) return authError('#loginError', 'Enter your college email above first, then click "Forgot password?".');
  try { toast(await Store.resetPassword(email), 'info'); } catch (e) { authError('#loginError', e.message); }
}
async function handleLogout() {
  state.unsubMessages?.(); state.unsubAnn?.(); state.unsubDMs?.();
  await Store.signOut(); state.user = null;
  state.activeDMUser = null; state.dmMessages = []; state.conversations = []; state.pendingDM = null;
  $('#appShell').classList.add('hidden'); $('#authScreen').classList.remove('hidden');
  toast('Logged out. See you soon!', 'info');
}

/* ── 8. APP SHELL / NAVIGATION ────────────────────────────────────────────── */
function enterApp(user) {
  state.user = user;
  $('#authScreen').classList.add('hidden'); $('#appShell').classList.remove('hidden');
  $('#collegeLabel').textContent = '@' + (user.college_domain || domainOf(user.email)) + ' server';
  $('#sidebarName').textContent = user.full_name;
  $('#sidebarMeta').textContent = `${user.branch || ''} · ${user.academic_year || ''}`;
  $('#sidebarAvatar').outerHTML = avatarHTML(user, 'w-10 h-10 text-sm').replace('class="', 'id="sidebarAvatar" class="');
  $('#topProfileBtn').innerHTML = avatarHTML(user, 'w-10 h-10 text-sm');
  $('#adminNavWrap').classList.toggle('hidden', !isStaff());
  $('#newAnnouncementBtn').classList.toggle('hidden', !isStaff());
  $('#createChannelBtn').classList.toggle('hidden', !isAdmin());
  const pill = $('#liveModePill');
  pill.innerHTML = MODE === 'supabase' ? '<i class="fa-solid fa-bolt text-emerald-500"></i>Supabase Live' : '<i class="fa-solid fa-flask text-amber-500"></i>Demo Mode';
  const h = new Date().getHours();
  $('#homeGreeting').textContent = (h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening') + ' 👋';
  $('#homeName').textContent = user.full_name;
  // Live announcement toasts
  state.unsubAnn?.();
  state.unsubAnn = Store.subscribeAnnouncements(async () => { const before = state.announcements.length; state.announcements = await Store.listAnnouncements(); if (state.announcements.length > before) toast('📢 New announcement: ' + state.announcements[0].title, 'info'); if (state.view === 'home') renderHome(); });
  // Live direct-message updates + unread badge
  state.unsubDMs?.();
  state.unsubDMs = Store.subscribeDirectMessages(() => onIncomingDM());
  Store.listConversations().then(c => { state.conversations = c; const top = c.find(x => x.unread > 0); state._lastDMNotified = top?.lastMessage?.id || null; }).catch(() => {});
  refreshDMBadge();
  switchView('home'); refreshStaffBadges();
}
async function refreshStaffBadges() {
  if (!isStaff()) return;
  try {
    const [all, reps, resAll] = await Promise.all([Store.listRoadmaps('all'), Store.listReports(), Store.listResources('all')]);
    state.roadmapsAll = all; state.reports = reps; state.resourcesAll = resAll;
    const pendR = all.filter(r => r.status === 'pending').length, pendRep = reps.filter(r => r.status === 'pending').length,
          pendRes = resAll.filter(r => (r.status || 'approved') === 'pending').length;
    const b = $('#adminBadge'); const total = pendR + pendRep + pendRes;
    b.textContent = total; b.classList.toggle('hidden', total === 0);
    $('#atabRoadmapCount').innerHTML = pendR ? `<span class="bg-amber-500 text-white text-[11px] px-1.5 py-0.5 rounded-full">${pendR}</span>` : '';
    $('#atabReportCount').innerHTML = pendRep ? `<span class="bg-rose-500 text-white text-[11px] px-1.5 py-0.5 rounded-full">${pendRep}</span>` : '';
    const rc = $('#atabResourceCount'); if (rc) rc.innerHTML = pendRes ? `<span class="bg-amber-500 text-white text-[11px] px-1.5 py-0.5 rounded-full">${pendRes}</span>` : '';
  } catch { /* non-critical */ }
}
function switchView(view) {
  if (view === 'admin' && !isStaff()) { toast('The Admin Portal is staff-only.', 'error'); return; }
  state.view = view;
  $$('.nav-btn[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + view));
  const [t, s] = VIEW_META[view] || ['CampusConnect', '']; $('#viewTitle').textContent = t; $('#viewSubtitle').textContent = s;
  $('#sidebar').classList.remove('open'); $('#sidebarScrim').classList.add('hidden');
  ({ home: loadHome, chat: loadChat, teammates: loadTeammates, resources: loadResources, roadmaps: loadRoadmaps, productivity: loadProductivity, messages: loadDMs, profile: loadProfile, admin: loadAdmin }[view] || (() => {}))().catch(e => toast(e.message, 'error'));
  window.scrollTo({ top: 0 });
}
const guard = (fn) => async (...a) => { try { await fn(...a); } catch (e) { toast(e.message, 'error'); } };

/* ── 9. HOME / FEED ───────────────────────────────────────────────────────── */
async function loadHome() {
  const [anns, roads, teams, todos, msgs] = await Promise.all([
    Store.listAnnouncements(), Store.listRoadmaps('approved'), Store.listTeamPosts(), Store.listTodos(),
    Store.totalMessages().catch(() => 0),
  ]);
  state.announcements = anns; state.roadmapsApproved = roads; state.teamPosts = teams; state.todos = todos;
  const openTodos = todos.filter(t => !t.completed).length;
  const openTeams = teams.filter(t => t.is_open && t.spots_filled < t.team_size).length;
  const stat = (icon, color, big, label, view) => `<button data-goto="${view}" class="card p-4 text-left hover:-translate-y-0.5 transition">
    <div class="w-10 h-10 rounded-xl flex items-center justify-center ${color}"><i class="fa-solid ${icon}"></i></div>
    <p class="font-black text-2xl mt-2.5 leading-none">${big}</p><p class="text-[13px] text-slate-400 font-semibold mt-1">${label}</p></button>`;
  $('#homeStats').innerHTML =
    stat('fa-bullhorn', 'bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400', anns.length, 'Announcements', 'home') +
    stat('fa-comments', 'bg-brand-100 dark:bg-brand-500/15 text-brand-600 dark:text-brand-300', msgs, 'Chat messages', 'chat') +
    stat('fa-users', 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400', openTeams, 'Open team posts', 'teammates') +
    stat('fa-list-check', 'bg-rose-100 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400', openTodos, 'Tasks pending', 'productivity');
  renderHome(); bindGoto($('#view-home'));
}
function renderHome() {
  $('#announcementFeed').innerHTML = state.announcements.length ? state.announcements.map(a => `
    <article class="card p-5 animate-fade-up">
      <div class="flex gap-3">${avatarHTML(a.author)}
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2 flex-wrap"><p class="font-bold text-sm">${esc(a.author?.full_name || 'Admin')}</p>${roleChip(a.author?.role || 'admin')}
          ${a.is_pinned ? '<span class="chip bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400"><i class="fa-solid fa-thumbtack"></i>Pinned</span>' : ''}
          <span class="text-xs text-slate-400 ml-auto">${timeAgo(a.created_at)}</span></div>
          <h5 class="font-black text-[17px] mt-1.5 leading-snug">${esc(a.title)}</h5>
          <p class="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mt-1.5">${linkify(a.content)}</p>
          <div class="flex flex-wrap items-center gap-2 mt-3">
            ${a.event_date ? `<span class="chip bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-300"><i class="fa-regular fa-calendar"></i>${fmtDate(String(a.event_date).slice(0, 10))}</span>
            <button class="chip bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-200 hover:bg-brand-100 dark:hover:bg-brand-500/20" data-addcal="${a.id}"><i class="fa-solid fa-calendar-plus"></i>Add to my calendar</button>` : ''}
            ${a.link ? `<a href="${esc(a.link)}" target="_blank" rel="noopener" class="chip bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"><i class="fa-solid fa-arrow-up-right-from-square"></i>Open link</a>` : ''}
            ${isStaff() ? `<button class="chip bg-rose-50 dark:bg-rose-500/10 text-rose-500 ml-auto" data-delann="${a.id}"><i class="fa-solid fa-trash"></i>Delete</button>` : ''}
          </div>
        </div></div></article>`).join('')
    : emptyState('fa-bullhorn', 'No announcements yet', 'Official college broadcasts will appear here.');
  $('#homeRoadmaps').innerHTML = state.roadmapsApproved.slice(0, 3).map(r => `
    <button class="card p-4 w-full text-left hover:-translate-y-0.5 transition" data-readroadmap="${r.id}">
      <span class="chip bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-300">${esc(r.category || 'General')}</span>
      <p class="font-bold leading-snug mt-2">${esc(r.title)}</p>
      <p class="text-xs text-slate-400 mt-1.5">by ${esc(r.author?.full_name || '')} · ${timeAgo(r.created_at)}</p></button>`).join('')
    || emptyState('fa-map', 'No approved roadmaps yet', 'Submit one — admins review every roadmap before it goes live.');
  $('#homeTeams').innerHTML = state.teamPosts.filter(t => t.is_open).slice(0, 3).map(t => `
    <button class="card p-4 w-full text-left hover:-translate-y-0.5 transition" data-goto="teammates">
      <div class="flex items-center gap-2"><span class="chip bg-rose-50 dark:bg-rose-500/10 text-rose-500">${esc(t.event_type)}</span>
      <span class="text-xs font-bold text-slate-400 ml-auto">${t.spots_filled}/${t.team_size} members</span></div>
      <p class="font-bold leading-snug mt-2">${esc(t.title)}</p>
      <div class="h-1.5 rounded-full bg-slate-100 dark:bg-white/10 mt-2.5 overflow-hidden"><div class="h-full rounded-full bg-gradient-to-r from-rose-500 to-amber-500" style="width:${Math.min(100, t.spots_filled / t.team_size * 100)}%"></div></div></button>`).join('')
    || emptyState('fa-users', 'No open teams right now', 'Be the first to post a requirement!');
  $$('#announcementFeed [data-addcal]').forEach(b => b.onclick = guard(async () => {
    const a = state.announcements.find(x => x.id === b.dataset.addcal);
    await Store.createEvent({ title: a.title.replace(/^[^\w]+/, '').slice(0, 80), event_date: String(a.event_date).slice(0, 10), description: a.content.slice(0, 300) });
    toast('Added to your personal calendar 📅');
  }));
  $$('#announcementFeed [data-delann]').forEach(b => b.onclick = guard(async () => {
    if (await confirmDialog('Delete this announcement?', 'It will be removed from every student feed.')) { await Store.deleteAnnouncement(b.dataset.delann); state.announcements = await Store.listAnnouncements(); renderHome(); toast('Announcement deleted.'); }
  }));
  $$('#homeRoadmaps [data-readroadmap]').forEach(b => b.onclick = () => openRoadmapReader(state.roadmapsApproved.find(r => r.id === b.dataset.readroadmap)));
  bindGoto($('#view-home'));
}
function bindGoto(root) { $$('[data-goto]', root).forEach(b => b.onclick = () => switchView(b.dataset.goto)); }
function openAnnouncementModal() {
  openModal(`<h3 class="font-black text-xl pr-8"><i class="fa-solid fa-bullhorn text-amber-500 mr-2"></i>Broadcast announcement</h3>
    <p class="text-sm text-slate-400 mt-1">Visible to every student on the home feed, instantly.</p>
    <form id="annForm" class="space-y-3 mt-4">
      <div><label class="text-sm font-bold">Title</label><input id="annTitle" class="field mt-1.5" required maxlength="140" placeholder="e.g. Hackathon registrations close Friday"/></div>
      <div><label class="text-sm font-bold">Details</label><textarea id="annContent" rows="4" class="field mt-1.5" required placeholder="What, where, when, who should care…"></textarea></div>
      <div class="grid grid-cols-2 gap-3">
        <div><label class="text-sm font-bold">Event date <span class="text-slate-400 font-medium">(optional)</span></label><input id="annDate" type="date" class="field mt-1.5"/></div>
        <div><label class="text-sm font-bold">Link <span class="text-slate-400 font-medium">(optional)</span></label><input id="annLink" class="field mt-1.5" placeholder="https://…"/></div></div>
      <label class="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" id="annPin" class="w-4 h-4 accent-amber-500"/> Pin to top of feed</label>
      <button class="grad-btn w-full py-3 rounded-xl font-bold" id="annSubmit">Broadcast to campus 📢</button></form>`);
  $('#annForm').onsubmit = guard(async (e) => { e.preventDefault(); setBusy($('#annSubmit'), true);
    await Store.createAnnouncement({ title: $('#annTitle').value.trim(), content: $('#annContent').value.trim(), event_date: $('#annDate').value ? $('#annDate').value + 'T09:00:00' : null, link: $('#annLink').value.trim(), is_pinned: $('#annPin').checked });
    closeModal(); state.announcements = await Store.listAnnouncements(); renderHome(); toast('Announcement broadcast to the whole campus!'); });
}

/* ── 10. CHAT (Realtime) ──────────────────────────────────────────────────── */
async function loadChat() {
  state.chatVisited = true; $('#chatBadge').classList.add('hidden');
  state.channels = await Store.listChannels();
  if (!state.channels.length) { $('#channelList').innerHTML = '<p class="text-sm text-slate-400 p-3">No channels yet. Ask an admin to create one.</p>'; $('#messageList').innerHTML = ''; return; }
  renderChannelList();
  const target = state.channels.find(c => c.id === state.activeChannelId) || state.channels[0];
  await selectChannel(target.id);
}
function renderChannelList() {
  $('#channelList').innerHTML = state.channels.map(c => `
    <div class="group flex items-center gap-1 rounded-xl px-2.5 py-2 cursor-pointer font-semibold text-[15px] transition ${c.id === state.activeChannelId ? 'bg-brand-600 text-white shadow-glow' : 'text-slate-500 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-white/[.07]'}" data-channel="${c.id}">
      <span class="font-black opacity-60">#</span><span class="truncate flex-1">${esc(c.name)}</span>
      ${isAdmin() ? `<button class="opacity-0 group-hover:opacity-100 text-xs px-1.5 hover:text-rose-400" data-delchannel="${c.id}" title="Delete channel"><i class="fa-solid fa-trash"></i></button>` : ''}
    </div>`).join('');
  $$('#channelList [data-channel]').forEach(el => el.onclick = (e) => { if (e.target.closest('[data-delchannel]')) return; selectChannel(el.dataset.channel).catch(err => toast(err.message, 'error')); });
  $$('#channelList [data-delchannel]').forEach(b => b.onclick = guard(async () => {
    const c = state.channels.find(x => x.id === b.dataset.delchannel);
    if (await confirmDialog(`Delete #${c.name}?`, 'The channel and all its messages will be permanently deleted.')) {
      await Store.deleteChannel(c.id); if (state.activeChannelId === c.id) state.activeChannelId = null; toast(`Channel #${c.name} deleted.`); loadChat();
    }
  }));
}
async function selectChannel(id) {
  state.activeChannelId = id;
  const c = state.channels.find(x => x.id === id);
  $('#activeChannelName').textContent = c?.name || '';
  $('#activeChannelDesc').textContent = c?.description || '';
  $('#messageInput').placeholder = `Message #${c?.name || ''}…`;
  renderChannelList();
  state.messages = await Store.listMessages(id);
  renderMessages(true);
  state.unsubMessages?.();
  state.unsubMessages = Store.subscribeMessages(id, async () => {
    const fresh = await Store.listMessages(id);
    const hadNew = fresh.length !== state.messages.length;
    state.messages = fresh;
    if (state.view === 'chat' && state.activeChannelId === id) renderMessages(false);
    else if (hadNew) $('#chatBadge').classList.remove('hidden');
  });
}
function renderMessages(scrollBottom) {
  const box = $('#messageList');
  const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 160;
  box.innerHTML = state.messages.length ? state.messages.map(m => {
    const mine = m.user_id === state.user.id, canDelete = mine || isStaff();
    return `<div class="msg-row flex gap-3 px-2 py-2 animate-fade-up">
      <button data-usercard="${m.user_id}" class="flex-none mt-0.5">${avatarHTML(m.author, 'w-10 h-10 text-[13px]')}</button>
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2 flex-wrap">
          <button class="font-bold text-[15px] hover:underline" data-usercard="${m.user_id}">${esc(m.author?.full_name || 'Unknown')}</button>
          ${m.author?.role && m.author.role !== 'student' ? roleChip(m.author.role) : ''}
          <span class="text-[11px] text-slate-400 font-medium">${fmtTime(m.created_at)} · ${timeAgo(m.created_at)}</span>
          <span class="msg-actions ml-auto flex gap-1">
            ${!mine ? `<button class="w-7 h-7 rounded-lg bg-slate-100 dark:bg-white/10 text-xs text-slate-500 hover:text-rose-500" data-report="${m.id}" title="Report message"><i class="fa-solid fa-flag"></i></button>` : ''}
            ${canDelete ? `<button class="w-7 h-7 rounded-lg bg-slate-100 dark:bg-white/10 text-xs text-slate-500 hover:text-rose-500" data-delmsg="${m.id}" title="Delete message"><i class="fa-solid fa-trash"></i></button>` : ''}
          </span></div>
        <p class="text-[15px] leading-relaxed text-slate-700 dark:text-slate-200 break-words whitespace-pre-wrap">${linkify(m.content)}</p>
      </div></div>`;
  }).join('') : `<div class="text-center py-16"><div class="text-4xl text-brand-300"><i class="fa-solid fa-comments"></i></div>
    <p class="font-black mt-3">Welcome to #${esc(state.channels.find(c => c.id === state.activeChannelId)?.name || '')}!</p>
    <p class="text-sm text-slate-400 mt-1">This is the very beginning of the channel. Say hello 👋</p></div>`;
  $$('#messageList [data-delmsg]').forEach(b => b.onclick = guard(async () => { await Store.deleteMessage(b.dataset.delmsg); state.messages = state.messages.filter(m => m.id !== b.dataset.delmsg); renderMessages(false); toast('Message deleted.'); }));
  $$('#messageList [data-report]').forEach(b => b.onclick = () => openReportModal('message', b.dataset.report));
  $$('#messageList [data-usercard]').forEach(b => b.onclick = () => openUserCard(b.dataset.usercard));
  if (scrollBottom || nearBottom) box.scrollTop = box.scrollHeight;
}
async function handleSendMessage(e) {
  e.preventDefault();
  const input = $('#messageInput'), content = input.value.trim();
  if (!content || !state.activeChannelId) return;
  input.value = '';
  try {
    const msg = await Store.sendMessage(state.activeChannelId, content.slice(0, CONFIG.MAX_MESSAGE_LEN));
    if (!state.messages.some(m => m.id === msg.id)) { state.messages.push(msg); renderMessages(true); }
  } catch (err) { input.value = content; toast(err.message, 'error'); }
}
function openChannelModal() {
  openModal(`<h3 class="font-black text-xl pr-8"><i class="fa-solid fa-hashtag text-brand-500 mr-2"></i>Create channel</h3>
    <p class="text-sm text-slate-400 mt-1">Admin-only. Students can join and chat in every channel you create.</p>
    <form id="chForm" class="space-y-3 mt-4">
      <div><label class="text-sm font-bold">Channel name</label><input id="chName" class="field mt-1.5" required maxlength="40" placeholder="e.g. placements-2026"/></div>
      <div><label class="text-sm font-bold">Description</label><input id="chDesc" class="field mt-1.5" maxlength="120" placeholder="What is this channel for?"/></div>
      <button class="grad-btn w-full py-3 rounded-xl font-bold" id="chSubmit">Create channel</button></form>`);
  $('#chForm').onsubmit = guard(async (e) => { e.preventDefault(); setBusy($('#chSubmit'), true);
    const name = $('#chName').value.trim().toLowerCase().replace(/[^a-z0-9-_ ]/g, '').replace(/\s+/g, '-');
    if (!name) throw new Error('Please give the channel a valid name.');
    const c = await Store.createChannel(name, $('#chDesc').value.trim());
    closeModal(); toast(`Channel #${name} created!`); state.activeChannelId = c.id; loadChat(); });
}
async function openUserCard(userId) {
  let p = state.users.find(u => u.id === userId);
  if (!p) { state.users = await Store.listProfiles().catch(() => state.users); p = state.users.find(u => u.id === userId); }
  if (!p) return toast('Could not load this profile.', 'error');
  openModal(`<div class="text-center">
    <div class="flex justify-center">${avatarHTML(p, 'w-20 h-20 text-2xl')}</div>
    <h3 class="font-black text-xl mt-3">${esc(p.full_name)}</h3>
    <p class="text-sm text-slate-400">${esc(p.email)}</p>
    <div class="flex justify-center gap-2 mt-3 flex-wrap">${roleChip(p.role)}<span class="chip bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-300">${esc(p.branch || '')} · ${esc(p.academic_year || '')}</span><span class="chip bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-300">${esc(p.course || '')}</span></div>
    ${p.bio ? `<p class="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mt-4">${esc(p.bio)}</p>` : ''}
    ${(p.skills || []).length ? `<div class="flex flex-wrap justify-center gap-1.5 mt-4">${p.skills.map(s => `<span class="chip bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-300">${esc(s)}</span>`).join('')}</div>` : ''}
    <div class="flex justify-center gap-2 mt-5 flex-wrap">
      ${p.id !== state.user.id ? `<button id="cardMessage" class="px-4 py-2.5 rounded-xl font-bold text-sm grad-btn shadow-glow"><i class="fa-solid fa-message mr-1.5"></i>Message</button>` : ''}
      ${safeUrl(p.website_url) ? `<a href="${esc(safeUrl(p.website_url))}" target="_blank" rel="noopener" class="px-4 py-2.5 rounded-xl font-bold text-sm bg-brand-600 text-white hover:bg-brand-500"><i class="fa-solid fa-globe mr-1.5"></i>${esc(prettyHost(p.website_url))}</a>` : ''}
      ${safeUrl(p.github_url) ? `<a href="${esc(safeUrl(p.github_url))}" target="_blank" rel="noopener" class="px-4 py-2.5 rounded-xl font-bold text-sm bg-slate-900 dark:bg-white text-white dark:text-slate-900"><i class="fa-brands fa-github mr-1.5"></i>GitHub</a>` : ''}
      ${safeUrl(p.linkedin_url) ? `<a href="${esc(safeUrl(p.linkedin_url))}" target="_blank" rel="noopener" class="px-4 py-2.5 rounded-xl font-bold text-sm bg-[#0a66c2] text-white"><i class="fa-brands fa-linkedin mr-1.5"></i>LinkedIn</a>` : ''}
      <a href="mailto:${esc(p.email)}" class="px-4 py-2.5 rounded-xl font-bold text-sm bg-slate-100 dark:bg-white/10"><i class="fa-regular fa-envelope mr-1.5"></i>Email</a></div>
    ${p.id !== state.user.id ? `<button id="cardReport" class="mt-5 text-sm font-semibold text-rose-500 hover:underline"><i class="fa-solid fa-flag mr-1"></i>Report this user</button>` : ''}
  </div>`, 'max-w-md');
  const rb = $('#cardReport'); if (rb) rb.onclick = () => openReportModal('user', p.id);
  const mb = $('#cardMessage'); if (mb) mb.onclick = () => { closeModal(); openDM(p.id); };
}
function openReportModal(targetType, targetId) {
  openModal(`<h3 class="font-black text-xl pr-8"><i class="fa-solid fa-flag text-rose-500 mr-2"></i>Report ${targetType === 'user' ? 'user' : targetType}</h3>
    <p class="text-sm text-slate-400 mt-1 leading-relaxed">Reports go straight to admins &amp; moderators. The other person is never told who reported them.</p>
    <form id="repForm" class="space-y-3 mt-4">
      <div><label class="text-sm font-bold">Reason</label><select id="repReason" class="field mt-1.5"><option>Spam</option><option>Harassment</option><option>Inappropriate Content</option><option>Misinformation</option><option>Other</option></select></div>
      <div><label class="text-sm font-bold">Details <span class="text-slate-400 font-medium">(optional)</span></label><textarea id="repDetails" rows="3" class="field mt-1.5" placeholder="Anything moderators should know…"></textarea></div>
      <button class="w-full py-3 rounded-xl font-bold bg-rose-500 hover:bg-rose-600 text-white" id="repSubmit">Submit report</button></form>`, 'max-w-md');
  $('#repForm').onsubmit = guard(async (e) => { e.preventDefault(); setBusy($('#repSubmit'), true);
    await Store.createReport({ target_type: targetType, target_id: String(targetId), reason: $('#repReason').value, details: $('#repDetails').value.trim() });
    closeModal(); toast('Report submitted. Our moderators will review it shortly.'); refreshStaffBadges(); });
}

/* ── 11. TEAMMATE FINDER ──────────────────────────────────────────────────── */
async function loadTeammates() {
  [state.teamPosts, state.interests] = await Promise.all([Store.listTeamPosts(), Store.myInterests()]);
  const stacks = [...new Set([...CONFIG.POPULAR_STACKS, ...state.teamPosts.flatMap(p => p.tech_stack || [])])];
  const sel = $('#teamStackFilter'); const cur = sel.value;
  sel.innerHTML = '<option value="">Any tech stack</option>' + stacks.sort().map(s => `<option ${s === cur ? 'selected' : ''}>${esc(s)}</option>`).join('');
  renderTeamPosts();
}
function renderTeamPosts() {
  const q = $('#teamSearch').value.trim().toLowerCase(), type = $('#teamTypeFilter').value, stack = $('#teamStackFilter').value;
  const rows = state.teamPosts.filter(p =>
    (!type || p.event_type === type) && (!stack || (p.tech_stack || []).includes(stack)) &&
    (!q || (p.title + ' ' + p.description + ' ' + (p.tech_stack || []).join(' ')).toLowerCase().includes(q)));
  $('#teamGrid').innerHTML = rows.length ? rows.map(p => {
    const mine = p.user_id === state.user.id, joined = state.interests.has(p.id), full = p.spots_filled >= p.team_size;
    return `<article class="card p-5 flex flex-col animate-fade-up hover:-translate-y-0.5 transition">
      <div class="flex items-center gap-2"><span class="chip ${p.event_type === 'Hackathon' ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-500' : 'bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-300'}">${esc(p.event_type)}</span>
      ${!p.is_open ? '<span class="chip bg-slate-200 dark:bg-white/10 text-slate-500">Closed</span>' : full ? '<span class="chip bg-slate-200 dark:bg-white/10 text-slate-500">Team full</span>' : '<span class="chip bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">Recruiting</span>'}
      <span class="text-xs text-slate-400 ml-auto">${timeAgo(p.created_at)}</span></div>
      <h4 class="font-black leading-snug mt-3">${esc(p.title)}</h4>
      <p class="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mt-1.5 flex-1">${esc(p.description)}</p>
      <div class="flex flex-wrap gap-1.5 mt-3">${(p.tech_stack || []).map(s => `<span class="chip bg-slate-100 dark:bg-white/[.08] text-slate-600 dark:text-slate-200">${esc(s)}</span>`).join('')}</div>
      <div class="mt-4"><div class="flex justify-between text-xs font-bold text-slate-400"><span><i class="fa-solid fa-users mr-1"></i>${p.spots_filled} / ${p.team_size} members</span><span>${Math.max(0, p.team_size - p.spots_filled)} spot(s) left</span></div>
      <div class="h-2 rounded-full bg-slate-100 dark:bg-white/10 mt-1.5 overflow-hidden"><div class="h-full rounded-full bg-gradient-to-r from-brand-500 to-fuchsia-500 transition-all" style="width:${Math.min(100, p.spots_filled / p.team_size * 100)}%"></div></div></div>
      <div class="flex items-center gap-2.5 mt-4 pt-4 border-t border-slate-100 dark:border-white/[.07]">
        <button data-usercard="${p.user_id}" class="flex items-center gap-2 min-w-0">${avatarHTML(p.author, 'w-8 h-8 text-[11px]')}<span class="text-left min-w-0"><span class="block font-bold text-[13px] truncate">${esc(p.author?.full_name || '')}</span><span class="block text-[11px] text-slate-400 truncate">${esc(p.author?.branch || '')} · ${esc(p.author?.academic_year || '')}</span></span></button>
        <span class="ml-auto flex gap-1.5">
        ${mine
          ? `<button class="px-3 py-2 rounded-lg text-[13px] font-bold bg-slate-100 dark:bg-white/10" data-teamopen="${p.id}">${p.is_open ? 'Close post' : 'Reopen'}</button>
             <button class="px-3 py-2 rounded-lg text-[13px] font-bold bg-rose-50 dark:bg-rose-500/10 text-rose-500" data-teamdel="${p.id}"><i class="fa-solid fa-trash"></i></button>`
          : `<button class="px-3 py-2 rounded-lg text-[13px] font-bold bg-slate-100 dark:bg-white/10 hover:bg-brand-100 dark:hover:bg-brand-500/20 transition" data-dmcontact="${p.user_id}" data-dmname="${esc(p.author?.full_name || 'there')}" data-dmtitle="${esc(p.title)}" title="Chat with ${esc(p.author?.full_name || 'the poster')}"><i class="fa-solid fa-message mr-1"></i>Contact</button>
             <button class="px-3 py-2 rounded-lg text-[13px] font-bold ${joined ? 'bg-emerald-500 text-white' : 'grad-btn'}" data-teamjoin="${p.id}" ${(!p.is_open || (full && !joined)) ? 'disabled style="opacity:.5"' : ''}>${joined ? '<i class="fa-solid fa-check mr-1"></i>Interested' : 'I\'m interested'}</button>`}
        </span></div></article>`;
  }).join('') : emptyState('fa-users', 'No posts match your filters', 'Try a different tech stack — or post your own requirement!');
  $$('#teamGrid [data-usercard]').forEach(b => b.onclick = () => openUserCard(b.dataset.usercard));
  $$('#teamGrid [data-teamjoin]').forEach(b => b.onclick = guard(async () => { const j = await Store.toggleInterest(b.dataset.teamjoin); toast(j ? 'Interest sent! The poster can now see the team filling up. 🎉' : 'Interest withdrawn.'); loadTeammates(); }));
  $$('#teamGrid [data-dmcontact]').forEach(b => b.onclick = () => openDM(b.dataset.dmcontact, `Hi ${String(b.dataset.dmname).split(' ')[0]}! I saw your Teammate Finder post "${b.dataset.dmtitle}" and I would love to know more about joining your team.`));
  $$('#teamGrid [data-teamdel]').forEach(b => b.onclick = guard(async () => { if (await confirmDialog('Delete this post?', 'Your teammate requirement will be removed.')) { await Store.deleteTeamPost(b.dataset.teamdel); toast('Post deleted.'); loadTeammates(); } }));
  $$('#teamGrid [data-teamopen]').forEach(b => b.onclick = guard(async () => { const p = state.teamPosts.find(x => x.id === b.dataset.teamopen); await Store.setTeamOpen(p.id, !p.is_open); toast(p.is_open ? 'Post closed to new interest.' : 'Post reopened!'); loadTeammates(); }));
}
function openTeamPostModal() {
  openModal(`<h3 class="font-black text-xl pr-8"><i class="fa-solid fa-users text-brand-500 mr-2"></i>Post a teammate requirement</h3>
    <form id="tpForm" class="space-y-3 mt-4">
      <div><label class="text-sm font-bold">Project / hackathon name</label><input id="tpTitle" class="field mt-1.5" required maxlength="120" placeholder="e.g. SIH 2026 — smart attendance app"/></div>
      <div><label class="text-sm font-bold">What are you building & who do you need?</label><textarea id="tpDesc" rows="4" class="field mt-1.5" required placeholder="Idea, current progress, roles needed, time commitment…"></textarea></div>
      <div><label class="text-sm font-bold">Tech stack <span class="text-slate-400 font-medium">(comma separated)</span></label><input id="tpStack" class="field mt-1.5" placeholder="React, Node.js, Python"/></div>
      <div class="flex flex-wrap gap-1.5">${CONFIG.POPULAR_STACKS.map(s => `<button type="button" class="chip bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-200 hover:bg-brand-100 dark:hover:bg-brand-500/20" data-addstack="${esc(s)}">+ ${esc(s)}</button>`).join('')}</div>
      <div class="grid grid-cols-2 gap-3">
        <div><label class="text-sm font-bold">Type</label><select id="tpType" class="field mt-1.5"><option>Hackathon</option><option>Project</option><option>Study Group</option><option>Competition</option><option>Other</option></select></div>
        <div><label class="text-sm font-bold">Total team size</label><input id="tpSize" type="number" min="2" max="20" value="4" class="field mt-1.5"/></div></div>
      <div><label class="text-sm font-bold">Contact (email / handle)</label><input id="tpContact" class="field mt-1.5" value="${esc(state.user.email)}"/></div>
      <button class="grad-btn w-full py-3 rounded-xl font-bold" id="tpSubmit">Post requirement 🚀</button></form>`, 'max-w-xl');
  $$('#tpForm [data-addstack]').forEach(b => b.onclick = () => { const inp = $('#tpStack'); const cur = parseTags(inp.value); if (!cur.includes(b.dataset.addstack)) inp.value = [...cur, b.dataset.addstack].join(', '); });
  $('#tpForm').onsubmit = guard(async (e) => { e.preventDefault(); setBusy($('#tpSubmit'), true);
    await Store.createTeamPost({ title: $('#tpTitle').value.trim(), description: $('#tpDesc').value.trim(), tech_stack: parseTags($('#tpStack').value), event_type: $('#tpType').value, team_size: Math.min(20, Math.max(1, +$('#tpSize').value || 4)), contact: $('#tpContact').value.trim() });
    closeModal(); toast('Requirement posted! Interested students will reach out.'); loadTeammates(); });
}

/* ── 12. RESOURCE HUB (Supabase Storage) ──────────────────────────────────── */
const fileIcon = (name = '') => /\.pdf$/i.test(name) ? ['fa-file-pdf', 'bg-rose-50 dark:bg-rose-500/10 text-rose-500']
  : /\.(png|jpe?g|gif|webp)$/i.test(name) ? ['fa-file-image', 'bg-sky-50 dark:bg-sky-500/10 text-sky-500']
  : /\.(zip|rar|7z)$/i.test(name) ? ['fa-file-zipper', 'bg-amber-50 dark:bg-amber-500/10 text-amber-500']
  : /\.(docx?|odt)$/i.test(name) ? ['fa-file-word', 'bg-blue-50 dark:bg-blue-500/10 text-blue-500']
  : /\.(pptx?)$/i.test(name) ? ['fa-file-powerpoint', 'bg-orange-50 dark:bg-orange-500/10 text-orange-500']
  : ['fa-file-lines', 'bg-brand-50 dark:bg-brand-500/10 text-brand-500'];
/* Browsers ignore the `download` attribute on CROSS-ORIGIN links, and Supabase
   serves PDFs inline — so a plain anchor just opens the viewer (or nothing,
   if the popup blocker eats the post-await window.open). Fix per URL type:
   • Supabase Storage → append ?download=<name> → server replies
     Content-Disposition: attachment, forcing a real save.
   • data:/blob: (demo files) → anchor download works as-is.
   • Other external links → fetch as blob (same-origin object URL), with a
     new-tab fallback if CORS blocks the fetch. */
function isInIframe() { try { return window.self !== window.top; } catch { return true; } }
function directDownloadTarget(r) {
  const url = String(r?.file_url || ''), name = r?.file_name || 'download';
  if (!url) return null;
  if (url.startsWith('data:') || url.startsWith('blob:')) return { href: url, name, newTab: false };
  if (/\/storage\/v1\/object\/(public|sign)\//.test(url))
    return { href: url + (url.includes('?') ? '&' : '?') + 'download=' + encodeURIComponent(name), name: '', newTab: true };
  return null; // needs the blob-fetch path below
}
function saveViaAnchor(href, downloadName, newTab = false) {
  const a = document.createElement('a'); a.href = href; a.rel = 'noopener';
  if (downloadName) a.download = downloadName;
  if (newTab) a.target = '_blank';
  document.body.appendChild(a); a.click(); a.remove();
}
async function triggerFileDownload(r) {
  const direct = directDownloadTarget(r);
  if (direct) { saveViaAnchor(direct.href, direct.name, direct.newTab); return; }
  try {
    const resp = await fetch(r.file_url);
    if (!resp.ok) throw new Error('fetch failed');
    const blobUrl = URL.createObjectURL(await resp.blob());
    saveViaAnchor(blobUrl, r.file_name || 'download');
    setTimeout(() => URL.revokeObjectURL(blobUrl), 4000);
  } catch { saveViaAnchor(r.file_url, '', true); } // last resort: open in a new tab
}
/* Embedded previews (iframes) can silently block downloads in Chrome. When
   that happens, give the user two guaranteed paths: copy the direct link into
   a fresh tab, or open the whole app top-level where downloads just work. */
function openDownloadHelpModal(r) {
  const dt = directDownloadTarget(r);
  const href = dt?.href || r.file_url;
  const isData = href.startsWith('data:') || href.startsWith('blob:');
  openModal(`<h3 class="font-black text-xl pr-8"><i class="fa-solid fa-download text-brand-500 mr-2"></i>Downloading "${esc(r.title)}"</h3>
    <p class="text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">Your download should have started in a new tab. If nothing happened, Chrome is blocking downloads inside this embedded preview — tap the button below and the file will download in a new tab:</p>
    <div class="mt-4 space-y-4">
      <a id="dlNow" href="${esc(href)}" ${dt?.name ? `download="${esc(dt.name)}"` : ''} ${isData ? '' : 'target="_blank"'} rel="noopener" class="grad-btn block text-center w-full py-3.5 rounded-xl font-black shadow-glow"><i class="fa-solid fa-download mr-2"></i>Download ${esc(r.file_name || 'file')}</a>
      <div><label class="text-sm font-bold">Or copy the direct download link</label>
        <div class="flex gap-2 mt-1.5"><input id="dlLink" class="field flex-1 font-mono !text-[12px]" readonly value="${esc(href)}"/>
        <button type="button" id="dlCopy" class="grad-btn px-4 rounded-xl font-bold text-sm flex-none"><i class="fa-solid fa-copy mr-1"></i>Copy</button></div>
        <p class="text-xs text-slate-400 mt-1.5">Paste it into a new Chrome tab — the file downloads immediately.</p></div>
      <p class="text-xs text-slate-400 leading-relaxed"><i class="fa-solid fa-lightbulb text-amber-500 mr-1"></i>Tip: if Chrome shows a "pop-up blocked" icon in the address bar, allow pop-ups for this preview. On your deployed website, downloads work normally.</p>
    </div>`, 'max-w-md');
  $('#dlNow').onclick = () => setTimeout(closeModal, 600); // let the new tab open first, then tidy up
  const inp = $('#dlLink');
  $('#dlCopy').onclick = async () => {
    try { await navigator.clipboard.writeText(href); }
    catch { inp.focus(); inp.select(); try { document.execCommand('copy'); } catch { /* user can copy manually */ } }
    toast('Download link copied — paste it into a new Chrome tab.');
  };
}
async function loadResources() {
  [state.resourcesApproved, state.resourcesMine, state.myUpvotes] = await Promise.all([Store.listResources('approved'), Store.listResources('mine'), Store.myUpvotes()]);
  renderResources();
}
const currentResourceRows = () => state.resourceTab === 'mine' ? state.resourcesMine : state.resourcesApproved;
const findResource = (id) => [...state.resourcesApproved, ...state.resourcesMine].find(r => r.id === id);
function renderResources() {
  $$('.resource-tab').forEach(b => b.classList.toggle('active', b.dataset.restab === state.resourceTab));
  const q = $('#resourceSearch').value.trim().toLowerCase(), cat = $('#resourceCategory').value, sort = $('#resourceSort').value;
  let rows = currentResourceRows().filter(r => (!cat || r.category === cat) && (!q || (r.title + ' ' + (r.subject || '') + ' ' + (r.author?.full_name || '')).toLowerCase().includes(q)));
  if (sort === 'upvotes') rows.sort((a, b) => b.upvotes - a.upvotes);
  if (sort === 'downloads') rows.sort((a, b) => b.downloads - a.downloads);
  $('#resourceGrid').innerHTML = rows.length ? rows.map(r => {
    const [icon, cls] = fileIcon(r.file_name || r.title); const voted = state.myUpvotes.has(r.id); const mine = r.user_id === state.user.id; const dt = directDownloadTarget(r);
    return `<article class="card p-5 flex flex-col animate-fade-up hover:-translate-y-0.5 transition">
      <div class="flex items-start gap-3"><div class="w-12 h-12 rounded-2xl flex items-center justify-center text-xl ${cls}"><i class="fa-solid ${icon}"></i></div>
      <div class="min-w-0 flex-1"><h4 class="font-black leading-snug">${esc(r.title)}</h4>
      <p class="text-xs text-slate-400 mt-0.5 truncate">${esc(r.file_name || 'External link')}</p></div></div>
      <p class="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mt-3 flex-1">${esc(r.description || '')}</p>
      ${state.resourceTab === 'mine' && (r.status || 'approved') === 'rejected' && r.admin_note ? `<p class="text-[13px] font-semibold text-rose-500 bg-rose-50 dark:bg-rose-500/10 rounded-lg px-3 py-2 mt-3"><i class="fa-solid fa-comment mr-1"></i>Admin feedback: ${esc(r.admin_note)}</p>` : ''}
      ${state.resourceTab === 'mine' && (r.status || 'approved') === 'pending' ? '<p class="text-[13px] font-semibold text-amber-600 dark:text-amber-400 mt-3"><i class="fa-solid fa-hourglass-half mr-1"></i>Awaiting admin review — not public yet.</p>' : ''}
      <div class="flex flex-wrap gap-1.5 mt-3"><span class="chip bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-300">${esc(r.category)}</span>${state.resourceTab === 'mine' ? statusChip(r.status || 'approved') : ''}
      ${r.subject ? `<span class="chip bg-slate-100 dark:bg-white/[.08] text-slate-600 dark:text-slate-200">${esc(r.subject)}</span>` : ''}</div>
      <button class="flex items-center gap-2 mt-4 text-left" data-usercard="${r.user_id}">${avatarHTML(r.author, 'w-7 h-7 text-[10px]')}<span class="text-[13px] font-semibold">${esc(r.author?.full_name || '')}</span><span class="text-xs text-slate-400">· ${timeAgo(r.created_at)}</span></button>
      <div class="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-white/[.07]">
        <button class="px-3 py-2 rounded-lg text-[13px] font-bold ${voted ? 'bg-brand-600 text-white' : 'bg-slate-100 dark:bg-white/10'}" data-upvote="${r.id}"><i class="fa-solid fa-arrow-up mr-1"></i>${r.upvotes}</button>
        ${dt ? `<a href="${esc(dt.href)}" ${dt.name ? `download="${esc(dt.name)}"` : ''} ${dt.newTab ? 'target="_blank"' : ''} rel="noopener" class="flex-1 px-3 py-2 rounded-lg text-[13px] font-bold grad-btn text-center" data-download="${r.id}"><i class="fa-solid fa-download mr-1"></i>Download · ${r.downloads}</a>` : `<button class="flex-1 px-3 py-2 rounded-lg text-[13px] font-bold grad-btn" data-download="${r.id}"><i class="fa-solid fa-download mr-1"></i>Download · ${r.downloads}</button>`}
        ${mine || isStaff() ? `<button class="px-3 py-2 rounded-lg text-[13px] font-bold bg-rose-50 dark:bg-rose-500/10 text-rose-500" data-delres="${r.id}"><i class="fa-solid fa-trash"></i></button>`
          : `<button class="px-3 py-2 rounded-lg text-[13px] font-bold bg-slate-100 dark:bg-white/10 text-slate-500" data-repres="${r.id}" title="Report resource"><i class="fa-solid fa-flag"></i></button>`}
      </div></article>`;
  }).join('') : state.resourceTab === 'mine'
    ? emptyState('fa-cloud-arrow-up', 'You have not uploaded anything yet', 'Share your first notes — an admin will review and publish them.')
    : emptyState('fa-folder-open', 'No published resources found', 'Approved uploads appear here. Upload yours — it goes live after admin review!');
  $$('#resourceGrid [data-usercard]').forEach(b => b.onclick = () => openUserCard(b.dataset.usercard));
  $$('#resourceGrid [data-upvote]').forEach(b => b.onclick = guard(async () => { const id = b.dataset.upvote; const on = await Store.toggleUpvote(id);
    const r = findResource(id); if (r) r.upvotes += on ? 1 : -1; on ? state.myUpvotes.add(id) : state.myUpvotes.delete(id); renderResources(); }));
  $$('#resourceGrid [data-download]').forEach(b => b.onclick = (e) => {
    const r = findResource(b.dataset.download);
    if (!r?.file_url) { e.preventDefault(); toast('This resource has no file attached.', 'error'); return; }
    r.downloads++; Store.incrementDownload(r.id).catch(() => {});
    if (!directDownloadTarget(r)) { e.preventDefault(); triggerFileDownload(r).catch(() => {}); } // external links: blob-save path
    // Direct downloads are REAL <a> tags — let the browser handle the click natively.
    setTimeout(renderResources, 400); // refresh the counter without disturbing the navigation
    if (isInIframe()) setTimeout(() => openDownloadHelpModal(r), 350);
    else toast('Downloading "' + r.title + '"');
  });
  $$('#resourceGrid [data-delres]').forEach(b => b.onclick = guard(async () => { if (await confirmDialog('Delete this resource?', 'The file will be removed from storage and the hub.')) { await Store.deleteResource(b.dataset.delres); toast('Resource deleted.'); loadResources(); } }));
  $$('#resourceGrid [data-repres]').forEach(b => b.onclick = () => openReportModal('resource', b.dataset.repres));
}
function openResourceModal() {
  openModal(`<h3 class="font-black text-xl pr-8"><i class="fa-solid fa-cloud-arrow-up text-brand-500 mr-2"></i>Share a resource</h3>
    <p class="text-sm text-slate-400 mt-1">${MODE === 'supabase' ? 'Files upload straight to your Supabase Storage bucket.' : 'Demo mode: files up to 1.5 MB are kept in your browser; larger files need Supabase (or paste a link).'}</p>
    <form id="resForm" class="space-y-3 mt-4">
      <div><label class="text-sm font-bold">Title</label><input id="resTitle" class="field mt-1.5" required maxlength="120" placeholder="e.g. CN Unit 3 notes — TCP/IP deep dive"/></div>
      <div><label class="text-sm font-bold">Description</label><textarea id="resDesc" rows="3" class="field mt-1.5" placeholder="What's inside? Which exam does it help with?"></textarea></div>
      <div class="grid grid-cols-2 gap-3">
        <div><label class="text-sm font-bold">Category</label><select id="resCat" class="field mt-1.5"><option>Notes</option><option>Cheat Sheet</option><option>Previous Papers</option><option>Books</option><option>Slides</option><option>Assignments</option><option>Other</option></select></div>
        <div><label class="text-sm font-bold">Subject</label><input id="resSubject" class="field mt-1.5" placeholder="e.g. DBMS"/></div></div>
      <div><label class="text-sm font-bold">Upload file</label>
        <label class="mt-1.5 flex items-center gap-3 border-2 border-dashed border-slate-200 dark:border-white/15 rounded-xl px-4 py-4 cursor-pointer hover:border-brand-400 transition">
          <i class="fa-solid fa-file-arrow-up text-brand-500 text-xl"></i>
          <span class="text-sm font-semibold text-slate-500 dark:text-slate-300" id="resFileLabel">Choose PDF, DOC, image, ZIP…</span>
          <input id="resFile" type="file" class="hidden" accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.md,.zip,.png,.jpg,.jpeg"/></label></div>
      <div><label class="text-sm font-bold">…or paste an external link</label><input id="resUrl" class="field mt-1.5" placeholder="https://drive.google.com/…"/></div>
      <p id="resErr" class="hidden text-sm font-semibold text-rose-500"></p>
      <button class="grad-btn w-full py-3 rounded-xl font-bold" id="resSubmit">Submit for admin review 📚</button></form>`, 'max-w-xl');
  $('#resFile').onchange = () => { const f = $('#resFile').files[0]; if (f) $('#resFileLabel').textContent = `${f.name} · ${(f.size / 1024).toFixed(0)} KB`; };
  $('#resForm').onsubmit = async (e) => { e.preventDefault(); const err = $('#resErr'); err.classList.add('hidden'); setBusy($('#resSubmit'), true);
    try {
      const file = $('#resFile').files[0]; let url = $('#resUrl').value.trim(), path = '';
      if (file) { const up = await Store.uploadFile(file); url = up.url; path = up.path; }
      if (!url) throw new Error('Attach a file or paste an external link.');
      await Store.createResource({ title: $('#resTitle').value.trim(), description: $('#resDesc').value.trim(), category: $('#resCat').value, subject: $('#resSubject').value.trim(), file_url: url, file_name: file ? file.name : 'External link', storage_path: path });
      closeModal(); state.resourceTab = 'mine'; toast('Resource submitted for review! An admin will publish it soon — track it under My uploads.'); loadResources(); refreshStaffBadges();
    } catch (ex) { err.textContent = ex.message; err.classList.remove('hidden'); } finally { setBusy($('#resSubmit'), false, 'Upload'); } };
}

/* ── 13. ROADMAPS + APPROVAL WORKFLOW ─────────────────────────────────────── */
async function loadRoadmaps() {
  [state.roadmapsApproved, state.roadmapsMine] = await Promise.all([Store.listRoadmaps('approved'), Store.listRoadmaps('mine')]);
  renderRoadmaps();
}
function roadmapCard(r, showStatus) {
  const plain = r.content.replace(/[#>*`\-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 150);
  return `<article class="card p-5 flex flex-col animate-fade-up hover:-translate-y-0.5 transition">
    <div class="flex flex-wrap gap-1.5"><span class="chip bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-300">${esc(r.category || 'General')}</span>${showStatus ? statusChip(r.status) : ''}</div>
    <h4 class="font-black leading-snug mt-3">${esc(r.title)}</h4>
    <p class="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mt-1.5 flex-1">${esc(plain)}…</p>
    ${r.status === 'rejected' && r.admin_note ? `<p class="text-[13px] font-semibold text-rose-500 bg-rose-50 dark:bg-rose-500/10 rounded-lg px-3 py-2 mt-3"><i class="fa-solid fa-comment mr-1"></i>Admin feedback: ${esc(r.admin_note)}</p>` : ''}
    ${r.status === 'pending' && showStatus ? '<p class="text-[13px] font-semibold text-amber-600 dark:text-amber-400 mt-3"><i class="fa-solid fa-hourglass-half mr-1"></i>Awaiting admin review — not public yet.</p>' : ''}
    <div class="flex items-center gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-white/[.07]">
      <button class="flex items-center gap-2 min-w-0" data-usercard="${r.user_id}">${avatarHTML(r.author, 'w-8 h-8 text-[11px]')}<span class="text-left"><span class="block font-bold text-[13px] truncate">${esc(r.author?.full_name || '')}</span><span class="block text-[11px] text-slate-400">${timeAgo(r.created_at)}</span></span></button>
      <button class="ml-auto grad-btn px-4 py-2 rounded-lg text-[13px] font-bold" data-readroadmap="${r.id}"><i class="fa-solid fa-book-open mr-1"></i>Read</button>
      ${showStatus ? `<button class="px-3 py-2 rounded-lg text-[13px] font-bold bg-rose-50 dark:bg-rose-500/10 text-rose-500" data-delroadmap="${r.id}"><i class="fa-solid fa-trash"></i></button>` : ''}
    </div></article>`;
}
function renderRoadmaps() {
  $$('.roadmap-tab').forEach(b => b.classList.toggle('active', b.dataset.rtab === state.roadmapTab));
  const q = $('#roadmapSearch').value.trim().toLowerCase();
  const src = state.roadmapTab === 'mine' ? state.roadmapsMine : state.roadmapsApproved;
  const rows = src.filter(r => !q || (r.title + ' ' + (r.category || '') + ' ' + r.content).toLowerCase().includes(q));
  $('#roadmapGrid').innerHTML = rows.length ? rows.map(r => roadmapCard(r, state.roadmapTab === 'mine')).join('')
    : state.roadmapTab === 'mine'
      ? emptyState('fa-route', 'You have not submitted a roadmap yet', 'Share your journey — an admin will review it before it goes public.')
      : emptyState('fa-map', 'No approved roadmaps match', 'Roadmaps appear here only after admin approval.');
  const all = [...state.roadmapsApproved, ...state.roadmapsMine];
  $$('#roadmapGrid [data-readroadmap]').forEach(b => b.onclick = () => openRoadmapReader(all.find(r => r.id === b.dataset.readroadmap)));
  $$('#roadmapGrid [data-usercard]').forEach(b => b.onclick = () => openUserCard(b.dataset.usercard));
  $$('#roadmapGrid [data-delroadmap]').forEach(b => b.onclick = guard(async () => { if (await confirmDialog('Delete this roadmap?', 'This cannot be undone.')) { await Store.deleteRoadmap(b.dataset.delroadmap); toast('Roadmap deleted.'); loadRoadmaps(); refreshStaffBadges(); } }));
}
function openRoadmapReader(r) {
  if (!r) return;
  openModal(`<div class="flex flex-wrap gap-1.5 pr-8"><span class="chip bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-300">${esc(r.category || 'General')}</span>${statusChip(r.status)}
    ${r.attachment_url ? `<a class="chip bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" href="${esc(r.attachment_url)}" target="_blank" rel="noopener"><i class="fa-solid fa-paperclip"></i>Attachment</a>` : ''}</div>
    <h3 class="font-black text-2xl leading-tight mt-3 pr-6">${esc(r.title)}</h3>
    <div class="flex items-center gap-2.5 mt-3 pb-4 border-b border-slate-100 dark:border-white/[.08]">${avatarHTML(r.author)}
      <div><p class="font-bold text-sm">${esc(r.author?.full_name || '')}</p><p class="text-xs text-slate-400">${esc(r.author?.branch || '')} · ${esc(r.author?.academic_year || '')} · ${fmtDate(String(r.created_at).slice(0, 10))}</p></div>
      ${r.user_id !== state.user.id ? `<button id="readerReport" class="ml-auto text-[13px] font-semibold text-slate-400 hover:text-rose-500"><i class="fa-solid fa-flag mr-1"></i>Report</button>` : ''}</div>
    <div class="md-body text-[15px] mt-4 text-slate-700 dark:text-slate-200">${renderMarkdown(r.content)}</div>`, 'max-w-3xl');
  const rb = $('#readerReport'); if (rb) rb.onclick = () => openReportModal('roadmap', r.id);
}
const ROADMAP_TEMPLATE = `# My Roadmap Title\n\n## Overview\nWho is this roadmap for, and what outcome does it lead to?\n\n## Phase 1 — Foundations\n- Topic one\n- Topic two\n\n## Phase 2 — Build & Practice\n1. Project idea\n2. Project idea\n\n## Resources\n- [Helpful link](https://example.com)\n\n> One honest piece of advice for juniors.`;
function openRoadmapModal() {
  openModal(`<h3 class="font-black text-xl pr-8"><i class="fa-solid fa-route text-brand-500 mr-2"></i>Submit a roadmap</h3>
    <p class="text-sm text-slate-400 mt-1 leading-relaxed">Written in <b>Markdown</b>. Status starts as <b class="text-amber-500">Pending</b> — an admin must approve it before it appears publicly.</p>
    <form id="rmForm" class="space-y-3 mt-4">
      <div><label class="text-sm font-bold">Title</label><input id="rmTitle" class="field mt-1.5" required maxlength="140" placeholder="e.g. Android Development Roadmap 2026"/></div>
      <div class="grid grid-cols-2 gap-3">
        <div><label class="text-sm font-bold">Category</label><select id="rmCat" class="field mt-1.5"><option>Placements</option><option>Web Development</option><option>Machine Learning</option><option>App Development</option><option>Design</option><option>DSA / CP</option><option>Higher Studies</option><option>Other</option></select></div>
        <div><label class="text-sm font-bold">Attachment link <span class="text-slate-400 font-medium">(PDF/image, optional)</span></label><input id="rmAttach" class="field mt-1.5" placeholder="https://…"/></div></div>
      <div><div class="flex items-center justify-between"><label class="text-sm font-bold">Roadmap (Markdown)</label>
        <div class="flex gap-1"><button type="button" id="rmTabWrite" class="tab-btn active !py-1 !px-3 !text-[13px]">Write</button><button type="button" id="rmTabPrev" class="tab-btn !py-1 !px-3 !text-[13px]">Preview</button></div></div>
        <textarea id="rmContent" rows="12" class="field mt-1.5 font-mono !text-[13px] leading-relaxed" required></textarea>
        <div id="rmPreview" class="hidden field mt-1.5 md-body min-h-[220px]"></div></div>
      <button class="grad-btn w-full py-3 rounded-xl font-bold" id="rmSubmit">Submit for admin review 🗺️</button></form>`, 'max-w-2xl');
  $('#rmContent').value = ROADMAP_TEMPLATE;
  const setTab = (prev) => { $('#rmContent').classList.toggle('hidden', prev); $('#rmPreview').classList.toggle('hidden', !prev);
    $('#rmTabWrite').classList.toggle('active', !prev); $('#rmTabPrev').classList.toggle('active', prev);
    if (prev) $('#rmPreview').innerHTML = renderMarkdown($('#rmContent').value); };
  $('#rmTabWrite').onclick = () => setTab(false); $('#rmTabPrev').onclick = () => setTab(true);
  $('#rmForm').onsubmit = guard(async (e) => { e.preventDefault(); setBusy($('#rmSubmit'), true);
    await Store.submitRoadmap({ title: $('#rmTitle').value.trim(), category: $('#rmCat').value, attachment_url: $('#rmAttach').value.trim(), content: $('#rmContent').value.trim() });
    closeModal(); state.roadmapTab = 'mine'; toast('Roadmap submitted! An admin will review it — track it under "My submissions".');
    loadRoadmaps(); refreshStaffBadges(); });
}

/* ── 14. PRODUCTIVITY (Calendar + To-Do) ──────────────────────────────────── */
async function loadProductivity() {
  [state.todos, state.events, state.announcements] = await Promise.all([Store.listTodos(), Store.listEvents(), Store.listAnnouncements()]);
  renderCalendar(); renderTodos(); renderUpcoming();
}
const collegeEventsByDay = () => { const m = {}; state.announcements.forEach(a => { if (a.event_date) (m[String(a.event_date).slice(0, 10)] ??= []).push(a); }); return m; };
function renderCalendar() {
  const cur = state.calCursor, y = cur.getFullYear(), mo = cur.getMonth();
  $('#calTitle').textContent = cur.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const first = new Date(y, mo, 1), startDay = first.getDay(), daysIn = new Date(y, mo + 1, 0).getDate(), prevDays = new Date(y, mo, 0).getDate();
  const mine = {}, college = collegeEventsByDay(), todosByDay = {};
  state.events.forEach(e => (mine[e.event_date] ??= []).push(e));
  state.todos.forEach(t => { if (t.due_date && !t.completed) (todosByDay[t.due_date] ??= []).push(t); });
  const todayK = dateKey(new Date()); let cells = '';
  for (let i = 0; i < 42; i++) {
    const dNum = i - startDay + 1; const d = new Date(y, mo, dNum); const k = dateKey(d); const inMonth = dNum >= 1 && dNum <= daysIn;
    const evs = [...(college[k] || []).map(e => ({ t: e.title, c: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300' })),
                 ...(mine[k] || []).map(e => ({ t: e.title, c: 'bg-brand-100 dark:bg-brand-500/20 text-brand-700 dark:text-brand-200' })),
                 ...(todosByDay[k] || []).map(e => ({ t: '✓ ' + e.task, c: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300' }))];
    cells += `<div class="cal-day ${inMonth ? '' : 'dim'} ${k === todayK ? 'today' : ''}" data-day="${k}">
      <p class="text-[13px] font-black ${k === todayK ? 'text-brand-500' : ''}">${d.getDate()}${k === todayK ? ' · Today' : ''}</p>
      <div class="space-y-1 mt-1">${evs.slice(0, 3).map(e => `<p class="text-[10px] font-bold leading-tight rounded-md px-1.5 py-1 truncate ${e.c}">${esc(e.t)}</p>`).join('')}
      ${evs.length > 3 ? `<p class="text-[10px] font-bold text-slate-400">+${evs.length - 3} more</p>` : ''}</div></div>`;
    if (i >= startDay + daysIn - 1 && (i + 1) % 7 === 0) break;
  }
  $('#calendarGrid').innerHTML = cells;
  $$('#calendarGrid [data-day]').forEach(c => c.onclick = () => openDayModal(c.dataset.day));
}
function renderUpcoming() {
  const today = dateKey(new Date());
  const items = [
    ...state.events.filter(e => e.event_date >= today).map(e => ({ date: e.event_date, title: e.title, kind: 'Personal', cls: 'bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-300' })),
    ...state.announcements.filter(a => a.event_date && String(a.event_date).slice(0, 10) >= today).map(a => ({ date: String(a.event_date).slice(0, 10), title: a.title, kind: 'College', cls: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400' })),
    ...state.todos.filter(t => t.due_date && !t.completed && t.due_date >= today).map(t => ({ date: t.due_date, title: t.task, kind: 'Task due', cls: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' })),
  ].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6);
  $('#upcomingList').innerHTML = `<h5 class="font-black mb-2.5"><i class="fa-solid fa-bolt text-amber-500 mr-2"></i>Coming up</h5>` + (items.length
    ? items.map(i => `<div class="flex items-center gap-3 py-2 border-b border-slate-50 dark:border-white/[.05] last:border-0">
        <div class="w-12 text-center flex-none"><p class="font-black text-lg leading-none">${i.date.slice(8)}</p><p class="text-[10px] font-black tracking-wide text-slate-400">${new Date(i.date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short' }).toUpperCase()}</p></div>
        <p class="font-semibold text-sm flex-1 leading-snug">${esc(i.title)}</p><span class="chip ${i.cls}">${i.kind}</span></div>`).join('')
    : '<p class="text-sm text-slate-400">Nothing scheduled. Click a day above to add your first event.</p>');
}
function openDayModal(day) {
  const mine = state.events.filter(e => e.event_date === day);
  const college = (collegeEventsByDay()[day] || []);
  const due = state.todos.filter(t => t.due_date === day);
  openModal(`<h3 class="font-black text-xl pr-8"><i class="fa-regular fa-calendar text-brand-500 mr-2"></i>${fmtDate(day)}</h3>
    <div class="space-y-2 mt-4">
      ${college.map(a => `<div class="rounded-xl px-3.5 py-2.5 bg-amber-50 dark:bg-amber-500/10 text-sm"><span class="chip bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-300 mr-2">College</span><b>${esc(a.title)}</b></div>`).join('')}
      ${due.map(t => `<div class="rounded-xl px-3.5 py-2.5 bg-emerald-50 dark:bg-emerald-500/10 text-sm"><span class="chip bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 mr-2">Task due</span><span class="${t.completed ? 'line-through opacity-60' : ''}">${esc(t.task)}</span></div>`).join('')}
      ${mine.map(e => `<div class="rounded-xl px-3.5 py-2.5 bg-brand-50 dark:bg-brand-500/10 text-sm flex items-start gap-2"><div class="flex-1"><b>${esc(e.title)}</b>${e.description ? `<p class="text-slate-500 dark:text-slate-400 mt-0.5">${esc(e.description)}</p>` : ''}</div>
        <button class="text-rose-500" data-delevent="${e.id}"><i class="fa-solid fa-trash"></i></button></div>`).join('')}
      ${!college.length && !mine.length && !due.length ? '<p class="text-sm text-slate-400">Nothing on this day yet.</p>' : ''}
    </div>
    <form id="evForm" class="space-y-3 mt-5 pt-4 border-t border-slate-100 dark:border-white/[.08]">
      <p class="font-black text-sm">Add a personal event</p>
      <input id="evTitle" class="field" required maxlength="100" placeholder="e.g. DBMS viva / Hackathon deadline"/>
      <textarea id="evDesc" rows="2" class="field" placeholder="Notes (optional)"></textarea>
      <button class="grad-btn w-full py-2.5 rounded-xl font-bold" id="evSubmit">Add to ${fmtDate(day)}</button></form>`);
  $$('#modalRoot [data-delevent]').forEach(b => b.onclick = guard(async () => { await Store.deleteEvent(b.dataset.delevent); state.events = state.events.filter(e => e.id !== b.dataset.delevent); closeModal(); renderCalendar(); renderUpcoming(); toast('Event removed.'); }));
  $('#evForm').onsubmit = guard(async (e) => { e.preventDefault(); setBusy($('#evSubmit'), true);
    await Store.createEvent({ title: $('#evTitle').value.trim(), event_date: day, description: $('#evDesc').value.trim() });
    state.events = await Store.listEvents(); closeModal(); renderCalendar(); renderUpcoming(); toast('Event added 📅'); });
}
function renderTodos() {
  $$('.todo-filter').forEach(b => b.classList.toggle('active', b.dataset.tfilter === state.todoFilter));
  const done = state.todos.filter(t => t.completed).length;
  $('#todoProgress').textContent = state.todos.length ? `${done}/${state.todos.length} done` : 'No tasks yet';
  $('#todoBar').style.width = state.todos.length ? (done / state.todos.length * 100) + '%' : '0%';
  const rows = state.todos.filter(t => state.todoFilter === 'all' || (state.todoFilter === 'done' ? t.completed : !t.completed));
  const today = dateKey(new Date());
  $('#todoList').innerHTML = rows.length ? rows.map(t => {
    const overdue = !t.completed && t.due_date && t.due_date < today;
    return `<div class="flex items-start gap-3 rounded-xl border border-slate-100 dark:border-white/[.07] px-3.5 py-3 ${t.completed ? 'opacity-60' : ''} animate-fade-up">
      <input type="checkbox" class="todo-check mt-0.5" data-toggletodo="${t.id}" ${t.completed ? 'checked' : ''}/>
      <div class="flex-1 min-w-0"><p class="font-semibold text-sm leading-snug ${t.completed ? 'line-through' : ''}">${esc(t.task)}</p>
      <div class="flex flex-wrap gap-1.5 mt-1.5">${priorityChip(t.priority)}
      ${t.due_date ? `<span class="chip ${overdue ? 'bg-rose-100 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400' : 'bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-300'}"><i class="fa-regular fa-calendar"></i>${overdue ? 'Overdue · ' : ''}${fmtDate(t.due_date)}</span>` : ''}</div></div>
      <button class="text-slate-300 hover:text-rose-500 p-1" data-deltodo="${t.id}"><i class="fa-solid fa-trash text-sm"></i></button></div>`;
  }).join('') : `<div class="text-center py-8"><p class="text-3xl">🎉</p><p class="font-bold mt-2 text-sm">All clear!</p><p class="text-[13px] text-slate-400">No tasks in this list. Add one above.</p></div>`;
  $$('#todoList [data-toggletodo]').forEach(c => c.onchange = guard(async () => { await Store.toggleTodo(c.dataset.toggletodo, c.checked); const t = state.todos.find(x => x.id === c.dataset.toggletodo); t.completed = c.checked; renderTodos(); renderCalendar(); renderUpcoming(); if (c.checked) toast('Task done. Keep going! 💪'); }));
  $$('#todoList [data-deltodo]').forEach(b => b.onclick = guard(async () => { await Store.deleteTodo(b.dataset.deltodo); state.todos = state.todos.filter(t => t.id !== b.dataset.deltodo); renderTodos(); renderCalendar(); renderUpcoming(); }));
}
async function handleAddTodo(e) {
  e.preventDefault();
  const task = $('#todoInput').value.trim(); if (!task) return;
  try {
    await Store.createTodo({ task, due_date: $('#todoDue').value || null, priority: $('#todoPriority').value });
    $('#todoInput').value = ''; $('#todoDue').value = '';
    state.todos = await Store.listTodos(); renderTodos(); renderCalendar(); renderUpcoming(); toast('Task added.');
  } catch (err) { toast(err.message, 'error'); }
}

/* ── 15. PROFILE ──────────────────────────────────────────────────────────── */
async function loadProfile() {
  const u = state.user;
  const [myPosts, myRes, myRoads] = await Promise.all([Store.listTeamPosts(), Store.listResources('mine'), Store.listRoadmaps('mine')]);
  const cPosts = myPosts.filter(p => p.user_id === u.id).length, cRes = myRes.filter(r => (r.status || 'approved') === 'approved').length;
  const input = (label, id, val, ph = '', extra = '') => `<div><label class="text-sm font-bold">${label}</label><input id="${id}" class="field mt-1.5" value="${esc(val || '')}" placeholder="${esc(ph)}" ${extra}/></div>`;
  const yOpts = ['1st Year', '2nd Year', '3rd Year', '4th Year', 'PG / Alumni', 'Faculty'].map(y => `<option ${u.academic_year === y ? 'selected' : ''}>${y}</option>`).join('');
  const bOpts = ['CSE', 'IT', 'ECE', 'EEE', 'ME', 'CE', 'AI/DS', 'Other'].map(y => `<option ${u.branch === y ? 'selected' : ''}>${y}</option>`).join('');
  const cOpts = ['B.Tech', 'M.Tech', 'BCA', 'MCA', 'B.Sc', 'MBA', 'Faculty', 'Other'].map(y => `<option ${u.course === y ? 'selected' : ''}>${y}</option>`).join('');
  $('#profileWrap').innerHTML = `
  <div class="grid lg:grid-cols-3 gap-5 items-start">
    <div class="card overflow-hidden">
      <div class="h-24" style="background:linear-gradient(120deg,#4f46e5,#9333ea,#db2777)"></div>
      <div class="px-6 pb-6 text-center">
        <div class="flex justify-center -mt-10"><div class="ring-4 ring-white dark:ring-ink-850 rounded-full">${avatarHTML(u, 'w-20 h-20 text-2xl')}</div></div>
        <h3 class="font-black text-xl mt-3">${esc(u.full_name)}</h3><p class="text-sm text-slate-400">${esc(u.email)}</p>
        <div class="flex justify-center gap-2 mt-3 flex-wrap">${roleChip(u.role)}<span class="chip bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-300">@${esc(u.college_domain || domainOf(u.email))} server</span></div>
        ${u.bio ? `<p class="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mt-4">${esc(u.bio)}</p>` : '<p class="text-sm text-slate-400 mt-4 italic">Add a bio so teammates can find you.</p>'}
        ${(safeUrl(u.website_url) || safeUrl(u.github_url) || safeUrl(u.linkedin_url)) ? `<div class="flex justify-center gap-2 mt-4 flex-wrap">
          ${safeUrl(u.website_url) ? `<a href="${esc(safeUrl(u.website_url))}" target="_blank" rel="noopener" class="chip !py-1.5 !px-3 bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-300 hover:scale-105 transition"><i class="fa-solid fa-globe"></i>${esc(prettyHost(u.website_url))}</a>` : ''}
          ${safeUrl(u.github_url) ? `<a href="${esc(safeUrl(u.github_url))}" target="_blank" rel="noopener" class="chip !py-1.5 !px-3 bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-200 hover:scale-105 transition"><i class="fa-brands fa-github"></i>GitHub</a>` : ''}
          ${safeUrl(u.linkedin_url) ? `<a href="${esc(safeUrl(u.linkedin_url))}" target="_blank" rel="noopener" class="chip !py-1.5 !px-3 bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-200 hover:scale-105 transition"><i class="fa-brands fa-linkedin"></i>LinkedIn</a>` : ''}
        </div>` : ''}
        <div class="grid grid-cols-3 gap-2 mt-5">
          <div class="rounded-xl bg-slate-50 dark:bg-white/[.05] py-3"><p class="font-black text-lg leading-none">${cPosts}</p><p class="text-[11px] font-bold text-slate-400 mt-1">TEAM POSTS</p></div>
          <div class="rounded-xl bg-slate-50 dark:bg-white/[.05] py-3"><p class="font-black text-lg leading-none">${cRes}</p><p class="text-[11px] font-bold text-slate-400 mt-1">RESOURCES</p></div>
          <div class="rounded-xl bg-slate-50 dark:bg-white/[.05] py-3"><p class="font-black text-lg leading-none">${myRoads.filter(r => r.status === 'approved').length}</p><p class="text-[11px] font-bold text-slate-400 mt-1">ROADMAPS ✓</p></div>
        </div>
        <p class="text-xs text-slate-400 mt-4">Member since ${fmtDate(String(u.created_at).slice(0, 10))}</p>
      </div></div>
    <div class="lg:col-span-2 card p-6">
      <h4 class="font-black text-lg"><i class="fa-solid fa-pen text-brand-500 mr-2"></i>Edit profile</h4>
      <form id="profileForm" class="grid sm:grid-cols-2 gap-4 mt-4">
        ${input('Full name', 'pfName', u.full_name)}
        ${input('College email', 'pfEmail', u.email, '', 'disabled title="Email is your login identity"')}
        <div><label class="text-sm font-bold">Academic year</label><select id="pfYear" class="field mt-1.5">${yOpts}</select></div>
        <div><label class="text-sm font-bold">Branch / Major</label><select id="pfBranch" class="field mt-1.5">${bOpts}</select></div>
        <div><label class="text-sm font-bold">Course</label><select id="pfCourse" class="field mt-1.5">${cOpts}</select></div>
        ${input('Avatar image URL (optional)', 'pfAvatar', u.avatar_url, 'https://…')}
        ${input('GitHub URL', 'pfGithub', u.github_url, 'https://github.com/username')}
        ${input('LinkedIn URL', 'pfLinkedin', u.linkedin_url, 'https://linkedin.com/in/username')}
        <div class="sm:col-span-2"><label class="text-sm font-bold">Custom website / portfolio link</label><div class="relative mt-1.5"><i class="fa-solid fa-globe absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i><input id="pfWebsite" class="field !pl-10" value="${esc(u.website_url || '')}" placeholder="https://your-portfolio.dev"/></div><p class="text-xs text-slate-400 mt-1.5">Shown publicly on your profile card — portfolio, personal site, blog, anything you like.</p></div>
        <div class="sm:col-span-2"><label class="text-sm font-bold">Skills <span class="text-slate-400 font-medium">(comma separated)</span></label><input id="pfSkills" class="field mt-1.5" value="${esc((u.skills || []).join(', '))}" placeholder="React, Python, UI/UX"/></div>
        <div class="sm:col-span-2"><label class="text-sm font-bold">Bio</label><textarea id="pfBio" rows="3" class="field mt-1.5" maxlength="300" placeholder="A line or two about you…">${esc(u.bio || '')}</textarea></div>
        <div class="sm:col-span-2 flex flex-wrap gap-2"><button class="grad-btn px-6 py-3 rounded-xl font-bold" id="pfSave">Save changes</button>
        <button type="button" id="pfPreview" class="px-5 py-3 rounded-xl font-bold bg-slate-100 dark:bg-white/10">Preview public card</button></div>
      </form>
      <div class="mt-7 pt-5 border-t border-slate-100 dark:border-white/[.08]">
        <h4 class="font-black"><i class="fa-solid fa-key text-amber-500 mr-2"></i>Change password</h4>
        <form id="pwForm" class="flex flex-wrap gap-2 mt-3"><input id="pfNewPw" type="password" class="field !w-auto flex-1 min-w-[220px]" placeholder="New password (min 6 characters)"/>
        <button class="px-5 py-2.5 rounded-xl font-bold bg-slate-900 dark:bg-white text-white dark:text-slate-900">Update password</button></form>
      </div></div></div>`;
  $('#profileForm').onsubmit = guard(async (e) => { e.preventDefault(); setBusy($('#pfSave'), true, 'Save changes');
    const patch = { full_name: $('#pfName').value.trim(), academic_year: $('#pfYear').value, branch: $('#pfBranch').value, course: $('#pfCourse').value,
      avatar_url: $('#pfAvatar').value.trim(), github_url: safeUrl($('#pfGithub').value), linkedin_url: safeUrl($('#pfLinkedin').value), website_url: safeUrl($('#pfWebsite').value),
      skills: parseTags($('#pfSkills').value), bio: $('#pfBio').value.trim() };
    if (patch.full_name.length < 2) throw new Error('Name looks too short.');
    Object.assign(state.user, await Store.updateProfile(state.user.id, patch));
    $('#sidebarName').textContent = state.user.full_name; $('#sidebarMeta').textContent = `${state.user.branch} · ${state.user.academic_year}`;
    $('#sidebarAvatar') && ($('#sidebarAvatar').outerHTML = avatarHTML(state.user, 'w-10 h-10 text-sm').replace('class="', 'id="sidebarAvatar" class="'));
    $('#topProfileBtn').innerHTML = avatarHTML(state.user, 'w-10 h-10 text-sm');
    toast('Profile saved!'); loadProfile(); });
  $('#pfPreview').onclick = () => { state.users = state.users.filter(x => x.id !== state.user.id); state.users.push({ ...state.user }); openUserCard(state.user.id); };
  $('#pwForm').onsubmit = guard(async (e) => { e.preventDefault(); const pw = $('#pfNewPw').value; if (pw.length < 6) throw new Error('Password must be at least 6 characters.'); await Store.changePassword(pw); $('#pfNewPw').value = ''; toast('Password updated.'); });
}

/* ── 16. ADMIN PORTAL ─────────────────────────────────────────────────────── */
async function loadAdmin() {
  if (!isStaff()) return;
  const [all, reps, users, chans, anns, msgs, resAll] = await Promise.all([
    Store.listRoadmaps('all'), Store.listReports(), Store.listProfiles(), Store.listChannels(), Store.listAnnouncements(), Store.totalMessages().catch(() => 0), Store.listResources('all')]);
  Object.assign(state, { roadmapsAll: all, reports: reps, users, channels: chans, announcements: anns, resourcesAll: resAll });
  const stat = (icon, color, big, label) => `<div class="card p-4"><div class="w-10 h-10 rounded-xl flex items-center justify-center ${color}"><i class="fa-solid ${icon}"></i></div>
    <p class="font-black text-2xl mt-2.5 leading-none">${big}</p><p class="text-[13px] text-slate-400 font-semibold mt-1">${label}</p></div>`;
  $('#adminStats').innerHTML =
    stat('fa-users', 'bg-brand-100 dark:bg-brand-500/15 text-brand-600 dark:text-brand-300', users.length, 'Registered users') +
    stat('fa-comments', 'bg-sky-100 dark:bg-sky-500/15 text-sky-600 dark:text-sky-400', msgs, 'Total messages') +
    stat('fa-map', 'bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400', all.filter(r => r.status === 'pending').length, 'Roadmaps awaiting review') +
    stat('fa-folder-open', 'bg-violet-100 dark:bg-violet-500/15 text-violet-600 dark:text-violet-400', resAll.filter(r => (r.status || 'approved') === 'pending').length, 'Resources awaiting review') +
    stat('fa-flag', 'bg-rose-100 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400', reps.filter(r => r.status === 'pending').length, 'Open reports');
  renderAdminPanel(); refreshStaffBadges();
}
function renderAdminPanel() {
  $$('.admin-tab').forEach(b => b.classList.toggle('active', b.dataset.atab === state.adminTab));
  ({ roadmaps: renderAdminRoadmaps, reports: renderAdminReports, resources: renderAdminResources, users: renderAdminUsers, channels: renderAdminChannels, announcements: renderAdminAnnouncements }[state.adminTab] || (() => {}))();
}
function renderAdminRoadmaps() {
  const pend = state.roadmapsAll.filter(r => r.status === 'pending');
  const decided = state.roadmapsAll.filter(r => r.status !== 'pending');
  const row = (r, withActions) => `<div class="card p-5 flex flex-col sm:flex-row gap-4 animate-fade-up">
    <div class="flex-1 min-w-0"><div class="flex flex-wrap gap-1.5"><span class="chip bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-300">${esc(r.category || 'General')}</span>${statusChip(r.status)}</div>
    <h4 class="font-black mt-2 leading-snug">${esc(r.title)}</h4>
    <p class="text-[13px] text-slate-400 mt-1">by ${esc(r.author?.full_name || '')} (${esc(r.author?.email || '')}) · ${timeAgo(r.created_at)}</p>
    <p class="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mt-2 line-clamp-2">${esc(r.content.replace(/[#>*`]/g, '').slice(0, 220))}</p>
    ${r.admin_note ? `<p class="text-[13px] mt-2"><b>Admin note:</b> ${esc(r.admin_note)}</p>` : ''}</div>
    <div class="flex sm:flex-col gap-2 flex-none">
      <button class="px-4 py-2.5 rounded-xl font-bold text-sm bg-slate-100 dark:bg-white/10 flex-1" data-adread="${r.id}"><i class="fa-solid fa-book-open mr-1"></i>Read full</button>
      ${withActions ? (isAdmin() ? `<button class="px-4 py-2.5 rounded-xl font-bold text-sm bg-emerald-500 hover:bg-emerald-600 text-white flex-1" data-adapprove="${r.id}"><i class="fa-solid fa-check mr-1"></i>Approve</button>
      <button class="px-4 py-2.5 rounded-xl font-bold text-sm bg-rose-500 hover:bg-rose-600 text-white flex-1" data-adreject="${r.id}"><i class="fa-solid fa-xmark mr-1"></i>Reject</button>`
        : '<span class="text-xs font-bold text-slate-400 px-2">Only admins can approve</span>')

      : `<button class="px-4 py-2.5 rounded-xl font-bold text-sm bg-rose-50 dark:bg-rose-500/10 text-rose-500 flex-1" data-addel="${r.id}"><i class="fa-solid fa-trash mr-1"></i>Delete</button>`}
    </div></div>`;
  $('#adminPanel').innerHTML = `<h4 class="font-black text-lg mb-3">Awaiting review (${pend.length})</h4>
    <div class="space-y-3">${pend.length ? pend.map(r => row(r, true)).join('') : emptyState('fa-circle-check', 'Queue is empty', 'Every submitted roadmap has been reviewed.')}</div>
    <h4 class="font-black text-lg mt-7 mb-3">Previously reviewed (${decided.length})</h4>
    <div class="space-y-3">${decided.length ? decided.map(r => row(r, false)).join('') : '<p class="text-sm text-slate-400">Nothing here yet.</p>'}</div>`;
  $$('#adminPanel [data-adread]').forEach(b => b.onclick = () => openRoadmapReader(state.roadmapsAll.find(r => r.id === b.dataset.adread)));
  $$('#adminPanel [data-adapprove]').forEach(b => b.onclick = () => reviewRoadmapUI(b.dataset.adapprove, 'approved'));
  $$('#adminPanel [data-adreject]').forEach(b => b.onclick = () => reviewRoadmapUI(b.dataset.adreject, 'rejected'));
  $$('#adminPanel [data-addel]').forEach(b => b.onclick = guard(async () => { if (await confirmDialog('Delete this roadmap permanently?', '')) { await Store.deleteRoadmap(b.dataset.addel); toast('Roadmap deleted.'); loadAdmin(); } }));
}
function reviewRoadmapUI(id, status) {
  const r = state.roadmapsAll.find(x => x.id === id);
  openModal(`<h3 class="font-black text-xl pr-8">${status === 'approved' ? '✅ Approve roadmap' : '⛔ Reject roadmap'}</h3>
    <p class="font-bold mt-2">${esc(r.title)}</p>
    <p class="text-sm text-slate-400 mt-1 leading-relaxed">${status === 'approved' ? 'It becomes visible to every student immediately.' : 'It stays hidden. The author sees your feedback under "My submissions".'}</p>
    <form id="revForm" class="mt-4 space-y-3">
      <div><label class="text-sm font-bold">Note for the author ${status === 'rejected' ? '(recommended)' : '(optional)'}</label><textarea id="revNote" rows="3" class="field mt-1.5" placeholder="${status === 'rejected' ? 'e.g. Great start — please add timelines and resource links, then resubmit.' : 'e.g. Excellent guide!'}"></textarea></div>
      <button class="w-full py-3 rounded-xl font-bold text-white ${status === 'approved' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-rose-500 hover:bg-rose-600'}" id="revSubmit">${status === 'approved' ? 'Approve & publish' : 'Reject roadmap'}</button></form>`, 'max-w-md');
  $('#revForm').onsubmit = guard(async (e) => { e.preventDefault(); setBusy($('#revSubmit'), true);
    await Store.reviewRoadmap(id, status, $('#revNote').value.trim()); closeModal();
    toast(status === 'approved' ? 'Roadmap approved & published! 🎉' : 'Roadmap rejected with feedback.'); loadAdmin(); });
}
function renderAdminResources() {
  const pend = state.resourcesAll.filter(r => (r.status || 'approved') === 'pending');
  const decided = state.resourcesAll.filter(r => (r.status || 'approved') !== 'pending');
  const row = (r, withActions) => { const [icon, cls] = fileIcon(r.file_name || r.title); return `<div class="card p-5 flex flex-col sm:flex-row gap-4 animate-fade-up">
    <div class="w-12 h-12 rounded-2xl flex items-center justify-center text-xl flex-none ${cls}"><i class="fa-solid ${icon}"></i></div>
    <div class="flex-1 min-w-0"><div class="flex flex-wrap gap-1.5"><span class="chip bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-300">${esc(r.category)}</span>${r.subject ? `<span class="chip bg-slate-100 dark:bg-white/[.08] text-slate-600 dark:text-slate-200">${esc(r.subject)}</span>` : ''}${statusChip(r.status || 'approved')}</div>
    <h4 class="font-black mt-2 leading-snug">${esc(r.title)}</h4>
    <p class="text-[13px] text-slate-400 mt-1">by ${esc(r.author?.full_name || '')} (${esc(r.author?.email || '')}) · ${timeAgo(r.created_at)} · <i class="fa-solid fa-arrow-up"></i> ${r.upvotes} · <i class="fa-solid fa-download"></i> ${r.downloads}</p>
    <p class="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mt-2">${esc(r.description || '')}</p>
    <p class="text-xs text-slate-400 mt-1.5 font-mono truncate">${esc(r.file_name || 'External link')}</p>
    ${r.admin_note ? `<p class="text-[13px] mt-2"><b>Admin note:</b> ${esc(r.admin_note)}</p>` : ''}</div>
    <div class="flex sm:flex-col gap-2 flex-none">
      ${r.file_url ? `<a href="${esc(r.file_url)}" target="_blank" rel="noopener" class="px-4 py-2.5 rounded-xl font-bold text-sm bg-slate-100 dark:bg-white/10 flex-1 text-center"><i class="fa-solid fa-eye mr-1"></i>Open file</a>` : ''}
      ${withActions ? (isAdmin() ? `<button class="px-4 py-2.5 rounded-xl font-bold text-sm bg-emerald-500 hover:bg-emerald-600 text-white flex-1" data-resapprove="${r.id}"><i class="fa-solid fa-check mr-1"></i>Approve & publish</button>
      <button class="px-4 py-2.5 rounded-xl font-bold text-sm bg-rose-500 hover:bg-rose-600 text-white flex-1" data-resreject="${r.id}"><i class="fa-solid fa-xmark mr-1"></i>Reject</button>`
        : '<span class="text-xs font-bold text-slate-400 px-2">Only admins can publish</span>') : ''}
      <button class="px-4 py-2.5 rounded-xl font-bold text-sm bg-rose-50 dark:bg-rose-500/10 text-rose-500 flex-1" data-resdel="${r.id}"><i class="fa-solid fa-trash mr-1"></i>Delete</button>
    </div></div>`; };
  $('#adminPanel').innerHTML = `<h4 class="font-black text-lg mb-3">Awaiting review (${pend.length})</h4>
    <div class="space-y-3">${pend.length ? pend.map(r => row(r, true)).join('') : emptyState('fa-circle-check', 'No uploads waiting', 'Every submitted resource has been reviewed.')}</div>
    <h4 class="font-black text-lg mt-7 mb-3">Published / reviewed (${decided.length})</h4>
    <div class="space-y-3">${decided.length ? decided.map(r => row(r, false)).join('') : '<p class="text-sm text-slate-400">Nothing here yet.</p>'}</div>`;
  $$('#adminPanel [data-resapprove]').forEach(b => b.onclick = () => reviewResourceUI(b.dataset.resapprove, 'approved'));
  $$('#adminPanel [data-resreject]').forEach(b => b.onclick = () => reviewResourceUI(b.dataset.resreject, 'rejected'));
  $$('#adminPanel [data-resdel]').forEach(b => b.onclick = guard(async () => { if (await confirmDialog('Delete this resource permanently?', 'The file will be removed from storage and the hub.')) { await Store.deleteResource(b.dataset.resdel); toast('Resource deleted.'); loadAdmin(); } }));
}
function reviewResourceUI(id, status) {
  const r = state.resourcesAll.find(x => x.id === id);
  openModal(`<h3 class="font-black text-xl pr-8">${status === 'approved' ? '✅ Approve & publish resource' : '⛔ Reject resource'}</h3>
    <p class="font-bold mt-2">${esc(r.title)}</p>
    <p class="text-sm text-slate-400 mt-1 leading-relaxed">${status === 'approved' ? 'It becomes visible to every student in the Resource Hub immediately.' : 'It stays hidden from the hub. The uploader sees your feedback under "My uploads".'}</p>
    <form id="revResForm" class="mt-4 space-y-3">
      <div><label class="text-sm font-bold">Note for the uploader ${status === 'rejected' ? '(recommended)' : '(optional)'}</label><textarea id="revResNote" rows="3" class="field mt-1.5" placeholder="${status === 'rejected' ? 'e.g. File is corrupted / wrong subject — please re-upload a clearer scan.' : 'e.g. Great notes, thanks for sharing!'}"></textarea></div>
      <button class="w-full py-3 rounded-xl font-bold text-white ${status === 'approved' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-rose-500 hover:bg-rose-600'}" id="revResSubmit">${status === 'approved' ? 'Approve & publish' : 'Reject resource'}</button></form>`, 'max-w-md');
  $('#revResForm').onsubmit = guard(async (e) => { e.preventDefault(); setBusy($('#revResSubmit'), true);
    await Store.reviewResource(id, status, $('#revResNote').value.trim()); closeModal();
    toast(status === 'approved' ? 'Resource published to the hub! 🎉' : 'Resource rejected with feedback.'); loadAdmin(); });
}
function renderAdminReports() {
  const pend = state.reports.filter(r => r.status === 'pending'), done = state.reports.filter(r => r.status !== 'pending');
  const row = (r) => `<div class="card p-5 animate-fade-up">
    <div class="flex flex-wrap items-center gap-2"><span class="chip bg-rose-50 dark:bg-rose-500/10 text-rose-500"><i class="fa-solid fa-flag"></i>${esc(r.reason)}</span>
    <span class="chip bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-300 capitalize">Target: ${esc(r.target_type)}</span>${statusChip(r.status)}
    <span class="text-xs text-slate-400 ml-auto">${timeAgo(r.created_at)}</span></div>
    <p class="text-sm mt-3"><b>Reported by:</b> ${esc(r.reporter?.full_name || r.author?.full_name || 'Unknown')} <span class="text-slate-400">(${esc(r.reporter?.email || '')})</span></p>
    ${r.details ? `<p class="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">"${esc(r.details)}"</p>` : ''}
    <div class="flex flex-wrap gap-2 mt-4">
      ${r.target_type === 'message' ? `<button class="px-3.5 py-2 rounded-lg font-bold text-[13px] bg-slate-100 dark:bg-white/10" data-viewmsg="${esc(r.target_id)}"><i class="fa-solid fa-eye mr-1"></i>View message</button>
      <button class="px-3.5 py-2 rounded-lg font-bold text-[13px] bg-rose-500 text-white" data-delmsg="${esc(r.target_id)}" data-repid="${r.id}"><i class="fa-solid fa-trash mr-1"></i>Delete message & resolve</button>` : ''}
      ${r.target_type === 'user' ? `<button class="px-3.5 py-2 rounded-lg font-bold text-[13px] bg-slate-100 dark:bg-white/10" data-viewuser="${esc(r.target_id)}"><i class="fa-solid fa-user mr-1"></i>View user</button>` : ''}
      ${r.status === 'pending' ? `<button class="px-3.5 py-2 rounded-lg font-bold text-[13px] bg-emerald-500 text-white" data-resolve="${r.id}">Mark resolved</button>
      <button class="px-3.5 py-2 rounded-lg font-bold text-[13px] bg-slate-200 dark:bg-white/10" data-dismiss="${r.id}">Dismiss</button>` : ''}
    </div></div>`;
  $('#adminPanel').innerHTML = `<h4 class="font-black text-lg mb-3">Open reports (${pend.length})</h4>
    <div class="space-y-3">${pend.length ? pend.map(row).join('') : emptyState('fa-shield-heart', 'No open reports', 'The campus is behaving. 🎉')}</div>
    ${done.length ? `<h4 class="font-black text-lg mt-7 mb-3">Handled (${done.length})</h4><div class="space-y-3">${done.map(row).join('')}</div>` : ''}`;
  $$('#adminPanel [data-resolve]').forEach(b => b.onclick = guard(async () => { await Store.updateReport(b.dataset.resolve, 'resolved'); toast('Report resolved.'); loadAdmin(); }));
  $$('#adminPanel [data-dismiss]').forEach(b => b.onclick = guard(async () => { await Store.updateReport(b.dataset.dismiss, 'dismissed'); toast('Report dismissed.'); loadAdmin(); }));
  $$('#adminPanel [data-viewmsg]').forEach(b => b.onclick = guard(async () => { const m = await Store.getMessage(b.dataset.viewmsg);
    openModal(m ? `<h3 class="font-black text-lg pr-8">Reported message</h3><div class="flex gap-3 mt-4">${avatarHTML(m.author)}<div><p class="font-bold text-sm">${esc(m.author?.full_name || '')}</p><p class="text-xs text-slate-400">${fmtTime(m.created_at)} · ${timeAgo(m.created_at)}</p><p class="mt-2 leading-relaxed">${linkify(m.content)}</p></div></div>` : '<h3 class="font-black text-lg">Message no longer exists</h3><p class="text-sm text-slate-400 mt-2">It was already deleted. You can resolve this report.</p>', 'max-w-md'); }));
  $$('#adminPanel [data-delmsg]').forEach(b => b.onclick = guard(async () => { await Store.deleteMessage(b.dataset.delmsg).catch(() => {}); await Store.updateReport(b.dataset.repid, 'resolved'); toast('Message deleted & report resolved.'); loadAdmin(); }));
  $$('#adminPanel [data-viewuser]').forEach(b => b.onclick = () => openUserCard(b.dataset.viewuser));
}
function renderAdminUsers() {
  $('#adminPanel').innerHTML = `<div class="relative mb-4 max-w-md"><i class="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i><input id="userSearch" class="field !pl-10" placeholder="Search users by name, email, branch…"/></div>
  <div class="card overflow-hidden"><div class="overflow-x-auto"><table class="w-full text-sm min-w-[720px]">
    <thead><tr class="text-left text-[11px] tracking-widest text-slate-400 border-b border-slate-100 dark:border-white/[.08]">
      <th class="px-5 py-3.5">USER</th><th class="px-3">BRANCH · YEAR</th><th class="px-3">JOINED</th><th class="px-3">ROLE</th><th class="px-5 text-right">ACTIONS</th></tr></thead>
    <tbody id="userRows"></tbody></table></div></div>
  ${!isAdmin() ? '<p class="text-sm text-amber-600 dark:text-amber-400 font-semibold mt-3"><i class="fa-solid fa-lock mr-1"></i>Moderators can view users; only admins can change roles or suspend accounts.</p>' : ''}`;
  const draw = () => {
    const q = $('#userSearch').value.trim().toLowerCase();
    const rows = state.users.filter(u => !q || (u.full_name + u.email + (u.branch || '')).toLowerCase().includes(q));
    $('#userRows').innerHTML = rows.map(u => `<tr class="border-b border-slate-50 dark:border-white/[.05] hover:bg-slate-50/70 dark:hover:bg-white/[.03]">
      <td class="px-5 py-3"><div class="flex items-center gap-3">${avatarHTML(u, 'w-9 h-9 text-xs')}<div><p class="font-bold">${esc(u.full_name)} ${u.is_banned ? '<span class="chip bg-rose-100 dark:bg-rose-500/15 text-rose-500 ml-1">Suspended</span>' : ''}</p><p class="text-xs text-slate-400">${esc(u.email)}</p></div></div></td>
      <td class="px-3 font-medium text-slate-500 dark:text-slate-300">${esc(u.branch || '—')} · ${esc(u.academic_year || '—')}</td>
      <td class="px-3 text-slate-400">${fmtDate(String(u.created_at).slice(0, 10))}</td>
      <td class="px-3">${isAdmin() && u.id !== state.user.id
        ? `<select class="field !w-auto !py-1.5 !px-2.5 !text-[13px] font-bold" data-role="${u.id}">${['student', 'moderator', 'admin'].map(r => `<option ${u.role === r ? 'selected' : ''}>${r}</option>`).join('')}</select>`
        : roleChip(u.role)}</td>
      <td class="px-5 text-right whitespace-nowrap"><button class="px-3 py-2 rounded-lg font-bold text-[13px] bg-slate-100 dark:bg-white/10" data-card="${u.id}">Profile</button>
      ${isAdmin() && u.id !== state.user.id ? `<button class="px-3 py-2 rounded-lg font-bold text-[13px] ${u.is_banned ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-500/10 text-rose-500'} ml-1.5" data-ban="${u.id}">${u.is_banned ? 'Unsuspend' : 'Suspend'}</button>` : ''}</td></tr>`).join('')
      || '<tr><td colspan="5" class="px-5 py-8 text-center text-slate-400">No users match.</td></tr>';
    $$('#userRows [data-card]').forEach(b => b.onclick = () => openUserCard(b.dataset.card));
    $$('#userRows [data-role]').forEach(s => s.onchange = guard(async () => { await Store.setRole(s.dataset.role, s.value); toast(`Role updated to "${s.value}".`); loadAdmin(); }));
    $$('#userRows [data-ban]').forEach(b => b.onclick = guard(async () => { const u = state.users.find(x => x.id === b.dataset.ban);
      if (await confirmDialog(u.is_banned ? `Unsuspend ${u.full_name}?` : `Suspend ${u.full_name}?`, u.is_banned ? 'They will be able to log in again.' : 'They will immediately lose access to the portal.', u.is_banned ? 'Unsuspend' : 'Suspend user')) { await Store.setBan(u.id, !u.is_banned); toast(u.is_banned ? 'User unsuspended.' : 'User suspended.'); loadAdmin(); } }));
  };
  $('#userSearch').oninput = draw; draw();
}
function renderAdminChannels() {
  $('#adminPanel').innerHTML = `<div class="flex items-center justify-between mb-4"><h4 class="font-black text-lg">Chat channels (${state.channels.length})</h4>
    ${isAdmin() ? '<button id="adNewChannel" class="grad-btn font-bold text-sm px-4 py-2.5 rounded-xl"><i class="fa-solid fa-plus mr-1.5"></i>New channel</button>' : '<span class="text-sm font-semibold text-slate-400">Only admins manage channels</span>'}</div>
    <div class="grid sm:grid-cols-2 gap-3">${state.channels.map(c => `<div class="card p-5 flex items-center gap-3">
      <span class="text-2xl font-black text-brand-400">#</span><div class="flex-1 min-w-0"><p class="font-black truncate">${esc(c.name)}</p><p class="text-[13px] text-slate-400 truncate">${esc(c.description || 'No description')}</p></div>
      <button class="px-3.5 py-2 rounded-lg font-bold text-[13px] bg-slate-100 dark:bg-white/10" data-opench="${c.id}">Open</button>
      ${isAdmin() ? `<button class="px-3.5 py-2 rounded-lg font-bold text-[13px] bg-rose-50 dark:bg-rose-500/10 text-rose-500" data-delch="${c.id}"><i class="fa-solid fa-trash"></i></button>` : ''}</div>`).join('') || emptyState('fa-hashtag', 'No channels yet', 'Create the first channel for your campus.')}</div>`;
  const nb = $('#adNewChannel'); if (nb) nb.onclick = openChannelModal;
  $$('#adminPanel [data-opench]').forEach(b => b.onclick = () => { state.activeChannelId = b.dataset.opench; switchView('chat'); });
  $$('#adminPanel [data-delch]').forEach(b => b.onclick = guard(async () => { const c = state.channels.find(x => x.id === b.dataset.delch); if (await confirmDialog(`Delete #${c.name}?`, 'The channel and all its messages will be permanently deleted.')) { await Store.deleteChannel(c.id); toast('Channel deleted.'); loadAdmin(); } }));
}
function renderAdminAnnouncements() {
  $('#adminPanel').innerHTML = `<div class="flex items-center justify-between mb-4"><h4 class="font-black text-lg">Announcements (${state.announcements.length})</h4>
    <button id="adNewAnn" class="grad-btn font-bold text-sm px-4 py-2.5 rounded-xl"><i class="fa-solid fa-bullhorn mr-1.5"></i>New broadcast</button></div>
    <div class="space-y-3">${state.announcements.map(a => `<div class="card p-5 flex gap-4"><div class="flex-1 min-w-0">
      <p class="font-black leading-snug">${esc(a.title)} ${a.is_pinned ? '<span class="chip bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 ml-1">Pinned</span>' : ''}</p>
      <p class="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed line-clamp-2">${esc(a.content)}</p>
      <p class="text-xs text-slate-400 mt-2">by ${esc(a.author?.full_name || '')} · ${timeAgo(a.created_at)}${a.event_date ? ' · Event: ' + fmtDate(String(a.event_date).slice(0, 10)) : ''}</p></div>
      <button class="px-3.5 py-2 rounded-lg font-bold text-[13px] bg-rose-50 dark:bg-rose-500/10 text-rose-500 flex-none self-start" data-delann="${a.id}"><i class="fa-solid fa-trash"></i></button></div>`).join('')
      || emptyState('fa-bullhorn', 'No announcements yet', 'Broadcast your first campus update.')}</div>`;
  $('#adNewAnn').onclick = openAnnouncementModal;
  $$('#adminPanel [data-delann]').forEach(b => b.onclick = guard(async () => { if (await confirmDialog('Delete this announcement?', '')) { await Store.deleteAnnouncement(b.dataset.delann); toast('Announcement deleted.'); loadAdmin(); } }));
}

/* ── 17. DIRECT MESSAGES (1-to-1) ─────────────────────────────────────────── */
async function refreshDMBadge() {
  if (!state.user) return;
  try {
    const n = await Store.unreadDMCount();
    const b = $('#dmBadge'); if (b) { b.textContent = n; b.classList.toggle('hidden', n === 0); }
  } catch { /* non-critical */ }
}
async function onIncomingDM() {
  if (!state.user) return;
  try {
    state.conversations = await Store.listConversations();
    if (state.view === 'messages') {
      renderConversationList();
      if (state.activeDMUser) {
        const fresh = await Store.listDirectMessages(state.activeDMUser.id);
        const isNew = fresh.length !== state.dmMessages.length;
        state.dmMessages = fresh; renderDMChat(false);
        if (isNew) { await Store.markConversationRead(state.activeDMUser.id); state.conversations = await Store.listConversations(); renderConversationList(); }
      }
    } else {
      const top = state.conversations.find(c => c.unread > 0);
      if (top && top.lastMessage && top.lastMessage.id !== state._lastDMNotified) {
        state._lastDMNotified = top.lastMessage.id;
        toast('New message from ' + (top.user?.full_name || 'someone') + ' — open Messages to reply.', 'info');
      }
    }
  } catch { /* realtime is best-effort */ }
  refreshDMBadge();
}
async function loadDMs() {
  state.conversations = await Store.listConversations();
  renderConversationList();
  if (state.pendingDM) { const { userId, draft } = state.pendingDM; state.pendingDM = null; await selectConversation(userId, draft); return; }
  if (state.activeDMUser) { state.dmMessages = await Store.listDirectMessages(state.activeDMUser.id); renderDMChat(true); }
  else dmSetChatVisible(false);
  refreshDMBadge();
}
function dmSetChatVisible(visible) {
  $('#dmChatHeader').classList.toggle('hidden', !visible); $('#dmChatHeader').classList.toggle('flex', visible);
  $('#dmMessageList').classList.toggle('hidden', !visible);
  $('#dmMessageForm').classList.toggle('hidden', !visible); $('#dmMessageForm').classList.toggle('flex', visible);
  $('#dmEmptyState').classList.toggle('hidden', visible); $('#dmEmptyState').classList.toggle('flex', !visible);
  if (!visible) $('#dmLayout').classList.remove('dm-open');
}
function renderConversationList() {
  const box = $('#dmConversationList'); if (!box) return;
  const q = ($('#dmSearch')?.value || '').trim().toLowerCase();
  let rows = [...state.conversations];
  // A brand-new chat (no messages yet) still gets a row at the top.
  if (state.activeDMUser && !rows.some(c => c.user.id === state.activeDMUser.id))
    rows.unshift({ user: state.activeDMUser, lastMessage: null, unread: 0 });
  if (q) rows = rows.filter(c => (c.user.full_name + ' ' + (c.user.email || '')).toLowerCase().includes(q));
  box.innerHTML = rows.length ? rows.map(c => {
    const active = state.activeDMUser?.id === c.user.id;
    const last = c.lastMessage;
    const preview = last ? (last.sender_id === state.user.id ? 'You: ' : '') + last.content : 'No messages yet — say hi!';
    return `<div class="dm-conv ${active ? 'active' : ''} flex items-center gap-3 px-3 py-2.5" data-conv="${c.user.id}">
      <div class="relative flex-none">${avatarHTML(c.user, 'w-11 h-11 text-sm')}${c.unread ? '<span class="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-rose-500 ring-2 ring-white dark:ring-ink-850"></span>' : ''}</div>
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2"><p class="font-bold text-[14px] truncate">${esc(c.user.full_name)}</p>
        ${last ? `<span class="text-[11px] ${c.unread ? 'text-rose-500 font-black' : 'text-slate-400 font-semibold'} ml-auto flex-none">${timeAgo(last.created_at)}</span>` : ''}</div>
        <p class="text-[13px] truncate ${c.unread ? 'font-bold text-slate-700 dark:text-slate-100' : 'text-slate-400'}">${esc(preview)}</p>
        <p class="text-[11px] text-slate-400 truncate">${esc(c.user.branch || '')}${c.user.academic_year ? ' · ' + esc(c.user.academic_year) : ''}</p>
      </div>
      ${c.unread ? `<span class="flex-none min-w-[22px] h-[22px] px-1.5 rounded-full bg-rose-500 text-white text-[11px] font-black flex items-center justify-center">${c.unread}</span>` : ''}
    </div>`;
  }).join('') : `<div class="text-center px-4 py-10">
      <p class="text-3xl">💬</p><p class="font-bold text-sm mt-2">${q ? 'No people match your search' : 'No conversations yet'}</p>
      <p class="text-[13px] text-slate-400 mt-1 leading-relaxed">Tap <b>New message</b> above, or use <b>Contact</b> on a Teammate Finder post.</p></div>`;
  $$('#dmConversationList [data-conv]').forEach(el => el.onclick = () => selectConversation(el.dataset.conv).catch(e => toast(e.message, 'error')));
}
async function selectConversation(userId, draft = '') {
  let user = state.conversations.find(c => c.user.id === userId)?.user || state.users.find(u => u.id === userId);
  if (!user) { state.users = await Store.listProfiles(); user = state.users.find(u => u.id === userId); }
  if (!user) throw new Error('Could not find that user.');
  state.activeDMUser = user;
  state.dmMessages = await Store.listDirectMessages(userId);
  await Store.markConversationRead(userId);
  state.conversations = await Store.listConversations();
  renderConversationList(); renderDMChat(true);
  $('#dmLayout').classList.add('dm-open'); // mobile: slide into the chat pane
  refreshDMBadge();
  const input = $('#dmMessageInput');
  if (draft) input.value = draft;
  setTimeout(() => input.focus(), 60);
}
function renderDMChat(scrollBottom = true) {
  const u = state.activeDMUser; if (!u) { dmSetChatVisible(false); return; }
  dmSetChatVisible(true);
  $('#dmChatHeader').innerHTML = `
    <button id="dmBackBtn" class="md:hidden w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/10 flex-none" title="Back to conversations"><i class="fa-solid fa-arrow-left"></i></button>
    <button class="flex items-center gap-3 min-w-0 text-left" id="dmHeaderUser">${avatarHTML(u, 'w-10 h-10 text-[13px]')}
      <span class="min-w-0"><span class="flex items-center gap-2"><span class="font-black truncate">${esc(u.full_name)}</span>${u.role && u.role !== 'student' ? roleChip(u.role) : ''}</span>
      <span class="block text-xs text-slate-400 truncate">${esc(u.branch || '')}${u.academic_year ? ' · ' + esc(u.academic_year) : ''} · ${esc(u.email || '')}</span></span></button>
    <span class="ml-auto flex gap-1.5 flex-none">
      <button id="dmViewProfile" class="px-3 py-2 rounded-lg text-[13px] font-bold bg-slate-100 dark:bg-white/10"><i class="fa-solid fa-id-card mr-1"></i>Profile</button>
      <button id="dmReportUser" class="w-9 h-9 rounded-lg bg-slate-100 dark:bg-white/10 text-slate-500 hover:text-rose-500" title="Report user"><i class="fa-solid fa-flag text-[13px]"></i></button>
    </span>`;
  $('#dmBackBtn').onclick = () => $('#dmLayout').classList.remove('dm-open');
  $('#dmHeaderUser').onclick = () => openUserCard(u.id);
  $('#dmViewProfile').onclick = () => openUserCard(u.id);
  $('#dmReportUser').onclick = () => openReportModal('user', u.id);
  const box = $('#dmMessageList');
  const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 180;
  box.innerHTML = state.dmMessages.length ? state.dmMessages.map(m => {
    const mine = m.sender_id === state.user.id;
    const ticks = mine ? ` <i class="fa-solid ${m.is_read ? 'fa-check-double text-sky-200' : 'fa-check opacity-70'}"></i>` : '';
    return mine
      ? `<div class="dm-row flex justify-end items-end gap-1.5 animate-fade-up">
           <button class="dm-del text-slate-300 hover:text-rose-500 p-1 flex-none" data-deldm="${m.id}" title="Delete message"><i class="fa-solid fa-trash text-xs"></i></button>
           <div class="max-w-[78%] sm:max-w-[68%] rounded-2xl rounded-br-md px-4 py-2.5 text-white shadow-glow" style="background:linear-gradient(120deg,#4f46e5,#9333ea)">
             <p class="text-[15px] leading-relaxed break-words whitespace-pre-wrap">${linkify(m.content)}</p>
             <p class="text-[10px] text-white/70 text-right mt-1 font-semibold">${fmtTime(m.created_at)}${ticks}</p></div></div>`
      : `<div class="dm-row flex items-end gap-2 animate-fade-up">
           <button class="flex-none" data-dmavatar="${u.id}">${avatarHTML(u, 'w-8 h-8 text-[11px]')}</button>
           <div class="max-w-[78%] sm:max-w-[68%] rounded-2xl rounded-bl-md px-4 py-2.5 bg-white dark:bg-white/[.08] border border-slate-100 dark:border-white/[.06]">
             <p class="text-[15px] leading-relaxed break-words whitespace-pre-wrap text-slate-700 dark:text-slate-100">${linkify(m.content)}</p>
             <p class="text-[10px] text-slate-400 mt-1 font-semibold">${fmtTime(m.created_at)} · ${timeAgo(m.created_at)}</p></div></div>`;
  }).join('') : `<div class="text-center py-14">
      <div class="flex justify-center">${avatarHTML(u, 'w-16 h-16 text-xl')}</div>
      <p class="font-black mt-3">${esc(u.full_name)}</p>
      <p class="text-sm text-slate-400 mt-1">This is the start of your conversation. Say hello! 👋</p></div>`;
  $$('#dmMessageList [data-deldm]').forEach(b => b.onclick = guard(async () => { await Store.deleteDirectMessage(b.dataset.deldm); state.dmMessages = state.dmMessages.filter(m => m.id !== b.dataset.deldm); renderDMChat(false); state.conversations = await Store.listConversations(); renderConversationList(); toast('Message deleted.'); }));
  $$('#dmMessageList [data-dmavatar]').forEach(b => b.onclick = () => openUserCard(b.dataset.dmavatar));
  $('#dmMessageInput').placeholder = 'Message ' + String(u.full_name || '').split(' ')[0] + '…';
  if (scrollBottom || nearBottom) box.scrollTop = box.scrollHeight;
}
async function handleSendDM(e) {
  e.preventDefault();
  const input = $('#dmMessageInput'), content = input.value.trim();
  if (!content || !state.activeDMUser) return;
  input.value = '';
  try {
    const msg = await Store.sendDirectMessage(state.activeDMUser.id, content.slice(0, CONFIG.MAX_MESSAGE_LEN));
    if (!state.dmMessages.some(m => m.id === msg.id)) { state.dmMessages.push(msg); renderDMChat(true); }
    state.conversations = await Store.listConversations(); renderConversationList();
  } catch (err) { input.value = content; toast(err.message, 'error'); }
}
/* Open (or start) a 1-to-1 chat from anywhere: Teammate Finder, profile cards… */
function openDM(userId, draft = '') {
  if (!userId) return;
  if (userId === state.user.id) { toast('That is you — pick someone else to message.', 'info'); return; }
  state.pendingDM = { userId, draft };
  if (state.view === 'messages') { const pd = state.pendingDM; state.pendingDM = null; selectConversation(pd.userId, pd.draft).catch(e => toast(e.message, 'error')); }
  else switchView('messages');
}
async function openNewMessageModal() {
  state.users = await Store.listProfiles();
  const people = state.users.filter(u => u.id !== state.user.id);
  openModal(`<h3 class="font-black text-xl pr-8"><i class="fa-solid fa-pen-to-square text-brand-500 mr-2"></i>New message</h3>
    <p class="text-sm text-slate-400 mt-1">Choose someone from your college to chat with privately.</p>
    <div class="relative mt-4"><i class="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
    <input id="nmSearch" class="field !pl-10" placeholder="Search by name, branch, email…"/></div>
    <div id="nmList" class="mt-3 space-y-1 max-h-[46vh] overflow-y-auto pr-1"></div>`, 'max-w-md');
  const draw = () => {
    const q = $('#nmSearch').value.trim().toLowerCase();
    const rows = people.filter(u => !q || (u.full_name + ' ' + u.email + ' ' + (u.branch || '')).toLowerCase().includes(q));
    $('#nmList').innerHTML = rows.length ? rows.map(u => `
      <button class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-brand-50 dark:hover:bg-brand-500/10 transition text-left" data-nm="${u.id}">
        ${avatarHTML(u, 'w-10 h-10 text-[13px]')}
        <span class="min-w-0 flex-1"><span class="block font-bold text-sm truncate">${esc(u.full_name)}</span>
        <span class="block text-xs text-slate-400 truncate">${esc(u.branch || '')}${u.academic_year ? ' · ' + esc(u.academic_year) : ''} · ${esc(u.email)}</span></span>
        ${roleChip(u.role)}<i class="fa-solid fa-chevron-right text-slate-300 text-xs"></i></button>`).join('')
      : '<p class="text-sm text-slate-400 text-center py-6">No one matches that search.</p>';
    $$('#nmList [data-nm]').forEach(b => b.onclick = () => { closeModal(); openDM(b.dataset.nm); });
  };
  $('#nmSearch').oninput = draw; draw(); setTimeout(() => $('#nmSearch').focus(), 60);
}

/* ── 18. WIRING + BOOT ────────────────────────────────────────────────────── */
function bindStatic() {
  $('#tabLogin').onclick = () => showAuthTab('login');
  $('#tabSignup').onclick = () => showAuthTab('signup');
  $('#loginForm').onsubmit = handleLogin;
  $('#signupForm').onsubmit = handleSignup;
  $('#forgotBtn').onclick = handleForgot;
  $('#supabaseConfigBtn').onclick = openSupabaseConfig;
  $('#themeToggle').onclick = toggleTheme;
  $('#themeToggleAuth').onclick = toggleTheme;
  $$('[data-eye]').forEach(b => b.onclick = () => { const i = document.getElementById(b.dataset.eye); i.type = i.type === 'password' ? 'text' : 'password'; });
  $$('.nav-btn[data-view]').forEach(b => b.onclick = () => switchView(b.dataset.view));
  $('#logoutBtn').onclick = handleLogout;
  $('#sidebarUser').onclick = (e) => { if (!e.target.closest('#logoutBtn')) switchView('profile'); };
  $('#topProfileBtn').onclick = () => switchView('profile');
  $('#ctaFindTeam').onclick = () => switchView('teammates');
  $('#sidebarOpen').onclick = () => { $('#sidebar').classList.add('open'); $('#sidebarScrim').classList.remove('hidden'); };
  $('#sidebarClose').onclick = () => { $('#sidebar').classList.remove('open'); $('#sidebarScrim').classList.add('hidden'); };
  $('#sidebarScrim').onclick = () => { $('#sidebar').classList.remove('open'); $('#sidebarScrim').classList.add('hidden'); };
  $('#newAnnouncementBtn').onclick = openAnnouncementModal;
  $('#createChannelBtn').onclick = openChannelModal;
  $('#messageForm').onsubmit = handleSendMessage;
  $('#newTeamPostBtn').onclick = openTeamPostModal;
  ['teamSearch'].forEach(id => $('#' + id).oninput = renderTeamPosts);
  $('#teamTypeFilter').onchange = renderTeamPosts; $('#teamStackFilter').onchange = renderTeamPosts;
  $('#uploadResourceBtn').onclick = openResourceModal;
  $('#resourceSearch').oninput = renderResources; $('#resourceCategory').onchange = renderResources; $('#resourceSort').onchange = renderResources;
  $$('.roadmap-tab').forEach(b => b.onclick = () => { state.roadmapTab = b.dataset.rtab; renderRoadmaps(); });
  $$('.resource-tab').forEach(b => b.onclick = () => { state.resourceTab = b.dataset.restab; renderResources(); });
  $('#roadmapSearch').oninput = renderRoadmaps;
  $('#newRoadmapBtn').onclick = openRoadmapModal;
  $('#todoForm').onsubmit = handleAddTodo;
  $$('.todo-filter').forEach(b => b.onclick = () => { state.todoFilter = b.dataset.tfilter; renderTodos(); });
  $('#calPrev').onclick = () => { state.calCursor.setMonth(state.calCursor.getMonth() - 1); renderCalendar(); };
  $('#calNext').onclick = () => { state.calCursor.setMonth(state.calCursor.getMonth() + 1); renderCalendar(); };
  $('#calToday').onclick = () => { state.calCursor = new Date(); renderCalendar(); };
  $('#dmMessageForm').onsubmit = handleSendDM;
  $('#dmSearch').oninput = renderConversationList;
  $('#newMessageBtn').onclick = () => openNewMessageModal().catch(e => toast(e.message, 'error'));
  $('#dmEmptyNewBtn').onclick = () => openNewMessageModal().catch(e => toast(e.message, 'error'));
  $$('.admin-tab').forEach(b => b.onclick = () => { state.adminTab = b.dataset.atab; renderAdminPanel(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
}
async function boot() {
  renderAuthExtras(); bindStatic();
  try {
    const user = await Store.getSessionUser(); // supabase.auth.getSession() / demo session
    if (user) enterApp(user);
  } catch (e) { console.warn('Session restore failed:', e.message); }
  if (MODE === 'supabase') {
    sb.auth.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_OUT' && state.user) { state.user = null; $('#appShell').classList.add('hidden'); $('#authScreen').classList.remove('hidden'); }
      if (event === 'SIGNED_IN' && !state.user) { const u = await Store.getSessionUser().catch(() => null); if (u) enterApp(u); }
    });
  }
}
document.addEventListener('DOMContentLoaded', boot);
