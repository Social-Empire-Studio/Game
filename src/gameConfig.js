// Ported from get_game_config.py
const fs = require("fs");
const path = require("path");
const jsonpatch = require("fast-json-patch");
const { MODS_DIR, CONFIG_DIR, CONFIG_PATCH_DIR } = require("./bundle");

let __game_config = JSON.parse(
  fs.readFileSync(path.join(CONFIG_DIR, "game_config_20120826.json"), "utf-8")
);

function remove_duplicate_items() {
  // Keep the LAST occurrence of each item id (matches the Python behaviour:
  // when a duplicate id is found, the earlier index is deleted).
  const items = __game_config.items;
  let num_duplicate = 0;

  while (true) {
    const indexes = {};
    let duplicate = false;
    for (let index = 0; index < items.length; index++) {
      const item = items[index];
      if (Object.prototype.hasOwnProperty.call(indexes, item.id)) {
        items.splice(indexes[item.id], 1);
        duplicate = true;
        num_duplicate += 1;
        break;
      }
      indexes[item.id] = index;
    }
    if (duplicate) continue;
    break;
  }

  if (num_duplicate) {
    console.log(` * Removed ${num_duplicate} duplicate items from config patches`);
  }
}

function apply_config_patch(filename) {
  const patch = JSON.parse(fs.readFileSync(filename, "utf-8"));
  __game_config = jsonpatch.applyPatch(__game_config, patch).newDocument;
}

function patch_game_config() {
  // Apply patches
  if (fs.existsSync(CONFIG_PATCH_DIR)) {
    const files = fs.readdirSync(CONFIG_PATCH_DIR).sort();
    for (const patch_file of files) {
      if (patch_file.endsWith(".json")) {
        apply_config_patch(path.join(CONFIG_PATCH_DIR, patch_file));
        console.log(" * Patch applied:", patch_file.replace(".json", ""));
      }
    }
  }

  // Apply mods
  const modsTxt = path.join(MODS_DIR, "mods.txt");
  if (fs.existsSync(modsTxt)) {
    const lines = fs.readFileSync(modsTxt, "utf-8").split(/\r?\n/);
    for (const raw of lines) {
      const mod = raw.trim();
      if (mod.startsWith("#") || mod === "") continue;
      const mod_path = path.join(MODS_DIR, `${mod.replace(".json", "")}.json`);
      if (fs.existsSync(mod_path)) {
        apply_config_patch(mod_path);
        console.log(" * Mod applied:", mod);
      }
    }
  }

  remove_duplicate_items();
}

console.log(" [+] Applying config patches and mods...");
patch_game_config();

function get_game_config() {
  return __game_config;
}
const game_config = get_game_config;

// ---------- PLAYER ----------

function get_xp_from_level(level) {
  return __game_config.levels[parseInt(level, 10)].exp_required;
}

function get_level_from_xp(xp) {
  let i = 0;
  for (const lvl of __game_config.levels) {
    if (lvl.exp_required > parseInt(xp, 10)) return i;
    i += 1;
  }
  return 0;
}

// ---------- ITEMS (by id) ----------

const items_dict_id_to_items_index = {};
__game_config.items.forEach((item, i) => {
  items_dict_id_to_items_index[parseInt(item.id, 10)] = i;
});

function get_item_from_id(id) {
  const key = parseInt(id, 10);
  const idx = Object.prototype.hasOwnProperty.call(items_dict_id_to_items_index, key)
    ? items_dict_id_to_items_index[key]
    : null;
  return idx !== null ? __game_config.items[idx] : null;
}

function get_attribute_from_item_id(id, attribute_name) {
  const item = get_item_from_id(id);
  return item && attribute_name in item ? item[attribute_name] : null;
}

function get_name_from_item_id(id) {
  return get_attribute_from_item_id(id, "name");
}

// ---------- ITEMS (by subcat_functional) ----------

const items_dict_subcat_functional_to_items_index = {};
__game_config.items.forEach((item, i) => {
  items_dict_subcat_functional_to_items_index[parseInt(item.subcat_functional, 10)] = i;
});

function get_item_from_subcat_functional(subcat_functional) {
  const key = parseInt(subcat_functional, 10);
  const idx = Object.prototype.hasOwnProperty.call(
    items_dict_subcat_functional_to_items_index,
    key
  )
    ? items_dict_subcat_functional_to_items_index[key]
    : null;
  return idx !== null ? __game_config.items[idx] : null;
}

// ---------- MISSIONS ----------

const missions_dict_id_to_missions_index = {};
__game_config.missions.forEach((item, i) => {
  missions_dict_id_to_missions_index[parseInt(item.id, 10)] = i;
});

function get_mission_from_id(id) {
  const key = parseInt(id, 10);
  const idx = Object.prototype.hasOwnProperty.call(missions_dict_id_to_missions_index, key)
    ? missions_dict_id_to_missions_index[key]
    : null;
  return idx !== null ? __game_config.missions[idx] : null;
}

function get_attribute_from_mission_id(id, attribute_name) {
  const mission = get_mission_from_id(id);
  return mission && attribute_name in mission ? mission[attribute_name] : null;
}

module.exports = {
  patch_game_config,
  get_game_config,
  game_config,
  get_xp_from_level,
  get_level_from_xp,
  get_item_from_id,
  get_attribute_from_item_id,
  get_name_from_item_id,
  get_item_from_subcat_functional,
  get_mission_from_id,
  get_attribute_from_mission_id,
};
