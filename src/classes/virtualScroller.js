/**
 * Gère l'affichage virtualisé d'une grande liste d'éléments.
 * Seuls les éléments visibles dans le viewport sont réellement créés dans le DOM.
 */
class VirtualScroller {
    constructor(options = {}) {
        this.container = options.container;
        this.items = options.items || [];
        this.renderItem = options.renderItem; // Fonction pour créer un élément
        this.itemHeight = options.itemHeight || 150; // Hauteur estimée d'un élément
        this.itemsPerRow = options.itemsPerRow || 5; // Nombre d'éléments par ligne (pour une grille)
        this.buffer = options.buffer || 2; // Nombre de lignes à précharger avant/après

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

        // Créer la structure
        this.container.innerHTML = '';
        this.container.style.position = 'relative';
        this.container.style.overflow = 'auto';

        // Wrapper pour la hauteur totale (scrollbar)
        this.contentWrapper = document.createElement('div');
        this.contentWrapper.style.position = 'relative';
        this.contentWrapper.style.width = '100%';
        this.updateContentHeight();

        // Conteneur pour les éléments visibles
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

        // Écouter le scroll
        this.container.addEventListener('scroll', () => this.onScroll(), { passive: true });

        // Render initial
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

        // Calculer les lignes visibles
        const startRow = Math.floor(scrollTop / this.itemHeight);
        const endRow = Math.ceil((scrollTop + containerHeight) / this.itemHeight);

        // Ajouter le buffer
        const bufferedStartRow = Math.max(0, startRow - this.buffer);
        const bufferedEndRow = Math.min(
            Math.ceil(this.items.length / this.itemsPerRow),
            endRow + this.buffer
        );

        // Convertir en indices d'éléments
        const start = bufferedStartRow * this.itemsPerRow;
        const end = Math.min(bufferedEndRow * this.itemsPerRow, this.items.length);

        return { start, end, startRow: bufferedStartRow };
    }

    render() {
        const newRange = this.calculateVisibleRange();

        // Éviter les re-renders inutiles
        if (newRange.start === this.visibleRange.start &&
            newRange.end === this.visibleRange.end) {
            return;
        }

        this.visibleRange = newRange;

        // Positionner le conteneur d'éléments
        const offsetTop = newRange.startRow * this.itemHeight;
        this.itemsContainer.style.transform = `translateY(${offsetTop}px)`;

        // Créer les éléments visibles
        const fragment = document.createDocumentFragment();

        for (let i = newRange.start; i < newRange.end; i++) {
            if (this.items[i]) {
                const element = this.renderItem(this.items[i], i);
                fragment.appendChild(element);
            }
        }

        // Remplacer le contenu
        this.itemsContainer.innerHTML = '';
        this.itemsContainer.appendChild(fragment);
    }

    /**
     * Met à jour la liste des éléments
     */
    setItems(items) {
        this.items = items;
        this.updateContentHeight();
        this.render();
    }

    /**
     * Rafraîchit l'affichage (utile après un resize)
     */
    refresh() {
        this.updateContentHeight();
        this.render();
    }

    /**
     * Scroll vers un élément spécifique
     */
    scrollToIndex(index) {
        const row = Math.floor(index / this.itemsPerRow);
        this.container.scrollTop = row * this.itemHeight;
    }

    /**
     * Nettoie les ressources
     */
    destroy() {
        this.container.removeEventListener('scroll', this.onScroll);
        this.container.innerHTML = '';
    }
}

export default VirtualScroller;
