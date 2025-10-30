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

export let create_data = {
    name: '',
    description: '',
    creator_notes: '',
    post_history_instructions: '',
    character_version: '',
    system_prompt: '',
    tags: '',
    creator: '',
    personality: '',
    first_message: '',
    avatar: null,
    scenario: '',
    mes_example: '',
    world: '',
    talkativeness: 0.5,
    alternate_greetings: [],
    depth_prompt_prompt: '',
    depth_prompt_depth: 4,
    depth_prompt_role: 'system',
    extensions: {},
    extra_books: [],
};

export const updateCreateData = (field, value) => {
    if (create_data.hasOwnProperty(field)) {
        create_data[field] = value;
    }
};

export const resetCreateData = () => {
    create_data = {
        name: '',
        description: '',
        creator_notes: '',
        post_history_instructions: '',
        character_version: '',
        system_prompt: '',
        tags: '',
        creator: '',
        personality: '',
        first_message: '',
        avatar: null,
        scenario: '',
        mes_example: '',
        world: '',
        talkativeness: 0.5,
        alternate_greetings: [],
        depth_prompt_prompt: '',
        depth_prompt_depth: 4,
        depth_prompt_role: 'system',
        extensions: {},
        extra_books: [],
    };
};
