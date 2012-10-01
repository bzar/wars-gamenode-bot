function Bot(game, playerNumber) {
  this.game = game;
  this.playerNumber = playerNumber;
}

exports.Bot = Bot;

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

Bot.prototype.doTurn = function() {
  for(var t = 0; t < this.game.data.tiles.length; ++t) {
    var tile = this.game.data.tiles[t];
    var unit = tile.unit;
    if(!unit || unit.owner != this.playerNumber || unit.moved) {
      continue;
    }

    var opts = this.game.logic.unitMovementOptions(tile.x, tile.y);
    var dst = pick(opts).pos;

    var actionOptions = []

    var attackOpts = this.game.logic.unitAttackOptions(tile.x, tile.y, dst.x, dst.y);

    if(this.game.logic.unitCanCapture(tile.x, tile.y, dst.x, dst.y)) {
      this.game.moveAndCapture(tile.x, tile.y, dst.x, dst.y);
    } else if(attackOpts && attackOpts.length > 0) {
      var attack = pick(attackOpts);
      this.game.moveAndAttack(tile.x, tile.y, dst.x, dst.y, attack.pos.x, attack.pos.y);
    } else if(this.game.logic.unitCanDeploy(tile.x, tile.y, dst.x, dst.y)) {
      this.game.moveAndDeploy(tile.x, tile.y, dst.x, dst.y);
    } else if(this.game.logic.unitCanUndeploy(tile.x, tile.y)) {
      this.game.undeploy(tile.x, tile.y, dst.x, dst.y);
    } else if(this.game.logic.unitCanLoadInto(tile.x, tile.y, dst.x, dst.y)) {
      this.game.moveAndLoadInto(tile.x, tile.y, dst.x, dst.y);
    } else if(this.game.logic.unitCanUnload(tile.x, tile.y, dst.x, dst.y)) {
      var unloadUnit = pick(this.game.logic.unitUnloadOptions(tile.x, tile.y, dst.x, dst.y)).unitId;
      var unloadTarget = pick(this.game.logic.unitUnloadTargetOptions(tile.x, tile.y, dst.x, dst.y, unloadUnit));
      this.game.moveAndUnload(tile.x, tile.y, dst.x, dst.y, unloadTarget.x, unloadTarget.y, unloadUnit);
    } else {
      this.game.moveAndWait(tile.x, tile.y, dst.x, dst.y);
    }

    unit.moved = true;
  }

  for(var t = 0; t < this.game.data.tiles.length; ++t) {
    var tile = this.game.data.tiles[t];
    if(!this.game.logic.tileCanBuild(this.playerNumber, tile.x, tile.y)) {
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

