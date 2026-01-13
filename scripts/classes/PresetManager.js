import {
    acmCreateTagInput,
    displayTag,
} from '../components/tags.js';

export class PresetManager {
    constructor(events, settings, st) {
        this.events = events;
        this.settings = settings;
        this.st = st;
    }
    registerListeners(){
        $(document).on('change', '#preset_selector',  () => {
            const newPreset = $(this).find(':selected').data('preset');
            this.displayPresetName(newPreset);
            this.printCategoriesList(newPreset);
        });

        // Trigger on a click on the rename preset button
        $(document).on('click', '.preset_rename', async () => {
            const selectedPreset = $('#preset_selector option:selected').data('preset');
            const newPresetName = await this.st.callGenericPopup('<h3>New preset name:</h3>', this.st.POPUP_TYPE.INPUT, this.getPreset(selectedPreset).name);
            if (newPresetName && newPresetName.trim() !== '') {
                this.renamePreset(selectedPreset, newPresetName);
            }
        });

        // Add new custom category to active preset
        $(document).on('click', '.cat_view_create', async () => {
            const newCatName = await this.st.callGenericPopup('<h3>Category name:</h3>', this.st.POPUP_TYPE.INPUT, '');
            if (newCatName && newCatName.trim() !== '') {
                const selectedPreset = $('#preset_selector option:selected').data('preset');
                this.addCategory(selectedPreset, newCatName);
            }
        });

        // Trigger on a click on the delete category button
        $(document).on('click', '.cat_delete',  () => {
            const selectedPreset = $('#preset_selector option:selected').data('preset');
            const selectedCat = $(this).closest('[data-catid]').data('catid');
            this.removeCategory(selectedPreset, selectedCat);
        });

        // Trigger on a click on the rename category button
        $(document).on('click', '.cat_rename', async () => {
            const selectedPreset = $('#preset_selector option:selected').data('preset');
            const selectedCat = $(this).closest('[data-catid]').data('catid');
            const newCatName = await this.st.callGenericPopup('<h3>New category name:</h3>', this.st.POPUP_TYPE.INPUT, this.getCategory(selectedPreset, selectedCat).name);
            if (newCatName && newCatName.trim() !== '') {
                this.renameCategory(selectedPreset, selectedCat, newCatName);
            }
        });

        // Trigger on a click on the add tag button in a category
        $(document).on('click', '.addCatTag',  () => {
            const selectedCat = $(this).closest('[data-catid]').data('catid');
            this.toggleTagButton($(this), selectedCat);
        });

        // Trigger on a click on the minus tag button in a category
        $(document).on('click', '.cancelCatTag',  () => {
            const selectedCat = $(this).closest('[data-catid]').data('catid');
            this.toggleTagButton($(this), selectedCat);
        });

        $(document).on('click', '.tag_cat_remove',  () => {
            const selectedPreset = $('#preset_selector option:selected').data('preset');
            const selectedCat = $(this).closest('[data-catid]').data('catid');
            const selectedTag = $(this).closest('[data-tagid]').data('tagid');
            this.removeTagFromCategory(selectedPreset, selectedCat, selectedTag);
            $(this).closest('[data-tagid]').remove();
        });
    }

    /**
     * Gets a specific preset by index
     * @param {number} presetIndex - The index of the preset
     * @returns {Object} - The preset object
     */
    getPreset(presetIndex) {
        if (presetIndex < 0 || presetIndex >= this.settings.getSetting('dropdownPresets').length) {
            throw new Error('Invalid preset index');
        }
        return { ...this.settings.getSetting('dropdownPresets')[presetIndex] };
    }

    /**
     * Gets a specific category from a preset
     * @param {number} presetIndex - The index of the preset
     * @param {number} categoryIndex - The index of the category
     * @returns {Object} - The category object
     */
    getCategory(presetIndex, categoryIndex) {
        const preset = this.getPreset(presetIndex);
        if (categoryIndex < 0 || categoryIndex >= preset.categories.length) {
            throw new Error('Invalid category index');
        }
        return { ...preset.categories[categoryIndex] };
    }

    /**
     * Updates a specific preset name
     * @param {number} presetIndex - The index of the preset to update
     * @param {string} name - The new name for the preset
     */
    updatePresetName(presetIndex, name) {
        if (presetIndex < 0 || presetIndex >= this.settings.getSetting('dropdownPresets').length) {
            throw new Error('Invalid preset index');
        }
        if (typeof name !== 'string' || name.trim() === '') {
            throw new Error('Preset name must be a non-empty string');
        }
        const updatedPresets = [...this.settings.getSetting('dropdownPresets')];
        updatedPresets[presetIndex] = {
            ...updatedPresets[presetIndex],
            name: name,
        };
        this.settings.updateSetting('dropdownPresets', updatedPresets);
    }

    /**
     * Updates all categories of a specific preset
     * @param {number} presetIndex - The index of the preset
     * @param {Array} categories - The new array of categories
     */
    updatePresetCategories(presetIndex, categories) {
        if (presetIndex < 0 || presetIndex >= this.settings.getSetting('dropdownPresets').length) {
            throw new Error('Invalid preset index');
        }
        if (!Array.isArray(categories)) {
            throw new Error('Categories must be an array');
        }
        if (!categories.every(category =>
            typeof category === 'object' &&
            typeof category.name === 'string' &&
            Array.isArray(category.tags),
        )) {
            throw new Error('Invalid category format. Each category must have a name (string) and tags (array)');
        }
        const updatedPresets = [...this.settings.getSetting('dropdownPresets')];
        updatedPresets[presetIndex] = {
            ...updatedPresets[presetIndex],
            categories: [...categories],
        };
        this.settings.updateSetting('dropdownPresets', updatedPresets);
    }

    /**
     * Adds a new category to a preset
     * @param {number} presetIndex - The index of the preset
     * @param {string} name - The name of the new category
     */
    addPresetCategory(presetIndex, name) {
        if (typeof name !== 'string' || name.trim() === '') {
            throw new Error('Category name must be a non-empty string');
        }
        const updatedPresets = [...this.settings.getSetting('dropdownPresets')];
        updatedPresets[presetIndex] = {
            ...updatedPresets[presetIndex],
            categories: [...updatedPresets[presetIndex].categories, { name, tags: [] }],
        };
        this.settings.updateSetting('dropdownPresets', updatedPresets);
    }

    /**
     * Updates a specific category in a preset
     * @param {number} presetIndex - The index of the preset
     * @param {number} categoryIndex - The index of the category
     * @param {string} name - The new name for the category
     */
    updateCategoryName(presetIndex, categoryIndex, name) {
        const preset = this.getPreset(presetIndex);
        if (categoryIndex < 0 || categoryIndex >= preset.categories.length) {
            throw new Error('Invalid category index');
        }
        if (typeof name !== 'string' || name.trim() === '') {
            throw new Error('Category name must be a non-empty string');
        }
        const updatedPresets = [...this.settings.getSetting('dropdownPresets')];
        updatedPresets[presetIndex].categories[categoryIndex] = {
            ...updatedPresets[presetIndex].categories[categoryIndex],
            name,
        };
        this.settings.updateSetting('dropdownPresets', updatedPresets);
    }

    /**
     * Removes a category from a preset
     * @param {number} presetIndex - The index of the preset
     * @param {number} categoryIndex - The index of the category to remove
     */
    removePresetCategory(presetIndex, categoryIndex) {
        const preset = this.getPreset(presetIndex);
        if (categoryIndex < 0 || categoryIndex >= preset.categories.length) {
            throw new Error('Invalid category index');
        }
        const updatedPresets = [...this.settings.getSetting('dropdownPresets')];
        updatedPresets[presetIndex].categories = updatedPresets[presetIndex].categories
            .filter((_, index) => index !== categoryIndex);
        this.settings.updateSetting('dropdownPresets', updatedPresets);
    }

    /**
     * Adds a tag to a category
     * @param {number} presetIndex - The index of the preset
     * @param {number} categoryIndex - The index of the category
     * @param {number} tagId - The ID of the tag to add
     */
    addTagToCategory(presetIndex, categoryIndex, tagId) {
        const category = this.getCategory(presetIndex, categoryIndex);
        if (category.tags.includes(tagId)) {
            return; // Tag already exists in the category
        }
        const updatedPresets = [...this.settings.getSetting('dropdownPresets')];
        updatedPresets[presetIndex].categories[categoryIndex].tags.push(tagId);
        this.settings.updateSetting('dropdownPresets', updatedPresets);
    }

    /**
     * Removes a tag from a category
     * @param {number} presetIndex - The index of the preset
     * @param {number} categoryIndex - The index of the category
     * @param {number} tagId - The ID of the tag to remove
     */
    removeTagFromCategory(presetIndex, categoryIndex, tagId) {
        const updatedPresets = [...this.settings.getSetting('dropdownPresets')];
        updatedPresets[presetIndex].categories[categoryIndex].tags =
            updatedPresets[presetIndex].categories[categoryIndex].tags
                .filter(id => id !== tagId);
        this.settings.updateSetting('dropdownPresets', updatedPresets);
    }

    /**
     * Updates the names of the preset items in a dropdown menu by iterating through each dropdown item,
     * fetching the associated preset using its index, and setting its name as the item's text content.
     *
     * @return {void} This function does not return a value.
     */
    updateDropdownPresetNames() {
        $('#preset-submenu .dropdown-ui-item').each(() => {
            const presetIndex = $(this).data('preset');
            const newName = this.getPreset(presetIndex).name;
            if (newName) { $(this).text(newName); }
        });
    }

    /**
     * Manages the custom categories interface in the application.
     * This method creates and displays a popup allowing users to view, select, rename, or create custom categories.
     * It initializes a dropdown for preset categories, renders category controls,
     * and provides drag-and-drop reordering functionality.
     *
     * @return {Promise<void>} A Promise that resolves when the popup dialog is fully displayed and the operation is complete.
     */
    async manageCustomCategories(){
        const html = $(document.createElement('div'));
        html.attr('id', 'acm_custom_categories');
        const selectElement = $(`<select id="preset_selector" title="Preset Selector"></select>`);
        this.settings.getSetting('dropdownPresets').forEach((preset, index) => {
            selectElement.append(`<option data-preset="${index}">${preset.name}</option>`);
        });
        html.append(`
            <div class="title_restorable alignItemsBaseline">
                <h3>Custom Categories</h3>
                <div class="flex-container alignItemsBaseline">
                    ${selectElement.prop('outerHTML')}
                </div>
            </div>
             <div>
                <div style="display:flex;">
                     <h4 id="preset_name">${this.getPreset(0).name}</h4>
                     <i class="menu_button fa-solid fa-edit preset_rename" title="Rename preset"></i>
                </div>
                <div class="acm_catCreate">
                    <div class="menu_button menu_button_icon cat_view_create" title="Create a new category">
                        <i class="fa-solid fa-plus"></i>
                        <span data-i18n="Create">Create</span>
                    </div>
                    <small>
                        Drag handle to reorder.
                    </small>
                </div>
             </div>
        `);
        await this.st.callGenericPopup(html, this.st.POPUP_TYPE.TEXT, '', { okButton: 'Close', allowVerticalScrolling: true });
    }

    /**
     * Displays the list of categories for a specified preset ID in the user interface.
     * Handles initialization of category container, population of existing categories,
     * and rendering of components such as tags, drag handles, and action buttons.
     *
     * @param {number} presetID - The ID of the selected preset whose categories are to be displayed.
     * @param {boolean} [init=false] - Indicates whether the category container is being initialized for the first time. Defaults to `false`.
     * @return {void} This method does not return a value.
     */
    printCategoriesList(presetID, init = false){
        const catContainer = init
            ? $('<div id="catContainer"></div>')
            : $('#catContainer').empty() && $('#catContainer');

        const preset = this.getPreset(presetID);
        if(preset.categories.length === 0){
            catContainer.append('No category defined');
            $('#acm_custom_categories').append(catContainer);
        }
        else {
            preset.categories.forEach((cat,index) => {
                const catHTML = `
                        <div data-catid="${index}">
                            <div class="acm_catList">
                                <div class="drag-handle ui-sortable-handle" data-i18n="[title]Drag to reorder categories">☰</div>
                                <h4>- ${cat.name} -</h4>
                                <div style="display:flex;">
                                    <div class="menu_button fa-solid fa-edit cat_rename" title="Rename category"></div>
                                    <div class="menu_button fa-solid fa-trash cat_delete" title="Delete category"></div>
                                </div>
                            </div>
                            <div id="acm_catTagList_${index}" class="acm_catTagList"></div>
                        </div>`;
                const catElement = $(catHTML);
                const catTagList = catElement.find(`#acm_catTagList_${index}`);
                if (cat.tags) {
                    cat.tags.forEach(tag => {
                        catTagList.append(displayTag(tag, 'category'));
                    });
                }
                catTagList.append(`<label for="input_cat_tag_${index}" title="Search or create a tag.">
                                    <input id="input_cat_tag_${index}" class="text_pole tag_input wide100p margin0 ui-autocomplete-input" placeholder="Search tags" maxlength="50" autocomplete="off" style="display: none">
                                </label>`);
                catTagList.append('<i class="fa-solid fa-plus tag addCatTag"></i>');
                catContainer.append(catElement);
                $('#acm_custom_categories').append(catContainer);
                acmCreateTagInput(`#input_cat_tag_${index}`, `#acm_catTagList_${index}`, { tagOptions: { removable: true } }, 'category');
            });
            this.makeCategoryDraggable('#catContainer');
        }
    }

    /**
     * Makes the categories draggable and sortable within the specified container.
     * Enables drag-and-drop functionality to change the order of categories, updating
     * the configuration and saving the new order on drop.
     *
     * @param {string} containerSelector - The selector for the container element where categories should be made draggable.
     * @return {void} No return value.
     */
    makeCategoryDraggable(containerSelector) {
        $(containerSelector).sortable({
            handle: '.drag-handle',
            items: '> div',
            tolerance: 'pointer',
            placeholder: 'sortable-placeholder',
            update: ()=> {
                const newOrder = [];
                $(containerSelector).children('div').each(function () {
                    newOrder.push($(this).data('catid'));
                });
                const presetID = $('#preset_selector option:selected').data('preset');
                const currentCategories = this.getPreset(presetID).categories;
                this.updatePresetCategories(presetID, newOrder.map(index => currentCategories[index]));
            },
        });

        $('.drag-handle')
            .on('mousedown',function () { $(this).css('cursor', 'grabbing'); })
            .on('mouseup', function () { $(this).css('cursor', 'grab'); },
            );
    }

    /**
     * Renames an existing preset to a new name and updates all related UI elements.
     *
     * @param {string} preset - The identifier of the preset to rename.
     * @param {string} newName - The new name to assign to the preset.
     * @return {void}
     */
    renamePreset(preset, newName) {
        this.updatePresetName(preset, newName);
        $('#preset_name').html(newName);
        $('#preset_selector option').filter((_, element) => $(element).data('preset') === preset).text(newName);
        this.updateDropdownPresetNames();
    }

    /**
     * Adds a new category to the specified preset and updates the dropdown presets.
     *
     * @param {string} preset - The identifier of the preset to which the category will be added.
     * @param {string} catName - The name of the new category to be added.
     * @return {void} This function does not return a value.
     */
    addCategory(preset, catName){
        this.addPresetCategory(preset, catName);
        this.printCategoriesList(preset);
    }

    /**
     * Removes a category from a specified preset's category list.
     *
     * @param {string} preset - The name of the preset from which the category will be removed.
     * @param {number} category - The index of the category to remove in the preset's category list.
     * @return {void} This method does not return a value.
     */
    removeCategory(preset, category) {
        this.removePresetCategory(preset, category);
        this.printCategoriesList(preset);
    }

    /**
     * Renames a category within a specified preset and updates the stored settings.
     *
     * @param {string} preset - The name of the preset containing the category to rename.
     * @param {string} category - The name of the category to be renamed.
     * @param {string} newName - The new name to assign to the category.
     * @return {void} This function does not return any value.
     */
    renameCategory(preset, category, newName) {
        this.updateCategoryName(preset, category, newName);
        this.printCategoriesList(preset);
    }

    /**
     * Toggles the state of a tag button between "add" and "cancel" styles
     * and shows or hides the associated category tag input field.
     *
     * @param {object} button The button element to be toggled.
     * @param {string} selectedCat The identifier for the selected category.
     * @return {string} The identifier of the toggled category.
     */
    toggleTagButton(button, selectedCat) {
        if (button.hasClass('addCatTag')) {
            button
                .removeClass('addCatTag')
                .addClass('cancelCatTag')
                .removeClass('fa-plus')
                .addClass('fa-minus');
            $(`#input_cat_tag_${selectedCat}`).show();
        } else {
            button
                .addClass('addCatTag')
                .removeClass('cancelCatTag')
                .addClass('fa-plus')
                .removeClass('fa-minus');
            $(`#input_cat_tag_${selectedCat}`).hide();
        }
    }

    /**
     * Updates the content of the preset name element with the name of the specified preset.
     *
     * @param {string} newPreset - The identifier for the new preset whose name is to be displayed.
     * @return {void} This function does not return a value.
     */
    displayPresetName(newPreset) {
        $('#preset_name').html(this.getPreset(newPreset).name);
    }
}
