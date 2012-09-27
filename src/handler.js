var settings = require("./settings");
var Game = require("./game").Game;
var Bot = require("./bots/" + settings.bot).Bot;

function Handler(client, gameInfo) {
  this.client = client;
  var game = new Game(client, gameInfo);
  var bot = new Bot(game);

  this.bot = bot;
  this.game = game;

  client.stub.subscribeGame(gameInfo.gameId, function(result) {
    game.update(function(gameData) {
      for(var i = 0; i < gameData.players.length; ++i) {
        if(gameData.players[i].playerNumber == gameData.inTurnNumber) {
          if(gameData.players[i].isMe) {
            bot.doTurn();
          }
        }
      }
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
  console.log("gameTurnChange");
  for(var i = 0; i < this.game.data.players.length; ++i) {
    if(this.game.data.players[i].playerNumber == newTurn) {
      console.log("found player");
      if(this.game.data.players[i].isMe) {
        console.log("is me");
        var bot = this.bot;
        this.game.update(function(gameData) {
          console.log("updated, doing turn");
          bot.doTurn();
        });
      }
    }
  }
}

Handler.prototype.gameEvents = function(events) {
  console.log(events);
}

