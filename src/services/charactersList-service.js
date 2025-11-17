import { Fuse } from '/lib.js';
import { getSetting } from "./settings-service.js";
import { characters, tagList, tagMap } from "../constants/context.js";
import { searchValue } from "../constants/settings.js";

export function searchAndFilter(){
    let filteredChars = [];
    const charactersCopy = getSetting('favOnly')
        ? [...characters].filter(character => character.fav === true || character.data.extensions.fav === true)
        : [...characters];

    const excludedTags = $('#acm_excludedTags > span').map(function() { return this.id; }).get().filter(id => id);
    const mandatoryTags = $('#acm_mandatoryTags > span').map(function() { return this.id; }).get().filter(id => id);
    const facultativeTags = $('#acm_facultativeTags > span').map(function() { return this.id; }).get().filter(id => id);

    // Filtering based on tags
    let tagfilteredChars = charactersCopy.filter(item => {
        const characterTags = tagMap[item.avatar] || [];

        // First: Exclude characters with any excluded tags
        if (excludedTags.length > 0) {
            const hasExcludedTag = characterTags.some(tagId => excludedTags.includes(tagId));
            if (hasExcludedTag) return false;
        }

        // Second: Filter out characters that don't have ALL mandatory tags
        if (mandatoryTags.length > 0) {
            const hasAllMandatoryTags = mandatoryTags.every(tagId => characterTags.includes(tagId));
            if (!hasAllMandatoryTags) return false;
        }

        // Third: Filter out characters that don't have at least ONE facultative tag
        if (facultativeTags.length > 0) {
            const hasAtLeastOneFacultativeTag = facultativeTags.some(tagId => characterTags.includes(tagId));
            if (!hasAtLeastOneFacultativeTag) return false;
        }

        return true;
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
