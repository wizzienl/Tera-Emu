const _ = require('lodash');

module.exports = {
    id: 'independent',
    name: 'Independent',
    description: `You win only when you are the last one standing!`,
    isVictory: function(p) {
        var livePlayers = _.filter(p.game.players, 'alive');
        // only self is alive
        return livePlayers.length === 1 && livePlayers[0].id === p.player.id;
    },
};