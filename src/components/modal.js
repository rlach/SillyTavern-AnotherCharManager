import {
    extensionName,
    mem_avatar,
    mem_characterId,
    mem_menu,
    oldExtensionName,
    selectedChar,
    setMem_avatar,
    setMem_characterId,
    setMem_menu,
    setSelectedChar,
} from "../constants/settings.js";
import { characterId, characters, menuType, renderExtensionTemplateAsync } from "../constants/context.js";
import { getSetting } from "../services/settings-service.js";
import { getIdByAvatar } from "../utils.js";
import { setCharacterId, setMenuType } from '/script.js';
import { updateDropdownPresetNames, updateFavFilterButtonState, updateGroupsFilterButtonState } from "./charactersList.js";
import { updateLayout } from "./characterCreation.js";

/**
 * Initializes the modal component
 */
export async function initializeModal() {
    // Load the modal HTML template
    let modalHtml;
    try {
        modalHtml = await renderExtensionTemplateAsync(`third-party/${extensionName}`, 'modal');
    } catch (error) {
        console.error(`Error fetching modal.html. This is a normal error if you have the old folder name and you don't have to do anything.`);
        try {
            modalHtml = await renderExtensionTemplateAsync(`third-party/${oldExtensionName}`, 'modal');
        } catch (secondError) {
            console.error(`Error fetching modal.html:`, secondError);
            return;
        }
    }
    // Load the extensionMenu button
    const buttonHtml = await renderExtensionTemplateAsync('third-party/SillyTavern-AnotherCharManager', 'button');

    // Add the extensionMenu button to the extensionsMenu
    $('#extensionsMenu').append(buttonHtml);

    // Add the modal HTML to the page
    $('#background_template').after(modalHtml);

    const initialWidth = getSetting('popupWidth');
    $('#acm_popup').css('width', initialWidth + '%');
    $('#acm_widthSlider').val(initialWidth);


    // Put the button before rm_button_group_chats in the form_character_search_form
    // on hover, should say: "Open Char Manager"
    $('#rm_button_group_chats').before('<button id="acm-manager" class="menu_button fa-solid fa-users faSmallFontSquareFix" title="Open Char Manager"></button>');

    // Initialize popper.js for dropdowns
    initializePoppers();
    updateDropdownPresetNames();
    updateLayout(false);
    applySidePanelMode(getSetting('sidePanel'));
}

/**
 * Initializes popper.js for dropdown positioning
 * @private
 */
function initializePoppers() {
    // Create poppers for various dropdowns
    const Export = Popper.createPopper(
        document.getElementById('acm_export_button'),
        document.getElementById('acm_export_format_popup'),
        { placement: 'left' }
    );

    const UI = Popper.createPopper(
        document.getElementById('acm_switch_ui'),
        document.getElementById('dropdown-ui-menu'),
        { placement: 'top' }
    );

    const UISub = Popper.createPopper(
        document.getElementById('acm_dropdown_sub'),
        document.getElementById('dropdown-submenu'),
        { placement: 'right' }
    );

    const UIPreset = Popper.createPopper(
        document.getElementById('acm_dropdown_cat'),
        document.getElementById('preset-submenu'),
        { placement: 'right' }
    );

    // Store poppers for later use
    window.acmPoppers = {
        Export,
        UI,
        UISub,
        UIPreset
    };
}

/**
 * Opens a modal window and initializes its contents and settings.
 * This method adjusts global variables, updates UI components, and applies specific display and transition effects.
 *
 * @return {void} This function does not return any value.
 */
export function openModal() {

    // Memorize the current character state
    if (characterId !== undefined && characterId >= 0) {
        setMem_characterId(characterId);
        setMem_avatar(characters[characterId].avatar);
    } else {
        setMem_characterId(undefined);
        setMem_avatar(undefined);
    }
    setMem_menu(menuType);

    // Display the modal with our list layout
    $('#acm_popup').toggleClass('wide_dialogue_popup large_dialogue_popup');
    $('#acm_shadow_popup').css('display', 'block').transition({
        opacity: 1,
        duration: 125,
        easing: 'ease-in-out',
    });

    const charSortOrderSelect = document.getElementById('char_sort_order');
    Array.from(charSortOrderSelect.options).forEach(option => {
        const field = option.getAttribute('data-field');
        const order = option.getAttribute('data-order');

        option.selected = field === getSetting('sortingField') && order === getSetting('sortingOrder');
    });
    updateFavFilterButtonState(getSetting('favOnly'));
    updateGroupsFilterButtonState(getSetting('groupsFilter'));
    applySidePanelMode(getSetting('sidePanel'));
}

/**
 * Closes the character details section and optionally resets the character selection.
 *
 * @param {boolean} [reset=true] - Indicates whether to reset the character selection. Defaults to true.
 * @return {void} Does not return a value.
 */
export function closeDetails( reset = true ) {
    // Clean up the character details UI
    $('#acm_export_format_popup').hide();
    document.querySelector(`[data-avatar="${selectedChar}"]`)?.classList.replace('char_selected','char_select');
    document.getElementById('char-details').classList.remove("open");
    document.getElementById('char-sep').style.display = 'none';
    document.querySelector('.list-character-wrapper')?.classList.add('acm-no-selection');
    setSelectedChar(undefined);
}

/**
 * Applies side panel mode layout and empty-state visibility.
 * @param {boolean} enabled Whether side panel mode is enabled
 */
export function applySidePanelMode(enabled) {
    const wrapper = document.querySelector('.list-character-wrapper');
    const checkbox = document.getElementById('acm_side_panel_checkbox');

    if (!wrapper) {
        return;
    }

    wrapper.classList.toggle('acm-side-panel-mode', !!enabled);

    if (checkbox instanceof HTMLInputElement) {
        checkbox.checked = !!enabled;
    }

    const hasSelection = Boolean(selectedChar);
    wrapper.classList.toggle('acm-no-selection', !hasSelection);
}

/**
 * Closes the modal by resetting certain state variables, hiding the popup, and resetting its styles and classes.
 *
 * @return {void} This function does not return a value.
 */
export function closeModal() {
    closeDetails(false);
    // Restore the previously active character
    if (mem_characterId !== undefined && mem_characterId >= 0) {
        setCharacterId(mem_characterId);
    }
    setMenuType(mem_menu);
    setMem_avatar(undefined);
    setMem_characterId(undefined);

    $('#acm_shadow_popup').transition({
        opacity: 0,
        duration: 125,
        easing: 'ease-in-out',
    });
    setTimeout(function () {
        $('#acm_shadow_popup').css('display', 'none');
        $('#acm_popup').removeClass('large_dialogue_popup wide_dialogue_popup');
    }, 125);
}

/**
 * Toggles the visibility of dropdown menus based on the provided options. Can either close all menus, toggle a specific menu, or update popper positioning for open menus.
 *
 * @param {Object} [options={}] - The configuration options for toggling dropdown menus.
 * @param {boolean} [options.closeAll=false] - If true, closes all dropdown menus regardless of current state.
 * @param {string|null} [options.menuToToggle=null] - The key of the specific menu to toggle. Keys must match the predefined menu identifiers (e.g., "main", "sub", "preset", "export").
 * @param {boolean} [options.updatePoppers=true] - If true, updates the positioning of popper instances associated with the menus.
 *
 * @return {void} This function does not return a value.
 */
export function toggleDropdownMenus(options = {}) {
    const {
        closeAll = false,
        menuToToggle = null,
        updatePoppers = true
    } = options;

    // Éléments de menu
    const menus = {
        main: {
            element: '#dropdown-ui-menu',
            popper: 'UI'
        },
        sub: {
            element: '#dropdown-submenu',
            popper: 'UISub'
        },
        preset: {
            element: '#preset-submenu',
            popper: 'UIPreset'
        },
        export: {
            element: '#acm_export_format_popup',
            popper: 'Export'
        }
    };

    if (closeAll) {
        // Ferme tous les menus
        Object.values(menus).forEach(menu => {
            $(menu.element).toggle(false);
        });
    } else if (menuToToggle && menus[menuToToggle]) {
        // Toggle un menu spécifique
        $(menus[menuToToggle].element).toggle();
    }

    // Mise à jour des poppers si nécessaire
    if (updatePoppers && window.acmPoppers) {
        Object.values(menus).forEach(menu => {
            if (window.acmPoppers[menu.popper]) {
                window.acmPoppers[menu.popper].update();
            }
        });
    }
}

/**
 * Initializes a function to handle clicks outside of specified dropdown elements.
 * The function ensures that interactions outside a defined list of dropdown-related elements
 * trigger the closure of all dropdown menus.
 *
 * @return {Function} Returns an event handler function that can be used to detect and handle clicks
 * outside of specified dropdown elements by closing all dropdown menus.
 */
export function initializeDropdownClickOutside() {
    const excludedElements = [
        'dropdown-ui-menu',
        'dropdown-submenu',
        'preset-submenu',
        'acm_switch_ui',
        'acm_export_format_popup',
        'acm_export_button'
    ].map(id => document.getElementById(id));

    return function handleClickOutside(event) {
        if (!excludedElements.some(element => element?.contains(event.target))) {
            toggleDropdownMenus({ closeAll: true });
        }
    };
}
