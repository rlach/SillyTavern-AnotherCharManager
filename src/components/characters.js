import {
    depth_prompt_depth_default,
    depth_prompt_role_default,
    setCharacterId,
    talkativeness_default
} from '/script.js';
import { displayTag } from './tags.js';
import { getBase64Async, getIdByAvatar } from '../utils.js';
import {
    callGenericPopup,
    characters,
    getThumbnailUrl,
    getTokenCountAsync,
    POPUP_TYPE,
    power_user,
    selectCharacterById,
    substituteParams,
    tagMap,
    unshallowCharacter,
} from "../constants/context.js";
import { selectedChar, setMem_avatar } from "../constants/settings.js";
import {
    dupeChar,
    editCharDebounced,
    exportChar,
    renameChar,
    replaceAvatar,
    saveAltGreetings
} from "../services/characters-service.js";
import { addAltGreetingsTrigger } from "../events/characters-events.js";
import { closeDetails } from "./modal.js";

/**
 * Fills the character details in the user interface based on the provided avatar.
 *
 * @param {string} avatar - The avatar identifier of the character for which details are to be filled.
 * @return {Promise<void>} A promise that resolves when all character details have been successfully populated and updates are complete.
 */
export async function fillDetails(avatar) {
    if (typeof characters[getIdByAvatar(avatar)].data.alternate_greetings === 'undefined') {
        await unshallowCharacter(getIdByAvatar(avatar));
    }
    const char = characters[getIdByAvatar(avatar)];
    const avatarThumb = getThumbnailUrl('avatar', char.avatar);

    $('#avatar_title').attr('title', char.avatar);
    $('#avatar_img').attr('src', avatarThumb);
    $('#ch_name_details').text(char.name);
    $('#ch_infos_creator').text(`Creator: ${char.data.creator ? char.data.creator : (char.data.extensions.chub?.full_path?.split('/')[0] ?? " - ")}`);
    $('#ch_infos_version').text(`Version: ${char.data.character_version ?? " - "}`);
    const dateString = char.create_date?.split("@")[0] ?? " - ";
    const [year, month, day] = dateString.split("-");
    const formattedDateString = year === " - " ? " - " : `${year}-${month.padStart(2, "0")}-${day.trim().padStart(2, "0")}`;
    $('#ch_infos_date').text(`Created: ${formattedDateString}`);
    $('#ch_infos_lastchat').text(`Last chat: ${char.date_last_chat ? new Date(char.date_last_chat).toISOString().substring(0, 10) : " - "}`);
    $('#ch_infos_adddate').text(`Added: ${char.date_added ? new Date(char.date_added).toISOString().substring(0, 10) : " - "}`);
    $('#ch_infos_link').html(char.data.extensions.chub?.full_path ? `Link: <a href="https://chub.ai/${char.data.extensions.chub.full_path}" target="_blank">Chub</a>` : "Link: -");
    const text = substituteParams(
        char.name +
        char.description +
        char.first_mes +
        (char.data?.extensions?.depth_prompt?.prompt ?? '') +
        (char.data?.post_history_instructions || '') +
        char.personality +
        char.scenario +
        (char.data?.extensions?.depth_prompt?.prompt ?? '') +
        char.mes_example
    );
    const tokens = await getTokenCountAsync(text);
    $('#ch_infos_tok').text(`Tokens: ${tokens}`);
    const permText = substituteParams(
        char.name +
        char.description +
        char.personality +
        char.scenario +
        (char.data?.extensions?.depth_prompt?.prompt ?? '')
    );
    const permTokens = await getTokenCountAsync(permText);
    $('#ch_infos_permtok').text(`Perm. Tokens: ${permTokens}`);
    $('#acm_description_tokens').text(`Tokens: ${await getTokenCountAsync(substituteParams(char.description))}`);
    $('#acm_description').val(char.description);
    $('#acm_firstMess_tokens').text(`Tokens: ${await getTokenCountAsync(substituteParams(char.first_mes))}`);
    $('#acm_firstMess').val(char.first_mes);
    $('#altGreetings_number').text(`Numbers: ${char.data.alternate_greetings?.length ?? 0}`);
    $('#acm_creatornotes').val(char.data?.creator_notes || char.creatorcomment);
    $('#tag_List').html(`${tagMap[char.avatar].map((tag) => displayTag(tag, 'details')).join('')}`);
    displayAltGreetings(char.data.alternate_greetings).then(html => {
        $('#altGreetings_content').html(html);
    });
    $('#acm_favorite_button').toggleClass('fav_on', char.fav || char.data.extensions.fav).toggleClass('fav_off', !(char.fav || char.data.extensions.fav));
    addAltGreetingsTrigger()
}

/**
 * Populates various advanced character definition fields in the user interface with data associated
 * with the given avatar. The method performs asynchronous operations to fetch token counts for certain
 * data fields and updates the UI accordingly.
 *
 * @param {Object} avatar - The avatar object used to retrieve character information for populating the fields.
 * @return {Promise<void>} A promise that resolves once all advanced definition fields are populated with
 *                         character data and token counts.
 */
export async function fillAdvancedDefinitions(avatar) {
    const char = characters[getIdByAvatar(avatar)];
    $('#acm_character_popup-button-h3').text(char.name);
    $('#acm_creator_notes_textarea').val(char.data?.creator_notes || char.creatorcomment);
    $('#acm_character_version_textarea').val(char.data?.character_version || '');
    $('#acm_system_prompt').val(char.data?.system_prompt || '');
    $('#acm_system_prompt_tokens').text(`Tokens: ${await getTokenCountAsync(substituteParams(char.data?.system_prompt || ''))}`);
    $('#acm_post_history_prompt').val(char.data?.post_history_instructions || '');
    $('#acm_post_history_prompt_tokens').text(`Tokens: ${await getTokenCountAsync(substituteParams(char.data?.post_history_instructions || ''))}`);
    $('#acm_tags_textarea').val(Array.isArray(char.data?.tags) ? char.data.tags.join(', ') : '');
    $('#acm_creator_textarea').val(char.data?.creator);
    $('#acm_personality').val(char.personality);
    $('#acm_personality_tokens').text(`Tokens: ${await getTokenCountAsync(substituteParams(char.personality))}`);
    $('#acm_scenario').val(char.scenario);
    $('#acm_scenario_tokens').text(`Tokens: ${await getTokenCountAsync(substituteParams(char.scenario))}`);
    $('#acm_character_notes').val(char.data?.extensions?.depth_prompt?.prompt ?? '');
    $('#acm_character_notes_tokens').text(`Tokens: ${await getTokenCountAsync(substituteParams(char.data?.extensions?.depth_prompt?.prompt ?? ''))}`);
    $('#acm_character_notes_depth').val(char.data?.extensions?.depth_prompt?.depth ?? depth_prompt_depth_default);
    $('#acm_character_notes_role').val(char.data?.extensions?.depth_prompt?.role ?? depth_prompt_role_default);
    $('#acm_talkativeness_slider').val(char.talkativeness || talkativeness_default);
    $('#acm_mes_examples').val(char.mes_example);
    $('#acm_messages_examples').text(`Tokens: ${await getTokenCountAsync(substituteParams(char.mes_example))}`);
}

/**
 * Toggles the favorite status of the currently selected character.
 * This function updates the favorite status of the character in the data model
 * and reflects the change in the user interface by toggling the favorite button's class.
 *
 * @return {void} This function does not return a value.
 */
export function toggleFavoriteStatus() {
    // Retrieve the ID of the currently selected character
    const id = getIdByAvatar(selectedChar);
    // Determine the current favorite status of the character
    const isFavorite = characters[id].fav || characters[id].data.extensions.fav;
    // Prepare the updated data object with the toggled favorite status
    const update = {
        avatar: selectedChar,
        fav: !isFavorite,
        data: {
            extensions: {
                fav: !isFavorite
            }
        }
    };
    // Apply the update using a debounced function to avoid excessive updates
    editCharDebounced(update);
    // Get the favorite button element from the DOM
    const favoriteButton = $('#acm_favorite_button')[0];
    // Update the button's class to reflect the new favorite status
    if (isFavorite) {
        favoriteButton.classList.replace('fav_on', 'fav_off');
    } else {
        favoriteButton.classList.replace('fav_off', 'fav_on');
    }
}

/**
 * Exports the currently selected character in the specified format.
 * This function utilizes the `exportChar` service to handle the export process.
 *
 * @param {string} format - The format in which the character should be exported (e.g., JSON, XML).
 * @return {void} This function does not return a value.
 */
export function exportCharacter(format) {
    exportChar(format, selectedChar);
}

/**
 * Duplicates the currently selected character.
 * This function checks if a character is selected, prompts the user for confirmation,
 * and duplicates the character if the user confirms the action.
 *
 * @async
 * @return {Promise<void>} A promise that resolves once the character duplication process is complete.
 */
export async function duplicateCharacter() {
    if (!selectedChar) {
        // Display a warning if no character is selected
        toastr.warning('You must first select a character to duplicate!');
        return;
    }
    // Show a confirmation dialog to the user
    const confirmed = await showDuplicateConfirmation();
    if (!confirmed) {
        // Log a message if the user cancels the duplication
        console.log('User cancelled duplication');
        return;
    }
    // Duplicate the selected character
    await dupeChar(selectedChar);
}

/**
 * Displays a confirmation popup to the user asking if they want to duplicate a character.
 * The popup includes a message explaining the duplication action and an alternative option
 * to start a new chat with the same character.
 *
 * @async
 * @return {Promise<Popup>} A promise that resolves to the confirmation popup instance.
 */
export async function showDuplicateConfirmation() {
    const confirmMessage = `
        <h3>Are you sure you want to duplicate this character?</h3>
        <span>If you just want to start a new chat with the same character, use "Start new chat" option in the bottom-left options menu.</span><br><br>`;
    return await callGenericPopup(confirmMessage, POPUP_TYPE.CONFIRM);
}

/**
 * Displays a rename dialog for the specified character.
 * This function creates a popup dialog that allows the user to input a new name
 * for the character identified by the provided avatar.
 *
 * @async
 * @param {string} characterAvatar - The avatar identifier of the character to be renamed.
 * @return {Promise<Popup>} A promise that resolves to the popup instance for the rename dialog.
 */
export async function showRenameDialog(characterAvatar) {
    const charID = getIdByAvatar(characterAvatar);
    return await callGenericPopup('<h3>New name:</h3>', POPUP_TYPE.INPUT, characters[charID].name);
}

/**
 * Renames the currently selected character.
 * This function retrieves the character ID based on the selected avatar,
 * displays a rename dialog to the user, and updates the character's name
 * with the new name provided by the user.
 *
 * @async
 * @return {Promise<void>} A promise that resolves once the character's name has been successfully updated.
 */
export async function renameCharacter() {
    const charID = getIdByAvatar(selectedChar);
    const newName = await showRenameDialog(selectedChar);
    await renameChar(selectedChar, charID, newName);
}

/**
 * Opens the character chat interface for the currently selected character.
 * This function resets the character ID and avatar memory, selects the character
 * by its ID, and closes the details view. It also transitions the shadow popup
 * to fade out and hides the popup after a short delay.
 *
 * @return {void} This function does not return a value.
 */
export function openCharacterChat() {
    setCharacterId(undefined);
    setMem_avatar(undefined);
    selectCharacterById(getIdByAvatar(selectedChar));
    closeDetails(false);

    $('#acm_popup').transition({
        opacity: 0,
        duration: 125,
        easing: 'ease-in-out',
    });
    setTimeout(function () {
        $('#acm_popup').css('display', 'none');
        $('#acm_popup').removeClass('large_dialogue_popup wide_dialogue_popup');
    }, 125);
}

/**
 * Toggles the visibility of the advanced definitions popup.
 * This function checks the current display state of the popup and either shows or hides it.
 * When showing the popup, it applies a fade-in transition effect; when hiding, it removes the 'open' class.
 *
 * @return {void} This function does not return a value.
 */
export function toggleAdvancedDefinitionsPopup() {
    const $popup = $('#acm_character_popup');
    if ($popup.css('display') === 'none') {
        $popup.css({ 'display': 'flex', 'opacity': 0.0 })
            .addClass('open')
            .transition({
                opacity: 1.0,
                duration: 125,
                easing: 'ease-in-out',
            });
    } else {
        $popup.css('display', 'none').removeClass('open');
    }
}

/**
 * Closes the character popup in the user interface.
 * This function applies a fade-out transition effect to the popup and hides it
 * after the transition is complete.
 *
 * @return {void} This function does not return a value.
 */
export function closeCharacterPopup() {
    $('#character_popup').transition({
        opacity: 0,
        duration: 125,
        easing: 'ease-in-out',
    });
    setTimeout(function () {
        $('#acm_character_popup').css('display', 'none');
    }, 125);
}


/**
 * Updates the avatar of the currently selected character.
 * This function allows the user to upload a new avatar image, optionally crop it,
 * and then update the avatar in the application. The updated avatar is displayed
 * in the user interface and saved in the data model.
 *
 * @async
 * @param {HTMLInputElement} input - The file input element containing the uploaded image file.
 * @return {Promise<void>} A promise that resolves when the avatar update process is complete.
 */
export async function update_avatar(input){
    if (input.files && input.files[0]) {
        let crop_data = undefined;
        const file = input.files[0];
        const fileData = await getBase64Async(file);

        if (!power_user.never_resize_avatars) {
            // Display a cropping dialog to the user
            const dlg = callGenericPopup('Set the crop position of the avatar image', POPUP_TYPE.CROP, '', { cropImage: fileData });
            const croppedImage = await dlg.show();

            if (!croppedImage) {
                return; // Exit if the user cancels the cropping dialog
            }
            crop_data = dlg.cropData;

            try {
                // Replace the avatar with the cropped image
                await replaceAvatar(file, getIdByAvatar(selectedChar), crop_data);
                // Update the avatar image in the UI with a cache-busting timestamp
                const newImageUrl = getThumbnailUrl('avatar', selectedChar) + '&t=' + new Date().getTime();
                $('#avatar_img').attr('src', newImageUrl);
                $(`[data-avatar="${selectedChar}"]`).attr('src', newImageUrl);
            } catch {
                toast.error("Something went wrong."); // Display an error message if the update fails
            }
        } else {
            try {
                // Replace the avatar without cropping
                await replaceAvatar(file, getIdByAvatar(selectedChar));
                // Update the avatar image in the UI with a cache-busting timestamp
                const newImageUrl = getThumbnailUrl('avatar', selectedChar) + '&t=' + new Date().getTime();
                $('#avatar_img').attr('src', newImageUrl);
                $(`[data-avatar="${selectedChar}"]`).attr('src', newImageUrl);
            } catch {
                toast.error("Something went wrong."); // Display an error message if the update fails
            }
        }
    }
}

/**
 * Adds a new alternate greeting section to the DOM within the 'altGreetings_content' container.
 * Each new section is dynamically created and appended to the container, including appropriate event listeners.
 *
 * @return {void} Does not return anything.
 */
export function addAltGreeting(){
    const drawerContainer = document.getElementById('altGreetings_content');
    // Determine the new greeting index
    const greetingIndex = drawerContainer.getElementsByClassName('inline-drawer').length + 1;
    // Create the new inline-drawer block
    const altGreetingDiv = document.createElement('div');
    altGreetingDiv.className = 'inline-drawer';
    altGreetingDiv.innerHTML = `<div id="altGreetDrawer${greetingIndex}" class="altgreetings-drawer-toggle inline-drawer-header inline-drawer-design">
                    <div style="display: flex;flex-grow: 1;">
                        <strong class="drawer-header-item">
                            Greeting #
                            <span class="greeting_index">${greetingIndex}</span>
                        </strong>
                        <span class="tokens_count drawer-header-item">Tokens: 0</span>
                    </div>
                    <div class="altGreetings_buttons">
                        <i class="inline-drawer-icon fa-solid fa-circle-minus"></i>
                        <i class="inline-drawer-icon idit fa-solid fa-circle-chevron-down down"></i>
                    </div>
                </div>
                <div class="inline-drawer-content">
                    <textarea class="altGreeting_zone autoSetHeight"></textarea>
                </div>
            </div>`;
    // Add the new inline-drawer block
    $('#chicken').empty();
    drawerContainer.appendChild(altGreetingDiv);
    // Add the event on the textarea
    altGreetingDiv.querySelector(`.altGreeting_zone`).addEventListener('input', (event) => {
        saveAltGreetings(event);
    });
    // Save it
    saveAltGreetings();
}

/**
 * Deletes an alternative greeting block, updates the indices of remaining blocks,
 * and ensures a proper UI display for the alternative greetings section.
 *
 * @param {number} index The index of the alternative greeting block to be deleted.
 * @param {Object} inlineDrawer The DOM element representing the alternative greeting block to remove.
 * @return {void} The function does not return a value.
 */
export function delAltGreeting(index, inlineDrawer){
    // Delete the AltGreeting block
    inlineDrawer.remove();
    // Update the others AltGreeting blocks
    const $altGreetingsToggle = $('.altgreetings-drawer-toggle');
    if ($('div[id^="altGreetDrawer"]').length === 0) {
        $('#altGreetings_content').html('<span id="chicken">Nothing here but chickens!!</span>');
    }
    else {
        $altGreetingsToggle.each(function() {
            const currentIndex = parseInt($(this).find('.greeting_index').text());
            if (currentIndex > index) {
                $(this).find('.greeting_index').text(currentIndex - 1);
                $(this).attr('id', `altGreetDrawer${currentIndex - 1}`);
            }
        });
    }
    // Save it
    saveAltGreetings();
}

/**
 * Generates and returns HTML content for alternative greetings based on the provided items.
 *
 * @param {string[]} item - An array of strings where each string represents a greeting.
 * @return {string} The generated HTML as a string. If the `item` array is empty, a placeholder HTML string is returned.
 */
async function displayAltGreetings(item) {
    let altGreetingsHTML = '';
    if (!item || item.length === 0) {
        return '<span id="chicken">Nothing here but chickens!!</span>';
    } else {
        for (let i = 0; i < item.length; i++) {
            let greetingNumber = i + 1;
            altGreetingsHTML += `<div class="inline-drawer">
                <div id="altGreetDrawer${greetingNumber}" class="altgreetings-drawer-toggle inline-drawer-header inline-drawer-design">
                    <div style="display: flex;flex-grow: 1;">
                        <strong class="drawer-header-item">
                            Greeting #
                            <span class="greeting_index">${greetingNumber}</span>
                        </strong>
                        <span class="tokens_count drawer-header-item">Tokens: ${await getTokenCountAsync(substituteParams(item[i]))}</span>
                    </div>
                    <div class="altGreetings_buttons">
                        <i class="inline-drawer-icon fa-solid fa-circle-minus"></i>
                        <i class="inline-drawer-icon idit fa-solid fa-circle-chevron-down down"></i>
                    </div>
                </div>
                <div class="inline-drawer-content">
                    <textarea class="altGreeting_zone autoSetHeight">${item[i]}</textarea>
                </div>
            </div>`;
        }
        return altGreetingsHTML;
    }
}
