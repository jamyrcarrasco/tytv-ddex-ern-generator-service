module.exports = {
  apps: [
    {
      name: 'tytv-ddex-generator',
      script: 'dist/server.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '350M', // reinicia solo si un release grande dispara un leak/pico
      env: {
        NODE_ENV: 'production',
      },
      error_file: '/var/log/pm2/tytv-ddex-generator-error.log',
      out_file: '/var/log/pm2/tytv-ddex-generator-out.log',
      merge_logs: true,
      time: true,
      // Reinicio gradual, no todo de golpe, si algún día se pasa a cluster mode
      kill_timeout: 5000,
    },
  ],
};
