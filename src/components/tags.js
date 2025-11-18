import {tags} from "../../../../../tags.js";
import {tagList} from "../constants/context.js";
import {refreshCharListDebounced} from "./charactersList.js";
import {findTag} from "../services/tags-service.js";
import {equalsIgnoreCaseAndAccents} from "../utils.js";
import {addTagToCategory} from "../services/presets-service.js";

/**
 * Renders a tag as an HTML string based on the provided tag ID and an optional category flag.
 *
 * @param {string} tagId - The identifier of the tag to be displayed.
 * @param {boolean} [isFromCat=false] - Indicates whether the tag is from a category.
 * @return {string} The HTML string representation of the tag. Returns an empty string if the tag ID is not found in the tag list.
 */
export function displayTag( tagId, isFromCat = false ){
    const tagClass = isFromCat ? "fa-solid fa-circle-xmark tag_cat_remove" : "fa-solid fa-circle-xmark tag_remove";
    if (tagList.find(tagList => tagList.id === tagId)) {
        const name = tagList.find(tagList => tagList.id === tagId).name;
        const color = tagList.find(tagList => tagList.id === tagId).color;
        const color2 = tagList.find(tagList => tagList.id === tagId).color2;

        if (isFromCat) {
            return `<span class="tag" style="background-color: ${color}; color: ${color2};" data-tagid="${tagId}">
                        <span class="tag_name">${name}</span>
                        <i class="${tagClass}"></i>
                    </span>`;
        }
        else {
            return `<span id="${tagId}" class="tag" style="background-color: ${color}; color: ${color2};">
                        <span class="tag_name">${name}</span>
                        <i class="${tagClass}"></i>
                    </span>`;
        }
    }
    else { return ''; }
}

export function acmCreateTagInput(inputSelector, listSelector, tagListOptions = {}, isForCat = false) {
    $(inputSelector)
        // @ts-ignore
        .autocomplete({
            source: (i, o) => findTag(i, o, listSelector),
            select: (e, u) => acmSelectTag(e, u, listSelector, { tagListOptions: tagListOptions }, isForCat),
            minLength: 0,
        })
        .focus(onTagInputFocus); // <== show a tag list on click
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

function acmSelectTag(event, ui, listSelector, { tagListOptions = {} } = {}, isForCat) {
    let tagName = ui.item.value;
    let tag = tags.find(t => equalsIgnoreCaseAndAccents(t.name, tagName));

    if (!tag) {
        toastr.error("You can't create tag from this interface. Please use the tag editor instead.");
    }

    // unfocus and clear the input
    $(event.target).val('').trigger('input');

    if(isForCat){
        const selectedPreset = $('#preset_selector option:selected').data('preset');
        const selectedCat = $(listSelector).find('label').closest('[data-catid]').data('catid');
        $(listSelector).find('label').before(displayTag(tag.id, true));
        addTagToCategory(selectedPreset, selectedCat, tag.id);
    }
    else {
        $(listSelector).append(displayTag(tag.id));
        refreshCharListDebounced();
    }

    // need to return false to keep the input clear
    return false;
}
