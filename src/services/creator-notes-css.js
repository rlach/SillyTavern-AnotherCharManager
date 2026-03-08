import { formatCreatorNotes } from '../../../../../../scripts/chats.js';

/**
 * Renders text with the same HTML/CSS pipeline as creator notes.
 *
 * @param {string} content - Raw content to render
 * @param {JQuery<HTMLElement>} $container - Destination container
 * @param {string} [avatarId] - Character avatar for style lookups
 * @returns {void}
 */
export function renderFormattedNotes(content, $container, avatarId = '') {
    const raw = String(content || '');
    if (!raw.trim()) {
        $container.text('No data').show();
        return;
    }

    let html = formatCreatorNotes(raw, avatarId);

    // Re-scope CSS selectors emitted by formatCreatorNotes to this container id.
    const containerId = $container.attr('id');
    if (containerId) {
        html = html.replaceAll('#creator_notes_spoiler ', `#${containerId} `);
    }

    $container.html(html).scrollTop(0).show();
    $container.find('img').each(function () {
        const inlinePosition = String(this.style.position || '').trim().toLowerCase();
        if (inlinePosition === 'fixed') {
            return;
        }

        const computedPosition = String(window.getComputedStyle(this).position || '').trim().toLowerCase();
        if (computedPosition === 'fixed') {
            return;
        }

        this.style.setProperty('max-width', '100%', 'important');
    });
}

/**
 * Applies creator notes display with HTML rendering while keeping textarea data for fullscreen.
 *
 * @param {string} creatorNotesContent - The raw creator notes content
 * @param {JQuery<HTMLElement>} $textareaElement - Hidden textarea used as source for fullscreen/edit flows
 * @param {JQuery<HTMLElement>} $displayContainer - Rendered HTML display container
 * @param {string} [avatarId] - Character avatar id
 * @returns {void}
 */
export function applyCreatorNotesDisplay(creatorNotesContent, $textareaElement, $displayContainer, avatarId = '') {
    const raw = String(creatorNotesContent || '');

    // Keep raw source in textarea for existing logic (tokens/fullscreen proxy).
    $textareaElement.val(raw).hide();

    renderFormattedNotes(raw, $displayContainer, avatarId);
}
