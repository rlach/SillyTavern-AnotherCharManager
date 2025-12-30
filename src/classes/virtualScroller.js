/**
 * Manages virtualized display of a large list of elements.
 * Only elements visible in the viewport are actually created in the DOM.
 */
class VirtualScroller {
    constructor(options = {}) {
        this.container = options.container; // This should be #character-list
        this.items = options.items || [];
        this.renderItem = options.renderItem;
        this.itemHeight = options.itemHeight || 150;
        this.itemsPerRow = options.itemsPerRow || 5;
        this.buffer = options.buffer || 2;

        this.visibleRange = { start: 0, end: 0 };

        this.init();
    }

    init() {
        if (!this.container) {
            console.error('VirtualScroller: container is required');
            return;
        }

        // Clear container
        this.container.innerHTML = '';

        // Listen to scroll on the container itself
        this.container.addEventListener('scroll', () => this.onScroll(), { passive: true });

        // Initial render
        this.render();
    }

    onScroll() {
        this.render();
    }

    calculateVisibleRange() {
        const scrollTop = this.container.scrollTop;
        const containerHeight = this.container.clientHeight;

        // Calculate visible rows
        const startRow = Math.floor(scrollTop / this.itemHeight);
        const endRow = Math.ceil((scrollTop + containerHeight) / this.itemHeight);

        // Add buffer
        const bufferedStartRow = Math.max(0, startRow - this.buffer);
        const bufferedEndRow = Math.min(
            Math.ceil(this.items.length / this.itemsPerRow),
            endRow + this.buffer
        );

        // Convert to item indices
        const start = bufferedStartRow * this.itemsPerRow;
        const end = Math.min(bufferedEndRow * this.itemsPerRow, this.items.length);

        return { start, end };
    }

    render() {
        const newRange = this.calculateVisibleRange();

        // Avoid unnecessary re-renders
        if (newRange.start === this.visibleRange.start &&
            newRange.end === this.visibleRange.end) {
            return;
        }

        this.visibleRange = newRange;

        // Create visible elements with spacers to maintain scroll position
        const fragment = document.createDocumentFragment();

        // Add top spacer
        if (newRange.start > 0) {
            const topSpacer = document.createElement('div');
            const topRows = Math.floor(newRange.start / this.itemsPerRow);
            topSpacer.style.height = `${topRows * this.itemHeight}px`;
            topSpacer.style.width = '100%'; // Full width to force line break in flex
            topSpacer.style.flexShrink = '0';
            fragment.appendChild(topSpacer);
        }

        // Add visible items
        for (let i = newRange.start; i < newRange.end; i++) {
            if (this.items[i]) {
                const element = this.renderItem(this.items[i], i);
                fragment.appendChild(element);
            }
        }

        // Add bottom spacer
        const remainingItems = this.items.length - newRange.end;
        if (remainingItems > 0) {
            const bottomSpacer = document.createElement('div');
            const bottomRows = Math.ceil(remainingItems / this.itemsPerRow);
            bottomSpacer.style.height = `${bottomRows * this.itemHeight}px`;
            bottomSpacer.style.width = '100%'; // Full width to force line break in flex
            bottomSpacer.style.flexShrink = '0';
            fragment.appendChild(bottomSpacer);
        }

        // Replace content
        this.container.innerHTML = '';
        this.container.appendChild(fragment);
    }

    /**
     * Updates the list of items
     */
    setItems(items) {
        this.items = items;
        this.render();
    }

    /**
     * Refreshes the display (useful after resize)
     */
    refresh() {
        this.render();
    }

    /**
     * Scrolls to a specific item
     */
    scrollToIndex(index) {
        const row = Math.floor(index / this.itemsPerRow);
        const scrollTop = row * this.itemHeight;
        this.container.scrollTop = scrollTop;
    }

    /**
     * Cleans up resources
     */
    destroy() {
        this.container.removeEventListener('scroll', this.onScroll);
        this.container.innerHTML = '';
    }
}

export default VirtualScroller;
