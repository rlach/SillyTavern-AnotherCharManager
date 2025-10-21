import { getBase64Async, updateTokenCount } from "../utils.js";
import { Popup, POPUP_TYPE, power_user } from "../constants/context.js";
import { resetCreateData, setCrop_data, updateCreateData } from "../constants/settings.js";

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
