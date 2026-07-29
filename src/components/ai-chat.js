import { messageFormatting } from '/script.js';
import { createGenerationParameters, getChatCompletionModel, getStreamingReply, oai_settings } from '/scripts/openai.js';
import { getEventSourceStream } from '/scripts/sse-stream.js';
import { characters, generateRaw, getRequestHeaders, tagList, tagMap } from "../constants/context.js";
import { DEFAULT_ASK_AI_PROMPT, selectedChar, selectedGroupId } from "../constants/settings.js";
import { getIdByAvatar } from "../utils.js";
import { getSetting, updateSetting } from "../services/settings-service.js";

const getContext = SillyTavern.getContext;

const DEFAULT_RECENT_QUESTIONS_LIMIT = 5;
const MAX_CONFIGURABLE_RECENT_QUESTIONS = 50;

// ===== ASK AI MINI-CHAT STATE =====
// Not persisted anywhere: cleared whenever the selected character changes or is deselected.
let conversation = [];
let isGenerating = false;
let generationToken = 0;
let activeAbortController = null;

function escapeHtml(text) {
    return String(text ?? '').replace(/[&<>'"]/g, (match) => {
        switch (match) {
            case '&': return '&amp;';
            case '<': return '&lt;';
            case '>': return '&gt;';
            case "'": return '&#39;';
            case '"': return '&quot;';
            default: return match;
        }
    });
}

function isAiChatAvailable() {
    return Boolean(selectedChar) && !selectedGroupId;
}

function getSelectedCharacterObject() {
    if (!isAiChatAvailable()) {
        return null;
    }
    const index = getIdByAvatar(selectedChar);
    return index !== undefined ? characters[index] : null;
}

function buildCharacterSummary(char) {
    const tags = (tagMap[char.avatar] || [])
        .map(tagId => tagList.find(tag => String(tag?.id) === String(tagId))?.name)
        .filter(Boolean);

    return {
        name: char.name,
        description: char.description,
        personality: char.personality,
        scenario: char.scenario,
        first_message: char.first_mes,
        alternate_greetings: Array.isArray(char.data?.alternate_greetings) ? char.data.alternate_greetings : [],
        message_examples: char.mes_example,
        creator: char.data?.creator || '',
        creator_notes: char.data?.creator_notes || char.creatorcomment || '',
        character_version: char.data?.character_version || '',
        tags,
    };
}

function generateQuestionId() {
    return crypto.randomUUID();
}

function getRecentQuestions() {
    return Array.isArray(getSetting('askAiRecentQuestions')) ? getSetting('askAiRecentQuestions') : [];
}

function getRecentQuestionsLimit() {
    const configuredLimit = Number.parseInt(getSetting('askAiRecentQuestionsLimit'), 10);
    if (!Number.isFinite(configuredLimit)) {
        return DEFAULT_RECENT_QUESTIONS_LIMIT;
    }
    return Math.max(0, Math.min(MAX_CONFIGURABLE_RECENT_QUESTIONS, configuredLimit));
}

function findOldestUnpinnedQuestionIndex(questions) {
    let oldestIndex = -1;
    for (let i = 0; i < questions.length; i++) {
        if (questions[i].pinned) continue;
        if (oldestIndex === -1 || Number(questions[i].updatedAt || 0) < Number(questions[oldestIndex].updatedAt || 0)) {
            oldestIndex = i;
        }
    }
    return oldestIndex;
}

function pruneRecentQuestions(questions, limit) {
    const pruned = [...questions];
    while (pruned.length > limit) {
        const oldestIndex = findOldestUnpinnedQuestionIndex(pruned);
        if (oldestIndex === -1) break;
        pruned.splice(oldestIndex, 1);
    }
    return pruned;
}

/**
 * Records the first question of a new mini-chat conversation into the shared "recent
 * questions" quick-access list (shown as buttons in an empty chat), or bumps it to most
 * recent if an identical question (case-insensitive) is already stored.
 *
 * At most the configured number of entries are kept. When full, the oldest non-pinned entry is
 * evicted to make room; if all entries are pinned, the new question is simply not recorded.
 */
function recordOrBumpRecentQuestion(text) {
    const normalized = String(text || '').trim();
    if (!normalized) {
        return;
    }

    const limit = getRecentQuestionsLimit();
    if (limit === 0) {
        return;
    }

    const questions = [...getRecentQuestions()];
    const matchIndex = questions.findIndex(q => String(q.text || '').trim().toLowerCase() === normalized.toLowerCase());

    if (matchIndex !== -1) {
        questions[matchIndex] = { ...questions[matchIndex], updatedAt: Date.now() };
    } else {
        while (questions.length >= limit) {
            const evictIndex = findOldestUnpinnedQuestionIndex(questions);
            if (evictIndex === -1) {
                return; // every slot is pinned - no room for a new question
            }
            questions.splice(evictIndex, 1);
        }
        questions.push({ id: generateQuestionId(), text: normalized, pinned: false, updatedAt: Date.now() });
    }

    questions.sort((a, b) => b.updatedAt - a.updatedAt);
    updateSetting('askAiRecentQuestions', questions);
}

function toggleRecentQuestionPinned(id) {
    const questions = getRecentQuestions().map(q => q.id === id ? { ...q, pinned: !q.pinned } : q);
    updateSetting('askAiRecentQuestions', questions);
    renderMessages();
}

function renderRecentQuestionsHtml() {
    const questions = getRecentQuestions();
    if (!questions.length) {
        return '<div class="acm-ai-chat-recent-empty">Ask a question to get started. Your last few questions will show up here for quick reuse.</div>';
    }

    const items = questions.map(q => {
        const pinTitle = q.pinned ? 'Unpin (allow this to be replaced later)' : 'Pin so this is never removed';
        return `
            <div class="acm-ai-chat-recent-item">
                <div class="menu_button fa-solid fa-thumbtack faSmallFontSquareFix acm-ai-chat-recent-pin${q.pinned ? ' pinned' : ''}" data-question-id="${escapeHtml(q.id)}" title="${pinTitle}"></div>
                <div class="menu_button acm-ai-chat-recent-btn" data-question-id="${escapeHtml(q.id)}" title="${escapeHtml(q.text)}">${escapeHtml(q.text)}</div>
            </div>`;
    }).join('');

    return `<div class="acm-ai-chat-recent-list">${items}</div>`;
}

/**
 * Builds an isolated chat-completion-style message array for the mini-chat: a system
 * message carrying only the selected character's data, followed by our own Q&A turns.
 * This never touches the main chat's history/character/world info.
 */
function buildRequestMessages(char) {
    const jsonData = JSON.stringify(buildCharacterSummary(char));
    const promptTemplate = typeof getSetting('askAiPrompt') === 'string' ? getSetting('askAiPrompt') : DEFAULT_ASK_AI_PROMPT;
    const systemPrompt = promptTemplate.split('{{characterData}}').join(jsonData);

    const messages = [{ role: 'system', content: systemPrompt }];
    for (const turn of conversation) {
        if (!turn.text) continue; // skips the empty in-progress assistant placeholder
        messages.push({ role: turn.role, content: turn.text });
    }
    return messages;
}

function renderMessages({ scrollToBottom = false } = {}) {
    const $messages = $('#acm_ai_chat_messages');
    if (!$messages.length) return;

    // Quick-access "recent questions" buttons only make sense before this mini-chat has
    // any messages yet - once a question is sent they give way to the actual conversation.
    if (conversation.length === 0) {
        $messages.html(renderRecentQuestionsHtml());
        return;
    }

    const char = getSelectedCharacterObject();
    const charName = char?.name || '';

    const html = conversation.map(turn => {
        if (turn.role === 'assistant') {
            const streamingClass = turn.streaming ? ' acm-ai-chat-streaming' : '';
            // Same rendering path as the Greetings preview in character details.
            const formatted = messageFormatting(turn.text, charName, false, false, 0);
            return `<div class="mes acm-ai-chat-message-assistant${streamingClass}"><div class="mes_block"><div class="mes_text">${formatted}</div></div></div>`;
        }
        return `<div class="acm-ai-chat-message acm-ai-chat-message-user">${escapeHtml(turn.text)}</div>`;
    }).join('');

    $messages.html(html);

    if (scrollToBottom) {
        $messages.scrollTop($messages[0].scrollHeight);
    }
}

function updateSendButtonUi() {
    const $send = $('#acm_ai_chat_send');
    $send.toggleClass('acm-ai-chat-stop', isGenerating);
    $send.toggleClass('fa-paper-plane', !isGenerating);
    $send.toggleClass('fa-stop', isGenerating);
    $send.attr('title', isGenerating ? 'Stop generating' : 'Send message (Enter)');
}

function renderSettingsQuestions() {
    const $container = $('#acm_ai_chat_settings_questions').empty();
    const questions = getRecentQuestions();

    if (!questions.length) {
        $container.append($('<div>').addClass('acm-ai-chat-settings-empty').text('No remembered starting messages.'));
        return;
    }

    questions.forEach((question) => {
        const $row = $('<div>')
            .addClass('acm-ai-chat-settings-question')
            .attr('data-question-id', String(question.id || ''))
            .attr('data-updated-at', Number(question.updatedAt || 0));
        const $pinLabel = $('<label>').addClass('acm-ai-chat-settings-question-pin');
        const $pin = $('<input>')
            .addClass('acm-ai-chat-settings-question-pinned')
            .attr('type', 'checkbox')
            .prop('checked', Boolean(question.pinned));
        const $text = $('<input>')
            .addClass('text_pole acm-ai-chat-settings-question-text')
            .attr('type', 'text')
            .attr('aria-label', 'Remembered starting message')
            .val(String(question.text || ''));
        const $remove = $('<div>')
            .addClass('menu_button fa-solid fa-trash acm-ai-chat-settings-question-remove')
            .attr('title', 'Remove remembered message');

        $pinLabel.append($pin, $('<span>').text('Pinned'));
        $row.append($pinLabel, $text, $remove);
        $container.append($row);
    });
}

function openAiChatSettings() {
    $('#acm_ai_chat_prompt').val(typeof getSetting('askAiPrompt') === 'string' ? getSetting('askAiPrompt') : DEFAULT_ASK_AI_PROMPT);
    $('#acm_ai_chat_recent_limit').val(getRecentQuestionsLimit());
    renderSettingsQuestions();
    const modal = document.getElementById('acm_ai_chat_settings_modal');
    modal?.showModal();
    $(modal).addClass('visible');
    $('#acm_ai_chat_prompt').trigger('focus');
}

function closeAiChatSettings() {
    const modal = document.getElementById('acm_ai_chat_settings_modal');
    $(modal).removeClass('visible');
    modal?.close();
}

function saveAiChatSettings() {
    const requestedLimit = Number.parseInt($('#acm_ai_chat_recent_limit').val(), 10);
    const limit = Number.isFinite(requestedLimit)
        ? Math.max(0, Math.min(MAX_CONFIGURABLE_RECENT_QUESTIONS, requestedLimit))
        : DEFAULT_RECENT_QUESTIONS_LIMIT;
    const originalQuestions = getRecentQuestions();
    const questions = [];

    $('#acm_ai_chat_settings_questions .acm-ai-chat-settings-question').each(function () {
        const text = String($(this).find('.acm-ai-chat-settings-question-text').val() || '').trim();
        if (!text) return;

        const id = String($(this).attr('data-question-id') || generateQuestionId());
        const original = originalQuestions.find(question => String(question.id) === id);
        questions.push({
            id,
            text,
            pinned: $(this).find('.acm-ai-chat-settings-question-pinned').prop('checked'),
            updatedAt: Number($(this).attr('data-updated-at')) || Number(original?.updatedAt) || Date.now(),
        });
    });

    const prunedQuestions = pruneRecentQuestions(questions, limit).sort((a, b) => b.updatedAt - a.updatedAt);
    updateSetting('askAiPrompt', String($('#acm_ai_chat_prompt').val() ?? ''));
    updateSetting('askAiRecentQuestionsLimit', limit);
    updateSetting('askAiRecentQuestions', prunedQuestions);
    closeAiChatSettings();
    renderMessages();
}

function updateAvailabilityUi() {
    const available = isAiChatAvailable();
    $('#acm_ai_chat_container').toggleClass('acm-ai-chat-unavailable', !available);
    $('#acm_ai_chat_input').prop('disabled', !available || isGenerating);
    $('#acm_ai_chat_send').toggleClass('disabled', !available);
    updateSendButtonUi();
}

function autoResizeChatInput() {
    const el = document.getElementById('acm_ai_chat_input');
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
}

function abortActiveGeneration() {
    if (activeAbortController) {
        activeAbortController.abort();
        activeAbortController = null;
    }
}

/**
 * Resets the Ask AI mini-chat: clears the conversation and aborts any in-flight generation.
 * Called whenever the selected character changes or is deselected, so a stale answer never
 * lingers on screen for the wrong character.
 */
export function resetAiChat() {
    generationToken++;
    abortActiveGeneration();
    isGenerating = false;
    conversation = [];
    renderMessages();
    updateAvailabilityUi();
}

/**
 * Streams a reply from SillyTavern's own chat-completions backend proxy
 * (`/api/backends/chat-completions/generate`), calling it directly instead of going through
 * Generate() so the request only ever contains the isolated messages we build ourselves -
 * never the main chat's history/character/world info.
 *
 * @param {object[]} messages Isolated chat-style messages (system + our own Q&A turns only).
 * @param {AbortSignal} signal Abort signal to cancel the request/stream.
 * @param {(text: string) => void} onDelta Called with the cumulative text on every chunk.
 * @returns {Promise<string>} The final accumulated text.
 */
async function streamChatCompletion(messages, signal, onDelta) {
    const model = getChatCompletionModel(oai_settings);
    const { generate_data: generateData } = await createGenerationParameters(oai_settings, model, 'quiet', messages);
    // 'quiet' forces stream off (and disables tool calls/multi-swipe, which we also want) -
    // force it back on since this feature is specifically about watching the reply stream in.
    generateData.stream = true;

    const response = await fetch('/api/backends/chat-completions/generate', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify(generateData),
        signal,
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`Chat completion request failed (${response.status}): ${errorText.slice(0, 300)}`);
    }

    const eventStream = getEventSourceStream();
    response.body.pipeThrough(eventStream);
    const reader = eventStream.readable.getReader();

    const state = { reasoning: '', images: [], signature: '', toolSignatures: {} };
    let text = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const rawData = value.data;
        if (rawData === '[DONE]') break;

        const parsed = JSON.parse(rawData);
        text += getStreamingReply(parsed, state);
        onDelta(text);
    }

    return text;
}

async function sendAiChatMessage(presetText) {
    if (isGenerating) return;

    const char = getSelectedCharacterObject();
    if (!char) return;

    const $input = $('#acm_ai_chat_input');
    const userText = String(presetText ?? $input.val() ?? '').trim();
    if (!userText) return;

    const isFirstQuestion = conversation.length === 0;

    $input.val('');
    autoResizeChatInput();

    if (isFirstQuestion) {
        recordOrBumpRecentQuestion(userText);
    }

    conversation.push({ role: 'user', text: userText });
    const assistantTurn = { role: 'assistant', text: '', streaming: true };
    conversation.push(assistantTurn);
    renderMessages({ scrollToBottom: true });

    const myToken = ++generationToken;
    isGenerating = true;
    updateAvailabilityUi();

    const messages = buildRequestMessages(char);
    const mainApi = String(getContext().mainApi || '');
    const abortController = new AbortController();
    activeAbortController = abortController;

    let fullText = '';
    let hadError = false;
    let wasAborted = false;
    try {
        if (mainApi === 'openai') {
            fullText = await streamChatCompletion(messages, abortController.signal, (text) => {
                if (myToken !== generationToken) return;
                assistantTurn.text = text;
                renderMessages({ scrollToBottom: true });
            });
        } else {
            // Text-completion backends (kobold/textgenerationwebui/novel) aren't wired up for
            // real streaming here yet, so we fall back to a single isolated non-streamed request.
            fullText = String(await generateRaw({ prompt: messages, quietToLoud: false }) || '');
        }
        fullText = fullText.trim();
    } catch (error) {
        if (abortController.signal.aborted) {
            wasAborted = true;
        } else {
            console.error('Ask AI generation failed', error);
            hadError = true;
        }
    } finally {
        if (activeAbortController === abortController) {
            activeAbortController = null;
        }
    }

    // A reset or an explicit stop happened while this request was in flight.
    if (myToken !== generationToken) {
        return;
    }

    if (wasAborted) {
        assistantTurn.text = assistantTurn.text || '(stopped)';
    } else if (hadError || !fullText) {
        assistantTurn.text = hadError ? 'Something went wrong while generating a response.' : '(no response)';
    } else {
        assistantTurn.text = fullText;
    }

    assistantTurn.streaming = false;
    isGenerating = false;
    renderMessages({ scrollToBottom: true });
    updateAvailabilityUi();
    $input.trigger('focus');
}

function stopAiChatGeneration() {
    abortActiveGeneration();
    generationToken++; // invalidate any in-flight promise chain immediately
    isGenerating = false;

    const lastTurn = conversation[conversation.length - 1];
    if (lastTurn?.role === 'assistant') {
        lastTurn.streaming = false;
        if (!lastTurn.text) {
            lastTurn.text = '(stopped)';
        }
    }

    renderMessages({ scrollToBottom: true });
    updateAvailabilityUi();
}

function handleSendOrStop() {
    if (isGenerating) {
        stopAiChatGeneration();
        return;
    }
    sendAiChatMessage();
}

/**
 * Applies visibility for the Ask AI panel. It only ever renders alongside the side panel.
 * @param {boolean} askAiEnabled
 */
export function applyAskAiPanelMode(askAiEnabled) {
    const wrapper = document.querySelector('.list-character-wrapper');
    wrapper?.classList.toggle('acm-ask-ai-enabled', !!askAiEnabled);
    updateAvailabilityUi();
}

/**
 * Initializes event handlers for the Ask AI mini-chat panel.
 */
export function initializeAiChatEvents() {
    $(document).on('click', '#acm_ai_chat_send', handleSendOrStop);
    $(document).on('click', '#acm_ai_chat_settings', openAiChatSettings);
    $(document).on('click', '#acm_ai_chat_settings_close, #acm_ai_chat_settings_cancel', closeAiChatSettings);
    $(document).on('click', '#acm_ai_chat_settings_save', saveAiChatSettings);
    $(document).on('click', '.acm-ai-chat-settings-question-remove', function () {
        $(this).closest('.acm-ai-chat-settings-question').remove();
        if (!$('#acm_ai_chat_settings_questions .acm-ai-chat-settings-question').length) {
            $('#acm_ai_chat_settings_questions').append($('<div>').addClass('acm-ai-chat-settings-empty').text('No remembered starting messages.'));
        }
    });
    $(document).on('click', '#acm_ai_chat_settings_modal', function (event) {
        if (event.target === this) closeAiChatSettings();
    });
    $(document).on('cancel', '#acm_ai_chat_settings_modal', function (event) {
        event.preventDefault();
        closeAiChatSettings();
    });
    $(document).on('input', '#acm_ai_chat_input', autoResizeChatInput);

    $(document).on('click', '.acm-ai-chat-recent-btn', function () {
        const id = $(this).data('question-id');
        const question = getRecentQuestions().find(q => q.id === id);
        if (question) {
            sendAiChatMessage(question.text);
        }
    });

    $(document).on('click', '.acm-ai-chat-recent-pin', function (event) {
        event.stopPropagation();
        toggleRecentQuestionPinned($(this).data('question-id'));
    });

    // Bound directly on the textarea so Ctrl/Cmd+Enter can stop core's document-level
    // shortcut while retaining the textarea's native newline behavior.
    const inputEl = document.getElementById('acm_ai_chat_input');
    inputEl?.addEventListener('keydown', function (event) {
        if (event.key !== 'Enter') return;

        event.stopPropagation();
        if (event.ctrlKey || event.metaKey) return;

        event.preventDefault();
        handleSendOrStop();
    });

    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && $('#acm_ai_chat_settings_modal').hasClass('visible')) {
            event.preventDefault();
            event.stopPropagation();
            closeAiChatSettings();
        }
    });

    updateAvailabilityUi();
}
