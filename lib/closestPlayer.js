const _ = require('lodash');
const levenshtein = (() => { // wrap levenshtein function to get 0.0 - 1.0 similarity range
    const fl = require('fast-levenshtein'); 
    return (a, b) => { 
        return 1 - fl.get(a, b)/Math.max(a.length, b.length); 
    }; 
})();
const jarowinkler = require('jaro-winkler');

module.exports = (str, players) => {
    str = (str || '').toLowerCase();
    if (str.indexOf('@') >= 0) {
        // direct mention, easy to find player
        return _.find(players, {id: str.replace(/[\<\@\>]/g, '')});
    } else {
        // indirect mention, need to use string distance algorithm to find player
        const levLimit = 0.5;
        const jwLimit = 0.7;
        var playerNameComparisons = _.sortBy(_.flatten(_.map(players, player => {
            var names = [player.name]; // full name is always a possible name
            // also try names split up by capitalization or spaces
            var splitNames = player.name.split(/([A-Z _][^A-Z _]*)/).filter(str => str.trim().length > 1);
            if (splitNames.length > 1) {
                names = names.concat(splitNames);
            }
            return names.map(name => ({
                id: player.id,
                name: player.name,
                distanceName: name.trim().toLowerCase(),
                lev: levenshtein(str, name.trim().toLowerCase()),
                jw: jarowinkler(str, name.trim().toLowerCase()),
            }));
        })), item => {
            var score = 0;
            if (item.lev >= levLimit) score += 1000;
            if (item.jw >= jwLimit) score += 1000;
            score += item.lev;
            score += item.jw;
            return -score;
        });
        var closestMatch = playerNameComparisons[0];
        if (closestMatch.lev >= levLimit || closestMatch.jw >= jwLimit) {
            return _.find(players, {id: closestMatch.id});
        } else {
            return null; // closest match is not good enough
        }
    }
}