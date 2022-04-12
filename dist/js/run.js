/**
 * RUNNING SPECIFICATION
 */

// Get config
const SPECIFICATION_PING_INTERVAL = config.specificationPingInterval;

// Get URL query values
const URL_QUERY = new URLSearchParams(window.location.search);
const QUERY_PROJECT_NAME = URL_QUERY.get("project");
const QUERY_SPECIFICATION_ID = URL_QUERY.get("specification");
const QUERY_DRIVE_APP_ALIAS = URL_QUERY.get("driveApp");

const QUERY_PREFIX_CONSTANTS = "DWConstant";
const QUERY_PREFIX_MACROS = "DWMacro";
const specificationQueryParameters = [];
for (const [key, value] of URL_QUERY) {

    // Constant to update (name, value)
    if (key.startsWith(QUERY_PREFIX_CONSTANTS)) {
        specificationQueryParameters.push({
            type: QUERY_PREFIX_CONSTANTS,
            name: key.replace(QUERY_PREFIX_CONSTANTS, ""),
            value: value
        });
    }

    // Macro to run (name, argument [optional])
    if (key.startsWith(QUERY_PREFIX_MACROS)) {
        specificationQueryParameters.push({
            type: QUERY_PREFIX_MACROS,
            name: key.replace(QUERY_PREFIX_MACROS, ""),
            argument: value
        });
    }
}

// Get elements
const CONTENT_NAVIGATION = document.getElementById("content-navigation");
const FORM_CONTAINER = document.getElementById("form-container");
const FORM_LOADING_STATE = document.getElementById("form-loading");
const SPECIFICATION_ACTIONS = document.getElementById("spec-actions");

// Store Specification Id globally
let specificationId;

// Detect current config type based on query values
let currentConfig = config.project;
if (QUERY_DRIVE_APP_ALIAS) {
    currentConfig = config.driveApp;
}

/**
 * Start page functions.
 */
function startPageFunctions() {
    setCustomClientErrorHandler();

    // Show confirmation dialog before logout
    if (config.run.showWarningOnExit) {
        enableLogoutConfirmation();
    }

    // Detect required values
    if (!QUERY_SPECIFICATION_ID && !QUERY_PROJECT_NAME && !QUERY_DRIVE_APP_ALIAS) {
        renderError("Invalid Specification Id, Project name or DriveApp alias.");
        return;
    }

    // Existing Specification
    if (QUERY_SPECIFICATION_ID) {
        renderExistingSpecification();
        return;
    }

    // New Specification
    if (QUERY_PROJECT_NAME) {
        createSpecification();
        return;
    }

    // New DriveApp
    if (QUERY_DRIVE_APP_ALIAS) {
        createDriveAppSpecification();
        return;
    }
}

/**
 * Display error when rendering. Redirect after short delay.
 * 
 * @param {string} message - The message display on the login screen.
 * @param {Object} [error] - The error thrown.
 */
function renderError(message, error = null) {
    if (error) {
        handleGenericError(error);
    }

    // Show visually error message
    FORM_LOADING_STATE.innerHTML = `
        <div class="run-error">
            <h3>${message}</h3>
            <p>Taking you back...</p>
        </div>
    `;

    // Redirect to configured cancel location
    setTimeout(function () {
        window.location.href = currentConfig.redirectOnCancel;
    }, 1000);
}

/**
 * Create new Specification.
 */
async function createSpecification() {
    const createError = "Error creating Specification.";
    setTabTitle(QUERY_PROJECT_NAME);

    try {

        // Create new Specification
        const specification = await client.createSpecification(GROUP_ALIAS, QUERY_PROJECT_NAME);
        if (!specification.id) {
            renderError(createError);
        }
        specificationId = specification.id;

        // Render
        renderNewSpecification(specification);
    } catch (error) {
        renderError(createError, error);
    }
}

/**
 * Create new DriveApp Specification.
 */
async function createDriveAppSpecification() {
    const createError = "Error creating DriveApp Specification.";
    setTabTitle(QUERY_DRIVE_APP_ALIAS);

    try {

        // Create new DriveApp Specification
        const driveAppSpecification = await client.runDriveApp(GROUP_ALIAS, QUERY_DRIVE_APP_ALIAS);
        if (!driveAppSpecification.id) {
            renderError(createError);
        }
        specificationId = driveAppSpecification.id;

        // Render
        renderNewSpecification(driveAppSpecification, false);
    } catch (error) {
        renderError(createError, error);
    }
}

/**
 * Render new Specification to container.
 * 
 * @param {Object} specification - DriveWorks Specification object.
 */
async function renderNewSpecification(specification, showSpecificationNameInTitle = true) {

    // Process Specification parameters from query (if supplied)
    await processSpecificationQueryParameters();

    // Render Form markup
    await specification.render(FORM_CONTAINER);
    const formElement = specification.specificationFormElement;

    // [OPTIONAL] Show warning dialog when exiting page after Form renders
    attachPageUnloadDialog();

    // Set the default navigation state (open or closed)
    setNavigationState();

    // Get any custom assets for this Project
    loadCustomProjectAssets(QUERY_PROJECT_NAME);

    // Clear loading state (with delay to hide re-layout)
    removeLoadingState();

    attachSpecificationEvents(formElement);
    registerFormButtons(specification);

    // Listen for cancel & close/complete event
    specification.registerSpecificationClosedDelegate(() => formClosed());
    specification.registerSpecificationCancelledDelegate(() => formCancelled());

    // Start ping (keep Specification alive)
    pingSpecification(specification);

    // [OPTIONAL] Show Specification Name in browser tab title
    if (showSpecificationNameInTitle) {
        setTabTitleSpecificationName(specification);
    }
}

/**
 * Render existing Specification in current State e.g. after Transition.
 */
async function renderExistingSpecification() {
    const existingError = "Error opening existing Specification.";
    setTabTitle(QUERY_SPECIFICATION_ID);

    try {

        // Get existing Specification
        const specification = await client.createSpecificationById(GROUP_ALIAS, QUERY_SPECIFICATION_ID);
        if (!specification.id) {
            renderError(existingError);
            return;
        }
        specificationId = specification.id;

        // Process Specification parameters from query (if supplied)
        await processSpecificationQueryParameters();

        // Render Form markup
        await specification.render(FORM_CONTAINER);
        const formElement = specification.specificationFormElement;

        // [OPTIONAL] Show warning dialog when exiting page after Form renders
        attachPageUnloadDialog();

        // Set the default navigation state (open or closed)
        setNavigationState();

        // [OPTIONAL] Load matching custom assets for this Project name
        loadCustomProjectAssets();

        // Clear loading state (with delay to hide re-layout)
        removeLoadingState();

        // Register buttons & events
        attachSpecificationEvents(formElement);
        registerFormButtons(specification);
        specification.registerSpecificationClosedDelegate(() => existingSpecificationClosed());
        specification.registerSpecificationCancelledDelegate(() => existingSpecificationCancelled());

        // Start ping (keep Specification alive)
        pingSpecification(specification);

        // [OPTIONAL] Show Specification Name in browser tab title
        setTabTitleSpecificationName(specification);
    } catch (error) {
        renderError(existingError, error);
    }
}

/**
 * Ping the running Specification.
 *
 * A Specification will timeout after a configured period of inactivity (see DriveWorksConfigUser.xml).
 * This function prevents a Specification timing out as long as the page is in view.
 *
 * @param {Object} specification - The Specification object.
 */
function pingSpecification(specification) {

    // Disable ping if interval is 0
    if (SPECIFICATION_PING_INTERVAL === 0) {
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
 * Load additional Project assets (JS/CSS).
 * 
 * Enables custom scripts or styles to be loaded per Project.
 * These can be used to expand functionality, or create advanced Control styles.
 * 
 * @param {string} project - The name of the Project to load matching assets.
 */
async function loadCustomProjectAssets(project) {
    const customAssetsFolder = "custom-project-assets";
    let projectName;

    // Use Project name passed in, or retrieve from Specification details
    if (project) {
        projectName = project;
    } else {
        const specification = await client.getSpecificationById(GROUP_ALIAS, specificationId);
        projectName = specification.originalProjectName;
    }

    // Clean Project name
    const cleanProjectName = normalizeString(projectName);

    // Add class to body filename
    document.body.classList.add(`dw-project-${cleanProjectName}`);

    // Load custom assets
    const assetPath = `${customAssetsFolder}/${cleanProjectName}`;
    await Promise.allSettled([
        loadCustomStyles(assetPath),
        loadCustomScripts(assetPath)
    ]);
}

/**
 * Append additional script file.
 * 
 * @param {string} path - The path of the custom script.
 */
async function loadCustomScripts(path) {
    const filePath = `${path}.js`;
    const validScripts = await fileExists(filePath);
    if (!validScripts) {
        return;
    }

    const script = document.createElement("script");
    script.src = filePath;
    document.head.appendChild(script);
}

/**
 * Append additional stylesheet.
 * 
 * @param {string} path - The path of the custom stylesheet.
 */
async function loadCustomStyles(path) {
    const filePath = `${path}.css`;
    const validStyles = await fileExists(filePath);
    if (!validStyles) {
        return;
    }

    const style = document.createElement("link");
    style.setAttribute("rel", "stylesheet");
    style.setAttribute("type", "text/css");
    style.setAttribute("href", filePath);
    document.head.appendChild(style);
}

/**
 * Detect external navigation (sidebar) display changes.
 * 
 * @param {boolean} [showNavigation] - Set navigation to be open (true) or closed (false).
 */
async function setNavigationState(showNavigation = null) {

    // If no state provided, query from server
    if (showNavigation == null) {
        const formData = await client.getSpecificationFormData(GROUP_ALIAS, specificationId);
        showNavigation = formData.form.showStandardNavigation;
    }

    // Update visual state
    showNavigation ? showFormNavigation() : hideFormNavigation();
}

/**
 * Listen for Form events.
 * 
 * @param {Object} formElement - Specification Form element.
 */
function attachSpecificationEvents(formElement) {
    formElement.addEventListener("FormUpdated", event => formUpdated(event));
    formElement.addEventListener("ActionsUpdated", event => renderSpecificationActions(event));
}

/**
 * Cancel Specification.
 */
async function cancelSpecification() {
    detachPageUnloadDialog();
    await client.cancelSpecification(GROUP_ALIAS, specificationId);
}

/**
 * Register Form Action buttons
 */
function registerFormButtons(specification) {

    // Cancel button
    document.getElementById("specification-cancel-button").onclick = () => {
        if (config.run.showWarningOnExit) {
            showConfirmationDialog(cancelSpecification);
            return;
        }

        cancelSpecification();
    };

    // Form navigation buttons
    specification.registerNextButton(document.getElementById("form-next-button"));
    specification.registerPreviousButton(document.getElementById("form-previous-button"));
    specification.registerOkButton(document.getElementById("dialog-ok-button"));
    specification.registerCancelButton(document.getElementById("dialog-cancel-button"));
}

/**
 * Render Form Actions - Operations/Transitions.
 */
async function renderSpecificationActions() {

    // Get all actions
    const actions = await client.getSpecificationActions(GROUP_ALIAS, specificationId);

    // Output actions if: not stored (first run), objects don't match
    if (!isEmpty(actions)) {

        // Clear out old actions
        SPECIFICATION_ACTIONS.innerHTML = "";

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
 * Render Operation.
 * 
 * @param {string} name - The name of the Operation.
 * @param {Object} button - The button to attach click events.
 */
function renderOperationAction(name, button) {

    // Visually mark as Operation
    button.classList.add("action-operation");

    // Attach click
    button.onclick = () => invokeOperation(name);

    // Output button
    SPECIFICATION_ACTIONS.appendChild(button);
}

/**
 * Render Transition.
 * 
 * @param {string} name - The name of the Transition.
 * @param {Object} button - The button to attach click events.
 */
function renderTransitionAction(name, button) {

    // Visually mark as Transition
    button.classList.add("action-transition");

    // Attach click
    button.onclick = () => invokeTransition(name);

    // Output button
    SPECIFICATION_ACTIONS.appendChild(button);
}

/**
 * Process Macro and Constant data passed as query parameters.
 */
async function processSpecificationQueryParameters() {
    for (const parameter of specificationQueryParameters) {
        switch (parameter.type) {
            case QUERY_PREFIX_CONSTANTS:
                await driveConstant(parameter);
                break;
            case QUERY_PREFIX_MACROS:
                await runMacro(parameter);
                break;
        }
    }
}

/**
 * Drive Constant value.
 * @param {Object} constant - Object containing the Constant name and value.
 */
async function driveConstant(constant) {
    const constantName = constant.name;
    const constantValue = constant.value;

    try {
        await client.getSpecificationConstantByName(GROUP_ALIAS, specificationId, constantName);
        await client.updateConstantValue(GROUP_ALIAS, specificationId, constantName, constantValue);
    } catch (error) {
        console.log(error);
        console.log(`Unable to set the value of Constant '${constantName}' to '${constantValue}'.`);
    }
}

/**
 * Run a Macro.
 * @param {Object} macro - Object containing the Macro name and argument.
 */
async function runMacro(macro) {
    const macroName = macro.name;
    const macroArgument = macro.argument;

    try {
        await client.runMacro(GROUP_ALIAS, specificationId, {
            macroName: macroName,
            macroArgument: macroArgument
        });
    } catch (error) {
        console.log(error);
        console.log(`Unable to run Macro '${macroName}'. ${macroArgument ? `(Argument: ${macroArgument})` : "(No argument specified)"}`);
    }
}

/**
 * Invoke Operation.
 * 
 * @param {string} operationName - The name of the Operation to invoke.
 */
async function invokeOperation(operationName) {
    try {
        await client.getSpecificationOperationByName(GROUP_ALIAS, specificationId, operationName);
        await client.invokeOperation(GROUP_ALIAS, specificationId, operationName);
    } catch (error) {
        handleGenericError(error);
    }
}

/**
 * Invoke Transition.
 * 
 * @param {string} transitionName - The name of the Transition to invoke.
 */
async function invokeTransition(transitionName) {
    try {
        await client.getSpecificationTransitionByName(GROUP_ALIAS, specificationId, transitionName);
        await client.invokeTransition(GROUP_ALIAS, specificationId, transitionName);

        detachPageUnloadDialog();
        window.location.href = `${currentConfig.redirectOnClose}?specification=${specificationId}`;
    } catch (error) {
        handleGenericError(error);
    }
}

/**
 * Triggers on Form update.
 * 
 * @param {Object} event - FormUpdated event object.
 */
function formUpdated(event) {

    // Update navigation state (may have changed)
    const navState = event.detail.specData.showStandardNavigation;
    setNavigationState(navState);
}

/**
 * Form closed.
 */
function formClosed() {
    detachPageUnloadDialog();
    window.location.href = `${currentConfig.redirectOnClose}?specification=${specificationId}`;
}

/**
 * Form cancelled.
 */
function formCancelled() {
    detachPageUnloadDialog();
    window.location.href = currentConfig.redirectOnCancel;
}

/**
 * Existing Specification closed.
 */
function existingSpecificationClosed() {
    detachPageUnloadDialog();
    window.location.href = `${currentConfig.redirectOnClose}?specification=${specificationId}`;
}

/**
 * Existing Specification cancelled.
 */
function existingSpecificationCancelled() {
    window.location.href = `${currentConfig.redirectOnClose}?specification=${specificationId}`;
}

/**
 * Hide Form loading state.
 */
function removeLoadingState() {

    // Delay to mask initial Form re-layout
    setTimeout(function () {
        FORM_LOADING_STATE.style.opacity = "0";

        setTimeout(function () {
            FORM_LOADING_STATE.remove();
        }, 350);
    }, 500);
}

/**
 * Show Form sidebar navigation - containing available Actions.
 */
function showFormNavigation() {
    CONTENT_NAVIGATION.style.display = "";
    document.body.classList.add("has-navigation");

    // Ensure Form size updates when content width changes
    window.dispatchEvent(new Event("resize"));
}

/**
 * Hide Form sidebar navigation - containing available Actions.
 */
function hideFormNavigation() {
    CONTENT_NAVIGATION.style.display = "none";
    document.body.classList.remove("has-navigation");

    // Ensure Form size updates when content width changes
    window.dispatchEvent(new Event("resize"));
}

/**
 * Get Form data - for debugging.
 */
async function getFormData() {
    const formData = await client.getSpecificationFormData(GROUP_ALIAS, specificationId);
    console.log(formData);
}

/**
 * Check for existence of additional files.
 * 
 * @param {string} url - URL of file to confirm existence.
 */
async function fileExists(url) {
    const response = await fetch(url, { method: "HEAD" });
    if (!response.ok) {
        console.log(`Could not find file: ${url}`);
        console.log("Create this file to apply additional functionality.");
        return false;
    }

    console.log(`Additional file loaded: ${url}`);
    return true;
}

/**
 * On page unload, show dialog to confirm navigation.
 */
function attachPageUnloadDialog() {
    if (config.run.showWarningOnExit) {
        window.addEventListener("beforeunload", beforeUnloadHandler);
    }
}

/**
 * Remove dialog on page unload.
 */
function detachPageUnloadDialog() {
    window.removeEventListener("beforeunload", beforeUnloadHandler);
}

/**
 * Handle beforeunload event.
 * 
 * @param {Object} event - The beforeunload event object.
 */
function beforeUnloadHandler(event) {
    event.preventDefault();
    event.returnValue = "Are you sure you want to leave this page?";
}

/**
 * Set browser tab title to Specification name
 * 
 * @param {Object} specification - DriveWorks Specification object
 */
async function setTabTitleSpecificationName(specification) {
    const formData = await specification.getFormData();
    setTabTitle(formData.form.specificationName);
}

/**
 * Set browser tab title
 * 
 * @param {Object} text - The text to display in the title.
 */
function setTabTitle(text) {
    document.title = `${text} | Run - DriveWorks`;
}

/**
 * Display confirmation dialog before logout.
 */
function enableLogoutConfirmation() {

    // Get all logout buttons
    const logoutButtons = document.getElementsByClassName("logout-button");
    if (!logoutButtons) {
        return;
    }

    // Remove generic event, trigger custom dialog on click
    for (const logoutButton of logoutButtons) {
        logoutButton.removeEventListener("click", handleLogout);
        logoutButton.addEventListener("click", () => showConfirmationDialog(handleLogout));
    }
}

/**
 * Show custom confirmation dialog.
 * 
 * @param {function} confirmAction - The function to trigger on confirmation.
 * @param {string} [message] - The message to display in the dialog.
 */
function showConfirmationDialog(confirmAction, message = "Are you sure?") {
    if (!confirmAction) {
        return;
    }

    const dialog = document.createElement("div");
    dialog.classList.add("custom-dialog");

    // Overlay
    const overlay = document.createElement("div");
    overlay.classList.add("dialog-overlay");
    overlay.onclick = () => dismissDialog();
    dialog.appendChild(overlay);

    // Message box
    const messageBox = document.createElement("div");
    messageBox.classList.add("dialog-message");
    messageBox.innerHTML = `<p>${message}</p>`;

    // Confirm button
    const confirmButton = document.createElement("button");
    confirmButton.innerHTML = "Confirm";
    confirmButton.classList.add("confirm-button");
    confirmButton.onclick = () => {
        dialog.classList.add("is-loading");
        confirmAction();
        document.removeEventListener("keydown", dismissEscKey);
    };
    messageBox.appendChild(confirmButton);

    // Cancel button
    const cancelButton = document.createElement("button");
    cancelButton.innerHTML = "Cancel";
    cancelButton.classList.add("cancel-button");
    cancelButton.onclick = () => dismissDialog();
    messageBox.appendChild(cancelButton);

    // Show dialog (with animation)
    dialog.appendChild(messageBox);
    document.body.appendChild(dialog);
    setTimeout(() => {
        dialog.classList.add("open");
        confirmButton.focus();
    }, 50);

    // Dismiss dialog
    const dismissDialog = () => {
        dialog.remove();
        document.removeEventListener("keydown", dismissEscKey);
    }

    // Close with Esc key
    const dismissEscKey = (evt) => {
        evt = evt || window.event;
        if (evt.key === "Escape") {
            dismissDialog();
        }
    }
    document.addEventListener("keydown", dismissEscKey);
}
