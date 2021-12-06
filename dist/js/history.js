/**
 * SPECIFICATION HISTORY
 */

const defaultLimit = 10;
const defaultDateOrder = "desc";
let renderedProperties = [];

const storageKeyName = "historyFilterName";
const storageKeyDateOrder = "historyDateOrder";
const storageKeyPosition = "historyPosition";

const historyList = document.getElementById("history-content");
const nameFilterInput = document.getElementById("name-filter-input");
const dateOrderToggle = document.getElementById("date-order-toggle");
const expandToggle = document.getElementById("expand-toggle");
const resetButton = document.getElementById("filter-reset-button");

let filterDateOrder = localStorage.getItem(storageKeyDateOrder) ?? defaultDateOrder;
let isLoadingHistory = false;
let blockLazyLoading = false;
let expandedView = false;
let filterTimeout;

/**
 * Start page functions.
 */
function startPageFunctions() {
    setCustomClientErrorHandler();
    attachScrollListener();

    // Reset previously stored scroll position
    localStorage.removeItem(storageKeyPosition);

    // Update filter UI to mirror stored values
    setDateOrderToggleState(filterDateOrder);

    // Get last stored query
    const oDataQueryString = getStoredQuery();
    getSpecificationsWithQuery(oDataQueryString, true);
};

/**
 * Attach a scroll listener to load items while scrolling down.
 */
function attachScrollListener() {
    window.onscroll = () => {

        // If scrolled to the end of the page body
        if ((window.innerHeight + window.scrollY) >= document.body.scrollHeight - 1) {

            // If loading isn't blocked (no more items) or already loading (stop duplication)
            if (!blockLazyLoading && !isLoadingHistory) {
                getNextPaginationChunk();
            }
        }
    };
}

/**
 * Restore previous filter query.
 * 
 * @param {number} top - Count of Specifications to return.
 * @param {number} skip - Count of Specifications to be skipped.
 */
function getStoredQuery(top, skip) {
    let query = "$top=";

    // Set limit (top)
    if (top) {
        query += top;
    } else {
        query += defaultLimit;
    }

    // Starting starting point (skip)
    if (skip) {
        query += "&$skip=" + skip;
    }

    // Get date order
    query += `&$orderby=DateEdited ${filterDateOrder}`;

    // Filter out running Specifications (shouldn't be shown/accessible)
    query += "&$filter=StateType ne 'Running'";

    // Get name filter
    const filterName = localStorage.getItem(storageKeyName);
    if (filterName) {
        query += `and contains(tolower(name), tolower('${filterName}'))`;
        nameFilterInput.value = filterName;
    }

    return query;
}

/**
 * Get Specifications by query.
 * 
 * @param {string} [oDataQueryString] - OData query string to filter Specifications returned.
 * @param {boolean} [clearList] - Optionally clear rendered list of Specifications.
 */
async function getSpecificationsWithQuery(oDataQueryString = "", clearList = false) {

    // Reset lazy-load blocking
    blockLazyLoading = false;

    try {
        const specifications = await client.getAllSpecifications(GROUP_ALIAS, oDataQueryString);
        if (!specifications) {
            return;
        }

        // Remove empty message (if previously shown)
        hideEmptyResults();

        // If 0 items are returned, block further loading
        const specificationCount = specifications.length;
        if (specificationCount === 0) {
            blockLazyLoading = true;

            clearLoadingState();
            if (clearList) {
                showEmptyResults();
            }

            return;
        }

        // If response is less than limit, disable further loading (no more items to be shown after this)
        if (specificationCount < defaultLimit) {
            blockLazyLoading = true;
        }

        // Render items
        renderSpecifications(specifications, clearList);
    } catch (error) {
        handleGenericError(error);
    }
}

/**
 * Render Specifications to container.
 * 
 * @param {Object} specifications - Object representing DriveWorks Specifications.
 * @param {boolean} [clearList] - Should the list container be cleared of all elements.
 */
async function renderSpecifications(specifications, clearList = false) {

    // Clear Specification list (optional: lazy-load adds to existing list)
    if (clearList) {
        clearHistoryList();
        window.scroll(0,0);
    }

    // Remove loading states
    clearActionsLoading();
    document.body.classList.remove("is-loading");

    // Build markup
    for (let index = 0; index < specifications.length; index++) {
        generateHistoryItem(specifications[index], index);
    }
}

/**
 * Generate history item markup.
 * 
 * @param {Object} specification - Object representing a single DriveWorks Specification.
 * @param {number} index - The index of the item in the list. Used for setting animated entrance delay.
 */
function generateHistoryItem(specification, index) {
    const status = specification.stateName;
    const dateEdited = specification.dateEdited;

    // Generate item
    const item = document.createElement("div");
    item.classList.add("history-item");
    item.style.setProperty("--index", index);
    item.setAttribute("data-id", specification.id);
    if (expandedView) {
        item.classList.add("is-expanded");
    }

    // Wrapper
    const itemContent = document.createElement("div");
    itemContent.classList.add("inner");

    // Details
    const details = `
        <a href="details.html?specification=${specification.id}" class="item-details">
            <h3 class="item-name">${specification.name}</h3>
            ${status && `<div class="status"><div class="status-tag status-${normalizeString(status)}" title="${status}">${splitOnUpperCase(status)}</div></div>`}
            ${dateEdited && `<div class="edit-date">${new Date(dateEdited).toLocaleString("en-GB", { minimumFractionDigits: 2 })}</div>`}
            <div><div class="view-action button">View</div></div>
        </a>
    `;
    itemContent.innerHTML = details;

    // Expand Action
    const expandButton = document.createElement("button");
    expandButton.classList.add("expand-button");
    expandButton.title = "Toggle Properties";
    expandButton.innerHTML = `
        <svg class="icon"><use xlink:href="dist/icons.svg#arrow-right"/></svg>
        <span>Expand</span>
    `;
    expandButton.addEventListener("click", () => {
        const toggleClass = "is-expanded";
        const container = expandButton.closest(".history-item");

        if (!container.classList.contains(toggleClass)) {
            getSpecificationProperties(specification.id);
        }

        container.classList.toggle(toggleClass);
    });
    itemContent.appendChild(expandButton);

    // Properties
    const propertiesContainer = document.createElement("div");
    propertiesContainer.classList.add("item-properties");

    // Remove loading state (after first item injected)
    clearLoadingState();

    // Inject new Specification item
    item.appendChild(itemContent);
    item.appendChild(propertiesContainer);
    historyList.appendChild(item);

    // Get Specification Properties (if expanded)
    if (expandedView) {
        getSpecificationProperties(specification.id);
    }
}

/**
 * Get Specification Properties.
 * 
 * @param {number} specificationId - The unique id of the Specification.
 */
async function getSpecificationProperties(specificationId) {

    // Check if previously requested & rendered
    if (renderedProperties.includes(specificationId.toString())) {
        return;
    }

    // Loading state
    const output = document.querySelector(`.history-item[data-id='${specificationId}'] .item-properties`);
    output.innerHTML = '<div class="loading-dots"></div>';

    // Request Properties
    const properties = await client.getSpecificationProperties(config.groupAlias, specificationId);

    // Create markup
    let markup;
    if (properties && !isEmpty(properties)) {
        markup = generateProperties(properties);
        renderedProperties.push(specificationId.toString());
    } else {
        markup = '<div class="empty-state">No additional properties.</div>';
    }

    // Render
    output.innerHTML = markup;
}

/**
 * Generate Property markup.
 * 
 * @param {Object} properties - Object containing Specification Properties.
 */
function generateProperties(properties) {
    let markup = "";
    for (const [name, value] of Object.entries(properties)) {
        const item = `
            <div class="prop-item prop-${normalizeString(name)}">
                <div>${name}: </div>
                <div>${value}</div>
            </div>
        `;
        markup += item;
    }
    return markup;
}

/**
 * Filter results by Specification name.
 * 
 * @param {string} name - Partial or complete name string to filter Specifications shown.
 */
async function filterSpecificationsByName(name) {
    try {
        const currentDateOrder = localStorage.getItem(storageKeyDateOrder) ?? defaultDateOrder;

        // Create OData filter (contains name)
        const query = `$filter=contains(tolower(name), tolower('${escapeStringForOData(name)}')) and StateType ne 'Running'&$orderby=DateEdited ${currentDateOrder}&$top=${defaultLimit}`;

        // Reset stage
        resetFilterPosition();

        // Return results based on name query
        getSpecificationsWithQuery(query, true)

        // Save filtered name (to restore on reload)
        localStorage.setItem(storageKeyName, name);
    } catch (error) {
        handleGenericError(error);
    }
}

/**
 * Filter Input: Specification name.
 */
nameFilterInput.onkeyup = (e) => {

    // Ignore tab navigation (forwards + backwards)
    if (e.key == "Tab" || e.key == "Shift") {
        return;
    }

    // Delay to allow brief typing period
    clearTimeout(filterTimeout);
    filterTimeout = setTimeout(function () {
        document.body.classList.add("is-loading");
        nameFilterInput.parentNode.classList.add("is-loading");

        filterSpecificationsByName(nameFilterInput.value);
    }, 300);
};

/**
 * Filter Toggle: date order.
 */
dateOrderToggle.onclick = () => {

    // Show loading state
    document.body.classList.add("is-loading");
    window.scroll(0, 0);

    // Switch stored order
    filterDateOrder = (filterDateOrder === "desc" ? "asc" : "desc");
    setDateOrderToggleState(filterDateOrder);

    // Flip order in query items
    let query = "$orderby=DateEdited " + filterDateOrder + "&$top=" + defaultLimit;

    // Filter with name (if set)
    const filterName = localStorage.getItem(storageKeyName);
    if (filterName) {
        query += "&$filter=startswith(tolower(name), tolower('" + filterName + "'))";
    }

    // Reset stage
    resetFilterPosition();

    // Render in new order
    getSpecificationsWithQuery(query, true);

    // Stored new order
    localStorage.setItem(storageKeyDateOrder, filterDateOrder);
};

/**
 * Set date order toggle state.
 * 
 * @param {string} order - Order to set toggle state (asc/desc).
 */
function setDateOrderToggleState(order) {
    // Reset
    dateOrderToggle.classList.remove("order-asc", "order-desc");

    // Set state
    dateOrderToggle.classList.add(`order-${order}`);
    dateOrderToggle.querySelector("span").innerHTML = order == "desc" ? "Newest First" : "Oldest First";
}

/**
 * Filter toggle: expand - toggle Specification Properties.
 */
expandToggle.onclick = () => {

    // Toggle state
    expandedView = !expandedView;

    // Update toggle state
    setExpandToggleState();

    // Toggle items
    const items = document.querySelectorAll(".history-item");
    const expandClass = "is-expanded";
    items.forEach((item) => {

        // Expand item
        if (expandedView) {
            item.classList.add(expandClass);
            getSpecificationProperties(item.dataset.id);
            return;
        }

        // Collapse item
        item.classList.remove(expandClass);
    });
};

/**
 * Set expand toggle state.
 */
function setExpandToggleState() {
    const icon = expandToggle.querySelector("[data-icon]");
    const text = expandToggle.querySelector("[data-text]");

    // Expanded (show "Collapse" action)
    if (expandedView) {
        icon.innerHTML = '<svg class="icon"><use xlink:href="dist/icons.svg#collapse" /></svg>';
        text.innerHTML =  "Collapse";
        return;
    }

    // Collapsed (show "Expand" action)
    icon.innerHTML = '<svg class="icon"><use xlink:href="dist/icons.svg#expand" /></svg>';
    text.innerHTML = "Expand";
}

/**
 * Filter action: reset.
 */
resetButton.onclick = () => {

    // Show loading state
    document.body.classList.add("is-loading");
    window.scroll(0, 0);

    // Clear stored query
    localStorage.removeItem(storageKeyName);
    localStorage.removeItem(storageKeyDateOrder);
    localStorage.removeItem(storageKeyPosition);

    // Clear input
    nameFilterInput.value = "";

    // Reset expanded state
    expandedView = false;
    setExpandToggleState("expand");

    // Reset order state
    filterDateOrder = defaultDateOrder;
    setDateOrderToggleState(filterDateOrder);

    // Allow lazy loading
    blockLazyLoading = false;

    // Update list
    const oDataQueryString = getStoredQuery();
    getSpecificationsWithQuery(oDataQueryString, true);
};

/**
 * Load next chunk of Specification items.
 */
 function getNextPaginationChunk() {

    // Prevent parallel loading
    isLoadingHistory = true;

    // Show loading state
    addLoadingState();

    // Get stored position (results previously shown)
    const storedPosition = localStorage.getItem(storageKeyPosition);
    if (storedPosition) {
        newPosition = parseFloat(storedPosition);
    } else {
        newPosition = defaultLimit;
    }

    // Append new Specifications
    const oDataQueryString = getStoredQuery(defaultLimit, newPosition);
    getSpecificationsWithQuery(oDataQueryString);

    // Increment stored position (to match items shown)
    localStorage.setItem(storageKeyPosition, newPosition + defaultLimit);
}

/**
 * Add loading state element to end of list.
 */
function addLoadingState() {

    // Add loading element
    const loading = document.createElement("div");
    loading.classList.add("history-loading", "history-skeleton");

    const markup = `
        <div class="skeleton-block"></div>
        <div class="skeleton-block"></div>
        <div class="skeleton-block"></div>
        <div class="skeleton-block"></div>
    `;
    loading.innerHTML = markup;

    historyList.appendChild(loading);
}

/**
 * Clear any loading state.
 */
function clearLoadingState() {

    // Reset loading state (delay to stop potential overlap)
    setTimeout(() => {
        isLoadingHistory = false;
    }, 250);

    // Remove inline loading indicators (lazy-load)
    document.querySelectorAll(".history-loading").forEach(e => e.remove());
}

/**
 * Clear list.
 */
function clearHistoryList() {
    historyList.innerHTML = "";
    clearRenderedProperties();
}

/**
 * Clear actions loading states.
 */
function clearActionsLoading() {

    // Name input
    nameFilterInput.parentNode.classList.remove("is-loading")

    // Buttons
    const actions = document.querySelectorAll(".history-controls button")
    for (let i = 0; i < actions.length; i++) {
        actions[i].classList.remove("is-loading");
    }
}

/**
 * Reset rendered Specification Properties.
 */
 function clearRenderedProperties() {
    renderedProperties = [];
}

/**
 * Show empty results message.
 */
function showEmptyResults() {

    // Show message
    const markup = '<div class="history-empty">No matching results found.</div>';
    historyList.innerHTML = markup;

    // Clear loading state
    document.body.classList.remove("is-loading");

    clearActionsLoading();
}

/**
 * Hide empty results message.
 */
function hideEmptyResults() {
    const empty = document.getElementsByClassName("history-empty");
    if (empty.length > 0) {
        empty[0].parentNode.removeChild(empty[0]);
    }
}

/**
 * Reset stored position.
 */
function resetFilterPosition() {
    localStorage.removeItem(storageKeyPosition);
    allowLoad = true;
}

/**
 * Ensure string is valid for use in OData.
 * 
 * @param {string} string - The string to escape.
 */
function escapeStringForOData(string) {
    return cleanString = encodeURIComponent(string.replaceAll(/'/g, "''"));
}

/**
* Track sticky header - stuck or unstuck.
*/
const pageHeader = document.querySelector(".history-controls");
const headerObserver = new IntersectionObserver(
    ([e]) => e.target.classList.toggle("is-stuck", e.intersectionRatio < 1),
    { threshold: [1] }
);
headerObserver.observe(pageHeader);
