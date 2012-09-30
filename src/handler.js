var settings = require("./settings");
var Game = require("./game").Game;
var Bot = require("./bots/" + settings.bot).Bot;

function Handler(client, gameInfo) {
  this.client = client;

  this.bot = null;
  this.game = null;

  var that = this;

  client.stub.subscribeGame(gameInfo.gameId, function() {
    client.stub.gameRules(gameInfo.gameId, function(rules) {
      that.game = new Game(client, gameInfo, rules);
      that.bot = new Bot(that.game);
      that.game.update(function(gameData) {
        for(var i = 0; i < gameData.players.length; ++i) {
          if(gameData.players[i].playerNumber == gameData.inTurnNumber) {
            if(gameData.players[i].isMe) {
              that.bot.doTurn();
            }
          }
        }
      });
    });
  });
};

exports.Handler = Handler;

Handler.prototype.playerJoined = function(playerNumber, playerName, isMe) {
}

Handler.prototype.playerLeft = function(playerNumber) {
}

Handler.prototype.gameStarted = function() {
}

Handler.prototype.gameFinished = function() {
}

Handler.prototype.gameTurnChange = function(newTurn, newRound, turnRemaining) {
  for(var i = 0; i < this.game.data.players.length; ++i) {
    if(this.game.data.players[i].playerNumber == newTurn) {
      if(this.game.data.players[i].isMe) {
        var bot = this.bot;
        this.game.update(function(gameData) {
          bot.doTurn();
        });
      }
    }
  }
}

Handler.prototype.gameEvents = function(events) {
}

