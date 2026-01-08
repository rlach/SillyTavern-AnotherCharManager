// An extension that allows you to manage characters.
import { initializeTagInput } from './scripts/services/tags-service.js';
import { initializeSettings, migrateDropdownPresets } from './scripts/services/settings-service.js';
import { initializeModal } from './scripts/components/modal.js';
import { initializeEventHandlers } from './scripts/events/global-events.js';

jQuery(async () => {
    await initializeSettings();
    migrateDropdownPresets();
    await initializeModal();
    initializeEventHandlers();
    initializeTagInput();
});
