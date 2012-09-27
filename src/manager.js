var settings = require("./settings");

function Manager(client) {
  this.client = client;
  this.handlers = {};
};

Manager.prototype.playerJoined = function(gameId, playerNumber, playerName, isMe) {
  var handler = this.handlers[gameId];
  if(handler !== undefined) {
    handler.playerJoined(playerNumber, playerName, isMe);
  }
}

Manager.prototype.playerLeft = function(gameId, playerNumber) {
  var handler = this.handlers[gameId];
  if(handler !== undefined) {
    handler.playerLeft(playerNumber);
  }
}

Manager.prototype.unitBanned = function(unitType) {
}

Manager.prototype.unitUnbanned = function(unitType) {
}

Manager.prototype.gameStarted = function(gameId) {
  var handler = this.handlers[gameId];
  if(handler !== undefined) {
    handler.gameStarted();
  }
}

Manager.prototype.gameFinished = function(gameId) {
  var handler = this.handlers[gameId];
  if(handler !== undefined) {
    handler.gameFinished();
  }
}

Manager.prototype.gameTurnChange = function(gameId, newTurn, newRound, turnRemaining) {
  console.log("Manager.gameTurnChange");
  var handler = this.handlers[gameId];
  if(handler !== undefined) {
    handler.gameTurnChange(newTurn, newRound, turnRemaining);
  }
}

Manager.prototype.gameEvents = function(gameId, events) {
  var handler = this.handlers[gameId];
  if(handler !== undefined) {
    handler.gameEvents(events);
  }
}

Manager.prototype.chatMessage = function(messageInfo) {
}

exports.Manager = Manager;
