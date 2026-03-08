import {
    depth_prompt_depth_default,
    doNewChat,
    depth_prompt_role_default,
    getPastCharacterChats,
    messageFormatting,
    setCharacterId,
    swipe,
    system_message_types,
    talkativeness_default
} from '/script.js';
import { importTags, tag_import_setting } from '/scripts/tags.js';
import { displayTag } from './tags.js';
import { getBase64Async, getIdByAvatar } from '../utils.js';
import {
    callGenericPopup,
    characters,
    getRequestHeaders,
    getThumbnailUrl,
    getTokenCountAsync,
    POPUP_TYPE,
    power_user,
    saveSettingsDebounced,
    selectCharacterById,
    substituteParams,
    tagMap,
    unshallowCharacter,
} from "../constants/context.js";
import { selectedChar, setMem_avatar } from "../constants/settings.js";
import {
    dupeChar,
    editCharDebounced,
    exportChar,
    renameChar,
    replaceAvatar,
    saveAltGreetings
} from "../services/characters-service.js";
import { addAltGreetingsTrigger } from "../events/characters-events.js";
import { closeDetails } from "./modal.js";
import { applyCreatorNotesDisplay, renderFormattedNotes } from "../services/creator-notes-css.js";
import { getSetting, updateSetting } from "../services/settings-service.js";

// ===== TABS SYSTEM STATE =====
let currentActiveTab = 'description';
let currentSelectedGreeting = 'default';
let currentAltGreetings = [];
let hasLoadedTagline = false;
let hasLoadedLastMessage = false;
let currentLastMessageText = '';
let currentTaglineEntry = null;
let descriptionEditMode = true;
let greetingsEditMode = true;

/**
 * Auto-resizes a textarea to fit its content without scrollbars.
 * @param {HTMLElement} element - The element to resize if it's a textarea
 */
function autoResizeTextarea(element) {
    if (!(element instanceof HTMLTextAreaElement)) return;

    const textarea = element;

    // Save current scroll position of parent
    const parent = textarea.closest('.acm-details-content-wrapper');
    const scrollTop = parent ? parent.scrollTop : 0;

    // Reset first so wrapping recalculates against current width.
    textarea.style.height = '0px';
    textarea.offsetHeight;

    const computed = window.getComputedStyle(textarea);
    const lineHeight = Number.parseFloat(computed.lineHeight) || 18;
    const safety = Math.ceil(lineHeight * 2);

    // First pass.
    let targetHeight = Math.max(100, textarea.scrollHeight + safety);
    textarea.style.height = `${targetHeight}px`;

    // Ensure there is never hidden textarea content (single outer scroll only).
    // Repeat a few times because font/layout transitions can shift metrics.
    for (let i = 0; i < 4; i++) {
        const hidden = textarea.scrollHeight - textarea.clientHeight;
        if (hidden <= 1) break;
        targetHeight += hidden + safety;
        textarea.style.height = `${targetHeight}px`;
    }

    // Restore scroll position
    if (parent) {
        parent.scrollTop = scrollTop;
    }
}

function scheduleTextareaResize(tabName) {
    const resizeForTab = () => {
        $(`.acm-tab-content[data-tab-content="${tabName}"] textarea`).each(function() {
            autoResizeTextarea(this);
        });
    };

    // Run multiple passes because panel/layout transitions can affect scrollHeight.
    setTimeout(resizeForTab, 0);
    setTimeout(resizeForTab, 80);
    setTimeout(resizeForTab, 220);
    setTimeout(resizeForTab, 420);
    setTimeout(resizeForTab, 900);
    setTimeout(resizeForTab, 1400);
}

/**
 * Updates the top-bar token counter for the currently active tab.
 * @param {string} tabName - Active tab key
 */
async function updateTopBarTokenCount(tabName) {
    const $counter = $('#acm_firstMess_tokens');
    if (!$counter.length || !selectedChar) {
        return;
    }

    const char = characters[getIdByAvatar(selectedChar)];
    if (!char) {
        $counter.text('');
        return;
    }

    let content = '';

    if (tabName === 'description') {
        content = String($('#acm_description').val() || char.description || '');
    } else if (tabName === 'greetings') {
        if (currentSelectedGreeting === 'default') {
            content = String($('#acm_firstMess').val() || char.first_mes || '');
        } else {
            const greetingIndex = Number.parseInt(currentSelectedGreeting, 10);
            const altGreetings = char.data.alternate_greetings || [];
            content = String($('#acm_firstMess').val() || altGreetings[greetingIndex] || '');
        }
    } else if (tabName === 'tagline_creator') {
        content = String($('#acm_creatornotes').val() || char.data?.creator_notes || char.creatorcomment || '');
    } else {
        $counter.text('');
        return;
    }

    const count = await getTokenCountAsync(substituteParams(content));
    $counter.text(`Tokens: ${count}`);
}

function getFullscreenTargetForTab(tabName) {
    if (tabName === 'description') return 'acm_description';
    if (tabName === 'greetings') return 'acm_firstMess';
    if (tabName === 'tagline_creator') return 'acm_tagline_creator_fullscreen_proxy';
    if (tabName === 'lastmessage') return 'acm_lastmessage_fullscreen_proxy';
    return 'acm_description';
}

function setLastMessageProxy(text) {
    const value = String(text || '');
    currentLastMessageText = value;
    $('#acm_lastmessage_fullscreen_proxy').val(value);
}

function buildTaglineCreatorFullscreenText() {
    const notesText = String($('#acm_creatornotes').val() || '').trim();
    const hasTaglineData = Boolean(currentTaglineEntry) && !currentTaglineEntry?.noData;
    const taglineHeader = hasTaglineData ? String(currentTaglineEntry?.projectName || '').trim() : '';
    const taglineBody = hasTaglineData ? String(currentTaglineEntry?.tagline || '').trim() : '';

    const taglineText = taglineHeader
        ? `${taglineHeader}\n${taglineBody || 'No data'}`
        : (taglineBody || 'No data');

    return `Tagline:\n${taglineText}\n\nCreator's Notes:\n${notesText || 'No data'}`;
}

function updateTaglineCreatorFullscreenProxy() {
    $('#acm_tagline_creator_fullscreen_proxy').val(buildTaglineCreatorFullscreenText());
}

function getSelectedCharacterName() {
    if (!selectedChar) return '';
    const char = characters[getIdByAvatar(selectedChar)];
    return String(char?.name || '');
}

function clampImagesInContainer(container) {
    if (!container) {
        return;
    }

    const root = container instanceof HTMLElement ? container : $(container)[0];
    if (!root) {
        return;
    }

    root.querySelectorAll('img').forEach((img) => {
        const inlinePosition = String(img.style.position || '').trim().toLowerCase();
        if (inlinePosition === 'fixed') {
            return;
        }

        const computedPosition = String(window.getComputedStyle(img).position || '').trim().toLowerCase();
        if (computedPosition === 'fixed') {
            return;
        }

        img.style.setProperty('max-width', '100%', 'important');
    });
}

function getGreetingEntriesForSelectedCharacter() {
    if (!selectedChar) {
        return [{ value: 'default', label: 'Default greeting', text: '' }];
    }

    const char = characters[getIdByAvatar(selectedChar)];
    if (!char) {
        return [{ value: 'default', label: 'Default greeting', text: '' }];
    }

    const altGreetings = Array.isArray(char.data?.alternate_greetings) ? char.data.alternate_greetings : [];
    const entries = [{
        value: 'default',
        label: 'Default greeting',
        text: String(char.first_mes || ''),
    }];

    altGreetings.forEach((greeting, index) => {
        entries.push({
            value: String(index),
            label: `Alt Greeting #${index + 1}`,
            text: String(greeting || ''),
        });
    });

    return entries;
}

function syncGreetingSelection(value) {
    const normalized = value === 'default' ? 'default' : String(value);
    $('#acm_greeting_selector').val(normalized);
    currentSelectedGreeting = normalized;
    handleGreetingSelectionChange();
}

function bindFullscreenGreetingNavigation({ prevButtonId, nextButtonId, titleId, bodyId }) {
    const prevButton = document.getElementById(prevButtonId);
    const nextButton = document.getElementById(nextButtonId);
    const titleElement = document.getElementById(titleId);
    const bodyElement = document.getElementById(bodyId);

    if (!(prevButton instanceof HTMLButtonElement) || !(nextButton instanceof HTMLButtonElement) || !titleElement || !bodyElement) {
        return;
    }

    const entries = getGreetingEntriesForSelectedCharacter();
    const selected = String(currentSelectedGreeting || 'default');
    let currentIndex = entries.findIndex((entry) => entry.value === selected);
    if (currentIndex < 0) {
        currentIndex = 0;
    }

    const updateHeaderButtonsState = () => {
        const disabled = entries.length <= 1;
        prevButton.disabled = disabled;
        nextButton.disabled = disabled;
        prevButton.classList.toggle('disabled', disabled);
        nextButton.classList.toggle('disabled', disabled);
    };

    const renderCurrentGreeting = () => {
        const entry = entries[currentIndex] || entries[0];
        if (!entry) {
            return;
        }

        syncGreetingSelection(entry.value);
        titleElement.textContent = entry.label;
        bodyElement.innerHTML = $('#acm_firstMess_preview').html() || '<div class="acm_tagline_no_data">No data</div>';
        clampImagesInContainer(bodyElement);
        updateHeaderButtonsState();
    };

    prevButton.addEventListener('click', () => {
        if (entries.length <= 1) {
            return;
        }
        currentIndex = (currentIndex - 1 + entries.length) % entries.length;
        renderCurrentGreeting();
    });

    nextButton.addEventListener('click', () => {
        if (entries.length <= 1) {
            return;
        }
        currentIndex = (currentIndex + 1) % entries.length;
        renderCurrentGreeting();
    });

    const keyHandler = (event) => {
        const target = event.target;
        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target?.isContentEditable) {
            return;
        }

        if (event.key === 'ArrowLeft') {
            event.preventDefault();
            prevButton.click();
        } else if (event.key === 'ArrowRight') {
            event.preventDefault();
            nextButton.click();
        }
    };

    document.addEventListener('keydown', keyHandler);

    renderCurrentGreeting();

    return () => {
        document.removeEventListener('keydown', keyHandler);
    };
}

function renderMessageLikeChat(rawText, $container, emptyText = 'No data') {
    const text = String(rawText || '').trim();
    if (!text) {
        $container.html(`<div class="acm_tagline_no_data">${emptyText}</div>`).show();
        return;
    }

    const formatted = messageFormatting(text, getSelectedCharacterName(), false, false, 0);
    $container.html(`
        <div class="mes acm-chat-preview-message">
            <div class="mes_block">
                <div class="mes_text">${formatted}</div>
            </div>
        </div>
    `).show();
    clampImagesInContainer($container[0]);
}

function renderDescriptionPreview() {
    const text = String($('#acm_description').val() || '');
    const $preview = $('#acm_description_preview');
    renderFormattedNotes(text, $preview, selectedChar || '');
    clampImagesInContainer($preview[0]);
}

function renderGreetingsPreview() {
    const text = String($('#acm_firstMess').val() || '');
    renderMessageLikeChat(text, $('#acm_firstMess_preview'));
}

function applyTabEditModeUi() {
    const $toggle = $('#acm_tab_edit_toggle');
    if (!$toggle.length) {
        return;
    }

    const setToggleState = (enabled) => {
        $toggle.attr('aria-pressed', enabled ? 'true' : 'false');
        $toggle.attr('title', enabled ? 'Edit mode: ON' : 'Edit mode: OFF');
        $toggle.toggleClass('active', enabled);
    };

    if (currentActiveTab === 'description') {
        $toggle.css('display', 'inline-flex');
        setToggleState(descriptionEditMode);
        $('#acm_description').closest('label').toggle(descriptionEditMode);
        if (!descriptionEditMode) {
            renderDescriptionPreview();
        }
        $('#acm_description_preview').toggle(!descriptionEditMode);
        return;
    }

    if (currentActiveTab === 'greetings') {
        $toggle.css('display', 'inline-flex');
        setToggleState(greetingsEditMode);
        $('#acm_firstMess').closest('label').toggle(greetingsEditMode);
        if (!greetingsEditMode) {
            renderGreetingsPreview();
        }
        $('#acm_firstMess_preview').toggle(!greetingsEditMode);
        return;
    }

    $toggle.hide();
}

function shouldOpenParsedFullscreen() {
    if (currentActiveTab === 'tagline_creator' || currentActiveTab === 'lastmessage') return true;
    if (currentActiveTab === 'greetings' && !greetingsEditMode) return true;
    if (currentActiveTab === 'description' && !descriptionEditMode) return true;
    return false;
}

async function openParsedFullscreenForTab() {
    let title = '';
    let htmlContent = '';
    let showDefaultHeading = true;
    let onOpen = null;
    let onClose = null;

    if (currentActiveTab === 'tagline_creator') {
        title = 'Tagline + Creator\'s Notes';
        const taglineHtml = $('#acm_tagline_content').html() || '<div class="acm_tagline_no_data">No data</div>';
        const notesHtml = $('#acm_creatornotes_display').html() || '<div class="acm_tagline_no_data">No data</div>';
        htmlContent = `<h4>Tagline</h4>${taglineHtml}<h4>Creator's Notes</h4>${notesHtml}`;
    } else if (currentActiveTab === 'lastmessage') {
        title = 'Last message';
        const body = $('#acm_last_message_content').html() || '<div class="acm_tagline_no_data">No messages yet</div>';
        htmlContent = `${body}`;
    } else if (currentActiveTab === 'greetings' && !greetingsEditMode) {
        title = 'Greeting';
        showDefaultHeading = false;

        const popupId = `acm_fs_greeting_${Date.now()}`;
        const prevButtonId = `${popupId}_prev`;
        const nextButtonId = `${popupId}_next`;
        const titleId = `${popupId}_title`;
        const bodyId = `${popupId}_body`;

        htmlContent = `
            <div class="acm-fullscreen-greeting-header" id="${popupId}">
                <button id="${prevButtonId}" class="menu_button acm-fullscreen-greeting-nav" type="button" title="Previous greeting">&lt;</button>
                <h4 id="${titleId}" class="acm-fullscreen-greeting-title">Default greeting</h4>
                <button id="${nextButtonId}" class="menu_button acm-fullscreen-greeting-nav" type="button" title="Next greeting">&gt;</button>
            </div>
            <div id="${bodyId}" class="acm-fullscreen-greeting-body"></div>
        `;

        let cleanupNavigation = null;
        onOpen = () => {
            cleanupNavigation = bindFullscreenGreetingNavigation({ prevButtonId, nextButtonId, titleId, bodyId });
        };

        onClose = () => {
            if (typeof cleanupNavigation === 'function') {
                cleanupNavigation();
            }
        };
    } else if (currentActiveTab === 'description' && !descriptionEditMode) {
        title = 'Description';
        const body = $('#acm_description_preview').html() || '<div class="acm_tagline_no_data">No data</div>';
        htmlContent = `${body}`;
    }

    if (!title || !htmlContent) {
        return false;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'acm-fullscreen-html';
    wrapper.innerHTML = showDefaultHeading ? `<h4>${title}</h4>${htmlContent}` : htmlContent;
    clampImagesInContainer(wrapper);

    await callGenericPopup(wrapper.outerHTML, POPUP_TYPE.DISPLAY, '', {
        wide: true,
        wider: true,
        large: true,
        allowVerticalScrolling: true,
        onOpen,
        onClose,
    });
    return true;
}

function updateTopBarFullscreenTarget(tabName) {
    const targetId = getFullscreenTargetForTab(tabName);
    $('#acm_tab_fullscreen').attr('data-for', targetId);

    if (tabName === 'lastmessage') {
        const fallbackText = $('#acm_last_message_content').text();
        if (!currentLastMessageText && fallbackText) {
            setLastMessageProxy(fallbackText);
        }
    }
}

/**
 * Switches to a different tab in the character details panel.
 * @param {string} tabName - The name of the tab to switch to ('description', 'greetings', 'tagline_creator', 'lastmessage')
 */
function switchTab(tabName) {
    // Update active tab state
    currentActiveTab = tabName;
    
    // Save to localStorage for persistence
    try {
        localStorage.setItem('acm_active_tab', tabName);
    } catch (e) {
        console.warn('Failed to save active tab to localStorage', e);
    }

    // Update tab buttons
    $('.acm-tab-button').removeClass('active');
    $(`.acm-tab-button[data-tab="${tabName}"]`).addClass('active');

    // Update tab content
    $('.acm-tab-content').removeClass('active');
    $(`.acm-tab-content[data-tab-content="${tabName}"]`).addClass('active');

    // Show/hide greeting controls (the bar stays visible)
    if (tabName === 'greetings') {
        $('.acm-greetings-controls').css('display', 'flex');
    } else {
        $('.acm-greetings-controls').hide();
    }

    applyTabEditModeUi();

    // Scroll content to top
    const contentWrapper = $('.acm-details-content-wrapper')[0];
    if (contentWrapper) {
        contentWrapper.scrollTop = 0;
    }

    // Auto-resize textareas in the active tab
    scheduleTextareaResize(tabName);

    updateTaglineCreatorFullscreenProxy();
    updateTopBarTokenCount(tabName);
    updateTopBarFullscreenTarget(tabName);

    // Lazy load content for certain tabs
    if (tabName === 'tagline_creator' && !hasLoadedTagline) {
        hasLoadedTagline = true;
        loadTaglineForSelectedCharacter();
    }

    if (tabName === 'lastmessage' && !hasLoadedLastMessage) {
        hasLoadedLastMessage = true;
        loadLastMessageForSelectedCharacter();
    }
}

/**
 * Builds greeting options for the dropdown selector.
 * @param {Array} altGreetings - Array of alternate greetings
 * @returns {string} HTML string with option elements
 */
function buildGreetingsDropdownOptions(altGreetings) {
    let options = '<option value="default">Default Greeting</option>';
    
    if (Array.isArray(altGreetings)) {
        altGreetings.forEach((greeting, index) => {
            options += `<option value="${index}">Alt Greeting #${index + 1}</option>`;
        });
    }
    
    return options;
}

/**
 * Handles greeting selection change from the dropdown.
 */
function handleGreetingSelectionChange() {
    const selectedValue = String($('#acm_greeting_selector').val());
    currentSelectedGreeting = selectedValue;
    
    const char = characters[getIdByAvatar(selectedChar)];
    if (!char) return;

    // Load the appropriate greeting into the textarea
    if (selectedValue === 'default') {
        $('#acm_firstMess').val(char.first_mes || '');
    } else {
        const greetingIndex = parseInt(selectedValue, 10);
        const altGreetings = char.data.alternate_greetings || [];
        $('#acm_firstMess').val(altGreetings[greetingIndex] || '');
    }

    // Update delete button state
    updateGreetingDeleteButtonState(selectedValue);

    // Auto-resize textarea
    setTimeout(() => autoResizeTextarea($('#acm_firstMess')[0]), 0);

    if (!greetingsEditMode) {
        renderGreetingsPreview();
    }

    // Scroll to top
    const contentWrapper = $('.acm-details-content-wrapper')[0];
    if (contentWrapper) {
        contentWrapper.scrollTop = 0;
    }

    updateTopBarTokenCount('greetings');
}

/**
 * Handles adding a new greeting.
 */
async function handleGreetingAdd() {
    const char = characters[getIdByAvatar(selectedChar)];
    if (!char) return;

    // Add new empty greeting
    if (!Array.isArray(char.data.alternate_greetings)) {
        char.data.alternate_greetings = [];
    }

    const newGreetingText = '';
    char.data.alternate_greetings.push(newGreetingText);
    
    // Save the changes
    await saveAltGreetings(char.avatar, char.name);

    // Update dropdown
    const newIndex = char.data.alternate_greetings.length - 1;
    $('#acm_greeting_selector').html(buildGreetingsDropdownOptions(char.data.alternate_greetings));
    $('#acm_greeting_selector').val(newIndex.toString());
    
    // Load the new greeting
    currentSelectedGreeting = newIndex.toString();
    $('#acm_firstMess').val(newGreetingText);
    updateGreetingDeleteButtonState(currentSelectedGreeting);
    setTimeout(() => autoResizeTextarea($('#acm_firstMess')[0]), 0);
    updateTopBarTokenCount('greetings');

    // Update the greeting number display (legacy support for alt greetings drawer)
    $('#altGreetings_number').text(`Numbers: ${char.data.alternate_greetings.length}`);
    
    // Focus the textarea
    $('#acm_firstMess').focus();

    toastr.success('New greeting added');
}

/**
 * Handles deleting the currently selected greeting.
 */
async function handleGreetingDelete() {
    const selectedValue = String($('#acm_greeting_selector').val());
    
    // Can't delete default greeting
    if (selectedValue === 'default') return;

    const char = characters[getIdByAvatar(selectedChar)];
    if (!char) return;

    const greetingIndex = parseInt(selectedValue, 10);
    const altGreetings = char.data.alternate_greetings || [];

    if (greetingIndex < 0 || greetingIndex >= altGreetings.length) return;

    // Confirm deletion
    const confirmed = await callGenericPopup('Delete this greeting?', POPUP_TYPE.CONFIRM);
    if (!confirmed) return;

    // Remove the greeting
    altGreetings.splice(greetingIndex, 1);
    char.data.alternate_greetings = altGreetings;

    // Save the changes
    await saveAltGreetings(char.avatar, char.name);

    // Update dropdown
    $('#acm_greeting_selector').html(buildGreetingsDropdownOptions(char.data.alternate_greetings));

    // Select previous greeting or default
    let newSelection = 'default';
    if (greetingIndex > 0) {
        newSelection = (greetingIndex - 1).toString();
    }
    
    $('#acm_greeting_selector').val(newSelection);
    currentSelectedGreeting = newSelection;

    // Load the selected greeting
    handleGreetingSelectionChange();

    // Update the greeting number display
    $('#altGreetings_number').text(`Numbers: ${char.data.alternate_greetings.length}`);

    toastr.success('Greeting deleted');
}

/**
 * Updates the delete button state based on the selected greeting.
 * @param {string} selectedValue - The selected greeting value ('default' or index)
 */
function updateGreetingDeleteButtonState(selectedValue) {
    const deleteButton = $('#acm_greeting_delete');
    if (selectedValue === 'default') {
        deleteButton.prop('disabled', true);
    } else {
        deleteButton.prop('disabled', false);
    }
}

function closeDetailsPopupWithFade() {
    closeDetails(false);

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

async function handleGreetingStartNewChat() {
    if (!selectedChar) {
        return;
    }

    const charId = Number(getIdByAvatar(selectedChar));
    if (Number.isNaN(charId) || !characters[charId]) {
        toastr.warning('Cannot resolve selected character');
        return;
    }

    const selectedValue = String($('#acm_greeting_selector').val() ?? currentSelectedGreeting ?? 'default');
    const selectedAltIndex = selectedValue === 'default' ? -1 : Number.parseInt(selectedValue, 10);
    const targetSwipeId = selectedAltIndex >= 0 ? selectedAltIndex + 1 : 0;

    try {
        await selectCharacterById(charId, { switchMenu: false });
        await doNewChat({ deleteCurrentChat: false });

        await swipe(null, 'right', {
            forceMesId: 0,
            forceSwipeId: targetSwipeId,
            source: 'slash_command',
        });

        closeDetailsPopupWithFade();
        toastr.success('Started new chat with selected greeting');
    } catch (error) {
        console.error('Failed to start new chat with selected greeting', error);
        toastr.error('Failed to start new chat with selected greeting');
    }
}

/**
 * Initializes the tabs system event handlers.
 */
export function initializeTabs() {
    descriptionEditMode = getSetting('descriptionEditMode') !== false;
    greetingsEditMode = getSetting('greetingsEditMode') !== false;

    // Restore last active tab from localStorage
    try {
        const savedTab = localStorage.getItem('acm_active_tab');
        if (savedTab && ['description', 'greetings', 'tagline_creator', 'lastmessage'].includes(savedTab)) {
            currentActiveTab = savedTab;
        }
    } catch (e) {
        console.warn('Failed to load active tab from localStorage', e);
    }

    // Tab button clicks
    $(document).on('click', '.acm-tab-button:not(.disabled)', function() {
        const tabName = $(this).data('tab');
        switchTab(tabName);
    });

    // Greeting dropdown change
    $(document).on('change', '#acm_greeting_selector', handleGreetingSelectionChange);

    // Greeting add button
    $(document).on('click', '#acm_greeting_add', handleGreetingAdd);

    // Greeting delete button
    $(document).on('click', '#acm_greeting_delete', handleGreetingDelete);

    // Greeting new chat button
    $(document).on('click', '#acm_greeting_new_chat', handleGreetingStartNewChat);

    // Fullscreen button with parsed preview fallback for non-edit views
    $(document).on('click', '#acm_tab_fullscreen', async function (event) {
        if (!shouldOpenParsedFullscreen()) {
            return;
        }

        event.preventDefault();
        event.stopImmediatePropagation();
        await openParsedFullscreenForTab();
    });

    // Shared edit toggle (Description/Greetings only)
    $(document).on('click', '#acm_tab_edit_toggle', function () {
        if (currentActiveTab === 'description') {
            descriptionEditMode = !descriptionEditMode;
            updateSetting('descriptionEditMode', descriptionEditMode);
            applyTabEditModeUi();
            if (descriptionEditMode) {
                setTimeout(() => autoResizeTextarea($('#acm_description')[0]), 0);
            }
        } else if (currentActiveTab === 'greetings') {
            greetingsEditMode = !greetingsEditMode;
            updateSetting('greetingsEditMode', greetingsEditMode);
            applyTabEditModeUi();
            if (greetingsEditMode) {
                setTimeout(() => autoResizeTextarea($('#acm_firstMess')[0]), 0);
            }
        }
    });

    // Auto-resize textareas on input
    $(document).on('input', '.acm-tab-content textarea', function() {
        autoResizeTextarea(this);
        if (this.id === 'acm_description' && !descriptionEditMode) {
            renderDescriptionPreview();
        }
        if (this.id === 'acm_firstMess' && !greetingsEditMode) {
            renderGreetingsPreview();
        }
        if (this.id === 'acm_creatornotes') {
            updateTaglineCreatorFullscreenProxy();
        }
        updateTopBarTokenCount(currentActiveTab);
    });

    // Re-run resize on caret navigation/focus to avoid hidden bottom lines.
    $(document).on('focus click keyup', '.acm-tab-content textarea', function() {
        autoResizeTextarea(this);
    });

    $(window).off('resize.acm-tabs').on('resize.acm-tabs', function() {
        scheduleTextareaResize(currentActiveTab);
    });

    console.log('ACM Tabs system initialized');
}

/**
 * Fills the character details in the user interface based on the provided avatar.
 *
 * @param {string} avatar - The avatar identifier of the character for which details are to be filled.
 * @return {Promise<void>} A promise that resolves when all character details have been successfully populated and updates are complete.
 */
export async function fillDetails(avatar) {
    if (typeof characters[getIdByAvatar(avatar)].data.alternate_greetings === 'undefined') {
        await unshallowCharacter(getIdByAvatar(avatar));
    }
    const char = characters[getIdByAvatar(avatar)];
    const avatarThumb = getThumbnailUrl('avatar', char.avatar);

    $('#avatar_title').attr('title', char.avatar);
    $('#avatar_img').attr('src', avatarThumb);
    $('#ch_name_details').text(char.name);
    $('#ch_infos_creator').text(`Creator: ${char.data.creator ? char.data.creator : (char.data.extensions.chub?.full_path?.split('/')[0] ?? " - ")}`);
    $('#ch_infos_version').text(`Version: ${char.data.character_version ?? " - "}`);
    const dateString = char.create_date?.split("@")[0] ?? " - ";
    const [year, month, day] = dateString.split("-");
    const formattedDateString = year === " - " ? " - " : `${year}-${month.padStart(2, "0")}-${day.trim().padStart(2, "0")}`;
    $('#ch_infos_date').text(`Created: ${formattedDateString}`);
    $('#ch_infos_lastchat').text(`Last chat: ${char.date_last_chat ? new Date(char.date_last_chat).toISOString().substring(0, 10) : " - "}`);
    $('#ch_infos_adddate').text(`Added: ${char.date_added ? new Date(char.date_added).toISOString().substring(0, 10) : " - "}`);
    $('#ch_infos_link').html(char.data.extensions.chub?.full_path ? `Link: <a href="https://chub.ai/${char.data.extensions.chub.full_path}" target="_blank">Chub</a>` : "Link: -");
    const text = substituteParams(
        char.name +
        char.description +
        char.first_mes +
        (char.data?.extensions?.depth_prompt?.prompt ?? '') +
        (char.data?.post_history_instructions || '') +
        char.personality +
        char.scenario +
        (char.data?.extensions?.depth_prompt?.prompt ?? '') +
        char.mes_example
    );
    const tokens = await getTokenCountAsync(text);
    $('#ch_infos_tok').text(`Tokens: ${tokens}`);
    const permText = substituteParams(
        char.name +
        char.description +
        char.personality +
        char.scenario +
        (char.data?.extensions?.depth_prompt?.prompt ?? '')
    );
    const permTokens = await getTokenCountAsync(permText);
    $('#ch_infos_permtok').text(`Perm. Tokens: ${permTokens}`);
    $('#acm_description').val(char.description);
    $('#acm_firstMess').val(char.first_mes);
    $('#altGreetings_number').text(`Numbers: ${char.data.alternate_greetings?.length ?? 0}`);
    
    // Handle Creator's Notes with CSS style support
    const creatorNotesContent = char.data?.creator_notes || char.creatorcomment;
    applyCreatorNotesDisplay(
        creatorNotesContent,
        $('#acm_creatornotes'),
        $('#acm_creatornotes_display'),
        char.avatar
    );

    renderDescriptionPreview();
    renderGreetingsPreview();
    updateTaglineCreatorFullscreenProxy();
    const characterTags = Array.isArray(tagMap[char.avatar]) ? tagMap[char.avatar] : [];
    $('#tag_List').html(`${characterTags.map((tag) => displayTag(tag, 'details')).join('')}`);
    displayAltGreetings(char.data.alternate_greetings).then(html => {
        $('#altGreetings_content').html(html);
    });
    
    // ===== TABS SYSTEM: Initialize greetings dropdown =====
    const altGreetings = char.data.alternate_greetings || [];
    $('#acm_greeting_selector').html(buildGreetingsDropdownOptions(altGreetings));
    
    // Select current greeting (default or previously selected)
    if (currentSelectedGreeting === 'default' || !altGreetings[parseInt(currentSelectedGreeting, 10)]) {
        $('#acm_greeting_selector').val('default');
        currentSelectedGreeting = 'default';
    } else {
        $('#acm_greeting_selector').val(currentSelectedGreeting);
    }
    updateGreetingDeleteButtonState(currentSelectedGreeting);
    
    // ===== TABS SYSTEM: Check if character has chats for Last message tab =====
    const hasChats = Boolean(char.date_last_chat);
    const $lastMessageTab = $('.acm-tab-button[data-tab="lastmessage"]');
    
    if (hasChats) {
        $lastMessageTab.removeClass('disabled');
    } else {
        $lastMessageTab.addClass('disabled');
        
        // Auto-switch to Description if Last message was selected but no chats
        if (currentActiveTab === 'lastmessage') {
            currentActiveTab = 'description';
        }
    }
    
    // ===== TABS SYSTEM: Reset lazy load flags when switching characters =====
    hasLoadedTagline = false;
    hasLoadedLastMessage = false;
    currentLastMessageText = '';
    currentTaglineEntry = null;
    
    // Clear content
    $('#acm_tagline_content').empty();
    $('#acm_last_message_content').empty();
    $('#acm_tagline_creator_fullscreen_proxy').val('');
    $('#acm_lastmessage_fullscreen_proxy').val('');

    // Ensure textarea heights match full content after panel transitions settle
    const resizeAllMainTextareas = () => {
        autoResizeTextarea($('#acm_description')[0]);
        autoResizeTextarea($('#acm_firstMess')[0]);
        autoResizeTextarea($('#acm_creatornotes')[0]);
    };
    setTimeout(resizeAllMainTextareas, 0);
    setTimeout(resizeAllMainTextareas, 80);
    setTimeout(resizeAllMainTextareas, 220);
    
    // ===== TABS SYSTEM: Switch to the appropriate tab =====
    switchTab(currentActiveTab);
    
    $('#acm_favorite_button').toggleClass('fav_on', char.fav || char.data.extensions.fav).toggleClass('fav_off', !(char.fav || char.data.extensions.fav));
    addAltGreetingsTrigger()
}

function findLastAgentNonSystemMessage(chatMessages) {
    if (!Array.isArray(chatMessages)) {
        return '';
    }

    for (let i = chatMessages.length - 1; i >= 0; i--) {
        const message = chatMessages[i];
        if (!message) {
            continue;
        }

        const isSystem = Boolean(message.is_system) || message.extra?.type === system_message_types.NARRATOR;
        const isUser = Boolean(message.is_user);
        if (isSystem || isUser) {
            continue;
        }

        const text = String(message?.mes ?? '').trim();
        if (text.length > 0) {
            return text;
        }
    }

    return '';
}

function normalizeChatFileName(value) {
    const rawValue = String(value || '').trim();
    if (!rawValue) {
        return '';
    }

    return rawValue.replace(/\.jsonl$/i, '');
}

function getChatNameFromFileName(fileName, fallbackName) {
    const baseName = normalizeChatFileName(fileName);
    if (!baseName) {
        return String(fallbackName || '');
    }

    const splitMarker = ' - ';
    const markerIndex = baseName.indexOf(splitMarker);
    if (markerIndex > 0) {
        return baseName.slice(0, markerIndex);
    }

    return String(fallbackName || '');
}

async function fetchCharacterChatMessages(char, chatFileName) {
    const normalizedFileName = normalizeChatFileName(chatFileName);
    if (!normalizedFileName) {
        return [];
    }

    const response = await fetch('/api/chats/get', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({
            ch_name: getChatNameFromFileName(normalizedFileName, char.name),
            file_name: normalizedFileName,
            avatar_url: char.avatar,
        }),
        cache: 'no-cache',
    });

    if (!response.ok) {
        throw new Error(`Failed to load chat: ${response.status}`);
    }

    const chat = await response.json();
    if (!Array.isArray(chat)) {
        return [];
    }

    const messages = [...chat];
    if (messages.length > 0 && messages[0] && Object.prototype.hasOwnProperty.call(messages[0], 'chat_metadata')) {
        messages.shift();
    }

    return messages;
}

function renderLastMessage(text, { noChats = false } = {}) {
    const $content = $('#acm_last_message_content');
    $content.empty();

    if (noChats) {
        setLastMessageProxy('No chats yet');
        $('<div class="acm_tagline_no_data"></div>').text('No chats yet').appendTo($content);
        return;
    }

    if (!text) {
        setLastMessageProxy('No messages yet');
        $('<div class="acm_tagline_no_data"></div>').text('No messages yet').appendTo($content);
        return;
    }

    setLastMessageProxy(text);
    renderMessageLikeChat(text, $content, 'No messages yet');
}



export async function loadLastMessageForSelectedCharacter() {
    if (!selectedChar) {
        return;
    }

    const charId = getIdByAvatar(selectedChar);
    const char = characters[charId];
    if (!char) {
        return;
    }

    const avatarKey = char.avatar;
    const $content = $('#acm_last_message_content');
    $content.html('<div class="acm_tagline_loader"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</div>');

    try {
        const chatCandidates = [];
        const currentChat = normalizeChatFileName(char.chat);
        if (currentChat) {
            chatCandidates.push(currentChat);
        }

        const chats = await getPastCharacterChats(charId);
        if (selectedChar !== avatarKey) {
            return;
        }

        if (Array.isArray(chats) && chats.length > 0) {
            const latestFromHistory = normalizeChatFileName(chats[0]?.file_name);
            if (latestFromHistory && !chatCandidates.includes(latestFromHistory)) {
                chatCandidates.push(latestFromHistory);
            }
        }

        if (chatCandidates.length === 0) {
            renderLastMessage('', { noChats: true });
            return;
        }

        let chatMessages = [];
        for (const candidate of chatCandidates) {
            try {
                chatMessages = await fetchCharacterChatMessages(char, candidate);
                if (Array.isArray(chatMessages) && chatMessages.length > 0) {
                    break;
                }
            } catch {
                // Try next candidate.
            }
        }

        if (selectedChar !== avatarKey) {
            return;
        }

        renderLastMessage(findLastAgentNonSystemMessage(chatMessages));
    } catch (error) {
        console.error('Failed to load last message', error);
        if (selectedChar === avatarKey) {
            renderLastMessage('');
        }
    }
}

/**
 * Loads tagline data for currently selected character.
 * Uses cache from extension settings and fetches only when needed.
 *
 * @return {Promise<void>}
 */
export async function loadTaglineForSelectedCharacter() {
    if (!selectedChar) {
        return;
    }

    const charId = getIdByAvatar(selectedChar);
    const char = characters[charId];
    if (!char) {
        return;
    }

    const avatarKey = char.avatar;
    const $content = $('#acm_tagline_content');
    const taglineCache = getSetting('taglineCache') || {};

    $content.html('<div class="acm_tagline_loader"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</div>');

    if (taglineCache[avatarKey]) {
        renderTagline(taglineCache[avatarKey]);
        return;
    }

    const rawFullPath = char?.data?.extensions?.chub?.full_path;
    const normalizedPath = normalizeChubCharacterPath(rawFullPath);

    if (!normalizedPath) {
        const noDataEntry = { projectName: '', tagline: '', noData: true };
        updateTaglineCache(avatarKey, noDataEntry);
        if (selectedChar === avatarKey) {
            renderTagline(noDataEntry);
        }
        return;
    }

    let entry;
    try {
        const encodedPath = normalizedPath.split('/').map(encodeURIComponent).join('/');
        const response = await fetch(`https://gateway.chub.ai/api/characters/${encodedPath}?full=true`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch tagline metadata: ${response.status} ${response.statusText}`);
        }

        const payload = await response.json();
        const projectName = String(payload?.node?.definition?.project_name || '').trim();
        const tagline = String(payload?.node?.tagline || '').trim();
        const noData = !projectName && !tagline;

        entry = {
            projectName,
            tagline,
            noData,
        };
    } catch (error) {
        console.error('Failed to fetch tagline data', error);
        entry = { projectName: '', tagline: '', noData: true };
    }

    updateTaglineCache(avatarKey, entry);

    if (selectedChar === avatarKey) {
        renderTagline(entry);
    }
}

function updateTaglineCache(avatarKey, entry) {
    const cache = { ...(getSetting('taglineCache') || {}) };
    cache[avatarKey] = entry;
    updateSetting('taglineCache', cache);
}

function renderTagline(entry) {
    const $content = $('#acm_tagline_content');
    $content.empty();
    currentTaglineEntry = entry || null;

    const projectName = String(entry?.projectName || '').trim();
    const tagline = String(entry?.tagline || '').trim();
    const combined = (!entry || entry.noData)
        ? ''
        : [projectName, tagline].filter(Boolean).join('\n\n');

    // Render with the same HTML/CSS behavior as creator notes.
    renderFormattedNotes(combined, $content, selectedChar || '');
    clampImagesInContainer($content[0]);
    updateTaglineCreatorFullscreenProxy();
}

/**
 * Populates various advanced character definition fields in the user interface with data associated
 * with the given avatar. The method performs asynchronous operations to fetch token counts for certain
 * data fields and updates the UI accordingly.
 *
 * @param {Object} avatar - The avatar object used to retrieve character information for populating the fields.
 * @return {Promise<void>} A promise that resolves once all advanced definition fields are populated with
 *                         character data and token counts.
 */
export async function fillAdvancedDefinitions(avatar) {
    const char = characters[getIdByAvatar(avatar)];
    $('#acm_character_popup-button-h3').text(char.name);
    
    // Handle Creator's Notes with CSS style support
    const creatorNotesContent = char.data?.creator_notes || char.creatorcomment;
    applyCreatorNotesDisplay(
        creatorNotesContent,
        $('#acm_creator_notes_textarea'),
        $('#acm_creator_notes_display'),
        char.avatar
    );
    $('#acm_character_version_textarea').val(char.data?.character_version || '');
    $('#acm_system_prompt').val(char.data?.system_prompt || '');
    $('#acm_system_prompt_tokens').text(`Tokens: ${await getTokenCountAsync(substituteParams(char.data?.system_prompt || ''))}`);
    $('#acm_post_history_prompt').val(char.data?.post_history_instructions || '');
    $('#acm_post_history_prompt_tokens').text(`Tokens: ${await getTokenCountAsync(substituteParams(char.data?.post_history_instructions || ''))}`);
    $('#acm_tags_textarea').val(Array.isArray(char.data?.tags) ? char.data.tags.join(', ') : '');
    $('#acm_creator_textarea').val(char.data?.creator);
    $('#acm_personality').val(char.personality);
    $('#acm_personality_tokens').text(`Tokens: ${await getTokenCountAsync(substituteParams(char.personality))}`);
    $('#acm_scenario').val(char.scenario);
    $('#acm_scenario_tokens').text(`Tokens: ${await getTokenCountAsync(substituteParams(char.scenario))}`);
    $('#acm_character_notes').val(char.data?.extensions?.depth_prompt?.prompt ?? '');
    $('#acm_character_notes_tokens').text(`Tokens: ${await getTokenCountAsync(substituteParams(char.data?.extensions?.depth_prompt?.prompt ?? ''))}`);
    $('#acm_character_notes_depth').val(char.data?.extensions?.depth_prompt?.depth ?? depth_prompt_depth_default);
    $('#acm_character_notes_role').val(char.data?.extensions?.depth_prompt?.role ?? depth_prompt_role_default);
    $('#acm_talkativeness_slider').val(char.talkativeness || talkativeness_default);
    $('#acm_mes_examples').val(char.mes_example);
    $('#acm_messages_examples').text(`Tokens: ${await getTokenCountAsync(substituteParams(char.mes_example))}`);
}

/**
 * Toggles the favorite status of the currently selected character.
 * This function updates the favorite status of the character in the data model
 * and reflects the change in the user interface by toggling the favorite button's class.
 *
 * @return {void} This function does not return a value.
 */
export function toggleFavoriteStatus() {
    // Retrieve the ID of the currently selected character
    const id = getIdByAvatar(selectedChar);
    // Determine the current favorite status of the character
    const isFavorite = characters[id].fav || characters[id].data.extensions.fav;
    // Prepare the updated data object with the toggled favorite status
    const update = {
        avatar: selectedChar,
        fav: !isFavorite,
        data: {
            extensions: {
                fav: !isFavorite
            }
        }
    };
    // Apply the update using a debounced function to avoid excessive updates
    editCharDebounced(update);
    // Get the favorite button element from the DOM
    const favoriteButton = $('#acm_favorite_button')[0];
    // Update the button's class to reflect the new favorite status
    if (isFavorite) {
        favoriteButton.classList.replace('fav_on', 'fav_off');
    } else {
        favoriteButton.classList.replace('fav_off', 'fav_on');
    }
}

/**
 * Exports the currently selected character in the specified format.
 * This function utilizes the `exportChar` service to handle the export process.
 *
 * @param {string} format - The format in which the character should be exported (e.g., JSON, XML).
 * @return {void} This function does not return a value.
 */
export function exportCharacter(format) {
    exportChar(format, selectedChar);
}

/**
 * Duplicates the currently selected character.
 * This function checks if a character is selected, prompts the user for confirmation,
 * and duplicates the character if the user confirms the action.
 *
 * @async
 * @return {Promise<void>} A promise that resolves once the character duplication process is complete.
 */
export async function duplicateCharacter() {
    if (!selectedChar) {
        // Display a warning if no character is selected
        toastr.warning('You must first select a character to duplicate!');
        return;
    }
    // Show a confirmation dialog to the user
    const confirmed = await showDuplicateConfirmation();
    if (!confirmed) {
        // Log a message if the user cancels the duplication
        console.log('User cancelled duplication');
        return;
    }
    // Duplicate the selected character
    await dupeChar(selectedChar);
}

/**
 * Reimports tags from Chub for the currently selected character and overwrites existing tags.
 * Uses core `importTags` logic from `/scripts/tags.js`.
 *
 * @async
 * @return {Promise<void>} A promise that resolves once tags are reimported.
 */
export async function reimportCharacterTags() {
    if (!selectedChar) {
        toastr.warning('You must first select a character!');
        return;
    }

    const charId = getIdByAvatar(selectedChar);
    const char = characters[charId];
    const rawFullPath = char?.data?.extensions?.chub?.full_path;

    if (!rawFullPath || typeof rawFullPath !== 'string') {
        toastr.warning('This character does not have a Chub link.');
        return;
    }

    const normalizedPath = normalizeChubCharacterPath(rawFullPath);
    if (!normalizedPath) {
        toastr.warning('Invalid Chub path on this character.');
        return;
    }

    const fullUrl = `https://chub.ai/characters/${normalizedPath}`;

    let metadata;
    try {
        const response = await fetch(`https://api.chub.ai/api/characters/${normalizedPath}?full=true`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch Chub metadata: ${response.status} ${response.statusText}`);
        }

        metadata = await response.json();
    } catch (error) {
        console.error('Failed to fetch Chub tags', error);
        toastr.error(`Failed to fetch tags from Chub: ${fullUrl}`);
        return;
    }

    const incomingTags = Array.isArray(metadata?.node?.topics)
        ? metadata.node.topics.map(tag => String(tag).trim()).filter(Boolean)
        : [];

    tagMap[char.avatar] = [];
    saveSettingsDebounced();

    if (incomingTags.length === 0) {
        await fillDetails(selectedChar);
        toastr.info('Reimport complete: no tags found on Chub (existing tags were cleared).');
        return;
    }

    await importTags({
        avatar: char.avatar,
        name: char.name,
        tags: incomingTags,
    }, {
        importSetting: tag_import_setting.ALL,
    });

    await fillDetails(selectedChar);
    toastr.success('Tags reimported from Chub and overwritten.');
}

/**
 * Normalizes Chub character path (creator/character) from different stored formats.
 *
 * @param {string} rawPath - Raw stored path from character metadata.
 * @return {string|null} Normalized path in the form `creator/character`, or null if invalid.
 */
function normalizeChubCharacterPath(rawPath) {
    let value = String(rawPath).trim();

    if (!value) {
        return null;
    }

    if (/^https?:\/\//i.test(value)) {
        try {
            const url = new URL(value);
            value = url.pathname;
        } catch {
            return null;
        }
    }

    value = value.replace(/^\/+/, '');
    value = value.replace(/^characters\//i, '');

    const parts = value.split('/').filter(Boolean);
    if (parts.length < 2) {
        return null;
    }

    return parts.join('/');
}

/**
 * Displays a confirmation popup to the user asking if they want to duplicate a character.
 * The popup includes a message explaining the duplication action and an alternative option
 * to start a new chat with the same character.
 *
 * @async
 * @return {Promise<Popup>} A promise that resolves to the confirmation popup instance.
 */
export async function showDuplicateConfirmation() {
    const confirmMessage = `
        <h3>Are you sure you want to duplicate this character?</h3>
        <span>If you just want to start a new chat with the same character, use "Start new chat" option in the bottom-left options menu.</span><br><br>`;
    return await callGenericPopup(confirmMessage, POPUP_TYPE.CONFIRM);
}

/**
 * Displays a rename dialog for the specified character.
 * This function creates a popup dialog that allows the user to input a new name
 * for the character identified by the provided avatar.
 *
 * @async
 * @param {string} characterAvatar - The avatar identifier of the character to be renamed.
 * @return {Promise<Popup>} A promise that resolves to the popup instance for the rename dialog.
 */
export async function showRenameDialog(characterAvatar) {
    const charID = getIdByAvatar(characterAvatar);
    return await callGenericPopup('<h3>New name:</h3>', POPUP_TYPE.INPUT, characters[charID].name);
}

/**
 * Renames the currently selected character.
 * This function retrieves the character ID based on the selected avatar,
 * displays a rename dialog to the user, and updates the character's name
 * with the new name provided by the user.
 *
 * @async
 * @return {Promise<void>} A promise that resolves once the character's name has been successfully updated.
 */
export async function renameCharacter() {
    const charID = getIdByAvatar(selectedChar);
    const newName = await showRenameDialog(selectedChar);
    await renameChar(selectedChar, charID, newName);
}

/**
 * Opens the character chat interface for the currently selected character.
 * This function resets the character ID and avatar memory, selects the character
 * by its ID, and closes the details view. It also transitions the shadow popup
 * to fade out and hides the popup after a short delay.
 *
 * @return {void} This function does not return a value.
 */
export function openCharacterChat() {
    setCharacterId(undefined);
    setMem_avatar(undefined);
    selectCharacterById(getIdByAvatar(selectedChar));
    closeDetailsPopupWithFade();
}

/**
 * Toggles the visibility of the advanced definitions popup.
 * This function checks the current display state of the popup and either shows or hides it.
 * When showing the popup, it applies a fade-in transition effect; when hiding, it removes the 'open' class.
 *
 * @return {void} This function does not return a value.
 */
export function toggleAdvancedDefinitionsPopup() {
    const $popup = $('#acm_character_popup');
    if ($popup.css('display') === 'none') {
        $popup.css({ 'display': 'flex', 'opacity': 0.0 })
            .addClass('open')
            .transition({
                opacity: 1.0,
                duration: 125,
                easing: 'ease-in-out',
            });
    } else {
        $popup.css('display', 'none').removeClass('open');
    }
}

/**
 * Closes the character popup in the user interface.
 * This function applies a fade-out transition effect to the popup and hides it
 * after the transition is complete.
 *
 * @return {void} This function does not return a value.
 */
export function closeCharacterPopup() {
    $('#character_popup').transition({
        opacity: 0,
        duration: 125,
        easing: 'ease-in-out',
    });
    setTimeout(function () {
        $('#acm_character_popup').css('display', 'none');
    }, 125);
}


/**
 * Updates the avatar of the currently selected character.
 * This function allows the user to upload a new avatar image, optionally crop it,
 * and then update the avatar in the application. The updated avatar is displayed
 * in the user interface and saved in the data model.
 *
 * @async
 * @param {HTMLInputElement} input - The file input element containing the uploaded image file.
 * @return {Promise<void>} A promise that resolves when the avatar update process is complete.
 */
export async function update_avatar(input){
    if (input.files && input.files[0]) {
        let crop_data = undefined;
        const file = input.files[0];
        const fileData = await getBase64Async(file);

        if (!power_user.never_resize_avatars) {
            // Display a cropping dialog to the user
            const dlg = callGenericPopup('Set the crop position of the avatar image', POPUP_TYPE.CROP, '', { cropImage: fileData });
            const croppedImage = await dlg.show();

            if (!croppedImage) {
                return; // Exit if the user cancels the cropping dialog
            }
            crop_data = dlg.cropData;

            try {
                // Replace the avatar with the cropped image
                await replaceAvatar(file, getIdByAvatar(selectedChar), crop_data);
                // Update the avatar image in the UI with a cache-busting timestamp
                const newImageUrl = getThumbnailUrl('avatar', selectedChar) + '&t=' + new Date().getTime();
                $('#avatar_img').attr('src', newImageUrl);
                $(`[data-avatar="${selectedChar}"]`).attr('src', newImageUrl);
            } catch {
                toast.error("Something went wrong."); // Display an error message if the update fails
            }
        } else {
            try {
                // Replace the avatar without cropping
                await replaceAvatar(file, getIdByAvatar(selectedChar));
                // Update the avatar image in the UI with a cache-busting timestamp
                const newImageUrl = getThumbnailUrl('avatar', selectedChar) + '&t=' + new Date().getTime();
                $('#avatar_img').attr('src', newImageUrl);
                $(`[data-avatar="${selectedChar}"]`).attr('src', newImageUrl);
            } catch {
                toast.error("Something went wrong."); // Display an error message if the update fails
            }
        }
    }
}

/**
 * Adds a new alternate greeting section to the DOM within the 'altGreetings_content' container.
 * Each new section is dynamically created and appended to the container, including appropriate event listeners.
 *
 * @return {void} Does not return anything.
 */
export function addAltGreeting(){
    const drawerContainer = document.getElementById('altGreetings_content');
    // Determine the new greeting index
    const greetingIndex = drawerContainer.getElementsByClassName('inline-drawer').length + 1;
    // Create the new inline-drawer block
    const altGreetingDiv = document.createElement('div');
    altGreetingDiv.className = 'inline-drawer';
    altGreetingDiv.innerHTML = `<div id="altGreetDrawer${greetingIndex}" class="altgreetings-drawer-toggle inline-drawer-header inline-drawer-design">
                    <div style="display: flex;flex-grow: 1;">
                        <strong class="drawer-header-item">
                            Greeting #
                            <span class="greeting_index">${greetingIndex}</span>
                        </strong>
                        <span class="tokens_count drawer-header-item">Tokens: 0</span>
                    </div>
                    <div class="altGreetings_buttons">
                        <i class="inline-drawer-icon fa-solid fa-circle-minus"></i>
                        <i class="inline-drawer-icon idit fa-solid fa-circle-chevron-down down"></i>
                    </div>
                </div>
                <div class="inline-drawer-content">
                    <textarea class="altGreeting_zone autoSetHeight"></textarea>
                </div>
            </div>`;
    // Add the new inline-drawer block
    $('#chicken').empty();
    drawerContainer.appendChild(altGreetingDiv);
    // Add the event on the textarea
    altGreetingDiv.querySelector(`.altGreeting_zone`).addEventListener('input', (event) => {
        saveAltGreetings(event);
    });
    // Save it
    saveAltGreetings();
}

/**
 * Deletes an alternative greeting block, updates the indices of remaining blocks,
 * and ensures a proper UI display for the alternative greetings section.
 *
 * @param {number} index The index of the alternative greeting block to be deleted.
 * @param {Object} inlineDrawer The DOM element representing the alternative greeting block to remove.
 * @return {void} The function does not return a value.
 */
export function delAltGreeting(index, inlineDrawer){
    // Delete the AltGreeting block
    inlineDrawer.remove();
    // Update the others AltGreeting blocks
    const $altGreetingsToggle = $('.altgreetings-drawer-toggle');
    if ($('div[id^="altGreetDrawer"]').length === 0) {
        $('#altGreetings_content').html('<span id="chicken">Nothing here but chickens!!</span>');
    }
    else {
        $altGreetingsToggle.each(function() {
            const currentIndex = parseInt($(this).find('.greeting_index').text());
            if (currentIndex > index) {
                $(this).find('.greeting_index').text(currentIndex - 1);
                $(this).attr('id', `altGreetDrawer${currentIndex - 1}`);
            }
        });
    }
    // Save it
    saveAltGreetings();
}

/**
 * Generates and returns HTML content for alternative greetings based on the provided items.
 *
 * @param {string[]} item - An array of strings where each string represents a greeting.
 * @return {string} The generated HTML as a string. If the `item` array is empty, a placeholder HTML string is returned.
 */
async function displayAltGreetings(item) {
    let altGreetingsHTML = '';
    if (!item || item.length === 0) {
        return '<span id="chicken">Nothing here but chickens!!</span>';
    } else {
        for (let i = 0; i < item.length; i++) {
            let greetingNumber = i + 1;
            altGreetingsHTML += `<div class="inline-drawer">
                <div id="altGreetDrawer${greetingNumber}" class="altgreetings-drawer-toggle inline-drawer-header inline-drawer-design">
                    <div style="display: flex;flex-grow: 1;">
                        <strong class="drawer-header-item">
                            Greeting #
                            <span class="greeting_index">${greetingNumber}</span>
                        </strong>
                        <span class="tokens_count drawer-header-item">Tokens: ${await getTokenCountAsync(substituteParams(item[i]))}</span>
                    </div>
                    <div class="altGreetings_buttons">
                        <i class="inline-drawer-icon fa-solid fa-circle-minus"></i>
                        <i class="inline-drawer-icon idit fa-solid fa-circle-chevron-down down"></i>
                    </div>
                </div>
                <div class="inline-drawer-content">
                    <textarea class="altGreeting_zone autoSetHeight">${item[i]}</textarea>
                </div>
            </div>`;
        }
        return altGreetingsHTML;
    }
}
