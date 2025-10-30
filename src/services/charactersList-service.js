import { getSetting } from "./settings-service.js";
import { characters, tagList, tagMap } from "../constants/context.js";
import { searchValue, tagFilterstates } from "../constants/settings.js";

export function searchAndFilter(){
    let filteredChars = [];
    const charactersCopy = getSetting('favOnly')
        ? [...characters].filter(character => character.fav === true || character.data.extensions.fav === true)
        : [...characters];

    // Get tags states
    const tagStates = [...tagFilterstates.entries()];

    // Split included and excluded tags
    const includedTagIds = tagList
        .filter(tag => tagStates.find(([id, state]) => id === tag.id && state === 2))
        .map(tag => tag.id);

    const excludedTagIds = tagList
        .filter(tag => tagStates.find(([id, state]) => id === tag.id && state === 3))
        .map(tag => tag.id);

    // Filtering based on tags states
    let tagfilteredChars = charactersCopy.filter(item => {
        const characterTags = tagMap[item.avatar] || [];

        // Check if there are included tags
        const hasIncludedTag = includedTagIds.length === 0 || characterTags.some(tagId => includedTagIds.includes(tagId));

        // Check if there are excluded tags
        const hasExcludedTag = characterTags.some(tagId => excludedTagIds.includes(tagId));

        // Return true if:
        // 1. There are no excluded tags
        // 2. There are at least one included tags
        return hasIncludedTag && !hasExcludedTag;
    });

    if (searchValue !== '') {
        const searchValueLower = searchValue.trim().toLowerCase();
        const searchField = $('#search_filter_dropdown').val();

        switch (searchField) {
            case 'name':
                filteredChars = tagfilteredChars.filter(item => item.data.name.toLowerCase().includes(searchValueLower));
                break;
            case 'creator':
                filteredChars = tagfilteredChars.filter(item => item.data.creator?.toLowerCase().includes(searchValueLower));
                break;
            case 'creator_notes':
                filteredChars = tagfilteredChars.filter(item => item.data.creator_notes?.toLowerCase().includes(searchValueLower));
                break;
            case 'tags':
                filteredChars = tagfilteredChars.filter(item => {
                    const matchingTagIds = tagList
                        .filter(tag => tag.name.toLowerCase().includes(searchValueLower))
                        .map(tag => tag.id);
                    return (tagMap[item.avatar] || []).some(tagId => matchingTagIds.includes(tagId));
                });
                break;
        }
        return filteredChars;
    }
    else {
        return tagfilteredChars;
    }
}

// Function to sort the character array based on specified property and order
export function sortCharAR(chars, sort_data, sort_order) {
    return chars.sort((a, b) => {
        let comparison = 0;

        switch (sort_data) {
            case 'name':
                comparison = a[sort_data].localeCompare(b[sort_data]);
                break;
            case 'tags':
                comparison = tagMap[a.avatar].length - tagMap[b.avatar].length;
                break;
            case 'date_last_chat':
                comparison = b[sort_data] - a[sort_data];
                break;
            case 'date_added':
                comparison = b[sort_data] - a[sort_data];
                break;
            case 'data_size':
                comparison = a[sort_data] - b[sort_data];
                break;
        }
        return sort_order === 'desc' ? comparison * -1 : comparison;
    });
}
