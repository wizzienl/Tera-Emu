const _ = require('lodash');
const ext = require('../lib/ext.js');

module.exports = ext(require('./tmpls/noAction.js'), {
    id: 'bomb',
    name: 'Bomb',
    description: `You have no active abilities, but when you are lynched, you blow up and kill the last person to lynch you.`,
    onLynched: function(p) {
        var votesOnPlayer = _.filter(p.game.votes, vote => vote.targetId == p.player.id);
        var hammerPlayer = _.find(p.game.players, {id: _.last(_.sortBy(votesOnPlayer, vote => vote.time)).playerId});
        hammerPlayer.alive = false;
        hammerPlayer.deathReason = `Bombed D${p.game.day}`;
        p.mafiabot.syncMessage(p.game.channelId, `💣 **BOOOOOOOOOOOOOOM!!!** 💣`, 2000);
        p.mafiabot.syncMessage(p.game.channelId, `Player <@${hammerPlayer.id}> hammered the bomb <@${p.player.id}> and was blown up.\n`, 2000);
    },
});