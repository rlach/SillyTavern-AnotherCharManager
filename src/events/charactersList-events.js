import {
    refreshCharListDebounced,
    selectAndDisplay,
    selectRandomCharacter,
    toggleFavoritesOnly,
    toggleGroupsFilter,
    toggleTagQueries,
    updateSearchFilter,
    updateSortOrder
} from "../components/charactersList.js";
import { openCharacterChat } from "../components/characters.js";
import { deleteUnlinkedUntaggedCharacters } from "../services/characters-service.js";
import { getSetting } from "../services/settings-service.js";
import { toggleCharacterCreationPopup } from "../components/characterCreation.js";

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
            // Groups are not editable in this UI, just inform the user
            toastr.info('Double-click to open group chat in main UI');
        } else if (target.dataset.avatar) {
            selectAndDisplay(target.dataset.avatar);
        }
    });

    $(document).on('dblclick', '.char_select', async function (e) {
        const target = $(e.target).closest('.char_select')[0];
        if (target.dataset.type === 'group') {
            const groupId = target.dataset.groupId;
            // Close the manager and select the group in main UI
            $('#acm_popup_close').click();
            // Use SillyTavern's group selection function
            if (window.select_group_chats) {
                await window.select_group_chats(groupId, true);
            }
        } else if (target.dataset.avatar) {
            await selectAndDisplay(target.dataset.avatar);
            openCharacterChat();
        }
    });

    $(document).on('dblclick', '.char_selected', function () {
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

    $('#acm_fav_filter_button').on("click", function () {
        toggleFavoritesOnly(!getSetting('favOnly'));
    });

    $('#acm_groups_filter_button').on("click", function () {
        toggleGroupsFilter();
    });

    $('#acm_random_button').on("click", function () {
        selectRandomCharacter();
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

    $(document).on("click", ".tag_acm_remove", function () {
        $(this).closest('[data-tagid]').remove();
        refreshCharListDebounced();
    });
}
