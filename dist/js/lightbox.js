/**
* BASIC IMAGE LIGHTBOX
*/

const lightboxImage = document.getElementById("lightbox-image");

// Close buttons
document.getElementById("lightbox-close").onclick = () => closeLightbox();

// Close on background (overlay) click
document.getElementById("lightbox-bg").onclick = () => closeLightbox();

// Close with ESC key
document.onkeydown = function(e) {
    e = e || window.event;
    if (e.key === "Escape") {
        closeLightbox();
    }
};

function openLightbox(src) {
    lightboxImage.setAttribute("src", src);
    document.body.classList.add("lightbox-open");
}

function closeLightbox() {
    document.body.classList.remove("lightbox-open");
}
