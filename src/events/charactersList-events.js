import {
    queueScrollTopOnNextRefresh,
    refreshCharListDebounced,
    selectAndDisplay,
    selectAndDisplayGroup,
    selectRandomCharacter,
    toggleChatsFilter,
    openSelectedGroupChat,
    updateSearchModeButtonState,
    toggleFavoritesOnly,
    toggleGroupsFilter,
    toggleTagQueries,
    updateSearchFilter,
    updateSortOrder
} from "../components/charactersList.js";
import { openCharacterChat } from "../components/characters.js";
import { deleteUnlinkedUntaggedCharacters } from "../services/characters-service.js";
import { getSetting, updateSetting } from "../services/settings-service.js";
import { toggleCharacterCreationPopup } from "../components/characterCreation.js";
import { selectedChar } from "../constants/settings.js";
import { tagList } from "../constants/context.js";
import { removeTagFromEntity } from "/scripts/tags.js";

/**
 * Initializes events for the characters list.
 * Sets up a click event listener for elements with the class "char_select",
 * allowing the selection and display of a character based on its associated avatar.
 *
 * @return {void} This function does not return a value.
 */
export function initializeCharactersListEvents() {
    // Trigger when a character or group is selected in the list
    $(document).on('click', '.char_select', function (e) {
        const target = $(e.target).closest('.char_select')[0];
        if (target.dataset.type === 'group') {
            selectAndDisplayGroup(target.dataset.groupId, { scrollIntoView: false });
        } else if (target.dataset.avatar) {
            selectAndDisplay(target.dataset.avatar);
        }
    });

    $(document).on('dblclick', '.char_select', async function (e) {
        const target = $(e.target).closest('.char_select')[0];
        if (target.dataset.type === 'group') {
            const groupId = target.dataset.groupId;
            await selectAndDisplayGroup(groupId, { scrollIntoView: true });
            await openSelectedGroupChat(groupId);
        } else if (target.dataset.avatar) {
            await selectAndDisplay(target.dataset.avatar);
            openCharacterChat();
        }
    });

    $(document).on('dblclick', '.char_selected', async function (e) {
        const target = $(e.target).closest('.char_selected')[0];
        if (target?.dataset?.type === 'group') {
            await openSelectedGroupChat(target.dataset.groupId);
            return;
        }

        openCharacterChat();
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
export function initializeToolbarEvents() {
    $(document).on('click', '#acm_tags_filter', toggleTagQueries);

    $(document).on('change', '#char_sort_order', function () {
        updateSortOrder($(this).find(':selected'));
    });

    $(document).on('input', '#char_search_bar', function () {
        updateSearchFilter($(this).val());
    });

    $(document).on('change', '#search_filter_dropdown', function () {
        const searchValue = $('#char_search_bar').val();
        if (searchValue && searchValue.trim() !== '') {
            updateSearchFilter(searchValue);
        }
    });

    $(document).on('click', '#acm_search_mode_button', function () {
        const currentMode = String(getSetting('searchMode') || 'fuzzy').toLowerCase() === 'exact' ? 'exact' : 'fuzzy';
        const mode = currentMode === 'exact' ? 'fuzzy' : 'exact';
        updateSetting('searchMode', mode);
        updateSearchModeButtonState(mode);

        const currentSearchValue = $('#char_search_bar').val();
        if (currentSearchValue && currentSearchValue.trim() !== '') {
            updateSearchFilter(currentSearchValue);
        } else {
            refreshCharListDebounced();
        }
    });

    $('#acm_fav_filter_button').on("click", function () {
        toggleFavoritesOnly(!getSetting('favOnly'));
    });

    $('#acm_groups_filter_button').on("click", function () {
        toggleGroupsFilter();
    });

    $('#acm_chats_filter_button').on("click", function () {
        toggleChatsFilter();
    });

    $('#acm_random_button').on("click", async function () {
        await selectRandomCharacter();
    });

    $('#acm_trash_button').on("click", function () {
        deleteUnlinkedUntaggedCharacters();
    });

    $('#acm_character_import_button').on("click", function () {
        $('#character_import_file').trigger("click");
    });

    $('#acm_external_import_button').on("click", function () {
        $('#external_import_button').trigger("click");
    });

    $('#acm_character_create_button').on("click", toggleCharacterCreationPopup);

    $(document).on("click", "#tag_List .tag_remove, #tag_List .tag_acm_remove", function (event) {
        event.preventDefault();
        event.stopImmediatePropagation();

        const tagElement = $(this).closest('.tag');
        const tagId = String(tagElement.attr('id') || tagElement.data('tagid') || '').trim();

        if (!tagId || !selectedChar) {
            tagElement.remove();
            refreshCharListDebounced();
            return;
        }

        const tag = tagList.find(item => String(item?.id) === tagId);
        if (!tag) {
            tagElement.remove();
            refreshCharListDebounced();
            return;
        }

        removeTagFromEntity(tag, selectedChar, { tagElement });
        refreshCharListDebounced();
    });

    $(document).on('click', '#acm_mandatoryTags .tag_acm_remove, #acm_facultativeTags .tag_acm_remove, #acm_excludedTags .tag_acm_remove', function (event) {
        event.preventDefault();
        event.stopImmediatePropagation();

        $(this).closest('.tag').remove();
        queueScrollTopOnNextRefresh();
        refreshCharListDebounced();
    });
}
