function Handler(client, game) {
  this.client = client;
  this.game = game;
};

exports.Handler = Handler;

Handler.prototype.playerJoined = function(playerNumber, playerName, isMe) {
}

Handler.prototype.playerLeft = function(playerNumber) {
}

Handler.prototype.gameStarted = function(gameId) {
}

Handler.prototype.gameFinished = function(gameId) {
}

Handler.prototype.gameTurnChange = function(newTurn, newRound, turnRemaining) {
}

Handler.prototype.gameEvents = function(events) {
  console.log(events);
}

Handler.prototype.doTurn = function() {
  console.log("Playing a turn");
}

