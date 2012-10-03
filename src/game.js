var GameLogic = require("./GameLogic").GameLogic;

function Game(client, gameId, rules) {
  this.client = client;
  this.gameId = gameId;
  this.data = null;
  this.logic = new GameLogic(this, rules);
  this.rules = rules;
}

exports.Game = Game;

Game.prototype.update = function(cb) {
  var that = this;
  this.client.stub.gameData(this.gameId, function(result) {
    that.data = result.game;
    if(cb) cb(that.data);
  });
}

Game.prototype.currentPlayer = function() {
  for(var i = 0; i < this.data.players.length; ++i) {
    if(this.data.players[i].playerNumber == this.data.inTurnNumber) {
      return this.data.players[i];
    }
  }
}

Game.prototype.getTile = function(x, y) {
  if(x !== undefined && y !== undefined) {
    return this.data.tiles.filter(function(d) {
      if(d.x == x && d.y == y) return true;
    })[0];
  } else if(x !== undefined) {
    var tiles = this.data.tiles.filter(function(tile){
      return tile.tileId == x;
    });
    return tiles.length != 0 ? tiles[0] : null;
  } else {
    return null;
  }
}

Game.prototype.getMapArray = function() {
  var mapArray = {};
  this.data.tiles.forEach(function(tile){
    if(mapArray[tile.y] === undefined) {
      mapArray[tile.y] = {};
    }

    mapArray[tile.y][tile.x] = tile;
  });

  return mapArray;
}

Game.prototype.getTiles = function(conditions) {
  if(conditions === undefined) {
    conditions = {};
  }

  var result = [];

  for(var i = 0; i < this.data.tiles.length; ++i) {
    var tile = this.data.tiles[i];
    var terrain = this.rules.terrains[tile.type];

    if(conditions.canBuild !== undefined && (terrain.buildTypes.length !== 0) !== conditions.canBuild) {
      continue;
    }

    if(conditions.owner !== undefined && tile.owner !== conditions.owner) {
      continue;
    }

    if(conditions.notOwner !== undefined && tile.owner === conditions.owner) {
      continue;
    }

    if(conditions.capturable !== undefined) {
      var isCapturable = false;
      for(var j = 0; j < terrain.flags.length; ++j) {
        if(this.rules.terrainFlags[terrain.flags[j]].name == "Capturable") {
          isCapturable = true;
          break;
        }
      }

      if(isCapturable != conditions.capturable) {
        continue;
      }
    }

    if(conditions.hasUnit !== undefined && (tile.unit !== null) !== conditions.hasUnit) {
      continue;
    }

    if(conditions.unitOwner !== undefined && tile.unit !== null && tile.unit.owner !== conditions.unitOwner) {
      continue;
    }

    if(conditions.notUnitOwner !== undefined && tile.unit !== null && tile.unit.owner === conditions.notUnitOwner) {
      continue;
    }

    result.push(tile);
  }

  return result;
}

Game.prototype.moveAndAttack = function(x, y, dx, dy, tx, ty) {
 var path = this.logic.unitCanMoveTo(x, y, dx, dy)
  if(!path) {
    return false;
  }

  var attackOpts = this.logic.unitAttackOptions(x, y, dx, dy);
  if(!attackOpts) {
    return false;
  }

  var attack = attackOpts.filter(function(o) {
    return o.pos.x == tx && o.pos.y == ty;
  })[0];

  if(!attack) {
    return false;
  }

  var src = this.getTile(x, y);
  var dst = this.getTile(dx, dy);
  var target = this.getTile(tx, ty);

  if(x != dx || y != dy) {
    dst.unit = src.unit;
    src.unit = null;
  }

  this.client.stub.moveAndAttack(this.gameId, dst.unit.unitId, {x: dx, y: dy}, path, target.unit.unitId);

  target.unit.health -= attack.power;
  if(target.unit.health <= 0) {
    target.unit = null;
  }

  return true;
}

Game.prototype.moveAndWait = function(x, y, dx, dy) {
 var path = this.logic.unitCanMoveTo(x, y, dx, dy)
  if(!path) {
    return false;
  }

  var src = this.getTile(x, y);
  var dst = this.getTile(dx, dy);

  if(x != dx || y != dy) {
    dst.unit = src.unit;
    src.unit = null;
  }

  this.client.stub.moveAndWait(this.gameId, dst.unit.unitId, {x: dx, y: dy}, path);
  return true;
}

Game.prototype.moveAndCapture = function(x, y, dx, dy) {
 var path = this.logic.unitCanMoveTo(x, y, dx, dy)
  if(!path || !this.logic.unitCanCapture(x, y, dx, dy)) {
    return false;
  }

  var src = this.getTile(x, y);
  var dst = this.getTile(dx, dy);

  if(x != dx || y != dy) {
    dst.unit = src.unit;
    src.unit = null;
  }

  dst.unit.capturing = true;
  dst.capturePoints -= dst.unit.health;
  if(dst.capturePoints <= 0) {
    dst.owner = dst.unit.owner;
    dst.capturePoints = 1;
  }

  this.client.stub.moveAndCapture(this.gameId, dst.unit.unitId, {x: dx, y: dy}, path);
  return true;
}

Game.prototype.moveAndDeploy = function(x, y, dx, dy) {
 var path = this.logic.unitCanMoveTo(x, y, dx, dy)
  if(!path || !this.logic.unitCanDeploy(x, y, dx, dy)) {
    return false;
  }

  var src = this.getTile(x, y);
  var dst = this.getTile(dx, dy);

  if(x != dx || y != dy) {
    dst.unit = src.unit;
    src.unit = null;
  }

  dst.unit.deployed = true;

  this.client.stub.moveAndDeploy(this.gameId, dst.unit.unitId, {x: dx, y: dy}, path);
  return true;
}

Game.prototype.undeploy = function(x, y) {
 if(!this.logic.unitCanUndeploy(x, y)) {
    return false;
  }
  var dst = this.getTile(x, y);
  dst.unit.deployed = false;

  this.client.stub.undeploy(this.gameId, dst.unit.unitId);
  return true;
}

Game.prototype.moveAndLoadInto = function(x, y, dx, dy) {
 var path = this.logic.unitCanMoveTo(x, y, dx, dy)
  if(!path || !this.logic.unitCanLoadInto(x, y, dx, dy)) {
    return false;
  }

  var src = this.getTile(x, y);
  var dst = this.getTile(dx, dy);
  var unit = src.unit;
  dst.unit.carriedUnits.push(src.unit);
  src.unit = null;

  this.client.stub.moveAndLoadInto(this.gameId, unit.unitId, dst.unit.unitId, path);
  return true;
}

Game.prototype.moveAndUnload = function(x, y, dx, dy, tx, ty, unitId) {
 var path = this.logic.unitCanMoveTo(x, y, dx, dy)
  if(!path) {
    return false;
  }

  var unloadOpts = this.logic.unitUnloadOptions(x, y, dx, dy);
  if(!unloadOpts || unloadOpts.length == 0) {
    return false;
  }

  var canUnloadUnit = unloadOpts.filter(function(o) {
    return o.unitId == unitId;
  }).length > 0;

  if(!canUnloadUnit) {
    return false;
  }

  var unloadTargetOpts = this.logic.unitUnloadTargetOptions(x, y, dx, dy, unitId);
  if(!unloadTargetOpts || unloadTargetOpts.length == 0) {
    return false;
  }

  var canUnloadToTarget = unloadTargetOpts.filter(function(o) {
    return o.x == tx && o.y == ty;
  }).length > 0;

  if(!canUnloadToTarget) {
    return false;
  }

  var src = this.getTile(x, y);
  var dst = this.getTile(dx, dy);
  var target = this.getTile(tx, ty);

  if(x != dx || y != dy) {
    dst.unit = src.unit;
    src.unit = null;
  }

  target.unit = dst.unit.carriedUnits.filter(function(u) {
    return u.unitId == unitId;
  })[0];

  this.client.stub.moveAndUnload(this.gameId, dst.unit.unitId, {x: dx, y: dy}, path, unitId, {x: tx, y: ty});

  return true;
}

Game.prototype.build = function(x, y, unitTypeId) {
 if(!this.logic.tileCanBuild(this.data.inTurnNumber, x, y)) {
    return false;
  }

  var opts = this.logic.tileBuildOptions(x, y);
  if(!opts || opts.length == 0) {
    return false;
  }

  var canBuildUnit = opts.filter(function(o) {
    return o.id == unitTypeId;
  }).length > 0;

  var unitType = this.rules.units[unitTypeId];
  var player = this.currentPlayer();
  if(!canBuildUnit || player.funds < unitType.price) {
    return false;
  }

  var tile = this.getTile(x, y);
  tile.unit = {
    "unitId": null,
    "tileId": tile.tileId,
    "type": unitTypeId,
    "owner": this.data.inTurnNumber,
    "carriedBy": null,
    "health": 100,
    "deployed": false,
    "moved": true,
    "capturing": false,
    "carriedUnits": []
  };

  player.funds -= unitType.price;

  this.client.stub.build(this.gameId, unitTypeId, {x: x, y: y});
}

Game.prototype.endTurn = function() {
 this.client.stub.endTurn(this.gameId);
}

Game.prototype.surrender = function() {

}

