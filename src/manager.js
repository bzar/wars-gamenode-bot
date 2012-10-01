var settings = require("./settings");
var Handler = require("./handler").Handler;

function Manager(client) {
  this.client = client;
  this.handlers = {};
  this.local = new ManagerLocal(this);
};

exports.Manager = Manager;

function ManagerLocal(manager) {
  this.manager = manager;
}

Manager.prototype.playerJoined = function(gameId, playerNumber, playerName, isMe) {
  this.local.forGameHandlers(gameId, function(handler) {
    handler.playerJoined(playerNumber, playerName, isMe);
  });
}

Manager.prototype.playerLeft = function(gameId, playerNumber) {
  this.local.forGameHandlers(gameId, function(handler) {
    handler.playerLeft(playerNumber);
  });

  if(this.handlers[gameId] !== undefined) {
    this.handlers[gameId] = this.handlers[gameId].filter(function(h) {
      h.playerNumber != playerNumber;
    });
  }
}

Manager.prototype.unitBanned = function(unitType) {
}

Manager.prototype.unitUnbanned = function(unitType) {
}

Manager.prototype.gameStarted = function(gameId) {
  this.local.forGameHandlers(gameId, function(handler) {
    handler.gameStarted();
  });
}

Manager.prototype.gameFinished = function(gameId) {
  this.local.forGameHandlers(gameId, function(handler) {
    handler.gameFinished();
  });

  this.client.stub.leaveGame(gameId);
}

Manager.prototype.gameTurnChange = function(gameId, newTurn, newRound, turnRemaining) {
  this.local.forGameHandlers(gameId, function(handler) {
    handler.gameTurnChange(newTurn, newRound, turnRemaining);
  });
}

Manager.prototype.gameEvents = function(gameId, events) {
  this.local.forGameHandlers(gameId, function(handler) {
    handler.gameEvents(events);
  });
}

Manager.prototype.chatMessage = function(messageInfo) {
}

Manager.prototype.addInvite = function(gameId) {
  var this_ = this;
  this.client.stub.gameData(gameId, function(result) {
    if(result.success) {
      var data = result.game;
      var freePlayerSlot = null;
      data.players.sort(function(a, b) {
        return b.playerNumber - a.playerNumber;
      });

      for(var i = 0; i < data.players.length; ++i) {
        if(data.players[i].userId == null) {
          freePlayerSlot = data.players[i];
        }
      }

      if(freePlayerSlot !== null) {
        this_.client.stub.joinGame(gameId, freePlayerSlot.playerNumber, function(result) {
          if(result.success) {
            this_.local.addGame(gameId);
          }
        });
      }
    }
  });
}

Manager.prototype.removeInvite = function(gameId) {
}

ManagerLocal.prototype.addGame = function(gameId) {
  var manager = this.manager;
  manager.client.stub.gameData(gameId, function(result) {
    if(result.success) {
      if(manager.handlers[gameId] === undefined) {
        manager.handlers[gameId] = [];
      }
      var data = result.game;
      var handlers = manager.handlers[gameId];

      for(var i = 0; i < data.players.length; ++i) {
        var player = data.players[i];
        if(player.isMe) {
          if(handlers.filter(function(h) { return h.playerNumber == player.playerNumber; })[0] === undefined) {
            var handler = new Handler(manager.client, gameId, player.playerNumber);
            handlers.push(handler);
          }
        }
      }
    }
  });
}

ManagerLocal.prototype.forGameHandlers = function(gameId, fun) {
  var handlers = this.manager.handlers[gameId];
  if(handlers === undefined) {
    return;
  }

  for(var i = 0; i < handlers.length; ++i) {
    fun(handlers[i]);
  }
}