const _ = require('lodash');
const ext = require('../lib/ext.js');
const s = require('../lib/pluralize.js');

module.exports = ext(require('./tmpls/singleTarget.js'), {
    id: 'poisoner',
    name: 'Poisoner',
    get description () { return `You can poison someone during night, which kills them one night later, *${s(this.ammo, 'time')}* in the whole game, with the *${pre}poison* command.`; },
    command: 'poison',
    commandGerund: 'poisoning',
    commandText: 'poison a target',
    actionText: 'poisoner poison',
    ammo: 1,
    onGameStart: function(p) {
        p.player.roleData.ammo = this.ammo;
    },
    canDoAction: function(p) {
        return p.player.roleData.ammo > 0 ? true : 'You are out of poison for the rest of the game.';
    },
    preBlockingPhase: function(p) {
        if (p.player.roleData.poisonedTarget) {
            p.game.nightKills[p.player.roleData.poisonedTarget] = (p.game.nightKills[p.player.roleData.poisonedTarget] || 0) + 1;
            p.player.roleData.poisonedTarget = null;
        }
    },
    onActionPhase: function(p) {
        var action = _.find(p.game.nightActions, {action: this.actionText, playerId: p.player.id});
        if (action) {
            p.player.roleData.ammo--;
            p.player.roleData.poisonedTarget = action.targetId;
        }
    },
});