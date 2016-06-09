const _ = require('lodash');

// currently can only look for 1 instance of a role
var variations = _.map([
    {
        name: '[cop -> tracker/gunsmith]',
        before: ['town cop', 'town vanilla'],
        after: ['town tracker', 'town gunsmith'],
    },
    {
        name: '[vanilla -> bomb]',
        minPlayers: 9,
        before: ['town vanilla'],
        without: ['town bomb'],
        after: ['town bomb'],
    },
    {
        name: '[assassin -> godfather/poisoner]',
        before: ['town cop', 'mafia vanilla', 'mafia assassin'],
        after: ['town cop', 'mafia godfather', 'mafia poisoner'],
    },
], (variation) => ({ // convert to better format for logic
    name: variation.name,
    minPlayers: variation.minPlayers,
    before: variation.before.map(role => ({faction: role.split(' ')[0], role: role.split(' ')[1]})),
    without: (variation.without || []).map(role => ({faction: role.split(' ')[0], role: role.split(' ')[1]})),
    after: variation.after.map(role => ({faction: role.split(' ')[0], role: role.split(' ')[1]})),
}));

variations.canMutate = (roleset, variation) => {
    return roleset.roles.length >= (variation.minPlayers || 0)
    && _.every(variation.before, role => _.find(roleset.roles, role))
    && _.every(variation.without, role => !_.find(roleset.roles, role))
    ;
};

variations.mutate = (roleset, variation) => {
    var roleset = _.cloneDeep(roleset);
    for (var i = 0; i < variation.before.length; i++) {
        var roleObj = _.find(roleset.roles, variation.before[i]);
        roleObj.faction = variation.after[i].faction;
        roleObj.role = variation.after[i].role;
    }
    roleset.name += ' + ' + variation.name;
    return roleset;

};

module.exports = variations;