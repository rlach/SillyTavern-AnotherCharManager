import { callGenericPopup, POPUP_TYPE } from "../constants/context.js";
import {
    addCategory,
    displayPresetName,
    printCategoriesList,
    removeCategory,
    renameCategory,
    renamePreset,
    toggleTagButton
} from "../components/presets.js";
import { getCategory, getPreset, removeTagFromCategory } from "../services/presets-service.js";

/**
 * Initializes event listeners for managing preset configurations, including
 * selecting presets, renaming presets, adding categories, renaming categories,
 * deleting categories, and managing tags within categories.
 *
 * This method binds various event handlers to DOM elements for executing
 * operations related to presets and their associated categories or tags.
 *
 * @return {void} This function does not return a value.
 */
export function initializePresetsEvents() {
    $(document).on('change', '#preset_selector', function () {
        const newPreset = $(this).find(':selected').data('preset');
        displayPresetName(newPreset);
        printCategoriesList(newPreset);
    });

    // Trigger on a click on the rename preset button
    $(document).on("click", ".preset_rename", async function () {
        const selectedPreset = $('#preset_selector option:selected').data('preset');
        const newPresetName = await callGenericPopup('<h3>New preset name:</h3>', POPUP_TYPE.INPUT, getPreset(selectedPreset).name);
        if (newPresetName && newPresetName.trim() !== '') {
            renamePreset(selectedPreset, newPresetName);
        }
    });

    // Add new custom category to active preset
    $(document).on("click", ".cat_view_create", async function () {
        const newCatName = await callGenericPopup('<h3>Category name:</h3>', POPUP_TYPE.INPUT, '');
        if (newCatName && newCatName.trim() !== '') {
            const selectedPreset = $('#preset_selector option:selected').data('preset');
            addCategory(selectedPreset, newCatName);
        }
    });

    // Trigger on a click on the delete category button
    $(document).on("click", ".cat_delete", function () {
        const selectedPreset = $('#preset_selector option:selected').data('preset');
        const selectedCat = $(this).closest('[data-catid]').data('catid');
        removeCategory(selectedPreset, selectedCat);
    });

    // Trigger on a click on the rename category button
    $(document).on("click", ".cat_rename", async function () {
        const selectedPreset = $('#preset_selector option:selected').data('preset');
        const selectedCat = $(this).closest('[data-catid]').data('catid');
        const newCatName = await callGenericPopup('<h3>New category name:</h3>', POPUP_TYPE.INPUT, getCategory(selectedPreset, selectedCat).name);
        if (newCatName && newCatName.trim() !== '') {
            renameCategory(selectedPreset, selectedCat, newCatName);
        }
    });

    // Trigger on a click on the add tag button in a category
    $(document).on("click", ".addCatTag", function () {
        const selectedCat = $(this).closest('[data-catid]').data('catid');
        const tagType = $(this).data('tagtype') || 'mandatory';
        toggleTagButton($(this), selectedCat, tagType);
    });

    // Trigger on a click on the minus tag button in a category
    $(document).on("click", ".cancelCatTag", function () {
        const selectedCat = $(this).closest('[data-catid]').data('catid');
        const tagType = $(this).data('tagtype') || 'mandatory';
        toggleTagButton($(this), selectedCat, tagType);
    });

    $(document).on("click", ".tag_cat_remove", function () {
        const selectedPreset = $('#preset_selector option:selected').data('preset');
        const selectedCat = $(this).closest('[data-catid]').data('catid');
        const selectedTag = $(this).closest('[data-tagid]').data('tagid');
        const tagType = $(this).closest('.acm_catTagList').data('tagtype') || 'mandatory';
        removeTagFromCategory(selectedPreset, selectedCat, selectedTag, tagType);
        $(this).closest('[data-tagid]').remove();
    });
}
