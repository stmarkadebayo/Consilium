import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "on-first-retry",
  },
  webServer: [
    {
      command:
        "sh -c 'cd ../backend && rm -f consilium-e2e.db && AUTH_PROVIDER=development JOB_RUNNER_ENABLED=true DEFAULT_MODEL=mock-council GEMINI_API_KEY= EMBEDDING_MODEL= EMBEDDING_DIMENSIONS=768 CORS_ORIGINS=http://127.0.0.1:3100 DATABASE_URL=sqlite:///./consilium-e2e.db python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8100'",
      url: "http://127.0.0.1:8100/health",
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command:
        "sh -c 'NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8100 NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY= npm run build && NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8100 NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY= npm run start -- --hostname 127.0.0.1 --port 3100'",
      url: "http://127.0.0.1:3100",
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
