// import { Fuse } from '/lib.js';
import { groups } from '/scripts/group-chats.js';
import { getSetting } from "./settings-service.js";
import { characters, tagList, tagMap } from "../constants/context.js";
import { searchValue } from "../constants/settings.js";
import { includesIgnoreCaseAndAccents } from "../utils.js";
const { Fuse } = SillyTavern.libs;

function getSearchMode() {
    return String(getSetting('searchMode') || 'fuzzy').toLowerCase() === 'exact' ? 'exact' : 'fuzzy';
}

function matchesChatsFilter(hasChats, chatsFilter) {
    if (chatsFilter === 1) {
        return hasChats;
    }

    if (chatsFilter === 2) {
        return !hasChats;
    }

    return true;
}

function parsePositiveNumber(value) {
    if (typeof value === 'number') {
        return Number.isFinite(value) && value > 0;
    }

    const text = String(value ?? '').trim();
    if (!text) {
        return false;
    }

    const numericValue = Number(text);
    return Number.isFinite(numericValue) && numericValue > 0;
}

function characterHasChats(character) {
    return parsePositiveNumber(character?.chat_size) || parsePositiveNumber(character?.date_last_chat);
}

function groupHasChats(group) {
    return parsePositiveNumber(group?.chat_size) || parsePositiveNumber(group?.date_last_chat);
}

// Mirrors the paths used to build the Links section in char-details (see getCharacterLinkHtml).
function characterHasSource(character, source) {
    if (source === 'chub') {
        return !!character?.data?.extensions?.chub?.full_path;
    }
    if (source === 'botbooru') {
        return !!character?.data?.extensions?.botbooru?.post_id;
    }
    return false;
}

function matchesSourceFilter(character, sourceFilter) {
    for (const source of ['chub', 'botbooru']) {
        const state = Number(sourceFilter?.[source]) || 0;
        if (state === 0) continue;

        const hasSource = characterHasSource(character, source);
        if (state === 1 && !hasSource) return false; // include only
        if (state === 2 && hasSource) return false; // exclude
    }
    return true;
}

// Groups never have a chub/botbooru source, so they can't satisfy an "include" filter.
function hasAnyIncludeSourceFilter(sourceFilter) {
    return Number(sourceFilter?.chub) === 1 || Number(sourceFilter?.botbooru) === 1;
}

function getCharacterFieldValue(item, field) {
    if (field === 'name') {
        return String(item?.name || '');
    }

    if (field === 'creator') {
        return String(item?.data?.creator || '');
    }

    if (field === 'creator_notes') {
        return String(item?.data?.creator_notes || item?.creatorcomment || '');
    }

    return '';
}

function filterCharactersExact(items, searchField, query) {
    if (searchField === 'tags') {
        const matchingTagIds = tagList
            .filter(tag => includesIgnoreCaseAndAccents(String(tag?.name || ''), query))
            .map(tag => tag.id);

        return items.filter(item => (tagMap[item.avatar] || []).some(tagId => matchingTagIds.includes(tagId)));
    }

    return items.filter(item => includesIgnoreCaseAndAccents(getCharacterFieldValue(item, searchField), query));
}

function filterCharactersFuzzy(items, searchField, query) {
    if (searchField === 'tags') {
        const tagFuseOptions = {
            keys: ['name'],
            threshold: 0.3,
            includeScore: true,
        };
        const tagFuse = new Fuse(tagList, tagFuseOptions);
        const matchingTags = tagFuse.search(query);
        const matchingTagIds = matchingTags.map(result => result.item.id);

        return items.filter(item => (tagMap[item.avatar] || []).some(tagId => matchingTagIds.includes(tagId)));
    }

    const fieldKeys = {
        name: ['name', 'data.name'],
        creator: ['data.creator', 'creator'],
        creator_notes: ['data.creator_notes', 'creatorcomment'],
    };

    const fuseOptions = {
        keys: fieldKeys[searchField] || ['name'],
        threshold: 0.3,
        includeScore: true,
    };
    const fuse = new Fuse(items, fuseOptions);
    const searchResults = fuse.search(query);
    return searchResults.map(result => result.item);
}
/**
 * Filters and searches through characters and groups based on user-defined criteria.
 * Returns an array of objects with type 'character' or 'group'.
 *
 * @return {Array} The filtered list with objects containing type and data
 */
export function searchAndFilter(){
    const groupsFilter = getSetting('groupsFilter'); // 0=no groups, 1=show groups, 2=only groups
    const chatsFilter = Number(getSetting('chatsFilter') || 0); // 0=all, 1=with chats, 2=without chats
    const sourceFilter = getSetting('sourceFilter') || {};
    const searchMode = getSearchMode();
    let results = [];

    // Handle characters (unless only groups)
    if (groupsFilter !== 2) {
        const charactersCopy = getSetting('favOnly')
            ? [...characters].filter(character => character.fav === true || character.data.extensions.fav === true)
            : [...characters];

        const chatsFilteredChars = charactersCopy.filter(character => matchesChatsFilter(characterHasChats(character), chatsFilter));

        const excludedTags = $('#acm_excludedTags > span').map(function() { return $(this).data('tagid'); }).get().filter(id => id);
        const mandatoryTags = $('#acm_mandatoryTags > span').map(function() { return $(this).data('tagid'); }).get().filter(id => id);
        const facultativeTags = $('#acm_facultativeTags > span').map(function() { return $(this).data('tagid'); }).get().filter(id => id);

        let tagfilteredChars = chatsFilteredChars.filter(item => {
            if (!matchesSourceFilter(item, sourceFilter)) return false;

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

            tagfilteredChars = searchMode === 'exact'
                ? filterCharactersExact(tagfilteredChars, searchField, searchValueTrimmed)
                : filterCharactersFuzzy(tagfilteredChars, searchField, searchValueTrimmed);
        }

        // Convert characters to result format
        results = tagfilteredChars.map(char => ({ type: 'character', ...char }));
    }

    // Handle groups (if show or only). Groups have no chub/botbooru source, so an
    // "include this source" filter excludes them entirely.
    if (groupsFilter >= 1 && !hasAnyIncludeSourceFilter(sourceFilter)) {
        let filteredGroups = [...groups].filter(group => matchesChatsFilter(groupHasChats(group), chatsFilter));

        // Apply search to groups if needed
        if (searchValue !== '') {
            const searchValueTrimmed = searchValue.trim();
            const searchField = $('#search_filter_dropdown').val();

            if (searchField === 'name') {
                if (searchMode === 'exact') {
                    filteredGroups = filteredGroups.filter(group => includesIgnoreCaseAndAccents(String(group?.name || ''), searchValueTrimmed));
                } else {
                    const fuseOptions = {
                        keys: ['name'],
                        threshold: 0.3,
                        includeScore: true,
                    };
                    const fuse = new Fuse(filteredGroups, fuseOptions);
                    const searchResults = fuse.search(searchValueTrimmed);
                    filteredGroups = searchResults.map(result => result.item);
                }
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
    if (sort_data === 'random') {
        return shuffleArray(chars);
    }

    return chars.sort((a, b) => {
        let comparison = 0;

        const getName = (item) => item?.type === 'group'
            ? String(item?.group?.name || item?.name || '')
            : String(item?.name || '');

        const getTagsCount = (item) => {
            if (item?.type === 'group') {
                const groupId = String(item?.group?.id ?? '');
                return tagMap[groupId]?.length || 0;
            }

            return tagMap[item?.avatar]?.length || 0;
        };

        const getNumericField = (item, field) => {
            if (item?.type === 'group') {
                const value = item?.group?.[field];
                return Number(value) || 0;
            }

            return Number(item?.[field]) || 0;
        };

        switch (sort_data) {
            case 'name':
                comparison = getName(a).localeCompare(getName(b));
                break;
            case 'tags':
                comparison = getTagsCount(a) - getTagsCount(b);
                break;
            case 'date_last_chat':
                comparison = getNumericField(b, sort_data) - getNumericField(a, sort_data);
                break;
            case 'date_added':
                comparison = getNumericField(b, sort_data) - getNumericField(a, sort_data);
                break;
            case 'data_size':
                comparison = getNumericField(a, sort_data) - getNumericField(b, sort_data);
                break;
        }
        return sort_order === 'desc' ? comparison * -1 : comparison;
    });
}

/**
 * Shuffles an array in place using the Fisher-Yates algorithm.
 *
 * @param {Array} array - The array to shuffle.
 * @return {Array} The same array, shuffled.
 */
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}
