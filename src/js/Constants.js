// This file defines constants used throughout the application.
const path = require('path');

const INSTALL_PATH = nw.App.startPath;
const UPDATER_EXT = { win32: '.exe', darwin: '.app' };

module.exports = {
    InstallPath: INSTALL_PATH,

    // Application Updates
    Update: {
        URL: 'https://kruithne.net/wow.export/%s/',
        Manifest: 'package.json',
        Directory: path.join(INSTALL_PATH, '.update'),
        Helper: 'updater' + (UPDATER_EXT[process.platform] || '')
    },

    // Product Keys
    ProductKeys: {
        WORLD_OF_WARCRAFT: 'wow',
        WORLD_OF_WARCRAFT_PTR: 'wowt',
        WORLD_OF_WARCRAFT_BETA: 'wow_beta',
    },

    // Blizzard Patch Server
    PatchServer: {
        Regions: ['eu', 'us', 'kr', 'cn', 'tw'],
        Host: 'http://%s.patch.battle.net:1119',
        ServerConfig: 'cdns',
        VersionConfig: 'versions'
    }
};