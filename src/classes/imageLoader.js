/**
 * The ImageLoader class is responsible for managing the lazy loading of images
 * with features such as prioritization, intersection observing, and concurrent loading control.
 * This utility ensures efficient resource loading and improves performance by loading images only
 * when they are about to enter the viewport.
 */
class ImageLoader {
    constructor(options = {}) {
        this.maxConcurrent = options.maxConcurrent || 12;
        this.rootMargin = options.rootMargin || '800px';
        this.root = options.root || null;
        this.currentlyLoading = 0;
        this.loadingQueue = [];
        this.observedImages = new Set();

        this.createObserver();
        this.setupResizeObserver();
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

    setupResizeObserver() {
        if (typeof ResizeObserver === 'undefined') {
            console.warn('ResizeObserver not supported');
            return;
        }

        this.resizeObserver = new ResizeObserver((entries) => {
            if (this.observedImages.size > 0) {
                this.refreshObserver();
            }
        });

        if (this.root) {
            this.resizeObserver.observe(this.root);
        }
    }

    refreshObserver() {
        const imagesToReobserve = Array.from(this.observedImages);

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

        tempImg.src = img.dataset.src;

        tempImg.decode()
            .then(() => {
                img.src = tempImg.src;
                img.dataset.loaded = 'true';
                delete img.dataset.loading;
                img.classList.add('loaded');
            })
            .catch((err) => {
                console.error('Failed to load/decode image:', img.dataset.src, err);
            })
            .finally(() => {
                this.currentlyLoading--;
                this.processQueue();
                this.observer.unobserve(img);
                this.observedImages.delete(img);
            });
    }

    observe(img) {
        if (img.dataset.loaded !== 'true') {
            this.observer.observe(img);
            this.observedImages.add(img);
        }
    }

    destroy() {
        this.observer.disconnect();
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        this.loadingQueue = [];
        this.observedImages.clear();
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
            this.refreshObserver();
        }
    }
}

/**
 * An instance of the ImageLoader class responsible for handling image loading operations.
 * This variable is used to manage and streamline the process of loading images,
 * providing utilities such as caching, error handling, and asynchronous loading.
 */
export const imageLoader = new ImageLoader();

/**
 * Initializes the character module by setting up the character container and configuring lazy-loading options for images.
 * Adds a scroll event listener to dynamically adjust the image lazy-loading margin based on scrolling speed.
 * Logs an error if the character container is not found in the DOM.
 *
 * @return {void} Does not return a value.
 */
export function initializeCharacterModule() {
    const characterContainer = document.getElementById('character-list');

    if (!characterContainer) {
        console.error('Character container not found');
        return;
    }

    imageLoader.updateOptions({
        root: characterContainer,
        maxConcurrent: 12,
        rootMargin: '800px'
    });

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
}

/**
 * Destroys the character module by cleaning up and releasing resources.
 *
 * This method deallocates any resources or memory associated with the character module,
 * ensuring that the `imageLoader` used for character-related assets is properly destroyed.
 *
 * @return {void} No return value.
 */
export function destroyCharacterModule() {
    imageLoader.destroy();
}

