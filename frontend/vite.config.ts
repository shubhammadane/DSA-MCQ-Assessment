import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  if (command === 'build' && process.env.VERCEL === '1') {
    const value = loadEnv(mode, process.cwd(), 'VITE_').VITE_API_URL;
    let valid = false;
    try {
      const url = new URL(value || '');
      valid = url.protocol === 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    } catch { /* Report one actionable deployment error below. */ }
    if (!valid) {
      throw new Error('Set VITE_API_URL to your HTTPS Render backend URL in Vercel Environment Variables, then redeploy.');
    }
  }
  return { plugins: [react()] };
})
