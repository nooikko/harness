// pm2 ecosystem configuration for Harness production deployment
// Usage: pm2 start ecosystem.config.cjs

module.exports = {
  apps: [
    {
      name: "harness-orchestrator",
      script: "dist/index.js",
      cwd: "./apps/orchestrator",
      node_args: "--enable-source-maps",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: "4001",
        HEALTH_PORT: "4002",
      },
      env_file: ".env",
      kill_timeout: 10000,
      listen_timeout: 5000,
      shutdown_with_message: true,
      // Log configuration
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      error_file: "./logs/orchestrator-error.log",
      out_file: "./logs/orchestrator-out.log",
      merge_logs: true,
      // Log rotation (requires pm2-logrotate module)
      // Install: pm2 install pm2-logrotate
      // Configure:
      //   pm2 set pm2-logrotate:max_size 50M
      //   pm2 set pm2-logrotate:retain 14
      //   pm2 set pm2-logrotate:compress true
      //   pm2 set pm2-logrotate:dateFormat YYYY-MM-DD_HH-mm-ss
      //   pm2 set pm2-logrotate:workerInterval 60
    },
    {
      name: "harness-dashboard",
      script: "node_modules/.bin/next",
      args: "start",
      cwd: "./apps/web",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: "4000",
      },
      env_file: ".env",
      kill_timeout: 10000,
      listen_timeout: 10000,
      shutdown_with_message: true,
      // Log configuration
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      error_file: "./logs/dashboard-error.log",
      out_file: "./logs/dashboard-out.log",
      merge_logs: true,
    },
  ],
};
