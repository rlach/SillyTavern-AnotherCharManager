import { getBase64Async, updateTokenCount } from "../utils.js";
import { createData, Popup, POPUP_TYPE, power_user } from "../constants/context.js";
import { setCrop_data } from "../constants/settings.js";

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
    $('#acm_create_popup').find('input, textarea').each(function() {
        $(this).val('');
    });
    $('#acm_depth_prompt_depth2').val('4');
    $('#acm_depth_prompt_role2').val('system');
    $('#acm_talkativeness_slider2').val('0.5');
    Object.values(FIELD_CONFIGURATIONS).forEach(selector => {
        updateTokenCount(`${selector}`);
    });
    if ($('#acm_left_panel').hasClass('panel-hidden')){
        updateLayout(false);
    }
}

// export function loadAvatar(input){
//     return new Promise((resolve) => {
//         if (input.files && input.files[0]) {
//             const reader = new FileReader();
//
//             reader.onload = function (e) {
//                 // Stocker le fichier dans une variable pour un usage ultérieur
//                 window.selectedAvatar = input.files[0];
//
//                 // Afficher la miniature dans l'élément avec l'ID acm_create_avatar
//                 $('#acm_create_avatar').attr('src', e.target.result);
//
//                 resolve();
//             };
//
//             // Lire le fichier comme une URL de données
//             reader.readAsDataURL(input.files[0]);
//         } else {
//             resolve();
//         }
//     });
// }


export async function loadAvatar(input){
    if (input.files && input.files[0]) {
        createData.avatar = input.files;

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
