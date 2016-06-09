const _ = require('lodash');
const STATE = require('../../lib/gameStates.js');

module.exports = {
    isFinished: function(p) {
        return true;
    },
    onNight: function(p) {
        p.mafiabot.sendMessage(p.player.id, `You don't have any active actions to do tonight, so just relax until the night is over!`);
    },
};