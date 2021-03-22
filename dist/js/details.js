/**
 * SPECIFICATION DETAILS
 */

// Get config
let firstRun = true;
const DETAILS_UPDATE_INTERVAL = config.details.updateInterval * 1000;

// Get current Specification Id (passed via URL query)
const URL_QUERY = new URLSearchParams(window.location.search);
const QUERY_SPECIFICATION_ID = URL_QUERY.get("specification");

// Get page elements
const pageTitle = document.getElementById("page-title");
const pageActions = document.getElementById("page-actions");

const detailSummary = document.getElementById("detail-summary");
const detailProperties = document.getElementById("detail-properties");

const detailDocuments = document.getElementById("detail-documents");
const documentsList = document.getElementById("documents-list");

const detailImages = document.getElementById("detail-images");
const galleryImages = document.getElementById("gallery-images");

// Store data, for comparison on change
let storedDetails;
let storedActions;
let storedProperties;
let storedDocuments;
let refreshTimeout;

/**
 * Handle client errors manually
 */
client.responseErrorDelegate = (res) => {
    customErrorHandler(res);
}

function customErrorHandler(res){
    const statusCode = res.status;
    switch (statusCode) {

        // Not found
        case 404:

            // Specification Id not found, show visual error
            if (firstRun){
                pageTitle.innerHTML = "Invalid Specification ID.";
                pageTitle.style.opacity = "";
                return true;
            }

            return false;

        // Unauthorized
        case 401:

            // Logout if run on page load
            if (firstRun){
                handleUnauthorizedUser();
                return true;
            }

            // Show session expired message, but keep page open 'read only'
            handleInvalidSession();
            return false;

        // Let DriveWorks API handle all other errors
        default:
            return false;
    }

}

/**
 * On page load
 */
(async function () {

    // Show error if no Specification Id passed
    if (!QUERY_SPECIFICATION_ID){
        pageTitle.innerHTML = "No Specification ID provided.";
        pageTitle.style.opacity = "";
        return;
    }

    constructDetails();

})();

/**
 * Construct Specification details
 */
async function constructDetails(){

    try {

        // Get Specification details
        const specification = await client.getSpecificationById(GROUP_ALIAS, QUERY_SPECIFICATION_ID);

        // If Specification returns undefined, logout (no connection so no response)
        // If no/an invalid Specification Id is provided, a text error message is returned.
        if (!specification){

            // Logout if run on page load
            if (firstRun){
                handleUnauthorizedUser("No connection found.");
                return;
            }

            handleNoConnection();
            return;
        }

        // Render available details
        renderDetails(specification);

        // Get attached data
        getActions();
        getProperties();
        getDocuments();

        // Update data after brief timeout (repeat indefinitely)
        setTimeout(function(){
            constructDetails();
        }, DETAILS_UPDATE_INTERVAL);

        firstRun = false;

    } catch (error) {
        handleGenericError(error);
    }

}

/**
* Render Specification details
*/
async function renderDetails(details) {

    // Output details if: not stored (first run), objects don't match
    if (!storedDetails || !objectsEqual(details, storedDetails)){

        const name = details.name;
        const status = details.stateName;
        const created = details.dateCreated;
        const edited = details.dateEdited;

        // Set page title
        pageTitle.innerHTML = name;
        pageTitle.style.opacity = "";

        // Generate details
        const markup = `
            ${ status && `<div class="detail-item detail-status"><div>Status</div><div class="status-tag status-${status.toLowerCase()}">${status}</div></div>`}
            ${ created && `<div class="detail-item detail-created"><div>Created</div><div>${new Date(created).toLocaleString("en-GB", { minimumFractionDigits: 2 })}</div></div>`}
            ${ edited && `<div class="detail-item detail-edited"><div>Modified</div><div>${new Date(edited).toLocaleString("en-GB", { minimumFractionDigits: 2 })}</div></div>`}
        `;

        const content = document.createElement("div");
        content.classList.add("summary-content");
        content.innerHTML = markup;

        // Clear loader and show details
        detailSummary.innerHTML = "";
        detailSummary.style.opacity = "";
        detailSummary.appendChild(content);

        // Save details to storage
        storedDetails = details;

    }

}

/**
* Get Specification Actions (Operations/Transitions)
*/
async function getActions(){

    try {

        // Get all Actions
        const actions = await client.getSpecificationActions(GROUP_ALIAS, QUERY_SPECIFICATION_ID);

        // Output Actions if: not stored (first run), objects don't match
        if (!storedActions || !objectsEqual(actions, storedActions)){

            // Clear existing Actions
            pageActions.innerHTML = "";

            // Output new Actions
            for (let actionIndex = 0; actionIndex < actions.length; actionIndex++) {

                const action = actions[actionIndex];
                const title = action.title;
                const name = action.name;
                const type = action.type;

                // Create button
                const button = document.createElement("button");
                button.classList.add("action-button");
                button.innerHTML = `
                    ${title}
                    <svg viewBox="0 0 512 512"><use xlink:href="#loading-spinner"/></svg>
                `;

                // Check type
                if (type === "Operation") {
                    renderOperation(name, button, action.queryMessages);
                } else {
                    renderTransition(name, button);
                }

            }

            pageActions.style.opacity = "";

            // Update stored Actions (to compare against)
            storedActions = actions;

        }

    } catch (error){
        handleGenericError(error);
    }

}

/**
* Render button to invoke a given Operation
*/
function renderOperation(name, button, messages){

    // Mark as Operation
    button.classList.add("action-operation");
    button.title = `Operation: ${name}`;

    // Attach click
    button.onclick = function () {

        // Show loading state
        button.classList.add("is-loading");

        // If messages are returned
        if (messages.length > 0){

            // Show confirmation message (after slight delay, to allow UI to show loading spinner)
            setTimeout(function() {

                const confirmation = window.confirm(`If you continue, the following actions will take place:\n${messages.join("\n")}`);

                if (confirmation) {
                    invokeOperation(name, button);
                } else {
                    button.classList.remove("is-loading");
                    return false;
                }

            }, 100);

        } else {

            // Just run the Operation
            invokeOperation(name, button);

        }

    };

    // Output
    pageActions.appendChild(button);

}

/**
* Render button to invoke a given Transition
*/
function renderTransition(name, button){

    // Mark as Transition
    button.classList.add("action-transition");
    button.title = `Transition: ${name}`;

    // Attach click
    button.onclick = () => {
        invokeTransition(name, button);
    };

    // Output
    pageActions.appendChild(button);

}

/**
* Invoke Operation (requires custom callback per operation)
*/
async function invokeOperation(operationName, button){

    try {

        await client.invokeOperation(GROUP_ALIAS, QUERY_SPECIFICATION_ID, operationName);

        // Refresh page to update content (causes redirect if deleted)
        location.reload();

    } catch (error){
        handleGenericError(error);
        window.alert("That Operation cannot be run at this time.");
    }

    // Remove processing state
    button.classList.remove("is-loading");

}

/**
* Invoke Transition (takes user to form running)
*/
async function invokeTransition(transitionName, button){

    // Show processing state
    button.classList.add("is-loading");

    try {

        // Run the Transition
        await client.invokeTransition(GROUP_ALIAS, QUERY_SPECIFICATION_ID, transitionName);

        // Redirect to form running, show transitioned state
        window.location.href = `run.html?specification=${QUERY_SPECIFICATION_ID}`;

    } catch (error){
        handleGenericError(error);
        alert("That Transition cannot be run at this time.");

        // Remove processing state
        button.classList.remove("is-loading");

    }

}

/**
* Get Specification Properties
*/
async function getProperties() {

    try {

        const properties = await client.getSpecificationProperties(GROUP_ALIAS, QUERY_SPECIFICATION_ID);

        // If Properties are returned (returns empty object if none set)
        if (properties && !isEmpty(properties)){

            // Render Properties if: not stored (first run), objects don't match
            if (!storedProperties || !objectsEqual(properties, storedProperties)){
                renderProperties(properties);
            }

        }

    } catch (error) {
        handleGenericError(error);
    }

}

/**
* Render Specification Properties
*/
function renderProperties(properties){

    // Clear out loading state
    detailProperties.innerHTML = "";

    // Get key/value array of Properties
    const propertyArray = Object.entries(properties);

    // Generate Property markup
    const propertyList = document.createElement("div");
    propertyList.classList.add("properties-content");

    for (const [name, value] of propertyArray) {

        const markup = `
            <div>${name}</div>
            <div>${value}</div>
        `;

        const item = document.createElement("div");
        item.classList.add("property-item");
        item.innerHTML = markup;

        propertyList.appendChild(item);

    }

    // Append items
    detailProperties.appendChild(propertyList);
    detailProperties.style.opacity = "";

    // Save Properties to storage (for future comparison)
    storedProperties = properties;

}

/**
* Get Specification Documents
*/
const documentTotalCount = document.getElementById("document-total-count");
const imageTotalCount = document.getElementById("image-total-count");

let imageCount, documentCount, generatingCount;

async function getDocuments() {

    try {

        // Get Documents
        const documents = await client.getSpecificationDocuments(GROUP_ALIAS, QUERY_SPECIFICATION_ID);

        // Empty state
        if (isEmpty(documents)){
            renderEmptyDocuments();
            return;
        }

        // Render Documents if:
        //  - Not stored (first run)
        //  - Objects don't match
        if (!storedDocuments || !objectsEqual(documents, storedDocuments)){
            renderDocuments(documents);
        }

    } catch (error) {
        handleGenericError(error);
    }

}

/**
* Render Specification Documents
*/
function renderDocuments(documents) {

    // Clear out existing Documents (replace rather than append, to ensure all changes are shown)
    imageCount = documentCount = generatingCount = 0;
    galleryImages.innerHTML = "";
    documentsList.innerHTML = "";

    const imageFormats = [".jpg", ".jpeg", ".png", ".gif"];

    // Loop over Documents
    for (item of documents) {

        // Skip if hidden
        if (item.isHidden) {
            continue;
        }

        // Detect images (for carousel)
        if ( imageFormats.indexOf(item.extension) >= 0 && item.fileExists ){
            renderImage(item);
            imageCount++;
        } else {
            renderDocument(item);
            documentCount++;
        }

    }

    // Show Documents (if available)
    if (documentCount === 0){
        renderEmptyDocuments();
    } else {
        showDocuments();
    }

    // Show images (if available)
    if (imageCount > 0) {
        showImages();
    }

    updateGeneratingMessage();

    // Store Documents (for future comparison)
    storedDocuments = documents;

}

/**
* Update the "documents generating" message (count)
*/
const generatingMessage = document.getElementById("documents-generating");
const generatingText = document.getElementById("generating-count");

function updateGeneratingMessage(){

    if (generatingCount > 0){
        generatingText.innerHTML = `${(documentCount - generatingCount) + 1}/${documentCount}`
        generatingMessage.style.display = "";
    } else {
        generatingText.innerHTML = "";
        generatingMessage.style.display = "none";
    }

}

/**
* Show image carousel
*/
function showImages(){

    // Update visual count
    imageTotalCount.innerHTML = imageCount;

    // Show gallery
    detailImages.classList.add("is-shown");

    // Fade in
    setTimeout(function () {

        detailImages.style.opacity = "";

        setupGallery(); // modules/image-gallery.js

    }, 100);

}

/**
* Show Document list
*/
function showDocuments(){

    // Update visual count
    documentTotalCount.innerHTML = documentCount;

    // Show list (with fade)
    detailDocuments.classList.add("is-shown");
    setTimeout(function () {
        detailDocuments.style.opacity = "";
    }, 100);

}

/**
* Render empty state
*/
function renderEmptyDocuments(){
    detailDocuments.innerHTML = '<div class="empty-documents">No documents available for this order at this time.</div>';
}

/**
* Render image to carousel
*/
function renderImage(image){

    const id = image.id;
    const displayName = image.name;
    const extension = image.extension
    const resourceName = displayName + extension;
    const imgUrl = client.getSpecificationDocumentUrl(GROUP_ALIAS, QUERY_SPECIFICATION_ID, id, resourceName);

    // Generate slide
    const slide = document.createElement("div");
    slide.classList.add("image-slide");

    const img = `<img src="${imgUrl}" alt="" />`;

    const button = document.createElement("button");
    button.setAttribute("title", "View larger");
    button.innerHTML = img;

    // Attach click event
    button.onclick = function () {

        openLightbox(imgUrl); // modules/lightbox.js

    };

    // Insert slide
    slide.appendChild(button);
    galleryImages.appendChild(slide);

}

/**
* Render Document item
*/
function renderDocument(file){

    const id = file.id;
    const dateCreated = file.dateCreated;
    const displayName = file.name;
    const extension = file.extension;
    const cleanExtension = extension.replace(".","");
    const resourceName = displayName + extension;
    const fileExists = file.fileExists;
    const documentUrl = client.getSpecificationDocumentUrl(GROUP_ALIAS, QUERY_SPECIFICATION_ID, id, resourceName);

    const fileStatus = fileExists ? "Ready" : "Generating";
    if (!fileExists){
        generatingCount++;
    }

    // Generate item
    const markup = `
        <div class="document-format">
            <div class="file-icon">
                <svg viewBox="0 0 512 512">
                    <use xlink:href="#file-blank" />
                </svg>
                <div class="file-extension type-${cleanExtension}">${cleanExtension}</div>
            </div>
        </div>
        <div class="document-details">
            <div class="document-name">${displayName}</div>
            <div class="document-created">
                Created: ${new Date(dateCreated).toLocaleString("en-GB", { minimumFractionDigits: 2 })}
                <span class="extension">[${extension}]</span>
            </div>
        </div>
        <div class="document-status is-${fileStatus.toLowerCase()}">
            ${fileStatus}
        </div>
    `;

    // Render item
    const item = document.createElement("div");
    item.classList.add("document-item");

    if (fileExists){

        const content = `
            <a href="${documentUrl}" target="_blank" title="View Document" class="view-link inner">
                ${markup}
            </a>
            <a href="${documentUrl}" download title="Download Document" class="download-link">
                <svg viewBox="0 0 512 512"><use xlink:href="#download-icon" /></svg>
            </a>
        `;

        item.classList.add("is-linked");
        item.innerHTML = content;

    } else {
        item.setAttribute("data-url", documentUrl);
        item.innerHTML = `<div class="inner">${markup}</div>`;
    }

    documentsList.appendChild(item);

}

/**
* Track sticky header
*/
const pageHeader = document.querySelector(".page-title");
const headerObserver = new IntersectionObserver(
    ([e]) => e.target.classList.toggle("is-stuck", e.intersectionRatio < 1),
    { threshold: [1] }
);
headerObserver.observe(pageHeader)

/**
* Handle invalid Session
*/
function handleInvalidSession(){
    showPageNotification("Your Session has expired.", true);
    clearTimeout(refreshTimeout);
}

/**
* Handle connection dropouts
*/
function handleNoConnection(){
    showPageNotification("No connection found.");
    clearTimeout(refreshTimeout);
}

/**
* Render Specification details
*/
function showPageNotification(notice, showAction){
    document.getElementById("notification-message").innerHTML = notice;
    document.getElementById("notification-container").classList.add("is-shown");
    if (showAction){
        document.getElementById("notification-action").classList.add("is-shown");
    }
}
document.getElementById("notification-action").addEventListener("click", redirectToLogin);
