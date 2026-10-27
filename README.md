# 🎓 CampusConnect — Student Interaction Portal

A production-ready, Discord/LMS-style campus portal built with **Vanilla JS + Tailwind + Supabase** (Auth, Postgres, Realtime, Storage, RLS).

## ⚡ Run it in 30 seconds (Demo Mode — no setup)
Just open `index.html` in a browser (or serve the folder: `npx serve .`). Everything works instantly with seeded local data.

| Role | Email | Password |
|---|---|---|
| 👑 Admin | `admin@college.edu` | `admin123` |
| 🛡️ Moderator | `moderator@college.edu` | `mod123` |
| 🎓 Student | `Aarav@college.edu` | `student123` |

One-click login buttons are on the login screen. Demo data lives in `localStorage` and can be reset from the login screen. Chat is even "realtime" across browser tabs in demo mode.

## 🚀 Go live with Supabase (5 minutes)
> ✅ **This copy is already connected** to Supabase project `lzjrdtlxwporjzqnfclb` (URL + publishable key are set at the top of `app.js`). The only remaining step is running `schema.sql` once in that project's SQL Editor (step 2 below), then promoting your admin (step 4).
1. Create a free project at [supabase.com](https://supabase.com).
2. **SQL Editor** → paste & run all of **`schema.sql`** (creates 11 tables + `resource_upvotes` — including `direct_messages` for 1-to-1 chats — RLS policies, realtime, storage buckets `resources`/`avatars`, seed channels). Re-running the file on an existing project is safe and applies new columns/tables.
3. Open the app → **“Connect your own Supabase project”** (login screen) → paste **Project URL** + **anon key** (Settings → API). *(Or hardcode them at the top of `app.js`.)*
4. Sign up with your admin email, then promote yourself once in SQL:
   ```sql
   update public.profiles set role = 'admin' where email = 'you@college.edu';
   ```
5. For hackathon demos: Authentication → Providers → Email → turn **“Confirm email” OFF**. Keep it ON for real production.

## ✉️ College email restriction
Edit `CONFIG.ALLOWED_DOMAINS` at the top of `app.js` (e.g. `['iitb.ac.in']`). The domain also becomes the user's college “Server” namespace (stored as `profiles.college_domain`, shown in the sidebar).

## 📦 Files
| File | Purpose |
|---|---|
| `index.html` | Full UI — auth, sidebar layout, all 8 views, modals, dark/light glass design |
| `app.js` | All logic — `Store` data layer with identical Demo/Supabase implementations, realtime chat, markdown roadmaps, calendar, admin workflows |
| `schema.sql` | Tables, RLS, triggers (auto-profile on signup, roadmap self-approve guard, upvote counter), realtime publication, storage policies |

## ✅ Feature checklist
- **Auth**: college-domain validation, login/signup, forgot password, session persistence (`getSession()` + `onAuthStateChange`)
- **RBAC**: Student / Moderator / Admin — enforced in UI *and* by Postgres RLS
- **Chat**: realtime (`postgres_changes`), channels created by **admins only**, report any message/user (Spam/Harassment/…)
- **Messages (DMs)**: private 1-to-1 chats under **Personal → Messages** — conversation list with unread badges/read ticks, realtime delivery, “New message” people picker; **Contact** on any Teammate Finder post (and **Message** on any profile card) drops you straight into the DM with a pre-filled intro
- **Teammate Finder**: posts with tech stack, team size, live spot counter, filters + search
- **Profiles**: skills, GitHub/LinkedIn **and a custom website/portfolio link** shown on the public profile card
- **Resource Hub**: upload to **Supabase Storage** → `pending` → **admin approve/reject with feedback** (Admin Portal → Resource reviews) → published only when `approved` (RLS + trigger-enforced, same as roadmaps); uploaders track status under **My uploads**. Upvote (1 per user) + download counters, category/sort/search
- **Roadmaps**: Markdown editor with preview → `pending` → **admin approve/reject with feedback** → public feed only when `approved` (RLS-enforced; a DB trigger blocks self-approval)
- **Announcements**: staff-only broadcast, pinned posts, event dates, “Add to my calendar”
- **Productivity**: interactive month calendar (personal events + college events + due tasks) & to-do list with priorities
- **Admin Portal**: stats, roadmap queue, reports queue (view/delete reported messages), user role management + suspend, channel & announcement management

## 🔒 Security notes
- The anon key is safe to expose — all access is governed by the RLS policies in `schema.sql`. Never ship the `service_role` key in frontend code.
- Demo-mode passwords are stored in plain `localStorage` **for demo purposes only** — Live Mode uses Supabase Auth (bcrypt) exclusively.
