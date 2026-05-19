module.exports = {
  apps: [
    {
      name: 'aeo-auditor',
      script: 'npx',
      args: 'tsx server/index.ts',
      cwd: './apps/aeo-auditor',
      env: { NODE_ENV: 'production' },
      instances: 1,
      autorestart: true,
      max_memory_restart: '500M',
    },
  ],
};
