const _ = require('lodash');
const ext = require('../lib/ext.js');

module.exports = ext(require('./tmpls/singleTarget.js'), {
    id: 'serialkiller',
    name: 'Serial Killer',
    description: `You must choose someone to kill every night, with the *${pre}kill* command.`,
    command: 'kill',
    commandGerund: 'killing',
    commandText: 'kill a target',
    actionText: 'serial kill',
    mustDoAction: true,
    onActionPhase: function(p) {
        var action = _.find(p.game.nightActions, {action: this.actionText, playerId: p.player.id});
        if (action) {
            p.game.nightKills[action.targetId] = (p.game.nightKills[action.targetId] || 0) + 1;
        }
    },
}, require('./mods/miller.js').mod);