// An extension that allows you to manage characters.
import { initializeEventHandlers } from './scripts/events/global-events.js';
import { AppContext } from './scripts/classes/AppContext.js';
import { PresetManager } from './scripts/classes/PresetManager.js';
import { TagManager } from './scripts/classes/TagManager.js';
import { ModalManager } from './scripts/classes/ModalManager.js';

export const acm = new AppContext();
export const modalManager = new ModalManager(acm.eventManager, acm.settings, acm.st);
export const tagManager = new TagManager(acm.eventManager, acm.st);
export const presetManager = new PresetManager(acm.eventManager, acm.settings, acm.st, tagManager);

jQuery(async () => {
    await acm.settings.init();
    acm.settings.migrateDropdownPresets();
    await modalManager.initializeModal();
    tagManager.initializeTagInput();
    presetManager.updateDropdownPresetNames();
    presetManager.registerListeners();
    initializeEventHandlers();
});
