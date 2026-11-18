import {defineConfig} from '@playwright/test'
export default defineConfig({
  testDir:'./tests',
  use:{baseURL:'http://localhost:5173',channel:process.env.PLAYWRIGHT_CHANNEL||undefined},
  webServer:{command:'npm run dev --workspace frontend -- --strictPort',url:'http://localhost:5173',reuseExistingServer:!process.env.CI},
})
