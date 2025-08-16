# SubSpace (fixed starter)

A clean React + Vite + Tailwind + Supabase auth starter wired for your SubSpace project.

## Quickstart

1) **Install deps**

```bash
pnpm install
# or npm i / yarn
```

2) **Create `.env`** at project root (next to `package.json`) with:

```
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

3) **Run**

```bash
pnpm dev
```

Open http://localhost:5173

## Netlify

Set environment variables in Netlify UI or CLI:

```bash
netlify env:set VITE_SUPABASE_URL your_url
netlify env:set VITE_SUPABASE_ANON_KEY your_key
```

Then deploy:

```bash
netlify deploy --prod
```

## Notes

- Sign Up will send a verification email (if enabled in your Supabase Auth settings).
- Chat page shows your name from `user_metadata.full_name` and has a **Clear** button + **Sign out**.
- Replace the placeholder bot reply in `src/pages/Chat.jsx` with your actual backend / n8n call when ready.
