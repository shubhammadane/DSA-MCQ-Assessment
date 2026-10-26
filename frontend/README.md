# React frontend — Vercel

This folder is the Vercel project's **Root Directory**.

| Setting | Value |
| --- | --- |
| Root Directory | `frontend` |
| Framework | Vite |
| Node.js | 24.x |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Production variables | `.env.vercel.example` |

The only frontend environment variable is:

```dotenv
VITE_API_URL=https://your-backend.onrender.com
```

Set it in Vercel before deployment. It is public and embedded in the browser bundle. Database URLs, signing keys and administrator passwords belong only on Render. Changing this URL requires a new frontend deployment. Vercel builds fail with a clear message when the backend URL is missing or points to localhost.

`vercel.json` configures the build and SPA rewrites so refreshing `/admin/exams` and student exam routes works.

For local development:

```bash
cp .env.example .env.local
npm ci
npm run dev
```

See [the deployment guide](../docs/deployment.md) to connect this app to Render and Supabase.
