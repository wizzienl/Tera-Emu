"use strict";
//global
global.pre = '--'; // command prefix that can be used across all files
global.bulletKill = 0.314; // sentinel number for differentiating bullet kills from other kills

// requires
const fs = require('fs');
const config = require('./config.js');
const _ = require('lodash');
const Discord = require('discord.js');
const ext = require('./lib/ext.js');

const roles = require('./roles');
const mods = require('./roles/mods');
const variations = require('./roles/variations');
const factions = require('./factions');
const STATE = require('./lib/gameStates.js');
const s = require('./lib/pluralize.js');
const closestPlayer = require('./lib/closestPlayer.js');

// init stuff 
var getData = () => {
    try { return JSON.parse(fs.readFileSync(config.dataJSONPath).toString()); } catch (e) { return {}; };
}
var saveData = (data) => {
    fs.writeFileSync(config.dataJSONPath, JSON.stringify(data, null, '\t'));
}
var data = _.merge({
    syncMessages: [],
    channelsActivated: [],
    signals: [],
    pmChannels: [],
    games: [],
}, getData());
saveData(data);
var mafiabot = new Discord.Client();

// synchronous messages
mafiabot.syncMessage = (channelId, content, delay, unshift) => {
    var record = {
        channelId: channelId,
        content: content,
        delay: parseInt(delay) || 0,
    };
    if (unshift) {
        data.syncMessages.unshift(record);
    } else {
        data.syncMessages.push(record);
    }
};
mafiabot.syncReply = (message, content, delay) => {
    mafiabot.syncMessage(message.channel.id, message.author + ', ' + content, delay);
};
var readyToSendSyncMessage = true;
var timeLastSentSyncMessage = new Date();

// wrap basic send message functions to split long messages automatically
mafiabot.originalSendMessage = mafiabot.sendMessage;
mafiabot.originalReply = mafiabot.reply;
mafiabot.sendMessage = (channelId, content, options, callback) => {
    const MAX_CHARS = 1900;
    var lines = content.split('\n');
    var output = ``;
    var messages = [];
    for (var i = 0; i < lines.length; i++) {
        if ((output.length + (lines[i] || '').length) >= MAX_CHARS) {
            messages.push(output);
            output = ``;            
        }
        output += lines[i];
        if (i !== lines.length - 1) {
            output += '\n';
        }
    }
    messages.push(output);

    if (messages.length == 1) {
        mafiabot.originalSendMessage(channelId, messages[0], options, callback);
    } else {
        // loop through messages backwards and unshift them on the sync message queue so the messages stay together
        for (var i = messages.length - 1; i >= 0; i--) {
            mafiabot.syncMessage(channelId, messages[i], 0, true);
        }
        // call the callback because why not
        if (typeof(callback) === 'function') {
            callback();
        }
    }
};
mafiabot.reply = (message, content) => {
    mafiabot.sendMessage(message.channel.id, message.author + ', ' + content);
};

// utilities
var roleCache = {};
var getRole = mafiabot.getRole = roleId => {
    if (!roleCache[roleId]) {
        // combine role and mods
        var splitRoles = roleId.split('+').reverse(); // mod1+mod2+baserole => [baserole, mod1, mod2] ex: bp+miller+cop
        var rolesAndMods = splitRoles.map((roleOrMod, i) => i == 0 ? _.find(roles, {id: roleOrMod}) : _.find(mods, {id: roleOrMod}).mod);
        var role = ext(...rolesAndMods);
        // modify role name
        var splitRolesInOrder = roleId.split('+');
        role.name = splitRolesInOrder.map((roleOrMod, i) => _.find((i == splitRolesInOrder.length - 1 ? roles : mods), {id: roleOrMod}).name).join(' ');
        // bind all functions to this specific role combination
        for (var prop in role) {
            if (typeof(role[prop]) === 'function') {
                role[prop] = role[prop].bind(role);
            }
        }
        // cache role
        roleCache[roleId] = role;
    }
    return roleCache[roleId];
}
var factionCache = {};
var getFaction = mafiabot.getFaction = (factionId) => {
    if (!factionCache[factionId]) {
        // clone object first so we don't pollute the require cache
        var faction = ext({}, _.find(factions, {id: factionId}));
        // bind all functions to this specific faction combination
        for (var prop in faction) {
            if (typeof(faction[prop]) === 'function') {
                faction[prop] = faction[prop].bind(faction);
            }
        }
        // cache faction
        factionCache[factionId] = faction;
    }
    return factionCache[factionId];
}
var getRolesets = () => {
    try { return JSON.parse(fs.readFileSync(config.rolesetJSONPath).toString()); } catch (e) { return []; };
}
var saveRoleSets = (rolesets) => {
    fs.writeFileSync(config.rolesetJSONPath, JSON.stringify(rolesets, null, '\t'));
}
var fireEvent = (event, params) => {
    return event == null ? null : event(_.assignIn({mafiabot: mafiabot, data: data}, params));
}
var getPlayerFromString = (str, channelId) => {
    var gameInChannel = _.find(data.games, {channelId: channelId});
    if (gameInChannel) {
        return closestPlayer(str, gameInChannel.players);
    }
    return null;
}
var getGameFromPlayer = (playerId) => {
    return _.find(data.games, function(game) { return _.find(game.players, {id: playerId}); });
}
var adminCheck = message => {
    if (config.admins.indexOf(message.author.id) >= 0) {
        return true;
    }
    mafiabot.reply(message, `You must be an admin to perform command *${message.content}*!`);
    return false;
};
var activatedCheck = message => {
    return data.channelsActivated.indexOf(message.channel.id) >= 0;
}
var majorityOf = listOfPlayers => {
    return Math.ceil(listOfPlayers.length / 2 + 0.1);
}
var endDay = (channelId, lynchTargetId) => {
    var gameInChannel = _.find(data.games, {channelId: channelId});
    if (gameInChannel) {
        mafiabot.syncMessage(channelId, `**STOP! STOP! STOP! STOP! STOP! STOP! STOP! STOP!**\n**STOP! STOP! STOP! STOP! STOP! STOP! STOP! STOP!**\n\n**!! *THERE IS NO TALKING AT NIGHT* !!**\n\n**STOP! STOP! STOP! STOP! STOP! STOP! STOP! STOP!**\n**STOP! STOP! STOP! STOP! STOP! STOP! STOP! STOP!**\n\n`);
        if (lynchTargetId == 'NO LYNCH') {
            mafiabot.syncMessage(channelId, `No one was lynched.`, 1000);
        } else {
            var lynchedPlayer = _.find(gameInChannel.players, {id: lynchTargetId});
            fireEvent(getRole(lynchedPlayer.role).onLynched, {game: gameInChannel, player: lynchedPlayer});
            mafiabot.syncMessage(channelId, `<@${lynchedPlayer.id}>, the **${getFaction(lynchedPlayer.faction).name} ${getRole(lynchedPlayer.role).name}**, was lynched!`, 1000);
            lynchedPlayer.alive = false;
            lynchedPlayer.deathReason = 'Lynched D' + gameInChannel.day;
        }
        gameInChannel.state = STATE.NIGHT;
        gameInChannel.voteHistory.push({
            day: gameInChannel.day,
            votes: _.clone(gameInChannel.votes), // clone because the array will be cleared soon
        });
        gameInChannel.timeLimit = config.nightTimeLimit;
        gameInChannel.nightActionReminderTime = config.nightActionReminderInterval;
        if (!checkForGameOver(channelId)) {
            var livePlayers = _.filter(gameInChannel.players, 'alive');
            for (var i = 0; i < livePlayers.length; i++) {
                var player = livePlayers[i];
                fireEvent(getRole(player.role).onNight, {game: gameInChannel, player: player});
                printCurrentPlayers(channelId, player.id);
            }

            gameInChannel.mafiaDidNightAction = false;
            mafiabot.sendMessage(gameInChannel.mafiaChannelId, 
`It is now night ${gameInChannel.day}! Use the ***${pre}kill*** command in this chat to choose who the mafia will kill tonight (ex: *${pre}kill fool*). ***${pre}cancel*** to cancel.
Use the ***${pre}noaction*** command to confirm that you are active but taking no action tonight.

***IMPORTANT: DO NOT ping a non-mafia player with @ in this chat. They will get a notification even though they can't read this chat.***

**NOTE: The person who sends the kill command in this chat will be the one to perform the kill, for role purposes.**
**ALSO: If you have a power role, you must send me a private message separate from this chat to make that action!**`
            );
            printCurrentPlayers(channelId, gameInChannel.mafiaChannelId);
            
            printDayState(channelId);
        }
    }
}
var checkForLynch = channelId => {
    var gameInChannel = _.find(data.games, {channelId: channelId});
    if (gameInChannel) {
        var votesRequired = majorityOf(_.filter(gameInChannel.players, 'alive'));
        var votesByTarget = _.groupBy(gameInChannel.votes, 'targetId');
        for (var targetId in votesByTarget) {
            if (votesByTarget[targetId].length >= votesRequired) {
                endDay(channelId, targetId);
                return true;
            }
        }
    }
    return false;
}
var checkForGameOver = channelId => {
    var gameInChannel = _.find(data.games, {channelId: channelId});
    if (gameInChannel) {
        var livePlayers = _.filter(gameInChannel.players, 'alive');
        var winningFactions = {};
        for (var i = 0; i < gameInChannel.players.length; i++) {
            var player = gameInChannel.players[i];
            var result = fireEvent(getFaction(player.faction).isVictory, {game: gameInChannel, player: player});
            if (result) {
                winningFactions[player.faction] = player.faction;
            }
        }
        winningFactions = _.toArray(winningFactions);

        const gameOver = gameOverMessage => {
            gameInChannel.state = STATE.GAMEOVER;
            for (var i = 0; i < livePlayers.length; i++) {
                livePlayers[i].alive = false;
                livePlayers[i].deathReason = 'Survivor!';
            }
            mafiabot.syncMessage(channelId, gameOverMessage);
            printCurrentPlayersWithTrueRole(channelId);
            
            var mafiaChannel = _.find(mafiabot.channels, {id: gameInChannel.mafiaChannelId});
            mafiabot.sendMessage(mafiaChannel.id, `**The game is over so this chat has been revealed to everyone. This is intentional!** Use *${pre}endgame* in the main chat to delete this room forever.`);
            mafiabot.syncMessage(channelId, 
`The roleset used was called: \`${gameInChannel.roleset}\`

⚠️ **Use the *${pre}feedback* command to report any bad role setups and to send any other comments/suggestions/bugs to the server!** ⚠️

Mafia chat is now open to all players!
**Use the *${pre}endgame* command to end the game (and delete the mafia chat forever) so you can start a new game!**`);
        };

        if (winningFactions.length == 1) {
            var faction = getFaction(winningFactions[0]);
            gameOver(`***GAME OVER!***\n**THE ${faction.name.toUpperCase()} TEAM HAS WON!!!**\nCongrats:${listUsers(_.map(_.filter(gameInChannel.players, {faction: faction.id}), 'id'))}`);
            return true;
        } else if (winningFactions.length > 1) {
            gameOver(`***GAME OVER!***\n**THERE WAS... A TIE?!** Winning factions: ${winningFactions.map(faction => getFaction(faction).name).join(', ')}`);
            return true;
        } else if (winningFactions.length == 0 && livePlayers.length == 0) {
            gameOver(`***GAME OVER!***\n**NOBODY WINS!!!!... somehow?**`);
            return true;
        }
    }
    return false;
}

// printing
var listFactions = factions => {
    var output = '';
    var sortedFactions = _.sortBy(factions, 'id');
    for (var i = 0; i < sortedFactions.length; i++) {
        var faction = sortedFactions[i];
        output += `\n***${faction.id}*** | **${faction.name}** | ${faction.description}`;
    }
    return output;
}
var listRoles = roles => {
    var output = '';
    var sortedRoles = _.sortBy(roles, 'id');
    for (var i = 0; i < sortedRoles.length; i++) {
        var role = sortedRoles[i];
        output += `\n***${role.id}*** | **${role.trueName || role.name}** | ${role.description}`;
        if (role.secretDetails) {
            output += ` | *${role.secretDetails}*`;
        }
    }
    return output;
}
var listMods = mods => {
    var output = '';
    var sortedMods = _.sortBy(mods, 'id');
    for (var i = 0; i < sortedMods.length; i++) {
        var mod = sortedMods[i];
        output += `\n***${mod.id}*** | **${mod.name}** | ${mod.description}`;
    }
    return output;
}
var listRolesets = rolesets => {
    var output = '';
    var sortedRolesets = _.sortBy(rolesets, set => set.roles.length);
    for (var i = 0; i < sortedRolesets.length; i++) {
        var roleset = sortedRolesets[i];
        var formattedRoles = _.map(roleset.roles, role => `\`${getFaction(role.faction).name} ${getRole(role.role).trueName || getRole(role.role).name}\``).join(', ');
        output += `\n***${roleset.name}* (${roleset.roles.length})** | ${formattedRoles}`;
    }
    return output;
}
var listRolesetNames = rolesets => {
    var output = '';
    var rolesetGroups = _.sortBy(_.toArray(_.groupBy(rolesets, set => set.roles.length)), group => group[0].roles.length);
    for (var i = 0; i < rolesetGroups.length; i++) {
        var rolesetGroup = rolesetGroups[i];
        output += `\n**${s(rolesetGroup[0].roles.length, 'player')}:** \`${_.map(rolesetGroup, set => set.name).join(', ')}\``;
    }
    return output;
}
var listUsers = listOfUserIds => {
    var output = '';
    for (var i = 0; i < listOfUserIds.length; i++) {
        output += `\n${i + 1}. <@${listOfUserIds[i]}>`;
    }
    return output;
}
var listVotes = (listOfVotes, channelId) => {
    var voteOutput = '';
    var gameInChannel = _.find(data.games, {channelId: channelId});
    if (listOfVotes.length && gameInChannel) {
        var votesByTarget = _.sortBy(_.toArray(_.groupBy(listOfVotes, 'targetId')), group => -group.length);
        for (var i = 0; i < votesByTarget.length; i++) {
            var voteId = votesByTarget[i][0].targetId;
            if (voteId !== 'NO LYNCH') {
                voteId = '<@' + voteId + '>';
            }
            voteOutput += `\n(${votesByTarget[i].length}) ${voteId}: ${_.map(_.sortBy(votesByTarget[i], vote => vote.time), function(vote) { return '`' + _.find(gameInChannel.players, {id: vote.playerId}).name + '`'; }).join(', ')}`;
        }
    } else {
        voteOutput += `**\nThere are currently no votes!**`;
    }
    return voteOutput;
}
var sendPlayerRoleInfo = player => {
    var modIds = player.role.split('+');
    var baseRole = _.find(roles, {id: modIds.pop()});
    var modList = modIds.map(mod => _.find(mods, {id: mod}));
    var role = getRole(player.role);
    var output = `Your role is ***${getFaction(player.faction).name} ${role.name}***`;
    output += `\n    \`${getFaction(player.faction).name}\`: ${getFaction(player.faction).description}`;
    output += `\n    \`${baseRole.name}\`: ${baseRole.description}`;
    for (var i = 0; i < modList.length; i++) {
        output += `\n    \`${modList[i].name}\`: ${modList[i].description}`;
    }
    mafiabot.sendMessage(player.id, output);
}
var printCurrentPlayers = (channelId, outputChannelId, printTrueRole) => {
    var gameInChannel = _.find(data.games, {channelId: channelId});
    if (gameInChannel) {
        var output = `Currently ${s(gameInChannel.players.length, 'player')} in game hosted by \`${_.find(mafiabot.users, {id: gameInChannel.hostId}).name}\`:`;
        for (var i = 0; i < gameInChannel.players.length; i++) {
            var player = gameInChannel.players[i];
            output += `\n${i + 1}) `;
            if (player.alive) {
                output += `\`${player.name}\``;
            } else {
                output += `~~\`${player.name}\`~~ - ${getFaction(player.faction).name} ${(printTrueRole && getRole(player.role).trueName) || getRole(player.role).name} - *${player.deathReason}*`;
            }
        }
        mafiabot.syncMessage(outputChannelId || channelId, output);
        return true;
    }
    return false;
}
var printCurrentPlayersWithTrueRole = (channelId, outputChannelId) => {
    return printCurrentPlayers(channelId, outputChannelId || channelId, true);
}
var printUnconfirmedPlayers = (channelId, outputChannelId) => {
    var gameInChannel = _.find(data.games, {channelId: channelId});
    if (gameInChannel) {
        var unconfirmedPlayers = _.filter(gameInChannel.players, {confirmed: false});
        var output = unconfirmedPlayers.length 
            ? `**${s(unconfirmedPlayers.length, 'player')}** still must type ***${pre}confirm*** **IN THIS CHANNEL, NOT PM** for game hosted by <@${gameInChannel.hostId}>:${listUsers(_.map(unconfirmedPlayers, 'id'))}`
            : `All players confirmed for game hosted by <@${gameInChannel.hostId}>!`
            ;
        mafiabot.syncMessage(outputChannelId || channelId, output);
        return true;
    }
    return false;
}
var printDayState = (channelId, outputChannelId) => {
    var gameInChannel = _.find(data.games, {channelId: channelId});
    if (gameInChannel && gameInChannel.day > 0) {
        var output = `It is currently **${gameInChannel.state == STATE.DAY ? 'DAY' : 'NIGHT'} ${gameInChannel.day}** in game hosted by <@${gameInChannel.hostId}>!`
        if (gameInChannel.state == STATE.DAY) {
            output += `\n**${_.filter(gameInChannel.players, 'alive').length} alive, ${majorityOf(_.filter(gameInChannel.players, 'alive'))} to lynch!**\nUse ${pre}vote, ${pre}NL, and ${pre}unvote commands to vote.`;
        } else {
            output += `\n**Send in your night actions via PM. Every player must check their PMs, regardless of role!**.`;
        }
        mafiabot.syncMessage(outputChannelId || channelId, output);
        return true;
    }
    return false;
};
var printCurrentVotes = (channelId, outputChannelId) => {
    var gameInChannel = _.find(data.games, {channelId: channelId});
    if (gameInChannel && gameInChannel.day > 0) {
        var voteOutput = listVotes(gameInChannel.votes, channelId);
        mafiabot.syncMessage(outputChannelId || channelId, `**${_.filter(gameInChannel.players, 'alive').length} alive, ${majorityOf(_.filter(gameInChannel.players, 'alive'))} to lynch!**\nUse ${pre}vote, ${pre}NL, and ${pre}unvote commands to vote.${voteOutput}`);
        return true;
    }
    return false;
}

// commands
var baseCommands = [
    {
        commands: ['commands', 'help', 'wut'],
        description: 'Show list of commands',
        adminOnly: false,
        activatedOnly: false,
        onMessage: message => {
            var output = `\nType one of the following commands to interact with MafiaBot:`;
            for (var i = 0; i < baseCommands.length; i++) {
                var comm = baseCommands[i];
                output += `\n**${pre}${comm.commands.join('/')}** - ${comm.description}${comm.adminOnly ? ' - *Admin Only*' : ''}${comm.activatedOnly ? ' - *Activated Channel Only*' : ''}`;
            }
            mafiabot.sendMessage(message.channel.id, output);
        },
    },
    {
        commands: ['feedback', 'bug', 'bugreport'],
        description: 'Send feedback and comments and suggestions about MafiaBot to the admin',
        adminOnly: false,
        activatedOnly: false,
        onMessage: message => {
            var gameInChannel = _.find(data.games, {channelId: message.channel.id});
            var output = `## Server: ${message.channel.server ? message.channel.server.name : 'PM'} | Channel: ${message.channel.name || 'N/A'} | User: ${message.author.name} | Roleset: ${gameInChannel ? gameInChannel.roleset : 'N/A'} | ${new Date()} | ${new Date(message.timestamp)} ##\n${message.content.substring(11)}\n\n`;
            fs.appendFile(config.feedbackFilePath, output);
            mafiabot.reply(message, `Thanks for the feedback! ❤`);
        },
    },
    {
        commands: ['credits'],
        description: 'Show credits for MafiaBot',
        adminOnly: false,
        activatedOnly: false,
        onMessage: message => {
            mafiabot.sendMessage(message.channel.id, `I was designed and developed entirely by <@88020438474567680>!\nMany role setups by Tom Bombadil\nSource code: https://github.com/foolmoron/mafiabot`);
        },
    },
    {
        commands: ['reboot'],
        description: 'Reboots MafiaBot on the server',
        adminOnly: true,
        activatedOnly: false,
        onMessage: message => {
            throw new Error(`Rebooting MafiaBot due to admin ${message.author.name}'s ${pre}reboot command!`);
        },
    },
    {
        commands: ['activatemafia'],
        description: 'Activate MafiaBot on this channel',
        adminOnly: true,
        activatedOnly: false,
        onMessage: message => {
            if (data.channelsActivated.indexOf(message.channel.id) >= 0) {
                mafiabot.reply(message, `MafiaBot is already activated in *<#${message.channel.id}>*! Use *${pre}deactivatemafia* to deactivate MafiaBot on this channel.`);
            } else {
                data.channelsActivated.push(message.channel.id);
                mafiabot.reply(message, `MafiaBot has been activated in *<#${message.channel.id}>*! Use *${pre}creategame* to start playing some mafia!`);
            }
        },
    },
    {
        commands: ['deactivatemafia'],
        description: 'Deactivate MafiaBot on this channel',
        adminOnly: true,
        activatedOnly: false,
        onMessage: message => {
            if (data.channelsActivated.indexOf(message.channel.id) >= 0) {
                data.channelsActivated.splice(data.channelsActivated.indexOf(message.channel.id), 1);
                mafiabot.reply(message, `MafiaBot has been deactivated in *<#${message.channel.id}>*!`);
            } else {
                mafiabot.reply(message, `MafiaBot is not activate in *<#${message.channel.id}>*! Use *${pre}activatemafia* to activate MafiaBot on this channel.`);
            }
        },
    },
    {
        commands: ['signal', 'letsplay'],
        description: `Let people know that you want to play some mafia. Pings everyone players who joined the signal group with *${pre}joinsignal*.`,
        adminOnly: false,
        activatedOnly: true,
        onMessage: message => {
            var signalsForServer = _.find(data.signals, {serverId: message.channel.server.id});
            if (signalsForServer && signalsForServer.playerIds.length) {
                mafiabot.sendMessage(message.channel.id, `**HEY! Let's play some MAFIA!** (use the *${pre}joinsignal* command to join this list)\n${signalsForServer.playerIds.map((id) => `<@${id}>`).join(' ')}`);
            } else {
                mafiabot.reply(message, `There's no one in the signal group for server \`${message.channel.server.name}\`! Use the *${pre}joinsignal* command to join it.`);
            }
        },
    },
    {
        commands: ['joinsignal'],
        description: `Join the signal group so you are pinged to play anytime someone uses the *${pre}signal* command.`,
        adminOnly: false,
        activatedOnly: true,
        onMessage: message => {
            var signalsForServer = _.find(data.signals, {serverId: message.channel.server.id});
            if (!signalsForServer) {
                signalsForServer = {
                    serverId: message.channel.server.id,
                    playerIds: [],
                }
                data.signals.push(signalsForServer);
            }
            var prevLength = signalsForServer.playerIds.length;
            signalsForServer.playerIds = _.uniq(signalsForServer.playerIds.concat(message.author.id));
            if (signalsForServer.playerIds.length != prevLength) {
                mafiabot.reply(message, `You have been added to the mafia signal for server \`${message.channel.server.name}\`! Use the *${pre}signal* command to ping everyone in the signal group.`);
            } else {
                mafiabot.reply(message, `You're already in the signal group for server \`${message.channel.server.name}\`!`);
            }
        },
    },
    {
        commands: ['leavesignal'],
        description: `Leave the signal group so you don't get pinged to play anymore.`,
        adminOnly: false,
        activatedOnly: true,
        onMessage: message => {
            var signalsForServer = _.find(data.signals, {serverId: message.channel.server.id});
            if (signalsForServer) {
                var prevLength = signalsForServer.playerIds.length;
                _.pull(signalsForServer.playerIds, message.author.id);
                if (signalsForServer.playerIds.length != prevLength) {
                    mafiabot.reply(message, `You have been removed from the mafia signal for server \`${message.channel.server.name}\`!`);
                } else {
                    mafiabot.reply(message, `You're not even in the signal group for server \`${message.channel.server.name}\`!`);
                }
            } else {
                mafiabot.reply(message, `There's no one in the signal group for server \`${message.channel.server.name}\`! Use the *${pre}joinsignal* command to join it.`);
            }
        },
    },
    {
        commands: ['roles'],
        description: 'Show all available roles',
        adminOnly: false,
        activatedOnly: true,
        onMessage: message => {
            mafiabot.sendMessage(message.channel.id, `Current list of available roles:${listRoles(roles)}\n\nAnd mods that can be applied to each role:${listMods(mods)}`);
        },
    },
    {
        commands: ['rolesets'],
        description: `Show all available rolesets names for you to choose with *${pre}startgame*`,
        adminOnly: false,
        activatedOnly: true,
        onMessage: message => {
            mafiabot.sendMessage(message.channel.id, `Current list of available rolesets for use with *${pre}startgame*:${listRolesetNames(getRolesets())}`);
        },
    },
    {
        commands: ['addroleset'],
        description: 'Add a roleset to the random rotation',
        adminOnly: false,
        activatedOnly: true,
        onMessage: (message, args) => {
            const formatError = `That's the incorrect format!. To add a roleset, use the following format:\n\`${pre}addroleset [roleset id] | [faction1] [mod1]+[role1], [faction2] [mod2]+[mod3]+[role2], etc...\`\nex: *${pre}addroleset coolrolesetup | town vanilla, town bp+miller+insanecop, mafia roleblocker, independent inno+serialkiller*`;

            var name = args[1];
            var rolelistText = message.content.split('|')[1];
            if (typeof(name) === 'string' && typeof(rolelistText) === 'string') {
                var rolesets = getRolesets();
                if (!_.find(rolesets, {name: name})) {
                    var rolelist = rolelistText.split(',').map(item => item.trim().split(' '));
                    var error = null;
                    if (!_.every(rolelist, role => role.length == 2)) {
                        error = formatError;
                    } else if (!_.every(rolelist, role => _.find(factions, {id: role[0]}))) {
                        var badFaction = _.find(rolelist, role => !_.find(factions, {id: role[0]}))[0];
                        error = `The faction *${badFaction}* is not a valid faction ID. Make sure to use the ID and not the full name. Use *${pre}factions* to see the list of available factions.`;
                    } else {
                        for (var i = 0; i < rolelist.length; i++) {
                            var splitRoles = rolelist[i][1].split('+');
                            var baseRole = splitRoles.pop();
                            if (!_.find(roles, {id: baseRole})) {
                                if (_.find(mods, {id: baseRole})) {
                                    error = `The role *${baseRole}* is not a valid role ID, but it is a valid mod ID. Make sure that you always have a base role to attach mods to, and follow the mod format: \`[mod1]+[mod2]+[role]\`. Use *${pre}roles* to see the list of available roles and mods.`;
                                } else {
                                    error = `The role *${baseRole}* is not a valid role ID. Make sure to use the ID and not the full name. Use *${pre}roles* to see the list of available roles.`;
                                }
                            }
                            var badMod = _.find(splitRoles, mod => !_.find(mods, {id: mod}));
                            if (badMod) {
                                if (_.find(roles, {id: badMod})) {
                                    error = `The mod *${badMod}* is not a valid mod ID, but it is a valid role ID. Make sure that you only use one base role at a time, and follow the mod format: \`[mod1]+[mod2]+[role]\`. Use *${pre}roles* to see the list of available roles and mods.`;
                                } else {
                                    error = `The mod *${badMod}* is not a valid mod ID. Make sure to use the ID and follow the mod format: \`[mod1]+[mod2]+[role]\`. Use *${pre}roles* to see the list of available roles and mods.`;
                                }
                            }
                        }
                    }
                    if (!error) {
                        const rolesetHasher = rs => rs.reduce((acc, item) => {
                            var str = item.faction + item.role; 
                            acc[str] = (acc[str] || 0) + 1; 
                            return acc;
                        }, {});
                        var newRoleset = {name: name, roles: rolelist.map(item => ({faction: item[0], role: item[1]}))};
                        var newRolesetHash = rolesetHasher(newRoleset.roles);
                        var existingRoleset = _.find(rolesets, roleset => _.isEqual(newRolesetHash, rolesetHasher(roleset.roles)));
                        if (!existingRoleset) {
                            rolesets.push(newRoleset);
                            rolesets = _.sortBy(rolesets, rs => rs.roles.length);
                            saveRoleSets(rolesets);
                            mafiabot.reply(message, `Added new roleset named *${newRoleset.name}*!`);
                        } else {
                            mafiabot.reply(message, `There already exists a roleset with that set of roles, with the name *${existingRoleset.name}*!`);
                        }
                    } else {
                        mafiabot.reply(message, error);
                    }
                } else {
                    mafiabot.reply(message, `There already exists a roleset named *${name}*! Use ${pre}deleteroleset to delete it and then re-add it.`);
                }
            } else {
                mafiabot.reply(message, formatError);
            }
        },
    },
    {
        commands: ['deleteroleset'],
        description: 'Delete a roleset',
        adminOnly: true,
        activatedOnly: true,
        onMessage: (message, args) => {
            var name = args[1];
            var rolesets = getRolesets();
            var existingRoleset = _.find(rolesets, {name: name});
            if (existingRoleset) {
                _.pull(rolesets, existingRoleset);
                saveRoleSets(rolesets);
                mafiabot.reply(message, `Deleted roleset named *${existingRoleset.name}*!`);
            } else {
                mafiabot.reply(message, `There is no roleset with the name *${name}*! Use ${pre}rolesets command to see the list of available rolesets.`);
            }
        },
    },
    {
        commands: ['admin', 'admins'],
        description: 'Show list of admins for MafiaBot',
        adminOnly: false,
        activatedOnly: false,
        onMessage: message => {
            mafiabot.sendMessage(message.channel.id, `Admins of MafiaBot:${listUsers(config.admins)}`);
        },
    },
    {
        commands: ['host', 'hosts'],
        description: 'Show host of current game in channel',
        adminOnly: false,
        activatedOnly: true,
        onMessage: message => {
            var gameInChannel = _.find(data.games, {channelId: message.channel.id});
            if (gameInChannel) {
                mafiabot.sendMessage(message.channel.id, `Host of current game in channel:\n<@${gameInChannel.hostId}>`);
            } else {
                mafiabot.reply(message, `There's no game currently running in <#${message.channel.id}>!`);
            }
        },
    },
    {
        commands: ['player', 'players', 'playerlist'],
        description: 'Show current list of players of game in channel',
        adminOnly: false,
        activatedOnly: true,
        onMessage: message => {
            var gameInChannel = _.find(data.games, {channelId: message.channel.id});
            if (gameInChannel) {
                var printPlayersFunc = gameInChannel.state === STATE.GAMEOVER ? printCurrentPlayersWithTrueRole : printCurrentPlayers;
                printPlayersFunc(message.channel.id);
            } else {
                mafiabot.reply(message, `There's no game currently running in <#${message.channel.id}>!`);
            }
        },
    },
    {
        commands: ['myrole'],
        description: 'Sends you a PM of your role info again',
        adminOnly: false,
        activatedOnly: true,
        onMessage: message => {
            var gameInChannel = _.find(data.games, {channelId: message.channel.id});
            if (gameInChannel) {
                var player = _.find(gameInChannel.players, {id: message.author.id});
                if (player) {
                    sendPlayerRoleInfo(player);
                }
            } else {
                mafiabot.reply(message, `There's no game currently running in <#${message.channel.id}>!`);
            }
        },
    },
    {
        commands: ['day', 'info'],
        description: 'Show current day information',
        adminOnly: false,
        activatedOnly: true,
        onMessage: message => {
            if (!printDayState(message.channel.id)) {
                mafiabot.reply(message, `There's no game currently running in <#${message.channel.id}>!`);
            }
        },
    },
    {
        commands: ['votes', 'votals'],
        description: 'Show current list of votes for the game in channel',
        adminOnly: false,
        activatedOnly: true,
        onMessage: message => {
            if (!printCurrentVotes(message.channel.id)) {
                mafiabot.reply(message, `There's no game currently running in <#${message.channel.id}>!`);
            }
        },
    },
    {
        commands: ['votehistory', 'votalhistory'],
        description: 'Show list of votals at the end of each previous day for the game in channel',
        adminOnly: false,
        activatedOnly: true,
        onMessage: message => {
            var gameInChannel = _.find(data.games, {channelId: message.channel.id});
            if (gameInChannel) {
                if (gameInChannel.voteHistory.length) {
                    var output = ``;
                    for (var i = 0; i < gameInChannel.voteHistory.length; i++) {
                        var voteHistory = gameInChannel.voteHistory[i];
                        output += `***Day ${voteHistory.day}:*** `;
                        output += listVotes(voteHistory.votes, message.channel.id);
                        if (i != gameInChannel.voteHistory.length - 1) {
                            output += `\n\n`;
                        }
                    }
                    mafiabot.sendMessage(message.channel.id, output);
                } else {
                    mafiabot.reply(message, `There's no vote history yet!`);
                }
            } else {
                mafiabot.reply(message, `There's no game currently running in <#${message.channel.id}>!`);
            }
        },
    },
    {
        commands: ['votelog'],
        description: 'Show a detailed log of every vote made for the game in channel',
        adminOnly: false,
        activatedOnly: true,
        onMessage: message => {
            var gameInChannel = _.find(data.games, {channelId: message.channel.id});
            if (gameInChannel) {
                if (gameInChannel.voteLog.length > 1) {
                    var output = ``;
                    var day = 0;
                    var n = 1;
                    for (var i = 0; i < gameInChannel.voteLog.length; i++) {
                        var log = gameInChannel.voteLog[i];
                        if (log.day != null) {
                            output += `***Day ${log.day}:*** `;
                            n = 0;
                        } else if (log.targetName === 'NL') {
                            output += `${n}. \`${log.playerName}\` NL`;
                        } else if (log.targetName === null) {
                            output += `${n}. \`${log.playerName}\` un`;
                        } else {
                            output += `${n}. \`${log.playerName}\` -> \`${log.targetName}\``;
                        }
                        n++;
                        if (i != gameInChannel.voteLog.length - 1) {
                            output += `\n`;
                            if (gameInChannel.voteLog[i + 1].day != null) {
                                output += `\n`;
                            }
                        }
                    }
                    mafiabot.sendMessage(message.channel.id, output);
                } else {
                    mafiabot.reply(message, `There's no vote logs yet!`);
                }
            } else {
                mafiabot.reply(message, `There's no game currently running in <#${message.channel.id}>!`);
            }
        },
    },
    {
        commands: ['creategame'],
        description: 'Create a game in this channel and become the host',
        adminOnly: false,
        activatedOnly: true,
        onMessage: message => {
            var gameInChannel = _.find(data.games, {channelId: message.channel.id});
            if (gameInChannel) {
                mafiabot.reply(message, `A game is already running in <#${message.channel.id}> hosted by <@${gameInChannel.hostId}>!`);
            } else {
                gameInChannel = {
                    hostId: message.author.id,
                    channelId: message.channel.id,
                    mafiaChannelId: null,
                    players: [],
                    roleset: '',
                    votesToEndGame: [],
                    state: STATE.INIT,
                    previousState: null,
                    day: 0,
                    votes: [],
                    voteHistory: [],
                    voteLog: [],
                    nightActions: [],
                    nightKills: {},
                    mafiaDidNightAction: false,
                    timeLimit: config.dayTimeLimit,
                    votesToExtend: [],
                    permissionsTime: config.permissionsInterval,
                    confirmingReminderTime: config.confirmingReminderInterval,
                    nightActionReminderTime: config.nightActionReminderInterval,
                };
                data.games.push(gameInChannel);
                mafiabot.sendMessage(message.channel.id, `Starting a game of mafia in <#${message.channel.id}> hosted by <@${gameInChannel.hostId}>!`);
            }
        },
    },
    {
        commands: ['endgame'],
        description: 'Current host, admin, or majority of players can end the game in this channel',
        adminOnly: false,
        activatedOnly: true,
        onMessage: message => {
            var gameInChannel = _.find(data.games, {channelId: message.channel.id});
            var endGame = becauseOf => {
                _.remove(data.games, gameInChannel);
                mafiabot.deleteChannel(gameInChannel.mafiaChannelId);
                mafiabot.sendMessage(message.channel.id, `${becauseOf} ended game of mafia in <#${message.channel.id}> hosted by <@${gameInChannel.hostId}>! 😥`);

                // enable talking just in case it was off
                var gameChannel = _.find(mafiabot.channels, {id: gameInChannel.channelId});
                var everyoneId = _.find(gameChannel.server.roles, {name: "@everyone"}).id;
                mafiabot.overwritePermissions(gameChannel, everyoneId, { sendMessages: true, mentionEveryone: false });
            };
            if (gameInChannel) {
                if (gameInChannel.hostId == message.author.id) {
                    endGame(`Host <@${message.author.id}>`);
                } else if (config.admins.indexOf(message.author.id) >= 0) {
                    endGame(`Admin <@${message.author.id}>`);
                } else if (_.find(gameInChannel.players, {id: message.author.id})) {
                    if (gameInChannel.votesToEndGame.indexOf(message.author.id) >= 0) {
                        mafiabot.reply(message, `We already know you want to end the current game hosted by <@${gameInChannel.hostId}>!`);
                    } else {
                        gameInChannel.votesToEndGame.push(message.author.id);
                        mafiabot.reply(message, `You voted to end the current game hosted by <@${gameInChannel.hostId}>!`);
                        
                        var votesRemaining = majorityOf(gameInChannel.players) - gameInChannel.votesToEndGame.length;
                        if (votesRemaining <= 0) {
                            endGame('A majority vote of the players');
                        } else {
                            mafiabot.sendMessage(message.channel.id, `Currently ${s(gameInChannel.votesToEndGame.length, 'vote')} to end the current game hosted by <@${gameInChannel.hostId}>. ${s(votesRemaining, 'vote')} remaining!`);
                        }
                    }
                } else {
                    mafiabot.reply(message, `Only admins, hosts, and joined players can end a game!`);
                }
            } else {
                mafiabot.reply(message, `There's no game currently running in <#${message.channel.id}>!`);
            }
        },
    },
    {
        commands: ['startgame'],
        description: 'Host can start game with current list of players, optionally specifying the name of a roleset to use.',
        adminOnly: false,
        activatedOnly: true,
        onMessage: (message, args) => {
            var gameInChannel = _.find(data.games, {channelId: message.channel.id});
            if (gameInChannel) {
                if (gameInChannel.hostId == message.author.id) {
                    if (gameInChannel.state == STATE.INIT) {
                        // see if there are any available rolesets for this number of players
                        var possibleRolesets = _.filter(getRolesets(), set => set.roles.length == gameInChannel.players.length);
                        if (possibleRolesets.length) {
                            // if there was a roleset passed in, use that
                            if (args[1]) {
                                possibleRolesets = _.filter(possibleRolesets, set => set.name === args[1]);
                            }
                            if (possibleRolesets.length) {
                                mafiabot.createChannel(message.channel, 'mafia' + Math.random().toString().substring(2), 'text', (error, mafiaChannel) => {
                                    if (mafiaChannel) {
                                        gameInChannel.state = STATE.CONFIRMING;
                                        gameInChannel.mafiaChannelId = mafiaChannel.id;
                                        gameInChannel.confirmingReminderTime = config.confirmingReminderInterval;
                                        mafiabot.syncMessage(message.channel.id, `Sending out roles for game of mafia hosted by <@${gameInChannel.hostId}>! Check your PMs for info and type **${pre}confirm** in this channel to confirm your role.`);
                                        printCurrentPlayers(message.channel.id);

                                        // pick a random available roleset
                                        var roleset = possibleRolesets[Math.floor(Math.random()*possibleRolesets.length)];
                                        // mutate it
                                        for (var i = 0; i < variations.length; i++) {
                                            if (variations.canMutate(roleset, variations[i]) && Math.random() < 0.25) {
                                                roleset = variations.mutate(roleset, variations[i]);
                                            }
                                        }
                                        gameInChannel.roleset = roleset.name;
                                        console.log('Picking roleset:', roleset.name);
                                        // randomly assign and send roles
                                        var shuffledRoles = _.shuffle(roleset.roles);
                                        for (var i = 0; i < gameInChannel.players.length; i++) {
                                            var player = gameInChannel.players[i];
                                            player.faction = shuffledRoles[i].faction;
                                            player.role = shuffledRoles[i].role;
                                            console.log('    ', player.name, player.faction, player.role);
                                        }
                                        for (var i = 0; i < gameInChannel.players.length; i++) {
                                            var player = gameInChannel.players[i];
                                            sendPlayerRoleInfo(player);
                                            mafiabot.sendMessage(player.id, `Type **${pre}confirm** in <#${message.channel.id}> to confirm your participation in the game of mafia hosted by <@${gameInChannel.hostId}>.`);
                                        }
                                        // then send mafia messages
                                        var mafiaPlayers = _.filter(gameInChannel.players, {faction: 'mafia'});
                                        for (var i = 0; i < mafiaPlayers.length; i++) {
                                            var mafiaPlayer = _.find(mafiabot.users, {id: mafiaPlayers[i].id});
                                            mafiabot.sendMessage(mafiaPlayer, `Use the channel <#${mafiaChannel.id}> to chat with your fellow Mafia team members, and to send in your nightly kill.`);
                                        }
                                        mafiabot.syncMessage(mafiaChannel.id, `**Welcome to the mafia team!**\nYour team is:${listUsers(_.map(mafiaPlayers, 'id'))}`);
                                        mafiabot.syncMessage(mafiaChannel.id, `As a team you have **1 kill each night**. Use the ***${pre}kill*** command (ex: *${pre}kill fool*) to use that ability when I prompt you in this chat.`);
                                    }
                                });
                            } else {
                                mafiabot.reply(message, `The roleset \`${args[1]}\` is not valid for ${s(gameInChannel.players.length, 'player')}! Use **${pre}rolesets** to view the available rolesets for each player count.`);
                            }
                        } else {
                            mafiabot.reply(message, `Sorry, there are no available rolesets for ${s(gameInChannel.players.length, 'player')}! Use the **${pre}addroleset** command to add a new roleset for this number of players.`);
                        }
                    } else if (gameInChannel.state == STATE.READY) {
                        gameInChannel.state = STATE.DAY;
                        gameInChannel.day = 1;
                        gameInChannel.voteLog.push({day: gameInChannel.day});
                        gameInChannel.timeLimit = config.dayTimeLimit;
                        var livePlayers = _.filter(gameInChannel.players, 'alive');
                        for (var i = 0; i < livePlayers.length; i++) {
                            var player = livePlayers[i];
                            fireEvent(getRole(player.role).onGameStart, {game: gameInChannel, player: player});
                        }
                        mafiabot.syncMessage(message.channel.id, `All players have confirmed and host <@${gameInChannel.hostId}> is now starting the game of mafia!`);
                        printCurrentPlayers(message.channel.id);
                        printDayState(message.channel.id);
                    }
                } else {
                    mafiabot.reply(message, `Only hosts can start the game!`);
                }
            } else {
                mafiabot.reply(message, `There's no game currently running in <#${message.channel.id}>!`);
            }
        },
    },
    {
        commands: ['join', 'in'],
        description: 'Join the game in this channel as a player',
        adminOnly: false,
        activatedOnly: true,
        onMessage: message => {
            var gameInChannel = _.find(data.games, {channelId: message.channel.id});
            if (gameInChannel) {
                if (gameInChannel.state == STATE.INIT) {
                    if (!_.find(data.pmChannels, {playerId: message.author.id})) {
                        mafiabot.reply(message, `You need to send me a private message to open up a direct channel of communication between us before you can join a game!`);
                    } else if (_.find(gameInChannel.players, {id: message.author.id})) {
                        mafiabot.reply(message, `You are already in the current game hosted by <@${gameInChannel.hostId}>!`);
                    } else {
                        var newPlayer = {
                            id: message.author.id,
                            name: message.author.name,
                            confirmed: false,
                            alive: true,
                            deathReason: '',
                            faction: null,
                            role: null,
                            roleData: {},
                        };
                        gameInChannel.players.push(newPlayer);
                        mafiabot.syncMessage(message.channel.id, `<@${message.author.id}> joined the current game hosted by <@${gameInChannel.hostId}>!`);
                        printCurrentPlayers(message.channel.id);
                    }
                } else {
                    mafiabot.reply(message, `The current game is already going, so the player list is locked!`);
                }
            } else {
                mafiabot.reply(message, `There's no game currently running in <#${message.channel.id}>!`);
            }
        },
    },
    {
        commands: ['unjoin', 'out', 'leave'],
        description: 'Leave the game in this channel, if you were joined',
        adminOnly: false,
        activatedOnly: true,
        onMessage: message => {
            var gameInChannel = _.find(data.games, {channelId: message.channel.id});
            if (gameInChannel) {
                if (gameInChannel.state == STATE.INIT) {
                    if (_.find(gameInChannel.players, {id: message.author.id})) {
                        _.pullAllBy(gameInChannel.players, [{id: message.author.id}], 'id');
                        mafiabot.syncMessage(message.channel.id, `<@${message.author.id}> left the current game hosted by <@${gameInChannel.hostId}>!`);
                        printCurrentPlayers(message.channel.id);
                    } else {
                        mafiabot.reply(message, `You are not currently in the current game hosted by <@${gameInChannel.hostId}>!`);
                    }
                } else {
                    mafiabot.reply(message, `The current game is already starting, so the player list is locked!`);
                }
            } else {
                mafiabot.reply(message, `There's no game currently running in <#${message.channel.id}>!`);
            }
        },
    },
    {
        commands: ['confirm'],
        description: 'Confirm your role and your participation in the game',
        adminOnly: false,
        activatedOnly: true,
        onMessage: (message, args) => {
            var gameInChannel = _.find(data.games, {channelId: message.channel.id});
            if (gameInChannel && gameInChannel.state == STATE.CONFIRMING) {
                var player = _.find(gameInChannel.players, {id: message.author.id});
                if (player) {
                    player.confirmed = true;
                    mafiabot.syncReply(message, `Thanks for confirming for the current game hosted by <@${gameInChannel.hostId}>!`);

                    var unconfirmedPlayers = _.filter(gameInChannel.players, {confirmed: false});
                    if (!unconfirmedPlayers.length) {
                        printUnconfirmedPlayers(message.channel.id);
                        gameInChannel.state = STATE.READY;
                    }
                }
            }
        },
    },
    {
        commands: ['vote', 'lynch'],
        description: 'Vote to lynch a player',
        default: true,
        adminOnly: false,
        activatedOnly: true,
        onMessage: (message, args) => {
            var gameInChannel = _.find(data.games, {channelId: message.channel.id});
            if (gameInChannel && gameInChannel.state == STATE.DAY) {
                var player = _.find(gameInChannel.players, {id: message.author.id});
                if (player && player.alive) {
                    var target = getPlayerFromString(args[1], message.channel.id);
                    if (target) {
                        if (!target.alive) {
                            mafiabot.reply(message, `You can't vote for the dead player ${args[1]}!`);
                        } else if (target.id == message.author.id) {
                            mafiabot.reply(message, `You can't vote for yourself!`);
                        } else {
                            _.pullAllBy(gameInChannel.votes, [{playerId: message.author.id}], 'playerId');
                            gameInChannel.votes.push({playerId: message.author.id, targetId: target.id, time: new Date()});
                            gameInChannel.voteLog.push({playerName: message.author.name, targetName: target.name});
                            mafiabot.syncMessage(message.channel.id, `<@${message.author.id}> voted to lynch <@${target.id}>!`);

                            printCurrentVotes(message.channel.id);
                            checkForLynch(message.channel.id);
                        }
                    } else {
                        mafiabot.reply(message, `'${args[1]}' is not a valid vote target!`);
                    }
                }
            }
        },
    },
    {
        commands: ['nl', 'nolynch'],
        description: 'Vote for no lynch today',
        adminOnly: false,
        activatedOnly: true,
        onMessage: (message, args) => {
            var gameInChannel = _.find(data.games, {channelId: message.channel.id});
            if (gameInChannel && gameInChannel.state == STATE.DAY) {
                var player = _.find(gameInChannel.players, {id: message.author.id});
                if (player && player.alive) {
                    _.pullAllBy(gameInChannel.votes, [{playerId: message.author.id}], 'playerId');
                    gameInChannel.votes.push({playerId: message.author.id, targetId: 'NO LYNCH', time: new Date()});
                    gameInChannel.voteLog.push({playerName: message.author.name, targetName: 'NL'});
                    mafiabot.syncMessage(message.channel.id, `<@${message.author.id}> voted to No Lynch!`);

                    printCurrentVotes(message.channel.id);
                    checkForLynch(message.channel.id);
                }
            }
        },
    },
    {
        commands: ['unvote', 'unlynch', 'un'],
        description: 'Remove your vote to lynch a player',
        adminOnly: false,
        activatedOnly: true,
        onMessage: (message, args) => {
            var gameInChannel = _.find(data.games, {channelId: message.channel.id});
            if (gameInChannel && gameInChannel.state == STATE.DAY) {
                var player = _.find(gameInChannel.players, {id: message.author.id});
                if (player && player.alive) {
                    var vote = _.find(gameInChannel.votes, {playerId: message.author.id});
                    _.pullAllBy(gameInChannel.votes, [{playerId: message.author.id}], 'playerId');
                    gameInChannel.voteLog.push({playerName: message.author.name, targetName: null});
                    var targetString = vote ? vote.targetId === 'NO LYNCH' ? ' No Lynch' : ` <@${vote.targetId}>` : '... nothing';
                    mafiabot.syncMessage(message.channel.id, `<@${message.author.id}> unvoted${targetString}!`);
                    printCurrentVotes(message.channel.id);
                }
            }
        },
    },
    {
        commands: ['extend'],
        description: `Vote to extend the day time limit by ${s(Math.floor(config.dayTimeLimitExtension/(60*1000)), 'minute')}`,
        adminOnly: false,
        activatedOnly: true,
        onMessage: (message, args) => {
            var gameInChannel = _.find(data.games, {channelId: message.channel.id});
            if (gameInChannel && gameInChannel.state == STATE.DAY) {
                var player = _.find(gameInChannel.players, {id: message.author.id});
                if (player && player.alive) {
                    if (gameInChannel.votesToExtend.indexOf(player.id) >= 0) {
                        mafiabot.reply(message, `We already know you want to extend the day!`);
                    } else {
                        gameInChannel.votesToExtend.push(player.id);
                        mafiabot.reply(message, `You voted to extend the day time limit!`);
                        
                        var votesRemaining = majorityOf(_.filter(gameInChannel.players, 'alive')) - gameInChannel.votesToExtend.length;
                        if (votesRemaining <= 0) {
                            gameInChannel.timeLimit += config.dayTimeLimitExtension;
                            gameInChannel.votesToExtend.length = 0;
                            mafiabot.sendMessage(message.channel.id, `***The day time limit was extended by ${s(Math.floor(config.dayTimeLimitExtension/(60*1000)), 'minute')}!*** How exciting...`);
                        } else {
                            mafiabot.sendMessage(message.channel.id, `Currently ${s(gameInChannel.votesToExtend.length, 'vote')} to extend the day. ${s(votesRemaining, 'vote')} remaining!`);
                        }
                    }
                }
            }
        },
    },
];

// set up discord events
mafiabot.on("message", message => {
    mafiabot.latestChannel = message.channel.id; // for error handling purposes

    var contentLower = message.content.toLowerCase();
    var args = message.content.split(/[ :]/);
    args[0] = args[0].substring(pre.length);
    // go through all the base commands and see if any of them have been called
    if (contentLower.indexOf(pre) == 0) {
        var anyCommandMatched = false;
        for (var i = 0; i < baseCommands.length; i++) {
            var comm = baseCommands[i];
            var commandMatched = false;
            for (var c = 0; c < comm.commands.length; c++) {
                commandMatched = 
                    args[0].toLowerCase().indexOf(comm.commands[c].toLowerCase()) == 0 && 
                    args[0].length == comm.commands[c].length;
                if (commandMatched) {
                    break;
                }
            }
            anyCommandMatched = anyCommandMatched || commandMatched;
            if (commandMatched) {
                if (!comm.adminOnly || adminCheck(message)) {
                    if (!comm.activatedOnly || activatedCheck(message)) {
                        comm.onMessage(message, args);
                    }
                }
                break;
            }
        }
        // call default command if no command was matched, but there was still a command prefix (like '--xxx')
        if (!anyCommandMatched) {
            var defaultComm = _.find(baseCommands, {default: true});
            if (defaultComm) {
                if (!defaultComm.adminOnly || adminCheck(message)) {
                    if (!defaultComm.activatedOnly || activatedCheck(message)) {
                        // args needs to be slightly modified for default commands (so '--xxx' has args ['', 'xxx'])
                        var args = [''].concat(message.content.split(/[ :]/));
                        args[1] = args[1].substring(pre.length);
                        defaultComm.onMessage(message, args);
                    }
                }
            }
        }
    }

    // receiving a PM
    if (message.channel.recipient) {
        // pm channel setup
        if (!_.find(data.pmChannels, {playerId: message.channel.recipient.id})) {
            data.pmChannels.push({playerId: message.channel.recipient.id, channelId: message.channel.id});
            mafiabot.reply(message, 'Thanks for the one-time private message to open a direct channel of communication between us! You can now join and play mafia games on this server.');
        }
        
        var gameWithPlayer = getGameFromPlayer(message.author.id);
        if (gameWithPlayer) {
            var player = _.find(gameWithPlayer.players, {id: message.author.id});
            var role = getRole(player.role);
            if (contentLower.indexOf(pre) == 0) {
                fireEvent(role.onPMCommand, {message: message, args: args, game: gameWithPlayer, player: player});
            }
        }
    }

    // receiving command from mafia channel
    var game = _.find(data.games, {mafiaChannelId: message.channel.id});
    if (game && contentLower.indexOf(pre) == 0) {
        // terrible chunk of code to emulate a vig kill
        var player = _.find(game.players, {id: message.author.id});
        var actionText = 'mafia kill';
        if (game.state == STATE.NIGHT && player && player.alive) {
            if (args[0].toLowerCase() == 'kill') {
                var target = closestPlayer(args[1], game.players);
                if (target && target.alive) {
                    game.nightActions = _.reject(game.nightActions, {action: actionText}); // clear any mafia kill, not just the current player's
                    game.nightActions.push({ 
                        action: actionText,
                        playerId: player.id,
                        targetId: target.id,
                    });
                    game.mafiaDidNightAction = true;
                    // make sure not to ping non-mafia players in the mafia chat
                    mafiabot.reply(message, `**You are killing *${_.find(game.players, {id: target.id}).name}* tonight!** Type ***${pre}cancel*** to cancel.`);
                } else {
                    mafiabot.reply(message, `*${args[1]}* is not a valid target!`);
                }
            } else if (args[0].toLowerCase() == 'cancel' || args[0].toLowerCase() == 'noaction') {
                var action = _.find(game.nightActions, {action: actionText});
                if (action) {
                    game.mafiaDidNightAction = false;
                    mafiabot.reply(message, `**You have canceled killing *${_.find(game.players, {id: action.targetId}).name}*.**`);
                }
                game.nightActions = _.reject(game.nightActions, {action: actionText});
                if (args[0].toLowerCase() == 'noaction') {
                    game.mafiaDidNightAction = true;
                    mafiabot.reply(message, `**You are taking no action tonight.**`);
                }
            } else {
                // made a command but it's not a kill, so they are likely trying to use their power role in mafia chat
                mafiabot.reply(message, `**If you have a power role, you must send me a private message separate from this chat to make that action!**`);
            }
        }
    }

    // save data after every message
    saveData(data);
});

mafiabot.on("disconnected", () => {
    throw "Disconnected - rebooting!";
});

// main loop
var t = new Date();
var mainLoop = function() {
    // timing stuff
    var now = new Date();
    var dt = now - t;
    t = now;

    // handle sync message taking too long to call back
    if (now - timeLastSentSyncMessage >= config.syncMessageTimeout) {
        readyToSendSyncMessage = true;
    }

    // send next sync message if possible
    if (data.syncMessages.length) {
        data.syncMessages[0].delay -= dt;
        if (readyToSendSyncMessage && data.syncMessages[0].delay <= 0) {
            var message = data.syncMessages.shift();
            mafiabot.sendMessage(message.channelId, message.content, {tts: false}, () => { 
                readyToSendSyncMessage = true; 
            });

            readyToSendSyncMessage = false;
            timeLastSentSyncMessage = new Date();
        }
    }

    // game-specific loops
    for (var i = 0; i < data.games.length; i++) {
        var game = data.games[i];
        mafiabot.latestChannel = game.channelId; // for error handling purposes

        // make sure permissions are set properly
        game.permissionsTime -= dt;
        if (game.permissionsTime <= 0 || game.previousState != game.state) {
            var gameChannel = _.find(mafiabot.channels, {id: game.channelId});
            var everyoneId = _.find(gameChannel.server.roles, {name: "@everyone"}).id;
            if (game.state != STATE.NIGHT) {
                // everyone can talk
                mafiabot.overwritePermissions(gameChannel, everyoneId, { sendMessages: true, mentionEveryone: false });
            } else {
                // everyone can't talk
                mafiabot.overwritePermissions(gameChannel, mafiabot.user, { managePermissions: true }, (error) => {
                    if (!error) {
                        mafiabot.overwritePermissions(gameChannel, everyoneId, { sendMessages: false, managePermissions: false, mentionEveryone: false });
                    }
                });
                // host can talk
                var host = _.find(mafiabot.users, {id: game.hostId});
                mafiabot.overwritePermissions(gameChannel, host, { sendMessages: true });
            }
            if (game.mafiaChannelId) {
                var mafiaChannel = _.find(mafiabot.channels, {id: game.mafiaChannelId});
                if (game.state != STATE.GAMEOVER) {
                    // mafia chat blocked to all
                    mafiabot.overwritePermissions(mafiaChannel, mafiabot.user, { managePermissions: true }, (error) => {
                        if (!error) {
                            mafiabot.overwritePermissions(mafiaChannel, everyoneId, { readMessages: false, sendMessages: false, managePermissions: false, mentionEveryone: false });
                        }
                    });
                    // mafia players can chat in mafia chat
                    var mafiaPlayers = _.filter(game.players, {faction: 'mafia'});
                    mafiabot.overwritePermissions(mafiaChannel, mafiabot.user, { managePermissions: true }, (error) => {
                        for (var i = 0; i < mafiaPlayers.length; i++) {
                            var mafiaPlayer = _.find(mafiabot.users, {id: mafiaPlayers[i].id});
                            mafiabot.overwritePermissions(mafiaChannel, mafiaPlayer, { readMessages: true, sendMessages: true });
                        }
                    });
                } else {
                    // mafia open to all players
                    for (var i = 0; i < game.players.length; i++) {
                        var player = _.find(mafiabot.users, {id: game.players[i].id});
                        mafiabot.overwritePermissions(mafiaChannel, player, { readMessages: true, sendMessages: true });
                    }
                }
            }
            game.permissionsTime = config.permissionsInterval;
        }

        // state-based stuff

        if (game.state == STATE.CONFIRMING) {
            // send confirming action reminders
            game.confirmingReminderTime -= dt;
            if (game.confirmingReminderTime <= 0) {
                printUnconfirmedPlayers(game.channelId);
                game.confirmingReminderTime = config.confirmingReminderInterval;
            }
        }

        if (game.state == STATE.DAY) {
            // count down to no lynch
            game.timeLimit -= dt;
            if (game.timeLimit <= 0) {
                printCurrentVotes(game.channelId);
                endDay(game.channelId, 'NO LYNCH');
            } else {
                var prevMinute = Math.floor((game.timeLimit + dt)/(1000*60));
                var currMinute = Math.floor(game.timeLimit/(1000*60));
                if (game.timeLimit <= config.dayTimeLimitWarning && prevMinute != currMinute) {
                    mafiabot.syncMessage(game.channelId, `**WARNING:** Only ***${s(currMinute + 1, 'minute')}*** left until an automatic **No Lynch**! Use ***${pre}extend*** to vote for a ${Math.floor(config.dayTimeLimitExtension/(60*1000))}-minute time limit extension.`);
                }
            }
        }

        if (game.state == STATE.NIGHT) {
            var livePlayers = _.filter(game.players, 'alive');

            // check if all townies and the mafia chat have finished night actions and if so, start the day countdown
            var allNightActionsFinished = _.every(livePlayers, (player) => {
                var result = fireEvent(getRole(player.role).isFinished, {game: game, player: player});
                return result === null || result === true;
            });
            allNightActionsFinished = allNightActionsFinished && game.mafiaDidNightAction;
            if (allNightActionsFinished) {
                game.timeToNightActionResolution -= dt;
                console.log('Time to day:', game.timeToNightActionResolution);
            } else {
                game.timeToNightActionResolution = config.nightActionBufferTime * (1 + Math.random()/2);
            }
            
            // count down to forcing night action resolution
            game.timeLimit -= dt;
            if (game.timeLimit <= 0) {
                for (var i = 0; i < livePlayers.length; i++) {
                    var player = livePlayers[i];
                    fireEvent(getRole(player.role).onForceNightAction, {game: game, player: player});
                }
                if (!game.mafiaDidNightAction) {
                    mafiabot.sendMessage(game.mafiaChannelId, `**The night action time limit ran out and you were forced to no action!** Hurry up next time...`);
                }
                game.timeToNightActionResolution = 0;
            }

            // resolve night actions and begin day after countdown
            if (game.timeToNightActionResolution <= 0) {
                for (var i = 0; i < livePlayers.length; i++) {
                    var player = livePlayers[i];
                    fireEvent(getRole(player.role).preBlockingPhase, {game: game, player: player});
                }
                for (var i = 0; i < livePlayers.length; i++) {
                    var player = livePlayers[i];
                    fireEvent(getRole(player.role).onBlockTargetingPhase, {game: game, player: player});
                }
                for (var i = 0; i < livePlayers.length; i++) {
                    var player = livePlayers[i];
                    fireEvent(getRole(player.role).onTargetingPhase, {game: game, player: player});
                }
                for (var i = 0; i < livePlayers.length; i++) {
                    var player = livePlayers[i];
                    fireEvent(getRole(player.role).onBlockingPhase, {game: game, player: player});
                }
                for (var i = 0; i < livePlayers.length; i++) {
                    var player = livePlayers[i];
                    fireEvent(getRole(player.role).onActionPhase, {game: game, player: player});
                }
                // just do the mafia kill action here, why not
                var mafiaAction = _.find(game.nightActions, {action: 'mafia kill'});
                if (mafiaAction) {
                    game.nightKills[mafiaAction.targetId] = (game.nightKills[mafiaAction.targetId] || 0) + bulletKill;
                }
                for (var i = 0; i < livePlayers.length; i++) {
                    var player = livePlayers[i];
                    fireEvent(getRole(player.role).onNightResolved, {game: game, player: player});
                }
                // figure out who died
                var deadPlayers = [];
                for (var playerId in game.nightKills) {
                    if (game.nightKills[playerId] > 0) {
                        var deadPlayer = _.find(game.players, {id: playerId});
                        var bulletproofBlocked = game.nightKills[playerId] % bulletKill === 0 && getRole(deadPlayer.role).bulletproof;
                        if (!bulletproofBlocked) {
                            deadPlayer.alive = false;
                            deadPlayer.deathReason = 'Died N' + game.day;
                            deadPlayers.push(deadPlayer);
                        }
                    }
                }
                // start day
                game.state = STATE.DAY;
                game.day++;
                game.votes.length = 0;
                game.voteLog.push({day: game.day});
                game.nightActions.length = 0;
                game.nightKills = {};
                game.timeLimit = config.dayTimeLimit;
                mafiabot.syncMessage(game.channelId, `**All players have finished night actions!**`);
                mafiabot.syncMessage(game.channelId, `***${s(deadPlayers.length, 'player', 's have', ' has')} died.***`, 1000);
                for (var i = 0; i < deadPlayers.length; i++) {
                    var deadPlayer = deadPlayers[i];
                    mafiabot.syncMessage(game.channelId, `<@${deadPlayer.id}>, the **${getFaction(deadPlayer.faction).name} ${getRole(deadPlayer.role).name}**, has died!`, 1000);
                }
                if (!checkForGameOver(game.channelId)) {
                    mafiabot.syncMessage(game.channelId, `Day ${game.day} is now starting.`, 2000);
                    printCurrentPlayers(game.channelId);
                    printDayState(game.channelId);
                }
            }

            // send night action reminders
            game.nightActionReminderTime -= dt;
            if (game.nightActionReminderTime <= 0) {
                var remind = (playerName, channelId) => {
                    console.log('Reminding:', playerName);
                    mafiabot.sendMessage(channelId, `**HEY! *LISTEN!!*** You have ${s(Math.floor(game.timeLimit/(60*1000)), 'minute')} to register a night action before night ends! Remember to use the ***${pre}noaction*** command to confirm you are active, even if you have no night power!`);
                }
                for (var i = 0; i < livePlayers.length; i++) {
                    var player = livePlayers[i];
                    var result = fireEvent(getRole(player.role).isFinished, {game: game, player: player});
                    if (!(result === null || result === true)) {
                        remind(player.name, player.id);
                    }
                }
                if (!game.mafiaDidNightAction) {
                    remind('mafia', game.mafiaChannelId);
                }
                game.nightActionReminderTime = config.nightActionReminderInterval;
            }
        }

        // for detecting when there is a state change
        game.previousState = game.state;
    }

    // save and wait for next loop
    saveData(data);
    setTimeout(mainLoop, Math.max(config.mainLoopInterval - (new Date() - now), 0));
};

// login and kick off main loop after everything is set up
mafiabot.loginWithToken(config.token, null, null, (error, token) => {
    // crash on login error
    if (error) {
        console.log(error.stack || error.response.error.text);
        process.exit(1);
    }
    // wait for channels to be cached first or else there will be weird bugs
    var loginChecks = 0;
    var checkForChannelsThenKickoff = () => {
        if (mafiabot.channels.length) {
            mainLoop(0);
        } else {
            loginChecks++;
            if (loginChecks >= config.loginChecksBeforeRebooting) {
                throw "Failed login check - rebooting!";
            } else {
                setTimeout(checkForChannelsThenKickoff, 100);
            }
        }
    }
    checkForChannelsThenKickoff();
});
module.exports = mafiabot;