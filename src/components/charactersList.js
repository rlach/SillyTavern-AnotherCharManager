import { setCharacterId, setMenuType } from '/script.js';
import { debounce, getIdByAvatar } from "../utils.js";
import { characters, eventSource, getThumbnailUrl, tagList, tagMap } from "../constants/context.js";
import { selectedChar, setSearchValue, setSelectedChar } from "../constants/settings.js";
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
 * @return {HTMLDivElement} Returns a `div` element representing the character block, containing
 *         character information and a thumbnail of the avatar.
 */
function createCharacterBlock(avatar) {
    const id = getIdByAvatar(avatar);
    const avatarThumb = getThumbnailUrl('avatar', avatar);

    const parsedThis_avatar = selectedChar !== undefined ? selectedChar : undefined;
    const charClass = (parsedThis_avatar !== undefined && parsedThis_avatar === avatar) ? 'char_selected' : 'char_select';
    const isFav = (characters[id].fav || characters[id].data.extensions.fav) ? 'fav' : '';

    // Créer l'élément avec DOM natif
    const div = document.createElement('div');
    div.className = `character_item ${charClass} ${isFav}`;
    div.title = `[${characters[id].name} - Tags: ${tagMap[avatar].length}]`;
    div.setAttribute('data-avatar', avatar);

    div.innerHTML = `
        <div class="avatar acm_avatarList">
            <img id="img_${avatar}"
                 src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%23e0e0e0' width='100' height='100'/%3E%3C/svg%3E"
                 data-src="${avatarThumb}"
                 alt="${characters[id].avatar}"
                 draggable="false">
        </div>
        <div class="char_name">
            <div class="char_name_block">
                <span>${characters[id].name} : ${tagMap[avatar].length}</span>
            </div>
        </div>
    `;

    return div;
}

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
    const container = $('#character-list')[0]; // Obtenir l'élément DOM natif
    container.innerHTML = ''; // Vider le container

    const BATCH_SIZE = 20;
    let currentIndex = 0;

    function processBatch() {
        const startTime = performance.now();
        const fragment = document.createDocumentFragment();
        let batchCount = 0;

        while (currentIndex < sortedList.length &&
                batchCount < BATCH_SIZE &&
                (performance.now() - startTime) < 12) {

            const item = sortedList[currentIndex];
            const charElement = createCharacterBlock(item.avatar);
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
            requestAnimationFrame(processBatch);
        }
    }
    requestAnimationFrame(processBatch);
}

/**
 * Selects a character based on the provided avatar identifier and updates the UI to display the character's details.
 * Ensures that any previously selected character is deselected before selecting the new one.
 *
 * @param {string} avatar - The identifier for the avatar to be selected and displayed.
 * @return {void} This function does not return a value.
 */
export function selectAndDisplay(avatar) {
    // Check if a visible character is already selected
    if(typeof selectedChar !== 'undefined' && document.querySelector(`[data-avatar="${selectedChar}"]`) !== null){
        document.querySelector(`[data-avatar="${selectedChar}"]`).classList.replace('char_selected','char_select');
    }
    setMenuType('character_edit');
    setSelectedChar(avatar);
    setCharacterId(getIdByAvatar(avatar));
    $('#acm_export_format_popup').hide();

    fillDetails(avatar);
    fillAdvancedDefinitions(avatar);

    document.querySelector(`[data-avatar="${avatar}"]`).classList.replace('char_select','char_selected');
    document.getElementById('char-sep').style.display = 'block';
    document.getElementById('char-details').style.removeProperty('display');
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
            renderCharactersListHTML(sortedList);
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
                return createDropdownContainer(
                    tag.name,
                    charactersForTag.length,
                    'allTags',
                    tag.id
                );
            }).join('');
            const noTagsCharacters = sortedList
                .filter(item => !tagMap[item.avatar] || tagMap[item.avatar].length === 0)
                .map(item => item.avatar);
            const noTagsDropdown = noTagsCharacters.length > 0
                ? createDropdownContainer('No Tags', noTagsCharacters.length, 'tag', 'no-tags')
                : '';
            return tagDropdowns + noTagsDropdown;
        },
        custom: () => {
            const preset = getSetting('presetId');
            const categories = getPreset(preset).categories;
            if (categories.length === 0) {
                return "Looks like our categories went on vacation! 🏖️ Check back when they're done sunbathing!";
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
                    category.tags.join(',')
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
                .filter(item => tagMap[item.avatar]?.includes(content));
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
        }
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
        // const calculatedHeight = tagsList.scrollHeight > 80 ? '80px' : (tagsList.scrollHeight + 5) + 'px';
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
    refreshCharListDebounced();
}

