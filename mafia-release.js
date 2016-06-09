global.RELEASE = true;
var d = require('domain').create()
var mafiabot = null;
d.on('error', function(e) {
    if (e.stack) {
        console.log(e.stack);
        mafiabot.sendMessage(mafiabot.latestChannel, `💢 ***MafiaBot has encountered an error!***\n\`${e.stack.split('\n')[0]} - ${/\((.*\\)*(.*)\)/.exec(e.stack.split('\n')[1])[2]}\`\n\n**Restarting MafiaBot now... hopefully it won't happen again!**`, function() {
            process.exit(1);
        });
        setTimeout(function() { process.exit(1); }, 3000); // just in case
    } else {
        process.exit(1);
    }
});
d.run(function() {
    mafiabot = require('./mafia.js');
})