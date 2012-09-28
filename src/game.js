var GameLogic = require("./GameLogic").GameLogic;

function Game(client, info, rules) {
  this.client = client;
  this.info = info;
  this.data = null;
  this.logic = new GameLogic(this, rules);
}

exports.Game = Game;

Game.prototype.update = function(cb) {
  var that = this;
  this.client.stub.gameData(this.info.gameId, function(result) {
    that.data = result.game;
    if(cb) cb(that.data);
  });
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

Game.prototype.moveAndAttack = function() {

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

  this.client.stub.moveAndWait(this.info.gameId, dst.unit.unitId, {x: dx, y: dy}, path);
  return true;
}

Game.prototype.moveAndCapture = function() {

}

Game.prototype.moveAndDeploy = function() {

}

Game.prototype.undeploy = function() {

}

Game.prototype.moveAndLoadInto = function() {

}

Game.prototype.moveAndUnload = function() {

}

Game.prototype.build = function() {

}

Game.prototype.endTurn = function() {
  this.client.stub.endTurn(this.info.gameId);
}

Game.prototype.surrender = function() {

}

