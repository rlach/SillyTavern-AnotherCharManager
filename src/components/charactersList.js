import { setCharacterId, setMenuType } from '/script.js';
import { debounce, getIdByAvatar } from "../utils.js";
import { characters, eventSource, getThumbnailUrl, tagList, tagMap } from "../constants/context.js";
import { searchValue, selectedChar, setSearchValue, setSelectedChar } from "../constants/settings.js";
import { fillAdvancedDefinitions, fillDetails } from "./characters.js";
import { searchAndFilter, sortCharAR } from "../services/charactersList-service.js";
import { getSetting, updateSetting } from "../services/settings-service.js";
import { getPreset } from "../services/presets-service.js";
import { imageLoader } from '../services/imageLoader.js';

export const refreshCharListDebounced = debounce(() => { refreshCharList(); }, 200);

/**
 * Creates and returns a character block element based on the provided avatar.
 * The block includes styling and details such as the avatar image, name, and associated tags.
 *
 * @param {string} avatar - The identifier for the character avatar used to create the block.
 * @param useLazyLoading - Indicate if using lazy loading for the avatar image.
 * @return {HTMLDivElement} Returns a `div` element representing the character block, containing
 *         character information and a thumbnail of the avatar.
 */
function createCharacterBlock(avatar, useLazyLoading = true) {
    const id = getIdByAvatar(avatar);
    const avatarThumb = getThumbnailUrl('avatar', avatar);

    const parsedThis_avatar = selectedChar !== undefined ? selectedChar : undefined;
    const charClass = (parsedThis_avatar !== undefined && parsedThis_avatar === avatar) ? 'char_selected' : 'char_select';
    const isFav = (characters[id].fav || characters[id].data.extensions.fav) ? 'fav' : '';

    const div = document.createElement('div');
    div.className = `card ${charClass} ${isFav}`;
    div.title = `[${characters[id].name} - Tags: ${tagMap[avatar]?.length ?? 0}]`;
    div.setAttribute('data-avatar', avatar);

    const imgSrc = useLazyLoading
        ? "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%23e0e0e0' width='100' height='100'/%3E%3C/svg%3E"
        : avatarThumb;
    const dataSrcAttr = useLazyLoading ? `data-src="${avatarThumb}"` : '';

    div.innerHTML = `
        <!-- Media -->
        <div class="card__media">
            <img id="img_${avatar}"
             src="${imgSrc}"
             ${dataSrcAttr}
             alt="${characters[id].avatar}"
             draggable="false">
        </div>
        <!-- Header -->
        <div class="card__header">
            <h3 class="card__header-title">${characters[id].name}</h3>
            <p class="card__header-meta">Tags: ${tagMap[avatar]?.length ?? 0}</p>
        </div>
    `;

    return div;
}

const requestIdle = window.requestIdleCallback || (cb => {
    return setTimeout(() => cb({ timeRemaining: () => 5 }), 1);
});

const cancelIdle = window.cancelIdleCallback || (id => {
    clearTimeout(id);
});

let activeBatchHandle = null;

/**
 * Renders a batch-processed list of character elements into the HTML container element.
 * The method ensures the rendering process does not block the UI thread by processing elements
 * in smaller chunks using requestAnimationFrame.
 *
 * @param {Array} sortedList - The array of character data objects to be rendered. Each object should
 *                             contain properties like `avatar` used for creating character blocks.
 * @return {void} - Does not return a value. The method directly manipulates the DOM to render content.
 */
function renderCharactersListHTML(sortedList) {
    if (activeBatchHandle) {
        cancelIdle(activeBatchHandle);
        activeBatchHandle = null;
    }

    const container = $('#character-list')[0];
    container.innerHTML = '';

    const BATCH_SIZE = 20;
    let currentIndex = 0;

    function processBatch(deadline) {
        const fragment = document.createDocumentFragment();
        let batchCount = 0;

        while (currentIndex < sortedList.length &&
                batchCount < BATCH_SIZE &&
                deadline.timeRemaining() > 0) {

            const item = sortedList[currentIndex];
            const useLazyLoading = currentIndex >= 100;
            const charElement = createCharacterBlock(item.avatar, useLazyLoading);
            fragment.appendChild(charElement);

            currentIndex++;
            batchCount++;
        }

        container.appendChild(fragment);

        const newImages = container.querySelectorAll(`img[data-src]:not([data-observed])`);
        newImages.forEach(img => {
            img.dataset.observed = 'true';
            imageLoader.observe(img);
        });

        if (currentIndex < sortedList.length) {
            activeBatchHandle = requestIdle(processBatch);
        } else {
            activeBatchHandle = null;
        }
    }
    activeBatchHandle = requestIdle(processBatch);
}

/**
 * Selects a character based on the provided avatar identifier and updates the UI to display the character's details.
 * Ensures that any previously selected character is deselected before selecting the new one.
 *
 * @param {string} avatar - The identifier for the avatar to be selected and displayed.
 * @return {void} This function does not return a value.
 */
export async function selectAndDisplay(avatar) {
    // Check if a visible character is already selected
    if(typeof selectedChar !== 'undefined' && document.querySelector(`[data-avatar="${selectedChar}"]`) !== null){
        document.querySelector(`[data-avatar="${selectedChar}"]`).classList.replace('char_selected','char_select');
    }
    setMenuType('character_edit');
    setSelectedChar(avatar);
    setCharacterId(getIdByAvatar(avatar));
    $('#acm_export_format_popup').hide();
    window.acmIsUpdatingDetails = true;
    await fillDetails(avatar);
    await fillAdvancedDefinitions(avatar);
    window.acmIsUpdatingDetails = false;

    document.querySelector(`[data-avatar="${avatar}"]`).classList.replace('char_select','char_selected');
    document.getElementById('char-sep').style.display = 'block';
    document.getElementById('char-details').classList.add("open");
}

/**
 * Refreshes the character list by filtering, sorting, and updating the UI based on settings.
 * The method also handles dropdown UI interactions if configured, or it directly renders the character list.
 * An event is emitted after the list is refreshed.
 *
 * @return {void} This method does not return a value but updates the user interface and state variables.
 */
function refreshCharList() {
    const filteredChars = searchAndFilter();

    if(filteredChars.length === 0){
        $('#character-list').html(`<span>Hmm, it seems like the character you're looking for is hiding out in a secret lair. Try searching for someone else instead.</span>`);
    }
    else {
        const sortingField = getSetting('sortingField');
        const sortingOrder = getSetting('sortingOrder');
        const dropdownUI = getSetting('dropdownUI');
        const dropdownMode = getSetting('dropdownMode');
        const sortedList = sortCharAR(filteredChars, sortingField, sortingOrder);

        if (dropdownUI && ['allTags', 'custom', 'creators'].includes(dropdownMode)) {
            $('#character-list').html(generateDropdown(sortedList, dropdownMode));
            const list = document.querySelector('#character-list');
            const openSections = getOpenDropdownSections();
            list.querySelectorAll('.dropdown-container').forEach(container => {
                const title = container.querySelector('.dropdown-title');
                const content = container.querySelector('.dropdown-content');
                const data = container.dataset;
                const storedOpen = openSections[data.type]?.includes(data.content);
                if (storedOpen) {
                    container.classList.add('open');
                    content.appendChild(generateDropdownContent(sortedList, data.type, data.content));
                }
                title.addEventListener('click', () => {
                    const isOpen = container.classList.toggle('open');
                    if (isOpen) {
                        const data = container.dataset;
                        content.appendChild(generateDropdownContent(sortedList, data.type, data.content));
                    } else {
                        content.innerText = '';
                    }
                    updateDropdownOpenState(container.dataset.type, container.dataset.content, isOpen);
                });
            });
        } else {
            renderCharactersListHTML(sortedList);
        }
    }
    updateCharacterCount(filteredChars.length);
    eventSource.emit('character_list_refreshed');
}

/**
 * Generates a dropdown menu based on the provided sorted list and type.
 * Different generation logic is applied depending on the type specified.
 *
 * @param {Array} sortedList - An array of objects representing items to populate in the dropdown.
 * Each item should include an `avatar` property and optionally other relevant properties for categorization.
 * @param {string} type - The type of dropdown to generate. Supported types include:
 * 'allTags' for dropdowns categorized by tags,
 * 'custom' for dropdowns based on preset categories,
 * and 'creators' for dropdowns grouped by creators.
 *
 * @return {string} A string of HTML content for the dropdown menu or an empty string if no content is generated.
 */
function generateDropdown(sortedList, type) {
    const generators = {
        allTags: () => {
            const tagDropdowns = tagList.map(tag => {
                const charactersForTag = sortedList
                    .filter(item => tagMap[item.avatar]?.includes(tag.id))
                    .map(item => item.avatar);
                if (charactersForTag.length === 0) return '';
                return createDropdownContainer(tag.name, charactersForTag.length, 'allTags', tag.id);
            }).join('');
            const noTagsCharacters = sortedList
                .filter(item => !tagMap[item.avatar] || tagMap[item.avatar].length === 0)
                .map(item => item.avatar);
            const noTagsDropdown = noTagsCharacters.length > 0
                ? createDropdownContainer('No Tags', noTagsCharacters.length, 'allTags', 'no-tags')
                : '';
            return tagDropdowns + noTagsDropdown;
        },
        custom: () => {
            const preset = getSetting('presetId');
            const categories = getPreset(preset).categories;
            if (categories.length === 0) {
                return "Looks like our categories went on vacation! 🏖️ Check back when they're done sunbathing!";
            }
            return categories.map((category, index) => {
                const charactersForCat = sortedList
                    .filter(item => matchesCategoryFilters(item, category))
                    .map(item => item.avatar);
                if (charactersForCat.length === 0) return '';
                return createDropdownContainer(
                    category.name,
                    charactersForCat.length,
                    'custom',
                    String(index)
                );
            }).join('');
        },
        creators: () => {
            const groupedByCreator = sortedList.reduce((groups, item) => {
                const creator = item.data.creator || 'No Creator';
                if (!groups[creator]) {
                    groups[creator] = [];
                }
                groups[creator].push(item.avatar);
                return groups;
            }, {});
            return Object.entries(groupedByCreator)
                .sort(([creatorA], [creatorB]) => {
                    if (creatorA === 'No Creator') return 1;
                    if (creatorB === 'No Creator') return -1;
                    return creatorA.localeCompare(creatorB);
                })
                .map(([creator, avatars]) => {
                    if (avatars.length === 0) return '';
                    const creatorName = creator === 'No Creator' ? 'No Creators' : creator;
                    return createDropdownContainer(
                        creatorName,
                        avatars.length,
                        'creator',
                        creator
                    );
                }).join('');
        }
    };
    return generators[type]?.() || '';
}

/**
 * Creates a dropdown container element as a string of HTML.
 *
 * @param {string} title - The title of the dropdown container.
 * @param {number} count - The count to be displayed next to the title.
 * @param {string} type - The type of the dropdown container, used as a data attribute.
 * @param {string} content - The content identifier for the dropdown, used as a data attribute.
 * @return {string} The HTML string representing the dropdown container.
 */
function createDropdownContainer(title, count, type, content) {
    return `<div class="dropdown-container" data-type="${type}" data-content="${content}">
        <div class="dropdown-title inline-drawer-toggle inline-drawer-header inline-drawer-design">
            ${title} (${count})
        </div>
        <div class="dropdown-content character-list">
        </div>
    </div>`;
}

/**
 * Generates and returns the content for a dropdown based on the specified type and content parameters.
 * Filters and processes items from the provided sorted list and builds the dropdown's content dynamically.
 *
 * @param {Array<Object>} sortedList - A list of items to sort and filter. Each item contains character data.
 * @param {string} type - Specifies the type of dropdown content to generate. Possible values include 'allTags', 'custom', or 'creator'.
 * @param {string} content - The filtering criteria, such as a tag string, custom tags, or creator name.
 * @return {DocumentFragment|string} The generated dropdown content in the form of a DocumentFragment or an empty string if the type is invalid or not matched.
 */
function generateDropdownContent(sortedList, type, content){
    const dropdownContent ={
        allTags: () => {
            const filteredCharacters = sortedList
                .filter(item => {
                    if (content === 'no-tags') {
                        return !tagMap[item.avatar] || tagMap[item.avatar].length === 0;
                    }
                    return tagMap[item.avatar]?.includes(content);

                });
            const container = document.createDocumentFragment();
            filteredCharacters.forEach(character => {
                const block = createCharacterBlock(character.avatar, false);
                container.appendChild(block);
            });
            return container;
        },
        custom: () => {
            const preset = getSetting('presetId');
            const categoryIndex = Number(content);
            if (Number.isNaN(categoryIndex)) {
                return document.createDocumentFragment();
            }
            const category = getPreset(preset).categories[categoryIndex];
            if (!category) {
                return document.createDocumentFragment();
            }
            const filteredCharacters = sortedList.filter(item => matchesCategoryFilters(item, category));
            const container = document.createDocumentFragment();
            filteredCharacters.forEach(character => {
                const block = createCharacterBlock(character.avatar, false);
                container.appendChild(block);
            });
            return container;
        },
        creator: () => {
            const filteredCharacters = sortedList.filter(item => item.data.creator === content);
            const container = document.createDocumentFragment();
            filteredCharacters.forEach(character => {
                const block = createCharacterBlock(character.avatar, false);
                container.appendChild(block);
            });
            return container;
        }
    };
    return dropdownContent[type]?.() || '';
}

function normalizeCategoryFilters(category) {
    const mandatory = Array.isArray(category.mandatoryTags)
        ? category.mandatoryTags
        : (Array.isArray(category.tags) ? category.tags : []);
    return {
        mandatory,
        facultative: Array.isArray(category.facultativeTags) ? category.facultativeTags : [],
        excluded: Array.isArray(category.excludedTags) ? category.excludedTags : []
    };
}

function matchesCategoryFilters(item, category) {
    const { mandatory, facultative, excluded } = normalizeCategoryFilters(category);
    const charTags = tagMap[item.avatar] || [];
    const charTagSet = new Set(charTags.map(tag => String(tag)));

    if (excluded.length > 0 && excluded.some(tagId => charTagSet.has(String(tagId)))) {
        return false;
    }

    if (mandatory.length > 0 && !mandatory.every(tagId => charTagSet.has(String(tagId)))) {
        return false;
    }

    if (facultative.length > 0 && !facultative.some(tagId => charTagSet.has(String(tagId)))) {
        return false;
    }

    return true;
}

/**
 * Updates the names of the preset items in a dropdown menu by iterating through each dropdown item,
 * fetching the associated preset using its index, and setting its name as the item's text content.
 *
 * @return {void} This function does not return a value.
 */
export function updateDropdownPresetNames() {
    $('#preset-submenu .dropdown-ui-item').each(function () {
        const presetIndex = $(this).data('preset');
        const newName = getPreset(presetIndex).name;
        if (newName) { $(this).text(newName); }
    });
}

/**
 * Toggles the visibility of the tag query list by manipulating CSS classes and styles.
 * Expands or collapses the list with a smooth animation and adjusts its height and overflow properties.
 *
 * @return {void} Does not return any value.
 */
export function toggleTagQueries() {
    const tagsList = document.getElementById('acm_tagQuery');
    if (tagsList.classList.contains('open')) {
        tagsList.style.overflow = 'hidden';
        tagsList.style.minHeight = '0';
        tagsList.style.height = '0';
    } else {
        const calculatedHeight = (tagsList.scrollHeight + 5) + 'px';
        tagsList.style.minHeight = calculatedHeight;
        tagsList.style.height = calculatedHeight;
        setTimeout(() => {
            if (tagsList.classList.contains('open')) {
                tagsList.style.overflow = 'visible';
            }
        }, 300); // Match the transition duration (0.3s = 300ms)
    }
    tagsList.classList.toggle('open');
}

/**
 * Updates the sort order of a list based on the selected option.
 *
 * @param {Object} selectedOption - The selected option containing sorting information.
 * @param {function} selectedOption.data - A function that retrieves specific data from the selected option.
 * @return {void} This function does not return a value.
 */
export function updateSortOrder(selectedOption) {
    updateSetting('sortingField', selectedOption.data('field'));
    updateSetting('sortingOrder', selectedOption.data('order'));
    refreshCharListDebounced();
}

function normalizeOpenSections(value) {
    if (!value || typeof value !== 'object') {
        return { allTags: [], custom: [], creators: [] };
    }
    return {
        allTags: Array.isArray(value.allTags) ? value.allTags : [],
        custom: Array.isArray(value.custom) ? value.custom : [],
        creators: Array.isArray(value.creators) ? value.creators : []
    };
}

function getOpenDropdownSections() {
    return normalizeOpenSections(getSetting('dropdownOpenSections'));
}

function updateDropdownOpenState(type, content, isOpen) {
    if (!type || !content) return;
    const openSections = normalizeOpenSections(getSetting('dropdownOpenSections'));
    const list = openSections[type] || [];
    const index = list.indexOf(content);

    if (isOpen && index === -1) {
        list.push(content);
    }
    if (!isOpen && index !== -1) {
        list.splice(index, 1);
    }

    openSections[type] = list;
    updateSetting('dropdownOpenSections', openSections);
}

function hasActiveFilters() {
    const hasSearch = String(searchValue || '').trim().length > 0;
    const hasFavOnly = getSetting('favOnly');
    const hasExcluded = $('#acm_excludedTags > span').length > 0;
    const hasMandatory = $('#acm_mandatoryTags > span').length > 0;
    const hasFacultative = $('#acm_facultativeTags > span').length > 0;
    return hasSearch || hasFavOnly || hasExcluded || hasMandatory || hasFacultative;
}

function updateCharacterCount(visibleCount) {
    const totalCount = characters.length;
    const dropdownUI = getSetting('dropdownUI');
    const displayCount = dropdownUI
        ? `${totalCount}/${totalCount}`
        : `${hasActiveFilters() ? visibleCount : totalCount}/${totalCount}`;
    $('#charNumber').empty().append(`Characters: ${displayCount}`);
}

export function updateFavFilterButtonState(isEnabled) {
    const button = document.getElementById('acm_fav_filter_button');
    if (!button) return;
    button.classList.toggle('fav_on', isEnabled);
    button.classList.toggle('fav_off', !isEnabled);
    button.setAttribute('aria-pressed', isEnabled ? 'true' : 'false');
}

/**
 * Updates the search filter by setting a normalized search value and triggering a refresh of the character list.
 *
 * @param {string} searchText - The text input used to update the search filter. It is converted to lowercase before being processed.
 * @return {void} This method does not return a value.
 */
export function updateSearchFilter(searchText) {
    setSearchValue(String(searchText).toLowerCase());
    refreshCharListDebounced();
}

/**
 * Toggles the display setting for favorites only.
 *
 * @param {boolean} isChecked - Indicates whether the favorites-only filter is enabled.
 * @return {void} This function does not return any value.
 */
export function toggleFavoritesOnly(isChecked) {
    updateSetting('favOnly', isChecked);
    updateFavFilterButtonState(isChecked);
    refreshCharListDebounced();
}

export async function selectRandomCharacter() {
    const dropdownUI = getSetting('dropdownUI');
    const dropdownMode = getSetting('dropdownMode');
    const filteredChars = searchAndFilter();

    if (!filteredChars.length) {
        toastr.warning('No characters match the current filters.');
        return;
    }

    let candidateAvatars = [];

    if (dropdownUI && ['allTags', 'custom', 'creators'].includes(dropdownMode)) {
        const openContainers = Array.from(document.querySelectorAll('#character-list .dropdown-container.open'));
        if (openContainers.length > 0) {
            const avatarSet = new Set();
            openContainers.forEach(container => {
                container.querySelectorAll('.card[data-avatar]').forEach(card => {
                    avatarSet.add(card.dataset.avatar);
                });
            });
            candidateAvatars = Array.from(avatarSet);
        } else {
            toastr.warning('Open a dropdown section to pick a random character.');
            return;
        }
    } else {
        candidateAvatars = filteredChars.map(item => item.avatar);
    }

    if (candidateAvatars.length === 0) {
        toastr.warning('No characters are available for random selection.');
        return;
    }

    const randomAvatar = candidateAvatars[Math.floor(Math.random() * candidateAvatars.length)];
    await selectAndDisplay(randomAvatar);

    const card = document.querySelector(`[data-avatar="${randomAvatar}"]`);
    if (card) {
        card.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
    }
}

