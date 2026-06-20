// Ported from engine.py
const { get_attribute_from_item_id } = require("./gameConfig");

function apply_cost(playerInfo, map, id, price_multiplier) {
  const cost = Math.trunc(price_multiplier * parseInt(get_attribute_from_item_id(id, "cost"), 10));
  const cost_type = get_attribute_from_item_id(id, "cost_type");
  if (cost_type === "w") {
    map.wood = Math.max(map.wood - cost, 0);
  } else if (cost_type === "g") {
    map.coins = Math.max(map.coins - cost, 0);
  } else if (cost_type === "c") {
    playerInfo.cash = Math.max(playerInfo.cash - cost, 0);
  } else if (cost_type === "s") {
    map.stone = Math.max(map.stone - cost, 0);
  } else if (cost_type === "f") {
    map.food = Math.max(map.food - cost, 0);
  }
}

function apply_collect(playerInfo, map, id, resource_multiplier) {
  const collect = Math.trunc(
    resource_multiplier * parseInt(get_attribute_from_item_id(id, "collect"), 10)
  );
  const collect_type = get_attribute_from_item_id(id, "collect_type");
  apply_collect_xp(map, id);
  if (collect_type === "w") {
    map.wood = map.wood + collect;
  } else if (collect_type === "g") {
    map.coins = map.coins + collect;
  } else if (collect_type === "c") {
    playerInfo.cash = playerInfo.cash + collect;
  } else if (collect_type === "s") {
    map.stone = map.stone + collect;
  } else if (collect_type === "f") {
    map.food = map.food + collect;
  }
}

function apply_collect_xp(map, id) {
  const collect_xp = parseInt(get_attribute_from_item_id(id, "collect_xp"), 10);
  map.xp = map.xp + collect_xp;
}

function timestamp_now() {
  return Math.floor(Date.now() / 1000);
}

module.exports = { apply_cost, apply_collect, apply_collect_xp, timestamp_now };
