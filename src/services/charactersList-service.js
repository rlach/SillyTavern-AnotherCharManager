// import { Fuse } from '/lib.js';
import { groups } from '/scripts/group-chats.js';
import { getSetting } from "./settings-service.js";
import { characters, tagList, tagMap } from "../constants/context.js";
import { searchValue } from "../constants/settings.js";
const { Fuse } = SillyTavern.libs;
/**
 * Filters and searches through characters and groups based on user-defined criteria.
 * Returns an array of objects with type 'character' or 'group'.
 *
 * @return {Array} The filtered list with objects containing type and data
 */
export function searchAndFilter(){
    const groupsFilter = getSetting('groupsFilter'); // 0=no groups, 1=show groups, 2=only groups
    let results = [];

    // Handle characters (unless only groups)
    if (groupsFilter !== 2) {
        const charactersCopy = getSetting('favOnly')
            ? [...characters].filter(character => character.fav === true || character.data.extensions.fav === true)
            : [...characters];

        const excludedTags = $('#acm_excludedTags > span').map(function() { return $(this).data('tagid'); }).get().filter(id => id);
        const mandatoryTags = $('#acm_mandatoryTags > span').map(function() { return $(this).data('tagid'); }).get().filter(id => id);
        const facultativeTags = $('#acm_facultativeTags > span').map(function() { return $(this).data('tagid'); }).get().filter(id => id);

        let tagfilteredChars = charactersCopy.filter(item => {
            const characterTags = tagMap[item.avatar] || [];

            if (excludedTags.length > 0) {
                const hasExcludedTag = characterTags.some(tagId => excludedTags.includes(tagId));
                if (hasExcludedTag) return false;
            }

            if (mandatoryTags.length > 0) {
                const hasAllMandatoryTags = mandatoryTags.every(tagId => characterTags.includes(tagId));
                if (!hasAllMandatoryTags) return false;
            }

            if (facultativeTags.length > 0) {
                const hasAtLeastOneFacultativeTag = facultativeTags.some(tagId => characterTags.includes(tagId));
                if (!hasAtLeastOneFacultativeTag) return false;
            }

            return true;
        });

        // Apply search if needed
        if (searchValue !== '') {
            const searchValueTrimmed = searchValue.trim();
            const searchField = $('#search_filter_dropdown').val();

            if (searchField === 'tags') {
                const tagFuseOptions = {
                    keys: ['name'],
                    threshold: 0.3,
                    includeScore: true,
                };
                const tagFuse = new Fuse(tagList, tagFuseOptions);
                const matchingTags = tagFuse.search(searchValueTrimmed);
                const matchingTagIds = matchingTags.map(result => result.item.id);

                tagfilteredChars = tagfilteredChars.filter(item => {
                    return (tagMap[item.avatar] || []).some(tagId => matchingTagIds.includes(tagId));
                });
            } else {
                const fuseOptions = {
                    keys: [`data.${searchField}`],
                    threshold: 0.3,
                    includeScore: true,
                };
                const fuse = new Fuse(tagfilteredChars, fuseOptions);
                const searchResults = fuse.search(searchValueTrimmed);
                tagfilteredChars = searchResults.map(result => result.item);
            }
        }

        // Convert characters to result format
        results = tagfilteredChars.map(char => ({ type: 'character', ...char }));
    }

    // Handle groups (if show or only)
    if (groupsFilter >= 1) {
        let filteredGroups = [...groups];

        // Apply search to groups if needed
        if (searchValue !== '') {
            const searchValueTrimmed = searchValue.trim();
            const searchField = $('#search_filter_dropdown').val();

            if (searchField === 'name') {
                const fuseOptions = {
                    keys: ['name'],
                    threshold: 0.3,
                    includeScore: true,
                };
                const fuse = new Fuse(filteredGroups, fuseOptions);
                const searchResults = fuse.search(searchValueTrimmed);
                filteredGroups = searchResults.map(result => result.item);
            }
            // Groups don't have creator or creator_notes, so ignore those search fields
        }

        // Convert groups to result format
        const groupResults = filteredGroups.map(group => ({ type: 'group', group, name: group.name }));
        results = results.concat(groupResults);
    }

    return results;
}

/**
 * Sorts an array of character objects based on a specified property and order.
 *
 * @param {Array<Object>} chars - The array of character objects to be sorted.
 * @param {string} sort_data - The property of the character objects to sort by (e.g., 'name', 'tags', 'date_last_chat', 'date_added', 'data_size').
 * @param {string} sort_order - The order of sorting, either 'asc' for ascending or 'desc' for descending.
 * @return {Array<Object>} The sorted array of character objects.
 */
export function sortCharAR(chars, sort_data, sort_order) {
    return chars.sort((a, b) => {
        let comparison = 0;

        switch (sort_data) {
            case 'name':
                comparison = a[sort_data].localeCompare(b[sort_data]);
                break;
            case 'tags':
                comparison = (tagMap[a.avatar]?.length || 0) - (tagMap[b.avatar]?.length || 0);
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
