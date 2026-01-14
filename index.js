// An extension that allows you to manage characters.
import { initializeCharactersEvents } from './scripts/events/characters-events.js';
import { initializeCharactersListEvents, initializeToolbarEvents } from './scripts/events/charactersList-events.js';
import { AppContext } from './scripts/classes/AppContext.js';
import { PresetManager } from './scripts/classes/PresetManager.js';
import { TagManager } from './scripts/classes/TagManager.js';
import { ModalManager } from './scripts/classes/ModalManager.js';
import { CharacterCreationModal } from './scripts/classes/CharacterCreationModal.js';

export const acm = new AppContext();
export const modalManager = new ModalManager(acm.eventManager, acm.settings, acm.st);
export const characterCreationModal = new CharacterCreationModal(acm.eventManager, acm.settings, acm.st);
export const tagManager = new TagManager(acm.eventManager, acm.st);
export const presetManager = new PresetManager(acm.eventManager, acm.settings, acm.st, tagManager);

jQuery(async () => {
    await acm.settings.init();
    acm.settings.migrateDropdownPresets();
    await modalManager.initializeModal();
    characterCreationModal.initializeCharacterCreationEvents();
    tagManager.initializeTagInput();
    presetManager.updateDropdownPresetNames();
    presetManager.registerListeners();
    initializeToolbarEvents();
    initializeCharactersListEvents();
    initializeCharactersEvents();
});
