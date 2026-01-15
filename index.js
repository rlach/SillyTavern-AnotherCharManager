// An extension that allows you to manage characters.
import { AppContext } from './scripts/classes/AppContext.js';
import { PresetManager } from './scripts/classes/PresetManager.js';
import { TagManager } from './scripts/classes/TagManager.js';
import { ModalManager } from './scripts/classes/ModalManager.js';
import { CharListManager } from "./scripts/classes/CharListManager.js";

export const acm = new AppContext();
export const modalManager = new ModalManager(acm.eventManager, acm.settings, acm.st);
export const tagManager = new TagManager(acm.eventManager, acm.st);
export const presetManager = new PresetManager(acm.eventManager, acm.settings, acm.st, tagManager);
export const charListManager = new CharListManager(acm.eventManager, acm.settings, acm.st, presetManager);


jQuery(async () => {
    await acm.settings.init();
    acm.settings.migrateDropdownPresets();
    await modalManager.init();
    tagManager.init();
    presetManager.init();
    charListManager.init();
});
