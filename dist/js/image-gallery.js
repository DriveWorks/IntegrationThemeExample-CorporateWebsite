/**
 * BASIC IMAGE GALLERY (CAROUSEL)
 */

const imageGallery = document.getElementById("gallery-images");
const galleryNextButton = document.getElementById("gallery-next");
const galleryPrevButton = document.getElementById("gallery-prev");
let currentItem = 0;

function setupGallery() {
    galleryNextButton.onclick = () => updateCarousel("next");
    galleryPrevButton.onclick = () => updateCarousel("prev");

    detectGalleryScroll();
    window.addEventListener("resize", detectGalleryScroll);
}

/**
* Image Carousel - Show/hide controls (if carousel can be scrolled)
*/
function detectGalleryScroll() {
    if (imageGallery.scrollWidth > imageGallery.clientWidth) {
        galleryNextButton.style.display = "";
        galleryPrevButton.style.display = "";
        return;
    }

    galleryNextButton.style.display = "none";
    galleryPrevButton.style.display = "none";
}

function galleryFullyScrolled() {
    return imageGallery.scrollLeft === (imageGallery.scrollWidth - imageGallery.clientWidth);
}

/**
* Image Carousel - Next/Prev button
*/
function updateCarousel(direction) {

    // Next image
    if (direction === "next" && !galleryFullyScrolled()) {
        currentItem++;
    }

    // Prev image
    if (direction === "prev") {
        currentItem--;
        galleryNextButton.disabled = false;
    }

    // Toggle buttons
    if (currentItem === 0) {
        galleryPrevButton.disabled = true;
    } else {
        galleryPrevButton.disabled = false;
    }

    // Update scroll to position
    document.querySelectorAll(".image-slide")[currentItem].scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "start"
    });

    // If scrolled to the end, disable the next button
    setTimeout(() => {
        if (galleryFullyScrolled()) {
            galleryNextButton.disabled = true;
        }
    }, 300);
}
