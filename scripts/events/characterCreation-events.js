import {
    closeCreationPopup,
    updateLayout,
    loadAvatar,
    initiateCharacterCreation,
} from '../components/characterCreation.js';
import { updateTokenCount } from '../utils.js';
import { updateCreateData } from '../constants/settings.js';

/**
 * Initializes event listeners for the character creation interface. Binds input events to update relevant character creation data and adds functionality for character creation operations such as creating a character, closing the popup, toggling the layout, and adding an avatar.
 *
 * @return {void} This function does not return a value.
 */
export function initializeCharacterCreationEvents() {

    const elementsToInitialize = {
        '#acm_create_name': async function () { updateCreateData('name', String($('#acm_create_name').val())); await updateTokenCount('#acm_create_name');},
        '#acm_create_desc': async function () { updateCreateData('description', String($('#acm_create_desc').val())); await updateTokenCount('#acm_create_desc');},
        '#acm_creator_notes_textarea2': function () { updateCreateData('creator_notes', String($('#acm_creator_notes_textarea2').val())); },
        '#acm_character_version_textarea2': function () { updateCreateData('character_version', String($('#acm_character_version_textarea2').val())); },
        '#acm_create_system_prompt': async function () { updateCreateData('system_prompt', String($('#acm_create_system_prompt').val())); await updateTokenCount('#acm_create_system_prompt');},
        '#acm_create_post_history_instructions': async function () { updateCreateData('post_history_instructions', String($('#acm_create_post_history_instructions').val())); await updateTokenCount('#acm_create_post_history_instructions');},
        '#acm_creator_textarea2': function () { updateCreateData('creator', String($('#acm_creator_textarea2').val())); },
        '#acm_tags_textarea2': function () { updateCreateData('tags', String($('#acm_tags_textarea2').val())); },
        '#acm_create_personality': async function () { updateCreateData('personality', String($('#acm_create_personality').val())); await updateTokenCount('#acm_create_personality');},
        '#acm_create_scenario': async function () { updateCreateData('scenario', String($('#acm_create_scenario').val())); await updateTokenCount('#acm_create_scenario');},
        '#acm_create_mes_example': async function () { updateCreateData('mes_example', String($('#acm_create_mes_example').val())); await updateTokenCount('#acm_create_mes_example');},
        '#acm_create_first': async function () { updateCreateData('first_message', String($('#acm_create_first').val())); await updateTokenCount('#acm_create_first');},
        '#acm_talkativeness_slider2': function () { updateCreateData('talkativeness', Number($('#acm_talkativeness_slider2').val())); },
        '#acm_create_depth_prompt': async function () { updateCreateData('depth_prompt_prompt', String($('#acm_create_depth_prompt').val())); await updateTokenCount('#acm_create_depth_prompt');},
        '#acm_depth_prompt_depth2': function () { updateCreateData('depth_prompt_depth', Number($('#acm_depth_prompt_depth2').val())); },
        '#acm_depth_prompt_role2': function () { updateCreateData('depth_prompt_role', String($('#acm_depth_prompt_role2').val())); },
    };

    Object.keys(elementsToInitialize).forEach(function (id) {
        $(id).on('input', function () {
            elementsToInitialize[id]();
        });
    });

    // Create the character
    $('#acm_create_popup_create').on('click', function () {
        initiateCharacterCreation();
    });

    // Close character creation popup
    $('#acm_create_popup_close').on('click', function () {
        closeCreationPopup();
    });

    // Switch panel during character creation
    $('#column-separator').on('click', function () {
        if ($('#acm_left_panel').hasClass('panel-hidden')){
            updateLayout(false);
        }
        else {
            updateLayout(true);
        }
    });

    // Add the avatar
    $('#acm_add_avatar_button').on('change', function () {
        // await loadAvatar(this);
        loadAvatar(this);
    });
}

