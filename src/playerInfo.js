// Ported from get_player_info.py
const { getSave, neighbor_session, neighbors } = require("./sessions");
const { timestamp_now } = require("./engine");

function get_player_info(USERID) {
  const ts_now = timestamp_now();
  getSave(USERID).playerInfo.last_logged_in = ts_now;
  return {
    result: "ok",
    processed_errors: 0,
    timestamp: ts_now,
    playerInfo: getSave(USERID).playerInfo,
    map: getSave(USERID).maps[0],
    privateState: getSave(USERID).privateState,
    neighbors: neighbors(USERID),
  };
}

function get_neighbor_info(userid, map_number) {
  return {
    result: "ok",
    processed_errors: 0,
    timestamp: timestamp_now(),
    playerInfo: neighbor_session(userid).playerInfo,
    map: neighbor_session(userid).maps[map_number],
    privateState: neighbor_session(userid).privateState,
    neighbors: neighbors(userid),
  };
}

module.exports = { get_player_info, get_neighbor_info };
