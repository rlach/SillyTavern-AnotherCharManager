import { setCharacterId, setMenuType } from '/script.js';
import { debounce, getIdByAvatar } from '../utils.js';
import { characters, eventSource, getThumbnailUrl, tagList, tagMap } from '../constants/context.js';
import { fillAdvancedDefinitions, fillDetails } from './characters.js';
import { searchAndFilter, sortCharAR } from '../services/charactersList-service.js';
import { getPreset } from '../services/presets-service.js';
import VirtualScroller from '../classes/VirtualScroller.js';
import { acmSettings } from '../../index.js';

let virtualScroller = null;
export const refreshCharListDebounced = debounce((preserveScroll) => {
    refreshCharList(preserveScroll);
}, 200);

/**
 * Creates and returns a character block element based on the provided avatar.
 * The block includes styling and details such as the avatar image, name, and associated tags.
 *
 * @param {string} avatar - The identifier for the character avatar used to create the block.
 * @return {HTMLDivElement} Returns a `div` element representing the character block, containing
 *         character information and a thumbnail of the avatar.
 */
function createCharacterBlock(avatar) {
    const id = getIdByAvatar(avatar);
    const avatarThumb = getThumbnailUrl('avatar', avatar);

    const parsedThis_avatar = acmSettings.selectedChar !== undefined ? acmSettings.selectedChar : undefined;
    const charClass = (parsedThis_avatar !== undefined && parsedThis_avatar === avatar) ? 'char_selected' : 'char_select';
    const isFav = (characters[id].fav || characters[id].data.extensions.fav) ? 'fav' : '';

    const div = document.createElement('div');
    div.className = `card ${charClass} ${isFav}`;
    div.title = `[${characters[id].name} - Tags: ${tagMap[avatar]?.length ?? 0}]`;
    div.setAttribute('data-avatar', avatar);

    div.innerHTML = `
        <!-- Media -->
        <div class="card__media">
            <img id="img_${avatar}"
             src="${avatarThumb}"
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


/**
 * Renders a list of characters as HTML using a virtual scroller mechanism to optimize performance.
 *
 * @param {Array} sortedList - The sorted list of character objects to be displayed.
 * @param {boolean} [preserveScroll=false] - Optional parameter to indicate whether to preserve
 * the current scroll position when updating the list.
 * @return {void} This function does not return a value.
 */
function renderCharactersListHTML(sortedList, preserveScroll = false) {
    const container = document.getElementById('character-list');

    if (!container) {
        console.error('Container not found');
        return;
    }

    // Update old scroller, if any
    if (virtualScroller) {
        virtualScroller.setItems(sortedList, preserveScroll);
    }
    else {
        // Calculate the number of elements per line according to width
        const containerWidth = container.clientWidth;
        const itemWidth = 120; // Approximate width of a card + gap
        const itemsPerRow = Math.floor(containerWidth / itemWidth) || 1;

        // Create the virtual scroller
        virtualScroller = new VirtualScroller({
            container: container,
            items: sortedList,
            renderItem: (item) => { return createCharacterBlock(item.avatar); },
            itemHeight: 180, // Height of a line of cards (adjust according to your CSS)
            itemsPerRow: itemsPerRow,
            buffer: 3, // Preload 3 lines before/after
        });
    }
}

/**
 * Adjusts the virtual scroller's items per row based on the container's current width
 * and refreshes the virtual scroller to reflect the updates.
 *
 * The method calculates how many items can fit in a single row by dividing the
 * container's width by the width of an individual item. If the container width is too
 * small to fit even one item, the minimum value of 1 is used.
 *
 * @return {void} This function does not return a value.
 */
export function handleContainerResize() {
    if (virtualScroller) {
        const container = document.getElementById('character-list');
        const containerWidth = container.clientWidth;
        const itemWidth = 120;

        // Update and refresh
        virtualScroller.itemsPerRow = Math.floor(containerWidth / itemWidth) || 1;
        virtualScroller.refresh();
    }
}

/**
 * Selects a character avatar, updates character details, and adjusts the display accordingly.
 *
 * @param {string} avatar - The identifier of the avatar to be selected.
 * @param {boolean} [scrollTo=false] - Whether to scroll to the selected avatar in the virtual scroller.
 * @return {Promise<void>} A promise that resolves when all character details have been updated.
 */
export async function selectAndDisplay(avatar, scrollTo = false) {
    // Check if a visible character is already selected
    if(typeof acmSettings.selectedChar !== 'undefined' && document.querySelector(`[data-avatar="${acmSettings.selectedChar}"]`) !== null){
        document.querySelector(`[data-avatar="${acmSettings.selectedChar}"]`).classList.replace('char_selected','char_select');
    }
    setMenuType('character_edit');
    acmSettings.setSelectedChar(avatar);
    setCharacterId(getIdByAvatar(avatar));
    $('#acm_export_format_popup').hide();
    window.acmIsUpdatingDetails = true;
    await fillDetails(avatar);
    await fillAdvancedDefinitions(avatar);
    window.acmIsUpdatingDetails = false;
    if(scrollTo) {
        virtualScroller.scrollToAvatar(avatar);
    }

    document.querySelector(`[data-avatar="${avatar}"]`).classList.replace('char_select','char_selected');
    document.getElementById('char-sep').style.display = 'block';
    document.getElementById('char-details').classList.add('open');
}

/**
 * Refreshes the character list by filtering, sorting, and updating the UI based on settings.
 * The method also handles dropdown UI interactions if configured, or it directly renders the character list.
 * An event is emitted after the list is refreshed.
 *
 * @return {void} This method does not return a value but updates the user interface and state variables.
 */
function refreshCharList(preserveScroll = false) {
    const filteredChars = searchAndFilter();

    if(filteredChars.length === 0){
        $('#character-list').html('<span>Hmm, it seems like the character you\'re looking for is hiding out in a secret lair. Try searching for someone else instead.</span>');
    }
    else {
        const sortingField = acmSettings.getSetting('sortingField');
        const sortingOrder = acmSettings.getSetting('sortingOrder');
        const dropdownUI = acmSettings.getSetting('dropdownUI');
        const dropdownMode = acmSettings.getSetting('dropdownMode');
        const sortedList = sortCharAR(filteredChars, sortingField, sortingOrder);

        if (dropdownUI && ['allTags', 'custom', 'creators'].includes(dropdownMode)) {
            $('#character-list').html(generateDropdown(sortedList, dropdownMode));
            const list = document.querySelector('#character-list');
            list.querySelectorAll('.dropdown-container').forEach(container => {
                const title = container.querySelector('.dropdown-title');
                const content = container.querySelector('.dropdown-content');
                title.addEventListener('click', () => {
                    const isOpen = container.classList.toggle('open');
                    if (isOpen) {
                        const data = container.dataset;
                        content.appendChild(generateDropdownContent(sortedList, data.type, data.content));
                    } else {
                        content.innerText = '';
                    }
                });
            });
        } else {
            renderCharactersListHTML(sortedList, preserveScroll);
        }
    }
    $('#charNumber').empty().append(`Total characters : ${characters.length}`);
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
            const preset = acmSettings.getSetting('presetId');
            const categories = getPreset(preset).categories;
            if (categories.length === 0) {
                return 'Looks like our categories went on vacation! 🏖️ Check back when they\'re done sunbathing!';
            }
            return categories.map(category => {
                const members = category.tags;
                const charactersForCat = sortedList
                    .filter(item => members.every(memberId => tagMap[item.avatar]?.includes(String(memberId))))
                    .map(item => item.avatar);
                if (charactersForCat.length === 0) return '';
                return createDropdownContainer(
                    category.name,
                    charactersForCat.length,
                    'custom',
                    category.tags.join(','),
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
                        creator,
                    );
                }).join('');
        },
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
    const dropdownContent = {
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
                const block = createCharacterBlock(character.avatar);
                container.appendChild(block);
            });
            return container;
        },
        custom: () => {
            const tags = content
                .split(',')
                .map(t => t.trim())
                .filter(t => t.length > 0);
            const filteredCharacters = sortedList.filter(item => {
                const charTags = tagMap[item.avatar] || [];
                return tags.every(tag => charTags.includes(tag));
            });
            const container = document.createDocumentFragment();
            filteredCharacters.forEach(character => {
                const block = createCharacterBlock(character.avatar);
                container.appendChild(block);
            });
            return container;
        },
        creator: () => {
            const filteredCharacters = sortedList.filter(item => item.data.creator === content);
            const container = document.createDocumentFragment();
            filteredCharacters.forEach(character => {
                const block = createCharacterBlock(character.avatar);
                container.appendChild(block);
            });
            return container;
        },
    };
    return dropdownContent[type]?.() || '';
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
    acmSettings.updateSetting('sortingField', selectedOption.data('field'));
    acmSettings.updateSetting('sortingOrder', selectedOption.data('order'));
    refreshCharListDebounced();
}

/**
 * Updates the search filter by setting a normalized search value and triggering a refresh of the character list.
 *
 * @param {string} searchText - The text input used to update the search filter. It is converted to lowercase before being processed.
 * @return {void} This method does not return a value.
 */
export function updateSearchFilter(searchText) {
    acmSettings.setSearchValue(String(searchText).toLowerCase());
    refreshCharListDebounced();
}

/**
 * Toggles the display setting for favorites only.
 *
 * @param {boolean} isChecked - Indicates whether the favorites-only filter is enabled.
 * @return {void} This function does not return any value.
 */
export function toggleFavoritesOnly(isChecked) {
    acmSettings.updateSetting('favOnly', isChecked);
    refreshCharListDebounced();
}

