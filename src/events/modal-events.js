import { resetScrollHeight } from "../utils.js";
import {
    closeDetails,
    closeModal,
    initializeDropdownClickOutside,
    openModal,
    toggleDropdownMenus
} from "../components/modal.js";
import { getSetting, updateSetting } from "../services/settings-service.js";
import { handleContainerResize, refreshCharListDebounced } from "../components/charactersList.js";
import { manageCustomCategories, printCategoriesList } from "../components/presets.js";

/**
 * Initializes external menu events by attaching event listeners to specified menu elements.
 * This method binds a click event to the menu element with the ID 'acm_open',
 * triggering the `openModal` function when the element is clicked.
 *
 * @return {void} This function does not return any value.
 */
export function initializeExtMenuEvents() {
    $('#acm_open').on('click', function () {
        refreshCharListDebounced();
        openModal();
    });
}

/**
 * Initializes modal-related events for interactive elements within the application.
 *
 * This method sets up event listeners for modal opening, closing, drawer interactions,
 * and dynamic resizing of modal components. It ties specific UI actions to their
 * corresponding functionalities, enhancing user interactivity with the modal.
 *
 * @return {void} Does not return a value.
 */
export function initializeModalEvents() {
    $('#acm-manager').on('click', function () {
        refreshCharListDebounced();
        openModal();
    });

    // Trigger when clicking on a drawer to open/close it
    $(document).on('click', '.altgreetings-drawer-toggle', function () {
        const icon = $(this).find('.idit');
        icon.toggleClass('down up').toggleClass('fa-circle-chevron-down fa-circle-chevron-up');
        $(this).closest('.inline-drawer').children('.inline-drawer-content').stop().slideToggle();

        // Set the height of "autoSetHeight" text areas within the inline-drawer to their scroll height
        $(this).closest('.inline-drawer').find('.inline-drawer-content textarea.autoSetHeight').each(function () {
            resetScrollHeight($(this));
        });
    });

    // Trigger when the modal is closed to reset some global parameters
    $('#acm_popup_close').on("click", function () {
        closeModal();
    });

    // Trigger when clicking on the separator to close the character details
    $(document).on('click', '#char-sep', function () {
        closeDetails();
    });

    const $slider = $('#acm_widthSlider');
    const $popup = $('#acm_popup');
    const $preview = $('#acm_popup_preview');

    $slider.on('input', function () {
        $preview.show().css({
            'width': $(this).val() + '%',
            'height': $popup.outerHeight() + 'px'
        });
    }).on('change', function () {
        const newWidth = $(this).val();
        $popup.css('width', newWidth + '%');
        $preview.hide();
        updateSetting('popupWidth', newWidth);

        // Rafraîchir le virtual scroller après le resize
        requestAnimationFrame(() => {
            handleContainerResize();
        });
    });
}

/**
 * Initializes UI menu events by binding click event handlers to various elements.
 * The method manages dropdown menu toggles, updates settings, refreshes lists, and manages custom categories.
 * Event handlers are dynamically assigned based on specific selectors.
 *
 * @return {void} This method does not return a value.
 */
export function initializeUIMenuEvents() {
    $('#acm_switch_ui').on("click", () => {
        toggleDropdownMenus({ menuToToggle: 'main' });
    });
    $('#acm_dropdown_sub').on("click", () => {
        toggleDropdownMenus({ menuToToggle: 'sub' });
    });
    $('#acm_dropdown_cat').on("click", () => {
        toggleDropdownMenus({ menuToToggle: 'preset' });
    });

    const menuActions = {
        '#acm_switch_classic': () => {
            if (getSetting('dropdownUI')) {
                updateSetting('dropdownUI', false);
                refreshCharListDebounced();
            }
        },
        '#acm_switch_alltags': () => {
            if (!getSetting('dropdownUI') || (getSetting('dropdownUI') && getSetting('dropdownMode') !== 'allTags')) {
                updateSetting('dropdownUI', true);
                updateSetting('dropdownMode', "allTags");
                refreshCharListDebounced();
            }
        },
        '#acm_switch_creators': () => {
            if (!getSetting('dropdownUI') || (getSetting('dropdownUI') && getSetting('dropdownMode') !== 'creators')) {
                updateSetting('dropdownUI', true);
                updateSetting('dropdownMode', "creators");
                refreshCharListDebounced();
            }
        },
        '#acm_manage_categories': () => {
            manageCustomCategories();
            const selectedPreset = $('#preset_selector option:selected').data('preset');
            if (getSetting('dropdownUI') && getSetting('dropdownMode') === 'custom') {
                $('.popup-button-ok').on('click', refreshCharListDebounced);
            }
            printCategoriesList(selectedPreset, true);
        },
        '[data-ui="preset"]': function() {
            const presetId = $(this).data('preset');
            if (!getSetting('dropdownUI') ||
                (getSetting('dropdownUI') && getSetting('dropdownMode') !== 'custom') ||
                (getSetting('dropdownUI') && getSetting('dropdownMode') === 'custom' && getSetting('presetId') !== presetId)) {
                updateSetting('dropdownUI', true);
                updateSetting('dropdownMode', "custom");
                updateSetting('presetId', presetId);
                refreshCharListDebounced();
            }
        }
    };

    Object.entries(menuActions).forEach(([selector, action]) => {
        $(document).on('click', selector, function() {
            action.call(this);
            toggleDropdownMenus({ closeAll: true });
        });
    });

    document.addEventListener('click', initializeDropdownClickOutside());
}
