const _ = require('lodash');
const s = require('../lib/pluralize.js');
const ext = require('../lib/ext.js');

module.exports = ext(require('./tmpls/singleTarget.js'), {
    id: 'tracker',
    name: 'Tracker',
    description: `You can track someone at night to see who they targeted with the *${pre}track* command.`,
    command: 'track',
    commandGerund: 'tracking',
    commandText: 'track a target to see who they targeted',
    actionText: 'tracker track',
    onActionPhase: function(p) {
        var action = _.find(p.game.nightActions, {action: this.actionText, playerId: p.player.id});
        if (action) {
            var targetActionTargets = _.uniq(_.filter(p.game.nightActions, {playerId: action.targetId}).map(act => act.targetId));
            if (targetActionTargets.length) {
                p.mafiabot.sendMessage(action.playerId, `Your target **<@${action.targetId}>** targeted **${s(targetActionTargets.length, 'player')}** last night: ${targetActionTargets.map(targetId => '<@' + targetId + '>').join(', ')}`);
            } else {
                p.mafiabot.sendMessage(action.playerId, `Your target **<@${action.targetId}>** did not target any players last night.`);
            }
        }
    },
});