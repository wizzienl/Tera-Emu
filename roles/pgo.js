const _ = require('lodash');
const ext = require('../lib/ext.js');

module.exports = ext(require('./tmpls/noAction.js'), {
    id: 'pgo',
    name: 'Paranoid Gun Owner',
    description: `You have no active abilities, but you will shoot to death anyone who targets you at night.`,
    hasGun: true,
    onActionPhase: function(p) {
        var actionsTargetingMe = _.filter(p.game.nightActions, {targetId: p.player.id});
        for (var i = 0; i < actionsTargetingMe.length; i++) {
            var action = actionsTargetingMe[i];
            p.game.nightKills[action.playerId] = (p.game.nightKills[action.playerId] || 0) + bulletKill;
        }
    },
});