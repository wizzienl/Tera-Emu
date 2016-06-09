const _ = require('lodash');

module.exports = {
    id: 'town',
    name: 'Town',
    description: `You win when all the scum (Mafia, Serial Killers, etc.) are dead. However, you don't know exactly who are your fellow townies and who is scum.`,
    isVictory: function(p) {
        // only townies left alive
        var livePlayers = _.filter(p.game.players, 'alive');
        var townieCount = _.filter(livePlayers, {faction: this.id}).length;
        return townieCount === livePlayers.length;
    },
};