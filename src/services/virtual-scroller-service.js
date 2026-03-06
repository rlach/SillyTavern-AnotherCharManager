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
        this.measuredColumnsCount = null;
        this.measuredColumnsContainerWidth = null;
        this.measuredItemOuterWidth = null;
        this.measuredRowStep = null;
        this.pendingLayoutRefresh = false;
        this.lastRenderedRange = null;
    }

    static WIDTH_CHANGE_INVALIDATION_THRESHOLD_PX = 24;

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
        this.measuredColumnsCount = null;
        this.measuredColumnsContainerWidth = null;
        this.measuredItemOuterWidth = null;
        this.measuredRowStep = null;
        this.pendingLayoutRefresh = false;
        this.lastRenderedRange = null;
        if (this.container) {
            this.container.classList.remove('acm-virtual-scroll-container');
            this.container.innerHTML = '';
        }
    }

    #measureRenderedItemOuterWidth() {
        if (!this.itemsContainer) {
            return null;
        }

        const sampleNode = this.itemsContainer.querySelector('.card, [data-avatar], [data-group-id]');
        if (!(sampleNode instanceof HTMLElement)) {
            return null;
        }

        const rect = sampleNode.getBoundingClientRect();
        const style = window.getComputedStyle(sampleNode);
        const marginX = (parseFloat(style.marginLeft) || 0) + (parseFloat(style.marginRight) || 0);
        const measured = Math.ceil((rect.width || 0) + marginX);
        return Number.isFinite(measured) && measured > 0 ? measured : null;
    }

    #measureRenderedColumnsCount() {
        if (!this.itemsContainer) {
            return null;
        }

        const renderedItems = Array.from(this.itemsContainer.querySelectorAll('.card, [data-avatar], [data-group-id]'));
        if (renderedItems.length === 0) {
            return null;
        }

        const firstTop = renderedItems[0].getBoundingClientRect().top;
        const tolerancePx = 1;
        let columns = 0;

        for (const node of renderedItems) {
            const top = node.getBoundingClientRect().top;
            if (Math.abs(top - firstTop) > tolerancePx) {
                break;
            }
            columns++;
        }

        if (!Number.isFinite(columns) || columns < 1) {
            return null;
        }

        return columns;
    }

    #measureRenderedItemOuterHeight() {
        if (!this.itemsContainer) {
            return null;
        }

        const sampleNode = this.itemsContainer.querySelector('.card, [data-avatar], [data-group-id]');
        if (!(sampleNode instanceof HTMLElement)) {
            return null;
        }

        const rect = sampleNode.getBoundingClientRect();
        const style = window.getComputedStyle(sampleNode);
        const marginY = (parseFloat(style.marginTop) || 0) + (parseFloat(style.marginBottom) || 0);
        const measured = Math.ceil((rect.height || 0) + marginY);
        return Number.isFinite(measured) && measured > 0 ? measured : null;
    }

    #measureRenderedRowStep() {
        if (!this.itemsContainer) {
            return null;
        }

        const renderedItems = Array.from(this.itemsContainer.querySelectorAll('.card, [data-avatar], [data-group-id]'));
        if (renderedItems.length < 2) {
            return null;
        }

        const firstTop = renderedItems[0].getBoundingClientRect().top;
        const tolerancePx = 1;

        for (let index = 1; index < renderedItems.length; index++) {
            const currentTop = renderedItems[index].getBoundingClientRect().top;
            const delta = currentTop - firstTop;
            if (delta > tolerancePx) {
                return Math.ceil(delta);
            }
        }

        return null;
    }

    #getVerticalGap() {
        const source = this.itemsContainer || this.container;
        if (!source) {
            return 0;
        }

        const style = window.getComputedStyle(source);
        const rawGap = style.rowGap || style.gap || '0';
        const gap = parseFloat(rawGap);
        return Number.isFinite(gap) && gap > 0 ? gap : 0;
    }

    #getHorizontalGap() {
        const source = this.itemsContainer || this.container;
        if (!source) {
            return 0;
        }

        const style = window.getComputedStyle(source);
        const rawGap = style.columnGap || style.gap || '0';
        const gap = parseFloat(rawGap);
        return Number.isFinite(gap) && gap > 0 ? gap : 0;
    }

    #getEffectiveItemOuterWidth() {
        const measured = this.#measureRenderedItemOuterWidth();
        if (measured) {
            this.measuredItemOuterWidth = measured;
            return measured;
        }

        if (Number.isFinite(this.measuredItemOuterWidth) && this.measuredItemOuterWidth > 0) {
            return this.measuredItemOuterWidth;
        }

        return Math.max(1, Number(this.estimatedItemWidth) || 1);
    }

    #getColumnsCountForWidth(width) {
        const safeWidth = Math.max(1, Number(width) || this.container?.offsetWidth || 1);
        const measuredWidth = Number(this.measuredColumnsContainerWidth) || 0;
        const widthDelta = measuredWidth > 0 ? Math.abs(measuredWidth - safeWidth) : 0;

        if (
            Number.isFinite(this.measuredColumnsCount)
            && this.measuredColumnsCount > 0
            && measuredWidth > 0
            && widthDelta > AcmVirtualScrollerService.WIDTH_CHANGE_INVALIDATION_THRESHOLD_PX
        ) {
            this.invalidateColumnMeasurements();
        }

        if (
            Number.isFinite(this.measuredColumnsCount)
            && this.measuredColumnsCount > 0
        ) {
            return this.measuredColumnsCount;
        }

        const itemOuterWidth = this.#getEffectiveItemOuterWidth();
        const horizontalGap = this.#getHorizontalGap();
        const step = Math.max(1, itemOuterWidth + horizontalGap);
        return Math.max(1, Math.floor((safeWidth + horizontalGap) / step));
    }

    #scheduleLayoutRefresh() {
        if (!this.instance || this.pendingLayoutRefresh) {
            return;
        }

        this.pendingLayoutRefresh = true;
        requestAnimationFrame(() => {
            this.pendingLayoutRefresh = false;
            this.instance?.updateLayout();
        });
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

    invalidateColumnMeasurements() {
        this.measuredColumnsCount = null;
        this.measuredColumnsContainerWidth = null;
    }

    getRenderedRange() {
        if (!this.lastRenderedRange) {
            return null;
        }

        return {
            firstShownItemIndex: this.lastRenderedRange.firstShownItemIndex,
            lastShownItemIndex: this.lastRenderedRange.lastShownItemIndex,
            itemsCount: this.lastRenderedRange.itemsCount,
        };
    }

    getViewportHeight() {
        return this.container?.clientHeight || 0;
    }

    getEstimatedRowHeight() {
        if (Number.isFinite(this.measuredRowStep) && this.measuredRowStep > 0) {
            return this.measuredRowStep;
        }

        const measuredOuterHeight = this.#measureRenderedItemOuterHeight();
        if (measuredOuterHeight) {
            return Math.max(1, measuredOuterHeight + this.#getVerticalGap());
        }

        return Math.max(1, Number(this.estimatedItemHeight) + Number(this.estimatedInterItemVerticalSpacing || 0));
    }

    scrollBy(deltaY, { behavior = 'auto' } = {}) {
        if (!this.container) {
            return false;
        }

        const currentTop = this.container.scrollTop || 0;
        const maxTop = Math.max(0, (this.container.scrollHeight || 0) - (this.container.clientHeight || 0));
        const targetTop = Math.max(0, Math.min(maxTop, currentTop + Number(deltaY || 0)));

        if (Math.abs(targetTop - currentTop) < 1) {
            return false;
        }

        this.container.scrollTo({ top: targetTop, behavior });
        return true;
    }

    scrollToIndex(index, { behavior = 'smooth', block = 'center' } = {}) {
        if (!this.instance || !this.container || !Array.isArray(this.items)) {
            return false;
        }

        if (index < 0 || index >= this.items.length) {
            return false;
        }

        const columnsCount = this.#getColumnsCountForWidth(this.container.offsetWidth || 1);
        const rowHeight = this.getEstimatedRowHeight();
        const fallbackTop = Math.floor(index / columnsCount) * rowHeight;

        let top = this.instance.getItemScrollPosition(index);

        if (typeof top !== 'number' || Number.isNaN(top)) {
            top = fallbackTop;
        } else if (Number.isFinite(this.measuredRowStep) && this.measuredRowStep > 0) {
            const delta = Math.abs(top - fallbackTop);
            // If virtual-scroller offset drifts far from measured grid, prefer measured grid.
            if (delta > (rowHeight * 0.75)) {
                top = fallbackTop;
            }
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
                    return this.#getColumnsCountForWidth(width);
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
            this.lastRenderedRange = null;
            this.itemsContainer.replaceChildren();
            return;
        }

        if (typeof firstShownItemIndex !== 'number' || typeof lastShownItemIndex !== 'number') {
            this.lastRenderedRange = null;
            this.itemsContainer.replaceChildren();
            return;
        }

        this.lastRenderedRange = {
            firstShownItemIndex,
            lastShownItemIndex,
            itemsCount: items.length,
        };

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

        const latestMeasuredColumns = this.#measureRenderedColumnsCount();
        const renderedCount = Math.max(0, (lastShownItemIndex - firstShownItemIndex) + 1);
        const hasItemsBelowViewport = lastShownItemIndex < (items.length - 1);
        const isPotentiallyPartialSingleRowAtEnd = !hasItemsBelowViewport && renderedCount <= latestMeasuredColumns;

        if (
            latestMeasuredColumns
            && !isPotentiallyPartialSingleRowAtEnd
            && latestMeasuredColumns !== this.measuredColumnsCount
        ) {
            this.measuredColumnsCount = latestMeasuredColumns;
            this.measuredColumnsContainerWidth = this.container?.offsetWidth || null;
            this.#scheduleLayoutRefresh();
        }

        if (latestMeasuredColumns) {
            this.measuredColumnsContainerWidth = this.container?.offsetWidth || this.measuredColumnsContainerWidth;
        }

        const latestMeasuredWidth = this.#measureRenderedItemOuterWidth();
        if (latestMeasuredWidth && latestMeasuredWidth !== this.measuredItemOuterWidth) {
            this.measuredItemOuterWidth = latestMeasuredWidth;
            this.#scheduleLayoutRefresh();
        }

        const latestMeasuredRowStep = this.#measureRenderedRowStep();
        if (latestMeasuredRowStep && latestMeasuredRowStep !== this.measuredRowStep) {
            this.measuredRowStep = latestMeasuredRowStep;
            this.#scheduleLayoutRefresh();
        }

        this.onRendered?.(state, this.itemsContainer);
    }
}