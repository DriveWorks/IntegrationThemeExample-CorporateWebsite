/**
 * BASIC IMAGE GALLERY (CAROUSEL)
 */

const imageGallery = document.getElementById("image-gallery");
const galleryImageContainer = document.getElementById("gallery-images");
const galleryNextButton = document.getElementById("gallery-next");
const galleryPrevButton = document.getElementById("gallery-prev");
let currentItem = 0;

/**
 * Setup gallery functions
 */
function setupGallery() {
    galleryNextButton.onclick = () => updateCarousel("next");
    galleryPrevButton.onclick = () => updateCarousel("prev");

    // Detect gallery overflow state on load + screen resize
    window.addEventListener("resize", detectGalleryOverflow);

    // Ensure gallery scroll position is reset to start - browser may have cached previous position
    galleryImageContainer.scrollLeft = 0;
}

/**
 * Show/hide controls if carousel can be scrolled
 */
function detectGalleryOverflow() {

    // If gallery images overflow container, show next/previous actions
    if (galleryImageContainer.scrollWidth > galleryImageContainer.clientWidth) {
        imageGallery.classList.add("has-controls");
        galleryNextButton.style.display = "";
        galleryPrevButton.style.display = "";
        return;
    }

    // Hide next/previous actions
    imageGallery.classList.remove("has-controls");
    galleryNextButton.style.display = "none";
    galleryPrevButton.style.display = "none";
}

/**
 * Detect if gallery has scrolled to the end
 */
function galleryFullyScrolled() {
    return galleryImageContainer.scrollLeft === (galleryImageContainer.scrollWidth - galleryImageContainer.clientWidth);
}

/**
 * Update carousel position (e.g. next/previous buttons)
 */
function updateCarousel(direction) {
    const galleryWidth = galleryImageContainer.clientWidth;
    let distance = galleryWidth * 0.9; // Scroll 90% of a gallery 'page', to bring the next partial slide into view

    // Next action
    if (direction === "next") {
        galleryPrevButton.disabled = false;
    }

    // Previous action (reverse direction)
    if (direction === "prev") {
        galleryNextButton.disabled = false;
        distance = -(distance);
    }

    // Update scroll position
    galleryImageContainer.scrollBy({
        left: distance,
        behavior: "smooth",
    });
}

/**
 * Detect gallery is scrolling and scroll has ended
 */
let galleryScrollTimeout;
galleryImageContainer.addEventListener("scroll", () => {
    clearTimeout(galleryScrollTimeout);

    // Detect scrolling has ended
    galleryScrollTimeout = setTimeout(() => {

        // Previous button - Check if gallery has been scrolled
        galleryPrevButton.disabled = galleryImageContainer.scrollLeft > 0 ? false : true;

        // Next button - Check if gallery has been scrolled to the end
        galleryNextButton.disabled = galleryFullyScrolled();

    }, 100);
});
