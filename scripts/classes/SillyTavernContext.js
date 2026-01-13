// SillyTavernContext.js
export class SillyTavernContext {
    constructor() {
        this.ctx = SillyTavern.getContext();
    }

    // ---- data ----
    get power_user() { return this.ctx.powerUserSettings; }
    get characters() { return this.ctx.characters; }
    get tagMap() { return this.ctx.tagMap; }
    get tagList() { return this.ctx.tags; }
    get characterId() { return this.ctx.characterId; }
    get menuType() { return this.ctx.menuType; }
    get extensionSettings() { return this.ctx.extensionSettings; }
    get event_types() { return this.ctx.event_types; }
    get POPUP_TYPE() { return this.ctx.POPUP_TYPE; }
    get saveSettingsDebounced() { return this.ctx.saveSettingsDebounced; }
    get eventSource() { return this.ctx.eventSource; }

    // ---- functions ----
    getCharacters() {
        return this.ctx.getCharacters();
    }

    unshallowCharacter(char) {
        return this.ctx.unshallowCharacter(char);
    }

    selectCharacterById(id) {
        return this.ctx.selectCharacterById(id);
    }

    getTokenCountAsync(...args) {
        return this.ctx.getTokenCountAsync(...args);
    }

    getThumbnailUrl(...args) {
        return this.ctx.getThumbnailUrl(...args);
    }

    callGenericPopup(...args) {
        return this.ctx.callGenericPopup(...args);
    }

    renderExtensionTemplateAsync(...args) {
        return this.ctx.renderExtensionTemplateAsync(...args);
    }

    t(key, params) {
        return this.ctx.t(key, params);
    }

    substituteParams(...args) {
        return this.ctx.substituteParams(...args);
    }

    getRequestHeaders(...args) {
        return this.ctx.getRequestHeaders(...args);
    }
}
