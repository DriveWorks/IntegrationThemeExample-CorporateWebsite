/**
 * Query Function (/query?...)
 * ---------------------------
 *
 * Run Projects and manage Specifications using URL queries.
 * This can be useful for linking directly to specific states from:
 *  - External sites
 *  - Team sharing
 *  - Email links
 * 
 * To use this function, the query string of your URL must include particular parameters.
 * The parameters provided will describe the intended action to perform.
 * 
 * Multiple actions can be performed at once by combining parameters using the '&' symbol.
 * 
 * Examples:
 * 
 * Run a Project.
 *  /query?run={ProjectName}
 *  /query?project={ProjectName}
 *      - If no Group Alias is specified, requires:
 *          config.query.defaultGroupAlias: "{DefaultAlias}",
 *          config.query.autoLogin: true
 * 
 * Run a DriveApp.
 *  /query?driveApp={DriveAppAlias}
 * 
 * Use a specific Group Alias.
 *  /query?alias={GroupAlias}&run={ProjectName}
 *  /query?alias={GroupAlias}&driveApp={DriveAppAlias}
 *  /query?alias={GroupAlias}&specification={SpecificationId}
 *      - Overrides config.query.defaultGroupAlias, if set.
 * 
 * View a Specification.
 *  /query?specification={SpecificationId}
 * 
 * Run a Macro.
 *  /query?run={ProjectName}&DWMacro{MacroName}
 *  /query?run={ProjectName}&DWMacro{MacroName}={OptionalArgument}
 *  /query?run={ProjectName}&DWMacro{MacroOne}&DWMacro{MacroTwo}
 *  /query?run={ProjectName}&DWMacro{MacroOne}={OptionalArgumentOne}&DWMacro{MacroTwo}={OptionalArgumentTwo}
 * 
 * Drive a Constant.
 *  /query?run={ProjectName}&DWConstant{ConstantName}={Value}
 *  /query?run={ProjectName}&DWConstant{ConstantOne}={Value}&DWConstant{ConstantTwo}={Value}
 * 
 * Invoke a Transition on a Specification. View Specification in running state (run.html).
 *  /query?specification={SpecificationId}&transition={TransitionName}
 * 
 * Invoke an Operation on a Specification. View Specification details (details.html).
 *  /query?specification={SpecificationId}&operation={OperationName}
 * 
 * Log out of all Groups.
 *  /query?bye
 * 
 */

// Enable console output to assist debugging
const DEBUG_MODE = false;

// Load settings from config file (config.js)
const REQUIRE_NEW_SESSION = config.query.requireNewSession;
const REQUIRE_EXACT_ALIAS = config.query.requireExactAlias;
const SERVER_URL = config.serverUrl;
let groupAlias = config.query.defaultGroupAlias;
let autoLogin = config.query.autoLogin;

// Get URL query values
const urlQuery = new URLSearchParams(window.location.search);

// Global client
let client;

/**
 * When external DriveWorks Live client library loads, create client and process request.
 */
async function dwClientLoaded() {

    // Create client
    try {
        client = new window.DriveWorksLiveClient(SERVER_URL);
    } catch (error) {
        debug(error, true);
        displayErrorMessage("Could not create client.");
        return;
    }

    await processRequest();
}

/**
 * Process query request - ensure valid session before handling data.
 */
async function processRequest() {

    // Quick logout using query string "?bye".
    // Mirrors functionality: https://docs.driveworkspro.com/Topic/WebThemeLogout
    if (urlQuery.has("bye")) {
        handleLogout();
        return;
    }

    // Handle session
    const sessionManager = new SessionManager();
    const session = await sessionManager.handleSession();
    if (!session) {
        displayErrorMessage("Invalid session.");
        return;
    }

    // Process query data
    const queryManager = new QueryManager();
    await queryManager.processQuery();
}

/** Class representing a Session manager. */
class SessionManager {

    /**
     * Handle retrieval of existing session, or creation of new session.
     */
    async handleSession() {

        // Get Group Alias from query
        const queryAlias = urlQuery.get("alias") || urlQuery.get("Alias") || urlQuery.get("user") || urlQuery.get("User");
        if (queryAlias) {
            groupAlias = queryAlias;   // Override the default Group Alias (if set in config.js)
            autoLogin = true;           // If a Group Alias is specified, it should be treated as an automatic login.
        }

        if (autoLogin) {
            await this.handleAutoLogin();
        }

        // Ensure session is valid
        const validSession = await this.checkSessionValid();
        if (!validSession) {
            debug("Invalid session - not logged in.");
            return false;
        }

        debug("Valid session - logged in.");
        return true;
    }

    /**
     * Handle automatic login to Group.
     */
    async handleAutoLogin() {
        debug("Auto login.");

        // Get stored session data
        const currentSessionId = localStorage.getItem("sessionId");
        const currentSessionAlias = localStorage.getItem("sessionAlias");
        if (!currentSessionId) {
            debug("No existing Session found.");
            await this.startSession();
            return;
        }

        const aliasIsDifferent = currentSessionAlias !== groupAlias;
        const restartSession = REQUIRE_NEW_SESSION || (REQUIRE_EXACT_ALIAS && aliasIsDifferent);

        debug("Found existing Session.");
        debug(`- Alias is different? ${aliasIsDifferent}`);
        debug(`- config.query.requireExactAlias: ${REQUIRE_EXACT_ALIAS}`);
        debug(`- config.query.requireNewSession: ${REQUIRE_NEW_SESSION}`);

        if (!restartSession) {
            debug("= No Session restart required.");
            return;
        }

        debug("= Session restart required.");
        await this.restartSession();
    }

    /**
     * Start new Session - using supplied Group Alias, or config default.
     */
    async startSession() {
        debug("Start new Session.");

        // Check Group Alias provided (passed in query, or default in config)
        if (!groupAlias) {
            displayErrorMessage("No Group Alias provided.");
            return false;
        }

        try {
            debug(`- Group Alias: ${groupAlias}`);

            // Attempt to login with Group Alias
            const session = await client.loginGroup(groupAlias);
            debug(session);

            // Store Group Alias and Session Id returned
            localStorage.setItem("sessionAlias", groupAlias);
            localStorage.setItem("sessionId", session.sessionId);
        } catch (error) {
            debug(error, true);
            displayErrorMessage("Cannot login with the supplied Group Alias.");
        }
    }

    /**
     * Logout of all Groups and start a fresh Session.
     */
    async restartSession() {
        try {
            await client.logoutAllGroups();
            await this.startSession();
        } catch (error) {
            debug(error, true);
        }
    }

    /**
     * Check the Group login is valid.
     */
    async checkSessionValid() {
        debug("Check Group session is valid.");

        if (!groupAlias) {
            displayErrorMessage("No Group Alias provided.");
            return false;
        }

        try {
            // Test connection validity by attempting to access Projects data.
            await client.getProjects(groupAlias, "$top=0");
            return true;
        } catch (error) {
            debug(error, true);
            return false;
        }
    }
}

/** Class representing a Query manager. */
class QueryManager {

    /**
     * Process query data.
     */
    async processQuery() {
        debug("Process query.");

        // Get and validate query data
        await this.retrieveQueryData();

        const validQuery = await this.validateQueryData();
        if (!validQuery) {
            return;
        }

        // Existing Specification
        if (this.specificationId && this.specificationId !== "") {
            await this.processSpecificationData();
            return;
        }

        // DriveApp
        if (this.driveAppAlias && this.driveAppAlias !== "") {
            await this.runDriveApp();
            return;
        }

        await this.runProject();
    }

    /**
     * Get and store data from query string.
     */
    async retrieveQueryData() {
        const queryProjectName = urlQuery.get("run") || urlQuery.get("Run") || urlQuery.get("project") || urlQuery.get("Project");
        this.projectName = queryProjectName ? queryProjectName : config.query.defaultProjectName;
        this.driveAppAlias = urlQuery.get("driveapp") || urlQuery.get("driveApp") || urlQuery.get("DriveApp");
        this.specificationId = urlQuery.get("specification") || urlQuery.get("Specification");
        this.operationName = urlQuery.get("operation") || urlQuery.get("Operation");
        this.transitionName = urlQuery.get("transition") || urlQuery.get("Transition");

        // Process Constants and Macros
        const QUERY_PREFIX_CONSTANTS = "DWConstant";
        const QUERY_PREFIX_MACROS = "DWMacro";

        let querySpecificationParameters = "";
        for (const [key, value] of urlQuery) {
            if (!key.startsWith(QUERY_PREFIX_CONSTANTS) && !key.startsWith(QUERY_PREFIX_MACROS)) {
                continue;
            }
            const parameter = `&${key}${value ? `=${value}` : ""}`;
            querySpecificationParameters += parameter;

            debug(`Stored new query parameter: ${parameter}`);
        }
        this.specificationParameters = querySpecificationParameters;
    }

    /**
     * Validate query data is complete.
     */
    async validateQueryData() {

        // No Project/DriveApp name or Specification Id passed
        if (!this.projectName && !this.driveAppAlias && !this.specificationId) {
            displayErrorMessage("No Project/DriveApp name or Specification Id provided.");
            return false;
        }

        // Check if trying to run Operation/Transition without a defined Specification Id
        if (!this.specificationId || this.specificationId == "") {

            if (this.operationName) {
                displayErrorMessage("Operation provided without Specification Id.");
                return false;
            }

            if (this.transitionName) {
                displayErrorMessage("Transition provided without Specification Id.");
                return false;
            }
        }

        return true;
    }

    /**
     * Navigate to running view of supplied Project.
     * URL Structure: run={ProjectName}
     */
    async runProject() {
        debug(`Run Project: ${this.projectName}`);

        // Navigate to new running Specification.
        window.location.href = `../run.html?project=${this.projectName}${this.specificationParameters}`;
    }

    /**
     * Navigate to running view of supplied DriveApp.
     * URL Structure: driveApp={DriveAppAlias}
     */
    async runDriveApp() {
        debug(`Run DriveApp: ${this.driveAppAlias}`);

        // Navigate to new running Specification.
        window.location.href = `../run.html?driveApp=${this.driveAppAlias}${this.specificationParameters}`;
    }

    /**
     * Process supplied Specification data.
     */
    async processSpecificationData() {
        debug("Process Specification data");

        const valid = await this.validateSpecificationId();
        if (!valid) {
            displayErrorMessage("Invalid Specification Id.");
            return;
        }

        // Check for Operation or Transition in query
        if (this.operationName && this.operationName !== "") {
            this.performOperation();
            return;
        }
        if (this.transitionName && this.transitionName !== "") {
            this.performTransition();
            return;
        }

        this.viewSpecification();
    }

    /**
     * Confirm Specification Id matches valid Specification.
     */
    async validateSpecificationId() {
        try {
            await client.getSpecificationById(groupAlias, this.specificationId);
            return true;
        } catch (error) {
            debug(error, true);
            return false;
        }
    }

    /**
     * Perform an Operation on the supplied Specification Id, and redirect to the "Details" view.
     * URL Structure: specification={SpecificationId}&operation={OperationName}
     */
    async performOperation() {
        debug(`Perform Operation: ${this.operationName}`);

        try {
            // Get latest Actions (to validate Operation is available)
            await client.getSpecificationOperationByName(groupAlias, this.specificationId, this.operationName);

            // Invoke Operation
            await client.invokeOperation(groupAlias, this.specificationId, this.operationName);

            // View Specification details (after Operation)
            this.viewSpecification();
        } catch (error) {
            debug(error, true);
            displayErrorMessage(`Could not perform Operation "${this.operationName}".`);
        }
    }

    /**
     * Perform a Transition on the supplied Specification, and redirect to the run view.
     * URL Structure: specification={SpecificationId}&transition={TransitionName}
     */
    async performTransition() {
        debug(`Perform Transition: ${this.transitionName}`);

        try {
            // Get latest Actions (to validate Transition is available)
            await client.getSpecificationTransitionByName(groupAlias, this.specificationId, this.transitionName);

            // Invoke Transition
            await client.invokeTransition(groupAlias, this.specificationId, this.transitionName);

            // Check Specification state following Transition
            const specification = await client.getSpecificationById(groupAlias, this.specificationId);

            const RUNNING_STATE_ID = 0;
            if (specification.stateType == "Running" || specification.stateType === RUNNING_STATE_ID) {
                this.runSpecification();
                return;
            }

            this.viewSpecification();
        } catch (error) {
            debug(error, true);
            displayErrorMessage(`Could not perform Transition "${this.transitionName}".`);
        }
    }

    /**
     * Redirect to the details view of an existing Specification.
     * URL Structure: specification={SpecificationId}
     */
    viewSpecification() {
        debug(`View Specification: ${this.specificationId}`);

        // Navigate to Specification details.
        window.location.href = `../details.html?specification=${this.specificationId}`;
    }

    /**
     * Redirect to the running view of an existing Specification.
     */
    runSpecification() {
        debug(`View Specification: ${this.specificationId}`);

        // Navigate to running Specification.
        window.location.href = `../run.html?specification=${this.specificationId}${this.specificationParameters}`;
    }
}

/**
 * Handle group logout and redirect to login.
 */
async function handleLogout() {
    try {
        await client.logoutAllGroups();
    } catch (error) {
        debug(error, true);
    }

    redirectToLogin("You have been logged out.", "success");
}

/**
 * Redirect to login screen, passing query data (if enabled).
 * @param {string} notice - The text to display in the notice on the login screen.
 * @param {string} [state] - The state of the notice - "error", "success", "info".
 * @param {boolean} [addReturnUrl] - Append return URL to redirected location.
 */
function redirectToLogin(notice, state = "error", addReturnUrl = false) {

    // Clear any invalid details that may have been stored
    localStorage.clear();

    // Set login notice
    if (notice) {
        this.setLoginNotice(notice, state);
    } else {
        this.setLoginNotice("Login to access that.", "error");
    }

    let logoutQuery = "source=query";
    if (addReturnUrl && config.loginReturnUrls) {
        logoutQuery = `returnUrl=query&${window.location.search.replaceAll("?", "")}`;
    }

    // Redirect to login screen, with query value.
    window.location.href = `../index.html?${logoutQuery}`;
}

/**
 * Set login screen notice.
 * @param {string} notice - The text to display in the notice on the login screen.
 * @param {string} state - The state of the notice - "error", "success", "info".
 */
function setLoginNotice(notice, state) {
    if (!notice || !state) return;

    const noticeData = JSON.stringify({
        text: notice,
        state: state
    });
    localStorage.setItem("loginNotice", noticeData);
}

/**
 * Display on-screen error message.
 * @param {string} message - The message to display on-screen.
 * @param {boolean} [clearSession] - Clear Session data stored in localStorage.
 */
function displayErrorMessage(message, clearSession = false) {
    const errorMessage = document.querySelector("[data-error-message]");
    const content = document.createElement("div");

    // Show message

    content.classList.add("message");
    content.innerHTML = `Error: ${message}`;
    errorMessage.prepend(content);
    errorMessage.classList.remove("hidden");

    // Update template
    document.querySelector("[data-loading-state]").classList.add("hidden");
    document.title = "Query Error | DriveWorks";

    if (!clearSession) return;
    clearSessionData();
}

/**
 * Clear Session data in localStorage.
 */
function clearSessionData() {
    localStorage.removeItem("sessionId");
    localStorage.removeItem("sessionAlias");
}

/**
 * Debug console messaging.
 * @param {string|object} message - Error object, or the message string to display in the console.
 * @param {boolean} forceLog - Force logging if debug mode is disabled.
 */
function debug(message, forceLog = false) {
    if (DEBUG_MODE || forceLog) {
        console.log(message);
    }
}
