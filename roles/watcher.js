const _ = require('lodash');
const s = require('../lib/pluralize.js');
const ext = require('../lib/ext.js');

module.exports = ext(require('./tmpls/singleTarget.js'), {
    id: 'watcher',
    name: 'Watcher',
    description: `You can watch someone at night to see who targeted them with the *${pre}watch* command.`,
    command: 'watch',
    commandGerund: 'watching',
    commandText: 'watch a target to see who targets them',
    actionText: 'watcher watch',
    onActionPhase: function(p) {
        var action = _.find(p.game.nightActions, {action: this.actionText, playerId: p.player.id});
        if (action) {
            var playersActingOnTarget = _.uniq(_.filter(p.game.nightActions, {targetId: action.targetId}).map(act => act.playerId));
            if (playersActingOnTarget.length) {
                p.mafiabot.sendMessage(action.playerId, `Your target **<@${action.targetId}>** was targeted by **${s(playersActingOnTarget.length, 'player')}** last night: ${playersActingOnTarget.map(playerId => '<@' + playerId + '>').join(', ')}`);
            } else {
                p.mafiabot.sendMessage(action.playerId, `Your target **<@${action.targetId}>** was not targeted by any players last night.`);
            }
        }
    },
});