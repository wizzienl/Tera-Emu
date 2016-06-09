const _ = require('lodash');
const ext = require('../lib/ext.js');
const s = require('../lib/pluralize.js');

module.exports = ext(require('./tmpls/singleTarget.js'), {
    id: 'vigilante',
    name: 'Vigilante',
    get description () { return `You can choose to shoot someone during night, *${s(this.ammo, 'time')}* in the whole game, with the *${pre}kill* command.`; },
    command: 'kill',
    commandGerund: 'killing',
    commandText: 'kill a target',
    actionText: 'vig kill',
    hasGun: true,
    ammo: 1,
    onGameStart: function(p) {
        p.player.roleData.ammo = this.ammo;
    },
    canDoAction: function(p) {
        return p.player.roleData.ammo > 0 ? true : 'You are out of bullets for the rest of the game.';
    },
    onActionPhase: function(p) {
        var action = _.find(p.game.nightActions, {action: this.actionText, playerId: p.player.id});
        if (action) {
            p.player.roleData.ammo--;
            p.game.nightKills[action.targetId] = (p.game.nightKills[action.targetId] || 0) + bulletKill;
        }
    },
});