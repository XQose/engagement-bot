module.exports = {
  apps: [
    {
      name: 'engagement-bot',
      script: 'dist/index.js',
      env: {
        NODE_ENV: 'production',
      },
      env_production: {
        NODE_ENV: 'production',
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      error_file: 'logs/err.log',
      out_file: 'logs/out.log',
      log_file: 'logs/combined.log',
      time: true,
    },
    {
      name: 'engagement-bot-admin',
      script: './node_modules/.bin/tsx',
      args: 'admin-real.ts',
      env: {
        NODE_ENV: 'production',
      },
      env_production: {
        NODE_ENV: 'production',
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      error_file: 'logs/admin-err.log',
      out_file: 'logs/admin-out.log',
      log_file: 'logs/admin-combined.log',
      time: true,
    }
  ]
};