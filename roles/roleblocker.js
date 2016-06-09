const _ = require('lodash');
const ext = require('../lib/ext.js');

module.exports = ext(require('./tmpls/singleTarget.js'), {
    id: 'roleblocker',
    name: 'Roleblocker',
    description: `You can block someone from performing their role each night with the *${pre}block* command. Your target gets notified that they were roleblocked if you blocked an action.`,
    command: 'block',
    commandGerund: 'blocking',
    commandText: 'block a target from performing their role',
    actionText: 'roleblocker block',
    onBlockTargetingPhase: function(p) {
        var action = _.find(p.game.nightActions, {action: this.actionText, playerId: p.player.id});
        if (action) {
            var previousNightActionCount = p.game.nightActions.length;
            // all redirecting action texts need to be put in this array!
            const redirectingActions = [
                'busdriver bus',
            ];
            p.game.nightActions = _.reject(p.game.nightActions, action => redirectingActions.indexOf(action.action) >= 0);
            // only send roleblock message when an action was blocked
            if (p.game.nightActions.length !== previousNightActionCount) {
                p.mafiabot.sendMessage(_.find(p.mafiabot.users, {id: action.targetId}), `**You have been roleblocked!**`);                
            }
        }
    },
    onBlockingPhase: function(p) {
        var action = _.find(p.game.nightActions, {action: this.actionText, playerId: p.player.id});
        if (action) {
            var previousNightActionCount = p.game.nightActions.length;
            p.game.nightActions = _.reject(p.game.nightActions, {playerId: action.targetId});
            // only send roleblock message when an action was blocked
            if (p.game.nightActions.length !== previousNightActionCount) {
                p.mafiabot.sendMessage(_.find(p.mafiabot.users, {id: action.targetId}), `**You have been roleblocked!**`);                
            }
        }
    },
});