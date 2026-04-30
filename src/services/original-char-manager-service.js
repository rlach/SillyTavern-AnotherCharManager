import { clearChat, getCurrentChatId, setActiveCharacter, setActiveGroup, setCharacterId, setCharacterName } from '/script.js';
import { eventSource, event_types } from '../constants/context.js';

const STORAGE_KEY = 'acm_disable_original_char_manager';
/** @type {boolean | null} */
let lastAppliedDisabled = null;
let closeChatInterceptionInstalled = false;
let isFastClosing = false;

function isOriginalCharManagerDisabled() {
    return localStorage.getItem(STORAGE_KEY) === 'true';
}

async function fastCloseChatWithoutOriginalCharacterRefresh() {
    if (isFastClosing) {
        return;
    }

    isFastClosing = true;
    try {
        await clearChat({ clearData: true });
        setCharacterId(undefined);
        setCharacterName('');
        setActiveCharacter(null);
        setActiveGroup(null);
        await eventSource.emit(event_types.CHAT_CHANGED, getCurrentChatId());
    } finally {
        isFastClosing = false;
    }
}

function installCloseChatInterception() {
    if (closeChatInterceptionInstalled) {
        return;
    }

    document.addEventListener('click', async (event) => {
        const target = /** @type {HTMLElement | null} */ (event.target instanceof HTMLElement ? event.target : null);
        const closeOption = target?.closest?.('#option_close_chat');

        if (!closeOption || !isOriginalCharManagerDisabled()) {
            return;
        }

        event.preventDefault();
        event.stopImmediatePropagation();
        await fastCloseChatWithoutOriginalCharacterRefresh();
    }, true);

    closeChatInterceptionInstalled = true;
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
    localStorage.setItem(STORAGE_KEY, String(isDisabled));
    installCloseChatInterception();

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
