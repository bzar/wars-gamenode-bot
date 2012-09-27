function Game(client, info) {
  this.client = client;
  this.info = info;
  this.data = null;
}

exports.Game = Game;

Game.prototype.update = function(cb) {
  var that = this;
  this.client.stub.gameData(this.info.gameId, function(result) {
    that.data = result.game;
    if(cb) cb(that.data);
  });
}

Game.prototype.moveAndAttack = function() {

}

Game.prototype.moveAndWait = function() {

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

