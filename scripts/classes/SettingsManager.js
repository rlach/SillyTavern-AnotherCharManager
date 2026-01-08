import {
    EXTENSION_NAME,
    OLD_EXTENSION_NAME,
    defaultSettings,
    create_data,
} from '../constants/settings.js';
import { extensionSettings, saveSettingsDebounced } from '../constants/context.js';


class SettingsManager {
    constructor(options = {}) {
        this.default = defaultSettings;
        this.create_data = structuredClone(create_data);

        this.extensionName = EXTENSION_NAME;
        this.oldExtensionName = OLD_EXTENSION_NAME;

        this.selectedChar = undefined;
        this.searchValue = '';
        this.mem_menu = undefined;
        this.mem_avatar = undefined;
        this.acm_crop_data = undefined;
    }

    async init(){
        // Create the settings if they don't exist
        extensionSettings.acm = extensionSettings.acm || {};

        // Add default settings for any missing keys
        for (const key in this.default) {
            if (!Object.prototype.hasOwnProperty.call(extensionSettings.acm, key)) {
                extensionSettings.acm[key] = this.default[key];
            }
        }
    }

    setSelectedChar(char) {
        this.selectedChar = char;
    }

    setSearchValue(value) {
        this.searchValue = value;
    }

    setMem_menu(value) {
        this.mem_menu = value;
    }

    setMem_avatar(value){
        this.mem_avatar = value;
    }

    setCrop_data(value){
        this.acm_crop_data = value;
    }

    getSetting(key) {
        return extensionSettings.acm[key];
    }

    updateSetting(key, value) {
        if (Object.prototype.hasOwnProperty.call(extensionSettings.acm, key)) {
            extensionSettings.acm[key] = value;
            saveSettingsDebounced();
        }
    }

    updateCreateData(field, value){
        if (Object.prototype.hasOwnProperty.call(this.create_data, field)) {
            this.create_data[field] = value;
        }
    }

    resetCreateData(){
        this.create_data = structuredClone(create_data);
    }

    resetSettings() {
        extensionSettings.acm = { ...this.default };
        saveSettingsDebounced();
    }

    migrateDropdownPresets() {
        if (!Array.isArray(extensionSettings.acm.dropdownPresets)) {
            return;
        }

        let hasChanges = false;

        extensionSettings.acm.dropdownPresets.forEach(preset => {
            if (Array.isArray(preset.categories)) {
                preset.categories.forEach(category => {
                    if (Array.isArray(category.members) && !category.tags) {
                        category.tags = category.members;
                        delete category.members;
                        hasChanges = true;
                    }
                });
            }
        });

        if (hasChanges) {
            saveSettingsDebounced();
        }
    }
}

export default SettingsManager;
