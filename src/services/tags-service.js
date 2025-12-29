import { equalsIgnoreCaseAndAccents, includesIgnoreCaseAndAccents } from '../utils.js';
import {
    tagList,
    tagMap,
    power_user,
    saveSettingsDebounced
} from "../constants/context.js";
import { createTagInput } from '/scripts/tags.js';
import { acmCreateTagInput } from "../components/tags.js";


/**
 * Initializes multiple tag input components on specified elements with provided configurations.
 * This method sets up tag input fields where tags can be added, managed, and removed.
 *
 * @return {void} Does not return a value.
 */
export function initializeTagInput() {
    createTagInput('#acmTagInput', '#acmTagList', { tagOptions: { removable: true } });
    createTagInput('#input_tag', '#tag_List', { tagOptions: { removable: true } });
    // Grouping the three interdependent inputs using the 'multiple' mode
    const multiInputs = [
        '#acm_mandatoryInput',
        '#acm_facultativeInput',
        '#acm_excludedInput'
    ];
    const multiLists = [
        '#acm_mandatoryTags',
        '#acm_facultativeTags',
        '#acm_excludedTags'
    ];

    acmCreateTagInput(multiInputs, multiLists, { tagOptions: { removable: true } }, 'multiple');
}

/**
 * Renames a tag key in the tag map by transferring the corresponding value to a new key
 * and removing the old key from the tag map.
 *
 * @param {string} oldKey - The existing tag key to be renamed.
 * @param {string} newKey - The new name for the tag key.
 * @return {object} tag - Returns the updated tag map after the rename operation.
 */
export function renameTagKey(oldKey, newKey) {
    const value = tagMap[oldKey];
    tagMap[newKey] = value || [];
    delete tagMap[oldKey];
    saveSettingsDebounced();
}

/**
 * Finds tags based on the provided request, resolving the result with filtered and sorted tags that match the search term.
 *
 * @param {Object} request - The search request containing a `term` property to match tags.
 * @param {Function} resolve - A callback function to resolve the result array.
 * @param {string} listSelector - Selector for the list element containing tags, used to exclude tags already present in the list.
 * @return {Array<string>} - The filtered and sorted list of tag names matching the search term, including the term itself if no exact match is found.
 */
export function findTag(request, resolve, listSelector) {
    const skipIds = [...($(listSelector).find('.tag').map((_, el) => $(el).data('tagid')))];
    const haystack = tagList
        .filter(t => !skipIds.includes(t.id))
        .sort(compareTagsForSort)
        .map(t => t.name);
    const needle = request.term;
    const hasExactMatch = haystack.findIndex(x => equalsIgnoreCaseAndAccents(x, needle)) !== -1;
    const result = haystack.filter(x => includesIgnoreCaseAndAccents(x, needle));

    if (needle && !hasExactMatch) {
        result.unshift(request.term);
    }
    resolve(result);
}

/**
 * Filters suggestions by checking multiple list selectors for existing tags.
 */
export function acmFindTagMulti(request, resolve, listSelectors) {
    const selectors = Array.isArray(listSelectors) ? listSelectors : [listSelectors];
    const skipIds = [];

    selectors.forEach(selector => {
        $(selector).find('.tag').each((_, el) => {
            const id = $(el).attr('data-tagid');
            if (id) skipIds.push(id);
        });
    });

    const haystack = tagList
        .filter(t => !skipIds.includes(t.id))
        .sort(compareTagsForSort)
        .map(t => t.name);

    const needle = request.term;
    const result = haystack.filter(x => includesIgnoreCaseAndAccents(x, needle));
    resolve(result);
}

/**
 * Compares two given tags and returns the compare result
 *
 * @param {Tag} a - First tag
 * @param {Tag} b - Second tag
 * @returns {number} The compare result
 */
function compareTagsForSort(a, b) {
    const defaultSort = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    if (power_user.auto_sort_tags) {
        return defaultSort;
    }

    if (a.sort_order !== undefined && b.sort_order !== undefined) {
        return a.sort_order - b.sort_order;
    } else if (a.sort_order !== undefined) {
        return -1;
    } else if (b.sort_order !== undefined) {
        return 1;
    } else {
        return defaultSort;
    }
}
