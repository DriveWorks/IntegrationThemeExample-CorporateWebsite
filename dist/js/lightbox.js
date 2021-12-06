/**
* BASIC IMAGE LIGHTBOX
*/

const lightboxImage = document.getElementById("lightbox-image");

// Close buttons
document.getElementById("lightbox-close").onclick = () => closeLightbox();

// Close on background (overlay) click
document.getElementById("lightbox-bg").onclick = () => closeLightbox();

// Close with ESC key
document.onkeydown = function (e) {
    e = e || window.event;
    if (e.key === "Escape") {
        closeLightbox();
    }
};

/**
 * Open lightbox overlay.
 * 
 * @param {string} src - The source of the image to display.
 */
function openLightbox(src) {
    lightboxImage.setAttribute("src", src);
    document.body.classList.add("lightbox-open");
}

/**
 * Close lightbox overlay.
 */
function closeLightbox() {
    document.body.classList.remove("lightbox-open");
}
