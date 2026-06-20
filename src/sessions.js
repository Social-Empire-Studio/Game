// Ported from sessions.py
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const { version_code, migrate_loaded_save } = require("./version");
const { timestamp_now } = require("./engine");
const { Constant } = require("./constants");
const { VILLAGES_DIR, SAVES_DIR } = require("./bundle");

let __villages = {}; // ALL static neighbours
let __saves = {}; // ALL saved villages

const __initial_village = JSON.parse(
  fs.readFileSync(path.join(VILLAGES_DIR, "initial.json"), "utf-8")
);

// ---------- Load saved villages ----------

function load_saved_villages() {
  __villages = {};
  __saves = {};

  // Saves dir check
  if (!fs.existsSync(SAVES_DIR)) {
    try {
      console.log(`Creating '${SAVES_DIR}' folder...`);
      fs.mkdirSync(SAVES_DIR);
    } catch (e) {
      console.log(`Could not create '${SAVES_DIR}' folder.`);
      process.exit(1);
    }
  }
  if (!fs.statSync(SAVES_DIR).isDirectory()) {
    console.log(`'${SAVES_DIR}' is not a folder... Move the file somewhere else.`);
    process.exit(1);
  }

  // Static neighbours in /villages
  for (const file of fs.readdirSync(VILLAGES_DIR)) {
    if (file === "initial.json" || !file.endsWith(".json")) continue;
    process.stdout.write(` * Loading static neighbour ${file}... `);
    let village;
    try {
      village = JSON.parse(fs.readFileSync(path.join(VILLAGES_DIR, file), "utf-8"));
    } catch (e) {
      console.log("Invalid neighbour (parse error)");
      continue;
    }
    if (!is_valid_village(village)) {
      console.log("Invalid neighbour");
      continue;
    }
    const USERID = village.playerInfo.pid;
    if (String(USERID) in __villages) {
      console.log(`Ignored: duplicated PID '${USERID}'.`);
    } else {
      __villages[String(USERID)] = village;
      console.log("Ok.");
    }
  }

  // Saves in /saves
  for (const file of fs.readdirSync(SAVES_DIR)) {
    if (!file.endsWith(".save.json")) continue;
    process.stdout.write(` * Loading save at ${file}... `);
    let save;
    try {
      save = JSON.parse(fs.readFileSync(path.join(SAVES_DIR, file), "utf-8"));
    } catch (e) {
      console.log("Corrupted JSON.");
      continue;
    }
    if (!is_valid_village(save)) {
      console.log("Invalid Save.");
      continue;
    }
    const USERID = save.playerInfo.pid;
    let map_name;
    try {
      map_name = save.playerInfo.map_names[save.playerInfo.default_map];
    } catch (e) {
      map_name = "?";
    }
    console.log(`(${map_name}) Ok.`);
    __saves[String(USERID)] = save;
    const modified = migrate_loaded_save(save); // check save version for migration
    if (modified) save_session(USERID);
  }
}

// ---------- New village ----------

function new_village() {
  const USERID = crypto.randomUUID();
  if (all_userid().includes(USERID)) {
    throw new Error("UUID collision");
  }
  // Deep copy of init
  const village = JSON.parse(JSON.stringify(__initial_village));
  village.version = version_code;
  village.playerInfo.pid = USERID;
  village.maps[0].timestamp = timestamp_now();
  village.privateState.dartsRandomSeed = Math.abs(Math.trunc((Math.pow(2, 16) - 1) * Math.random()));
  __saves[USERID] = village;
  save_session(USERID);
  console.log("Done.");
  return USERID;
}

// ---------- Access functions ----------

function all_saves_userid() {
  return Object.keys(__saves);
}

function all_userid() {
  return [...Object.keys(__villages), ...Object.keys(__saves)];
}

function save_info(USERID) {
  const save = __saves[USERID];
  const default_map = save.playerInfo.default_map;
  const empire_name = String(save.playerInfo.map_names[default_map]);
  const xp = save.maps[default_map].xp;
  const level = save.maps[default_map].level;
  return { userid: USERID, name: empire_name, xp, level };
}

function all_saves_info() {
  const saves_info = [];
  for (const userid of Object.keys(__saves)) {
    saves_info.push(save_info(userid));
  }
  return saves_info;
}

// equivalent of session(USERID) in Python
function getSave(USERID) {
  if (typeof USERID !== "string") throw new Error("USERID must be a string");
  return USERID in __saves ? __saves[USERID] : null;
}

function neighbor_session(USERID) {
  if (typeof USERID !== "string") throw new Error("USERID must be a string");
  if (USERID in __saves) return __saves[USERID];
  if (USERID in __villages) return __villages[USERID];
  return undefined;
}

function fb_friends_str(USERID) {
  const friends = [];
  // static villages
  for (const key of Object.keys(__villages)) {
    const vill = __villages[key];
    if (
      vill.playerInfo.pid === Constant.NEIGHBOUR_ARTHUR_GUINEVERE_1 ||
      vill.playerInfo.pid === Constant.NEIGHBOUR_ARTHUR_GUINEVERE_2 ||
      vill.playerInfo.pid === Constant.NEIGHBOUR_ARTHUR_GUINEVERE_3
    ) {
      continue;
    }
    const frie = {};
    frie.uid = vill.playerInfo.pid;
    frie.pic_square = vill.playerInfo.pic;
    if (!frie.pic_square) frie.pic_square = "/img/profile/1025.png";
    friends.push(frie);
  }
  // other players
  for (const key of Object.keys(__saves)) {
    const vill = __saves[key];
    if (vill.playerInfo.pid === USERID) continue;
    const frie = {};
    frie.uid = vill.playerInfo.pid;
    frie.pic_square = vill.playerInfo.pic;
    if (!frie.pic_square) frie.pic_square = "/img/profile/1025.png";
    friends.push(frie);
  }
  return friends;
}

function neighbors(USERID) {
  const out = [];
  const collect = (collection, skipArthur) => {
    for (const key of Object.keys(collection)) {
      const vill = collection[key];
      if (skipArthur) {
        if (
          vill.playerInfo.pid === Constant.NEIGHBOUR_ARTHUR_GUINEVERE_1 ||
          vill.playerInfo.pid === Constant.NEIGHBOUR_ARTHUR_GUINEVERE_2 ||
          vill.playerInfo.pid === Constant.NEIGHBOUR_ARTHUR_GUINEVERE_3
        ) {
          continue;
        }
      } else if (vill.playerInfo.pid === USERID) {
        continue;
      }
      const neigh = vill.playerInfo;
      neigh.coins = vill.maps[0].coins;
      neigh.xp = vill.maps[0].xp;
      neigh.level = vill.maps[0].level;
      neigh.stone = vill.maps[0].stone;
      neigh.wood = vill.maps[0].wood;
      neigh.food = vill.maps[0].food;
      out.push(neigh);
    }
  };
  collect(__villages, true);
  collect(__saves, false);
  return out;
}

// ---------- Valid village check ----------

function is_valid_village(save) {
  if (!("playerInfo" in save) || !("maps" in save) || !("privateState" in save)) {
    return false;
  }
  for (const map of save.maps) {
    if ("oil" in map || "steel" in map) return false;
    if (!("stone" in map) || !("food" in map)) return false;
    if (!("items" in map)) return false;
    if (!Array.isArray(map.items)) return false;
  }
  return true;
}

// ---------- Persistency ----------

function backup_session(USERID) {
  // TODO
}

function save_session(USERID) {
  const file = `${USERID}.save.json`;
  process.stdout.write(` * Saving village at ${file}... `);
  const village = getSave(USERID);
  fs.writeFileSync(path.join(SAVES_DIR, file), JSON.stringify(village, null, 4));
  console.log("Done.");
}

module.exports = {
  load_saved_villages,
  new_village,
  all_saves_userid,
  all_userid,
  save_info,
  all_saves_info,
  getSave,
  neighbor_session,
  fb_friends_str,
  neighbors,
  is_valid_village,
  backup_session,
  save_session,
};
