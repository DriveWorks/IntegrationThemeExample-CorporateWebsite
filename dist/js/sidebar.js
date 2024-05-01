sidebarLinks: [
    {
        title: "Projects",
        icon: "projects",
        href: "projects.html",
    },
    {
        title: "DriveApps",
        icon: "drive-apps",
        href: "drive-apps.html",
    },
    {
        title: "History",
        icon: "history",
        href: "history.html",
    },
    {
        title: "Reset Password",
        icon: "reset",
        href: "query?DWConstantForm=PasswordReset",
    },
]


/**
 * @param {string} title The text to display in the sidebar
 * @param {string} icon The name of the icon in the icons.svg file
 * @param {string} link The link to navigate to when the sidebar item is clicked
 * @returns {HTMLElement} li The list item element
 */
function sideBarListItem(title, icon, link) {
    // Example: Projects, projects, projects.html
    /* <li>
        <a href="projects.html">
            <svg class="icon">
                <use xlink:href="dist/icons.svg#projects" />
            </svg>
            Projects
        </a>
    </li> */
    
    var li = document.createElement("li");
    var innerCode = `
        <a href="${link}">
            <svg class="icon">
                <use xlink:href="dist/icons.svg#${icon}" />
            </svg>
            ${title}
        </a>
    `;
    li.innerHTML = innerCode;

    return li;
}

/**
 * Loop through config.sidebarLinks and create a list item for each link
 * @returns {HTMLUListElement} ul The unordered list element
 */
function sideBarList() {
    var ul = document.createElement("ul");
    ul.classList.add("sidebar-list");

    for (var i = 0; i < config.sidebarLinks.length; i++) {
        var title = config.sidebarLinks[i].title;
        var icon = config.sidebarLinks[i].icon;
        var link = config.sidebarLinks[i].href;
        var li = sideBarListItem(title, icon, link);
        ul.appendChild(li);
    }

    // Get the current page's filename and if it matches the link, add the active class
    var currentPage = window.location.pathname.split("/").pop();
    var links = ul.querySelectorAll("a");
    for (var i = 0; i < links.length; i++) {
        var link = links[i];
        var href = link.getAttribute("href");
        var linkPage = href.split("/").pop();
        if (linkPage === currentPage) {
            link.classList.add("is-current");
        }
    }

    return ul;
}

const sidebar = document.querySelector("#nav-list ul");
const logoutList = sidebar.innerHTML;
sidebar.innerHTML = sideBarList().outerHTML + logoutList;

