import { getBase64Async, updateTokenCount } from '../utils.js';
import { createCharacter } from '../services/characters-service.js';
import { acm } from '../../index.js';

/**
 * A mapping of field names to their corresponding CSS selectors.
 * This object is used to associate form fields in the character creation popup
 * with their respective DOM elements for easier manipulation and data binding.
 */
const FIELD_CONFIGURATIONS = {
    'name': '#acm_create_name',
    'description': '#acm_create_desc',
    'firstMessage': '#acm_create_first',
    'systemPrompt': '#acm_create_system_prompt',
    'postHistoryInstructions': '#acm_create_post_history_instructions',
    'personality': '#acm_create_personality',
    'scenario': '#acm_create_scenario',
    'depthPrompt': '#acm_create_depth_prompt',
    'messageExample': '#acm_create_mes_example',
};

/**
 * Toggles the visibility of the character creation popup.
 * This function handles the initialization of form fields with existing data,
 * updates token counts, and manages the display state of the popup.
 *
 * @return {void} This function does not return a value.
 */
export function toggleCharacterCreationPopup() {
    const $popup = $('#acm_create_popup');
    if ($popup.css('display') === 'none') {

        acm.eventManager.emit('acm_closeDetails');
        // Initialize all form fields with create_data values
        $('#acm_create_name').val(acm.settings.create_data.name);
        $('#acm_create_desc').val(acm.settings.create_data.description);
        $('#acm_create_first').val(acm.settings.create_data.first_message);
        $('#acm_create_system_prompt').val(acm.settings.create_data.system_prompt);
        $('#acm_create_post_history_instructions').val(acm.settings.create_data.post_history_instructions);
        $('#acm_create_personality').val(acm.settings.create_data.personality);
        $('#acm_create_scenario').val(acm.settings.create_data.scenario);
        $('#acm_create_depth_prompt').val(acm.settings.create_data.depth_prompt_prompt);
        $('#acm_create_mes_example').val(acm.settings.create_data.mes_example);
        // Metadata fields
        $('#acm_creator_textarea2').val(acm.settings.create_data.creator);
        $('#acm_character_version_textarea2').val(acm.settings.create_data.character_version);
        $('#acm_creator_notes_textarea2').val(acm.settings.create_data.creator_notes);
        $('#acm_tags_textarea2').val(acm.settings.create_data.tags);
        // Numeric/select fields
        $('#acm_depth_prompt_depth2').val(acm.settings.create_data.depth_prompt_depth);
        $('#acm_depth_prompt_role2').val(acm.settings.create_data.depth_prompt_role);
        $('#acm_talkativeness_slider2').val(acm.settings.create_data.talkativeness);
        // Tags input field
        $('#acmTagInput').empty();

        // Update token counts for all fields
        Object.values(FIELD_CONFIGURATIONS).forEach(selector => {
            updateTokenCount(`${selector}`);
        });
        // Avatar handling
        $('#acm_create_avatar').attr('src', 'img/ai4.png');
        // Display the popup
        $popup.css({ 'display': 'flex', 'opacity': 0.0 })
            .addClass('open')
            .transition({
                opacity: 1.0,
                duration: 125,
                easing: 'ease-in-out',
            });
    } else {
        // Hide the popup
        $popup.css('display', 'none').removeClass('open');
    }
}

/**
 * Updates the layout of the character creation interface by toggling
 * the visibility of the left and right panels based on the provided parameter.
 *
 * @param {boolean} showAdvanced - A flag indicating whether to show the advanced panel.
 * @return {void} This function does not return a value.
 */
export function updateLayout(showAdvanced) {
    if (!showAdvanced) {
        // Show the main panel and hide the advanced panel
        $('#acm_left_panel').removeClass('panel-hidden');
        $('#acm_right_panel').addClass('panel-hidden');
        $('#separator-label').text('Advanced Definitions');
    } else {
        // Show the advanced panel and hide the main panel
        $('#acm_right_panel').removeClass('panel-hidden');
        $('#acm_left_panel').addClass('panel-hidden');
        $('#separator-label').text('Main Definitions');
    }
}

/**
 * Closes the character creation popup and resets its state.
 * This function handles the transition effect for hiding the popup,
 * resets the character creation data, updates token counts for all fields,
 * clears the tag list, and ensures the layout is updated to show the main panel
 * if the advanced panel is currently visible.
 *
 * @return {void} This function does not return a value.
 */
export function closeCreationPopup() {
    // Apply a transition effect to fade out the popup
    $('acm_create_popup').transition({
        opacity: 0,
        duration: 125,
        easing: 'ease-in-out',
    });
    // Hide the popup after the transition is complete
    setTimeout(function () { $('#acm_create_popup').css('display', 'none'); }, 125);
    // Reset the character creation data to its default state
    acm.settings.resetCreateData();
    // Update token counts for all fields in the form
    Object.values(FIELD_CONFIGURATIONS).forEach(selector => {
        updateTokenCount(`${selector}`);
    });
    // Clear the tag list in the popup
    $('#acmTagList').empty();
    // Ensure the layout is updated to show the main panel if the advanced panel is hidden
    if ($('#acm_left_panel').hasClass('panel-hidden')){
        updateLayout(false);
    }
}

/**
 * Loads and processes an avatar image file.
 * This function handles the selection of an avatar image file, converts it to a Base64 string,
 * and optionally allows the user to crop the image before setting it as the avatar.
 *
 * @async
 * @param {HTMLInputElement} input - The file input element containing the selected avatar file.
 *                                   The `files` property should contain the uploaded file.
 *
 * @return {Promise<void>} This function does not return a value.
 */
export async function loadAvatar(input) {
    if (input.files && input.files[0]) {
        // Update the avatar data in the creation settings
        acm.settings.updateCreateData('avatar', input.files);
        // Reset the crop data
        acm.settings.setCrop_data(undefined);
        const file = input.files[0];
        const fileData = await getBase64Async(file);
        // Check if the user has disabled avatar resizing
        if (!acm.st.never_resize_avatars) {
            // Display a cropping dialog for the avatar image
            const dlg = acm.st.callGenericPopup('Set the crop position of the avatar image', acm.st.POPUP_TYPE.CROP, '', { cropImage: fileData });
            const croppedImage = await dlg.show();
            // If the user cancels the cropping, exit the function
            if (!croppedImage) {
                return;
            }
            // Save the crop data and set the cropped image as the avatar
            acm.settings.setCrop_data(dlg.cropData);
            $('#acm_create_avatar').attr('src', String(croppedImage));
        } else {
            // Directly set the Base64 image as the avatar
            $('#acm_create_avatar').attr('src', fileData);
        }
    }
}


/**
 * Initiates the character creation process by validating the input fields,
 * preparing the form data, and sending it to the server.
 * This function collects all the necessary data from the character creation form,
 * including text fields, numeric fields, and file uploads, and submits it
 * using the `createCharacter` service.
 *
 * @async
 * @return {Promise<void>} This function does not return a value.
 */
export async function initiateCharacterCreation(){
    // Validate that the character name is not empty
    if (String($('#acm_create_name').val()).length === 0) {
        toastr.error(acm.st.t`Name is required`);
        return;
    }
    const formData = new FormData();
    // Add simple fields (string, number) to the form data
    formData.append('ch_name', acm.settings.create_data.name || '');
    formData.append('description', acm.settings.create_data.description || '');
    formData.append('creator_notes', acm.settings.create_data.creator_notes || '');
    formData.append('post_history_instructions', acm.settings.create_data.post_history_instructions || '');
    formData.append('character_version', acm.settings.create_data.character_version || '');
    formData.append('system_prompt', acm.settings.create_data.system_prompt || '');
    formData.append('tags', acm.settings.create_data.tags || '');
    formData.append('creator', acm.settings.create_data.creator || '');
    formData.append('personality', acm.settings.create_data.personality || '');
    formData.append('first_mes', acm.settings.create_data.first_message || '');
    formData.append('scenario', acm.settings.create_data.scenario || '');
    formData.append('mes_example', acm.settings.create_data.mes_example || '');
    formData.append('world', acm.settings.create_data.world || '');
    formData.append('talkativeness', acm.settings.create_data.talkativeness);
    formData.append('depth_prompt_prompt', acm.settings.create_data.depth_prompt_prompt || '');
    formData.append('depth_prompt_depth', acm.settings.create_data.depth_prompt_depth);
    formData.append('depth_prompt_role', acm.settings.create_data.depth_prompt_role);
    formData.append('fav', false);
    formData.append('json_data', '');
    formData.append('chat', '');
    formData.append('create_date', '');
    formData.append('last_mes', '');
    formData.append('avatar_url', '');
    // Add an avatar file if it exists
    if (acm.settings.create_data.avatar) {
        if (acm.settings.create_data.avatar instanceof FileList) {
            formData.append('avatar', acm.settings.create_data.avatar[0]);
        } else if (acm.settings.create_data.avatar instanceof File) {
            formData.append('avatar', acm.settings.create_data.avatar);
        }
    }
    // Add alternate greetings to the form data
    for (const value of acm.settings.create_data.alternate_greetings) {
        formData.append('alternate_greetings', value);
    }
    // Add extra books and extensions as JSON strings
    formData.append('extra_books', JSON.stringify(acm.settings.create_data.extra_books));
    formData.append('extensions', JSON.stringify(acm.settings.create_data.extensions));
    // Submit the form data to create the character
    await createCharacter(formData);
}

