import { eventSource } from "../constants/context.js";
import {
    addAltGreeting,
    closeCharacterPopup,
    delAltGreeting,
    duplicateCharacter,
    exportCharacter,
    openCharacterChat,
    renameCharacter,
    toggleAdvancedDefinitionsPopup,
    toggleFavoriteStatus,
    update_avatar
} from "../components/characters.js";
import { closeDetails } from "../components/modal.js";
import { checkApiAvailability, editCharDebounced, saveAltGreetings } from "../services/characters-service.js";
import { refreshCharListDebounced } from "../components/charactersList.js";
import { selectedChar } from "../constants/settings.js";
import { updateTokenCount } from "../utils.js";

/**
 * Initializes a set of field updaters for designated DOM elements, enabling dynamic updates
 * whenever the user interacts with specific input fields. Each field is tied to its respective
 * handler to apply changes to associated data structures or perform side effects such as
 * token count updates and debounced edits.
 *
 * @return {void} This function does not return a value, but sets up event listeners for
 * specified DOM elements to automatically trigger update behaviors upon user input.
 */
export function initializeFieldUpdaters() {
    const elementsToInitialize = {
        '#acm_description': async function () {const descZone=$('#acm_description');const update={avatar:selectedChar,description:String(descZone.val()),data:{description:String(descZone.val()),},};editCharDebounced(update);await updateTokenCount('#acm_description');},
        '#acm_firstMess': async function () {const firstMesZone=$('#acm_firstMess');const update={avatar:selectedChar,first_mes:String(firstMesZone.val()),data:{first_mes:String(firstMesZone.val()),},};editCharDebounced(update);await updateTokenCount('#acm_firstMess');},
        '#acm_creatornotes': function () {
            const creatorNotes = $('#acm_creatornotes');
            $('#acm_creator_notes_textarea').val(String(creatorNotes.val()));
            const update = {
                avatar: selectedChar,
                creatorcomment: String(creatorNotes.val()),
                data: {creator_notes: String(creatorNotes.val()),},
            };
            editCharDebounced(update);
        },
        '#acm_creator_notes_textarea': function () {
            const creatorNotes = $('#acm_creator_notes_textarea');
            $('#acm_creatornotes').val(String(creatorNotes.val()));
            const update = {
                avatar: selectedChar,
                creatorcomment: String(creatorNotes.val()),
                data: {creator_notes: String(creatorNotes.val()),},
            };
            editCharDebounced(update);
        },
        '#acm_character_version_textarea': function () { const update = {avatar:selectedChar,data:{character_version:String($('#acm_character_version_textarea').val()),},};editCharDebounced(update);},
        '#acm_system_prompt': async function () {const sysPrompt=$('#acm_system_prompt');const update={avatar:selectedChar,data:{system_prompt:String(sysPrompt.val()),},};editCharDebounced(update);await updateTokenCount('#acm_system_prompt');},
        '#acm_post_history_prompt': async function () {const postHistory=$('#acm_post_history_prompt');const update={avatar:selectedChar,data:{post_history_instructions:String(postHistory.val()),},};editCharDebounced(update);await updateTokenCount('#acm_post_history_prompt');},
        '#acm_creator_textarea': function () {const update={ avatar:selectedChar,data:{creator:String($('#acm_creator_textarea').val()),},};editCharDebounced(update);},
        '#acm_personality': async function () {const personality=$('#acm_personality');const update={avatar:selectedChar,personality:String(personality.val()),data:{personality:String(personality.val()),},};editCharDebounced(update);await updateTokenCount('#acm_personality');},
        '#acm_scenario': async function () {const scenario=$('#acm_scenario');const update={avatar:selectedChar,scenario: String(scenario.val()),data:{scenario:String(scenario.val()),},};editCharDebounced(update);await updateTokenCount('#acm_scenario');},
        '#acm_character_notes': async function () {const depthPrompt=$('#acm_character_notes');const update={avatar:selectedChar,data:{ extensions:{depth_prompt:{prompt:String(depthPrompt.val()),}}},};editCharDebounced(update);await updateTokenCount('#acm_character_notes');},
        '#acm_character_notes_depth': function () {const update={avatar:selectedChar,data:{extensions:{depth_prompt:{depth:$('#acm_character_notes_depth').val(),}}},};editCharDebounced(update);},
        '#acm_character_notes_role': function () {const update={avatar:selectedChar,data:{extensions:{depth_prompt:{role:String($('#acm_character_notes_role').val()),}}},};editCharDebounced(update);},
        '#acm_talkativeness_slider': function () {const talkativeness=$('#acm_talkativeness_slider');const update={avatar:selectedChar,talkativeness:String(talkativeness.val()),data:{extensions:{talkativeness:String(talkativeness.val()),}}};editCharDebounced(update);},
        '#acm_mes_examples': async function () {const example=$('#acm_mes_examples');const update={avatar:selectedChar,mes_example:String(example.val()),data:{mes_example:String(example.val()),},};editCharDebounced(update);await updateTokenCount('#acm_mes_examples');},
        '#acm_tags_textarea': function () {const tagZone=$('#acm_tags_textarea');const update={avatar:selectedChar,tags:tagZone.val().split(', '),data:{tags:tagZone.val().split(', '), },};editCharDebounced(update);}
    };

    Object.keys(elementsToInitialize).forEach(function (id) {
        $(id).on('input', elementsToInitialize[id]);
    });
}

/**
 * Initializes event listeners and functionality related to character operations, such as editing, deleting, duplicating, exporting, and updating UI elements associated with characters.
 * This method sets up all necessary triggers and handlers to ensure the character module operates as expected.
 *
 * @return {void} This function does not return a value.
 */
export function initializeCharactersEvents() {
    // Add listener to refresh the display on characters edit
    eventSource.on('character_edited', function () {
        refreshCharListDebounced(true);
    });
    // Add listener to refresh the display on characters delete
    eventSource.on('characterDeleted', function () {
        let charDetailsState = document.getElementById('char-details');
        if (charDetailsState.style.display !== 'none') {
            closeDetails();
        }
        refreshCharListDebounced(true);
    });
    // Add listener to refresh the display on characters duplication
    eventSource.on('character_duplicated', function () {
        refreshCharListDebounced(true);
    });

    // Adding textarea trigger on input
    initializeFieldUpdaters();

    // Trigger when the favorites button is clicked
    $('#acm_favorite_button').on('click', toggleFavoriteStatus);

    // Export character
    $('#acm_export_button').on("click", function () {
        $('#acm_export_format_popup').toggle();
        window.acmPoppers.Export.update();
    });

    $(document).on('click', '.acm_export_format', function() {
        const format = $(this).data('format');
        if (format) {
            exportCharacter(format);
        }
    });

    // Duplicate character
    $('#acm_dupe_button').on("click", duplicateCharacter);

    // Delete character
    $('#acm_delete_button').on("click", function () {
        $('#delete_button').trigger("click");
    });

    // Edit a character avatar
    $('#edit_avatar_button').on('change', async function () {
        const isAvailable = await checkApiAvailability();
        if (isAvailable) {
            await update_avatar(this);
        } else {
            toastr.warning('Please check if the needed plugin is installed! Link in the README.');
        }
    });

    // Rename character
    $('#acm_rename_button').on("click", renameCharacter);

    // Trigger when the Open Chat button is clicked
    $('#acm_open_chat').on('click', openCharacterChat);

    // Display Advanced Definitions popup
    $('#acm_advanced_div').on("click", toggleAdvancedDefinitionsPopup);

    $('#acm_character_cross').on("click", closeCharacterPopup);

    // Add a new alternative greetings
    $(document).on('click', '.fa-circle-plus', async function (event) {
        event.stopPropagation();
        addAltGreeting();
    });

    // Delete an alternative greetings
    $(document).on('click', '.fa-circle-minus', function (event) {
        event.stopPropagation();
        const inlineDrawer = this.closest('.inline-drawer');
        const greetingIndex = parseInt(this.closest('.altgreetings-drawer-toggle').querySelector('.greeting_index').textContent);
        delAltGreeting(greetingIndex, inlineDrawer);
    });

    const tagListObserver = new MutationObserver(function () {
        if (window.acmIsUpdatingDetails) return;
        refreshCharListDebounced(true);
    });

    const tagListElement = document.getElementById('tag_List');
    if (tagListElement) {
        tagListObserver.observe(tagListElement, { childList: true });
    }
}

/**
 * Attaches an event listener to all elements with the class 'altGreeting_zone'.
 * The event listener triggers the saveAltGreetings function whenever an 'input' event occurs on the element.
 *
 * @return {void} This function does not return anything.
 */
export function addAltGreetingsTrigger(){
    document.querySelectorAll('.altGreeting_zone').forEach(textarea => {
        textarea.addEventListener('input', (event) => {saveAltGreetings(event);});
    });
}
