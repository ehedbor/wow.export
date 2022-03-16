/*!
	wow.export (https://github.com/Kruithne/wow.export)
	Authors: Kruithne <kruithne@gmail.com>
	License: MIT
 */
const EventEmitter = require('events');
const generics = require('./generics');
const Locale = require('./casc/locale-flags');

let toastTimer = -1; // Used by setToast() for TTL toast prompts.

// core.events is a global event handler used for dispatching
// events from any point in the system, to any other point.
const events = new EventEmitter();
events.setMaxListeners(666);

// dropHandlers contains handlers for drag/drop support.
// Each item is an object defining .ext, .prompt() and .process().
const dropHandlers = [];

// loaders is an array of promises which need to be resolved as a 
// step in the loading process, allowing components to initialize.
let loaders = [];

// The `view` object is used as the data source for the main Vue instance.
// All properties within it will be reactive once the view has been initialized.
const view = {
	screenStack: [], // Controls the currently active interface screen.
	isBusy: 0, // To prevent race-conditions with multiple tasks, we adjust isBusy to indicate blocking states.
	isDev: !BUILD_RELEASE, // True if in development environment.
	loadingProgress: '', // Sets the progress text for the loading screen.
	loadingTitle: '', // Sets the title text for the loading screen.
	loadPct: -1, // Controls active loading bar percentage.
	toast: null, // Controls the currently active toast bar.
	cdnRegions: [], // CDN region data.
	selectedCDNRegion: null, // Active CDN region.
	lockCDNRegion: false, // If true, do not programmatically alter the selected CDN region.
	config: {}, // Will contain default/user-set configuration. Use config module to operate.
	configEdit: {}, // Temporary configuration clone used during user configuration editing.
	availableLocalBuilds: null, // Array containing local builds to display during source select.
	availableRemoteBuilds: null, // Array containing remote builds to display during source select.
	casc: null, // Active CASC instance.
	cacheSize: 0, // Active size of the user cache.
	userInputTactKey: '', // Value of manual tact key field.
	userInputTactKeyName: '', // Value of manual tact key name field.
	userInputFilterTextures: '', // Value of the 'filter' field for textures.
	userInputFilterSounds: '', // Value of the 'filter' field for sounds/music.
	userInputFilterVideos: '', // Value of the 'filter' field for video files.
	userInputFilterText: '', // Value of the 'filter' field for text files.
	userInputFilterModels: '', // Value of the 'filter' field for models.
	userInputFilterMaps: '', // Value of the 'filter' field for maps.
	userInputFilterItems: '', // Value of the 'filter' field of items.
	userInputFilterDB2s: '', // Value of the 'filter' field of DBs.
	selectionTextures: [], // Current user selection of texture files.
	selectionModels: [], // Current user selection of models.
	selectionSounds: [], // Current user selection of sounds.
	selectionVideos: [],  // Current user selection of videos.
	selectionText: [], // Current user selection of text files.
	selectionMaps: [], // Current user selection of maps.
	selectionItems: [], // Current user selection of items.
	selectionDB2s: [], // Current user selection of DB2s.
	listfileTextures: [], // Filtered listfile for texture files.
	listfileSounds: [], // Filtered listfile for sound files.
	listfileVideos: [], // Filtered listfile for video files.
	listfileText: [], // Filtered listfile for text files.
	listfileModels: [], // Filtered listfile for M2/WMO models.
	listfileItems: [], // Filtered item entries.
	listfileDB2s: [], // Filtered DB2 entries.
	tableBrowserHeaders: [], // DB2 headers
	tableBrowserRows: [], // DB2 rows
	availableLocale: Locale, // Available CASC locale.
	fileDropPrompt: null, // Prompt to display for file drag/drops.
	textViewerSelectedText: '', // Active text for the text viewer.
	soundPlayerSeek: 0, // Current seek of the sound player.
	soundPlayerState: false, // Playing state of the sound player.
	soundPlayerTitle: 'No File Selected', // Name of the currently playing sound track.
	soundPlayerDuration: 0, // Duration of the currently playing sound track.
	modelViewerContext: null, // 3D context for the model viewer.
	modelViewerActiveType: 'none', // Type of model actively selected ('m2', 'wmo', 'none').
	modelViewerGeosets: [], // Active M2 model geoset control.
	modelViewerSkins: [], // Active M2 model skins.
	modelViewerSkinsSelection: [], // Selected M2 model skins.
	modelViewerWMOGroups: [], // Active WMO model group control.
	modelViewerWMOSets: [], // Active WMO doodad set control.
	modelViewerAutoAdjust: true, // Automatic camera adjustment.
	textureRibbonStack: [], // Texture preview stack for model viewer.
	textureRibbonSlotCount: 0, // How many texture slots to render (dynamic).
	textureRibbonPage: 0, // Active page of texture slots to render.
	contextNodeTextureRibbon: null, // Context menu node for the texture ribbon.
	contextNodeItem: null, // Context menu node for the items listfile.
	hideExtraMenu: true, // Controller for the extra context menu.
	itemViewerTypeMask: [], // Active item type control.
	texturePreviewWidth: 256, // Active width of the texture preview.
	texturePreviewHeight: 256, // Active height of the texture preview.
	texturePreviewURL: '', // Active URL of the texture preview image.
	texturePreviewInfo: '', // Text information for a displayed texture.
	overrideModelList: [], // Override list of models.
	overrideModelName: '', // Override model name.
	overrideTextureList: [], // Override list of textures.
	overrideTextureName: '', // Override texture name.
	mapViewerMaps: [], // Available maps for the map viewer.
	mapViewerHasWorldModel: false, // Does selected map have a world model?
	mapViewerTileLoader: null, // Tile loader for active map viewer map.
	mapViewerSelectedMap: null, // Currently selected map.
	mapViewerSelectedDir: null,
	mapViewerChunkMask: null, // Map viewer chunk mask.
	mapViewerSelection: [], // Map viewer tile selection
	exportCancelled: false, // Export cancellation state.
	isXmas: (new Date().getMonth() === 11),
	regexTooltip: '(a|b) - Matches either a or b.\n[a-f] - Matches characters between a-f.\n[^a-d] - Matches characters that are not between a-d.\n\\s - Matches whitespace characters.\n\\d - Matches any digit.\na? - Matches zero or one of a.\na* - Matches zero or more of a.\na+ - Matches one or more of a.\na{3} - Matches exactly 3 of a.'
};

/**
 * Run an async function while preventing the user from starting others.
 * This is heavily used in UI to disable components during big tasks.
 * @param {function} func 
 */
const block = async (func) => {
	view.isBusy++;
	await func();
	view.isBusy--;
};

/**
 * Create a progress interface for easy status reporting.
 * @param {number} segments 
 * @returns {Progress}
 */
const createProgress = (segments = 1) => {
	view.loadPct = 0;
	return {
		segWeight: 1 / segments,
		value: 0,
		step: async function(text) {
			this.value++;
			view.loadPct = Math.min(this.value * this.segWeight, 1);

			if (text)
				view.loadingProgress = text;

			await generics.redraw();
		}
	};
};

/**
 * Hide the currently active toast prompt.
 * @param {boolean} userCancel
 */
const hideToast = (userCancel = false) => {
	// Cancel outstanding toast expiry timer.
	if (toastTimer > -1) {
		clearTimeout(toastTimer);
		toastTimer = -1;
	}

	view.toast = null;

	if (userCancel)
		events.emit('toast-cancelled');
};

/**
 * Display a toast message.
 * @param {string} toastType 'error', 'info', 'success', 'progress'
 * @param {string} message 
 * @param {object} options
 * @param {number} ttl Time in milliseconds before removing the toast.
 * @param {boolean} closable If true, toast can manually be closed.
 */
const setToast = (toastType, message, options = null, ttl = 10000, closable = true) => {
	view.toast = { type: toastType, message, options, closable };

	// Remove any outstanding toast timer we may have.
	clearTimeout(toastTimer);

	// Create a timer to remove this toast.
	if (ttl > -1)
		toastTimer = setTimeout(hideToast, ttl);
}

/**
 * Open user-configured export directory with OS default.
 */
const openExportDirectory = () => {
	nw.Shell.openItem(view.config.exportDirectory)
};

/**
 * Register a handler for file drops.
 * @param {object} handler 
 */
const registerDropHandler = (handler) => {
	// Ensure the extensions are all lower-case.
	handler.ext = handler.ext.map(e => e.toLowerCase());
	dropHandlers.push(handler);
};

/**
 * Get a drop handler for the given file path.
 * @param {string} file 
 */
const getDropHandler = (file) => {
	file = file.toLowerCase();

	for (const handler of dropHandlers) {
		for (const ext of handler.ext) {
			if (file.endsWith(ext))
				return handler;
		}
	}
	
	return null;
};

/**
 * Register a promise to be resolved during the last loading step.
 * @param {function} func 
 */
const registerLoadFunc = (func) => {
	loaders.push(func);
};

/**
 * Resolve all registered loader functions.
 */
const runLoadFuncs = async () => {
	while (loaders.length > 0)
		await loaders.shift()();
		
	loaders = undefined;
};

const core = { 
	events,
	view,
	block,
	createProgress,
	setToast,
	hideToast,	
	openExportDirectory,
	registerDropHandler,
	getDropHandler,
	registerLoadFunc,
	runLoadFuncs
};

module.exports = core;