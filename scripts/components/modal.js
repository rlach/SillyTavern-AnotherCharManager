import { getIdByAvatar } from '../utils.js';
import { setCharacterId, setMenuType } from '/script.js';
const { Popper } = SillyTavern.libs;
import { updateDropdownPresetNames } from '../services/presets-service.js';
import { updateLayout } from './characterCreation.js';
import { acm } from '../../index.js';

/**
 * Initializes the modal component
 */
export async function initializeModal() {
    // Load the modal HTML template
    let modalHtml;
    try {
        modalHtml = await acm.st.renderExtensionTemplateAsync(`third-party/${acm.settings.extensionName}/templates`, 'modal');
    } catch (error) {
        console.error('Error fetching modal.html. This is a normal error if you have the old folder name and you don\'t have to do anything.');
        try {
            modalHtml = await acm.st.renderExtensionTemplateAsync(`third-party/${acm.settings.oldExtensionName}/templates`, 'modal');
        } catch (secondError) {
            console.error('Error fetching modal.html:', secondError);
            return;
        }
    }
    // Load the extensionMenu button
    const buttonHtml = await acm.st.renderExtensionTemplateAsync('third-party/SillyTavern-AnotherCharManager/templates', 'button');

    // Add the extensionMenu button to the extensionsMenu
    $('#extensionsMenu').append(buttonHtml);

    // Add the modal HTML to the page
    $('#background_template').after(modalHtml);

    const initialWidth = acm.settings.getSetting('popupWidth');
    $('#acm_popup').css('width', initialWidth + '%');
    $('#acm_widthSlider').val(initialWidth);


    // Put the button before rm_button_group_chats in the form_character_search_form
    // on hover, should say: "Open Char Manager"
    $('#rm_button_group_chats').before('<button id="acm-manager" class="menu_button fa-solid fa-users faSmallFontSquareFix" title="Open Char Manager"></button>');

    // Initialize popper.js for dropdowns
    initializePoppers();
    updateDropdownPresetNames();
    updateLayout(false);
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
        { placement: 'left' },
    );

    const UI = Popper.createPopper(
        document.getElementById('acm_switch_ui'),
        document.getElementById('dropdown-ui-menu'),
        { placement: 'top' },
    );

    const UISub = Popper.createPopper(
        document.getElementById('acm_dropdown_sub'),
        document.getElementById('dropdown-submenu'),
        { placement: 'right' },
    );

    const UIPreset = Popper.createPopper(
        document.getElementById('acm_dropdown_cat'),
        document.getElementById('preset-submenu'),
        { placement: 'right' },
    );

    // Store poppers for later use
    window.acmPoppers = {
        Export,
        UI,
        UISub,
        UIPreset,
    };
}

/**
 * Opens a modal window and initializes its contents and settings.
 * This method adjusts global variables, updates UI components, and applies specific display and transition effects.
 *
 * @return {void} This function does not return any value.
 */
export function openModal() {

    // Memorize some global variables
    if (acm.st.characterId !== undefined && acm.st.characterId >= 0) {
        acm.settings.setMem_avatar(acm.st.characters[acm.st.characterId].avatar);
    } else {
        acm.settings.setMem_avatar(undefined);
    }
    acm.settings.setMem_menu(acm.st.menuType);

    document.querySelector('#acm_lock').classList.add('is-active');

    // Display the modal with our list layout
    // $('#acm_popup').toggleClass('wide_dialogue_popup large_dialogue_popup');
    $('#acm_popup').css('display', 'flex').transition({
        opacity: 1,
        duration: 125,
        easing: 'ease-in-out',
    });

    const charSortOrderSelect = document.getElementById('char_sort_order');
    Array.from(charSortOrderSelect.options).forEach(option => {
        const field = option.getAttribute('data-field');
        const order = option.getAttribute('data-order');

        option.selected = field === acm.settings.getSetting('sortingField') && order === acm.settings.getSetting('sortingOrder');
    });
    document.getElementById('favOnly_checkbox').checked = acm.settings.getSetting('favOnly');
}

/**
 * Closes the character details section and optionally resets the character selection.
 *
 * @param {boolean} [reset=true] - Indicates whether to reset the character selection. Defaults to true.
 * @return {void} Does not return a value.
 */
export function closeDetails( reset = true ) {
    if(reset){ setCharacterId(getIdByAvatar(acm.settings.mem_avatar)); }

    $('#acm_export_format_popup').hide();
    document.querySelector(`[data-avatar="${acm.settings.selectedChar}"]`)?.classList.replace('char_selected','char_select');
    document.getElementById('char-details').classList.remove('open');
    document.getElementById('char-sep').style.display = 'none';
    acm.settings.setSelectedChar(undefined);
}

/**
 * Closes the modal by resetting certain state variables, hiding the popup, and resetting its styles and classes.
 *
 * @return {void} This function does not return a value.
 */
export function closeModal() {
    closeDetails();
    setCharacterId(getIdByAvatar(acm.settings.mem_avatar));
    setMenuType(acm.settings.mem_menu);
    acm.settings.setMem_avatar(undefined);

    document.querySelector('#acm_lock').classList.remove('is-active');

    const $popup = $('#acm_popup');
    $popup.transition({
        opacity: 0,
        duration: 125,
        easing: 'ease-in-out',
    });
    setTimeout(function () {
        $popup.css('display', 'none');
        // $popup.removeClass('large_dialogue_popup wide_dialogue_popup');
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
        updatePoppers = true,
    } = options;

    // Éléments de menu
    const menus = {
        main: {
            element: '#dropdown-ui-menu',
            popper: 'UI',
        },
        sub: {
            element: '#dropdown-submenu',
            popper: 'UISub',
        },
        preset: {
            element: '#preset-submenu',
            popper: 'UIPreset',
        },
        export: {
            element: '#acm_export_format_popup',
            popper: 'Export',
        },
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
        'acm_export_button']
        .map(id => document.getElementById(id));

    return function handleClickOutside(event) {
        if (!excludedElements.some(element => element?.contains(event.target))) {
            toggleDropdownMenus({ closeAll: true });
        }
    };
}
