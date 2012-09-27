function Bot(game) {
  this.game = game;
}

exports.Bot = Bot;

Bot.prototype.doTurn = function() {
  console.log("Playing a turn");
}

