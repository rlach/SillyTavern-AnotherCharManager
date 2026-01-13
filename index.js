// An extension that allows you to manage characters.
import { initializeTagInput } from './scripts/services/tags-service.js';
import { initializeModal } from './scripts/components/modal.js';
import { initializeEventHandlers } from './scripts/events/global-events.js';
import { AppContext } from './scripts/classes/AppContext.js';

export const acm = new AppContext();

jQuery(async () => {
    await acm.settings.init();
    acm.settings.migrateDropdownPresets();
    await initializeModal();
    initializeEventHandlers();
    initializeTagInput();
});
