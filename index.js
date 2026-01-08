// An extension that allows you to manage characters.
import { initializeTagInput } from './scripts/services/tags-service.js';
import { initializeModal } from './scripts/components/modal.js';
import { initializeEventHandlers } from './scripts/events/global-events.js';
import SettingsManager from './scripts/classes/SettingsManager.js';

export const acmSettings = new SettingsManager();

jQuery(async () => {
    await acmSettings.init();
    acmSettings.migrateDropdownPresets();
    await initializeModal();
    initializeEventHandlers();
    initializeTagInput();
});
