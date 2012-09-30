function Bot(game) {
  this.game = game;
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

  for(var t = 0; t < this.game.data.tiles.length; ++t) {
    var tile = this.game.data.tiles[t];
    if(!this.game.logic.tileCanBuild(this.game.data.inTurnNumber, tile.x, tile.y)) {
      continue;
    }

    var funds = this.game.currentPlayer().funds;

    var opts = this.game.logic.tileBuildOptions(tile.x, tile.y);

    if(!opts || opts.length == 0) {
      continue;
    }

    opts = opts.filter(function(o) {
      return o.price <= funds;
    });

    opts.push(null);

    var unitType = pick(opts);

    if(unitType === null) {
      continue;
    }

    this.game.build(tile.x, tile.y, unitType.id);
  }

  this.game.endTurn();
}

Bot.prototype.doUnit = function(tile, unit) {
  var bestAction = {score: -Infinity};

  var opts = this.game.logic.unitMovementOptions(tile.x, tile.y);
  for(var i = 0; i < opts.length; ++i) {
    var dst = opts[i].pos;
    var dstTile = this.game.getTile(dst.x, dst.y);
    var ownTile = dstTile.owner == this.game.data.inTurnNumber;
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
      if(tileCanBuild) {
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
    var score = this.game.logic.getDistance(dst.x, dst.y, tile.x, tile.y);

    if(tileCanBuild) {
      score += ownTile ? -1000 : 1000;
    }

    for(var t = 0; t < this.game.data.tiles.length; ++t) {
      var tt = this.game.data.tiles[t];
      var tType = this.game.rules.terrains[tt.type];
      if(tt.owner != this.game.data.inTurnNumber && tType.buildTypes.length > 0) {
        score -= this.game.logic.getDistance(tt.x, tt.y, dst.x, dst.y);
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

  console.log("best action");
  console.log(bestAction);
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
