# MafiaBot

A Discord bot for playing mafia  

Join our public Mafia server if you want to try out the bot: http://discord.me/mafia

## Install

Download [node.js](https://nodejs.org) version **v0.5.8 or higher**, then go to MafiaBot folder and:  
```sh
$ npm install
```

## Config

Setup all the admin user ID values in `config.js`  
Setup the bot's user token in `creds.js` (follow the [Discord developer guide](https://discordapp.com/developers/docs/intro) to get the token)  

## Run

```sh
$ npm start
```
or
```sh
$ node --harmony_rest_parameters mafia-release.js
```
The app uses the Rest Parameters feature so make sure that flag is set. The app will crash immediately if it's not set, so it should be easy to catch.

## Debug

Install [Node Inspector](https://github.com/node-inspector/node-inspector), then

```sh
$ node-debug --nodejs --harmony_rest_parameters mafia-debug.js
```

## Credits
Tombolo: *Role setup contributions*  
foolmoron: *Everything else*  

## Shout Out
To Quick-Man for being the winner of the first ever real game of mafia coordinated by MafiaBot!
