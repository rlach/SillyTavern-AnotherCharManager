import { getSetting } from './settings-service.js';

/** @type {((...args: any[]) => any) | null} */
let originalPagination = null;
/** @type {((...args: any[]) => any) | null} */
let originalSelectRmCharacters = null;
/** @type {((...args: any[]) => Promise<any> | any) | null} */
let originalPrintCharacters = null;
let paginationPatched = false;
let selectPatched = false;
let printPatched = false;
/** @type {boolean | null} */
let lastAppliedDisabled = null;

const globalAny = /** @type {any} */ (globalThis);

function isOriginalCharManagerDisabled() {
    return getSetting('disableOriginalCharManager') === true;
}

function patchPagination() {
    if (paginationPatched || typeof $.fn.pagination !== 'function') {
        return;
    }

    originalPagination = $.fn.pagination;
    /** @type {(...args: any[]) => any} */
    $.fn.pagination = function (...args) {
        const original = originalPagination;
        if (typeof original !== 'function') {
            return this;
        }

        const isOriginalPagination = this?.is?.('#rm_print_characters_pagination');

        if (isOriginalCharManagerDisabled() && isOriginalPagination) {
            return this;
        }

        return original.apply(this, args);
    };

    paginationPatched = true;
}

function unpatchPagination() {
    if (!paginationPatched || typeof originalPagination !== 'function') {
        return;
    }

    $.fn.pagination = originalPagination;
    paginationPatched = false;
}

function patchSelectCharacters() {
    if (selectPatched || typeof globalAny.select_rm_characters !== 'function') {
        return;
    }

    originalSelectRmCharacters = globalAny.select_rm_characters;
    /** @type {(...args: any[]) => any} */
    globalAny.select_rm_characters = function (...args) {
        const original = originalSelectRmCharacters;
        if (typeof original !== 'function') {
            return true;
        }

        if (isOriginalCharManagerDisabled()) {
            return true;
        }

        return original.apply(this, args);
    };

    selectPatched = true;
}

function unpatchSelectCharacters() {
    if (!selectPatched || typeof originalSelectRmCharacters !== 'function') {
        return;
    }

    globalAny.select_rm_characters = originalSelectRmCharacters;
    selectPatched = false;
}

function patchPrintCharacters() {
    if (printPatched || typeof globalAny.printCharacters !== 'function') {
        return;
    }

    originalPrintCharacters = globalAny.printCharacters;
    /** @type {(...args: any[]) => Promise<any>} */
    globalAny.printCharacters = async function (...args) {
        const original = originalPrintCharacters;
        if (typeof original !== 'function') {
            return true;
        }

        if (isOriginalCharManagerDisabled()) {
            return true;
        }

        return original.apply(this, args);
    };

    printPatched = true;
}

function unpatchPrintCharacters() {
    if (!printPatched || typeof originalPrintCharacters !== 'function') {
        return;
    }

    globalAny.printCharacters = originalPrintCharacters;
    printPatched = false;
}

function patchAll() {
    patchPagination();
    patchSelectCharacters();
    patchPrintCharacters();
}

function unpatchAll() {
    unpatchPagination();
    unpatchSelectCharacters();
    unpatchPrintCharacters();
}

/**
 * Updates DOM visibility for the original manager controls.
 * @param {boolean} disabled
 */
function updateOriginalManagerUi(disabled) {
    const pagination = document.getElementById('rm_print_characters_pagination');
    if (pagination) {
        pagination.style.display = disabled ? 'none' : '';
    }
}

/**
 * Enables/disables original character manager behavior for test purposes.
 * @param {boolean} disabled
 */
export function applyOriginalCharManagerToggle(disabled) {
    const isDisabled = disabled === true;

    if (isDisabled) {
        patchAll();
    } else {
        unpatchAll();
    }

    updateOriginalManagerUi(isDisabled);

    // Rebuild the original character list when transitioning from disabled -> enabled.
    if (lastAppliedDisabled === true && !isDisabled) {
        const button = document.getElementById('rm_button_characters');
        if (button) {
            button.click();
        }
    }

    lastAppliedDisabled = isDisabled;
}
