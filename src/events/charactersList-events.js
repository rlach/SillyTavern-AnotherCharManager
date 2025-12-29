import {
    refreshCharListDebounced,
    selectAndDisplay, toggleFavoritesOnly, toggleTagQueries,
    updateSearchFilter,
    updateSortOrder
} from "../components/charactersList.js";
import { toggleCharacterCreationPopup } from "../components/characterCreation.js";

/**
 * Initializes events for the characters list.
 * Sets up a click event listener for elements with the class "char_select",
 * allowing the selection and display of a character based on its associated avatar.
 *
 * @return {void} This function does not return a value.
 */
export function initializeCharactersListEvents() {
    // Trigger when a character is selected in the list
    $(document).on('click', '.char_select', function () {
        selectAndDisplay(this.dataset.avatar);
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

    $('#favOnly_checkbox').on("change", function () {
        toggleFavoritesOnly(this.checked);
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
