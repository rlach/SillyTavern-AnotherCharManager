/**
 * Manages the virtualized display of a large list of elements.
 * Only elements visible in the viewport are actually created in the DOM.
 */
class VirtualScroller {
    constructor(options = {}) {
        this.container = options.container;
        this.items = options.items || [];
        this.renderItem = options.renderItem; // Function to create an element
        this.itemHeight = options.itemHeight || 150; // Estimated element height
        this.itemsPerRow = options.itemsPerRow || 5; // Number of elements per line (for a grid)
        this.buffer = options.buffer || 2; // Number of lines to be preloaded before/after

        this.contentWrapper = null;
        this.itemsContainer = null;
        this.visibleRange = { start: 0, end: 0 };

        this.init();
    }

    init() {
        if (!this.container) {
            console.error('VirtualScroller: container is required');
            return;
        }

        // Create the structure
        this.container.innerHTML = '';
        this.container.style.position = 'relative';
        this.container.style.overflow = 'auto';

        // Wrapper for overall height (scrollbar)
        this.contentWrapper = document.createElement('div');
        this.contentWrapper.style.position = 'relative';
        this.contentWrapper.style.width = '100%';
        this.updateContentHeight();

        // Container for visible elements
        this.itemsContainer = document.createElement('div');
        this.itemsContainer.style.position = 'absolute';
        this.itemsContainer.style.top = '0';
        this.itemsContainer.style.left = '0';
        this.itemsContainer.style.right = '0';
        this.itemsContainer.style.width = '100%';
        this.itemsContainer.style.display = 'grid';
        this.itemsContainer.style.gridTemplateColumns = `repeat(${this.itemsPerRow}, 1fr)`;
        this.itemsContainer.style.gap = '16px';
        this.itemsContainer.style.padding = '16px';
        this.itemsContainer.style.boxSizing = 'border-box';

        this.contentWrapper.appendChild(this.itemsContainer);
        this.container.appendChild(this.contentWrapper);

        // Listen to the scroll
        this.container.addEventListener('scroll', () => this.onScroll(), { passive: true });

        // Initial render
        this.render();
    }

    updateContentHeight() {
        const totalRows = Math.ceil(this.items.length / this.itemsPerRow);
        const totalHeight = totalRows * this.itemHeight;
        this.contentWrapper.style.height = `${totalHeight}px`;
    }

    onScroll() {
        this.render();
    }

    calculateVisibleRange() {
        const scrollTop = this.container.scrollTop;
        const containerHeight = this.container.clientHeight;

        // Calculate visible lines
        const startRow = Math.floor(scrollTop / this.itemHeight);
        const endRow = Math.ceil((scrollTop + containerHeight) / this.itemHeight);

        // Add buffer
        const bufferedStartRow = Math.max(0, startRow - this.buffer);
        const bufferedEndRow = Math.min(
            Math.ceil(this.items.length / this.itemsPerRow),
            endRow + this.buffer
        );

        // Convert to element indices
        const start = bufferedStartRow * this.itemsPerRow;
        const end = Math.min(bufferedEndRow * this.itemsPerRow, this.items.length);

        return { start, end, startRow: bufferedStartRow };
    }

    render() {
        const newRange = this.calculateVisibleRange();

        // Avoid unnecessary re-renders
        if (newRange.start === this.visibleRange.start &&
            newRange.end === this.visibleRange.end) {
            return;
        }

        this.visibleRange = newRange;

        // Position element container
        const offsetTop = newRange.startRow * this.itemHeight;
        this.itemsContainer.style.transform = `translateY(${offsetTop}px)`;

        // Create visible elements
        const fragment = document.createDocumentFragment();

        for (let i = newRange.start; i < newRange.end; i++) {
            if (this.items[i]) {
                const element = this.renderItem(this.items[i], i);
                fragment.appendChild(element);
            }
        }

        // Replace content
        this.itemsContainer.innerHTML = '';
        this.itemsContainer.appendChild(fragment);
    }

    /**
     * Updates the list of items
     */
    setItems(items) {
        this.items = items;
        this.updateContentHeight();
        this.render();
    }

    /**
     * Refreshes display (useful after a resize)
     */
    refresh() {
        this.updateContentHeight();
        this.render();
    }

    /**
     * Scroll to a specific element
     */
    scrollToIndex(index) {
        const row = Math.floor(index / this.itemsPerRow);
        this.container.scrollTop = row * this.itemHeight;
    }

    /**
     * Cleans resources
     */
    destroy() {
        this.container.removeEventListener('scroll', this.onScroll);
        this.container.innerHTML = '';
    }
}

export default VirtualScroller;
