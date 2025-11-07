import { Fuse } from '/lib.js';
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
        const searchValueTrimmed = searchValue.trim();
        const searchField = $('#search_filter_dropdown').val();

        let fuseOptions;

        switch (searchField) {
            case 'name':
                fuseOptions = {
                    keys: ['data.name'],
                    threshold: 0.3,
                    includeScore: true,
                };
                break;
            case 'creator':
                fuseOptions = {
                    keys: ['data.creator'],
                    threshold: 0.3,
                    includeScore: true,
                };
                break;
            case 'creator_notes':
                fuseOptions = {
                    keys: ['data.creator_notes'],
                    threshold: 0.3,
                    includeScore: true,
                };
                break;
            case 'tags':
                // For tags, we'll search tag names first, then filter characters
                const tagFuseOptions = {
                    keys: ['name'],
                    threshold: 0.3,
                    includeScore: true,
                };
                const tagFuse = new Fuse(tagList, tagFuseOptions);
                const matchingTags = tagFuse.search(searchValueTrimmed);
                const matchingTagIds = matchingTags.map(result => result.item.id);

                filteredChars = tagfilteredChars.filter(item => {
                    return (tagMap[item.avatar] || []).some(tagId => matchingTagIds.includes(tagId));
                });
                return filteredChars;
        }

        const fuse = new Fuse(tagfilteredChars, fuseOptions);
        const results = fuse.search(searchValueTrimmed);
        filteredChars = results.map(result => result.item);

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
