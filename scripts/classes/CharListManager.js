import { setCharacterId, setMenuType } from '/script.js';
import { debounce, getIdByAvatar } from '../utils.js';
import { VirtualScroller } from './VirtualScroller.js';
import { CharacterManager } from "./CharacterManager.js";

const { Fuse } = SillyTavern.libs;

export class CharListManager {
    constructor(eventManager, settings, st, presetManager) {
        this.eventManager = eventManager;
        this.settings = settings;
        this.st = st;
        this.presetManager = presetManager;
        this.virtualScroller = null;
        this.charManager = new CharacterManager(this.eventManager, this.settings, this.st, this.presetManager.tagManager);
    }

    init() {
        this.initializeCharactersListEvents();
        this.initializeToolbarEvents();
        this.charManager.init();
    }

    refreshCharListDebounced = debounce((preserveScroll) => {
        if (this.modalOpen) this.refreshCharList(preserveScroll);
    }, 200);

    /**
     * Initializes events for the characters list.
     * Sets up a click event listener for elements with the class "char_select",
     * allowing the selection and display of a character based on its associated avatar.
     *
     * @return {void} This function does not return a value.
     */
    initializeCharactersListEvents() {
        // Trigger when a character is selected in the list
        $(document).on('click', '.char_select', (event) => {
            this.selectAndDisplay(event.currentTarget.dataset.avatar);
        });

        this.eventManager.on('charList:refresh', (data) => {
            this.refreshCharListDebounced(data);
        });

        this.eventManager.on('charList:handleResize', () => {
            this.handleContainerResize();
        });

        this.eventManager.on('char:select', (data) => {
            this.selectAndDisplay(data.avatar, data.scrollTo);
        });

        this.eventManager.on('modal:opened', () => {
            this.modalOpen = true;
            this.refreshCharListDebounced();
        });

        this.eventManager.on('modal:closed', () => {
            this.modalOpen = false;
        });

        this.st.eventSource.on(this.st.event_types.CHARACTER_PAGE_LOADED, () => {
            this.eventManager.emit('charList:refresh');
        });

    }

    /**
     * Initializes event listeners for toolbar actions, enabling user interaction with various toolbar components.
     *
     * The method binds the following event handlers:
     * - Click event on the tag filter element to toggle tag-based query filters.
     * - Change event on the character sort order dropdown to update the order based on the selected option.
     * - Input event on the character search bar to filter displayed results based on user input.
     * - Change event on the "Favorites Only" checkbox to toggle the display of favorite items.
     * - Click event on the import button to trigger the file input dialog for character imports.
     * - Click event on the external import button to trigger external import functionality.
     * - Click event on the character creation button to display or hide the character creation popup.
     *
     * @return {void} This function does not return any value.
     */
    initializeToolbarEvents() {
        $(document).on('click', '#acm_tags_filter', this.toggleTagQueries);

        $(document).on('change', '#char_sort_order', (event) => {
            const selectedOption = $(event.currentTarget).find(':selected');
            this.settings.updateSetting('sortingField', selectedOption.data('field'));
            this.settings.updateSetting('sortingOrder', selectedOption.data('order'));
            this.refreshCharListDebounced();
        });

        $(document).on('input', '#char_search_bar', (event) => {
            this.settings.setSearchValue(String($(event.currentTarget).val()).toLowerCase());
            this.refreshCharListDebounced();
        });

        $('#favOnly_checkbox').on('change', (event) => {
            this.settings.updateSetting('favOnly', event.currentTarget.checked);
            this.refreshCharListDebounced();
        });

        $('#acm_character_import_button').on('click', function () {
            $('#character_import_file').trigger('click');
        });

        $('#acm_external_import_button').on('click', function () {
            $('#external_import_button').trigger('click');
        });

        $('#acm_character_create_button').on('click', () => {
            this.eventManager.emit('modal:toggleCreation');
        });

        $(document).on('click', '.tag_acm_remove',  (event) => {
            $(event.currentTarget).closest('[data-tagid]').remove();
            this.refreshCharListDebounced(true);
        });
    }

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
    searchAndFilter(){
        let filteredChars = [];
        const charactersCopy = this.settings.getSetting('favOnly')
            ? [...this.st.characters].filter(character => character.fav === true || character.data.extensions.fav === true)
            : [...this.st.characters];

        const excludedTags = $('#acm_excludedTags > span').map(function() { return $(this).data('tagid'); }).get().filter(id => id);
        const mandatoryTags = $('#acm_mandatoryTags > span').map(function() { return $(this).data('tagid'); }).get().filter(id => id);
        const facultativeTags = $('#acm_facultativeTags > span').map(function() { return $(this).data('tagid'); }).get().filter(id => id);

        // Filtering based on tags
        let tagFilteredChars = charactersCopy.filter(item => {
            const characterTags = this.st.tagMap[item.avatar] || [];

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

        if (this.settings.searchValue !== '') {
            const searchValueTrimmed = this.settings.searchValue.trim();
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
                    const tagFuse = new Fuse(this.st.tagList, tagFuseOptions);
                    const matchingTags = tagFuse.search(searchValueTrimmed);
                    const matchingTagIds = matchingTags.map(result => result.item.id);

                    filteredChars = tagFilteredChars.filter(item => {
                        return (this.st.tagMap[item.avatar] || []).some(tagId => matchingTagIds.includes(tagId));
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
     * @param {string} sort_data - The property of the character objects to sort by (e.g., 'name', 'tags', 'date_last_chat', 'create_date', 'data_size').
     * @param {string} sort_order - The order of sorting, either 'asc' for ascending or 'desc' for descending.
     * @return {Array<Object>} The sorted array of character objects.
     */
    sortCharAR(chars, sort_data, sort_order) {
        return chars.sort((a, b) => {
            let comparison = 0;

            switch (sort_data) {
                case 'name':
                    comparison = a[sort_data].localeCompare(b[sort_data]);
                    break;
                case 'tags':
                    comparison = this.st.tagMap[a.avatar].length - this.st.tagMap[b.avatar].length;
                    break;
                case 'date_last_chat':
                    comparison = b[sort_data] - a[sort_data];
                    break;
                case 'create_date':
                    comparison = b[sort_data] - a[sort_data];
                    break;
                case 'data_size':
                    comparison = a[sort_data] - b[sort_data];
                    break;
            }
            return sort_order === 'desc' ? comparison * -1 : comparison;
        });
    }

    /**
     * Creates and returns a character block element based on the provided avatar.
     * The block includes styling and details such as the avatar image, name, and associated tags.
     *
     * @param {string} avatar - The identifier for the character avatar used to create the block.
     * @return {HTMLDivElement} Returns a `div` element representing the character block, containing
     *         character information and a thumbnail of the avatar.
     */
    createCharacterBlock(avatar) {
        const id = getIdByAvatar(avatar);
        const avatarThumb = this.st.getThumbnailUrl('avatar', avatar);

        const parsedThis_avatar = this.settings.selectedChar !== undefined ? this.settings.selectedChar : undefined;
        const charClass = (parsedThis_avatar !== undefined && parsedThis_avatar === avatar) ? 'char_selected' : 'char_select';
        const isFav = (this.st.characters[id].fav || this.st.characters[id].data.extensions.fav) ? 'fav' : '';

        const div = document.createElement('div');
        div.className = `card ${charClass} ${isFav}`;
        div.title = `[${this.st.characters[id].name} - Tags: ${this.st.tagMap[avatar]?.length ?? 0}]`;
        div.setAttribute('data-avatar', avatar);

        div.innerHTML = `
        <!-- Media -->
        <div class="card__media">
            <img id="img_${avatar}"
             src="${avatarThumb}"
             alt="${this.st.characters[id].avatar}"
             draggable="false">
        </div>
        <!-- Header -->
        <div class="card__header">
            <h3 class="card__header-title">${this.st.characters[id].name}</h3>
            <p class="card__header-meta">Tags: ${this.st.tagMap[avatar]?.length ?? 0}</p>
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
    renderCharactersListHTML(sortedList, preserveScroll = false) {
        const container = document.getElementById('character-list');

        if (!container) {
            console.error('Container not found');
            return;
        }

        // Update old scroller, if any
        if (this.virtualScroller) {
            this.virtualScroller.setItems(sortedList, preserveScroll);
        }
        else {
            // Calculate the number of elements per line according to width
            const containerWidth = container.clientWidth;
            const itemWidth = 120; // Approximate width of a card + gap
            const itemsPerRow = Math.floor(containerWidth / itemWidth) || 1;

            // Create the virtual scroller
            this.virtualScroller = new VirtualScroller({
                container: container,
                items: sortedList,
                renderItem: (item) => { return this.createCharacterBlock(item.avatar); },
                itemHeight: 180, // Height of a line of cards (adjust, according to your CSS)
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
    handleContainerResize() {
        if (this.virtualScroller) {
            const container = document.getElementById('character-list');
            const containerWidth = container.clientWidth;
            const itemWidth = 120;

            // Update and refresh
            this.virtualScroller.itemsPerRow = Math.floor(containerWidth / itemWidth) || 1;
            this.virtualScroller.refresh();
        }
    }

    /**
     * Selects a character avatar, updates character details, and adjusts the display accordingly.
     *
     * @param {string} avatar - The identifier of the avatar to be selected.
     * @param {boolean} [scrollTo=false] - Whether to scroll to the selected avatar in the virtual scroller.
     * @return {Promise<void>} A promise that resolves when all character details have been updated.
     */
    async selectAndDisplay(avatar, scrollTo = false) {
        // Check if a visible character is already selected
        if(typeof this.settings.selectedChar !== 'undefined' && document.querySelector(`[data-avatar="${this.settings.selectedChar}"]`) !== null){
            document.querySelector(`[data-avatar="${this.settings.selectedChar}"]`).classList.replace('char_selected','char_select');
        }
        setMenuType('character_edit');
        this.settings.setSelectedChar(avatar);
        setCharacterId(getIdByAvatar(avatar));
        $('#acm_export_format_popup').hide();
        window.acmIsUpdatingDetails = true;
        await this.charManager.fillDetails(avatar);
        await this.charManager.fillAdvancedDefinitions(avatar);
        window.acmIsUpdatingDetails = false;
        if(scrollTo) {
            this.virtualScroller.scrollToAvatar(avatar);
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
    refreshCharList(preserveScroll = false) {
        const filteredChars = this.searchAndFilter();

        if(filteredChars.length === 0){
            $('#character-list').html('<span>Hmm, it seems like the character you\'re looking for is hiding out in a secret lair. Try searching for someone else instead.</span>');
        }
        else {
            const sortingField = this.settings.getSetting('sortingField');
            const sortingOrder = this.settings.getSetting('sortingOrder');
            const dropdownUI = this.settings.getSetting('dropdownUI');
            const dropdownMode = this.settings.getSetting('dropdownMode');
            const sortedList = this.sortCharAR(filteredChars, sortingField, sortingOrder);

            if (dropdownUI && ['allTags', 'custom', 'creators'].includes(dropdownMode)) {
                $('#character-list').html(this.generateDropdown(sortedList, dropdownMode));
                const list = document.querySelector('#character-list');
                list.querySelectorAll('.dropdown-container').forEach(container => {
                    const title = container.querySelector('.dropdown-title');
                    const content = container.querySelector('.dropdown-content');
                    title.addEventListener('click', () => {
                        const isOpen = container.classList.toggle('open');
                        if (isOpen) {
                            const data = container.dataset;
                            content.appendChild(this.generateDropdownContent(sortedList, data.type, data.content));
                        } else {
                            content.innerText = '';
                        }
                    });
                });
            } else {
                this.renderCharactersListHTML(sortedList, preserveScroll);
            }
        }
        $('#charNumber').empty().append(`Total characters : ${this.st.characters.length}`);
        this.eventManager.emit('character_list_refreshed');
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
    generateDropdown(sortedList, type) {
        const generators = {
            allTags: () => {
                const tagDropdowns = this.st.tagList.map(tag => {
                    const charactersForTag = sortedList
                        .filter(item => this.st.tagMap[item.avatar]?.includes(tag.id))
                        .map(item => item.avatar);
                    if (charactersForTag.length === 0) return '';
                    return this.createDropdownContainer(tag.name, charactersForTag.length, 'allTags', tag.id);
                }).join('');
                const noTagsCharacters = sortedList
                    .filter(item => !this.st.tagMap[item.avatar] || this.st.tagMap[item.avatar].length === 0)
                    .map(item => item.avatar);
                const noTagsDropdown = noTagsCharacters.length > 0
                    ? this.createDropdownContainer('No Tags', noTagsCharacters.length, 'allTags', 'no-tags')
                    : '';
                return tagDropdowns + noTagsDropdown;
            },
            custom: () => {
                const preset = this.settings.getSetting('presetId');
                const categories = this.presetManager.getPreset(preset).categories;
                if (categories.length === 0) {
                    return 'Looks like our categories went on vacation! 🏖️ Check back when they\'re done sunbathing!';
                }
                return categories.map(category => {
                    const members = category.tags;
                    const charactersForCat = sortedList
                        .filter(item => members.every(memberId => this.st.tagMap[item.avatar]?.includes(String(memberId))))
                        .map(item => item.avatar);
                    if (charactersForCat.length === 0) return '';
                    return this.createDropdownContainer(
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
                        return this.createDropdownContainer(
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
    createDropdownContainer(title, count, type, content) {
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
    generateDropdownContent(sortedList, type, content){
        const dropdownContent = {
            allTags: () => {
                const filteredCharacters = sortedList
                    .filter(item => {
                        if (content === 'no-tags') {
                            return !this.st.tagMap[item.avatar] || this.st.tagMap[item.avatar].length === 0;
                        }
                        return this.st.tagMap[item.avatar]?.includes(content);

                    });
                const container = document.createDocumentFragment();
                filteredCharacters.forEach(character => {
                    const block = this.createCharacterBlock(character.avatar);
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
                    const charTags = this.st.tagMap[item.avatar] || [];
                    return tags.every(tag => charTags.includes(tag));
                });
                const container = document.createDocumentFragment();
                filteredCharacters.forEach(character => {
                    const block = this.createCharacterBlock(character.avatar);
                    container.appendChild(block);
                });
                return container;
            },
            creator: () => {
                const filteredCharacters = sortedList.filter(item => item.data.creator === content);
                const container = document.createDocumentFragment();
                filteredCharacters.forEach(character => {
                    const block = this.createCharacterBlock(character.avatar);
                    container.appendChild(block);
                });
                return container;
            },
        };
        return dropdownContent[type]?.() || '';
    }



    /**
     * Toggles the visibility of the tag query list by manipulating CSS classes and styles.
     * Expands or collapses the list with a smooth animation and adjusts its height and overflow properties.
     *
     * @return {void} Does not return any value.
     */
    toggleTagQueries() {
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
}
