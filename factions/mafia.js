const _ = require('lodash');

module.exports = {
    id: 'mafia',
    name: 'Mafia',
    description: `You win when your team controls half or more of the remaining town, and all other scum teams (3rd party, Serial Killer, etc.) are dead. You share a chat with your fellow mafia team members.`,
    isVictory: function(p) {
        // no 3rd party alive
        var livePlayers = _.filter(p.game.players, 'alive');
        for (var i = 0; i < livePlayers.length; i++) {
            if (livePlayers[i].faction != this.id && livePlayers[i].faction != 'town') {
                return false;
            }
        }
        // and half or more of live players are mafia
        var mafiaCount = _.filter(livePlayers, {faction: this.id}).length;
        return mafiaCount >= livePlayers.length/2;
    },
};