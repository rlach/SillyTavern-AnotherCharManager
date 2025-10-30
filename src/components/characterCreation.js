import { getBase64Async, updateTokenCount } from "../utils.js";
import {Popup, POPUP_TYPE, power_user, t} from "../constants/context.js";
import {create_data, resetCreateData, setCrop_data, updateCreateData} from "../constants/settings.js";
import {createTagInput} from '../../../../../tags.js';
import {createCharacter} from "../services/characters-service.js";
import {selectAndDisplay} from "./charactersList.js";

const FIELD_CONFIGURATIONS = {
    'name': '#acm_create_name',
    'description': '#acm_create_desc',
    'firstMessage': '#acm_create_first',
    'systemPrompt': '#acm_create_system_prompt',
    'postHistoryInstructions': '#acm_create_post_history_instructions',
    'personality': '#acm_create_personality',
    'scenario': '#acm_create_scenario',
    'depthPrompt': '#acm_create_depth_prompt',
    'messageExample': '#acm_create_mes_example'
};

export function toggleCharacterCreationPopup() {
    const $popup = $('#acm_create_popup');

    if ($popup.css('display') === 'none') {

        // Initialize all form fields with create_data values
        $('#acm_create_name').val(create_data.name);
        $('#acm_create_desc').val(create_data.description);
        $('#acm_create_first').val(create_data.first_message);
        $('#acm_create_system_prompt').val(create_data.system_prompt);
        $('#acm_create_post_history_instructions').val(create_data.post_history_instructions);
        $('#acm_create_personality').val(create_data.personality);
        $('#acm_create_scenario').val(create_data.scenario);
        $('#acm_create_depth_prompt').val(create_data.depth_prompt_prompt);
        $('#acm_create_mes_example').val(create_data.mes_example);

        // Metadata fields
        $('#acm_creator_textarea2').val(create_data.creator);
        $('#acm_character_version_textarea2').val(create_data.character_version);
        $('#acm_creator_notes_textarea2').val(create_data.creator_notes);
        $('#acm_tags_textarea2').val(create_data.tags);

        // Numeric/select fields
        $('#acm_depth_prompt_depth2').val(create_data.depth_prompt_depth);
        $('#acm_depth_prompt_role2').val(create_data.depth_prompt_role);
        $('#acm_talkativeness_slider2').val(create_data.talkativeness);

        // Update token counts for all fields
        Object.values(FIELD_CONFIGURATIONS).forEach(selector => {
            updateTokenCount(`${selector}`);
        });

        // Avatar handling
        $('#acm_create_avatar').attr('src', 'img/ai4.png');

        createTagInput('#acmTagInput', '#acmTagList', { tagOptions: { removable: true } });
        // Affichage du popup
        $popup.css({ 'display': 'flex', 'opacity': 0.0 })
            .addClass('open')
            .transition({
                opacity: 1.0,
                duration: 125,
                easing: 'ease-in-out',
            });
    } else {
        // Masquage du popup
        $popup.css('display', 'none').removeClass('open');
    }
}

/**
 * Toggles the visibility of left and right panels and updates the label text accordingly.
 *
 * @param {boolean} showAdvanced - Indicates whether to display the advanced panel.
 * If true, the advanced panel is shown and the main panel is hidden.
 * If false, the main panel is shown and the advanced panel is hidden.
 * @return {void} This function does not return a value.
 */
export function updateLayout(showAdvanced) {
    if (!showAdvanced) {
        $('#acm_left_panel').removeClass('panel-hidden');
        $('#acm_right_panel').addClass('panel-hidden');
        $('#separator-label').text('Advanced Definitions');
    } else {
        $('#acm_right_panel').removeClass('panel-hidden');
        $('#acm_left_panel').addClass('panel-hidden');
        $('#separator-label').text('Main Definitions');
    }
}

export function closeCreationPopup() {
    $('acm_create_popup').transition({
        opacity: 0,
        duration: 125,
        easing: 'ease-in-out',
    });
    setTimeout(function () { $('#acm_create_popup').css('display', 'none'); }, 125);
    resetCreateData();
    Object.values(FIELD_CONFIGURATIONS).forEach(selector => {
        updateTokenCount(`${selector}`);
    });
    $('#acmTagList').empty();
    if ($('#acm_left_panel').hasClass('panel-hidden')){
        updateLayout(false);
    }
}

export async function loadAvatar(input){
    if (input.files && input.files[0]) {
        updateCreateData('avatar', input.files);

        setCrop_data(undefined);
        const file = input.files[0];
        const fileData = await getBase64Async(file);

        if (!power_user.never_resize_avatars) {
            const dlg = new Popup('Set the crop position of the avatar image', POPUP_TYPE.CROP, '', { cropImage: fileData });
            const croppedImage = await dlg.show();

            if (!croppedImage) {
                return;
            }

            setCrop_data(dlg.cropData);
            $('#acm_create_avatar').attr('src', String(croppedImage));
        } else {
            $('#acm_create_avatar').attr('src', fileData);
        }
    }
}

export async function initiateCharacterCreation(){
    const result = JSON.stringify(create_data, null, 2);
    // console.log(result);

    if (String($('#acm_create_name').val()).length === 0) {
        toastr.error(t`Name is required`);
        return;
    }

    const formData = new FormData();

    // Ajouter les champs simples (string, number)
    formData.append('ch_name', create_data.name || '');
    formData.append('description', create_data.description || '');
    formData.append('creator_notes', create_data.creator_notes || '');
    formData.append('post_history_instructions', create_data.post_history_instructions || '');
    formData.append('character_version', create_data.character_version || '');
    formData.append('system_prompt', create_data.system_prompt || '');
    formData.append('tags', create_data.tags || '');
    formData.append('creator', create_data.creator || '');
    formData.append('personality', create_data.personality || '');
    formData.append('first_mes', create_data.first_message || '');
    formData.append('scenario', create_data.scenario || '');
    formData.append('mes_example', create_data.mes_example || '');
    formData.append('world', create_data.world || '');
    formData.append('talkativeness', create_data.talkativeness);
    formData.append('depth_prompt_prompt', create_data.depth_prompt_prompt || '');
    formData.append('depth_prompt_depth', create_data.depth_prompt_depth);
    formData.append('depth_prompt_role', create_data.depth_prompt_role);
    formData.append('fav', false);
    formData.append('json_data', '');
    formData.append('chat', '');
    formData.append('create_date', '');
    formData.append('last_mes', '');
    formData.append('avatar_url', '');

    if (create_data.avatar) {
        if (create_data.avatar instanceof FileList) {
            formData.append('avatar', create_data.avatar[0]);
        } else if (create_data.avatar instanceof File) {
            formData.append('avatar', create_data.avatar);
        }
    }

    for (const value of create_data.alternate_greetings) {
        formData.append('alternate_greetings', value);
    }
    formData.append('extra_books', JSON.stringify(create_data.extra_books));
    formData.append('extensions', JSON.stringify(create_data.extensions));

    await createCharacter(formData);

    closeCreationPopup();
}
