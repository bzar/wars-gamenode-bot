function Bot(game) {
  this.game = game;
}

exports.Bot = Bot;

Bot.prototype.doTurn = function() {
  this.game.endTurn();
}

