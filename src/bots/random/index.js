function Bot(game) {
  this.game = game;
}

exports.Bot = Bot;

Bot.prototype.doTurn = function() {
  for(var t = 0; t < this.game.data.tiles.length; ++t) {
    var tile = this.game.data.tiles[t];
    if(tile.unit && tile.unit.owner == this.game.data.inTurnNumber && !tile.unit.moved) {
      tile.unit.moved = true;
      var opts = this.game.logic.unitMovementOptions(tile.x, tile.y);
      if(!opts)
        continue;

      var dst = opts[parseInt(Math.random() * (opts.length - 0.1))];
      this.game.moveAndWait(tile.x, tile.y, dst.pos.x, dst.pos.y);
    }
  }

  this.game.endTurn();
}

