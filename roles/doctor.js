const _ = require('lodash');
const ext = require('../lib/ext.js');

module.exports = ext(require('./tmpls/singleTarget.js'), {
    id: 'doctor',
    name: 'Doctor',
    description: `You can save someone from dying each night with the *${pre}save* command.`,
    command: 'save',
    commandGerund: 'saving',
    commandText: 'protect a target from dying tonight',
    actionText: 'doctor save',
    canSelfTarget: false,
    onActionPhase: function(p) {
        var action = _.find(p.game.nightActions, {action: this.actionText, playerId: p.player.id});
        if (action) {
            p.game.nightKills[action.targetId] = (p.game.nightKills[action.targetId] || 0) - 1000;
        }
    },
});