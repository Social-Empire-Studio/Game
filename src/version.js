// Ported from version.py
const { timestamp_now } = require("./engine");

const version_name = "alpha 0.04";
const version_code = "0.04a";

function migrate_loaded_save(save) {
  // discard current version saves
  if (save.version === version_code) return false;

  // fix 0.01a saves
  if (!("version" in save) || save.version === null) {
    save.version = "0.01a";
  }

  // 0.01a -> 0.02a
  if (save.version === "0.01a") {
    save.maps[0].timestamp = timestamp_now();
    save.privateState.dartsRandomSeed = Math.abs(Math.trunc((Math.pow(2, 16) - 1) * Math.random()));
    save.version = "0.02a";
    console.log("   > migrated to 0.02a");
  }

  // 0.02a -> 0.03a
  if (save.version === "0.02a") {
    if (!("arrayAnimals" in save.privateState)) save.privateState.arrayAnimals = {};
    if (!("strategy" in save.privateState)) save.privateState.strategy = 8;
    if (!("universAttackWin" in save.maps[0])) save.maps[0].universAttackWin = [];
    if (!("questTimes" in save.maps[0])) save.maps[0].questTimes = [];
    if (!("lastQuestTimes" in save.maps[0])) save.maps[0].lastQuestTimes = [];
    save.version = "0.03a";
    console.log("   > migrated to 0.03a");
  }

  // 0.03a -> 0.04a
  if (save.version === "0.03a") {
    if (!("pic" in save.playerInfo)) save.playerInfo.pic = "";
    if (!("survivalVidaTimeStamp" in save.privateState)) save.privateState.survivalVidaTimeStamp = [];
    if (!("survivalVidasExtra" in save.privateState)) save.privateState.survivalVidasExtra = 0;
    if (!("survivalMaps" in save.privateState)) {
      save.privateState.survivalMaps = {
        "100000035": { ts: 0, tp: 0 },
        "100000036": { ts: 0, tp: 0 },
        "100000037": { ts: 0, tp: 0 },
      };
    }
    save.version = "0.04a";
    console.log("   > migrated to 0.04a");
  }

  return true;
}

module.exports = { version_name, version_code, migrate_loaded_save };
