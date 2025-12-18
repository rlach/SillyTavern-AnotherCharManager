import { tagList } from "../constants/context.js";
import { refreshCharListDebounced } from "./charactersList.js";
import { acmFindTagMulti, findTag } from "../services/tags-service.js";
import { equalsIgnoreCaseAndAccents } from "../utils.js";
import { addTagToCategory } from "../services/presets-service.js";

/**
 * Renders a tag as an HTML string based on the provided tag ID and an optional display mode.
 *
 * @param {string} tagId - The identifier of the tag to be displayed.
 * @param {string} [mode='classic'] - The display mode: 'category', 'details', or 'classic'.
 * @return {string} The HTML string representation of the tag. Returns an empty string if the tag ID is not found.
 */
export function displayTag(tagId, mode = 'classic') {
    let tagClass = "fa-solid fa-circle-xmark ";
    let identityAttr = `data-tagid="${tagId}"`;

    switch (mode) {
        case 'category':
            tagClass += "tag_cat_remove";
            break;
        case 'details':
            tagClass += "tag_remove";
            identityAttr = `id="${tagId}"`;
            break;
        default:
            tagClass += "tag_acm_remove";
            break;
    }

    const tag = tagList.find(t => t.id === tagId);
    if (tag) {
        return `<span class="tag" style="background-color: ${tag.color}; color: ${tag.color2};" ${identityAttr}>
                    <span class="tag_name">${tag.name}</span>
                    <i class="${tagClass}"></i>
                </span>`;
    }
    else { return ''; }
}

/**
 * Handles the initialization of a tag input field with autocomplete functionality.
 *
 * @param {string|string[]} inputSelector - Selector(s) for the input element.
 * @param {string|string[]} listSelector - Selector(s) for the container where tags are displayed.
 * @param {Object} [tagListOptions={}] - Optional configuration options.
 * @param {string} [mode='classic'] - The behavior mode: 'classic', 'category', or 'multiple'.
 */
export function acmCreateTagInput(inputSelector, listSelector, tagListOptions = {}, mode = 'classic') {
    const inputs = Array.isArray(inputSelector) ? inputSelector : [inputSelector];
    const lists = Array.isArray(listSelector) ? listSelector : [listSelector];

    inputs.forEach((selector, index) => {
        $(selector)
            // @ts-ignore
            .autocomplete({
                source: (i, o) => {
                    if (mode === 'multiple') {
                        return acmFindTagMulti(i, o, lists);
                    }
                    return findTag(i, o, lists[0]);
                },
                select: (e, u) => {
                    // For 'multiple' mode, we pass the specific list that matches this input's index
                    const targetList = mode === 'multiple' ? lists[index] : lists[0];
                    return acmSelectTag(e, u, targetList, { tagListOptions, mode, allLists: lists });
                },
                minLength: 0,
            })
            .on('focus', onTagInputFocus);
    });
}

/**
 * Handles the focus event on a tag input field and triggers the autocomplete functionality.
 *
 * This method is intended to initiate an autocomplete search using the input value when the field gains focus.
 *
 * @return {void} This method does not return a value.
 */
function onTagInputFocus() {
    // @ts-ignore
    $(this).autocomplete('search', $(this).val());
}

/**
 * Handles the selection of a tag and appends it based on the specified mode.
 */
function acmSelectTag(event, ui, listSelector, { tagListOptions = {}, mode = 'classic', allLists = []} = {}) {
    let tagName = ui.item.value;
    let tag = tagList.find(t => equalsIgnoreCaseAndAccents(t.name, tagName));

    if (!tag) {
        toastr.error("You can't create tag from this interface. Please use the tag editor instead.");
        return false;
    }

    // Clear input
    $(event.target).val('').trigger('input');

    switch (mode) {
        case 'category': {
            const selectedPreset = $('#preset_selector option:selected').data('preset');
            const selectedCat = $(listSelector).find('label').closest('[data-catid]').data('catid');
            $(listSelector).find('label').before(displayTag(tag.id, 'category'));
            addTagToCategory(selectedPreset, selectedCat, tag.id);
            break;
        }
        case 'multiple': {
            // Check if tag is already present in ANY of the associated lists
            const isDuplicate = allLists.some(selector => {
                return $(selector).find(`[data-tagid="${tag.id}"]`).length > 0;
            });

            if (!isDuplicate) {
                // Append ONLY to the list associated with the current input
                $(listSelector).append(displayTag(tag.id));
                refreshCharListDebounced();
            } else {
                toastr.warning("This tag is already assigned to one of the requirement lists.");
            }
            break;
        }
        case 'classic':
        default: {
            $(listSelector).append(displayTag(tag.id));
            refreshCharListDebounced();
            break;
        }
    }

    return false;
}
