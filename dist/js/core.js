/**
 * CORE FUNCTIONS
 */

const SERVER_URL = config.serverUrl;
const PING_INTERVAL = config.pingInterval;
const GROUP_ALIAS = localStorage.getItem("sessionAlias");
const CURRENT_SESSION = localStorage.getItem("sessionId");

/**
 * Get local Session Id from storage (between pages)
 */
getLocalSession = () => localStorage.getItem("sessionId");

/**
 * Instantiate client
 */

let client;
try {
    client = new window.DriveWorksLiveClient(SERVER_URL);
} catch (error) {
    handleUnauthorizedUser("Cannot access client.");
}

client._sessionId = getLocalSession();

/**
 * Quick Logout (?bye)
 * https://docs.driveworkspro.com/Topic/WebThemeLogout
 */
const coreQuery = new URLSearchParams(window.location.search);
if (coreQuery.has("bye")){
    handleLogout();
}

/**
 * Run on load
 */
(() => {

    // Check Session exists
    checkSession();

    // Display logged in username
    showUsername();

})();

/**
 * Check Session Id exists locally
 */
async function checkSession() {

    // If no session is stored (e.g. not logged in), redirect to login
    if (CURRENT_SESSION === null || CURRENT_SESSION === "undefined"){
        handleUnauthorizedUser();
    }

}

/**
 * Set login screen notice
 */
function setLoginNotice(text, state) {

    if (!state) {
        state = "info";
    }

    const notice = JSON.stringify({text,state});
    localStorage.setItem("loginNotice", notice);

}

/**
 * Redirect to login screen
 */
function redirectToLogin(notice, state, noReturnUrl) {

    // Clear Session from storage
    localStorage.clear();

    // Store login screen message
    if (notice && state){
        setLoginNotice(notice, state);
    }

    // Redirect to login
    if (noReturnUrl || !config.loginReturnUrls){
        window.location.replace("index.html");
        return;
    }

    // Redirect to login, with return url to restore position
    const currentLocation = window.location.pathname + window.location.search;
    window.location.replace(`index.html?returnUrl=${encodeURIComponent(currentLocation.substring(1))}`);

}

/**
 * Redirect on logout (destination set in config)
 */
function logoutRedirect() {

    // Clear Session from storage
    localStorage.clear();

    // Redirect
    window.location.replace(config.logout.redirectUrl);

}

/**
 * Logout action
 */
const logoutButtons = document.getElementsByClassName("logout-button");
if (logoutButtons) {
    for (const logoutButton of logoutButtons){
        logoutButton.addEventListener("click", handleLogout);
    }
}

async function handleLogout() {

    try {

        await client.logoutAllGroups();
        logoutRedirect();

    } catch (error) {
        handleGenericError(error);
    }

}

/**
 * Handle unauthorized users
 */
function handleUnauthorizedUser(error) {

    let message = "Please login to view that."
    if (error){
        message = error;
    }

    redirectToLogin(message, "error");
}

/**
 * Mobile navigation toggle (closed by default)
 */
const navList = document.getElementById("nav-list");

if (navList) {

    const navToggle = document.getElementById("nav-toggle");
    const navClose = document.getElementById("nav-close");

    navToggle.onclick = function() {
        document.body.classList.toggle("sidebar-open");
    };

    navClose.onclick = function () {
        document.body.classList.remove("sidebar-open");
    };

}

/**
 * Split string on uppercase
 */
function splitOnUpperCase(string) {
    return string.match(/[A-Z][a-z]+|[0-9]+/g).join(" ");
}

/**
 * Convert string formatting to lowercase & dashed  (e.g. "Total Price" => "total-price" )
 */
function stringToLowerDashed(string) {

    string = string.toLowerCase();
    string = string.replace(/[^a-zA-Z ]/g, "");
    string = string.replace(" ", "-");

    return string;
}

/**
 * Check if 2 objects are equal
 */
function objectsEqual(a, b) {
    return JSON.stringify(a) === JSON.stringify(b)
}

/**
 * Check object is empty
 */
function isEmpty(obj) {
    return Object.keys(obj).length === 0;
}

/**
 * Visual output of username
 */
function showUsername() {

    const usernameOutput = document.getElementById("active-username");

    if (usernameOutput){

        const username = localStorage.getItem("sessionUsername");
        if (username){
            usernameOutput.classList.add("is-shown");

            document.querySelector("#active-username .username").innerHTML = username;

        }

    }

}

/**
* Detect touch devices (alter UI accordingly)
*/
(function () {
    try {
        document.createEvent("TouchEvent");
        document.body.classList.add("touch");
    } catch (e) {
        document.body.classList.add("no-touch");
    }
})();

/**
 * Handle generic error
 */
function handleGenericError(error) {
    console.log(error);
}
