const _ = require('lodash');
const ext = require('../lib/ext.js');

module.exports = ext(require('./tmpls/singleTarget.js'), {
    id: 'cop',
    name: 'Cop',
    description: `You can scan someone to determine if they are innocent or not each night with the *${pre}scan* command.`,
    command: 'scan',
    commandGerund: 'scanning',
    commandText: 'determine the innocence of a target',
    actionText: 'cop scan',
    hasGun: true,
    onActionPhase: function(p) {
        var action = _.find(p.game.nightActions, {action: this.actionText, playerId: p.player.id});
        if (action) {
            var target = _.find(p.game.players, {id: action.targetId});
            var targetRole = p.mafiabot.getRole(target.role);
            var innocent = targetRole.forceInnocent != null ? targetRole.forceInnocent : target.faction != 'mafia';
            if (this.innocenceModifier) {
                innocent = this.innocenceModifier(innocent); // allows for cop variants
            }
            p.mafiabot.sendMessage(action.playerId, `You have scanned player **<@${action.targetId}>** as **${innocent ? 'INNOCENT' : 'SCUM'}**!`);
        }
    },
});