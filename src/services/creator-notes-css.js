import { formatCreatorNotes } from '../../../../../../scripts/chats.js';

/**
 * Applies creator notes display using the main app's formatCreatorNotes renderer.
 * Hides the raw textarea and shows the rendered HTML in the display container.
 * Re-scopes any sanitized CSS from the main app's #creator_notes_spoiler prefix
 * to our actual container element so scoped styles work correctly.
 *
 * @param {string} creatorNotesContent - The raw creator notes content
 * @param {jQuery} $textareaElement - The textarea element (hidden when content is shown)
 * @param {jQuery} $displayContainer - The display container for rendered HTML
 * @param {string} [avatarId] - The character's avatar filename (used to check per-character style preference)
 * @returns {void}
 */
export function applyCreatorNotesDisplay(creatorNotesContent, $textareaElement, $displayContainer, avatarId = '') {
    if (!creatorNotesContent) {
        $textareaElement.val('');
        $displayContainer.hide();
        return;
    }

    let html = formatCreatorNotes(creatorNotesContent, avatarId);

    // formatCreatorNotes scopes sanitized CSS with "#creator_notes_spoiler ".
    // Re-scope those selectors to our actual container so scoped styles apply correctly.
    const containerId = $displayContainer.attr('id');
    if (containerId) {
        html = html.replaceAll('#creator_notes_spoiler ', `#${containerId} `);
    }

    $textareaElement.hide();
    $displayContainer.html(html).scrollTop(0).show();
}
