import VirtualScroller from '../../dist/virtual-scroller.bundle.js';

export class AcmVirtualScrollerService {
    constructor({
        container,
        renderItem,
        getItemId,
        estimatedItemHeight = 180,
        estimatedItemWidth = 130,
        estimatedInterItemVerticalSpacing = 0,
        onRendered = null,
    }) {
        this.container = container;
        this.renderItem = renderItem;
        this.getItemId = getItemId;
        this.estimatedItemHeight = estimatedItemHeight;
        this.estimatedItemWidth = estimatedItemWidth;
        this.estimatedInterItemVerticalSpacing = estimatedInterItemVerticalSpacing;
        this.onRendered = onRendered;

        this.items = [];
        this.instance = null;
        this.itemsContainer = null;
    }

    destroy() {
        if (this.instance) {
            try {
                this.instance.stop();
            } catch {
                // no-op
            }
        }
        this.instance = null;
        this.items = [];
        this.itemsContainer = null;
        if (this.container) {
            this.container.classList.remove('acm-virtual-scroll-container');
            this.container.innerHTML = '';
        }
    }

    setItems(items, preserveScroll = false) {
        this.items = Array.isArray(items) ? items : [];

        if (!this.instance) {
            this.#initialize();
            return;
        }

        this.instance.setItems(this.items, { preserveScrollPosition: preserveScroll });
    }

    refreshLayout() {
        this.instance?.updateLayout();
    }

    scrollToIndex(index, { behavior = 'smooth', block = 'center' } = {}) {
        if (!this.instance || !this.container || !Array.isArray(this.items)) {
            return false;
        }

        if (index < 0 || index >= this.items.length) {
            return false;
        }

        const item = this.items[index];
        let top = this.instance.getItemScrollPosition(item);

        if (typeof top !== 'number' || Number.isNaN(top)) {
            const columnsCount = Math.max(1, Math.floor((this.container.clientWidth || 1) / Math.max(1, this.estimatedItemWidth)));
            const itemRow = Math.floor(index / columnsCount);
            const rowHeight = Math.max(1, this.estimatedItemHeight + this.estimatedInterItemVerticalSpacing);
            top = itemRow * rowHeight;
        }

        const centerOffset = block === 'center'
            ? Math.max(0, (this.container.clientHeight - this.estimatedItemHeight) / 2)
            : 0;

        const targetTop = Math.max(0, top - centerOffset);
        this.container.scrollTo({ top: targetTop, behavior });
        return true;
    }

    #initialize() {
        if (!this.container) {
            return;
        }

        this.container.classList.add('acm-virtual-scroll-container');
        this.container.innerHTML = '';

        this.itemsContainer = document.createElement('div');
        this.itemsContainer.className = 'character-list acm-virtual-items';
        this.container.appendChild(this.itemsContainer);

        this.instance = new VirtualScroller(
            () => this.itemsContainer,
            this.items,
            {
                scrollableContainer: this.container,
                getItemId: this.getItemId,
                getEstimatedItemHeight: () => this.estimatedItemHeight,
                getEstimatedInterItemVerticalSpacing: () => this.estimatedInterItemVerticalSpacing,
                getEstimatedVisibleItemRowsCount: () => {
                    const height = this.container.clientHeight || this.estimatedItemHeight;
                    return Math.max(2, Math.ceil(height / Math.max(1, this.estimatedItemHeight)));
                },
                getColumnsCount: ({ getWidth }) => {
                    const width = Number(getWidth?.()) || this.container.clientWidth || 1;
                    return Math.max(1, Math.floor(width / this.estimatedItemWidth));
                },
                measureItemsBatchSize: 150,
                render: (state) => this.#render(state),
            },
        );

        this.instance.start();
    }

    #render(state) {
        if (!this.itemsContainer) {
            return;
        }

        const {
            items,
            firstShownItemIndex,
            lastShownItemIndex,
            beforeItemsHeight,
            afterItemsHeight,
        } = state || {};

        this.itemsContainer.style.paddingTop = `${Math.max(0, Number(beforeItemsHeight) || 0)}px`;
        this.itemsContainer.style.paddingBottom = `${Math.max(0, Number(afterItemsHeight) || 0)}px`;

        if (!Array.isArray(items) || items.length === 0) {
            this.itemsContainer.replaceChildren();
            return;
        }

        if (typeof firstShownItemIndex !== 'number' || typeof lastShownItemIndex !== 'number') {
            this.itemsContainer.replaceChildren();
            return;
        }

        const fragment = document.createDocumentFragment();
        for (let index = firstShownItemIndex; index <= lastShownItemIndex; index++) {
            const item = items[index];
            if (!item) {
                continue;
            }

            const node = this.renderItem(item, index);
            if (node) {
                fragment.appendChild(node);
            }
        }

        this.itemsContainer.replaceChildren(fragment);
        this.onRendered?.(state, this.itemsContainer);
    }
}