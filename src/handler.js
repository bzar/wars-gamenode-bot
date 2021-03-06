var settings = require("./settings");
var Game = require("./game").Game;
var Bot = require("./bots/" + settings.bot).Bot;

function Handler(client, gameId, playerNumber) {
  this.client = client;
  this.playerNumber = playerNumber;

  this.bot = null;
  this.game = null;

  var that = this;


  client.stub.subscribeGame(gameId, function() {
    client.stub.gameRules(gameId, function(rules) {
      that.game = new Game(client, gameId, rules);
      that.bot = new Bot(that.game, playerNumber);
      that.doTurn();
    });
  });
};

exports.Handler = Handler;

Handler.prototype.playerJoined = function(playerNumber, playerName, isMe) {
}

Handler.prototype.playerLeft = function(playerNumber) {
}

Handler.prototype.gameStarted = function() {
  var that = this;
  setTimeout( function() {
    that.doTurn();
  }, 1000);
}

Handler.prototype.gameFinished = function() {
}

Handler.prototype.gameTurnChange = function(newTurn, newRound, turnRemaining) {
  if(newTurn == this.playerNumber) {
    this.doTurn();
  }
}

Handler.prototype.doTurn = function()  {
  var that = this;
  this.game.update(function(gameData) {
    if(gameData.inTurnNumber == that.playerNumber) {
      console.log("Playing turn " + that.game.data.turnNumber + " (round " + that.game.data.roundNumber + ") of game " + that.game.gameId + " as player " + that.playerNumber);
      try {
        that.bot.doTurn();
      } catch(e) {
        console.log(e);
        throw e;
      }
    }
  });
}

Handler.prototype.gameEvents = function(events) {
}

