import {setCharacterId, setMenuType} from '../../../../../../script.js';
import {debounce, getIdByAvatar} from "../utils.js";
import {characters, eventSource, getThumbnailUrl, tagList, tagMap} from "../constants/context.js";
import {selectedChar, setSearchValue, setSelectedChar} from "../constants/settings.js";
import {fillAdvancedDefinitions, fillDetails} from "./characters.js";
import {searchAndFilter, sortCharAR} from "../services/charactersList-service.js";
import {getSetting, updateSetting} from "../services/settings-service.js";
import {getPreset} from "../services/presets-service.js";

export const refreshCharListDebounced = debounce(() => { refreshCharList(); }, 200);

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
            <img id="img_${avatar}" src="${avatarThumb}" alt="${characters[id].avatar}" draggable="false">
        </div>
        <div class="char_name">
            <div class="char_name_block">
                <span>${characters[id].name} : ${tagMap[avatar].length}</span>
            </div>
        </div>
    `;

    return div;
}

function renderCharactersListHTML(sortedList) {
    const container = $('#character-list')[0]; // Obtenir l'élément DOM natif
    container.innerHTML = ''; // Vider le container

    const BATCH_SIZE = 20;
    let currentIndex = 0;

    function processBatch() {
        const startTime = performance.now();
        const fragment = document.createDocumentFragment();
        let batchCount = 0;

        // Traiter un batch avec limite sur le nombre ET le temps
        while (currentIndex < sortedList.length &&
        batchCount < BATCH_SIZE &&
        (performance.now() - startTime) < 12) {

            const item = sortedList[currentIndex];
            const charElement = createCharacterBlock(item.avatar);
            fragment.appendChild(charElement);

            currentIndex++;
            batchCount++;
        }

        // Ajouter le fragment au DOM (une seule opération)
        container.appendChild(fragment);

        // Continuer s'il reste des personnages
        if (currentIndex < sortedList.length) {
            requestAnimationFrame(processBatch);
        }
    }

    requestAnimationFrame(processBatch);
}


// Function to display the selected character
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


// Function to refresh the character list based on search and sorting parameters
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
                        // actions quand ça s’ouvre
                        const data = container.dataset;
                        content.appendChild(generateDropdownContent(sortedList, data.type, data.content));
                    } else {
                        // actions quand ça se ferme
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

function createDropdownContainer(title, count, type, content) {
    return `<div class="dropdown-container" data-type="${type}" data-content="${content}">
        <div class="dropdown-title inline-drawer-toggle inline-drawer-header inline-drawer-design">
            ${title} (${count})
        </div>
        <div class="dropdown-content character-list">
        </div>
    </div>`;
}

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
        if (newName) {
            $(this).text(newName);
        }
    });
}

export function toggleTagQueries() {
    const tagsList = document.getElementById('acm_tagQuery');

    if (tagsList.classList.contains('open')) {
        // Fermeture de la liste
        tagsList.style.overflow = 'hidden';
        tagsList.style.minHeight = '0';
        tagsList.style.height = '0';
    } else {
        // Ouverture de la liste
        const calculatedHeight = tagsList.scrollHeight > 80 ? '80px' : (tagsList.scrollHeight + 5) + 'px';
        tagsList.style.minHeight = calculatedHeight;
        tagsList.style.height = calculatedHeight;

        // Allow overflow only after animation completes
        setTimeout(() => {
            if (tagsList.classList.contains('open')) {
                tagsList.style.overflow = 'visible';
            }
        }, 300); // Match the transition duration (0.3s = 300ms)
    }

    tagsList.classList.toggle('open');
}

export function updateSortOrder(selectedOption) {
    updateSetting('sortingField', selectedOption.data('field'));
    updateSetting('sortingOrder', selectedOption.data('order'));
    refreshCharListDebounced();
}

export function updateSearchFilter(searchText) {
    setSearchValue(String(searchText).toLowerCase());
    refreshCharListDebounced();
}

export function toggleFavoritesOnly(isChecked) {
    updateSetting('favOnly', isChecked);
    refreshCharListDebounced();
}

