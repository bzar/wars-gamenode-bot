function BuildProfile(game) {
  this.game = game;
  this.effectivityMap = {};

  for(targetTypeId in this.game.rules.units) {
    var targetType = this.game.rules.units[targetTypeId];
    var effectivities = [];
    this.effectivityMap[targetType.id] = effectivities;
    for(unitTypeId in this.game.rules.units) {
      var unitType = this.game.rules.units[unitTypeId];
      while(effectivities[unitTypeId] === undefined) {
        effectivities.push(0);
      }


      if(unitType.primaryWeapon != null) {
        var weapon = this.game.rules.weapons[unitType.primaryWeapon];
        if(weapon.powerMap[targetType.armor]) {
          effectivities[unitTypeId] += weapon.powerMap[targetType.armor] * targetType.price / unitType.price;
        }
      }

      if(unitType.secondaryWeapon != null) {
        var weapon = this.game.rules.weapons[unitType.secondaryWeapon];
        if(weapon.powerMap[targetType.armor]) {
          effectivities[unitTypeId] += weapon.powerMap[targetType.armor] * targetType.price / unitType.price;
        }
      }
    }
  }
}

function Bot(game) {
  this.game = game;
  this.buildProfile = new BuildProfile(game);
}

exports.Bot = Bot;

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}


Bot.prototype.doTurn = function() {
  for(var t = 0; t < this.game.data.tiles.length; ++t) {
    var tile = this.game.data.tiles[t];
    var unit = tile.unit;
    if(!unit || unit.owner != this.game.data.inTurnNumber || unit.moved) {
      continue;
    }

    this.doUnit(tile, unit);
  }

  var buildTiles = [];
  for(var t = 0; t < this.game.data.tiles.length; ++t) {
    var tile = this.game.data.tiles[t];
    if(!this.game.logic.tileCanBuild(this.game.data.inTurnNumber, tile.x, tile.y)) {
      continue;
    }

    var threat = this.buildProfile.evaluateThreat(tile);
    buildTiles.push({tile: tile, threat: threat});
  }

  buildTiles.sort(function(a, b) {
    return b.threat.total - a.threat.total;
  });

  for(var i = 0; i < buildTiles.length; ++i) {
    var tile = buildTiles[i].tile;
    var unitType = this.buildProfile.chooseUnitToBuild(tile);
    this.game.build(tile.x, tile.y, unitType);
  }

  this.game.endTurn();
}

Bot.prototype.doUnit = function(tile, unit) {
  var bestAction = {score: -Infinity};
  var unitType = this.game.rules.units[unit.type];
  var canCapture = false;
  for(var f = 0; f < unitType.flags.length; ++f) {
    var flag = this.game.rules.unitFlags[unitType.flags[f]];
    if(flag.name == "Capture") {
      canCapture = true;
      break;
    }
  }

  var opts = this.game.logic.unitMovementOptions(tile.x, tile.y);
  for(var i = 0; i < opts.length; ++i) {
    var dst = opts[i].pos;
    var dstTile = this.game.getTile(dst.x, dst.y);
    var ownTile = dstTile.owner == this.game.data.inTurnNumber;
    var neutralTile = dstTile.owner == 0;
    var tileCanBuild = this.game.rules.terrains[dstTile.type].buildTypes.length > 0;

    var attackOpts = this.game.logic.unitAttackOptions(tile.x, tile.y, dst.x, dst.y);

    if(this.game.logic.unitCanCapture(tile.x, tile.y, dst.x, dst.y)) {
      var toCapture = this.game.getTile(tile.x, tile.y);
      var score = 200 - (toCapture.capturePoints - unit.health);
      if(score > bestAction.score) {
        bestAction = {
          score: score,
          dst: dst,
          action: "capture"
        };
      }
    }

    if(attackOpts && attackOpts.length > 0) {
      for(var j = 0; j < attackOpts.length; ++j) {
        var attack = attackOpts[j];
        var score = attack.power;
        if(score > bestAction.score) {
          bestAction = {
            score: score,
            dst: dst,
            action: "attack",
            target: attack.pos
          };
        }

      }
    }

    if(this.game.logic.unitCanDeploy(tile.x, tile.y, dst.x, dst.y)) {
      unit.deployed = true;
      var potentialAttacks = this.game.logic.unitAttackOptions(tile.x, tile.y, dst.x, dst.y).length;
      var score = potentialAttacks > 0 ? potentialAttacks : -2000;
      if(tileCanBuild && !neutralTile) {
        score += ownTile ? -2000 : 2000;
      }
      if(score > bestAction.score) {
        bestAction = {
          score: score,
          dst: dst,
          action: "deploy"
        };
      }
      unit.deployed = false;
    }

    if(this.game.logic.unitCanUndeploy(tile.x, tile.y)) {
      var score = -attackOpts.length;
      if(score > bestAction.score) {
        bestAction = {
          score: score,
          action: "undeploy"
        };
      }
    }
/*
    if(this.game.logic.unitCanLoadInto(tile.x, tile.y, dst.x, dst.y)) {

    }

    if(this.game.logic.unitCanUnload(tile.x, tile.y, dst.x, dst.y)) {

    }
*/
    if(bestAction.score < 0)
    {
      var score = this.game.logic.getDistance(dst.x, dst.y, tile.x, tile.y);

      if(tileCanBuild && !neutralTile) {
        score += ownTile ? -1000 : 1000;
      }

      for(var t = 0; t < this.game.data.tiles.length; ++t) {
        var tt = this.game.data.tiles[t];
        var tType = this.game.rules.terrains[tt.type];
        var isNeutral = tt.owner == 0;
        var capturable = false;
        for(var f = 0; f < tType.flags.length; ++f) {
          var flag = this.game.rules.terrainFlags[tType.flags[f]];
          if(flag.name == "Capturable") {
            capturable = true;
            break;
          }
        }

        if(tt.owner != this.game.data.inTurnNumber && capturable) {
          var distance = this.game.logic.getDistance(tt.x, tt.y, dst.x, dst.y);
          var canBuild = tType.buildTypes.length > 0;
          var importance = (canBuild ? 3 : 1)  * (canCapture ? 2 : 1) * (isNeutral ? 3 : 1);
          score -= distance / importance;
        }
      }

      if(score > bestAction.score) {
        bestAction = {
          score: score,
          action: "move",
          dst: dst
        };
      }
    }
  }

  if(bestAction.action == "capture") {
    this.game.moveAndCapture(tile.x, tile.y, bestAction.dst.x, bestAction.dst.y);
  } else if(bestAction.action == "attack") {
    this.game.moveAndAttack(tile.x, tile.y, bestAction.dst.x,bestAction. dst.y, bestAction.target.x, bestAction.target.y);
  } else if(bestAction.action == "deploy") {
    this.game.moveAndDeploy(tile.x, tile.y, bestAction.dst.x, bestAction.dst.y);
  } else if(bestAction.action == "undeploy") {
    this.game.undeploy(tile.x, tile.y);
  } else if(bestAction.action == "load") {

  } else if(bestAction.action == "unload") {

  } else if(bestAction.action == "move") {
    this.game.moveAndWait(tile.x, tile.y, bestAction.dst.x, bestAction.dst.y);
  }

  unit.moved = true;
}

BuildProfile.prototype.evaluateThreat = function(tile) {
  var enemies = [];
  for(var t = 0; t < this.game.data.tiles.length; ++t) {
    var tt = this.game.data.tiles[t];
    if(tt.unit !== null && tt.unit.owner != this.game.data.inTurnNumber) {
      while(enemies[tt.unit.type] === undefined) {
        enemies.push(0);
      }
      enemies[tt.unit.type] += 1.0 / this.game.logic.getDistance(tile.x, tile.y, tt.x, tt.y);
    }
  }

  var totalThreat = 0;
  for(var i = 0; i < enemies.length; ++i) {
    totalThreat += enemies[i];
  }

  return {total: totalThreat, byType: enemies};
}
BuildProfile.prototype.chooseUnitToBuild = function(tile) {
  var threat = this.evaluateThreat(tile);

  var threatToCounterValue = Math.random() * threat.total;
  var threatToCounter = 0;
  for(var i = 0; i < threat.byType.length; ++i) {
    threatToCounterValue -= threat.byType[i];
    if(threatToCounterValue <= 0) {
      threatToCounter = i;
      break;
    }
  };

  var unitEffectivities = this.effectivityMap[threatToCounter];
  var effectivities = [];
  for(e in unitEffectivities) {
    effectivities.push({unitType: e, effectivity: unitEffectivities[e]});
  }

  effectivities.sort(function(a, b) {
    return b.effectivity - a.effectivity;
  });

  var opts = this.game.logic.tileBuildOptions(tile.x, tile.y);
  var funds = this.game.currentPlayer().funds;

  opts = opts.filter(function(o) {
    return o.price <= funds;
  });

  effectivities.filter(function(e) {
    for(var i = 0; i < opts.length; ++i) {
      if(opts[i].type == e.unitType) {
        return true;
      }
    }
    return false;
  });

  var totalEffectivity = 0;
  for(var i = 0; i < effectivities.length; ++i) {
    totalEffectivity += effectivities[i].effectivity;
  }

  var unitTypeValue = Math.random() * totalEffectivity;
  var unitType = 0;
  for(var i = 0; i < effectivities.length; ++i) {
    unitTypeValue -= effectivities[i].effectivity;
    if(unitTypeValue <= 0) {
      unitType = effectivities[i].unitType;
      break;
    }
  };

  return unitType;
}