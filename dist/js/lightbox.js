/**
* BASIC IMAGE LIGHTBOX
*/

const lightboxImage = document.getElementById("lightbox-image");

function openLightbox(src){
    lightboxImage.setAttribute("src", src);
    document.body.classList.add("lightbox-open");
}

function closeLightbox(){
    document.body.classList.remove("lightbox-open");
}

// Close button
document.getElementById("lightbox-close").onclick = function () {
    closeLightbox();
};

// Close on background (overlay) click
document.getElementById("lightbox-bg").onclick = function () {
    closeLightbox();
};

// Close with ESC key
document.onkeydown = function(e) {
    e = e || window.event;
    if (e.key === "Escape") {
        closeLightbox();
    }
};
