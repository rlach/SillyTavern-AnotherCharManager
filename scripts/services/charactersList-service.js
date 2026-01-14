const { Fuse } = SillyTavern.libs;
import { acm } from '../../index.js';
/**
 * Filters and searches through a list of characters based on user-defined criteria such as tags, favorites,
 * and a search query. The method utilizes settings, tag filters, and fuzzy search to return a filtered list
 * of characters that satisfy the specified conditions.
 *
 * The filtering process includes:
 * - Excluding characters with specified excluded tags
 * - Including only characters with all mandatory tags
 * - Optionally including characters with at least one facultative tag
 * - Searching by fields like name, creator, creator notes, or tags using a fuzzy search algorithm
 *
 * @return {Array} The filtered and potentially searched list of character objects that meet the filter criteria.
 */
export function searchAndFilter(){
    let filteredChars = [];
    const charactersCopy = acm.settings.getSetting('favOnly')
        ? [...acm.st.characters].filter(character => character.fav === true || character.data.extensions.fav === true)
        : [...acm.st.characters];

    const excludedTags = $('#acm_excludedTags > span').map(function() { return $(this).data('tagid'); }).get().filter(id => id);
    const mandatoryTags = $('#acm_mandatoryTags > span').map(function() { return $(this).data('tagid'); }).get().filter(id => id);
    const facultativeTags = $('#acm_facultativeTags > span').map(function() { return $(this).data('tagid'); }).get().filter(id => id);

    // Filtering based on tags
    let tagFilteredChars = charactersCopy.filter(item => {
        const characterTags = acm.st.tagMap[item.avatar] || [];

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

    if (acm.settings.searchValue !== '') {
        const searchValueTrimmed = acm.settings.searchValue.trim();
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
            case 'tags': {
                // For tags, we'll search tag names first, then filter characters
                const tagFuseOptions = {
                    keys: ['name'],
                    threshold: 0.3,
                    includeScore: true,
                };
                const tagFuse = new Fuse(acm.st.tagList, tagFuseOptions);
                const matchingTags = tagFuse.search(searchValueTrimmed);
                const matchingTagIds = matchingTags.map(result => result.item.id);

                filteredChars = tagFilteredChars.filter(item => {
                    return (acm.st.tagMap[item.avatar] || []).some(tagId => matchingTagIds.includes(tagId));
                });
                return filteredChars;
            }
        }

        const fuse = new Fuse(tagFilteredChars, fuseOptions);
        const results = fuse.search(searchValueTrimmed);
        filteredChars = results.map(result => result.item);

        return filteredChars;
    }
    else {
        return tagFilteredChars;
    }
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
                comparison = acm.st.tagMap[a.avatar].length - acm.st.tagMap[b.avatar].length;
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
