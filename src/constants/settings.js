// Default settings for the extension
export const extensionName = 'SillyTavern-AnotherCharManager';
export const oldExtensionName = 'SillyTavern-AnotherTagManager';

export let selectedChar;
export const setSelectedChar = (value) => {
    selectedChar = value;
};

export let searchValue = '';
export const setSearchValue = (value) => {
    searchValue = value;
};

export let mem_menu, mem_avatar;
export const setMem_menu = (value) => {
    mem_menu = value;
};
export const setMem_avatar = (value) => {
    mem_avatar = value;
};

export let acm_crop_data;
export const setCrop_data = (value) => {
    acm_crop_data = value;
};

export const tagFilterstates = new Map();

export const defaultSettings = {
    popupWidth: 50,
    sortingField: "name",
    sortingOrder: "asc",
    favOnly: false,
    dropdownUI: false,
    dropdownMode: "allTags",
    presetId: 0,
    dropdownPresets: [
        { name: "Preset 1", categories: [] },
        { name: "Preset 2", categories: [] },
        { name: "Preset 3", categories: [] },
        { name: "Preset 4", categories: [] },
        { name: "Preset 5", categories: [] }
    ]
};
