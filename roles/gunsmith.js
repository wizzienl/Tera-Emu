const _ = require('lodash');
const ext = require('../lib/ext.js');

module.exports = ext(require('./tmpls/singleTarget.js'), {
    id: 'gunsmith',
    name: 'Gunsmith',
    description: `You can scan someone to determine if they have a gun (Mafia, Cop, Vigilante, etc.) or not each night with the *${pre}scan* command.`,
    command: 'scan',
    commandGerund: 'scanning',
    commandText: 'determine if the target has a gun',
    actionText: 'gunsmith scan',
    onActionPhase: function(p) {
        var action = _.find(p.game.nightActions, {action: this.actionText, playerId: p.player.id});
        if (action) {
            var target = _.find(p.game.players, {id: action.targetId});
            var targetRole = p.mafiabot.getRole(target.role);
            var hasGun = targetRole.hasGun != null ? targetRole.hasGun : target.faction === 'mafia';
            p.mafiabot.sendMessage(action.playerId, `You ${hasGun ? '**DID**' : 'did not'} find a gun on scanned player **<@${action.targetId}>**!`);
        }
    },
});