import { equalsIgnoreCaseAndAccents, includesIgnoreCaseAndAccents } from '../utils.js';
import {
    tagList,
    tagMap,
    power_user,
    saveSettingsDebounced
} from "../constants/context.js";
import { createTagInput } from '/scripts/tags.js';
import { acmCreateTagInput } from "../components/tags.js";

const MAX_EMPTY_TERM_RESULTS = 50;
const MAX_FILTERED_RESULTS = 150;


/**
 * Initializes multiple tag input components on specified elements with provided configurations.
 * This method sets up tag input fields where tags can be added, managed, and removed.
 *
 * @return {void} Does not return a value.
 */
export function initializeTagInput() {
    createTagInput('#acmTagInput', '#acmTagList', { tagOptions: { removable: true } });
    acmCreateTagInput('#input_tag', '#tag_List', { tagOptions: { removable: true } }, 'classic');
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
    const skipIds = new Set(
        [...($(listSelector).find('.tag').map((_, el) => $(el).data('tagid') || $(el).attr('id')))].filter(Boolean)
    );
    const needle = String(request.term || '').trim();
    const usageCounts = buildTagUsageCounts();
    const availableTags = tagList
        .filter(t => !skipIds.has(t.id))
        .sort((a, b) => compareTagsForSort(a, b, usageCounts));

    if (!needle) {
        resolve(availableTags.slice(0, MAX_EMPTY_TERM_RESULTS).map(t => t.name));
        return;
    }

    const hasExactMatch = availableTags.some(t => equalsIgnoreCaseAndAccents(t.name, needle));
    const result = [];

    for (const tag of availableTags) {
        if (includesIgnoreCaseAndAccents(tag.name, needle)) {
            result.push(tag.name);
            if (result.length >= MAX_FILTERED_RESULTS) {
                break;
            }
        }
    }

    if (!hasExactMatch) {
        result.unshift(needle);
    }

    resolve(result);
}

/**
 * Filters suggestions by checking multiple list selectors for existing tags.
 */
export function acmFindTagMulti(request, resolve, listSelectors) {
    const selectors = Array.isArray(listSelectors) ? listSelectors : [listSelectors];
    const skipIds = new Set();

    selectors.forEach(selector => {
        $(selector).find('.tag').each((_, el) => {
            const id = $(el).attr('data-tagid');
            if (id) {
                skipIds.add(id);
            }
        });
    });

    const needle = String(request.term || '').trim();
    const usageCounts = buildTagUsageCounts();
    const availableTags = tagList
        .filter(t => !skipIds.has(t.id))
        .sort((a, b) => compareTagsForSort(a, b, usageCounts));

    if (!needle) {
        resolve(availableTags.slice(0, MAX_EMPTY_TERM_RESULTS).map(t => t.name));
        return;
    }

    const result = [];
    for (const tag of availableTags) {
        if (includesIgnoreCaseAndAccents(tag.name, needle)) {
            result.push(tag.name);
            if (result.length >= MAX_FILTERED_RESULTS) {
                break;
            }
        }
    }

    resolve(result);
}

/**
 * Compares two given tags and returns the compare result
 *
 * @param {Tag} a - First tag
 * @param {Tag} b - Second tag
 * @returns {number} The compare result
 */
function compareTagsForSort(a, b, usageCounts = null) {
    const aUsage = usageCounts?.get(a.id) || 0;
    const bUsage = usageCounts?.get(b.id) || 0;
    if (aUsage !== bUsage) {
        return bUsage - aUsage;
    }

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

/**
 * Builds a usage count map for tags based on current tag assignments.
 * The count is the number of entities that have a given tag.
 *
 * @returns {Map<string, number>} A map of tag id to usage count.
 */
function buildTagUsageCounts() {
    const usageCounts = new Map();

    Object.values(tagMap || {}).forEach(tagIds => {
        if (!Array.isArray(tagIds)) {
            return;
        }

        tagIds.forEach(tagId => {
            const key = String(tagId);
            usageCounts.set(key, (usageCounts.get(key) || 0) + 1);
        });
    });

    return usageCounts;
}
