module.exports = {
  apps: [{
    name: "aura-salon-crm",
    script: "server/index.js",
    cwd: __dirname,
    env: {
      NODE_ENV: "production",
      AURA_DB_PATH: "/home/u840940482/persistent-data/salon-crm.sqlite"
    },
    env_production: {
      NODE_ENV: "production",
      AURA_DB_PATH: "/home/u840940482/persistent-data/salon-crm.sqlite"
    }
  }]
};
