// An extension that allows you to manage characters.
import { initializeModal } from './scripts/components/modal.js';
import { initializeEventHandlers } from './scripts/events/global-events.js';
import { AppContext } from './scripts/classes/AppContext.js';
import { PresetManager } from './scripts/classes/PresetManager.js';
import { TagManager } from './scripts/classes/TagManager.js';

export const acm = new AppContext();
export const tagManager = new TagManager(acm.eventManager, acm.st);
export const presetManager = new PresetManager(acm.eventManager, acm.settings, acm.st, tagManager);

jQuery(async () => {
    await acm.settings.init();
    acm.settings.migrateDropdownPresets();
    await initializeModal();
    tagManager.initializeTagInput();
    presetManager.registerListeners();
    initializeEventHandlers();
});
