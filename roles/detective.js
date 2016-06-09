const _ = require('lodash');
const ext = require('../lib/ext.js');

module.exports = ext(require('./tmpls/singleTarget.js'), {
    id: 'detective',
    name: 'Detective',
    description: `You can scan someone to determine their role each night with the *${pre}scan* command.`,
    command: 'scan',
    commandGerund: 'scanning',
    commandText: 'determine the role of a target',
    actionText: 'detective scan',
    hasGun: true,
    onActionPhase: function(p) {
        var action = _.find(p.game.nightActions, {action: this.actionText, playerId: p.player.id});
        if (action) {
            var target = _.find(p.game.players, {id: action.targetId});
            p.mafiabot.sendMessage(action.playerId, `You have scanned player **<@${action.targetId}>**'s role as **${target.role}**!`);
        }
    },
});