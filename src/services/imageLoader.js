/**
 * Service de chargement optimisé des images de personnages avec préchargement intelligent.
 * Utilise l'Intersection Observer API pour charger les images avant qu'elles n'entrent dans le viewport.
 */
class ImageLoader {
    constructor(options = {}) {
        this.maxConcurrent = options.maxConcurrent || 8;
        this.rootMargin = options.rootMargin || '800px';
        this.root = options.root || null;
        this.currentlyLoading = 0;
        this.loadingQueue = [];
        this.observedImages = new Set(); // AJOUTÉ : Garder trace des images observées

        this.createObserver();
        this.setupResizeObserver(); // AJOUTÉ
    }

    createObserver() {
        this.observer = new IntersectionObserver(
            (entries) => this.handleIntersection(entries),
            {
                root: this.root,
                rootMargin: this.rootMargin,
                threshold: 0.01
            }
        );
    }

    // AJOUTÉ : Observer les changements de taille du conteneur
    setupResizeObserver() {
        if (typeof ResizeObserver === 'undefined') {
            console.warn('ResizeObserver not supported');
            return;
        }

        this.resizeObserver = new ResizeObserver((entries) => {
            // Quand le conteneur change de taille, rafraîchir l'Observer
            if (this.observedImages.size > 0) {
                this.refreshObserver();
            }
        });

        // Observer le conteneur racine (ou le viewport si pas de root)
        if (this.root) {
            this.resizeObserver.observe(this.root);
        }
    }

    // AJOUTÉ : Rafraîchir toutes les observations
    refreshObserver() {
        const imagesToReobserve = Array.from(this.observedImages);

        // Déconnecter et reconnecter
        imagesToReobserve.forEach(img => {
            if (!img.dataset.loaded) {
                this.observer.unobserve(img);
                this.observer.observe(img);
            }
        });
    }

    handleIntersection(entries) {
        entries.forEach(entry => {
            const img = entry.target;

            if (entry.isIntersecting) {
                const rect = entry.boundingClientRect;
                const distanceFromViewport = Math.abs(rect.top);
                this.queueImage(img, distanceFromViewport);
            }
        });
    }

    queueImage(img, priority) {
        if (img.dataset.loaded === 'true' || img.dataset.loading === 'true') {
            return;
        }

        const existingIndex = this.loadingQueue.findIndex(item => item.img === img);
        if (existingIndex !== -1) {
            this.loadingQueue[existingIndex].priority = priority;
        } else {
            this.loadingQueue.push({ img, priority });
        }

        this.loadingQueue.sort((a, b) => a.priority - b.priority);
        this.processQueue();
    }

    processQueue() {
        while (this.currentlyLoading < this.maxConcurrent && this.loadingQueue.length > 0) {
            const { img } = this.loadingQueue.shift();
            this.loadImage(img);
        }
    }

    loadImage(img) {
        if (img.dataset.loaded === 'true' || img.dataset.loading === 'true') {
            return;
        }

        img.dataset.loading = 'true';
        this.currentlyLoading++;

        const tempImg = new Image();

        tempImg.onload = () => {
            img.src = img.dataset.src;
            img.dataset.loaded = 'true';
            delete img.dataset.loading;
            img.classList.add('loaded');

            this.currentlyLoading--;
            this.processQueue();
            this.observer.unobserve(img);
            this.observedImages.delete(img); // AJOUTÉ : Retirer des images observées
        };

        tempImg.onerror = () => {
            console.error('Failed to load image:', img.dataset.src);
            delete img.dataset.loading;

            this.currentlyLoading--;
            this.processQueue();
            this.observer.unobserve(img);
            this.observedImages.delete(img); // AJOUTÉ
        };

        tempImg.src = img.dataset.src;
    }

    observe(img) {
        if (img.dataset.loaded !== 'true') {
            this.observer.observe(img);
            this.observedImages.add(img); // AJOUTÉ : Garder trace
        }
    }

    destroy() {
        this.observer.disconnect();
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        this.loadingQueue = [];
        this.observedImages.clear(); // AJOUTÉ
        this.currentlyLoading = 0;
    }

    updateOptions(options = {}) {
        let needsRecreate = false;

        if (options.maxConcurrent !== undefined) {
            this.maxConcurrent = options.maxConcurrent;
        }

        if (options.rootMargin !== undefined && options.rootMargin !== this.rootMargin) {
            this.rootMargin = options.rootMargin;
            needsRecreate = true;
        }

        if (options.root !== undefined && options.root !== this.root) {
            // Changer le root observé par le ResizeObserver
            if (this.resizeObserver) {
                if (this.root) {
                    this.resizeObserver.unobserve(this.root);
                }
                if (options.root) {
                    this.resizeObserver.observe(options.root);
                }
            }

            this.root = options.root;
            needsRecreate = true;
        }

        if (needsRecreate) {
            this.observer.disconnect();
            this.createObserver();
            this.refreshObserver(); // AJOUTÉ : Re-observer toutes les images
        }
    }
}

// Instance unique exportée
export const imageLoader = new ImageLoader();


// Au démarrage de votre module
export function initializeCharacterModule() {
    const characterContainer = document.getElementById('character-list');

    if (!characterContainer) {
        console.error('Character container not found');
        return;
    }

    // Configurer le loader avec votre conteneur
    imageLoader.updateOptions({
        root: characterContainer,
        maxConcurrent: 8,
        rootMargin: '800px'
    });

    // Listener de scroll sur votre conteneur
    let lastScrollTop = 0;
    characterContainer.addEventListener('scroll', () => {
        const currentScrollTop = characterContainer.scrollTop;
        const scrollSpeed = Math.abs(currentScrollTop - lastScrollTop);
        lastScrollTop = currentScrollTop;

        if (scrollSpeed > 100) {
            imageLoader.updateOptions({ rootMargin: '1500px' });
        } else {
            imageLoader.updateOptions({ rootMargin: '800px' });
        }
    }, { passive: true });

    // Charger vos personnages...
}

// Nettoyage si besoin
export function destroyCharacterModule() {
    imageLoader.destroy();
}

