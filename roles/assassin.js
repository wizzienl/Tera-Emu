const _ = require('lodash');
const ext = require('../lib/ext.js');
const s = require('../lib/pluralize.js');

module.exports = ext(require('./tmpls/singleTarget.js'), {
    id: 'assassin',
    name: 'Assassin',
    get description () { return `You can choose to assassinate someone during night, *${s(this.ammo, 'time')}* in the whole game, with the *${pre}assassinate* command.`; },
    command: 'assassinate',
    commandGerund: 'assassinating',
    commandText: 'assassinate a target',
    actionText: 'assassin assassinate',
    ammo: 1,
    onGameStart: function(p) {
        p.player.roleData.ammo = this.ammo;
    },
    canDoAction: function(p) {
        return p.player.roleData.ammo > 0 ? true : 'You cannot assassinate anyone else for the rest of the game.';
    },
    preBlockingPhase: function(p) { // can't be roleblocked or bus'd or anything
        var action = _.find(p.game.nightActions, {action: this.actionText, playerId: p.player.id});
        if (action) {
            p.player.roleData.ammo--;
            p.game.nightKills[action.targetId] = (p.game.nightKills[action.targetId] || 0) + Infinity; // infinity so doctor can't save
        }
    },
});