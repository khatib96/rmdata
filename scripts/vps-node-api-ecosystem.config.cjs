module.exports = {
  apps: [
    {
      name: "rmdata-node-api",
      script: "server/dev-api-server.js",
      cwd: "/var/www/api.rmdata.tech/current",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "700M",
      kill_timeout: 5000,
      env: {
        NODE_ENV: "production",
        API_PORT: 3001,
        // Same MariaDB as api-gateway-php (.env): DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
        DB_HOST: "127.0.0.1",
        DB_PORT: "3306",
        DB_NAME: "rmdata_db",
        DB_USER: "root",
        DB_PASSWORD: "",
        // جذر نظيف بجانب current و html: فقط documents/ و images/ (فرعي: documents/Branches، documents/Employees، …).
        RMDATA_STORAGE_ROOT: "/var/www/api.rmdata.tech/storage"
      },
      error_file: "/var/log/rmdata/node-api-error.log",
      out_file: "/var/log/rmdata/node-api-out.log",
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z"
    }
  ]
};
