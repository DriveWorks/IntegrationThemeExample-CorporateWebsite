/**
 * SPECIFICATION DETAILS
 */

// Get config
const DETAILS_UPDATE_INTERVAL = config.details.updateInterval * 1000;

// Get current Specification Id (passed via URL query)
const URL_QUERY = new URLSearchParams(window.location.search);
const QUERY_SPECIFICATION_ID = URL_QUERY.get("specification");

// Get page elements
const pageTitle = document.getElementById("page-title");
const pageActions = document.getElementById("page-actions");

const detailHeader = document.getElementById("detail-header");
const detailSummary = document.getElementById("detail-summary");
const detailProperties = document.getElementById("detail-properties");

const detailDocuments = document.getElementById("detail-documents");
const documentsList = document.getElementById("documents-list");

const detailImages = document.getElementById("detail-images");
const galleryImages = document.getElementById("gallery-images");

const documentTotalOutput = document.getElementById("document-total-count");
const imageTotalOutput = document.getElementById("image-total-count");

const generatingMessage = document.getElementById("documents-generating");
const generatingText = document.getElementById("generating-count");

// Store data, for comparison on change
const renderedImages = [];
let storedSpecification;
let storedActions;
let storedProperties;
let storedDocuments;
let refreshTimeout;
let firstRun = true;
let imagesShown = false;
let imageCount = 0;
let documentCount = 0;
let generatingCount = 0;

/**
 * On page load.
 */
(async function () {

    // Show error if no Specification Id passed
    if (!QUERY_SPECIFICATION_ID) {
        pageTitle.innerHTML = "No Specification Id provided.";
        pageTitle.style.opacity = "";
        return;
    }
})();

/**
 * Start page functions.
 */
function startPageFunctions() {
    setClientDelegates();
    constructDetails();
}

/**
 * Set client delegates.
 */
function setClientDelegates() {

    // Handle client errors manually (custom, advanced handling)
    client.responseErrorDelegate = (res) => {
        customErrorHandler(res);
    }
}

/**
 * Handle DriveWorks client errors with additional custom logic.
 *
 * @param {Object} response - Request response object.
 */
function customErrorHandler(response) {
    const statusCode = response.status;
    switch (statusCode) {

        // Not found
        case 404:

            // Specification Id not found, show visual error
            if (firstRun) {
                pageTitle.innerHTML = "Invalid Specification ID.";
                pageTitle.style.opacity = "";
                return true;
            }

            // Let the DriveWorks SDK handle the error further as default
            return false;

        // Unauthorized
        case 401:

            // Logout if run on page load
            if (firstRun) {
                handleUnauthorizedUser();
                return true;
            }

            // Show session expired message, but keep page open 'read only'
            handleInvalidSession();

            // Let the DriveWorks SDK handle the error further as default
            return false;

        // Let the DriveWorks SDK handle all other errors
        default:
            return false;
    }
}

/**
 * Construct Specification details.
 */
async function constructDetails() {
    try {

        // Get Specification details
        const specification = await client.getSpecificationById(GROUP_ALIAS, QUERY_SPECIFICATION_ID);

        // If Specification returns undefined, logout (no connection so no response)
        // If no/an invalid Specification Id is provided, a text error message is returned.
        if (!specification) {

            // Logout if run on page load
            if (firstRun) {
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
        setTimeout(function () {
            constructDetails();
        }, DETAILS_UPDATE_INTERVAL);

        // Show add action
        appendNewSpecificationAction(specification.originalProjectName);

        firstRun = false;
    } catch (error) {
        handleGenericError(error);
    }
}

/**
 * Render Specification details.
 *
 * @param {Object} specification - DriveWorks Specification object.
 */
async function renderDetails(specification) {

    // Output Specification details if: not stored (first run), objects don't match
    if (!storedSpecification || !objectsEqual(specification, storedSpecification)) {
        const name = specification.name;
        const status = specification.stateName;
        const dateCreated = localizedDateTimeString(specification.dateCreated);
        const dateEdited = localizedDateTimeString(specification.dateEdited);

        // Save Specification details to storage
        storedSpecification = specification;

        // Set page title
        pageTitle.innerHTML = name;
        pageTitle.style.opacity = "";

        // Generate details
        const markup = `
            ${status && `<div class="detail-item detail-status"><div>Status</div><div class="status-tag status-${normalizeString(status)}" title="${splitOnUpperCase(status)}">${splitOnUpperCase(status)}</div></div>`}
            ${dateCreated && `<div class="detail-item detail-created"><div>Created</div><div>${dateCreated}</div></div>`}
            ${dateEdited && `<div class="detail-item detail-edited"><div>Modified</div><div>${dateEdited}</div></div>`}
        `;

        const content = document.createElement("div");
        content.classList.add("summary-content");
        content.innerHTML = markup;

        // Clear loader and show details
        detailSummary.innerHTML = "";
        detailSummary.style.opacity = "";
        detailSummary.appendChild(content);
    }
}

/**
 * Append "New Specification" action, if the user has the required permission.
 *
 * @param {string} originalProjectName - Name of DriveWorks Project this Specification was created from.
 */
async function appendNewSpecificationAction(originalProjectName) {
    if (config.details.showStartNewSpecificationAction !== true || !firstRun) {
        return;
    }

    // Confirm if user can run this Project
    const matchingProjectCount = (await client.getProjects(GROUP_ALIAS, `$filter=name eq '${originalProjectName}'`)).length;
    if (matchingProjectCount === 0) {
        return;
    }

    // Append "New" action
    const action = document.createElement("a");
    action.innerHTML = `
        <svg class="icon"><use xlink:href="dist/icons.svg#plus" /></svg>
        <span>New</span>
    `;
    action.classList = "new-button button";
    action.href = `run.html?project=${originalProjectName}`;
    action.title = "Start new Specification"
    detailHeader.appendChild(action);
}

/**
 * Get Specification Actions - Operations/Transitions.
 */
async function getActions() {
    try {

        // Get all Actions
        const actions = await client.getSpecificationActions(GROUP_ALIAS, QUERY_SPECIFICATION_ID);

        // Output Actions if: not stored (first run), objects don't match
        if (!storedActions || !objectsEqual(actions, storedActions)) {

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
                    <svg class="icon"><use xlink:href="dist/icons.svg#loading"/></svg>
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
    } catch (error) {
        handleGenericError(error);
    }
}

/**
 * Render button to invoke a given Operation.
 *
 * @param {string} name - The name of the Operation.
 * @param {Object} button - The HTML button element that triggers the Operation.
 * @param {string[]} messages - The array of query messages returned when requesting the Operation.
 */
function renderOperation(name, button, messages) {

    // Mark as Operation
    button.classList.add("action-operation");
    button.title = `Operation: ${name}`;

    // Attach click
    button.onclick = function () {

        // Show loading state
        button.classList.add("is-loading");

        // If messages are returned
        if (messages.length > 0) {

            // Show confirmation message (after slight delay, to allow UI to show loading spinner)
            setTimeout(function () {
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
 * Render button to invoke a given Transition.
 *
 * @param {string} name - The name of the Transition.
 * @param {Object} button - The button element that triggered the Transition.
 */
function renderTransition(name, button) {

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
 * Invoke Operation - reload page to show changes.
 *
 * @param {string} name - The name of the Operation.
 * @param {Object} button - The button element that invoked the Operation.
 */
async function invokeOperation(name, button) {
    try {
        await client.getSpecificationOperationByName(GROUP_ALIAS, QUERY_SPECIFICATION_ID, name);
        await client.invokeOperation(GROUP_ALIAS, QUERY_SPECIFICATION_ID, name);

        // Refresh page to update content (causes redirect if deleted)
        location.reload();
    } catch (error) {
        handleGenericError(error);
        window.alert("That Operation cannot be run at this time.");
    }

    // Remove processing state
    button.classList.remove("is-loading");
}

/**
 * Invoke Transition - redirect to running Form.
 *
 * @param {string} name - The name of the Transition.
 * @param {Object} button - The button element that invoked the Transition.
 */
async function invokeTransition(name, button) {

    // Show processing state
    button.classList.add("is-loading");

    try {

        // Run the Transition
        await client.getSpecificationTransitionByName(GROUP_ALIAS, QUERY_SPECIFICATION_ID, name);
        await client.invokeTransition(GROUP_ALIAS, QUERY_SPECIFICATION_ID, name);

        // Check Specification state following Transition
        const newStateTypeId = await getStateTypeId();
        if (isRunningState(newStateTypeId)) {
            // Redirect to running Form, showing state following Transition
            window.location.href = `run.html?specification=${QUERY_SPECIFICATION_ID}`;
            return;
        }

        // Update details without refresh/redirect
        constructDetails();

    } catch (error) {
        handleGenericError(error);
        alert("That Transition cannot be run at this time.");

        // Remove processing state
        button.classList.remove("is-loading");
    }
}

/**
 * Get id of current Specification State Type.
 */
async function getStateTypeId() {
    const specification = await client.getSpecificationById(GROUP_ALIAS, QUERY_SPECIFICATION_ID);
    return specification.stateType;
}

/**
 * Check if State Type is running.
 *
 * @param {number|string} stateType - State Type name or numerical id.
 */
function isRunningState(stateType) {
    const RUNNING_STATE_TYPE_ID = 0;

    if (stateType === "Running" || stateType === RUNNING_STATE_TYPE_ID) {
        return true;
    }
    return false;
}

/**
 * Get Specification Properties.
 */
async function getProperties() {
    try {
        const properties = await client.getSpecificationProperties(GROUP_ALIAS, QUERY_SPECIFICATION_ID);

        // If Properties are returned (returns empty object if none set)
        if (properties && !isEmpty(properties)) {

            // Render Properties if: not stored (first run), objects don't match
            if (!storedProperties || !objectsEqual(properties, storedProperties)) {
                renderProperties(properties);
            }
        }
    } catch (error) {
        handleGenericError(error);
    }
}

/**
 * Render Specification Properties.
 *
 * @param {Object} properties - An object containing Specification Properties.
 */
function renderProperties(properties) {

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
        item.classList.add("property-item", `property-${normalizeString(name)}`);
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
 * Get Specification Documents.
 */
async function getDocuments() {
    try {

        // Get Documents
        const documents = await client.getSpecificationDocuments(GROUP_ALIAS, QUERY_SPECIFICATION_ID);

        // Empty state
        if (isEmpty(documents)) {
            renderEmptyDocuments();
            return;
        }

        // Render Documents if:
        // - Nothing stored (first load)
        // - New Documents returned (objects don't match)
        if (!storedDocuments || !objectsEqual(documents, storedDocuments)) {
            renderDocuments(documents);
        }

    } catch (error) {
        handleGenericError(error);
    }
}

/**
 * Render Specification Documents.
 *
 * @param {Object} documents - An object containing Specification Documents (DocumentData).
 */
function renderDocuments(documents) {
    const imageFormats = [".jpg", ".jpeg", ".png", ".gif"];
    const specificationImages = [];

    // Clear out existing Documents (replace rather than append, to ensure all changes are shown)
    documentCount = generatingCount = 0;
    documentsList.innerHTML = "";

    // Loop over Documents
    for (item of documents) {

        // Skip if hidden
        if (item.isHidden) {
            continue;
        }

        // Detect images (to extract into gallery view)
        if (imageFormats.indexOf(item.extension.toLowerCase()) >= 0 && item.fileExists) {
            specificationImages.push(item);
        } else {
            renderDocument(item);
            documentCount++;
        }
    }

    // Show documents
    showDocuments();

    // Show image documents (if available)
    if (specificationImages.length > 0) {

        if (!imagesShown) {
            showImages();
        }

        for (const image of specificationImages) {
            if (renderedImages.includes(image.id)) {
                continue;
            }

            imageCount++;
            renderImage(image);
            renderedImages.push(image.id);
        }
    }

    // Store Documents (for future comparison)
    storedDocuments = documents;
}

/**
 * Update the "documents generating" message count.
 */
function updateGeneratingMessage() {
    if (generatingCount > 0) {
        generatingText.innerHTML = `${(documentCount - generatingCount) + 1}/${documentCount}`;
        generatingMessage.style.display = "";
        return;
    }

    generatingText.innerHTML = "";
    generatingMessage.style.display = "none";
}

/**
 * Show image carousel.
 */
function showImages() {
    imagesShown = true;

    // Show image section
    detailImages.classList.add("is-shown");
    setTimeout(() => detailImages.style.opacity = "", 100); // Slight delay allows animation to play

    // Setup gallery carousel - modules/image-gallery.js
    setupGallery();
}

/**
 * Show Document list.
 */
function showDocuments() {
    updateGeneratingMessage();

    // Update visual count
    documentTotalOutput.innerHTML = documentCount;

    // Show documents (with fade)
    detailDocuments.style.opacity = "";
}

/**
 * Render empty state.
 */
function renderEmptyDocuments() {
    documentsList.innerHTML = '<div class="empty-documents">No documents available at this time.</div>';
    detailDocuments.style.opacity = "";
}

/**
 * Render image to carousel.
 *
 * @param {Object} image - An object representing the carousel image.
 */
async function renderImage(image) {
    const id = image.id;
    const displayName = image.name;
    const extension = image.extension
    const resourceName = displayName + extension;
    const imgUrl = await client.getSpecificationDocumentUrl(GROUP_ALIAS, QUERY_SPECIFICATION_ID, id, resourceName);

    // Generate slide
    const slide = document.createElement("div");
    slide.classList.add("image-slide");

    // Generate contents
    const button = document.createElement("button");
    const img = `<img src="${imgUrl}" alt="" loading="lazy" draggable="false" />`;
    button.innerHTML = img;
    button.setAttribute("title", "View larger");
    button.onclick = () => openLightbox(imgUrl); // modules/lightbox.js
    slide.appendChild(button);

    // Append slide to gallery
    galleryImages.appendChild(slide);

    updateImageCount();
    detectGalleryOverflow();
}

/**
 * Update rendered total image count.
 */
function updateImageCount() {
    imageTotalOutput.innerHTML = imageCount;
}

/**
 * Render Document item.
 *
 * @param {Object} file - An object representing a single Specification Document.
 */
function renderDocument(file) {
    const id = file.id;
    const dateCreated = file.dateCreated;
    const displayName = file.name;
    const extension = file.extension;
    const cleanExtension = extension.replace(".", "");
    const resourceName = displayName + extension;
    const fileExists = file.fileExists;
    const documentUrl = client.getSpecificationDocumentUrl(GROUP_ALIAS, QUERY_SPECIFICATION_ID, id, resourceName);

    const fileStatus = fileExists ? "Ready" : "Generating";
    if (!fileExists) {
        generatingCount++;
    }

    // Generate item
    const markup = `
        <div class="document-format">
            <div class="file-icon">
                <svg class="icon"><use xlink:href="dist/icons.svg#file-blank" /></svg>
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

    if (fileExists) {
        const content = `
            <a href="${documentUrl}" target="_blank" title="View Document" class="view-link inner">
                ${markup}
            </a>
            <a href="${documentUrl}" download title="Download Document" class="download-link">
                <svg class="icon"><use xlink:href="dist/icons.svg#download" /></svg>
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
 * Track sticky header.
 */
const pageHeader = document.querySelector(".page-title");
const headerObserver = new IntersectionObserver(
    ([e]) => e.target.classList.toggle("is-stuck", e.intersectionRatio < 1),
    { threshold: [1] }
);
headerObserver.observe(pageHeader);

/**
 * Handle invalid Session.
 */
function handleInvalidSession() {
    showPageNotification("Your Session has expired.", true);
    clearTimeout(refreshTimeout);
}

/**
 * Handle connection dropouts.
 */
function handleNoConnection() {
    showPageNotification("No connection found.");
    clearTimeout(refreshTimeout);
}

/**
 * Show fixed notification above page content.
 *
 * @param {string} notice - The message to display inside the notification.
 * @param {boolean} showAction - Toggle display of action inside the notification.
 */
function showPageNotification(notice, showAction) {
    document.getElementById("notification-message").innerHTML = notice;
    document.getElementById("notification-container").classList.add("is-shown");
    if (showAction) {
        document.getElementById("notification-action").classList.add("is-shown");
    }
}
document.getElementById("notification-action").addEventListener("click", redirectToLogin);
