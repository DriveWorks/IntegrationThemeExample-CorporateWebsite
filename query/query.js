/**
 *  Query Function
 *  ------------------
 *
 *  Create or edit Specifications using a URL.
 *  This can be useful for linking directly to a Specification from:
 *      - External sites
 *      - Team Sharing
 *      - Emails
 *
 *  To use this function, the query string of your URL must include particular parameters,
 *  depending on the intended Action to perform.
 *
 *  Multiple Actions can be performed at once by combining the query parameters using the & symbol.
 *
*/

const debugMode = false;

/**
 * Load Settings
*/
const CURRENT_SESSION_ID = localStorage.getItem("sessionId");
const CURRENT_SESSION_ALIAS = localStorage.getItem("sessionAlias");
const REQUIRE_NEW_SESSION = config.query.requireNewSession;
const REQUIRE_EXACT_ALIAS = config.query.requireExactAlias;

/**
 * Start client
**/
const SERVER_URL = config.serverUrl;
const client = new window.DriveWorksLiveClient(SERVER_URL);

/**
 * Load defaults
**/
let autoLogin = config.query.autoLogin;
let groupAlias = config.query.defaultGroupAlias;
let projectName = config.query.defaultProjectName;

/**
 * Get url query data
*/
const query = new URLSearchParams(window.location.search);
const queryAlias = query.get("alias") || query.get("Alias") || query.get("user") || query.get("User");
const queryProject = query.get("run") || query.get("Run");
const querySpecification = query.get("specification") || query.get("Specification");
const queryOperation = query.get("operation") || query.get("Operation");
const queryTransition = query.get("transition") || query.get("Transition");
if (queryAlias){
    groupAlias = queryAlias;
    autoLogin = true; // If a username has been specified, then it should be treated as an autoLogin
}
if (queryProject){
    projectName = queryProject; // Override the default Project, if supplied
}

/**
 * Run on load
*/
(async function() {
    try {
        startFunction();
    } catch (error) {
        handleGenericError(error);
    }

})();

/**
 * Quick Logout (?bye)
 * https://docs.driveworkspro.com/Topic/WebThemeLogout
 */
if (query.has("bye")){
    handleLogout();
}

/**
 * Execute the function
*/
async function startFunction(){
    debug("Start query");

    // Maintain the current Session if we don't need to auto login
    if (autoLogin){
        debug("Auto login");

        // If there is no Session, start one
        if (CURRENT_SESSION_ID){
            debug("Current Session");

            const usersAreDifferent = CURRENT_SESSION_ALIAS !== groupAlias;
            debug(`usersAreDifferent: ${usersAreDifferent}`);
            debug(`REQUIRE_EXACT_ALIAS: ${REQUIRE_EXACT_ALIAS}`);

            const requireSessionRestart = REQUIRE_NEW_SESSION || (REQUIRE_EXACT_ALIAS && usersAreDifferent);
            if (requireSessionRestart){
                debug("Restart required");

                try {

                    // Logout and start a new Session
                    await client.logoutAllGroups();
                    await startSession();

                } catch (error){
                    handleGenericError(error);
                }

            } else {
                debug("No restart required");
            }

        } else {

            await startSession();

        }

    }

    // Redirect to login page if we are not logged in
    const loggedIn = await ensureLoggedIn();
    if (loggedIn){
        debug("Logged in");

        processQuery();

    } else {
        debug("Not logged in");
    }

}

/**
 * Start new Session (supplied Group Alias or default [fallback])
 */
async function startSession(){
    debug("Start Session");

    // If no Group Alias passed or none set as default, exit.
    if (!groupAlias){
        debug("No Group Alias");
        return false;
    }

    try {

        // Attempt login with Group Alias (supplied or default)
        const login = await client.loginGroup(groupAlias);
        debug(login);

        // Store Group Alias and Session Id returned
        localStorage.setItem("sessionAlias", groupAlias);
        localStorage.setItem("sessionId", login.sessionId);

    } catch (error){
        handleGenericError(error);
    }

}

/**
 * Ensure valid login
 */
async function ensureLoggedIn() {
    debug("Ensure logged in");

    try {

        // Test connection by trying to get Projects
        const response = await client.getProjects(groupAlias);
        return response;

    } catch (error) {
        handleGenericError(error);
        redirectToLogin();
    }

}

/**
* Process query data
*/
async function processQuery(){
    debug("Process query");

    // If Project (query/config default) or Specification passed
    if (!projectName && !querySpecification){
        debug("No Project or Specification passed.");

        // Go to dashboard
        window.location.href = "../projects.html";

    } else {

        // Check if trying to run Operation/Transition without a defined Specification Id
        if ( (queryOperation || queryTransition) && !querySpecification ){
            redirectToLogin("Transition or Operation passed without Specification Id.", "error");
            return false;
        }

        // Handle query
        if (querySpecification && querySpecification !== ""){
            processSpecification();
        } else {
            runProject();
        }

    }

}

/**
* RUN PROJECT
*
* This will run a Project.
*
* Parameter: run={ProjectName}
*
*/
async function runProject(){
    debug(`Run project: ${projectName}`);

    // New Specification from specified Project
    window.location.href = `../run.html?project=${projectName}`;

}

/**
* PROCESS SPECIFICATION
*/
async function processSpecification(){
    debug("Process specification");

    // Check for Operation or Transition in query
    if (queryOperation && queryOperation !== ""){
        performOperation();
    } else if (queryTransition && queryTransition !== ""){
        performTransition();
    } else {
        viewSpecification();
    }

}

/**
* VIEW SPECIFICATION
*
* This will display the details of the existing Specification.
*
* Parameter: specification={SpecificationName}
*
*/
function viewSpecification(){
    debug(`View spec: ${querySpecification}`);

    // Open Specification
    window.location.href = `../details.html?specification=${querySpecification}`;

}

/**
* PERFORM OPERATION
*
* This will perform an Operation on a particular Specification.
* The Operation name passed must be a valid, with all conditions met for the Specification, for this to run.
*
* Parameter: specification={SpecificationName}&operation={OperationName}
*
*/
async function performOperation(){
    debug(`Perform operation: ${queryOperation}`);

    try {

        // Get latest Actions (to validate Operation)
        await client.getSpecificationActions(groupAlias, querySpecification);

        // Invoke Operation if allowed
        await client.invokeOperation(groupAlias, querySpecification, queryOperation);

        // View Specification details (after Operation)
        window.location.href = `../details.html?specification=${querySpecification}`;

    } catch (error){
        handleGenericError(error);

        // Redirect to login screen
        redirectToLogin("Error performing operation.", "error");

    }

}

/**
* PERFORM TRANSITION
*
* This will perform a Transition on a particular Specification.
* The Transition name passed must be valid, with all conditions met for the Specification, for this to run.
*
* Parameter: specification={SpecificationName}&transition={TransitionName}
*
*/
async function performTransition(){
    debug(`Perform transition: ${queryTransition}`);

    try {

        // Get latest Actions (to validate Transition)
        await client.getSpecificationActions(groupAlias, querySpecification);

        // Invoke Transition
        await client.invokeTransition(groupAlias, querySpecification, queryTransition);

        // Run Specification in new transitioned state
        window.location.href = `../run.html?specification=${querySpecification}`;

    } catch (error){
        handleGenericError(error);

        // Redirect to login screen
        redirectToLogin("Error performing transition.", "error");

    }

}

// Display error on screen
function showError(message){

    const markup = document.createElement("p");
    markup.innerHTML = message;

    document.getElementById("error-message").appendChild(markup);

}

/**
 * Handle logout
 */
async function handleLogout() {

    try {

        // Log out any existing Sessions
        await client.logoutAllGroups();

        redirectToLogin("You have been logged out.", "success");

    } catch (error) {
        handleGenericError(error);
    }

}

/**
 * Redirect to login
 */
function redirectToLogin(notice, state) {

    // Clear Session (any invalid details)
    localStorage.clear();

    if (notice && state){
        setLoginNotice(notice, state);
    } else {
        setLoginNotice("Login to access that.", "error");
    }

    // Redirect
    window.location.href = "../index.html?redirect=query-error";

}

/**
 * Set login screen notice
 */
function setLoginNotice(text, state) {

    if (!state) {
        state = "info";
    }

    const notice = JSON.stringify({ text: text, state: state });
    localStorage.setItem("loginNotice", notice);

}

/**
 * Handle generic errors e.g. tryCatch
 */
function handleGenericError(error) {
    console.log(error);
}

/**
 * Debug
 */
function debug(message) {
    if (debugMode){
        console.log(message);
    }
}
