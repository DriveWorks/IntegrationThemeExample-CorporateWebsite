/**
 * RUNNING SPECIFICATION
 */

// Get config
const SPECIFICATION_PING_INTERVAL = config.specificationPingInterval;

// Get url query
const URL_QUERY = new URLSearchParams(window.location.search);
const QUERY_PROJECT_NAME = URL_QUERY.get("project");
const QUERY_SPECIFICATION_ID = URL_QUERY.get("specification");

// Get elements
const CONTENT_NAVIGATION = document.getElementById("content-navigation");
const FORM_CONTAINER = document.getElementById("form-container");
const FORM_LOADING_STATE = document.getElementById("form-loading");

// Store Specification Id globally
let specificationId;

/**
 * Initialize Form on load
 */
(() => {

    // Detect existing or new Specification
    if (QUERY_SPECIFICATION_ID){
        renderExistingSpecification();
    } else if (QUERY_PROJECT_NAME) {
        createSpecification();
    } else {
        renderError("Invalid Project or Specification.");
    }

})();

/**
 * Display render error, redirect to Projects page
 */
function renderError(message, error){

    if (error){
        handleGenericError(error);
    }

    // Show visually error message
    FORM_LOADING_STATE.innerHTML = `
        <div class="run-error">
            <h3>${message}</h3>
            <p>Taking you back...</p>
        </div>
    `;

    // Redirect to Projects page
    setTimeout(function () {
        window.location.href = "projects.html";
    }, 1000);

}

/**
 * Create new Specification
 */
async function createSpecification() {

    const createError = "Error creating Specification.";

    try {

        // Create new Specification
        const specification = await client.createSpecification(GROUP_ALIAS, QUERY_PROJECT_NAME);
        if (!specification.id){
            renderError(createError);
        }

        // Render
        specificationId = specification.id;
        renderNewSpecification(specification);

    } catch (error) {
        renderError(createError, error);
    }

}

/**
 * Render new Specification to container
 */
async function renderNewSpecification(specification){

    // Render Form markup
    await specification.render(FORM_CONTAINER);
    const specForm = specification.specificationFormElement;

    // Set the default navigation state (open or closed)
    setNavigationState();

    // Get any custom assets for this Project
    loadCustomProjectAssets(QUERY_PROJECT_NAME);

    // Clear loading state (with delay to hide re-layout)
    removeLoadingState();

    attachSpecificationEvents(specForm);
    registerFormButtons(specification);

    // Listen for cancel & close/complete event
    specification.registerSpecificationClosedDelegate(() => formClosed());
    specification.registerSpecificationCancelledDelegate(() => formCancelled());

    // Start ping (keep Specification alive)
    pingSpecification(specification);

}

/**
 * Render existing Specification in current State (e.g. after Transition)
 */
async function renderExistingSpecification(){

    const existingError = "Error opening existing Specification.";

    try {

        // Get existing Specification
        const specification = await client.createSpecificationById(GROUP_ALIAS, QUERY_SPECIFICATION_ID);
        if (!specification.id){
            renderError(existingError);
            return;
        }

        // Render
        specificationId = specification.id;
        await specification.render(FORM_CONTAINER);
        const form = specification.specificationFormElement;

        // Set the default navigation state (open or closed)
        setNavigationState();

        // Get any custom assets for this project
        loadCustomProjectAssets();

        // Clear loading state (with delay to hide re-layout)
        removeLoadingState();

        // Register buttons & events
        attachSpecificationEvents(form);
        registerFormButtons(specification);
        specification.registerSpecificationClosedDelegate(() => transitionClosed());
        specification.registerSpecificationCancelledDelegate(() => transitionCancelled());

        // Start ping (keep Specification alive)
        pingSpecification(specification);

    } catch (error) {
        renderError(existingError, error);
    }

}

/**
 * Ping the running Specification
 *
 * A Specification will timeout after a configured period of inactivity (see DriveWorksConfigUser.xml).
 * This function prevents a Specification timing out as long as the page is in view.
 *
 * @param specification The Specification object.
 */
function pingSpecification(specification){

    // Disable ping if interval is 0
    if (SPECIFICATION_PING_INTERVAL === 0){
        return;
    }

    try {

        // Ping Specification to reset timeout
        specification.ping();

        // Schedule next ping
        setTimeout(pingSpecification, SPECIFICATION_PING_INTERVAL * 1000, specification);

    } catch (error) {
        handleGenericError(error);
    }

}

/**
 * Load additional Project assets (js/css)
 */
async function loadCustomProjectAssets(project){

    let projectName;

    // Use passed Project name, or get from Specification details
    if (project){
        projectName = project;
    } else {
        const specification = await client.getSpecificationById(GROUP_ALIAS, SPECIFICATION_ID);
        projectName = specification.originalProjectName;
    }

    // Clean Project name
    projectName = projectName.replace(" ", "-").toLowerCase();

    // Add class to body filename
    document.body.classList.add(`dw-project-${projectName}`);

    // Append extra scripts
    const script = document.createElement("script");
    script.src = `custom-project-assets/${projectName}.js`;
    if (fileExists(script.src)){
        document.head.appendChild(script);
    }

    // Append extra styles
    const style = document.createElement("link");
    style.setAttribute("rel", "stylesheet");
    style.setAttribute("type", "text/css");
    style.setAttribute("href", `custom-project-assets/${projectName}.css`);
    if (fileExists(style.href)){
        document.head.appendChild(style);
    }

}

/**
 * Detect external navigation (sidebar) display changes
 */
async function setNavigationState(formData){

    let showNav = false;

    // Use passed data (if available), or query
    if (formData){
        showNav = formData;
    } else {
        formData = await client.getSpecificationFormData(GROUP_ALIAS, specificationId);
        showNav = formData.form.showStandardNavigation;
    }

    // Update visual state
    showNav ? showNavigation() : hideNavigation();

}

/**
 * Listen for Form events
 */
function attachSpecificationEvents(specForm){

    specForm.addEventListener("FormUpdated", function (evt) {
        formUpdated(evt);
    });

    specForm.addEventListener("ActionsUpdated", function (evt) {
        renderSpecificationActions(evt);
    });

}

/**
 * Register Form Action buttons
 */
function registerFormButtons(specification){

    document.getElementById("specification-cancel-button").onclick = function () {
        specification.cancel();
    };

    specification.registerNextButton(document.getElementById("form-next-button"));
    specification.registerPreviousButton(document.getElementById("form-previous-button"));
    specification.registerOkButton(document.getElementById("dialog-ok-button"));
    specification.registerCancelButton(document.getElementById("dialog-cancel-button"));

}

/**
* Render Form Actions (Operation/Transition)
*/
const specActions = document.getElementById("spec-actions");

async function renderSpecificationActions(){

    // Get all actions
    const actions = await client.getSpecificationActions(GROUP_ALIAS, specificationId);

    // Output actions if: not stored (first run), objects don't match
    if (!isEmpty(actions)){

        // Clear out old actions
        specActions.innerHTML = "";

        for (let actionIndex = 0; actionIndex < actions.length; actionIndex++) {

            const action = actions[actionIndex];

            const name = action.name;
            const title = action.title;
            const type = action.type;

            // Create button
            const button = document.createElement("button");
            button.classList.add("action-button");
            button.innerHTML = title;

            // Check type
            if (type === "Operation") {
                renderOperationAction(name, button);
            } else {
                renderTransitionAction(name, button);
            }

        }

    }

    document.body.classList.add("actions-shown");

}

/**
* Render Operation
*/
function renderOperationAction(name, button){

    // Visually mark as Operation
    button.classList.add("action-operation");

    // Attach click
    button.onclick = function () {
        invokeOperation(name);
    };

    // Output
    specActions.appendChild(button);

}

/**
* Render Transition
*/
function renderTransitionAction(name, button){

    // Visually mark as Transition
    button.classList.add("action-transition");

    // Attach click
    button.onclick = function () {
        invokeTransition(name);
    };

    // Output
    specActions.appendChild(button);

}

/**
* Invoke Operation (requires custom callback per Operation)
*/
async function invokeOperation(operationName){

    try {

        await client.invokeOperation(GROUP_ALIAS, specificationId, operationName);

    } catch (error){
        handleGenericError(error);
    }

}

/**
* Invoke Transition
*/
async function invokeTransition(transitionName){

    try {

        await client.invokeTransition(GROUP_ALIAS, specificationId, transitionName);

        window.location.href = `details.html?specification=${specificationId}`;

    } catch (error){
        handleGenericError(error);
    }

}

/**
 * Triggers on Form update
 */
function formUpdated(evt) {

    // Update navigation state (may have changed)
    setNavigationState(evt.detail.specData.showStandardNavigation);

}

/**
 * Triggers on Form close
 */
function formClosed() {
    window.location.href = `${config.project.redirectOnClose}?specification=${specificationId}`;
}

/**
 * On Form cancel
 */
function formCancelled() {
    window.location.href = config.project.redirectOnCancel;
}

/**
 * On Transition close
 */
function transitionClosed(){
    window.location.href = `details.html?specification=${specificationId}`;
}

/**
 * On Transition cancel
 */
function transitionCancelled() {
    window.location.href = `details.html?specification=${specificationId}`;
}

/**
 * Hide Form loading state
 */
function removeLoadingState(){

    // Delay to hide Form re-layout
    setTimeout(function () {

        FORM_LOADING_STATE.style.opacity = "0";

        setTimeout(function () {
            FORM_LOADING_STATE.remove();
        }, 350);

    }, 500);

}

function showNavigation(){

    CONTENT_NAVIGATION.style.display = "";
    document.body.classList.add("has-navigation");

    window.dispatchEvent(new Event("resize"));

}

function hideNavigation(){

    CONTENT_NAVIGATION.style.display = "none";
    document.body.classList.remove("has-navigation");

    window.dispatchEvent(new Event("resize"));

}

/**
 * Get Form data (for debugging)
 */
async function getFormData() {
    const formData = await client.getSpecificationFormData(GROUP_ALIAS, specificationId);
    console.log(formData);
}

/**
 * Check for existance of additional files
 */
function fileExists(url){

    const http = new XMLHttpRequest();
    http.open("HEAD", url, false);
    http.send();

    if (http.status === 200){
        console.log(`Additional file loaded: ${url}`);
        return true;
    }

    console.log(`Could not find file: ${url}`);
    console.log("Create this file to apply additional functionality.");

    return false;
}
