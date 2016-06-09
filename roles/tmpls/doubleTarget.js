const _ = require('lodash');
const STATE = require('../../lib/gameStates.js');
const closestPlayer = require('../../lib/closestPlayer.js');

module.exports = {
    isFinished: function(p) {
        return Boolean(p.player.roleData.noAction) || Boolean(p.player.roleData.didAction);
    },
    onNight: function(p) {
        p.player.roleData.didAction = false;
        p.player.roleData.noAction = false;
        var output = `It is now night ${p.game.day}! Use the ***${pre}${this.command}*** command with TWO targets to ${this.commandText} (ex: *${pre}${this.command} fool wigs*). ***${pre}cancel*** to cancel.`;
        if (this.mustDoAction) {
            output += `\n**NOTE**: You MUST take an action every night! You cannot use the *${pre}noaction* command like other roles.`;
        } else {
            output += `\nUse the ***${pre}noaction*** command to confirm that you are active but taking no action tonight.`;
        }
        p.mafiabot.sendMessage(p.player.id, output);
    },
    onPMCommand: function(p) {
        if (p.game.state != STATE.NIGHT) {
            return;
        }
        if (p.args[0].toLowerCase() == this.command) {
            var canDoActionResult = this.canDoAction ? this.canDoAction(p) : true;
            if (canDoActionResult === true) {
                var target1 = closestPlayer(p.args[1], p.game.players);
                var target2 = closestPlayer(p.args[2], p.game.players);
                if (target1 && target1.alive) {
                    if (target2 && target2.alive) {
                        if ((target1.id != p.player.id && target2.id != p.player.id) || this.canSelfTarget || this.canSelfTarget == null) {
                            if (target1.id != target2.id) {
                                p.game.nightActions = _.reject(p.game.nightActions, {action: this.actionText, playerId: p.player.id});
                                p.game.nightActions.push({
                                    action: this.actionText,
                                    playerId: p.player.id,
                                    targetId: target1.id,
                                });
                                p.game.nightActions.push({
                                    action: this.actionText,
                                    playerId: p.player.id,
                                    targetId: target2.id,
                                });
                                p.player.roleData.didAction = true;
                                p.mafiabot.reply(p.message, `**You are ${this.commandGerund} <@${target1.id}> and <@${target2.id}> tonight!** Type ***${pre}cancel*** to cancel.`);
                            } else {
                                p.mafiabot.reply(p.message, `Your two targets must be different!`);
                            }
                        } else {
                            p.mafiabot.reply(p.message, `As a ${this.name}, you cannot target yourself at night!`);
                        }
                    } else {
                        p.mafiabot.reply(p.message, `*${p.args[2]}* is not a valid target! You need to list TWO valid targets.`);
                    }
                } else {
                    p.mafiabot.reply(p.message, `*${p.args[1]}* is not a valid target! You need to list TWO valid targets.`);
                }
            } else {
                p.mafiabot.reply(p.message, `You can't ${this.command} tonight. ${canDoActionResult}`);
            }
        } else if (p.args[0].toLowerCase() == 'cancel' || (!this.mustDoAction && p.args[0].toLowerCase() == 'noaction')) {
            var action = _.find(p.game.nightActions, {action: this.actionText, playerId: p.player.id});
            if (action) {
                p.player.roleData.didAction = false;
                p.mafiabot.reply(p.message, `**You have canceled ${this.commandGerund} <@${action.targetId}>.**`);
            }
            p.game.nightActions = _.reject(p.game.nightActions, {action: this.actionText, playerId: p.player.id});
        }
        if (!this.mustDoAction && p.args[0].toLowerCase() == 'noaction') {
            p.player.roleData.noAction = true;
            p.mafiabot.reply(p.message, `**You are taking no action tonight.**`);
        }
    },
    onForceNightAction: function(p) {
        var canDoActionResult = this.canDoAction ? this.canDoAction(p) : true;
        var possibleTargets = _.filter(p.game.players, 'alive');
        if (!this.canSelfTarget) {
            possibleTargets = _.filter(possibleTargets, player => player.id != p.player.id);
        }
        if (this.mustDoAction && canDoActionResult === true && possibleTargets.length > 1) {
            var target1 = possibleTargets[Math.floor(Math.random() * possibleTargets.length)];
            possibleTargets = _.filter(possibleTargets, player => player.id != target1.id);
            var target2 = possibleTargets[Math.floor(Math.random() * possibleTargets.length)];
            p.game.nightActions.push({
                action: this.actionText,
                playerId: p.player.id,
                targetId: target1.id,
            });
            p.game.nightActions.push({
                action: this.actionText,
                playerId: p.player.id,
                targetId: target2.id,
            });
            p.mafiabot.sendMessage(p.player.id, `**The night action time limit ran out, so you are randomly ${this.commandGerund} <@${target1.id}> and <@${target2.id}> tonight!** Hurry up next time...`);
        } else {
            p.mafiabot.sendMessage(p.player.id, `**The night action time limit ran out and you were forced to no action!** Hurry up next time...`);
        }
    },
};