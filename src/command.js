// Ported from command.py
const { getSave, save_session } = require("./sessions");
const {
  get_game_config,
  get_level_from_xp,
  get_name_from_item_id,
  get_attribute_from_mission_id,
  get_xp_from_level,
  get_attribute_from_item_id,
  get_item_from_subcat_functional,
} = require("./gameConfig");
const { Constant } = require("./constants");
const { apply_cost, apply_collect, apply_collect_xp, timestamp_now } = require("./engine");

function get_strategy_type(id) {
  if (id === 8) return "Defensive";
  if (id === 9) return "Mid Defensive";
  if (id === 7) return "Mid Aggressive";
  if (id === 10) return "Aggressive";
  return "Unknown Strategy";
}

function command(USERID, data) {
  const commands = data.commands;
  for (let i = 0; i < commands.length; i++) {
    const comm = commands[i];
    do_command(USERID, comm.cmd, comm.args);
  }
  save_session(USERID); // Save session
}

function do_command(USERID, cmd, args) {
  const save = getSave(USERID);
  process.stdout.write(` [+] COMMAND: ${cmd}(${JSON.stringify(args)}) -> `);

  if (cmd === Constant.CMD_GAME_STATUS) {
    console.log(args.join(" "));
  } else if (cmd === Constant.CMD_BUY) {
    const id = args[0];
    const x = args[1];
    const y = args[2];
    // const frame = args[3];
    const town_id = args[4];
    const bool_dont_modify_resources = Boolean(args[5]);
    const price_multiplier = args[6];
    // const type = args[7];
    console.log("Add", String(get_name_from_item_id(id)), "at", `(${x},${y})`);
    const collected_at_timestamp = timestamp_now();
    const level = 0;
    const orientation = 0;
    const map = save.maps[town_id];
    if (!bool_dont_modify_resources) {
      apply_cost(save.playerInfo, map, id, price_multiplier);
      const xp = parseInt(get_attribute_from_item_id(id, "xp"), 10);
      map.xp = map.xp + xp;
    }
    map.items.push([id, x, y, orientation, collected_at_timestamp, level]);
  } else if (cmd === Constant.CMD_COMPLETE_TUTORIAL) {
    const tutorial_step = args[0];
    console.log("Tutorial step", tutorial_step, "reached.");
    if (tutorial_step >= 31) {
      console.log("Tutorial COMPLETED!");
      save.playerInfo.completed_tutorial = 1;
      save.privateState.dragonNestActive = 1;
    }
  } else if (cmd === Constant.CMD_MOVE) {
    const ix = args[0];
    const iy = args[1];
    const id = args[2];
    const newx = args[3];
    const newy = args[4];
    // const frame = args[5];
    const town_id = args[6];
    // const reason = args[7];
    console.log("Move", String(get_name_from_item_id(id)), "from", `(${ix},${iy})`, "to", `(${newx},${newy})`);
    const map = save.maps[town_id];
    for (const item of map.items) {
      if (item[0] === id && item[1] === ix && item[2] === iy) {
        item[1] = newx;
        item[2] = newy;
        break;
      }
    }
  } else if (cmd === Constant.CMD_COLLECT) {
    const x = args[0];
    const y = args[1];
    const town_id = args[2];
    const id = args[3];
    // const num_units_contained_when_harvested = args[4];
    const resource_multiplier = args[5];
    const cash_to_substract = args[6];
    console.log("Collect", String(get_name_from_item_id(id)));
    const map = save.maps[town_id];
    apply_collect(save.playerInfo, map, id, resource_multiplier);
    save.playerInfo.cash = Math.max(save.playerInfo.cash - cash_to_substract, 0);
  } else if (cmd === Constant.CMD_SELL) {
    const x = args[0];
    const y = args[1];
    const id = args[2];
    const town_id = args[3];
    const bool_dont_modify_resources = args[4];
    const reason = args[5];
    console.log("Remove", String(get_name_from_item_id(id)), "from", `(${x},${y}). Reason: ${reason}`);
    const map = save.maps[town_id];
    for (let i = 0; i < map.items.length; i++) {
      const item = map.items[i];
      if (item[0] === id && item[1] === x && item[2] === y) {
        map.items.splice(i, 1);
        break;
      }
    }
    if (!bool_dont_modify_resources) {
      const price_multiplier = -0.05;
      if (get_attribute_from_item_id(id, "cost_type") !== "c") {
        apply_cost(save.playerInfo, save.maps[town_id], id, price_multiplier);
      }
    }
    if (reason === "KILL") {
      // TODO: add to graveyard
    }
  } else if (cmd === Constant.CMD_KILL) {
    const x = args[0];
    const y = args[1];
    const id = args[2];
    const town_id = args[3];
    // const type = args[4];
    console.log("Kill", String(get_name_from_item_id(id)), "from", `(${x},${y}).`);
    const map = save.maps[town_id];
    for (let i = 0; i < map.items.length; i++) {
      const item = map.items[i];
      if (item[0] === id && item[1] === x && item[2] === y) {
        apply_collect_xp(map, id);
        map.items.splice(i, 1);
        break;
      }
    }
  } else if (cmd === Constant.CMD_COMPLETE_MISSION) {
    const mission_id = args[0];
    const skipped_with_cash = Boolean(args[1]);
    console.log("Complete mission", mission_id, ":", String(get_attribute_from_mission_id(mission_id, "title")));
    if (skipped_with_cash) {
      const cash_to_substract = 0;
      save.playerInfo.cash = Math.max(save.playerInfo.cash - cash_to_substract, 0);
    }
    save.privateState.completedMissions.push(mission_id);
  } else if (cmd === Constant.CMD_REWARD_MISSION) {
    const town_id = args[0];
    const mission_id = args[1];
    console.log("Reward mission", mission_id, ":", String(get_attribute_from_mission_id(mission_id, "title")));
    const reward = parseInt(get_attribute_from_mission_id(mission_id, "reward"), 10);
    save.maps[town_id].coins += reward;
    save.privateState.rewardedMissions.push(mission_id);
  } else if (cmd === Constant.CMD_PUSH_UNIT) {
    const unit_x = args[0];
    const unit_y = args[1];
    const unit_id = args[2];
    const b_x = args[3];
    const b_y = args[4];
    const town_id = args[5];
    console.log("Push", String(get_name_from_item_id(unit_id)), "to", `(${b_x},${b_y}).`);
    const map = save.maps[town_id];
    // Unit into building
    for (const item of map.items) {
      if (item[1] === b_x && item[2] === b_y) {
        if (item.length < 7) item.push([]);
        item[6].push(unit_id);
        break;
      }
    }
    // Remove unit
    for (let i = 0; i < map.items.length; i++) {
      const item = map.items[i];
      if (item[0] === unit_id && item[1] === unit_x && item[2] === unit_y) {
        map.items.splice(i, 1);
        break;
      }
    }
  } else if (cmd === Constant.CMD_POP_UNIT) {
    const b_x = args[0];
    const b_y = args[1];
    const town_id = args[2];
    const unit_id = args[3];
    const place_popped_unit = args.length > 4;
    let unit_x, unit_y;
    if (place_popped_unit) {
      unit_x = args[4];
      unit_y = args[5];
      // const unit_frame = args[6];
    }
    console.log("Pop", String(get_name_from_item_id(unit_id)), "from", `(${b_x},${b_y}).`);
    const map = save.maps[town_id];
    // Remove unit from building
    for (const item of map.items) {
      if (item[1] === b_x && item[2] === b_y) {
        if (item.length < 7) break;
        const idx = item[6].indexOf(unit_id);
        if (idx !== -1) item[6].splice(idx, 1);
        break;
      }
    }
    if (place_popped_unit) {
      const collected_at_timestamp = timestamp_now();
      const level = 0;
      const orientation = 0;
      map.items.push([unit_id, unit_x, unit_y, orientation, collected_at_timestamp, level]);
    }
  } else if (cmd === Constant.CMD_RT_LEVEL_UP) {
    const new_level = args[0];
    console.log("Level Up!:", new_level);
    const map = save.maps[0];
    map.level = args[0];
    const current_xp = map.xp;
    const min_expected_xp = get_xp_from_level(Math.max(0, new_level - 1));
    map.xp = Math.max(min_expected_xp, current_xp);
  } else if (cmd === Constant.CMD_RT_PUBLISH_SCORE) {
    const new_xp = args[0];
    console.log("xp set to", new_xp);
    const map = save.maps[0];
    map.xp = new_xp;
    map.level = get_level_from_xp(new_xp);
  } else if (cmd === Constant.CMD_EXPAND) {
    const land_id = args[0];
    const resource = args[1];
    const town_id = parseInt(args[2], 10);
    console.log("Expansion", land_id, "purchased");
    const map = save.maps[town_id];
    if (map.expansions.includes(land_id)) return;
    const expansion_prices = get_game_config().expansion_prices;
    const exp = expansion_prices[map.expansions.length - 1];
    if (resource === "gold") {
      const to_substract = exp.coins;
      save.maps[town_id].coins = Math.max(save.maps[town_id].coins - to_substract, 0);
    } else if (resource === "cash") {
      const to_substract = exp.cash;
      save.playerInfo.cash = Math.max(save.playerInfo.cash - to_substract, 0);
    }
    map.expansions.push(land_id);
  } else if (cmd === Constant.CMD_NAME_MAP) {
    const town_id = parseInt(args[0], 10);
    const new_name = args[1];
    console.log(`Map name changed to '${new_name}'.`);
    save.playerInfo.map_names[town_id] = new_name;
  } else if (cmd === Constant.CMD_EXCHANGE_CASH) {
    const town_id = args[0];
    console.log("Exchange cash -> coins.");
    save.playerInfo.cash = Math.max(save.playerInfo.cash - 5, 0);
    save.maps[town_id].coins += 2500;
  } else if (cmd === Constant.CMD_STORE_ITEM) {
    const x = args[0];
    const y = args[1];
    const town_id = parseInt(args[2], 10);
    const item_id = args[3];
    console.log("Store", String(get_name_from_item_id(item_id)), "from", `(${x},${y})`);
    const map = save.maps[town_id];
    for (let i = 0; i < map.items.length; i++) {
      const item = map.items[i];
      if (item[0] === item_id && item[1] === x && item[2] === y) {
        map.items.splice(i, 1);
        break;
      }
    }
    const length = save.privateState.gifts.length;
    if (length <= item_id) {
      for (let i = 0; i < item_id - length + 1; i++) save.privateState.gifts.push(0);
    }
    save.privateState.gifts[item_id] += 1;
  } else if (cmd === Constant.CMD_PLACE_GIFT) {
    const item_id = args[0];
    const x = args[1];
    const y = args[2];
    const town_id = args[3];
    // args[4] unknown yet
    console.log("Add", String(get_name_from_item_id(item_id)), "at", `(${x},${y})`);
    const items = save.maps[town_id].items;
    const orientation = 0;
    const collected_at_timestamp = timestamp_now();
    const level = 0;
    items.push([item_id, x, y, orientation, collected_at_timestamp, level]);
    save.privateState.gifts[item_id] -= 1;
    if (save.privateState.gifts[item_id] === 0) {
      while (save.privateState.gifts[save.privateState.gifts.length - 1] === 0) {
        save.privateState.gifts.pop();
      }
    }
  } else if (cmd === Constant.CMD_SELL_GIFT) {
    const item_id = args[0];
    const town_id = args[1];
    console.log("Gift", String(get_name_from_item_id(item_id)), "sold on town:", town_id);
    const gifts = save.privateState.gifts;
    gifts[item_id] -= 1;
    if (gifts[item_id] === 0) {
      while (gifts.length !== 0 && gifts[gifts.length - 1] === 0) gifts.pop();
    }
    const price_multiplier = -0.05;
    if (get_attribute_from_item_id(item_id, "cost_type") !== "c") {
      apply_cost(save.playerInfo, save.maps[town_id], item_id, price_multiplier);
    }
  } else if (cmd === Constant.CMD_ACTIVATE_DRAGON) {
    const currency = args[0];
    console.log("Dragon nest activated.");
    if (currency === "c") {
      save.playerInfo.cash = Math.max(Math.trunc(save.playerInfo.cash - 50), 0);
    } else if (currency === "g") {
      const map = save.maps;
      map[0].coins = Math.max(Math.trunc(map[0].coins - 100000), 0);
    }
    save.privateState.dragonNestActive = 1;
    save.privateState.timeStampTakeCare = -1;
  } else if (cmd === Constant.CMD_DESACTIVATE_DRAGON) {
    console.log("Dragon nest deactivated.");
    const pState = save.privateState;
    pState.dragonNestActive = 0;
    pState.stepNumber = 0;
    pState.dragonNumber = 0;
    pState.timeStampTakeCare = -1;
  } else if (cmd === Constant.CMD_NEXT_DRAGON_STEP) {
    // const unknown = args[0];
    console.log("Dragon step increased.");
    const pState = save.privateState;
    pState.stepNumber += 1;
    pState.timeStampTakeCare = timestamp_now();
  } else if (cmd === Constant.CMD_NEXT_DRAGON) {
    console.log("Dragon step reset and dragonNumber increased.");
    const pState = save.privateState;
    pState.stepNumber = 0;
    pState.dragonNumber += 1;
    pState.timeStampTakeCare = -1;
  } else if (cmd === Constant.CMD_DRAGON_BUY_STEP_CASH) {
    const price = args[0];
    console.log("Buy dragon step with cash.");
    save.playerInfo.cash = Math.max(Math.trunc(save.playerInfo.cash - price), 0);
    save.privateState.timeStampTakeCare = -1;
  } else if (cmd === Constant.CMD_RIDER_BUY_STEP_CASH) {
    const price = args[0];
    console.log("Buy rider step with cash.");
    save.playerInfo.cash = Math.max(Math.trunc(save.playerInfo.cash - price), 0);
    save.privateState.riderTimeStamp = -1;
  } else if (cmd === Constant.CMD_NEXT_RIDER_STEP) {
    console.log("Rider step increased.");
    const pState = save.privateState;
    pState.riderStepNumber += 1;
    pState.riderTimeStamp = timestamp_now();
  } else if (cmd === Constant.CMD_SELECT_RIDER) {
    const number = parseInt(args[0], 10);
    const pState = save.privateState;
    if (number === 1 || number === 2 || number === 3) {
      pState.riderNumber = number;
      console.log("Rider", number, "Selected.");
    } else {
      pState.riderNumber = 0;
      pState.riderStepNumber = 0;
      pState.riderTimeStamp = -1;
      console.log("Rider reset.");
    }
  } else if (cmd === Constant.CMD_ORIENT) {
    const x = args[0];
    const y = args[1];
    const new_orientation = args[2];
    const town_id = args[3];
    console.log("Item at", `(${x},${y})`, "changed to orientation", new_orientation);
    const map = save.maps[town_id];
    for (const item of map.items) {
      if (item[1] === x && item[2] === y) {
        item[3] = new_orientation;
        break;
      }
    }
  } else if (cmd === Constant.CMD_MONSTER_BUY_STEP_CASH) {
    const price = args[0];
    console.log("Buy monster step with cash.");
    save.playerInfo.cash = Math.max(Math.trunc(save.playerInfo.cash - price), 0);
    save.privateState.timeStampTakeCareMonster = -1;
  } else if (cmd === Constant.CMD_ACTIVATE_MONSTER) {
    const currency = args[0];
    console.log("Monster nest activated.");
    if (currency === "c") {
      save.playerInfo.cash = Math.max(Math.trunc(save.playerInfo.cash - 50), 0);
    } else if (currency === "g") {
      const map = save.maps;
      map[0].coins = Math.max(Math.trunc(map[0].coins - 100000), 0);
    }
    save.privateState.monsterNestActive = 1;
    save.privateState.timeStampTakeCareMonster = -1;
  } else if (cmd === Constant.CMD_DESACTIVATE_MONSTER) {
    console.log("Monster nest deactivated.");
    const pState = save.privateState;
    pState.monsterNestActive = 0;
    pState.stepMonsterNumber = 0;
    pState.MonsterNumber = 0;
    pState.timeStampTakeCareMonster = -1;
  } else if (cmd === Constant.CMD_NEXT_MONSTER_STEP) {
    console.log("Monster Step increased.");
    const pState = save.privateState;
    pState.stepMonsterNumber += 1;
    pState.timeStampTakeCareMonster = timestamp_now();
  } else if (cmd === Constant.CMD_NEXT_MONSTER) {
    console.log("Monster Step reset and Monster Number increased.");
    const pState = save.privateState;
    pState.stepMonsterNumber = 0;
    pState.monsterNumber += 1;
    pState.timeStampTakeCareMonster = -1;
  } else if (cmd === Constant.CMD_WIN_BONUS) {
    const coins = args[0];
    const town_id = args[1];
    const hero = args[2];
    const claimId = args[3];
    const cash = args[4];
    console.log("Claiming Win Bonus");
    const map = save.maps[town_id];
    if (cash !== 0) {
      save.playerInfo.cash = save.playerInfo.cash + cash;
      console.log("Added " + cash + " Cash to players balance");
    }
    if (coins !== 0) {
      map.coins = map.coins + coins;
      console.log("Added " + coins + " Gold to players balance");
    }
    if (hero !== 0) {
      const length = save.privateState.gifts.length;
      if (length <= hero) {
        for (let i = 0; i < hero - length + 1; i++) save.privateState.gifts.push(0);
      }
      save.privateState.gifts[hero] += 1;
      console.log("Added Hero ID=" + hero);
    }
    const pState = save.privateState;
    pState.bonusNextId = claimId + 1;
    pState.timestampLastBonus = timestamp_now();
  } else if (cmd === Constant.CMD_ADMIN_ADD_ANIMAL) {
    const subcatFunc = String(args[0]);
    const toBeAdded = parseInt(args[1], 10);
    console.log("Added", toBeAdded, get_item_from_subcat_functional(subcatFunc).name);
    const oAnimals = save.privateState.arrayAnimals;
    oAnimals[subcatFunc] = toBeAdded + (subcatFunc in oAnimals ? oAnimals[subcatFunc] : 0);
  } else if (cmd === Constant.CMD_GRAVEYARD_BUY_POTIONS) {
    console.log("Graveyard buy potion");
    const graveyard_potions = get_game_config().globals.GRAVEYARD_POTIONS;
    const amount = graveyard_potions.amount;
    const price_cash = graveyard_potions.price.c;
    save.playerInfo.cash = Math.max(Math.trunc(save.playerInfo.cash - price_cash), 0);
    save.privateState.potion += amount;
  } else if (cmd === Constant.CMD_RESURRECT_HERO) {
    const unit_id = args[0];
    const x = args[1];
    const y = args[2];
    const town_id = args[3];
    const bool_used_potion = args.length > 4 && args[4] === "1";
    console.log("Resurrect", String(get_name_from_item_id(unit_id)), "from graveyard");
    if (bool_used_potion) {
      const quantity = 1;
      save.privateState.potion = Math.max(Math.trunc(save.privateState.potion - quantity), 0);
    }
    const collected_at_timestamp = timestamp_now();
    const level = 0;
    const orientation = 0;
    const map = save.maps[town_id];
    map.items.push([unit_id, x, y, orientation, collected_at_timestamp, level]);
  } else if (cmd === Constant.CMD_BUY_SUPER_OFFER_PACK) {
    const town_id = args[0];
    // const unknown2 = args[1];
    const items = args[2];
    const cash_used = args[3];
    const item_array = String(items).split(",");
    for (const item of item_array) {
      const item_id = parseInt(item, 10);
      const length = save.privateState.gifts.length;
      if (length <= item_id) {
        for (let i = 0; i < item_id - length + 1; i++) save.privateState.gifts.push(0);
      }
      save.privateState.gifts[item_id] += 1;
    }
    save.playerInfo.cash = Math.max(save.playerInfo.cash - cash_used, 0);
    console.log(`Used ${cash_used} cash to buy super offer pack!`);
  } else if (cmd === Constant.CMD_SET_STRATEGY) {
    const strategy_type = args[0];
    const type_name = get_strategy_type(strategy_type);
    save.privateState.strategy = strategy_type;
    console.log(`Set defense strategy type to ${type_name}`);
  } else if (cmd === Constant.CMD_START_QUEST) {
    const quest_id = args[0];
    // const town_id = args[1];
    console.log(`Start quest ${quest_id}`);
  } else if (cmd === Constant.CMD_END_QUEST) {
    const d = JSON.parse(args[0]);
    const town_id = d.map;
    const gold_gained = d.resources.g;
    const xp_gained = d.resources.x;
    const quest_id = parseInt(d.quest_id, 10);
    save.maps[town_id].coins += parseInt(gold_gained, 10);
    save.maps[town_id].xp += parseInt(xp_gained, 10);
    save.privateState.unlockedQuestIndex = Math.max(
      quest_id + 1,
      save.privateState.unlockedQuestIndex,
      0
    );
    console.log(`Ended quest ${quest_id}.`);
  } else if (cmd === Constant.CMD_ADD_COLLECTABLE) {
    // const collection_id = args[0];
    // const collectible_id = args[1];
    // TODO
  } else {
    console.log(`Unhandled command '${cmd}' -> args`, args);
    return;
  }
}

module.exports = { command, do_command };
