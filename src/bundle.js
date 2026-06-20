// Ported from bundle.py
// Resolves all the data directories relative to the project root.

const path = require("path");

// Project root = parent of /src
const BASE_DIR = path.resolve(__dirname, "..");

const ASSETS_DIR = path.join(BASE_DIR, "assets");
const STUB_DIR = path.join(BASE_DIR, "stub");
const TEMPLATES_DIR = path.join(BASE_DIR, "templates");
const VILLAGES_DIR = path.join(BASE_DIR, "villages");
const QUESTS_DIR = path.join(VILLAGES_DIR, "quests");
const CONFIG_DIR = path.join(BASE_DIR, "config");
const CONFIG_PATCH_DIR = path.join(CONFIG_DIR, "patch");

const MODS_DIR = path.join(BASE_DIR, "mods");
const SAVES_DIR = path.join(BASE_DIR, "saves");

module.exports = {
  BASE_DIR,
  ASSETS_DIR,
  STUB_DIR,
  TEMPLATES_DIR,
  VILLAGES_DIR,
  QUESTS_DIR,
  CONFIG_DIR,
  CONFIG_PATCH_DIR,
  MODS_DIR,
  SAVES_DIR,
};
