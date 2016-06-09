const _ = require('lodash');
const ext = require('../lib/ext.js');


module.exports = ext(require('./tmpls/doubleTarget.js'), {
    id: 'busdriver',
    name: 'Bus Driver',
    description: `You can swap all the night action targets between two players each night with the *${pre}bus* command.`,
    command: 'bus',
    commandGerund: 'bus driving',
    commandText: 'swap all night actions that target one player to the other, and vice-versa',
    actionText: 'busdriver bus',
    canSelfTarget: false,
    onTargetingPhase: function(p) {
        var actions = _.filter(p.game.nightActions, {action: this.actionText, playerId: p.player.id});
        if (actions.length == 2) {
            var target1 = actions[0].targetId;
            var target2 = actions[1].targetId;
            for (var i = 0; i < p.game.nightActions.length; i++) {
                var nightAction = p.game.nightActions[i];
                if (nightAction.playerId === p.player.id) {
                    continue;
                }
                if (nightAction.targetId === target1) {
                    nightAction.targetId = target2;
                } else if (nightAction.targetId === target2) {
                    nightAction.targetId = target1;
                }
            }
        }
    },
});